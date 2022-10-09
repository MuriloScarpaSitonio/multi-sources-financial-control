from decimal import Decimal, ROUND_HALF_UP

import pytest

from django.utils import timezone
from django.db.models import Avg, Q
from django.db.models.functions import TruncMonth

from config.settings.base import BASE_API_URL

from authentication.tests.conftest import client, secrets, user
from variable_income_assets.models import PassiveIncome
from variable_income_assets.tests.shared import convert_to_float_and_quantitize


pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "incomes"


@pytest.mark.usefixtures("passive_incomes")
def test__passive_incomes__indicators(client, simple_asset, another_asset, crypto_asset):
    # GIVEN
    today = timezone.now().date()
    current_credited = sum(
        (
            i.amount
            for i in PassiveIncome.objects.filter(
                operation_date__month=today.month, operation_date__year=today.year
            ).credited()
        )
    )
    provisioned_future = sum(
        (
            i.amount
            for i in PassiveIncome.objects.filter(
                Q(operation_date__month__gte=today.month, operation_date__year=today.year)
                | Q(operation_date__year__gt=today.year)
            ).provisioned()
        )
    )
    avg = (
        PassiveIncome.objects.filter(
            Q(operation_date__month__gte=today.month, operation_date__year=today.year - 1)
            | Q(operation_date__month__lte=today.month, operation_date__year=today.year)
        )
        .exclude(operation_date__month=today.month, operation_date__year=today.year)
        .credited()
        .annotate(month=TruncMonth("operation_date"))
        .values("month")
        .annotate_sum()
        .aggregate(avg=Avg("total"))["avg"]
    )

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == 200
    assert response.json() == {
        "avg": convert_to_float_and_quantitize(avg),
        "current_credited": convert_to_float_and_quantitize(current_credited),
        "provisioned_future": convert_to_float_and_quantitize(provisioned_future),
        "diff_percentage": convert_to_float_and_quantitize(
            (((current_credited / avg) - Decimal("1.0")) * Decimal("100.0"))
        ),
    }
