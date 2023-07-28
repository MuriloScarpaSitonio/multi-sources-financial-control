import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL

from ..models import IntegrationSecret

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test__create__without_secrets(client):
    # GIVEN
    data = {"username": "murilo2", "email": "murilo2@gmail.com", "password": "1234"}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]


def test__create__with_cei_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "secrets": {"cpf": "75524399047"},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.cpf == data["secrets"]["cpf"]


def test__create__with_kucoin_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "secrets": {
            "kucoin_api_key": "test",
            "kucoin_api_secret": "test",
            "kucoin_api_passphrase": "test",
        },
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.kucoin_api_key == data["secrets"]["kucoin_api_key"]
    assert secrets.kucoin_api_secret == data["secrets"]["kucoin_api_secret"]
    assert secrets.kucoin_api_passphrase == data["secrets"]["kucoin_api_passphrase"]


@pytest.mark.parametrize(
    "data",
    (
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test", "kucoin_api_secret": "test"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test", "kucoin_api_passphrase": "str"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_secret": "test"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_secret": "test", "kucoin_api_passphrase": "test"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"kucoin_api_passphrase": "test"},
        },
    ),
)
def test__not_create__by_enforcing_kucoin_constraint(client, data):
    # GIVEN

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "secrets": {
            "kucoin": ["Todos os segredos da KuCoin devem ser nulos ou ter um valor válido."]
        }
    }


def test__create__with_binance_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "secrets": {"binance_api_key": "test", "binance_api_secret": "test"},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.binance_api_secret == data["secrets"]["binance_api_secret"]
    assert secrets.binance_api_key == data["secrets"]["binance_api_key"]


@pytest.mark.parametrize(
    "data",
    (
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"binance_api_key": "test"},
        },
        {
            "username": "murilo2",
            "email": "murilo2@gmail.com",
            "password": "1234",
            "secrets": {"binance_api_secret": "test"},
        },
    ),
)
def test__not_create__by_enforcing_binance_constraint(client, data):
    # GIVEN

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "secrets": {
            "binance": ["Todos os segredos da Binance devem ser nulos ou ter um valor válido."]
        }
    }


@pytest.mark.parametrize("cpf", ("1", "11111111111"))
def test__raise_error_invalid_cpf(client, cpf):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "secrets": {"cpf": cpf},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["CPF inválido"]}}


def test__validate_cpf_uniqueness(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "secrets": {"cpf": user.secrets.cpf},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["Um usuário com esse CPF já existe."]}}


def test__retrieve(client, user):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.json() == {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "has_binance_integration": False,
        "has_cei_integration": True,
        "has_kucoin_integration": False,
    }


def test__update(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "secrets": {"cpf": "75524399047"},
    }

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["email"] == user.email
    assert data["secrets"]["cpf"] == user.secrets.cpf


def test__partial_update(client, user):
    # GIVEN
    old_cpf = user.secrets.cpf
    data = {"email": "murilo2@gmail.com"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["email"] == user.email == "murilo2@gmail.com"
    assert old_cpf == user.secrets.cpf


def test__change_password(client, user):
    # GIVEN
    old_password = user.password
    data = {"old_password": "1X<ISRUkw+tuK", "new_password": "abcd", "new_password2": "abcd"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    user.refresh_from_db()
    assert response.status_code == HTTP_204_NO_CONTENT
    assert old_password != user.password


def test__change_password__diff_new(client, user):
    # GIVEN
    data = {"old_password": "1X<ISRUkw+tuK", "new_password": "abcd", "new_password2": "abcde"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"new_password": ["As senhas novas não são iguais"]}


def test__change_password__diff_old(client, user):
    # GIVEN
    data = {"old_password": "abcd", "new_password": "abcd", "new_password2": "abcd"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"old_password": ["A senha antiga está incorreta"]}


def test__change_password__validate_classes_in_config(client, user):
    # GIVEN
    data = {"old_password": "1X<ISRUkw+tuK", "new_password": "murilo", "new_password2": "murilo"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"non_field_errors": ["The password is too similar to the email."]}


def test__reset_password(client, user):
    # GIVEN
    from uuid import uuid4

    # WHEN
    response = client.get(f"{URL}/{user.pk}/reset_password")

    # THEN
    from django.contrib.auth.views import PasswordResetView
