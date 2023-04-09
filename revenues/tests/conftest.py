from datetime import datetime
from decimal import Decimal
from random import randint
from typing import Tuple
import pytest

from dateutil import relativedelta
from fastapi.testclient import TestClient
from mongomock import MongoClient as MockedMongoClient

from src.adapters.mongo import mongo
from src.entrypoints.fastapi_app import app
from src.domain.models import Revenue
from src.settings import COLLECTION_NAME, DATABASE_NAME, SECRET_KEY


@pytest.fixture
def mongo_client():
    class CustomMockedMongoClient(MockedMongoClient):
        def start_session(self, **_):
            class Session:
                def __init__(self, client) -> None:
                    self._client = client

                def __enter__(self):
                    return self

                def __exit__(self, *_, **__):
                    pass

            return Session(client=self)

    return CustomMockedMongoClient()


@pytest.fixture
def mongo_session(mongo_client):
    with mongo_client.start_session() as s:
        yield s


@pytest.fixture
def user_id():
    return 1


@pytest.fixture
def _client(mongo_client):
    mongo.client = mongo_client
    return TestClient(app)


@pytest.fixture
def client(_client, user_id):
    _client.headers.update({"user-id": str(user_id), "x-key": SECRET_KEY})
    return _client


@pytest.fixture
def revenue(mongo_session, user_id):
    rev = Revenue(value=Decimal("100.0"), description="Revenue 01")
    result = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].insert_one(
        {**mongo.convert_revenue(revenue=rev), "user_id": user_id}
    )
    rev.id = result.inserted_id
    return rev


@pytest.fixture
def revenues(mongo_session, revenue, user_id) -> Tuple[Revenue, Revenue]:
    rev = Revenue(value=Decimal("200.0"), description="Revenue 02")
    result = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].insert_one(
        {**mongo.convert_revenue(revenue=rev), "user_id": user_id}
    )
    rev.id = result.inserted_id
    return revenue, rev


@pytest.fixture
def historic_data(mongo_session, user_id):
    today = datetime.utcnow().date()
    revenues = (
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 02",
            created_at=today - relativedelta.relativedelta(months=13),
        ),
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 03",
            created_at=today - relativedelta.relativedelta(months=12),
        ),
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 04",
            created_at=today - relativedelta.relativedelta(months=1),
        ),
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 05",
            created_at=today - relativedelta.relativedelta(months=2),
        ),
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 06",
            created_at=today - relativedelta.relativedelta(months=8),
        ),
        Revenue(
            value=Decimal(randint(500, 10000)),
            description="Revenue 07",
            created_at=today - relativedelta.relativedelta(months=7),
        ),
    )
    result = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].insert_many(
        [{**mongo.convert_revenue(revenue=rev), "user_id": user_id} for rev in revenues]
    )
    for rev, inserted_id in zip(revenues, result.inserted_ids):
        rev.id = inserted_id
    return revenues
