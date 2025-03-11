from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import HTTP_200_OK, HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/total_invested_history"


def test__get(client, assets_total_invested_snapshot_factory):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today - relativedelta(months=18), today
    assets_total_invested_snapshot_factory(total=5000)

    # WHEN
    response = client.get(
        URL
        + f"?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    assert all(h["total"] == 0 for h in response.json()[:-1])
    assert response.json()[-1]["total"] == 5000


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_investments_module_enabled = False
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de investimentos"}


def test__forbidden__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
