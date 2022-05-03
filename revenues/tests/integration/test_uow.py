from datetime import datetime
from bson import Decimal128

from freezegun import freeze_time
import pytest

from src.domain.models import Revenue
from src.service_layer.unit_of_work import MongoUnitOfWork
from src.settings import COLLECTION_NAME, DATABASE_NAME


def insert_revenue(session, value, description, created_at, user_id: int = 1):
    result = session._client[DATABASE_NAME][COLLECTION_NAME].insert_one(
        {"user_id": user_id, "value": value, "description": description, "created_at": created_at}
    )
    return result.inserted_id


@freeze_time("2022-01-01")
def test_uow_can_retrieve_revenue(mongo_session):
    # GIVEN
    value = Decimal128("100.0")
    description = "Revenue 01"
    created_at = datetime.today()

    pk = insert_revenue(
        session=mongo_session, value=value, description=description, created_at=created_at
    )

    # WHEN
    with MongoUnitOfWork(user_id=1, session=mongo_session) as uow:
        revenue = uow.revenues.query.get(revenue_id=pk)

        # THEN
        assert revenue["value"] == value
        assert revenue["description"] == description
        assert revenue["created_at"] == created_at


@pytest.mark.skip("Mongo does not support transaction without replicasets")
def test_uow_rolls_back_by_default(mongo_session):
    # GIVEN
    value = Decimal128("100.0")
    description = "Revenue 01"

    # WHEN
    with MongoUnitOfWork(user_id=1, session=mongo_session) as uow:
        uow.revenues.add(revenue=Revenue(value=value, description=description))

    # THEN
    assert list(mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find()) == []


@pytest.mark.skip("Mongo does not support transaction without replicasets")
def test_uow_rolls_back_on_error(mongo_session):
    # GIVEN
    value = Decimal128("100.0")
    description = "Revenue 01"

    class MyException(Exception):
        pass

    # WHEN
    with pytest.raises(MyException):
        with MongoUnitOfWork(user_id=1, session=mongo_session) as uow:
            uow.revenues.add(revenue=Revenue(value=value, description=description))
            raise MyException()

    # THEN
    assert list(mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find()) == []
