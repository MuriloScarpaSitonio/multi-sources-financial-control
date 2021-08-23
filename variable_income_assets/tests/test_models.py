import pytest

from ..choices import TransactionActions

pytestmark = pytest.mark.django_db


def _get_avg_price_bute_force(asset):
    weights = []
    quantities = []
    for transaction in asset.transactions.bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    return sum(weights) / sum(quantities)


def _get_adjusted_avg_price_brute_forte(asset):
    weights = []
    quantities = []
    for transaction in asset.transactions.bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    quantities_sum = sum(quantities)
    avg_price = sum(weights) / quantities_sum
    incomes_sum = sum([income.amount for income in asset.incomes.credited()])
    return ((avg_price * quantities_sum) - incomes_sum) / quantities_sum


def _get_adjusted_quantity_brute_force(asset):
    bought = [transaction.quantity for transaction in asset.transactions.bought()]
    sold = [transaction.quantity for transaction in asset.transactions.sold()]

    return sum(bought) - sum(sold)


def _get_ROI_brute_force(asset):
    results = []
    for transaction in asset.transactions.sold():
        result = (transaction.price - transaction.initial_price) * transaction.quantity
        results.append(result)

    return sum(results)


@pytest.mark.usefixtures("transactions")
def test_should_calculate_avg_price(simple_asset):
    # GIVEN

    # WHEN
    expected = _get_avg_price_bute_force(asset=simple_asset)

    # THEN
    assert round(simple_asset.avg_price, 6) == round(expected, 6)


@pytest.mark.usefixtures("transactions", "passive_incomes")
def test_should_calculate_adjusted_avg_price(simple_asset):
    # GIVEN

    # WHEN
    expected = _get_adjusted_avg_price_brute_forte(asset=simple_asset)

    # THEN
    assert round(simple_asset.adjusted_avg_price, 6) == round(expected, 6)


@pytest.mark.usefixtures("transactions")
def test_should_calculate_quantity(simple_asset):
    # GIVEN

    # WHEN
    expected = _get_adjusted_quantity_brute_force(asset=simple_asset)

    # THEN
    assert simple_asset.quantity == expected


@pytest.mark.usefixtures("transactions")
def test_should_calculate_total_invested(simple_asset):
    # GIVEN

    # WHEN
    quantity = _get_adjusted_quantity_brute_force(asset=simple_asset)
    avg_price = _get_avg_price_bute_force(asset=simple_asset)

    # THEN
    assert round(simple_asset.total_invested, 6) == round(avg_price * quantity, 6)


@pytest.mark.usefixtures("transactions")
def test_should_calculate_adjusted_total_invested(simple_asset):
    # GIVEN

    # WHEN
    quantity = _get_adjusted_quantity_brute_force(asset=simple_asset)
    avg_price = _get_adjusted_avg_price_brute_forte(asset=simple_asset)

    # THEN
    assert round(simple_asset.total_invested, 6) == round(avg_price * quantity, 6)


@pytest.mark.usefixtures("transactions")
def test_should_calculate_asset_roi(simple_asset):
    # GIVEN

    # WHEN
    expected = _get_ROI_brute_force(asset=simple_asset)

    # THEN
    assert round(simple_asset.get_ROI(), 6) == round(expected, 6)


@pytest.mark.usefixtures("transactions")
def test_should_calculate_asset_roi_percentage(simple_asset):
    # GIVEN

    # WHEN
    roi = _get_ROI_brute_force(asset=simple_asset)
    initial_investment = sum(
        [
            transaction.price * transaction.quantity
            for transaction in simple_asset.transactions.bought()
        ]
    )

    # THEN
    assert round(simple_asset.get_ROI(percentage=True), 6) == round(
        roi / initial_investment, 6
    )
