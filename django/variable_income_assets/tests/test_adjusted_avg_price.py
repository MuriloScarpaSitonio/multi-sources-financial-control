from decimal import Decimal

import pytest

from ..choices import Currencies
from ..models import Asset, AssetMetaData, AssetReadModel
from ..serializers import AssetSimulateSerializer


@pytest.mark.parametrize(
    "currency, quantity, bought, sold, income, expected",
    [
        (Currencies.real, "8050", "89215.95", "33030", "2794.21", "6.6325"),
        (Currencies.real, "60", "1000", "320", "20", "11.0000"),
        (Currencies.real, "10", "1000", "1200", "20", "-22.0000"),
        (Currencies.real, "0", "0", "0", "0", "0.0000"),
        (Currencies.dollar, "60", "5000", "1920", "100", "9.9333"),
    ],
)
def test_adjusted_price_is_break_even_in_asset_currency(
    currency, quantity, bought, sold, income, expected
):
    values = {
        "currency": currency,
        "quantity_balance": Decimal(quantity),
        "normalized_total_bought": Decimal(bought),
        "normalized_total_sold": Decimal(sold),
        "normalized_credited_incomes": Decimal(income),
        # Deliberately different from the remaining net cash outlay.
        "avg_price": Decimal("5.02625070"),
        "credited_incomes": Decimal(income),
    }
    read_asset = AssetReadModel(**values)
    simulated_asset = Asset(currency=currency)
    for field, value in values.items():
        setattr(simulated_asset, field, value)
    serializer = AssetSimulateSerializer(context={"current_currency_conversion_rate": Decimal("5")})

    price = read_asset.adjusted_avg_price

    assert price.quantize(Decimal("0.0001")) == Decimal(expected)
    assert serializer.get_adjusted_avg_price(simulated_asset) == price
    if Decimal(quantity):
        read_asset.metadata = AssetMetaData(current_price=price)
        assert abs(read_asset.normalized_roi) < Decimal("0.00000001")
