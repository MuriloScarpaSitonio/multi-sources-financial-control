import pytest

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL
from variable_income_assets.choices import AssetTypes, Currencies, TransactionActions

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/{}/transactions"


@pytest.mark.usefixtures("transactions")
def test_should_simulate_transaction_w_quantity(client, stock_asset, stock_asset_metadata):
    # GIVEN
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()

    # WHEN
    response = client.post(
        f"{URL.format(stock_asset.pk)}/simulate", data={"price": 50, "quantity": 100}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]
    assert response_json["old"]["roi"] < response_json["new"]["roi"]
    assert response_json["old"]["roi_percentage"] > response_json["new"]["roi_percentage"]
    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]


@pytest.mark.usefixtures("transactions")
def test_should_simulate_transaction_w_total(client, stock_asset, stock_asset_metadata):
    # GIVEN
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()

    # WHEN
    response = client.post(
        f"{URL.format(stock_asset.pk)}/simulate", data={"price": 50, "total": 5000}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]
    assert response_json["old"]["roi"] < response_json["new"]["roi"]
    assert response_json["old"]["roi_percentage"] > response_json["new"]["roi_percentage"]
    assert response_json["old"]["adjusted_avg_price"] < response_json["new"]["adjusted_avg_price"]


def test_should_not_simulate_transaction_wo_total_and_quantity(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.post(f"{URL.format(stock_asset.pk)}/simulate", data={"price": 50})

    # THEN
    assert response.status_code == 400
    assert response.json() == {"non_field_errors": ["`quantity` or `total` is required"]}


@pytest.mark.usefixtures("crypto_transaction")
def test_should_not_normalize_avg_price_with_currency_when_simulating_transaction(
    client, crypto_asset
):
    # GIVEN
    price = 10

    # WHEN
    response = client.post(
        f"{URL.format(crypto_asset.pk)}/simulate", data={"price": price, "quantity": 100}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert (
        response_json["old"]["adjusted_avg_price"]
        == response_json["new"]["adjusted_avg_price"]
        == price
    )


@pytest.mark.usefixtures("transactions", "stock_asset", "stock_usa_transaction")
def test__list__sanity_check(client, stock_usa_asset):
    # GIVEN
    transaction = stock_usa_asset.transactions.first()

    # WHEN
    response = client.get(URL.format(stock_usa_asset.pk))

    # THEN
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": transaction.id,
                "action": TransactionActions.get_choice(transaction.action).label,
                "price": float(transaction.price),
                "quantity": float(transaction.quantity),
                "operation_date": transaction.operation_date.strftime("%Y-%m-%d"),
                "initial_price": transaction.initial_price,
                "current_currency_conversion_rate": transaction.current_currency_conversion_rate,
                "asset": {
                    "pk": stock_usa_asset.pk,
                    "code": stock_usa_asset.code,
                    "type": AssetTypes.get_choice(stock_usa_asset.type).label,
                    "currency": Currencies.get_choice(stock_usa_asset.currency).label,
                },
            }
        ],
    }
