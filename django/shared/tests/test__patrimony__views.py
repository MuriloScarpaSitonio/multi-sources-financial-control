from decimal import Decimal

import pytest
from config.settings.base import BASE_API_URL
from dateutil.relativedelta import relativedelta
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN
from shared.tests import convert_and_quantitize
from variable_income_assets.models import AssetsTotalInvestedSnapshot

from django.utils import timezone

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}patrimony/growth"


def test__growth__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_personal_finances_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de finanças pessoais"}


def test__growth__forbidden__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__growth__missing_params(client):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"__all__": ["É necessário informar ao menos 'months' ou 'years'."]}


def test__growth__with_months(client, user, bank_account, bank_account_snapshot_factory):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(months=6)

    # Historical snapshots for both assets and bank account
    assets_snapshot_date = target_date - relativedelta(days=5)
    bank_snapshot_date = target_date - relativedelta(days=3)

    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=assets_snapshot_date,
        total=Decimal("800"),
    )
    bank_account_snapshot_factory(
        operation_date=bank_snapshot_date,
        total=Decimal("5000"),
    )

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    # Current total = 0 (no assets with metadata) + 10000 (bank_account.amount) = 10000
    # Historical total = 800 (assets) + 5000 (bank) = 5800
    # Historical date = min of the two snapshot dates
    # Growth = ((10000 / 5800) - 1) * 100 = 72.41%

    expected_growth = ((Decimal("10000") / Decimal("5800")) - Decimal("1")) * Decimal("100")

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("5800"))
    assert response_json["historical_date"] == str(assets_snapshot_date)
    assert response_json["growth_percentage"] == convert_and_quantitize(expected_growth)


def test__growth__with_years(client, user, bank_account, bank_account_snapshot_factory):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(years=1)

    # Historical snapshots
    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=target_date - relativedelta(days=10),
        total=Decimal("50000"),
    )
    bank_account_snapshot_factory(
        operation_date=target_date - relativedelta(days=10),
        total=Decimal("20000"),
    )

    # WHEN
    response = client.get(URL, {"years": 1})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("70000"))
    assert response_json["historical_date"] == str(target_date - relativedelta(days=10))


def test__growth__no_snapshots(client, user, bank_account):
    # GIVEN
    # No historical snapshots

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] is None
    assert response_json["historical_date"] is None
    assert response_json["growth_percentage"] is None


def test__growth__falls_back_to_earliest_snapshot_when_requested_period_too_far(
    client, user, bank_account, bank_account_snapshot_factory
):
    # GIVEN
    today = timezone.localdate()

    # User requests 5 years ago, but only has snapshots from 2 years ago
    earliest_snapshot_date = today - relativedelta(years=2)
    bank_account_snapshot_factory(
        operation_date=earliest_snapshot_date,
        total=Decimal("5000"),
    )
    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=earliest_snapshot_date,
        total=Decimal("3000"),
    )

    # WHEN - request 5 years (much older than available data)
    response = client.get(URL, {"years": 5})

    # THEN - should fall back to earliest available snapshot instead of null
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    # Current total = 0 (no assets) + 10000 (bank_account.amount) = 10000
    # Historical total = 3000 (assets) + 5000 (bank) = 8000
    # Growth = ((10000 / 8000) - 1) * 100 = 25%
    expected_growth = ((Decimal("10000") / Decimal("8000")) - Decimal("1")) * Decimal("100")

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("8000"))
    assert response_json["historical_date"] == str(earliest_snapshot_date)
    assert response_json["growth_percentage"] == convert_and_quantitize(expected_growth)


def test__growth__only_bank_snapshot(client, user, bank_account, bank_account_snapshot_factory):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(months=3)

    bank_account_snapshot_factory(
        operation_date=target_date - relativedelta(days=5),
        total=Decimal("8000"),
    )

    # WHEN
    response = client.get(URL, {"months": 3})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    # Historical total = 0 (assets) + 8000 (bank) = 8000
    # Current total = 0 (no assets) + 10000 (bank_account.amount) = 10000
    # Growth = ((10000 / 8000) - 1) * 100 = 25%

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("8000"))
    assert response_json["growth_percentage"] == convert_and_quantitize(Decimal("25"))


def test__growth__only_assets_snapshot(client, user, bank_account):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(months=3)

    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=target_date - relativedelta(days=5),
        total=Decimal("5000"),
    )

    # WHEN
    response = client.get(URL, {"months": 3})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    # Historical total = 5000 (assets) + 0 (bank) = 5000
    # Current total = 0 (no assets) + 10000 (bank_account.amount) = 10000
    # Growth = ((10000 / 5000) - 1) * 100 = 100%

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("5000"))
    assert response_json["growth_percentage"] == convert_and_quantitize(Decimal("100"))


def test__growth__historical_total_zero(client, user, bank_account, bank_account_snapshot_factory):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(months=6)

    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=target_date - relativedelta(days=5),
        total=Decimal("0"),
    )
    bank_account_snapshot_factory(
        operation_date=target_date - relativedelta(days=5),
        total=Decimal("0"),
    )

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    assert response_json["current_total"] == convert_and_quantitize(bank_account.amount)
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("0"))
    assert response_json["growth_percentage"] is None


def test__growth__no_bank_account(client, user):
    # GIVEN
    today = timezone.localdate()
    target_date = today - relativedelta(months=6)

    AssetsTotalInvestedSnapshot.objects.create(
        user=user,
        operation_date=target_date - relativedelta(days=5),
        total=Decimal("10000"),
    )

    # WHEN
    response = client.get(URL, {"months": 6})

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    # Current total = 0 (no assets) + 0 (no bank account) = 0
    # Historical total = 10000 (assets) + 0 (bank) = 10000
    # Growth = ((0 / 10000) - 1) * 100 = -100%

    assert response_json["current_total"] == convert_and_quantitize(Decimal("0"))
    assert response_json["historical_total"] == convert_and_quantitize(Decimal("10000"))
    assert response_json["growth_percentage"] == convert_and_quantitize(Decimal("-100"))
