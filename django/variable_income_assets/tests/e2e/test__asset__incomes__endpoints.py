import pytest

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
                    "currency": Currencies.get_choice(stock_usa_asset.currency).label,
                },
            }
        ],
    }
