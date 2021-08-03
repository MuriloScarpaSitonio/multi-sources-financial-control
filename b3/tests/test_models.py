import pytest

from ..choices import TransactionOptions

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("transactions")
def test_should_calculate_average_price(simple_asset):
    # GIVEN

    # WHEN
    # brute force:
    weights = []
    quantities = []
    for transaction in simple_asset.transactions.filter(action=TransactionOptions.buy):
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    expected = sum(weights) / sum(quantities)

    # THEN
    assert round(simple_asset.avg_price, 6) == round(expected, 6)


@pytest.mark.usefixtures("transactions", "passive_incomes")
def test_should_calculate_adjusted_average_price(simple_asset):
    # GIVEN

    # WHEN
    # brute force:
    weights = []
    quantities = []
    for transaction in simple_asset.transactions.filter(action=TransactionOptions.buy):
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    quantities_sum = sum(quantities)
    avg_price = sum(weights) / quantities_sum
    incomes_sum = sum([income.amount for income in simple_asset.incomes.all()])
    expected = ((avg_price * quantities_sum) - incomes_sum) / quantities_sum

    # THEN
    assert round(simple_asset.adjusted_avg_price, 6) == round(expected, 6)
