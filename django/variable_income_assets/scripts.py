from __future__ import annotations

import contextlib
import locale
import os
from datetime import date
from decimal import Decimal
from operator import mul, truediv
from pathlib import Path
from typing import TYPE_CHECKING, Literal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction as djtransaction
from django.db.models import F
from django.utils import timezone

from .adapters.key_value_store import get_dollar_conversion_rate
from .choices import (
    AssetObjectives,
    AssetTypes,
    Currencies,
    FixedIncomeIndexers,
    LiquidityTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from .fire_returns import (
    build_fire_return_series,
    render_fire_returns_ts,
    validate_fire_return_series,
)
from .models import Asset, AssetClosedOperation, AssetMetaData, PassiveIncome, Transaction
from .serializers import AssetSerializer, TransactionListSerializer
from .service_layer.tasks import upsert_asset_read_model

if TYPE_CHECKING:
    from .models.managers import AssetQuerySet

UserModel = get_user_model()


def _get_closed_roi(month: int, year: int, asset_id: int) -> Decimal:
    # IRPF report context: use the IRPF cost basis so bonificações inflate the
    # basis at their declared unit price instead of contributing zero.
    try:
        return (
            AssetClosedOperation.objects.filter(
                asset_id=asset_id,
                operation_datetime__month=month,
                operation_datetime__year=year,
            )
            .annotate_irpf_roi()
            .values("roi")
            .get()
        )["roi"]
    except AssetClosedOperation.DoesNotExist:
        return _get_partial_sell_roi(month=month, year=year, asset_id=asset_id)


def _get_partial_sell_roi(month: int, year: int, asset_id: int) -> Decimal:
    return Transaction.objects.get_partial_sell_roi(
        asset_id=asset_id, month=month, year=year, for_irpf=True
    )


def _print_assets_portfolio(qs: AssetQuerySet[Asset], year: int) -> None:
    results = []
    for i, asset in enumerate(
        qs.annotate_irpf_infos(year=year)
        .filter(transactions_balance__gt=0)
        .values(
            "id",
            "code",
            "currency",
            "transactions_balance",
            "avg_price",
            "total_invested",
            "description",
            "normalized_total_invested",
            "avg_current_currency_conversion_rate",
        ),
        start=1,
    ):
        # Examplo de descrição na receita pra dolar:
        # 91,166711130 ACOES (EWBC) // EAST WEST BANCORP, INC. //
        # COM CUSTO DE AQUISICAO DE US$ 3.962,24, SENDO O DOLAR MEDIO DE 4,9728,
        # CUSTODIADOS PELA CORRETORA VEST
        currency = Currencies.get_choice(asset["currency"])
        results.append(
            f"{i}. {asset['code']} - {asset['description']}"
            if asset["description"]
            else f"{i}. {asset['code']}"
        )
        results.append(f"\tQuantidade: {asset['transactions_balance']:n}")
        results.append(f"\tPreço médio: {currency.symbol} {asset['avg_price']:n}")
        results.append(
            f"\tTotal: R$ {asset['normalized_total_invested']:n}"
            if currency.value == Currencies.real
            else (
                f"\tTotal: R$ {asset['normalized_total_invested']:n} "
                f"| {currency.symbol} {asset['total_invested']:n}"
            )
        )
        if currency.value == Currencies.dollar:
            results.append(f"\tDólar médio: R$ {asset['avg_current_currency_conversion_rate']:n}")

        results.append("")

    if results:
        print("------------ ATIVOS (seção 'Bens e direitos') ------------\n\n")
        print(*results, sep="\n")


def _print_credited_incomes(qs: AssetQuerySet[Asset], year: int, debug: int = 1) -> None:
    dividend_section = (
        "'Rendimentos isentos e não tributáveis', opção '09 - Lucros e dividendos recebidos'"
    )
    results = []
    for i, a in enumerate(
        qs.annotate_credited_incomes_at_given_year(
            year=year, incomes_type=PassiveIncomeTypes.dividend
        )
        .filter(normalized_credited_incomes_total__gt=0)
        .values("code", "normalized_credited_incomes_total"),
        start=1,
    ):
        results.append(f"{i}. {a['code']} -> R$ {a['normalized_credited_incomes_total']:n}")
    if results:
        print(f"\n\n------------ DIVIDENDO (seção {dividend_section}) ------------\n\n")
        print(*results, sep="\n")

    _print_credited_reimbursements(qs=qs, year=year, debug=debug)
    _print_credited_incomes_per_stock(qs=qs, year=year)


def _print_credited_reimbursements(qs: AssetQuerySet[Asset], year: int, debug: int) -> None:
    B3_CNPJ = "09.346.601/0001-25"
    section = "'Outros rendimentos isentos'"

    reimbursement_by_code: dict[str, Decimal] = {}
    for a in (
        qs.annotate_credited_incomes_at_given_year(
            year=year, incomes_type=PassiveIncomeTypes.reimbursement
        )
        .filter(normalized_credited_incomes_total__gt=0)
        .values("code", "normalized_credited_incomes_total")
    ):
        reimbursement_by_code[a["code"]] = a["normalized_credited_incomes_total"]

    if not reimbursement_by_code:
        return

    reimbursement_total = sum(reimbursement_by_code.values())
    print(f"\n\n------------ REEMBOLSO (seção {section}) ------------\n\n")
    print(f"1. B3 -> R$ {reimbursement_total:n}")
    print(f"   CNPJ: {B3_CNPJ}")
    if debug > 1:
        print("\n\n")
        for code in sorted(reimbursement_by_code):
            print(f"   {code}: R$ {reimbursement_by_code[code]:n}")


def _print_credited_incomes_per_stock(qs: AssetQuerySet[Asset], year: int) -> None:
    section = "'Outros rendimentos isentos'"

    results = []
    for i, a in enumerate(
        qs.annotate_credited_incomes_at_given_year(
            year=year, incomes_type=PassiveIncomeTypes.income
        )
        .filter(normalized_credited_incomes_total__gt=0)
        .values("code", "normalized_credited_incomes_total"),
        start=1,
    ):
        results.append(f"{i}. {a['code']} -> R$ {a['normalized_credited_incomes_total']:n}")

    if results:
        print(f"\n\n------------ RENDIMENTO (seção {section}) ------------\n\n")
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
            elif roi < 0:
                asset_losses += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = R$ {roi:n}")

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
            if roi > 0:
                profits += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")
            elif roi < 0:
                asset_losses += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")

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
            elif roi < 0:
                asset_losses += roi
                if debug > 1:
                    results.append(f"\t\t\t{t.asset_code} -> roi = {currency_symbol} {roi:n}")

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
    _print_credited_incomes(qs=qs, year=year, debug=debug)

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
        # Mirror price -> irpf_price to keep IRPF aggregates consistent.
        irpf_price=Decimal("0.0000000001"),
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


class _BackfillDryRunRollback(Exception):
    pass


_USER_1_FIXED_INCOME_FACTS = {
    "CDBC24DIQ8Z": {"indexer": FixedIncomeIndexers.cdi},
    "24L03571458": {"indexer": FixedIncomeIndexers.prefixed},
    "CDB1253MX9Z": {"indexer": FixedIncomeIndexers.prefixed},
    "BRSTNCNTB666": {"indexer": FixedIncomeIndexers.ipca},
    "CDB3259N1UN": {"indexer": FixedIncomeIndexers.cdi},
    "CDBC248SHCJ": {"indexer": FixedIncomeIndexers.prefixed},
    "CDB72426EJQ": {"indexer": FixedIncomeIndexers.prefixed},
    "25H03552378": {"indexer": FixedIncomeIndexers.prefixed},
    "25H03552398": {"indexer": FixedIncomeIndexers.cdi},
    "CDB4193UXEU": {"indexer": FixedIncomeIndexers.prefixed},
    "porquinho-inter": {"indexer": FixedIncomeIndexers.cdi},
    "25L03967955": {"indexer": FixedIncomeIndexers.prefixed},
    "LIG02500SUX": {"indexer": FixedIncomeIndexers.cdi},
    "CDB1265D0XD": {"indexer": FixedIncomeIndexers.ipca},
    "CDB12694JYR": {"indexer": FixedIncomeIndexers.ipca},
    "BRSTNCLTN8J8": {
        "indexer": FixedIncomeIndexers.prefixed,
        "expected_maturity_date": date(2032, 12, 1),
        "maturity_date": date(2032, 1, 1),
    },
    "BRSTNCNTB7T1": {"indexer": FixedIncomeIndexers.ipca},
    "CDB4264L42J": {"indexer": FixedIncomeIndexers.prefixed},
    "CDB4264L42U": {"indexer": FixedIncomeIndexers.ipca},
    "CDB426DGCVL": {"indexer": FixedIncomeIndexers.prefixed},
    "BRSTNCLF1RU6": {"indexer": FixedIncomeIndexers.selic},
    "BRSTNCNTB4X0": {"indexer": FixedIncomeIndexers.ipca},
    "BRSTNCNTB3B8": {"indexer": FixedIncomeIndexers.ipca},
}


_USER_1_FIXED_INCOME_TRANSACTIONS = (
    {
        "code": "25L03967955",
        "action": TransactionActions.sell,
        "operation_date": date(2026, 6, 29),
        "quantity": Decimal("1000000"),
        "price": Decimal("0.01"),
    },
    {
        "code": "25H03552378",
        "action": TransactionActions.sell,
        "operation_date": date(2026, 2, 19),
        "quantity": Decimal("1000000"),
        "price": Decimal("0.01"),
    },
)


_USER_1_FIXED_INCOME_INTERESTS = (
    {
        "code": "25L03967955",
        "operation_date": date(2026, 6, 29),
        "amount": Decimal("628.16"),
    },
)


def backfill_user_1_fixed_income_facts(dry_run: bool = True) -> list[dict]:
    """Backfill the reviewed fixed-income indexers and maturity correction.

    Usage in ``python manage.py shell``::

        from variable_income_assets.scripts import backfill_user_1_fixed_income_facts
        backfill_user_1_fixed_income_facts()               # preview, rolled back
        backfill_user_1_fixed_income_facts(dry_run=False)  # persist
    """
    report: list[dict] = []
    try:
        with djtransaction.atomic():
            assets = {
                asset.code: asset
                for asset in Asset.objects.filter(
                    user_id=1,
                    type=AssetTypes.fixed_br,
                    code__in=_USER_1_FIXED_INCOME_FACTS,
                )
            }
            missing = sorted(set(_USER_1_FIXED_INCOME_FACTS) - set(assets))
            if missing:
                raise RuntimeError(f"Missing user_id=1 fixed-income assets: {missing}")

            for code, desired in _USER_1_FIXED_INCOME_FACTS.items():
                asset = assets[code]
                changes: dict[str, dict] = {}

                desired_indexer = desired["indexer"]
                if asset.indexer not in ("", desired_indexer):
                    raise RuntimeError(
                        f"{code}: expected blank or {desired_indexer!r} indexer, "
                        f"found {asset.indexer!r}"
                    )
                if asset.indexer != desired_indexer:
                    changes["indexer"] = {"from": asset.indexer, "to": desired_indexer}
                    asset.indexer = desired_indexer

                desired_maturity = desired.get("maturity_date")
                if desired_maturity is not None:
                    expected_maturity = desired["expected_maturity_date"]
                    if asset.maturity_date not in (expected_maturity, desired_maturity):
                        raise RuntimeError(
                            f"{code}: expected maturity {expected_maturity} or "
                            f"{desired_maturity}, found {asset.maturity_date}"
                        )
                    if asset.maturity_date != desired_maturity:
                        changes["maturity_date"] = {
                            "from": asset.maturity_date,
                            "to": desired_maturity,
                        }
                        asset.maturity_date = desired_maturity

                if changes:
                    asset.save(update_fields=tuple(changes))
                    upsert_asset_read_model(asset_id=asset.id, is_aggregate_upsert=False)
                    action = "updated"
                else:
                    action = "already_applied"
                report.append(
                    {
                        "code": code,
                        "description": asset.description,
                        "user_id": asset.user_id,
                        "action": action,
                        "changes": changes,
                    }
                )

            if dry_run:
                raise _BackfillDryRunRollback
    except _BackfillDryRunRollback:
        pass
    return report


class _ShellRequest:
    def __init__(self, user) -> None:
        self.user = user


def backfill_user_1_fixed_income_events(dry_run: bool = True) -> list[dict]:
    """Create the reviewed B3 maturity transactions and fixed-income interest.

    Usage in ``python manage.py shell``::

        from variable_income_assets.scripts import backfill_user_1_fixed_income_events
        backfill_user_1_fixed_income_events()               # preview, rolled back
        backfill_user_1_fixed_income_events(dry_run=False)  # persist
    """
    report: list[dict] = []
    event_codes = {
        event["code"]
        for event in (*_USER_1_FIXED_INCOME_TRANSACTIONS, *_USER_1_FIXED_INCOME_INTERESTS)
    }
    try:
        with djtransaction.atomic():
            user = UserModel.objects.get(pk=1)
            assets = {
                asset.code: asset
                for asset in Asset.objects.filter(
                    user_id=1,
                    type=AssetTypes.fixed_br,
                    code__in=event_codes,
                )
            }
            missing = sorted(event_codes - set(assets))
            if missing:
                raise RuntimeError(f"Missing user_id=1 fixed-income assets: {missing}")

            ordered_events = [
                (event["operation_date"], 0, "interest", event)
                for event in _USER_1_FIXED_INCOME_INTERESTS
            ] + [
                (event["operation_date"], 1, "transaction", event)
                for event in _USER_1_FIXED_INCOME_TRANSACTIONS
            ]
            for _, _, event_kind, event in sorted(ordered_events, key=lambda item: item[:2]):
                asset = assets[event["code"]]
                if event_kind == "interest":
                    lookup = {
                        "asset": asset,
                        "type": PassiveIncomeTypes.interest,
                        "event_type": PassiveIncomeEventTypes.credited,
                        "operation_date": event["operation_date"],
                        "amount": event["amount"],
                    }
                    if PassiveIncome.objects.filter(**lookup).exists():
                        action = "income_already_exists"
                    else:
                        PassiveIncome.objects.create(
                            **lookup,
                            current_currency_conversion_rate=Decimal("1"),
                        )
                        upsert_asset_read_model(asset_id=asset.id, is_aggregate_upsert=True)
                        action = "income_created"
                    report.append({**event, "code": asset.code, "action": action})
                    continue

                lookup = {
                    "asset": asset,
                    "action": event["action"],
                    "operation_date": event["operation_date"],
                    "quantity": event["quantity"],
                    "price": event["price"],
                }
                maturity_already_exists = Transaction.objects.filter(
                    asset=asset,
                    action=TransactionActions.sell,
                    operation_date=event["operation_date"],
                    quantity=event["quantity"],
                ).exists()
                if Transaction.objects.filter(**lookup).exists() or maturity_already_exists:
                    action = "transaction_already_exists"
                else:
                    serializer = TransactionListSerializer(
                        data={
                            "asset_pk": asset.id,
                            "action": event["action"],
                            "operation_date": event["operation_date"].strftime("%d/%m/%Y"),
                            "quantity": str(event["quantity"]),
                            "price": str(event["price"]),
                        },
                        context={"request": _ShellRequest(user)},
                    )
                    serializer.is_valid(raise_exception=True)
                    serializer.save()
                    action = "transaction_created"
                report.append(
                    {
                        **event,
                        "code": asset.code,
                        "transaction_action": event["action"],
                        "action": action,
                    }
                )

            if dry_run:
                raise _BackfillDryRunRollback
    except _BackfillDryRunRollback:
        pass
    return report


def import_selic_ntnb(user_pk: int, dry_run: bool = True) -> None:
    """One-off: register the Selic-held NTN-Bs (Inter DTVM custody, invisible to B3 files).

    Data hand-extracted from the Inter "Extrato de Movimentação de Renda Fixa" PDFs
    (aplicação dates + amounts) and the Selic "Extrato de custódia" of 08/07/2026
    (ISINs + total quantities). Per-buy quantities are not reported anywhere; the
    6/7/4 split of the 2030 title's 17 units is the only integer split whose implied
    unit prices are consistent (~R$4.5k).

    Dry run by default: writes inside a transaction, prints the report, rolls back.
    Call with dry_run=False to persist. Skips assets that already exist (but not
    their transactions — don't apply twice).

    Usage:
        from variable_income_assets.scripts import import_selic_ntnb
        import_selic_ntnb(user_pk=1)                 # preview
        import_selic_ntnb(user_pk=1, dry_run=False)  # persist
    """
    # (isin, maturity, current unit price @ 09/07/2026, [(operation_date, quantity, total_paid)])
    titles = []

    class _Rollback(Exception):
        pass

    class _RequestContext:
        def __init__(self, user) -> None:
            self.user = user

    user = UserModel.objects.get(pk=user_pk)
    context = {"request": _RequestContext(user)}

    def _run() -> None:
        for isin, maturity, current_price, buys in titles:
            asset = Asset.objects.filter(
                user_id=user_pk, code=isin, type=AssetTypes.fixed_br, currency=Currencies.real
            ).first()
            maturity_str = maturity.strftime("%d/%m/%Y")
            if asset is not None:
                print(f"{isin}: asset already exists (#{asset.id})")
            else:
                serializer = AssetSerializer(
                    data={
                        "type": AssetTypes.fixed_br,
                        "code": isin,
                        "currency": Currencies.real,
                        "description": f"TPF - Título Público IPCA + 8% a.a. - venc {maturity_str}",
                        "objective": AssetObjectives.growth,
                        "liquidity_type": LiquidityTypes.at_maturity,
                        "maturity_date": maturity_str,
                    },
                    context=context,
                )
                serializer.is_valid(raise_exception=True)
                asset = serializer.save()
                # AssetSerializer.save() returns the domain model (no .pk, only .id)
                print(f"{isin}: asset created (#{asset.id})")

            for operation_date, quantity, total_paid in buys:
                price = (total_paid / quantity).quantize(Decimal("0.00000001"))
                tx_serializer = TransactionListSerializer(
                    data={
                        "asset_pk": asset.id,
                        "action": TransactionActions.buy,
                        "price": str(price),
                        "quantity": str(quantity),
                        "operation_date": operation_date.strftime("%d/%m/%Y"),
                    },
                    context=context,
                )
                tx_serializer.is_valid(raise_exception=True)
                tx_serializer.save()
                print(f"{isin}: BUY {quantity} @ {price} on {operation_date} (total {total_paid})")

            # The AssetCreated handler creates the global metadata row with price 0
            # (fixed_br has no price integration); set the unit value from the extrato.
            update_asset_metadata_current_price(
                code=isin, price=current_price.quantize(Decimal("0.000001"))
            )
            print(f"{isin}: metadata price -> {current_price:.6f}")

    try:
        with djtransaction.atomic():
            _run()
            if dry_run:
                raise _Rollback
    except _Rollback:
        print("\nDRY RUN — rolled back. Re-run with dry_run=False to persist.")
    else:
        print("\nAPPLIED.")


def generate_fire_returns_ts(
    output_path: str | None = "../react/src/pages/private/Home/fireReturns.ts",
    start_year: int = 1995,
    end_year: int | None = None,
) -> None:
    if start_year < 1995:
        raise ValueError("generate_fire_returns_ts only supports start_year >= 1995")
    if end_year is None:
        end_year = timezone.localdate().year - 1
    if end_year < start_year:
        raise ValueError("end_year must be greater than or equal to start_year")

    series = build_fire_return_series(
        start_year=start_year,
        end_year=end_year,
        alpha_vantage_api_key=os.environ["ALPHA_VANTAGE_API_KEY"],
    )
    validate_fire_return_series(series)
    content = render_fire_returns_ts(series)
    if output_path is None:
        print(content)
        return
    Path(output_path).write_text(content, encoding="utf-8")
