from __future__ import annotations

import locale
from decimal import Decimal
from operator import mul, truediv
from typing import TYPE_CHECKING, Literal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import F
from django.utils import timezone

from .adapters.key_value_store import get_dollar_conversion_rate
from .choices import AssetTypes, Currencies, PassiveIncomeTypes, TransactionActions
from .models import Asset, Transaction
from .service_layer.tasks import upsert_asset_read_model

if TYPE_CHECKING:
    from datetime import date

    from .models.managers import AssetQuerySet

locale.setlocale(locale.LC_ALL, "pt_br")
UserModel = get_user_model()


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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por R$ {t.price:n} "
                    f"-> roi = R$ {t.roi:n}"
                )
            roi += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por {currency_symbol} {t.price:n} "
                    f"-> roi = {currency_symbol} {t.roi:n}"
                )
            roi += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por {currency_symbol} {t.price:n} "
                    f"-> roi = {currency_symbol} {t.roi:n}"
                )
            roi += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por R$ {t.price:n} "
                    f"-> roi = R$ {t.roi:n}"
                )
            roi += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por R$ {t.price:n} "
                    f"-> roi = R$ {t.roi:n}"
                )
            if t.roi > 0:
                profits += t.roi
            else:
                asset_losses += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por {currency_symbol} {t.price:n} "
                    f"-> roi = {currency_symbol} {t.roi:n}"
                )
            if t.roi > 0:
                profits += t.roi
            else:
                asset_losses += t.roi

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
        for t in (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        ):
            currency_symbol = "R$" if normalize else "$"
            if debug > 1:
                results.append(
                    f"\t\t\t{t.quantity} {t.asset_code} por {currency_symbol} {t.price:n} "
                    f"-> roi = {currency_symbol} {t.roi:n}"
                )
            if t.roi > 0:
                profits += t.roi
            else:
                asset_losses += t.roi

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

    async_to_sync(update_prices)()


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


def test():
    from django.db.models import F, Sum

    from variable_income_assets.models import AssetClosedOperation

    roi = 0
    for code in ("MOVI3", "SULA11", "ENBR3", "YDUQ3", "LEVE3"):
        aco: AssetClosedOperation = AssetClosedOperation.objects.get(
            asset__code=code, asset__user_id=1
        )
        r = aco.normalized_total_sold - aco.normalized_total_bought
        print(f"{code}: {(r):n} ({aco.operation_datetime})")
        roi += aco.normalized_total_sold - aco.normalized_total_bought
    return (
        AssetClosedOperation.objects.filter(asset__user_id=1, operation_datetime__year=2023)
        .annotate(roi=F("normalized_total_sold") - F("normalized_total_bought"))
        .aggregate(total=Sum("roi"))
    )["total"], roi
    return
    qs = Transaction.objects.filter(
        asset__user_id=1, asset__type=AssetTypes.stock, operation_date__year=2023
    )
    for infos in (
        qs.historic()
        .values("month", "total_sold")
        .filter(total_sold__lt=-settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD)
    ):
        month = infos["month"].month
        return (
            qs.annotate(asset_code=F("asset__code"))
            .filter(operation_date__month=month, action=TransactionActions.sell)
            .annotate_normalized_roi()
            .only("quantity", "price")
            .order_by("asset_code")
        )
