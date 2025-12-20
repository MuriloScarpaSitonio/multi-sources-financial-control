from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/{}/operation_periods"


def test__list__single_open_operation(client, stock_asset, buy_transaction):
    # GIVEN

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == [
        {
            "started_at": buy_transaction.operation_date.strftime("%Y-%m-%d"),
            "closed_at": None,
            "roi": None,
        }
    ]


@pytest.mark.usefixtures("sell_transaction")
def test__list__single_closed_operation(
    client, stock_asset, buy_transaction, stock_asset_closed_operation
):
    # GIVEN

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == [
        {
            "started_at": buy_transaction.operation_date.strftime("%Y-%m-%d"),
            "closed_at": stock_asset_closed_operation.operation_datetime.date().strftime(
                "%Y-%m-%d"
            ),
            "roi": stock_asset_closed_operation.normalized_total_sold
            - stock_asset_closed_operation.normalized_total_bought,
        }
    ]


def test__list__closed_then_reopened(client, closed_then_reopened_stock_asset):
    # GIVEN
    stock_asset, first_buy, closed_op, second_buy = closed_then_reopened_stock_asset

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == [
        {
            "started_at": first_buy.operation_date.strftime("%Y-%m-%d"),
            "closed_at": closed_op.operation_datetime.date().strftime("%Y-%m-%d"),
            "roi": closed_op.normalized_total_sold - closed_op.normalized_total_bought,
        },
        {
            "started_at": second_buy.operation_date.strftime("%Y-%m-%d"),
            "closed_at": None,
            "roi": None,
        },
    ]


def test__list__multiple_closed_operations(client, twice_closed_stock_asset):
    # GIVEN
    stock_asset, first_buy, closed_op1, second_buy, closed_op2 = twice_closed_stock_asset

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == [
        {
            "started_at": first_buy.operation_date.strftime("%Y-%m-%d"),
            "closed_at": closed_op1.operation_datetime.date().strftime("%Y-%m-%d"),
            "roi": closed_op1.normalized_total_sold - closed_op1.normalized_total_bought,
        },
        {
            "started_at": second_buy.operation_date.strftime("%Y-%m-%d"),
            "closed_at": closed_op2.operation_datetime.date().strftime("%Y-%m-%d"),
            "roi": closed_op2.normalized_total_sold - closed_op2.normalized_total_bought,
        },
    ]


def test__list__empty__no_transactions(client, stock_asset):
    # GIVEN
    # Asset exists but has no transactions

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


def test__list__asset_not_found(client, user):
    # GIVEN
    non_existent_id = 99999

    # WHEN
    response = client.get(URL.format(non_existent_id))

    # THEN
    # Returns empty list for non-existent asset (consistent with other nested viewsets)
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


def test__forbidden__module_not_enabled(user, client, stock_asset, buy_transaction):
    # GIVEN
    user.is_investments_module_enabled = False
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de investimentos"}


def test__forbidden__subscription_ended(client, user, stock_asset, buy_transaction):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user, stock_asset, buy_transaction):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL.format(stock_asset.pk))

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
