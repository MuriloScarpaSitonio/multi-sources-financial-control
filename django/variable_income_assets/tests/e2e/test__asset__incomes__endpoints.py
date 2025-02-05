from django.utils import timezone

import pytest
from rest_framework.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL

from ...choices import (
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/{}/incomes"


@pytest.mark.usefixtures("passive_incomes", "another_income")
def test__list__sanity_check(client, stock_usa_asset):
    # GIVEN
    income = stock_usa_asset.incomes.first()

    # WHEN
    response = client.get(URL.format(stock_usa_asset.pk))

    # THEN
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": income.pk,
                "type": PassiveIncomeTypes.get_choice(income.type).label,
                "event_type": PassiveIncomeEventTypes.get_choice(income.event_type).label,
                "operation_date": income.operation_date.strftime("%Y-%m-%d"),
                "amount": float(income.amount),
                "current_currency_conversion_rate": float(income.current_currency_conversion_rate),
                "asset": {
                    "pk": stock_usa_asset.pk,
                    "code": stock_usa_asset.code,
                    "type": AssetTypes.get_choice(stock_usa_asset.type).label,
                    "currency": stock_usa_asset.currency,
                    "description": stock_usa_asset.description,
                    "is_held_in_self_custody": stock_usa_asset.is_held_in_self_custody,
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
