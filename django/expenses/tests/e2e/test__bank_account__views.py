from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "bank_account"


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_personal_finances_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de finanças pessoais"}


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


def test__get(client, bank_account):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    response_json = response.json()

    assert response_json["amount"] == convert_and_quantitize(bank_account.amount)
    assert response_json["description"] == bank_account.description


def test__get__not_found(client):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND


def test__put(client, bank_account):
    # GIVEN
    data = {"amount": 100, "description": "BB"}

    # WHEN
    response = client.put(URL, data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    response_json = response.json()

    assert (
        response_json["amount"]
        == convert_and_quantitize(bank_account.amount)
        == convert_and_quantitize(data["amount"])
    )
    assert response_json["description"] == bank_account.description == data["description"]


@pytest.mark.usefixtures("bank_account")
def test__put__invalid(client):
    # GIVEN
    data = {"amount": 100}

    # WHEN
    response = client.put(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"description": ["This field is required."]}


def test__put__not_found(client):
    # GIVEN

    # WHEN
    response = client.put(URL)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
