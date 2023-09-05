from datetime import timedelta
from time import sleep
from uuid import uuid4

from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_403_FORBIDDEN,
)

from config.settings.base import BASE_API_URL

from ..services.token_generator import generate_token_secrets

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "auth"


def test__forgot_password(api_client, user, mocker):
    # GIVEN
    m = mocker.patch("authentication.views.mailing.dispatch_reset_password_email")
    data = {"email": user.email}

    # WHEN
    response = api_client.post(f"{URL}/forgot_password", data=data)

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert m.call_args[1] == {"user": user}


def test__forgot_password_email__not_found(api_client, mocker):
    # GIVEN
    m = mocker.patch("authentication.views.mailing.dispatch_not_found_email")
    data = {"email": "user@gmail.com"}

    # WHEN
    response = api_client.post(f"{URL}/forgot_password", data=data)

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert m.call_args[1] == data


def test__reset_password(api_client, user):
    # GIVEN
    old_password = user.password
    token, uidb64 = generate_token_secrets(user=user)

    data = {"password": "12478-1rhy2e2314", "password2": "12478-1rhy2e2314", "token": token}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)

    # THEN
    user.refresh_from_db()
    assert response.status_code == HTTP_204_NO_CONTENT
    assert old_password != user.password

    # make sure can't use token twice
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)
    assert response.status_code == HTTP_400_BAD_REQUEST


def test__reset_password__wo_token(api_client, user):
    # GIVEN
    _, uidb64 = generate_token_secrets(user=user)
    data = {"password": "12478-1rhy2e2314", "password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"token": ["This field is required."]}


def test__reset_password__wrong_token(api_client, user):
    # GIVEN
    _, uidb64 = generate_token_secrets(user=user)
    data = {
        "password": "12478-1rhy2e2314",
        "password2": "12478-1rhy2e2314",
        "token": uuid4().hex,
    }

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"token": ["Token inválido"]}


def test__reset_password__wrong_uidb64(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uuid4().hex}", data={})

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__reset_password__token_expired(api_client, user, settings):
    # GIVEN
    settings.PASSWORD_RESET_TIMEOUT = 1
    token, uidb64 = generate_token_secrets(user=user)
    data = {"password": "12478-1rhy2e2314", "password2": "12478-1rhy2e2314", "token": token}
    sleep(2)

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"token": ["Token inválido"]}


def test__reset_password__validate_classes_in_config(api_client, user):
    # GIVEN
    token, uidb64 = generate_token_secrets(user=user)
    data = {"password": "murilo", "password2": "murilo", "token": token}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"password": ["The password is too similar to the username."]}


@pytest.mark.freeze_time("2023-09-01")
def test__activate_user(api_client, user, mocker):
    # GIVEN
    token, uidb64 = generate_token_secrets(user=user)
    mocker.patch(
        "authentication.services.stripe.create_customer",
        return_value=mocker.Mock(stripe_id="cus_217903"),
    )
    mocker.patch(
        "authentication.services.stripe.create_trial_subscription",
        return_value=mocker.Mock(stripe_id="sub_1N"),
    )

    # WHEN
    response = api_client.post(f"{URL}/activate_user/{uidb64}", data={"token": token})

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    user.refresh_from_db()
    assert user.is_active
    assert user.stripe_customer_id == "cus_217903"
    assert user.stripe_subscription_id == "sub_1N"
    assert user.subscription_ends_at == timezone.now() + timedelta(days=7)


def test__activate_user__wo_token(api_client, user):
    # GIVEN
    _, uidb64 = generate_token_secrets(user=user)
    data = {}

    # WHEN
    response = api_client.post(f"{URL}/activate_user/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"token": ["This field is required."]}


def test__activate_user__wrong_token(api_client, user):
    # GIVEN
    _, uidb64 = generate_token_secrets(user=user)
    data = {"token": uuid4().hex}

    # WHEN
    response = api_client.post(f"{URL}/activate_user/{uidb64}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"token": ["Token inválido"]}


def test__activate_user__wrong_uidb64(api_client, user):
    # GIVEN

    # WHEN
    response = api_client.post(f"{URL}/activate_user/{uuid4().hex}", data={})

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__activate_user__token_does_not_expire(api_client, user, settings, mocker):
    # GIVEN
    settings.PASSWORD_RESET_TIMEOUT = 1
    token, uidb64 = generate_token_secrets(user=user)
    mocker.patch(
        "authentication.services.stripe.create_customer",
        return_value=mocker.Mock(stripe_id="cus_217903"),
    )
    mocker.patch(
        "authentication.services.stripe.create_trial_subscription",
        return_value=mocker.Mock(stripe_id="sub_1N"),
    )
    sleep(2)

    # WHEN
    response = api_client.post(f"{URL}/activate_user/{uidb64}", data={"token": token})

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    user.refresh_from_db()
    assert user.is_active
