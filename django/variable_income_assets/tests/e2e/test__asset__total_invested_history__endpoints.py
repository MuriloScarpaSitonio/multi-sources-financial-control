from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/total_invested_history"


# def test__list(client, assets_total_invested_snapshot_factory):
#     # GIVEN

#     # WHEN
#     response = client.get(URL)

#     # THEN
#     assert response.status_code == HTTP_200_OK
#     # TODO add real test


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
