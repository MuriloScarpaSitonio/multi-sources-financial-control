from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_401_UNAUTHORIZED

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test__unauthorized__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


def test__authorized__superuser(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.is_superuser = True
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_200_OK
