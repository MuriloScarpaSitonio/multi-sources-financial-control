from typing import Optional
from sqlalchemy.orm.relationships import RelationshipProperty

from sqlmodel import Column, Field, ForeignKey, SQLModel, Relationship
from pydantic import SecretBytes


class IntegrationSecret(SQLModel, table=True):
    __tablename__ = "authentication_integrationsecret"

    id: int = Field(primary_key=True)
    cpf: Optional[str]
    cei_password: Optional[SecretBytes]
    kucoin_api_key: Optional[SecretBytes]
    kucoin_api_secret: Optional[SecretBytes]
    kucoin_api_passphrase: Optional[SecretBytes]
    binance_api_key: Optional[SecretBytes]
    binance_api_secret: Optional[SecretBytes]
    user: Optional["User"] = Relationship(back_populates="secrets")


class User(SQLModel, table=True):
    __tablename__ = "authentication_customuser"

    id: int = Field(primary_key=True)
    username: str
    secrets_id: Optional[int] = Field(
        default=None, foreign_key="authentication_integrationsecret.id"
    )
    secrets: Optional[IntegrationSecret] = Relationship(
        back_populates="user", sa_relationship_kwargs={"uselist": False}
    )
