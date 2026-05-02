from __future__ import annotations

import contextlib
import csv
import io
import json
import locale
import urllib.request
from collections import defaultdict
from datetime import datetime
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
    from datetime import date

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
        .values("code", "currency", "transactions_balance", "avg_price", "total_invested"),
        start=1,
    ):
        # Preço médio sempre na moeda original e total em reais
        # TODO: adicionar dolar médio
        currency_symbol = Currencies.get_choice(asset["currency"]).symbol
        results.append(f"{i}. {asset['code']}")
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
    start_year: int = 2001,
    end_year: int | None = None,
) -> None:  # pragma: no cover
    """
    Download NEFIN factor data (Brazilian market + risk-free) and BCB IPCA,
    compute real annual returns, and emit a TypeScript module with two const
    arrays for the FIRE bootstrap simulation.

    Output (when output_path is provided): a .ts file with EQUITY_REAL_RETURNS
    and FIXED_INCOME_REAL_RETURNS. Otherwise prints to stdout.

    Usage:
        from variable_income_assets.scripts import generate_fire_returns_ts
        generate_fire_returns_ts()
    """

    NEFIN_URL = "https://nefin.com.br/resources/risk_factors/nefin_factors.csv"
    BCB_IPCA_URL = (
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados"
        f"?formato=json&dataInicial=01/01/{start_year}&dataFinal=31/12/{{end}}"
    )

    if end_year is None:
        end_year = timezone.localtime().year - 1

    def compound(daily: list[float]) -> float:
        result = 1.0
        for r in daily:
            result *= 1.0 + r
        return result - 1.0

    print(f"Downloading NEFIN factors from {NEFIN_URL} ...")
    with urllib.request.urlopen(NEFIN_URL) as resp:
        raw = resp.read().decode("utf-8")

    daily_rm: dict[int, list[float]] = defaultdict(list)
    daily_rf: dict[int, list[float]] = defaultdict(list)
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            d = datetime.strptime(row["Date"], "%Y-%m-%d")
        except (ValueError, KeyError):
            continue
        if not (start_year <= d.year <= end_year):
            continue
        rm_minus_rf = float(row["Rm_minus_Rf"])
        rf = float(row["Risk_Free"])
        daily_rm[d.year].append(rm_minus_rf + rf)
        daily_rf[d.year].append(rf)

    if not daily_rm:
        raise RuntimeError("No NEFIN data parsed — check URL/format.")

    annual_rm = {y: compound(v) for y, v in daily_rm.items()}
    annual_rf = {y: compound(v) for y, v in daily_rf.items()}

    ipca_url = BCB_IPCA_URL.format(end=end_year)
    print(f"Downloading BCB IPCA from {ipca_url} ...")
    with urllib.request.urlopen(ipca_url) as resp:
        ipca_raw = json.loads(resp.read().decode("utf-8"))

    ipca_monthly: dict[int, list[float]] = defaultdict(list)
    for row in ipca_raw:
        d = datetime.strptime(row["data"], "%d/%m/%Y")
        if start_year <= d.year <= end_year:
            ipca_monthly[d.year].append(float(row["valor"]) / 100.0)

    annual_ipca = {y: compound(v) for y, v in ipca_monthly.items()}

    # Keep only years with a mostly-complete trading year (≥200 days) and full IPCA.
    common_years = sorted(
        y
        for y in set(annual_rm) & set(annual_rf) & set(annual_ipca)
        if len(daily_rm[y]) >= 200 and len(ipca_monthly[y]) == 12
    )
    if not common_years:
        raise RuntimeError("No overlapping complete years between NEFIN and IPCA.")

    real_rm = [(1 + annual_rm[y]) / (1 + annual_ipca[y]) - 1 for y in common_years]
    real_rf = [(1 + annual_rf[y]) / (1 + annual_ipca[y]) - 1 for y in common_years]

    # IFIX nominal yearly variation (BRL, %), from B3 "Yearly variation (R$/US$)".
    # Source: https://www.b3.com.br/en_us/market-data-and-indices/indices/indices-de-segmentos-e-setoriais/real-estate-fund-index-ifix-historic-statistics.htm
    # Base: 30/12/2010 = 1000. Partial years (YTD) must be excluded — only include fully-closed years.
    ifix_nominal_pct: dict[int, float] = {
        2011: 16.51,
        2012: 35.04,
        2013: -12.63,
        2014: -2.76,
        2015: 5.41,
        2016: 32.33,
        2017: 19.41,
        2018: 5.62,
        2019: 35.98,
        2020: -10.24,
        2021: -2.28,
        2022: 2.22,
        2023: 15.50,
        2024: -5.89,
        2025: 21.15,
    }
    ifix_years = sorted(
        y
        for y in ifix_nominal_pct
        if y in annual_ipca and len(ipca_monthly[y]) == 12 and y <= end_year
    )
    real_ifix = [
        (1 + ifix_nominal_pct[y] / 100.0) / (1 + annual_ipca[y]) - 1 for y in ifix_years
    ]

    rm_values = ", ".join(f"{v:.6f}" for v in real_rm)
    rf_values = ", ".join(f"{v:.6f}" for v in real_rf)
    ifix_values = ", ".join(f"{v:.6f}" for v in real_ifix)
    years_str = ", ".join(str(y) for y in common_years)
    ifix_years_str = ", ".join(str(y) for y in ifix_years)

    ts_content = (
        "// Auto-generated by "
        "django/variable_income_assets/scripts.py::generate_fire_returns_ts\n"
        "// Source: NEFIN Risk Factors + B3 IFIX yearly variation + BCB SGS 433 (IPCA).\n"
        f"// NEFIN period: {common_years[0]}–{common_years[-1]} "
        f"({len(common_years)} complete years).\n"
        f"// IFIX period: {ifix_years[0]}–{ifix_years[-1]} "
        f"({len(ifix_years)} complete years).\n"
        "// Real annual returns = (1 + nominal) / (1 + IPCA) - 1.\n\n"
        f"export const FIRE_RETURNS_YEARS: readonly number[] = [{years_str}];\n\n"
        "// Brazilian market portfolio (value-weighted) — real annual returns.\n"
        f"export const EQUITY_REAL_RETURNS: readonly number[] = [{rm_values}];\n\n"
        "// Risk-free (SELIC-based) — real annual returns.\n"
        f"export const FIXED_INCOME_REAL_RETURNS: readonly number[] = [{rf_values}];\n\n"
        f"export const IFIX_YEARS: readonly number[] = [{ifix_years_str}];\n\n"
        "// IFIX (Brazilian REIT index, total return) — real annual returns.\n"
        f"export const IFIX_REAL_RETURNS: readonly number[] = [{ifix_values}];\n"
    )

    if output_path is None:
        print(ts_content)
    else:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(
            f"Wrote {len(common_years)} years ({common_years[0]}–{common_years[-1]}) to {output_path}"
        )
