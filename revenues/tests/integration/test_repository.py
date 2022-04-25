from datetime import date
from decimal import Decimal
from random import randint
from statistics import fmean

from dateutil.relativedelta import relativedelta
from src.adapters.repository import SqlModelCommandRepository
from src.domain.models import Revenue


def test_repository_add(sqlite_session):
    # GIVEN
    user_id = 1
    value = Decimal("100.0")
    description = "Revenue 01"
    repo = SqlModelCommandRepository(user_id=user_id, session=sqlite_session)
    rev = Revenue(value=value, description=description)

    # WHEN
    repo.add(rev)
    sqlite_session.commit()

    # THEN
    assert dict(sqlite_session.execute('SELECT * FROM "revenues_revenue"').first()) == {
        "id": rev.id,
        "value": float(value),
        "description": description,
        "created_at": str(date.today()),
        "user_id": user_id,
    }


def test_repository_list(sqlite_session):
    # GIVEN
    user_id = 1
    repo = SqlModelCommandRepository(user_id=user_id, session=sqlite_session)
    rev1 = Revenue(value=Decimal("100.0"), description="Revenue 01")
    rev2 = Revenue(value=Decimal("100.0"), description="Revenue 02")

    # WHEN
    repo.add(rev1)
    repo.add(rev2)
    sqlite_session.commit()

    # THEN
    assert repo.query.list().all() == [rev1, rev2]


def test_repository_delete(sqlite_session):
    # GIVEN
    user_id = 1
    repo = SqlModelCommandRepository(user_id=user_id, session=sqlite_session)
    rev = Revenue(value=Decimal("100.0"), description="Revenue 01")

    # WHEN
    repo.add(rev)
    sqlite_session.commit()

    # THEN
    assert repo.delete(revenue_id=rev.id) == 1
    assert sqlite_session.execute('SELECT * FROM "revenues_revenue"').first() is None


def test_repository_historic(sqlite_session):
    # GIVEN
    repo = SqlModelCommandRepository(user_id=1, session=sqlite_session)

    one_year_before = date.today() - relativedelta(years=1)
    date_revenues_sum_map = {}
    for i in range(25):
        d = one_year_before + relativedelta(months=i)
        rev1 = Revenue(value=randint(100, 10000), description="Revenue", created_at=d)
        rev2 = Revenue(value=randint(100, 10000), description="Revenue", created_at=d)
        date_revenues_sum_map[f"{d.month}/{d.year}"] = rev1.value + rev2.value
        repo.add(rev1)
        repo.add(rev2)

    sqlite_session.commit()

    # WHEN
    historic = repo.query.historic()

    # THEN
    for infos in historic:
        assert date_revenues_sum_map[infos["date"]] == infos["total"]


def test_repository_indicators(sqlite_session):
    # GIVEN
    repo = SqlModelCommandRepository(user_id=1, session=sqlite_session)

    today = date.today()
    one_year_before = today - relativedelta(years=1)
    date_revenues_sum_map = {}
    for i in range(25):
        d = one_year_before + relativedelta(months=i)
        rev1 = Revenue(value=randint(100, 10000), description="Revenue", created_at=d)
        rev2 = Revenue(value=randint(100, 10000), description="Revenue", created_at=d)
        if 0 <= i <= 12:
            date_revenues_sum_map[f"{d.month}/{d.year}"] = rev1.value + rev2.value
        repo.add(rev1)
        repo.add(rev2)

    sqlite_session.commit()

    # WHEN
    avg = fmean(date_revenues_sum_map.values())
    indicators = repo.query.indicators()

    # THEN
    assert indicators["month"] == today.month
    assert indicators["year"] == today.year
    assert indicators["avg"] == avg
    assert indicators["diff"] == (
        (date_revenues_sum_map[f"{today.month}/{today.year}"] / Decimal(avg)) - Decimal("1.0")
    ) * Decimal("100.0")


def test_repository_indicators_if_no_revenue_in_the_current_month(sqlite_session):
    # GIVEN
    pass

    # WHEN

    # THEN
