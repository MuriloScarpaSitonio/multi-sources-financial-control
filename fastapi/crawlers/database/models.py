from typing import Optional

from sqlmodel import Field, SQLModel
from pydantic import SecretBytes


class User(SQLModel, table=True):
    __tablename__ = "authentication_customuser"

    id: int = Field(primary_key=True)
    username: str
    cpf: str
    cei_password: SecretBytes
