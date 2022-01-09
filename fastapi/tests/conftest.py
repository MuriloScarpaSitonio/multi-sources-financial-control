from copy import deepcopy
import os
from typing import Dict, Union

import factory
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlmodel import SQLModel

from crawlers.database import Base
from crawlers.database.models import User
from crawlers.main import app, get_db


engine = create_engine(
    "sqlite:///./db.sqlite3", connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SQLModel.metadata.create_all(engine)


class UserFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = User


@pytest.fixture(scope="module")
def test_db() -> Session:
    db = TestingSessionLocal()
    yield db
    db.close()
    SQLModel.metadata.drop_all(bind=engine)


@pytest.fixture
def client(test_db: Session) -> TestClient:
    def override_db():
        return test_db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def user(test_db: Session) -> User:
    UserFactory._meta.sqlalchemy_session = test_db
    user_factory = UserFactory(username="murilo", cpf="12408678080")

    test_db.add(user_factory)
    test_db.commit()
    test_db.refresh(user_factory)
    return user_factory
