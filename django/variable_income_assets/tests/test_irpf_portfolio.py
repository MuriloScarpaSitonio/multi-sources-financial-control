import locale
from datetime import date
from decimal import Decimal

import pytest

from variable_income_assets import scripts
from variable_income_assets.choices import TransactionActions
from variable_income_assets.models import Asset
from variable_income_assets.tests.conftest import TransactionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def numeric_locale():
    previous = locale.setlocale(locale.LC_NUMERIC)
    locale.setlocale(locale.LC_NUMERIC, "C")
    yield
    locale.setlocale(locale.LC_NUMERIC, previous)


def trade(asset, day, action, quantity, price, rate="1", irpf_price=None):
    return TransactionFactory(
        asset=asset,
        operation_date=day,
        action=action,
        quantity=Decimal(quantity) if quantity is not None else None,
        price=Decimal(price),
        irpf_price=Decimal(irpf_price if irpf_price is not None else price),
        current_currency_conversion_rate=Decimal(rate),
    )


def test_report_prints_both_calculations_after_sale_and_repurchase(stock_asset, capsys):
    trade(stock_asset, date(2025, 1, 1), TransactionActions.buy, "100", "10")
    trade(stock_asset, date(2025, 1, 2), TransactionActions.sell, "90", "8")
    trade(stock_asset, date(2025, 1, 3), TransactionActions.buy, "10", "4")
    before = Asset.objects.annotate_irpf_infos(year=2025).values().get(pk=stock_asset.pk)

    scripts._print_assets_portfolio(Asset.objects.filter(pk=stock_asset.pk), year=2025)

    output = capsys.readouterr().out
    previous, recommended = output.split("Cálculo recomendado (método da Receita; fonte: ")
    assert "Cálculo da última declaração" in previous
    assert f"Preço médio: R$ {before['avg_price']:n}" in previous
    assert f"Total: R$ {before['normalized_total_invested']:n}" in previous
    assert (
        "https://www.gov.br/receitafederal/pt-br/assuntos/"
        "meu-imposto-de-renda/pagamento/renda-variavel/manual)"
    ) in recommended
    assert "Preço médio: R$ 7" in recommended
    assert "Total: R$ 140" in recommended
    assert Asset.objects.annotate_irpf_infos(year=2025).values().get(pk=stock_asset.pk) == before


def test_acquisition_cost_keeps_declared_bonus_cost_and_historical_fx(stock_usa_asset, capsys):
    trade(stock_usa_asset, date(2025, 1, 1), TransactionActions.buy, "10", "10", rate="5")
    trade(
        stock_usa_asset,
        date(2025, 1, 2),
        TransactionActions.bonificacao,
        "10",
        "0",
        rate="4",
        irpf_price="2",
    )
    trade(stock_usa_asset, date(2025, 1, 3), TransactionActions.sell, "10", "50", rate="6")
    trade(stock_usa_asset, date(2025, 1, 4), TransactionActions.buy, "10", "4", rate="4")

    values = scripts._get_irpf_acquisition_costs([stock_usa_asset.pk], year=2025)[
        stock_usa_asset.pk
    ]

    assert values["avg_price"] == Decimal("5")
    assert values["total_invested"] == Decimal("100")
    assert values["normalized_total_invested"] == Decimal("450")
    assert values["avg_current_currency_conversion_rate"] == Decimal("4.5")
    scripts._print_assets_portfolio(Asset.objects.filter(pk=stock_usa_asset.pk), year=2025)
    recommended = capsys.readouterr().out.split("Cálculo recomendado")[1]
    assert "Preço médio: US$ 5" in recommended
    assert "Total: R$ 450" in recommended
    assert "Total em dólar: US$ 100" in recommended
    assert "Dólar médio: R$ 4.5" in recommended


def test_acquisition_cost_orders_by_date_and_resets_after_full_sale(stock_asset):
    trade(stock_asset, date(2025, 1, 3), TransactionActions.buy, "2", "4")
    trade(stock_asset, date(2024, 1, 1), TransactionActions.buy, "100", "10")
    trade(stock_asset, date(2025, 1, 2), TransactionActions.sell, "100", "8")
    trade(stock_asset, date(2026, 1, 1), TransactionActions.buy, "100", "99")

    values = scripts._get_irpf_acquisition_costs([stock_asset.pk], year=2025)[stock_asset.pk]

    assert values["avg_price"] == Decimal("4")
    assert values["total_invested"] == Decimal("8")
    assert values["normalized_total_invested"] == Decimal("8")
    prior_year = scripts._get_irpf_acquisition_costs([stock_asset.pk], year=2024)[stock_asset.pk]
    assert prior_year["avg_price"] == Decimal("10")
    assert prior_year["total_invested"] == Decimal("1000")


@pytest.mark.parametrize("close_position", [False, True])
def test_acquisition_cost_handles_zero_cost_and_closed_positions(stock_asset, close_position):
    trade(stock_asset, date(2025, 1, 1), TransactionActions.bonificacao, "0.5", "0")
    if close_position:
        trade(stock_asset, date(2025, 1, 2), TransactionActions.sell, "0.5", "1")

    values = scripts._get_irpf_acquisition_costs([stock_asset.pk], year=2025)[stock_asset.pk]

    assert values["avg_price"] == Decimal()
    assert values["total_invested"] == Decimal()
    assert values["normalized_total_invested"] == Decimal()
    assert values["avg_current_currency_conversion_rate"] == Decimal()


def test_acquisition_cost_keeps_assets_separate_and_is_read_only(stock_asset, another_stock_asset):
    first = trade(stock_asset, date(2025, 1, 1), TransactionActions.buy, "0.5", "10")
    second = trade(another_stock_asset, date(2025, 1, 1), TransactionActions.buy, "3", "20")

    values = scripts._get_irpf_acquisition_costs(
        [stock_asset.pk, another_stock_asset.pk], year=2025
    )

    assert values[stock_asset.pk]["avg_price"] == Decimal("10")
    assert values[stock_asset.pk]["total_invested"] == Decimal("5")
    assert values[another_stock_asset.pk]["avg_price"] == Decimal("20")
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.irpf_price == Decimal("10")
    assert second.irpf_price == Decimal("20")


def test_empty_portfolio_does_not_print_report(capsys):
    scripts._print_assets_portfolio(Asset.objects.none(), year=2025)
    assert capsys.readouterr().out == ""


def test_amount_only_transactions_do_not_receive_a_per_share_recommendation(stock_asset, capsys):
    trade(stock_asset, date(2025, 1, 1), TransactionActions.buy, None, "1000")

    scripts._print_assets_portfolio(Asset.objects.filter(pk=stock_asset.pk), year=2025)

    output = capsys.readouterr().out
    assert "Cálculo da última declaração" in output
    assert "Total: R$ 1000" in output
    assert "Cálculo recomendado" not in output


@pytest.mark.parametrize("initial_quantity", ["0", "1", None])
def test_report_keeps_legacy_values_when_history_cannot_be_replayed(
    stock_asset, capsys, initial_quantity
):
    trade(stock_asset, date(2025, 1, 1), TransactionActions.buy, initial_quantity, "10")
    trade(stock_asset, date(2025, 1, 2), TransactionActions.sell, "2", "8")
    trade(stock_asset, date(2025, 1, 3), TransactionActions.buy, "3", "4")

    scripts._print_assets_portfolio(Asset.objects.filter(pk=stock_asset.pk), year=2025)

    output = capsys.readouterr().out
    assert "Cálculo da última declaração" in output
    assert "Cálculo recomendado" not in output
