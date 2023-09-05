from django.contrib.auth import get_user_model

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
)

from config.settings.base import BASE_API_URL

from ..models import IntegrationSecret

UserModel = get_user_model()
pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test__create__wo_secrets(api_client, mocker):
    # GIVEN
    m = mocker.patch("authentication.views.mailing.dispatch_activation_email")
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    user = UserModel.objects.get(email="murilo2@gmail.com")

    assert not user.is_active
    assert user.check_password(data["password"])
    assert m.call_args[1] == {"user": user}


def test__create__same_email(api_client, user):
    # GIVEN
    data = {"username": "murilo2", "email": user.email, "password": "1234", "password2": "1234"}

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"email": ["Um usuário com esse email já existe"]}


def test__create__same_username(api_client, user):
    # GIVEN
    data = {
        "username": user.username,
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED


@pytest.mark.parametrize("password_data", ({}, {"password": "5555"}, {"password2": "5555"}))
def test__create__wo_passwords(api_client, user, password_data):
    # GIVEN
    data = {"username": user.username, "email": "murilo2@gmail.com", **password_data}

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["A senha é obrigatória"]}


def test__create__diff_passwords(api_client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "5678",
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["As senhas não são iguais"]}


def test__create__validate_classes_in_config(api_client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "murilo",
        "password2": "murilo",
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["The password is too similar to the username."]}


def test__create__with_cei_secrets(api_client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": {"cpf": "75524399047"},
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.cpf == data["secrets"]["cpf"]


def test__create__with_kucoin_secrets(api_client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": {
            "kucoin_api_key": "test",
            "kucoin_api_secret": "test",
            "kucoin_api_passphrase": "test",
        },
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.kucoin_api_key == data["secrets"]["kucoin_api_key"]
    assert secrets.kucoin_api_secret == data["secrets"]["kucoin_api_secret"]
    assert secrets.kucoin_api_passphrase == data["secrets"]["kucoin_api_passphrase"]


@pytest.mark.parametrize(
    "secrets_data",
    (
        {"kucoin_api_key": "test"},
        {"kucoin_api_key": "test", "kucoin_api_secret": "test"},
        {"kucoin_api_key": "test", "kucoin_api_passphrase": "str"},
        {"kucoin_api_secret": "test"},
        {"kucoin_api_secret": "test", "kucoin_api_passphrase": "test"},
        {"kucoin_api_passphrase": "test"},
    ),
)
def test__not_create__by_enforcing_kucoin_constraint(api_client, secrets_data):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": secrets_data,
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "secrets": {
            "kucoin": ["Todos os segredos da KuCoin devem ser nulos ou ter um valor válido."]
        }
    }


def test__create__with_binance_secrets(api_client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": {"binance_api_key": "test", "binance_api_secret": "test"},
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["email"] == data["email"]

    secrets = IntegrationSecret.objects.get(user__email=data["email"])
    assert secrets.binance_api_secret == data["secrets"]["binance_api_secret"]
    assert secrets.binance_api_key == data["secrets"]["binance_api_key"]


@pytest.mark.parametrize(
    "secrets_data", ({"binance_api_key": "test"}, {"binance_api_secret": "test"})
)
def test__not_create__by_enforcing_binance_constraint(api_client, secrets_data):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": secrets_data,
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "secrets": {
            "binance": ["Todos os segredos da Binance devem ser nulos ou ter um valor válido."]
        }
    }


@pytest.mark.parametrize("cpf", ("1", "11111111111"))
def test__raise_error_invalid_cpf(api_client, cpf):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": {"cpf": cpf},
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["CPF inválido"]}}


def test__validate_cpf_uniqueness(api_client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "secrets": {"cpf": user.secrets.cpf},
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["Um usuário com esse CPF já existe"]}}


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


def test__retrieve__unauthorized(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


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


@pytest.mark.parametrize(
    "password_data", ({"password": "5555"}, {"password": "5555", "password2": "5555"})
)
def test__update__w_password(client, user, password_data):
    # GIVEN
    old_password = user.password
    data = {"username": "murilo2", "email": "murilo2@gmail.com", **password_data}

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert user.password == old_password


def test__update__unauthorized(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.put(f"{URL}/{user.pk}", data={})

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


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


@pytest.mark.parametrize(
    "password_data", ({"password": "5555"}, {"password": "5555", "password2": "5555"})
)
def test__partial_update__password(client, user, password_data):
    # GIVEN
    old_password = user.password

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=password_data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert user.password == old_password


def test__partial_update__unauthorized(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.patch(f"{URL}/{user.pk}", data={})

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


def test__change_password(client, user):
    # GIVEN
    old_password = user.password
    data = {"old_password": "1X<ISRUkw+tuK", "password": "abcd", "password2": "abcd"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    user.refresh_from_db()
    assert response.status_code == HTTP_204_NO_CONTENT
    assert old_password != user.password


def test__change_password__diff_new(client, user):
    # GIVEN
    data = {"old_password": "1X<ISRUkw+tuK", "password": "abcd", "password2": "abcde"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["As senhas não são iguais"]}


def test__change_password__diff_old(client, user):
    # GIVEN
    data = {"old_password": "abcd", "password": "abcd", "password2": "abcd"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"old_password": ["A senha antiga está incorreta"]}


def test__change_password__validate_classes_in_config(client, user):
    # GIVEN
    data = {"old_password": "1X<ISRUkw+tuK", "password": "murilo", "password2": "murilo"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["The password is too similar to the username."]}


def test__change_password__unauthorized(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.patch(f"{URL}/{user.pk}/change_password", data={})

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
