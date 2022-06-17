from decimal import Decimal
from typing import Tuple
import pytest

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
