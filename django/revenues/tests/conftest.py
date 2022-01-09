from random import randint, choice
from datetime import date

import pytest
from factory.django import DjangoModelFactory

from authentication.tests.conftest import client, secrets, user
from revenues.models import Revenue


class RevenueFactory(DjangoModelFactory):
    class Meta:
        model = Revenue


@pytest.fixture
def revenue(user):
    return RevenueFactory(
        value=5000,
        description="Revenue",
        created_at=date(2021, 1, 1),
        user=user,
    )


@pytest.fixture
def revenues(user):
    for i in range(1, 13):
        RevenueFactory(
            value=randint(5000, 20000),
            description=f"Revenue {i}",
            created_at=date(2021, i, 1),
            user=user,
        )
