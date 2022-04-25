from decimal import Decimal
from typing import Tuple
import pytest

from factory.alchemy import SQLAlchemyModelFactory
from fastapi.testclient import TestClient
from sqlmodel import SQLModel
from sqlalchemy import create_engine
from sqlalchemy.orm import clear_mappers, sessionmaker

from src.adapters.orm import start_mappers
from src.entrypoints.fastapi_app import app, get_session
from src.domain.models import Revenue


class RevenueFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Revenue


@pytest.fixture
def in_memory_db():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def sql_session_factory(in_memory_db):
    start_mappers()
    yield sessionmaker(bind=in_memory_db)
    clear_mappers()


@pytest.fixture
def sqlite_session(sql_session_factory):
    return sql_session_factory()


@pytest.fixture
def fastapi_db():
    engine = create_engine("sqlite:///testdb.sqlite3", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def fastapi_sql_session_factory(fastapi_db):
    start_mappers()
    yield sessionmaker(bind=fastapi_db)
    clear_mappers()
    SQLModel.metadata.drop_all(fastapi_db)


@pytest.fixture
def fastapi_sqlite_session(fastapi_sql_session_factory):
    return fastapi_sql_session_factory()


@pytest.fixture
def client(fastapi_sqlite_session):
    def override_session():
        return fastapi_sqlite_session

    app.dependency_overrides[get_session] = override_session

    return TestClient(app)


@pytest.fixture
def revenue(fastapi_sqlite_session) -> RevenueFactory:
    RevenueFactory._meta.sqlalchemy_session = fastapi_sqlite_session
    rev = RevenueFactory(value=Decimal("100.0"), description="Revenue 01")
    rev.user_id = 1
    fastapi_sqlite_session.add(rev)
    fastapi_sqlite_session.commit()
    fastapi_sqlite_session.refresh(rev)
    return rev


@pytest.fixture
def revenues(fastapi_sqlite_session, revenue) -> Tuple[RevenueFactory, RevenueFactory]:
    rev = RevenueFactory(value=Decimal("200.0"), description="Revenue 02")
    rev.user_id = 1
    fastapi_sqlite_session.add(rev)
    fastapi_sqlite_session.commit()
    fastapi_sqlite_session.refresh(rev)
    return revenue, rev
