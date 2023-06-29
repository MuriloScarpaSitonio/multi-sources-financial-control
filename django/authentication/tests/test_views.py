import pytest

from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL
from ..models import IntegrationSecret


pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test_should_create_user_without_secrets(client):
    # GIVEN
    data = {"username": "murilo2", "password": "1234"}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["username"] == data["username"]


def test_should_create_user_with_cei_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
        "password": "1234",
        "secrets": {"cpf": "75524399047", "cei_password": "pass"},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["username"] == data["username"]

    secrets = IntegrationSecret.objects.get(user__username=data["username"])
    assert secrets.cpf == data["secrets"]["cpf"]
    assert secrets.cei_password == data["secrets"]["cei_password"]


@pytest.mark.parametrize(
    "data",
    (
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"cei_password": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"cpf": "75524399047"},
        },
    ),
)
def test_should_not_create_user_by_enforcing_cei_constraint(client, data):
    # GIVEN

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "secrets": {
            "cei": ["Tanto o CPF quanto a senha do CEI devem ser nulos ou ter um valor válido."]
        }
    }


def test_should_create_user_with_kucoin_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
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
    assert response.json()["username"] == data["username"]

    secrets = IntegrationSecret.objects.get(user__username=data["username"])
    assert secrets.kucoin_api_key == data["secrets"]["kucoin_api_key"]
    assert secrets.kucoin_api_secret == data["secrets"]["kucoin_api_secret"]
    assert secrets.kucoin_api_passphrase == data["secrets"]["kucoin_api_passphrase"]


@pytest.mark.parametrize(
    "data",
    (
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test", "kucoin_api_secret": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_key": "test", "kucoin_api_passphrase": "str"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_secret": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_secret": "test", "kucoin_api_passphrase": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"kucoin_api_passphrase": "test"},
        },
    ),
)
def test_should_not_create_user_by_enforcing_kucoin_constraint(client, data):
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


def test_should_create_user_with_binance_secrets(client):
    # GIVEN
    data = {
        "username": "murilo2",
        "password": "1234",
        "secrets": {"binance_api_key": "test", "binance_api_secret": "test"},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["username"] == data["username"]

    secrets = IntegrationSecret.objects.get(user__username=data["username"])
    assert secrets.binance_api_secret == data["secrets"]["binance_api_secret"]
    assert secrets.binance_api_key == data["secrets"]["binance_api_key"]


@pytest.mark.parametrize(
    "data",
    (
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"binance_api_key": "test"},
        },
        {
            "username": "murilo2",
            "password": "1234",
            "secrets": {"binance_api_secret": "test"},
        },
    ),
)
def test_should_not_create_user_by_enforcing_binance_constraint(client, data):
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
def test_should_raise_error_invalid_cpf(client, cpf):
    # GIVEN
    data = {"username": "murilo2", "password": "1234", "secrets": {"cpf": cpf}}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["CPF inválido"]}}


def test_should_validate_cpf_uniqueness(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "password": "1234",
        "secrets": {"cpf": user.secrets.cpf},
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"secrets": {"cpf": ["Um usuário com esse CPF já existe."]}}


def test_should_retrieve_user(client, user):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.json() == {
        "id": user.pk,
        "username": user.username,
        "has_binance_integration": False,
        "has_cei_integration": True,
        "has_kucoin_integration": False,
    }


def test_should_update_user(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "secrets": {"cpf": "75524399047", "cei_password": "pass"},
    }

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["username"] == user.username
    assert data["secrets"]["cpf"] == user.secrets.cpf
    assert data["secrets"]["cei_password"] == user.secrets.cei_password


def test_should_partial_update_user(client, user):
    # GIVEN
    old_cpf = user.secrets.cpf
    old_cei_password = user.secrets.cei_password
    data = {"username": "murilo2"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["username"] == user.username == "murilo2"
    assert old_cpf == user.secrets.cpf
    assert old_cei_password == user.secrets.cei_password
