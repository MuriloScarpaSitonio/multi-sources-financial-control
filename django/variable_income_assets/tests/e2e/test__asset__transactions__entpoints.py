from django.utils import timezone

import pytest
from rest_framework.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize

from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import AssetTypes, Currencies, TransactionActions
from ...models import Transaction
from ..shared import (
    get_current_total_bought_brute_force,
    get_roi_brute_force,
    get_total_invested_brute_force,
)

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/{}/transactions"


@pytest.mark.usefixtures("transactions")
def test__simulate_transaction__w_quantity(client, stock_asset, stock_asset_metadata):
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
    assert (
        response_json["old"]["normalized_total_invested"]
        < response_json["new"]["normalized_total_invested"]
    )


@pytest.mark.usefixtures("loss_asset_previously_closed_w_profit_loss")
def test__simulate_transaction__closed_asset(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.post(
        f"{URL.format(stock_asset.pk)}/simulate", data={"price": 10, "total": 5000}
    )
    response_json = response.json()

    # THEN
    assert response.status_code == 200

    assert response_json["old"]["adjusted_avg_price"] > response_json["new"]["adjusted_avg_price"]
    assert response_json["old"]["roi"] < response_json["new"]["roi"]
    assert response_json["old"]["roi_percentage"] < response_json["new"]["roi_percentage"]
    assert (
        response_json["old"]["normalized_total_invested"]
        < response_json["new"]["normalized_total_invested"]
    )


@pytest.mark.usefixtures("transactions")
def test__simulate_transaction__w_total(client, stock_asset, stock_asset_metadata):
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
    assert (
        response_json["old"]["normalized_total_invested"]
        < response_json["new"]["normalized_total_invested"]
    )


def test__simulate_transaction__wo_total_and_quantity__error(client, stock_asset):
    # GIVEN

    # WHEN
    response = client.post(f"{URL.format(stock_asset.pk)}/simulate", data={"price": 50})

    # THEN
    assert response.status_code == 400
    assert response.json() == {"non_field_errors": ["`quantity` or `total` is required"]}


@pytest.mark.usefixtures("crypto_transaction", "crypto_asset_metadata")
def test__simulate_transaction__should_not_normalize_avg_price(client, crypto_asset):
    # GIVEN
    price, quantity = 10, 100
    old = {
        "roi": get_roi_brute_force(crypto_asset),
        "normalized_total_invested": get_total_invested_brute_force(crypto_asset),
    }
    old["roi_percentage"] = (old["roi"] / get_current_total_bought_brute_force(crypto_asset)) * 100

    # WHEN
    response = client.post(
        f"{URL.format(crypto_asset.pk)}/simulate", data={"price": price, "quantity": quantity}
    )
    response_json = response.json()
    Transaction.objects.create(
        asset=crypto_asset,
        action=TransactionActions.buy,
        price=price,
        quantity=quantity,
        current_currency_conversion_rate=get_dollar_conversion_rate(),
    )

    new = {
        "roi": get_roi_brute_force(crypto_asset),
        "normalized_total_invested": get_total_invested_brute_force(crypto_asset),
    }
    new["roi_percentage"] = (new["roi"] / get_current_total_bought_brute_force(crypto_asset)) * 100

    # THEN
    assert response.status_code == 200

    assert (
        response_json["old"]["adjusted_avg_price"]
        == response_json["new"]["adjusted_avg_price"]
        == price
    )

    for k, v in old.items():
        assert convert_and_quantitize(v) == convert_and_quantitize(response_json["old"][k])
    for k, v in new.items():
        assert convert_and_quantitize(v) == convert_and_quantitize(response_json["new"][k])


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
                "current_currency_conversion_rate": transaction.current_currency_conversion_rate,
                "asset": {
                    "pk": stock_usa_asset.pk,
                    "code": stock_usa_asset.code,
                    "type": AssetTypes.get_choice(stock_usa_asset.type).label,
                    "currency": Currencies.get_choice(stock_usa_asset.currency).label,
                    "description": stock_usa_asset.description,
                },
            }
        ],
    }


def test__forbidden__module_not_enabled(user, client, stock_usa_asset):
    # GIVEN
    user.is_investments_module_enabled = False
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL.format(stock_usa_asset.pk))

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de investimentos"}


def test__forbidden__subscription_ended(client, user, stock_usa_asset):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL.format(stock_usa_asset.pk))

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user, stock_usa_asset):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL.format(stock_usa_asset.pk))

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
