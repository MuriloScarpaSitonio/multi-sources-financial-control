import pytest
from rest_framework.status import HTTP_204_NO_CONTENT, HTTP_404_NOT_FOUND

from config.settings.base import BASE_API_URL


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


def test__dispatch_reset_password_email_not_found(api_client):
    # GIVEN
    data = {"email": "user@gmail.com"}

    # WHEN
    response = api_client.post(f"{URL}/dispatch_reset_password_email", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND


def test__reset_password(api_client):
    # GIVEN
    from uuid import uuid4

    # WHEN
    response = api_client.get(f"{URL}/reset_password/{uuid4().hex}/{uuid4().hex}")

    # THEN
    print(response)
