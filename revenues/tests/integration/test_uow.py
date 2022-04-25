from decimal import Decimal

import pytest

from src.service_layer.unit_of_work import SqlModelUnitOfWork


def insert_revenue(session, value, description, user_id: int = 1):
    r = session.execute(
        """
        INSERT INTO revenues_revenue (user_id, value, description) 
        VALUES (:user_id, :value, :description)
        """,
        dict(user_id=user_id, value=float(value), description=description),
    )
    return r.lastrowid


def test_uow_can_retrieve_a_revenue(sql_session_factory):
    # GIVEN
    session = sql_session_factory()
    value = Decimal("100.0")
    description = "Revenue 01"

    pk = insert_revenue(session=session, value=value, description=description)
    session.commit()

    # WHEN
    with SqlModelUnitOfWork(user_id=1, session=session) as uow:
        revenue = uow.revenues.query.get(revenue_id=pk)

        # THEN
        assert revenue.value == value
        assert revenue.description == description
        assert revenue.created_at is None


def test_uow_rolls_back_by_default(sql_session_factory):
    # GIVEN
    session = sql_session_factory()

    # WHEN
    with SqlModelUnitOfWork(user_id=1, session=session):
        insert_revenue(session=session, value=Decimal("100.0"), description="Revenue 01")

    # THEN
    new_session = sql_session_factory()
    assert list(new_session.execute('SELECT * FROM "revenues_revenue"')) == []


def test_uow_rolls_back_on_error(sql_session_factory):
    # GIVEN
    session = sql_session_factory()

    class MyException(Exception):
        pass

    # WHEN
    with pytest.raises(MyException):
        with SqlModelUnitOfWork(user_id=1, session=session):
            insert_revenue(session=session, value=Decimal("100.0"), description="Revenue 01")
            raise MyException()

    # THEN
    new_session = sql_session_factory()
    assert list(new_session.execute('SELECT * FROM "revenues_revenue"')) == []
