import pytest
from factory.django import DjangoModelFactory

from django.conf import settings
from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import IntegrationSecret


class UserFactory(DjangoModelFactory):
    class Meta:
        model = settings.AUTH_USER_MODEL

    password = make_password("1X<ISRUkw+tuK")
    is_active = True


class IntegrationSecretFactory(DjangoModelFactory):
    class Meta:
        model = IntegrationSecret


@pytest.fixture
def secrets():
    return IntegrationSecretFactory(cpf="93804358004", cei_password="password")


@pytest.fixture
def user(secrets):
    return UserFactory(username="murilo", secrets=secrets)


@pytest.fixture
def client(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client
