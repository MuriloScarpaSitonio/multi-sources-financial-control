from __future__ import annotations

import base64
import contextlib
import json
import locale
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from operator import mul, truediv
from typing import TYPE_CHECKING, Literal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import F
from django.utils import timezone

from .adapters.key_value_store import get_dollar_conversion_rate
from .choices import AssetTypes, Currencies, PassiveIncomeTypes, TransactionActions
from .models import Asset, AssetClosedOperation, AssetMetaData, Transaction
from .service_layer.tasks import upsert_asset_read_model

if TYPE_CHECKING:
    from .models.managers import AssetQuerySet

UserModel = get_user_model()


def _get_closed_roi(month: int, year: int, asset_id: int) -> Decimal:
    try:
        return (
            AssetClosedOperation.objects.filter(
                asset_id=asset_id,
                operation_datetime__month=month,
                operation_datetime__year=year,
            )
            .annotate_roi()
            .values("roi")
            .get()
        )["roi"]
    except AssetClosedOperation.DoesNotExist:
        return Decimal()


def _print_assets_portfolio(qs: AssetQuerySet[Asset], year: int) -> None:
    results = []
    for i, asset in enumerate(
        qs.annotate_irpf_infos(year=year)
        .filter(transactions_balance__gt=0)
        .values(
            "code", "currency", "transactions_balance", "avg_price", "total_invested", "description"
        ),
        start=1,
    ):
        # Preço médio sempre na moeda original e total em reais
        # TODO: adicionar dolar médio
        currency_symbol = Currencies.get_choice(asset["currency"]).symbol
        results.append(
            f"{i}. {asset['code']} - {asset['description']}"
            if asset["description"]
            else f"{i}. {asset['code']}"
        )
        results.append(f"\tQuantidade: {asset['transactions_balance']:n}")
        results.append(f"\tPreço médio: {currency_symbol} {asset['avg_price']:n}")
        results.append(f"\tTotal: R$ {asset['total_invested']:n}\n")

    if results:
        print("------------ ATIVOS (seção 'Bens e direitos') ------------\n\n")
        print(*results, sep="\n")


def _print_credited_incomes(qs: AssetQuerySet[Asset], year: int) -> None:
    mapping = {
        PassiveIncomeTypes.dividend: (
            "'Rendimentos isentos e não tributáveis', opção '09 - Lucros e dividendos recebidos'"
        ),
        PassiveIncomeTypes.income: "?",
    }
    for value, label in PassiveIncomeTypes:
        if value == PassiveIncomeTypes.jcp:
            continue
        results = []
        for i, a in enumerate(
            qs.annotate_credited_incomes_at_given_year(year=year, incomes_type=value)
            .filter(normalized_credited_incomes_total__gt=0)
            .values("code", "normalized_credited_incomes_total"),
            start=1,
        ):
            results.append(f"{i}. {a['code']} -> R$ {a['normalized_credited_incomes_total']:n}")
        if results:
            print(f"\n\n------------ {label.upper()} (seção {mapping[value]}) ------------\n\n")
            print(*results, sep="\n")


def _print_credited_jcps(qs: AssetQuerySet[Asset], year: int) -> None:
    results = []
    for i, a in enumerate(
        qs.annotate_credited_incomes_at_given_year(year=year, incomes_type=PassiveIncomeTypes.jcp)
        .filter(normalized_credited_incomes_total__gt=0)
        .values("code", "normalized_credited_incomes_total"),
        start=1,
    ):
        results.append(f"\t\t{i}. R$ {a['code']} -> {a['normalized_credited_incomes_total']:n}")

    if results:
        print(
            f"\n\t{PassiveIncomeTypes.labels['jcp']} "
            "(seção 'Rendimentos sujeitos à tributação' "
            "opção '10 - Juros sobre capital próprio')\n\n"
        )
        print(*results, sep="\n")


def _print_stocks_elegible_for_taxation(user_pk: int, year: int, debug: bool):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.stock, operation_date__year=year
    )
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__lt=-settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']:n}")
        roi = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            _roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            if debug > 1:
                results.append(f"\t\t\t{t.asset_code} -> roi = R$ {_roi:n}")
            roi += _roi

        if debug > 1:
            results.append("")
        results.append(
            f"\t\t\tDeclare que teve {'lucro' if roi > 0 else 'prejuízo'} de R$ {roi:n} em "
            f"operações no mês {month:02d}/{year}\n"
        )

    if results:
        print(
            "\n\tAÇÕES: SOMATÓRIO MENSAL DE VENDAS SUPERIOR A "
            f"{settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD} "
            "(seção 'Renda Variável', opção 'Operações Comuns / Day Trade')"
        )
        print(*results, sep="\n")


def _print_stocks_usa_elegible_for_taxation(
    user_pk: int, year: int, debug: bool, normalize: bool, dollar_conversion_rate: Decimal
):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.stock_usa, operation_date__year=year
    )
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__lt=-settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']:n}")
        roi = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            _roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {_roi:n}")
            roi += _roi

        if debug > 1:
            results.append("")
        results.append(
            f"\t\t\tDeclare que teve {'lucro' if roi > 0 else 'prejuízo'} de R$ {roi:n} "
            f"em operações no mês {month:02d}/{year}\n"
        )

    if results:
        print(
            "\n\tAÇÕES EUA: SOMATÓRIO MENSAL DE VENDAS SUPERIOR A "
            f"{settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD} "
            "(seção 'Renda Variável', opção 'Operações Comuns / Day Trade')"
        )
        print(*results, sep="\n")


def _print_cryptos_elegible_for_taxation(
    user_pk: int, year: int, debug: bool, normalize: bool, dollar_conversion_rate: Decimal
):
    results = []
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.crypto, operation_date__year=year
    )
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__lt=-settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']:n}")
        roi = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            _roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {_roi:n}")
            roi += _roi

        if debug > 1:
            results.append("")
        results.append(
            f"\t\t\tDeclare que teve {'lucro' if roi > 0 else 'prejuízo'} de R$ {roi} em operações "
            f"no mês {month:02d}/{year}\n"
        )

    if results:
        print(
            "\n\tCRIPTOS: SOMATÓRIO MENSAL DE VENDAS SUPERIOR A "
            f"{settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD} "
            "(seção 'Renda Variável', opção 'Operações Comuns / Day Trade')"
        )
        print(*results, sep="\n")


def _print_fiis_elegible_for_taxation(user_pk: int, year: int, debug: bool):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.fii, operation_date__year=year
    )
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__lt=-settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']}")
        roi = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            _roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            if debug > 1:
                results.append(f"\t\t\t{t.asset_code} -> roi = R$ {_roi:n}")
            roi += _roi

        if debug > 1:
            results.append("")

        results.append(
            f"\t\t\tDeclare que teve {'lucro' if roi > 0 else 'prejuízo'} de R$ {roi} em operações "
            f"no mês {month:02d}/{year}\n"
        )

    if results:
        print(
            "\n\tFIIs: SOMATÓRIO MENSAL DE VENDAS SUPERIOR A "
            f"{settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD} "
            "(seção 'Renda Variável', opção 'Operações de Fundos de Investimento Imobiliário')"
        )
        print(*results, sep="\n")


def _print_stocks_not_elegible_for_taxation(user_pk: int, year: int, debug: bool):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.stock, operation_date__year=year
    )
    loss_section = "seção 'Renda Variável', opção 'Operações Comuns / Day Trade'"
    profit_section = (
        "seção 'Rendimentos isentos e não tributáveis', opção "
        "'20 - Ganhos líquidos em operações no mercado à vista de ações negociadas "
        "em bolsas de valores nas alienações realizadas até R$ 20.000,00 em cada "
        "mês, para o conjunto de ações'"
    )
    profits = Decimal()
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__gte=-settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD)
        .exclude(total_sold=0)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']}")
        asset_losses = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            if roi > 0:
                profits += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = R$ {roi:n}")
            elif roi == 0:
                if debug > 1:
                    results.append(
                        f"\t\t\t{t.asset_code}: Nao encontramos uma operação de fechamento "
                        "para o ativo. Por favor, verifique!"
                    )
            else:
                asset_losses += roi

        if debug > 1:
            results.append("")
        if asset_losses:
            results.append(
                f"\t\t\tDeclare que teve prejuízo de R$ {asset_losses} em operações no "
                f"mês {month:02d}/{year} ({loss_section})\n"
            )

    if profits:
        results.append(f"\t\tDeclare que teve lucro total de R$ {profits} na {profit_section}\n")

    if results:
        print(
            "\n\tAÇÕES: SOMATÓRIO MENSAL DE VENDAS INFERIOR A "
            f"{settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD}"
        )
        print(*results, sep="\n")


def _print_stocks_usa_not_elegible_for_taxation(
    user_pk: int, year: int, debug: bool, normalize: bool, dollar_conversion_rate: Decimal
):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.stock_usa, operation_date__year=year
    )
    loss_section = "seção 'Renda Variável', opção 'Operações Comuns / Day Trade'"
    profit_section = (
        "seção 'Rendimentos sujeitos à tributação', opção "
        "'05 - Ganho de capital na alienação de bem, direito ou conjunto de "
        "bens ou direitos da mesma natureza, alienados em um mesmo mês, de "
        "valor total de alienação até R$ 20.000,00, para ações alienadas no "
        "mercado de balcão, e R$ 35.000,00, nos demais casos'"
    )
    profits = Decimal()
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__gte=-settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD)
        .exclude(total_sold=0)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']}")
        asset_losses = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            currency_symbol = "R$" if normalize else "$"
            roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            if debug > 1:
                results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")
            if roi > 0:
                profits += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")
            elif roi == 0:
                if debug > 1:
                    results.append(
                        f"\t\t\t{t.asset_code}: Nao encontramos uma operação de fechamento "
                        "para o ativo. Por favor, verifique!"
                    )
            else:
                asset_losses += roi

        if debug > 1:
            results.append("")
        if asset_losses:
            results.append(
                f"\t\t\tDeclare que teve prejuízo de R$ {asset_losses} em operações no "
                f"mês {month:02d}/{year} ({loss_section})\n"
            )

    if profits:
        results.append(f"\t\tDeclare que teve lucro total de R$ {profits} na {profit_section}\n")

    if results:
        print(
            "\n\tAÇÕES EUA: SOMATÓRIO MENSAL DE VENDAS INFERIOR A "
            f"{settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD}"
        )
        print(*results, sep="\n")


def _print_cryptos_not_elegible_for_taxation(
    user_pk: int, year: int, debug: bool, normalize: bool, dollar_conversion_rate: Decimal
):
    qs = Transaction.objects.filter(
        asset__user_id=user_pk, asset__type=AssetTypes.crypto, operation_date__year=year
    )
    loss_section = (
        "seção 'Ganhos de Capital', importando na opção "
        "'Ganhos de Capital da Receita Federal (GCAP)'"
    )
    profit_section = (
        "seção 'Rendimentos sujeitos à tributação', opção "
        "'05 - Ganho de capital na alienação de bem, direito ou conjunto de "
        "bens ou direitos da mesma natureza, alienados em um mesmo mês, de "
        "valor total de alienação até R$ 20.000,00, para ações alienadas no "
        "mercado de balcão, e R$ 35.000,00, nos demais casos'"
    )
    profits = Decimal()
    results = []
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__gte=-settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD)
        .exclude(total_sold=0)
    ):
        month = infos["month"].month
        results.append(f"\t\t{month:02d}/{year}: R$ {infos['total_sold']}")
        asset_losses = Decimal()
        for t in set(
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .order_by("asset_code")
            .values_list("asset_code", "asset_id", named=True)
        ):
            currency_symbol = "R$" if normalize else "$"
            roi = _get_closed_roi(asset_id=t.asset_id, month=month, year=year)
            if roi > 0:
                profits += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")
            elif roi == 0:
                if debug > 1:
                    results.append(
                        f"\t\t\t{t.asset_code}: Nao encontramos uma operação de fechamento "
                        "para o ativo. Por favor, verifique!"
                    )
            else:
                asset_losses += roi

        if debug > 1:
            results.append("")
        if asset_losses:
            results.append(
                f"\t\t\tDeclare que teve prejuízo de R$ {asset_losses:n} em operações no "
                f"mês {month:02d}/{year} ({loss_section})\n"
            )

    if profits:
        results.append(f"\t\tDeclare que teve lucro total de R$ {profits:n} na {profit_section}\n")

    if results:
        print(
            "\n\tCRIPTOS: SOMATÓRIO MENSAL DE VENDAS INFERIOR A "
            f"{settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD}"
        )
        print(*results, sep="\n")


def print_irpf_infos(
    user_pk: int,
    year: int | None = None,
    dollar_conversion_rate: Decimal | None = None,
    normalize: bool = True,
    debug: int = 1,
):  # pragma: no cover
    with contextlib.suppress(locale.Error):
        locale.setlocale(locale.LC_ALL, "pt_br")

    dollar_conversion_rate = (
        dollar_conversion_rate
        if dollar_conversion_rate is not None
        else get_dollar_conversion_rate()  # na verdade, buscar a cotação em 31/12 de `year`
    )
    qs = Asset.objects.filter(user_id=user_pk).order_by("code")

    year = year if year is not None else timezone.localtime().year - 1
    _print_assets_portfolio(qs=qs, year=year)
    _print_credited_incomes(qs=qs, year=year)

    print("\n\n------------ RENDIMENTOS SUJEITOS A TRIBUTAÇÃO ------------\n")
    _print_credited_jcps(qs=qs, year=year)
    _print_stocks_elegible_for_taxation(user_pk=user_pk, year=year, debug=debug)

    # Avaliar se `normalize` faz sentido quando precisar preencher
    # as informações de fato
    _print_stocks_usa_elegible_for_taxation(
        user_pk=user_pk,
        year=year,
        debug=debug,
        normalize=normalize,
        dollar_conversion_rate=dollar_conversion_rate,
    )
    _print_cryptos_elegible_for_taxation(
        user_pk=user_pk,
        year=year,
        debug=debug,
        normalize=normalize,
        dollar_conversion_rate=dollar_conversion_rate,
    )
    _print_fiis_elegible_for_taxation(user_pk=user_pk, year=year, debug=debug)

    print("\n\n------------ RENDIMENTOS ISENTOS DE TRIBUTAÇÂO ------------\n")
    _print_stocks_not_elegible_for_taxation(user_pk=user_pk, year=year, debug=debug)

    # Avaliar se `normalize` faz sentido quando precisar preencher
    # as informações de fato
    _print_stocks_usa_not_elegible_for_taxation(
        user_pk=user_pk,
        year=year,
        debug=debug,
        normalize=normalize,
        dollar_conversion_rate=dollar_conversion_rate,
    )
    _print_cryptos_not_elegible_for_taxation(
        user_pk=user_pk,
        year=year,
        debug=debug,
        normalize=normalize,
        dollar_conversion_rate=dollar_conversion_rate,
    )


def update_assets_metadata_current_price() -> None:
    from asgiref.sync import async_to_sync

    from .integrations.handlers import update_prices

    return async_to_sync(update_prices)()


def sync_all_kucoin_transactions() -> None:
    from asgiref.sync import async_to_sync

    from .integrations.kucoin.handlers import sync_kucoin_transactions

    for user_pk in UserModel.objects.filter_kucoin_integration_active().values_list(
        "pk", flat=True
    ):
        async_to_sync(sync_kucoin_transactions)(user_id=user_pk)


def sync_all_binance_transactions() -> None:
    from asgiref.sync import async_to_sync

    from .integrations.binance.handlers import sync_binance_transactions

    for user_pk in UserModel.objects.filter_binance_integration_active().values_list(
        "pk", flat=True
    ):
        async_to_sync(sync_binance_transactions)(user_id=user_pk)


def group_or_split_asset_transactions(
    *,
    factor: int,
    # TODO: test group mode
    mode: Literal["group", "split"],
    operation_date: date,
    **assset_filters,
):
    asset = Asset.objects.annotate_quantity_balance().only("pk").get(**assset_filters)
    op = mul if mode == "split" else truediv
    Transaction.objects.create(
        asset=asset,
        action=TransactionActions.buy,
        quantity=op(asset.quantity_balance, (factor - 1)),
        price=Decimal("0.0000000001"),
        operation_date=operation_date,
        # TODO: o que fazer se currency != BRL?
        current_currency_conversion_rate=Decimal(1),
    )

    upsert_asset_read_model(asset_id=asset.pk, is_aggregate_upsert=True)


def update_asset_metadata_current_price(code: str, price: Decimal) -> None:
    return AssetMetaData.objects.filter(code=code).update(
        current_price=price,
        current_price_updated_at=timezone.now(),
    )


def generate_fire_returns_ts(
    output_path: str = "../react/src/pages/private/Home/fireReturns.ts",
    start_year: int = 1995,
    end_year: int | None = None,
) -> None:
    """
    Download B3 IBOV/IFIX, BCB CDI, and BCB IPCA data, compute real annual and
    monthly returns, and emit a TypeScript module with const arrays for the FIRE
    bootstrap.

    start_year must stay >= 1995. Earlier IBOV history has additional display
    redenominations that this generator does not normalize.

    Output (when output_path is provided): a .ts file with FIRE_RETURNS_YEARS,
    EQUITY_REAL_RETURNS, FIXED_INCOME_REAL_RETURNS, IFIX_YEARS, and
    IFIX_REAL_RETURNS, plus their monthly equivalents. Otherwise prints to stdout.

    Usage:
        from variable_income_assets.scripts import generate_fire_returns_ts
        generate_fire_returns_ts()
    """

    if end_year is None:
        end_year = timezone.localtime().year - 1

    if start_year < 1995:
        raise ValueError("generate_fire_returns_ts only supports start_year >= 1995")
    if end_year < start_year:
        raise ValueError("end_year must be greater than or equal to start_year")

    # Reverse-engineered from B3's index statistics pages; this is not a stable
    # public API, so keep the generated TS checked in and rerun intentionally.
    B3_INDEX_URL = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay"
    BCB_CDI_URL = (
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados"
        f"?formato=json&dataInicial=01/01/{start_year}&dataFinal=31/12/{{end}}"
    )
    BCB_IPCA_URL = (
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados"
        f"?formato=json&dataInicial=01/01/{start_year}&dataFinal=31/12/{{end}}"
    )
    HTTP_TIMEOUT_SECONDS = 30

    def compound(periodic: list[float]) -> float:
        result = 1.0
        for r in periodic:
            result *= 1.0 + r
        return result - 1.0

    def parse_b3_number(value: str) -> float:
        return float(value.replace(",", ""))

    def fetch_json(url: str):
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "multi-sources-financial-control/1.0"},
        )
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def normalize_ibov_value(refdate: date, value: float) -> float:
        # B3's raw historical table spans the 10:1 Ibovespa display split from
        # 1997-03-03. Normalize older point values to the post-split scale so
        # annual returns do not treat the display change as a market loss.
        if refdate < date(1997, 3, 3):
            return value / 10.0
        return value

    def normalize_b3_index_value(index: str, refdate: date, value: float) -> float:
        if index == "IBOV":
            return normalize_ibov_value(refdate, value)
        return value

    def month_key(refdate: date) -> tuple[int, int]:
        return (refdate.year, refdate.month)

    def month_key_str(month: tuple[int, int]) -> str:
        year, month_number = month
        return f"{year}-{month_number:02d}"

    def previous_month(month: tuple[int, int]) -> tuple[int, int]:
        year, month_number = month
        if month_number == 1:
            return (year - 1, 12)
        return (year, month_number - 1)

    def iter_months(first_year: int, last_year: int) -> list[tuple[int, int]]:
        return [
            (year, month)
            for year in range(first_year, last_year + 1)
            for month in range(1, 13)
        ]

    def b3_index_url(index: str, year: int) -> str:
        payload = json.dumps(
            {"language": "en-us", "index": index, "year": year},
            separators=(",", ":"),
        ).encode()
        return f"{B3_INDEX_URL}/{base64.b64encode(payload).decode()}"

    def download_b3_index_year(index: str, year: int) -> dict[date, float]:
        url = b3_index_url(index, year)
        raw = fetch_json(url)

        points: dict[date, float] = {}
        if not isinstance(raw, dict):
            return points
        for row in raw.get("results") or []:
            try:
                day = int(row["day"])
            except (KeyError, TypeError, ValueError) as exc:
                raise RuntimeError(
                    f"Malformed B3 {index} row for {year}: missing/invalid day"
                ) from exc
            for month in range(1, 13):
                value = row.get(f"rateValue{month}")
                if value is None:
                    continue
                try:
                    refdate = date(year, month, day)
                    points[refdate] = normalize_b3_index_value(
                        index,
                        refdate,
                        parse_b3_number(value),
                    )
                except ValueError as exc:
                    raise RuntimeError(
                        f"Malformed B3 {index} row for {year}: value present for invalid date "
                        f"{year}-{month:02d}-{day:02d}"
                    ) from exc
        return points

    def compute_annual_index_returns(
        points: dict[date, float],
        first_year: int,
        last_year: int,
    ) -> tuple[dict[int, float], dict[int, int]]:
        annual_returns: dict[int, float] = {}
        days_by_year: dict[int, int] = defaultdict(int)
        sorted_dates = sorted(points)
        for d in sorted_dates:
            days_by_year[d.year] += 1

        for year in range(first_year, last_year + 1):
            previous_dates = [d for d in sorted_dates if d.year < year]
            current_dates = [d for d in sorted_dates if d.year == year]
            if not previous_dates or not current_dates:
                continue
            previous_close = points[max(previous_dates)]
            current_close = points[max(current_dates)]
            annual_returns[year] = current_close / previous_close - 1.0

        return annual_returns, days_by_year

    def compute_monthly_index_returns(
        points: dict[date, float],
        first_year: int,
        last_year: int,
    ) -> tuple[dict[tuple[int, int], float], dict[tuple[int, int], int]]:
        monthly_returns: dict[tuple[int, int], float] = {}
        days_by_month: dict[tuple[int, int], int] = defaultdict(int)
        month_close_dates: dict[tuple[int, int], date] = {}

        for d in sorted(points):
            key = month_key(d)
            days_by_month[key] += 1
            if key not in month_close_dates or d > month_close_dates[key]:
                month_close_dates[key] = d

        month_closes = {key: points[d] for key, d in month_close_dates.items()}
        for key in iter_months(first_year, last_year):
            previous_key = previous_month(key)
            if key not in month_closes or previous_key not in month_closes:
                continue
            monthly_returns[key] = month_closes[key] / month_closes[previous_key] - 1.0

        return monthly_returns, days_by_month

    print(f"Downloading B3 IBOV from {B3_INDEX_URL} ...")
    ibov_daily: dict[date, float] = {}
    for year in range(start_year - 1, end_year + 1):
        ibov_daily.update(download_b3_index_year("IBOV", year))

    if not ibov_daily:
        raise RuntimeError("No B3 IBOV data parsed — check URL/format.")

    annual_ibov, ibov_days_by_year = compute_annual_index_returns(
        ibov_daily,
        start_year,
        end_year,
    )
    if 1997 in annual_ibov and not -0.8 <= annual_ibov[1997] <= 2.0:
        raise RuntimeError(
            "IBOV 1997 return is outside the expected range. Check whether B3 changed "
            "historical IBOV scaling before changing normalize_ibov_value()."
        )
    monthly_ibov, ibov_days_by_month = compute_monthly_index_returns(
        ibov_daily,
        start_year,
        end_year,
    )

    cdi_url = BCB_CDI_URL.format(end=end_year)
    print(f"Downloading BCB CDI from {cdi_url} ...")
    cdi_raw = fetch_json(cdi_url)

    cdi_monthly: dict[int, list[float]] = defaultdict(list)
    cdi_by_month: dict[tuple[int, int], float] = {}
    for row in cdi_raw:
        d = datetime.strptime(row["data"], "%d/%m/%Y")
        if start_year <= d.year <= end_year:
            value = float(row["valor"]) / 100.0
            cdi_monthly[d.year].append(value)
            cdi_by_month[month_key(d.date())] = value

    annual_cdi = {y: compound(v) for y, v in cdi_monthly.items()}

    ipca_url = BCB_IPCA_URL.format(end=end_year)
    print(f"Downloading BCB IPCA from {ipca_url} ...")
    ipca_raw = fetch_json(ipca_url)

    ipca_monthly: dict[int, list[float]] = defaultdict(list)
    ipca_by_month: dict[tuple[int, int], float] = {}
    for row in ipca_raw:
        d = datetime.strptime(row["data"], "%d/%m/%Y")
        if start_year <= d.year <= end_year:
            value = float(row["valor"]) / 100.0
            ipca_monthly[d.year].append(value)
            ipca_by_month[month_key(d.date())] = value

    annual_ipca = {y: compound(v) for y, v in ipca_monthly.items()}

    # Keep only years with a mostly-complete trading year (≥200 days) and full CDI/IPCA.
    common_years = sorted(
        y
        for y in set(annual_ibov) & set(annual_cdi) & set(annual_ipca)
        if ibov_days_by_year[y] >= 200 and len(cdi_monthly[y]) == 12 and len(ipca_monthly[y]) == 12
    )
    if not common_years:
        raise RuntimeError("No overlapping complete years between IBOV, CDI, and IPCA.")
    if common_years[-1] != end_year:
        raise RuntimeError(
            f"Latest complete IBOV/CDI/IPCA year is {common_years[-1]}, expected {end_year}. "
            "Check whether B3/BCB data for the requested year is complete before regenerating."
        )

    real_rm = [(1 + annual_ibov[y]) / (1 + annual_ipca[y]) - 1 for y in common_years]
    real_rf = [(1 + annual_cdi[y]) / (1 + annual_ipca[y]) - 1 for y in common_years]
    common_months = sorted(
        m
        for m in set(monthly_ibov) & set(cdi_by_month) & set(ipca_by_month)
        if ibov_days_by_month[m] > 0
    )
    if not common_months:
        raise RuntimeError("No overlapping complete months between IBOV, CDI, and IPCA.")

    real_rm_monthly = [
        (1 + monthly_ibov[m]) / (1 + ipca_by_month[m]) - 1 for m in common_months
    ]
    real_rf_monthly = [
        (1 + cdi_by_month[m]) / (1 + ipca_by_month[m]) - 1 for m in common_months
    ]

    print(f"Downloading B3 IFIX from {B3_INDEX_URL} ...")
    ifix_start_year = 2011
    ifix_daily: dict[date, float] = {}
    for year in range(ifix_start_year - 1, end_year + 1):
        ifix_daily.update(download_b3_index_year("IFIX", year))

    if not ifix_daily:
        raise RuntimeError("No B3 IFIX data parsed — check URL/format.")

    annual_ifix, ifix_days_by_year = compute_annual_index_returns(
        ifix_daily,
        ifix_start_year,
        end_year,
    )
    monthly_ifix, ifix_days_by_month = compute_monthly_index_returns(
        ifix_daily,
        ifix_start_year,
        end_year,
    )
    ifix_years = sorted(
        y
        for y in set(annual_ifix) & set(annual_ipca)
        if ifix_days_by_year[y] >= 200 and len(ipca_monthly[y]) == 12
    )
    if not ifix_years:
        raise RuntimeError("No overlapping complete years between IFIX and IPCA.")
    if ifix_years[0] != ifix_start_year:
        raise RuntimeError(
            f"First complete IFIX year is {ifix_years[0]}, expected {ifix_start_year}. "
            "Check whether B3 returned the IFIX base point for 2010."
        )
    if ifix_years[-1] != end_year:
        raise RuntimeError(
            f"Latest complete IFIX/IPCA year is {ifix_years[-1]}, expected {end_year}."
        )
    real_ifix = [(1 + annual_ifix[y]) / (1 + annual_ipca[y]) - 1 for y in ifix_years]
    ifix_months = sorted(
        m
        for m in set(monthly_ifix) & set(ipca_by_month)
        if ifix_days_by_month[m] > 0
    )
    real_ifix_monthly = [
        (1 + monthly_ifix[m]) / (1 + ipca_by_month[m]) - 1 for m in ifix_months
    ]

    rm_values = ", ".join(f"{v:.6f}" for v in real_rm)
    rf_values = ", ".join(f"{v:.6f}" for v in real_rf)
    ifix_values = ", ".join(f"{v:.6f}" for v in real_ifix)
    years_str = ", ".join(str(y) for y in common_years)
    ifix_years_str = ", ".join(str(y) for y in ifix_years)
    months_str = ", ".join(f'"{month_key_str(m)}"' for m in common_months)
    ifix_months_str = ", ".join(f'"{month_key_str(m)}"' for m in ifix_months)
    rm_monthly_values = ", ".join(f"{v:.6f}" for v in real_rm_monthly)
    rf_monthly_values = ", ".join(f"{v:.6f}" for v in real_rf_monthly)
    ifix_monthly_values = ", ".join(f"{v:.6f}" for v in real_ifix_monthly)

    ts_content = (
        "// Auto-generated by "
        "django/variable_income_assets/scripts.py::generate_fire_returns_ts\n"
        "// Source: B3 IBOV + B3 IFIX + BCB SGS 4391 (CDI) + BCB SGS 433 (IPCA).\n"
        f"// IBOV/CDI/IPCA period: {common_years[0]}–{common_years[-1]} "
        f"({len(common_years)} complete years, {len(common_months)} months).\n"
        f"// IFIX period: {ifix_years[0]}–{ifix_years[-1]} "
        f"({len(ifix_years)} complete years, {len(ifix_months)} months).\n"
        "// Real returns = (1 + nominal) / (1 + IPCA) - 1.\n\n"
        f"export const FIRE_RETURNS_YEARS: readonly number[] = [{years_str}];\n\n"
        "// IBOV (Ibovespa total return, BRL) — real annual returns.\n"
        f"export const EQUITY_REAL_RETURNS: readonly number[] = [{rm_values}];\n\n"
        "// CDI (BCB SGS 4391, monthly aggregated to annual) — real annual returns.\n"
        f"export const FIXED_INCOME_REAL_RETURNS: readonly number[] = [{rf_values}];\n\n"
        f"export const IFIX_YEARS: readonly number[] = [{ifix_years_str}];\n\n"
        "// IFIX (Brazilian REIT index, total return) — real annual returns.\n"
        f"export const IFIX_REAL_RETURNS: readonly number[] = [{ifix_values}];\n\n"
        f"export const FIRE_RETURNS_MONTHS: readonly string[] = [{months_str}];\n\n"
        "// IBOV (Ibovespa total return, BRL) — real monthly returns.\n"
        f"export const EQUITY_MONTHLY_REAL_RETURNS: readonly number[] = [{rm_monthly_values}];\n\n"
        "// CDI (BCB SGS 4391) — real monthly returns.\n"
        "export const FIXED_INCOME_MONTHLY_REAL_RETURNS: readonly number[] = "
        f"[{rf_monthly_values}];\n\n"
        f"export const IFIX_MONTHS: readonly string[] = [{ifix_months_str}];\n\n"
        "// IFIX (Brazilian REIT index, total return) — real monthly returns.\n"
        f"export const IFIX_MONTHLY_REAL_RETURNS: readonly number[] = [{ifix_monthly_values}];\n"
    )

    if output_path is None:
        print(ts_content)
    else:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(
            f"Wrote {len(common_years)} years / {len(common_months)} months "
            f"({common_years[0]}–{common_years[-1]}) to {output_path}"
        )
