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
def user_without_assets_price_integration(user):
    user.has_asset_price_integration = False
    user.save()
    return user


@pytest.fixture
def client(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def kucoin_secrets():
    return IntegrationSecretFactory(
        kucoin_api_key="test", kucoin_api_secret="test", kucoin_api_passphrase="test"
    )


@pytest.fixture
def user_with_kucoin_integration(kucoin_secrets):
    return UserFactory(
        username="kucoin_user", has_asset_price_integration=False, secrets=kucoin_secrets
    )


@pytest.fixture
def kucoin_client(user_with_kucoin_integration):
    refresh = RefreshToken.for_user(user_with_kucoin_integration)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def binance_secrets():
    return IntegrationSecretFactory(binance_api_key="test", binance_api_secret="test")


@pytest.fixture
def user_with_binance_integration(binance_secrets):
    return UserFactory(
        username="binance_user", has_asset_price_integration=False, secrets=binance_secrets
    )


@pytest.fixture
def binance_client(user_with_binance_integration):
    refresh = RefreshToken.for_user(user_with_binance_integration)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client
