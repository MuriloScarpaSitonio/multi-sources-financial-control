from datetime import date
from decimal import Decimal

import pytest

from config.settings.base import BASE_API_URL

from ..choices import AssetTypes, Currencies, PassiveIncomeEventTypes, PassiveIncomeTypes
from ..models import Asset, AssetMetaData, AssetReadModel, PassiveIncome, Transaction
from ..service_layer.tasks import create_asset_closed_operation, upsert_asset_read_model

pytestmark = pytest.mark.django_db


@pytest.fixture
def dollar_asset(user):
    asset = Asset.objects.create(
        user=user, code="CHTR", type=AssetTypes.stock_usa, currency=Currencies.dollar
    )
    AssetMetaData.objects.create(
        code=asset.code, type=asset.type, currency=asset.currency, current_price=118
    )
    return asset


def trade(asset, action, price, quantity, day, rate):
    return Transaction.objects.create(
        asset=asset,
        action=action,
        price=Decimal(price),
        irpf_price=Decimal(price),
        quantity=Decimal(quantity),
        operation_date=day,
        current_currency_conversion_rate=Decimal(rate),
    )


def test_chtr_average_is_usd_in_list_and_simulation(
    client, dollar_asset, django_assert_num_queries
):
    asset = dollar_asset
    for price, qty, day, rate in [
        ("364.49152542", "11.82407337", date(2025, 3, 5), "5.76"),
        ("253.00847458", "3.08414503", date(2025, 9, 8), "5.44"),
        ("203.05084736", "20.16516161", date(2025, 12, 19), "5.50"),
        ("146.86440678", "3.40462856", date(2026, 5, 21), "5.00"),
    ]:
        trade(asset, "BUY", price, qty, day, rate)
    trade(asset, "SELL", "140.80508475", "0.01000857", date(2026, 5, 29), "1")
    upsert_asset_read_model(asset.id)
    response = client.get(f"/{BASE_API_URL}assets")
    assert response.status_code == 200
    row = response.json()["results"][0]
    assert row["currency"] == "USD"
    assert float(row["adjusted_avg_price"]) == pytest.approx(251.72226310)
    assert float(row["current_price"]) == 118
    assert float(
        AssetReadModel.objects.get(write_model_pk=asset.id).adjusted_avg_price
    ) == pytest.approx(251.72226310)
    # The listing's annotation must avoid per-asset property queries.
    with django_assert_num_queries(1):
        annotated = list(AssetReadModel.objects.annotate_native_net_outlay())
        assert float(annotated[0].adjusted_avg_price) == pytest.approx(251.72226310)
    before = asset.transactions.count()
    simulation = client.post(
        f"/{BASE_API_URL}assets/{asset.pk}/transactions/simulate",
        data={"price": 100, "quantity": 10},
    )
    assert simulation.status_code == 200
    assert float(simulation.json()["old"]["adjusted_avg_price"]) == pytest.approx(251.72226310)
    assert float(simulation.json()["new"]["adjusted_avg_price"]) == pytest.approx(220.41866834)
    assert asset.transactions.count() == before


def test_native_average_excludes_closed_periods_and_provisioned_income(client, dollar_asset):
    asset = dollar_asset
    trade(asset, "BUY", "100", "10", date(2024, 1, 1), "4")
    trade(asset, "SELL", "120", "10", date(2024, 2, 1), "6")
    create_asset_closed_operation(asset.pk)
    trade(asset, "BUY", "50", "20", date(2025, 1, 1), "4")
    trade(asset, "SELL", "80", "5", date(2025, 2, 1), "6")
    trade(asset, "BONIFICACAO", "0", "5", date(2025, 2, 2), "5")
    for day, amount, event in [
        (date(2024, 1, 2), 30, PassiveIncomeEventTypes.credited),
        (date(2025, 1, 2), 100, PassiveIncomeEventTypes.credited),
        (date(2025, 1, 3), 999, PassiveIncomeEventTypes.provisioned),
    ]:
        PassiveIncome.objects.create(
            asset=asset,
            type=PassiveIncomeTypes.dividend,
            amount=amount,
            event_type=event,
            operation_date=day,
            current_currency_conversion_rate=5,
        )
    upsert_asset_read_model(asset.pk)
    response = client.get(f"/{BASE_API_URL}assets")
    assert response.status_code == 200
    assert float(response.json()["results"][0]["adjusted_avg_price"]) == 25
