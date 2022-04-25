from sqlmodel import (
    Column,
    create_engine,
    Date,
    Field,
    ForeignKey,
    Integer,
    Numeric,
    SQLModel,
    String,
    Table,
)
from sqlalchemy.orm import mapper

from ..settings import DATABASE_URL
from ..domain.models import Revenue


class User(SQLModel, table=True):
    __tablename__ = "authentication_customuser"

    id: int = Field(primary_key=True)
    username: str


revenues = Table(
    "revenues_revenue",
    SQLModel.metadata,
    Column("id", Integer, primary_key=True),
    Column("value", Numeric(precision=2, scale=10)),
    Column("description", String(300)),
    Column("created_at", Date()),
    Column("user_id", ForeignKey("authentication_customuser.id")),
)


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def start_mappers() -> None:
    mapper(Revenue, revenues)


def create_tables() -> None:  # pragma: no cover
    SQLModel.metadata.create_all(engine)
