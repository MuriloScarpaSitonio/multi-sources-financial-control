import pytest
from factory.django import DjangoModelFactory

from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.models import CustomUser


class UserFactory(DjangoModelFactory):
    class Meta:
        model = CustomUser

    password = make_password("1X<ISRUkw+tuK")
    is_active = True


@pytest.fixture
def user():
    return UserFactory(username="murilo", cpf="93804358004", cei_password="password")


@pytest.fixture
def client(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client
