from time import sleep
from uuid import uuid4

from django.contrib.auth.views import (
    INTERNAL_RESET_SESSION_TOKEN,
    PasswordResetConfirmView,
)

import pytest
from rest_framework.status import (
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from config.settings.base import BASE_API_URL

from ..utils import generate_reset_password_secrets

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "auth"


def test__dispatch_reset_password_email(api_client, user, mocker):
    # GIVEN
    m = mocker.patch("authentication.views.dispatch_reset_password_email")
    data = {"email": user.email}

    # WHEN
    response = api_client.post(f"{URL}/dispatch_reset_password_email", data=data)

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert m.call_args[1] == {"user": user}


def test__dispatch_reset_password_email__not_found(api_client, mocker):
    # GIVEN
    m = mocker.patch("authentication.views.dispatch_not_found_email")
    data = {"email": "user@gmail.com"}

    # WHEN
    response = api_client.post(f"{URL}/dispatch_reset_password_email", data=data)

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert m.call_args[1] == data


def test__reset_password__e2e(api_client, user):
    # region: GET
    # GIVEN
    old_password = user.password
    token, uidb64 = generate_reset_password_secrets(user=user)

    # WHEN
    response = api_client.get(f"{URL}/reset_password/{uidb64}/{token}")

    # THEN
    assert (
        response.url == f"{URL}/reset_password/{uidb64}/{PasswordResetConfirmView.reset_url_token}"
    )
    assert response.wsgi_request.session[INTERNAL_RESET_SESSION_TOKEN] == token

    # endregion: GET

    # region: POST
    # GIVEN
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(response.url, data=data)

    # THEN
    user.refresh_from_db()
    assert response.status_code == HTTP_204_NO_CONTENT
    assert old_password != user.password

    # endregion: POST


def test__reset_password__post__wo_session_token(api_client, user):
    # GIVEN
    old_password = user.password
    token, uidb64 = generate_reset_password_secrets(user=user)
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}/{token}", data=data)

    # THEN
    user.refresh_from_db()
    assert response.status_code == HTTP_204_NO_CONTENT
    assert old_password != user.password


def test__reset_password__wo_token_in_session(api_client, user):
    # GIVEN
    _, uidb64 = generate_reset_password_secrets(user=user)
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(
        f"{URL}/reset_password/{uidb64}/{PasswordResetConfirmView.reset_url_token}", data=data
    )

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__reset_password__wrong_token(api_client, user):
    # GIVEN
    _, uidb64 = generate_reset_password_secrets(user=user)
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}/{uuid4().hex}", data=data)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__reset_password__wrong_uidb64(api_client, user):
    # GIVEN
    token, _ = generate_reset_password_secrets(user=user)
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uuid4().hex}/{token}", data=data)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__reset_password__token_expired(api_client, user, settings):
    # GIVEN
    settings.PASSWORD_RESET_TIMEOUT = 1
    token, uidb64 = generate_reset_password_secrets(user=user)
    data = {"new_password": "12478-1rhy2e2314", "new_password2": "12478-1rhy2e2314"}
    sleep(2)

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}/{token}", data=data)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


def test__reset_password__validate_classes_in_config(api_client, user):
    # GIVEN
    token, uidb64 = generate_reset_password_secrets(user=user)
    data = {"new_password": "murilo", "new_password2": "murilo"}

    # WHEN
    response = api_client.post(f"{URL}/reset_password/{uidb64}/{token}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"new_password": ["The password is too similar to the email."]}
