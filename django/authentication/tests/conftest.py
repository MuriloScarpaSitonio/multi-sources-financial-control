from datetime import UTC, datetime, timezone

from django.conf import settings
from django.contrib.auth.hashers import make_password

import pytest
from factory.django import DjangoModelFactory
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from ..choices import SubscriptionStatus
from ..models import IntegrationSecret

default_subscription_ends_at = datetime(year=2999, month=12, day=31, tzinfo=UTC)
default_stripe_subscription_updated_at = datetime(year=2022, month=12, day=31, hour=13, tzinfo=UTC)


class UserFactory(DjangoModelFactory):
    class Meta:
        model = settings.AUTH_USER_MODEL

    password = make_password("1X<ISRUkw+tuK")
    is_active = True
    is_personal_finances_module_enabled = True
    is_investments_module_enabled = True
    is_investments_integrations_module_enabled = True
    subscription_ends_at = default_subscription_ends_at
    subscription_status = SubscriptionStatus.TRIALING
    stripe_subscription_updated_at = default_stripe_subscription_updated_at
    credit_card_bill_day = 5


class IntegrationSecretFactory(DjangoModelFactory):
    class Meta:
        model = IntegrationSecret


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def secrets():
    return IntegrationSecretFactory(cpf="93804358004")


@pytest.fixture
def user(secrets):
    return UserFactory(email="murilo@gmail.com", username="murilo", secrets=secrets)


@pytest.fixture
def client(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def another_secrets():
    return IntegrationSecretFactory(cpf="52245911040")


@pytest.fixture
def another_user(another_secrets):
    return UserFactory(email="murilo2@gmail.com", username="murilo2", secrets=another_secrets)


@pytest.fixture
def another_client(another_user):
    refresh = RefreshToken.for_user(another_user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def refresh_token(user):
    return RefreshToken.for_user(user)


@pytest.fixture
def kucoin_secrets():
    return IntegrationSecretFactory(
        kucoin_api_key="test", kucoin_api_secret="test", kucoin_api_passphrase="test"
    )


@pytest.fixture
def user_with_kucoin_integration(kucoin_secrets):
    return UserFactory(username="kucoin_user", secrets=kucoin_secrets)


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
    return UserFactory(username="binance_user", secrets=binance_secrets)


@pytest.fixture
def binance_client(user_with_binance_integration):
    refresh = RefreshToken.for_user(user_with_binance_integration)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def stripe_customer_id():
    return "cus_21847"


@pytest.fixture
def stripe_subscription_id():
    return "sub_23ef"


@pytest.fixture
def stripe_secret_key():
    return "2904709237"


@pytest.fixture
def stripe_settings(settings, stripe_secret_key):
    settings.STRIPE_SECRET_KEY = stripe_secret_key


@pytest.fixture
def stripe_user(user, stripe_customer_id, stripe_subscription_id):
    user.stripe_customer_id = stripe_customer_id
    user.stripe_subscription_id = stripe_subscription_id
    user.save()
    return user
