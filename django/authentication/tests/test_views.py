import pytest

from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL
from ..models import CustomUser


pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test_should_create_user(client):
    # GIVEN
    data = {"username": "murilo2", "password": "1234"}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["username"] == data["username"]


@pytest.mark.parametrize("cpf", ("1", "11111111111"))
def test_should_raise_error_invalid_cpf(client, cpf):
    # GIVEN
    data = {"username": "murilo2", "password": "1234", "cpf": cpf}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"cpf": ["CPF inválido"]}


def test_should_validate_cpf_uniqueness(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "password": "1234",
        "cpf": user.cpf,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"cpf": ["user with this cpf already exists."]}


def test_should_retrieve_user(client, user):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.json() == {
        "id": user.pk,
        "username": user.username,
        "cpf": user.cpf,
        "cei_password": user.cei_password,
    }


def test_should_update_user(client, user):
    # GIVEN
    data = {"username": "murilo2", "cpf": "75524399047", "cei_password": "pass"}

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["username"] == user.username
    assert response.json()["cpf"] == user.cpf
    assert response.json()["cei_password"] == user.cei_password


def test_should_partial_update_user(client, user):
    # GIVEN
    old_cpf = user.cpf
    old_cei_password = user.cei_password
    data = {"username": "murilo2"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["username"] == user.username
    assert response.json()["cpf"] == old_cpf == user.cpf
    assert response.json()["cei_password"] == old_cei_password == user.cei_password
