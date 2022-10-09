from decimal import Decimal

from django.utils import timezone

import pytest

from dateutil.relativedelta import relativedelta

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL
from config.settings.dynamic import dynamic_settings
from variable_income_assets.choices import TransactionCurrencies
from variable_income_assets.models import Transaction
from variable_income_assets.tests.shared import convert_to_float_and_quantitize

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "transactions"


@pytest.mark.usefixtures("transactions_indicators_data")
def test_indicators(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = current_bought = current_sold = 0

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.bought().filter(
                    created_at__month=relative_date.month,
                    created_at__year=relative_date.year,
                )
            )
        )
        sold = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.sold().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )

        if relative_date == base_date:
            current_bought = bought
            current_sold = sold
            continue

        summ += bought - sold

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    avg = summ / 12

    assert response.status_code == 200
    assert response.json() == {
        "avg": convert_to_float_and_quantitize(avg),
        "current_bought": convert_to_float_and_quantitize(current_bought),
        "current_sold": convert_to_float_and_quantitize(current_sold),
        "diff_percentage": convert_to_float_and_quantitize(
            (((current_bought - current_sold) / avg) - Decimal("1.0")) * Decimal("100.0")
        ),
    }


@pytest.mark.usefixtures("transactions_indicators_data")
def test_historic(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = 0
    result = {}

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.bought().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )
        sold = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.sold().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )

        result[f"{relative_date.day:02}/{relative_date.month:02}/{relative_date.year}"] = {
            "total_sold": convert_to_float_and_quantitize(sold * Decimal("-1")),
            "total_bought": convert_to_float_and_quantitize(bought),
            "diff": convert_to_float_and_quantitize(bought - sold),
        }

        if relative_date != base_date:
            summ += bought - sold

    # WHEN
    response = client.get(f"{URL}/historic")

    # THEN
    for h in response.json()["historic"]:
        assert result[h.pop("month")] == h

    assert response.json()["avg"] == convert_to_float_and_quantitize(summ / 12)
