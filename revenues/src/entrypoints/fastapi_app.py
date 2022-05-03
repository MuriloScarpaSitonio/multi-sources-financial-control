from typing import Generic, Iterator, List, Sequence, TypeVar

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from bson.objectid import ObjectId
from pydantic import conint, Field
from pydantic.generics import GenericModel
from pymongo import MongoClient
from pymongo.client_session import ClientSession as MongoSession

from ..adapters.mongo import mongo, PyObjectId
from ..adapters.repository import HistoricResponseType, IndicatorsResponseType
from ..domain.commands import CreateRevenue
from ..domain.models import Revenue
from ..domain.utils import generate_pydantic_model
from ..service_layer import messagebus
from ..service_layer.unit_of_work import MongoUnitOfWork
from ..settings import DATABASE_URL

# region: app definitions

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=("http://localhost:3000",),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():  # pragma: no cover
    mongo.client = MongoClient(host=DATABASE_URL)


@app.on_event("shutdown")
def on_startup():  # pragma: no cover
    mongo.client.close()


# endregion: app definitions

# region: typing

RevenueReadModel = generate_pydantic_model(
    Revenue, default_field_definitions={"id": (PyObjectId, Field(alias="_id"))}
)
RevenueReadModel.Config.json_encoders = {ObjectId: lambda oid: str(oid)}

T = TypeVar("T")


class Page(GenericModel, Generic[T]):
    items: Sequence[T]
    total: conint(ge=0)  # type: ignore
    page: conint(ge=1)  # type: ignore
    size: conint(ge=1)  # type: ignore


# endregion: typing

# region: dependencies


def get_session() -> Iterator[MongoSession]:  # pragma: no cover
    with mongo.client.start_session() as session:
        yield session


def get_user_id() -> int:
    return 1


# endregion: dependencies

# region: endpoints


@app.get("/historic/", response_model=List[HistoricResponseType])
def revenue_historic_endpoint(
    user_id: int = Depends(get_user_id), session: MongoSession = Depends(get_session)
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.query.historic()


@app.get("/indicators/", response_model=IndicatorsResponseType)
def revenue_indicators_endpoint(
    user_id: int = Depends(get_user_id), session: MongoSession = Depends(get_session)
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.query.indicators()


@app.get("/revenues/{revenue_id}", response_model=RevenueReadModel)
def get_revenue_endpoint(
    revenue_id: PyObjectId,
    user_id: int = Depends(get_user_id),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        revenue = uow.revenues.query.get(revenue_id=revenue_id)
        if revenue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")

        return revenue


@app.get("/revenues/", response_model=Page[RevenueReadModel])
def list_revenue_endpoint(
    user_id: int = Depends(get_user_id),
    session: MongoSession = Depends(get_session),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        cursor = uow.revenues.query.list()
        return mongo.paginate(cursor=cursor, total=uow.revenues.query.count(), page=page, size=size)


@app.delete("/revenues/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revenue_endpoint(
    revenue_id: PyObjectId,
    user_id: int = Depends(get_user_id),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        result = uow.revenues.delete(revenue_id=revenue_id)
        uow.commit()
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")


@app.post("/revenues/", status_code=status.HTTP_204_NO_CONTENT)
async def create_revenue_endpoint(
    revenue: CreateRevenue,
    user_id: int = Depends(get_user_id),
    session: MongoSession = Depends(get_session),
):
    messagebus.handle(message=revenue, uow=MongoUnitOfWork(user_id=user_id, session=session))


# endregion: endpoints
