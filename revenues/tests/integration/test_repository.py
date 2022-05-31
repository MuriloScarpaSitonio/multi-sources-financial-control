from datetime import date, datetime
from decimal import Decimal
from random import randint
from statistics import fmean
from bson import Decimal128

from dateutil.relativedelta import relativedelta
from pymongo.collection import ReturnDocument
import pytest

from src.adapters.repository import MongoCommandRepository
from src.domain.models import Revenue
from src.settings import COLLECTION_NAME, DATABASE_NAME


def test_repository_add(mongo_session):
    # GIVEN
    user_id = 1
    value = Decimal128("100.0")
    description = "Revenue 01"
    repo = MongoCommandRepository(user_id=user_id, session=mongo_session)
    rev = Revenue(value=value.to_decimal(), description=description)

    # WHEN
    repo.add(rev)

    # THEN
    result = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find_one(projection={"_id": 0})
    assert result == {
        "value": value,
        "description": description,
        "created_at": datetime.today().replace(hour=0, minute=0, second=0, microsecond=0),
        "user_id": user_id,
    }


def test_repository_list(mongo_session):
    # GIVEN
    user_id = 1
    repo = MongoCommandRepository(user_id=user_id, session=mongo_session)
    rev1 = Revenue(value=Decimal("100.0"), description="Revenue 01")
    rev2 = Revenue(value=Decimal("150.0"), description="Revenue 02")

    # WHEN
    repo.add(rev1)
    repo.add(rev2)

    # THEN
    assert list(repo.query.list()) == [
        {
            "_id": rev1.id,
            "value": Decimal128(rev1.value),
            "description": rev1.description,
            "created_at": datetime.today().replace(hour=0, minute=0, second=0, microsecond=0),
            "user_id": user_id,
        },
        {
            "_id": rev2.id,
            "value": Decimal128(rev2.value),
            "description": rev2.description,
            "created_at": datetime.today().replace(hour=0, minute=0, second=0, microsecond=0),
            "user_id": user_id,
        },
    ]


@pytest.mark.parametrize(
    "filters, count",
    (
        ({"description": "des"}, 1),
        ({"description": "REV"}, 1),
        ({"start_date": date(year=2022, month=4, day=12)}, 1),
        ({"end_date": date(year=2022, month=4, day=12)}, 1),
        (
            {
                "start_date": date(year=2022, month=4, day=12),
                "end_date": date(year=2022, month=4, day=12),
            },
            0,
        ),
        (
            {
                "start_date": date(year=2022, month=4, day=1),
                "end_date": date(year=2022, month=5, day=12),
            },
            2,
        ),
        (
            {
                "start_date": date(year=2022, month=5, day=1),
                "end_date": date(year=2022, month=5, day=12),
            },
            1,
        ),
        (
            {
                "start_date": date(year=2022, month=5, day=11),
                "end_date": date(year=2022, month=5, day=12),
            },
            0,
        ),
        (
            {
                "start_date": date(year=2022, month=5, day=1),
                "end_date": date(year=2022, month=4, day=12),
            },
            0,
        ),
    ),
)
def test_repository_filters(mongo_session, filters, count):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)
    rev1 = Revenue(
        value=Decimal("100.0"),
        description="Description",
        created_at=date(year=2022, month=4, day=1),
    )
    rev2 = Revenue(
        value=Decimal("150.0"), description="Revenue", created_at=date(year=2022, month=5, day=1)
    )

    # WHEN
    repo.add(rev1)
    repo.add(rev2)

    # THEN
    assert len(list(repo.query.list(**filters))) == count


def test_repository_delete(mongo_session):
    # GIVEN
    user_id = 1
    repo = MongoCommandRepository(user_id=user_id, session=mongo_session)
    rev = Revenue(value=Decimal("100.0"), description="Revenue 01")

    # WHEN
    repo.add(rev)

    # THEN
    assert repo.delete(revenue_id=rev.id) == 1
    assert list(mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find()) == []


def test_repository_historic(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    one_year_before = date.today() - relativedelta(years=1)
    date_revenues_sum_map = {}
    for i in range(25):
        d = one_year_before + relativedelta(months=i)
        rev1 = Revenue(value=Decimal(str(randint(100, 10000))), description="Revenue", created_at=d)
        rev2 = Revenue(value=Decimal(str(randint(100, 10000))), description="Revenue", created_at=d)
        date_revenues_sum_map[f"{d.month}/{d.year}"] = rev1.value + rev2.value
        repo.add(rev1)
        repo.add(rev2)

    # WHEN
    historic = repo.query.historic()

    # THEN
    for infos in historic:
        assert date_revenues_sum_map[infos["date"]] == infos["total"].to_decimal()


def test_repository_historic_without_revenues(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    # WHEN
    historic = repo.query.historic()

    # THEN
    assert historic == []


def test_repository_indicators(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    today = date.today()
    one_year_before = today - relativedelta(years=1)
    date_revenues_sum_map = {}
    for i in range(25):
        d = one_year_before + relativedelta(months=i)
        rev1 = Revenue(value=Decimal(str(randint(100, 10000))), description="Revenue", created_at=d)
        rev2 = Revenue(value=Decimal(str(randint(100, 10000))), description="Revenue", created_at=d)
        if 0 <= i <= 12:
            date_revenues_sum_map[f"{d.month}/{d.year}"] = rev1.value + rev2.value
        repo.add(rev1)
        repo.add(rev2)

    # WHEN
    avg = Decimal(str(fmean(date_revenues_sum_map.values()))).quantize(Decimal("0.000001"))
    indicators = repo.query.indicators()

    # THEN
    assert indicators["month"] == today.month
    assert indicators["year"] == today.year
    assert indicators["avg"].quantize(Decimal("0.000001")) == avg
    percentage = (
        (date_revenues_sum_map[f"{today.month}/{today.year}"] / avg) - Decimal("1.0")
    ) * Decimal("100.0")
    assert indicators["diff"].quantize(Decimal("0.000001")) == percentage.quantize(
        Decimal("0.000001")
    )


def test_repository_indicators_if_no_revenue_in_the_current_month(mongo_session, revenue):
    # GIVEN
    doc = mongo_session._client[DATABASE_NAME][COLLECTION_NAME].find_one_and_update(
        filter={},
        update={
            "$set": {
                "created_at": datetime.combine(
                    revenue.created_at - relativedelta(months=7), datetime.min.time()
                )
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    # WHEN
    indicators = repo.query.indicators()

    # THEN
    assert indicators["year"] == doc["created_at"].year
    assert indicators["month"] == doc["created_at"].month


def test_repository_indicators_without_revenues(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    # WHEN
    indicators = repo.query.indicators()

    # THEN
    assert indicators == {
        "avg": Decimal("0.0"),
        "total": Decimal("0.0"),
        "diff": Decimal("0.0"),
        "year": None,
        "month": None,
    }


@pytest.mark.usefixtures("revenues")
def test_repository_count(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    # WHEN
    count = repo.query.count()

    # THEN
    assert count == 2


def test_repository_count_without_revenues(mongo_session):
    # GIVEN
    repo = MongoCommandRepository(user_id=1, session=mongo_session)

    # WHEN
    count = repo.query.count()

    # THEN
    assert count == 0
