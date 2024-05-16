from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
)

from config.settings.base import BASE_API_URL

from ..choices import SubscriptionStatus
from ..models import IntegrationSecret
from .conftest import default_stripe_subscription_updated_at

UserModel = get_user_model()
pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "users"


def test__create(api_client, mocker):
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
    assert not user.is_personal_finances_module_enabled
    assert not user.is_investments_module_enabled
    assert not user.is_investments_integrations_module_enabled
    assert not user.credit_card_bill_day
    assert user.check_password(data["password"])
    assert m.call_args.kwargs == {"user": user}


def test__create__do_not_set_readonly_fields(api_client, mocker):
    # GIVEN
    mocker.patch("authentication.views.mailing.dispatch_activation_email")
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "is_personal_finances_module_enabled": True,
        "is_investments_module_enabled": True,
        "is_investments_integrations_module_enabled": True,
        "subscription_ends_at": "2999-12-31",
        "subscription_status": SubscriptionStatus.ACTIVE,
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    user = UserModel.objects.get(email=data["email"])
    assert not user.is_active
    assert not user.is_personal_finances_module_enabled
    assert not user.is_investments_module_enabled
    assert not user.is_investments_integrations_module_enabled
    assert user.subscription_ends_at is None
    assert user.subscription_status == SubscriptionStatus.INACTIVE


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


def test__create__validate_classes_in_config(api_client):
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
def test__create__invalid_cpf(api_client, cpf):
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


def test__create__validate_cpf_uniqueness(api_client, user):
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


def test__create__credit_card_bill_day(api_client):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "credit_card_bill_day": 5,
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    user = UserModel.objects.get(email=data["email"])
    assert user.credit_card_bill_day == 5


@pytest.mark.parametrize("day", (-1, 0, 32))
def test__create__credit_card_bill_day__invalid(api_client, day):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "password": "1234",
        "password2": "1234",
        "credit_card_bill_day": day,
    }

    # WHEN
    response = api_client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST


def test__retrieve(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.localtime() + timedelta(days=1)
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.json() == {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "subscription_status": SubscriptionStatus.TRIALING,
        "has_binance_integration": False,
        "has_cei_integration": True,
        "has_kucoin_integration": False,
        "is_personal_finances_module_enabled": True,
        "is_investments_module_enabled": True,
        "is_investments_integrations_module_enabled": True,
        "trial_will_end_message": "O período de testes termina em 23 hora(s)",
        "stripe_subscription_updated_at": timezone.localtime(
            default_stripe_subscription_updated_at
        ).isoformat(),
        "credit_card_bill_day": 5,
    }


def test__retrieve__unauthorized(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED


def test__not_found__other_user(client, user_with_binance_integration):
    # GIVEN

    # WHEN
    response = client.put(f"{URL}/{user_with_binance_integration.pk}", data={"name": "test"})

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND


def test__update(client, user):
    # GIVEN
    data = {
        "username": "murilo2",
        "email": "murilo2@gmail.com",
        "secrets": {"cpf": "75524399047"},
        "credit_card_bill_day": 10,
    }

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["email"] == user.email
    assert data["secrets"]["cpf"] == user.secrets.cpf
    assert data["credit_card_bill_day"] == user.credit_card_bill_day


@pytest.mark.parametrize(
    "password_data", ({"password": "5555"}, {"password": "5555", "password2": "5555"})
)
def test__update__do_not_set_password(client, user, password_data):
    # GIVEN
    old_password = user.password
    data = {"username": "murilo2", "email": "murilo2@gmail.com", **password_data}

    # WHEN
    response = client.put(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert user.password == old_password


def test__partial_update(client, user):
    # GIVEN
    old_cpf = user.secrets.cpf
    data = {
        "email": "murilo2@gmail.com",
        "is_personal_finances_module_enabled": False,
        "is_investments_module_enabled": False,
        "is_investments_integrations_module_enabled": False,
        "subscription_ends_at": None,
        "subscription_status": SubscriptionStatus.ACTIVE,
        "credit_card_bill_day": 4,
    }

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert response.json()["email"] == user.email == "murilo2@gmail.com"
    assert old_cpf == user.secrets.cpf
    assert user.is_personal_finances_module_enabled
    assert user.is_investments_module_enabled
    assert user.is_investments_integrations_module_enabled
    assert user.subscription_ends_at is not None
    assert user.subscription_status == SubscriptionStatus.TRIALING
    assert data["credit_card_bill_day"] == user.credit_card_bill_day


@pytest.mark.parametrize(
    "password_data", ({"password": "5555"}, {"password": "5555", "password2": "5555"})
)
def test__partial_update__do_not_set_password(client, user, password_data):
    # GIVEN
    old_password = user.password

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=password_data)

    # THEN
    assert response.status_code == HTTP_200_OK

    user.refresh_from_db()
    assert user.password == old_password


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


def test__change_password__diff__new(client, user):
    # GIVEN
    data = {"old_password": "1X<ISRUkw+tuK", "password": "abcd", "password2": "abcde"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}/change_password", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["As senhas não são iguais"]}


def test__change_password__diff__old(client, user):
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


def test__change_password__not_found(client, user_with_binance_integration):
    # GIVEN

    # WHEN
    response = client.patch(f"{URL}/{user_with_binance_integration.pk}/change_password", data={})

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
