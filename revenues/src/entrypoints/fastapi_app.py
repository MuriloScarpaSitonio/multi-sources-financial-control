from datetime import date
from decimal import Decimal
from typing import Generic, Iterator, List, Optional, Sequence, TypeVar, Union

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.responses import PlainTextResponse

from bson.objectid import ObjectId
from pydantic import BaseModel, conint, Field
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
from ..settings import DATABASE_URL, SECRET_KEY

# region: dependencies


def get_session() -> Iterator[MongoSession]:  # pragma: no cover
    with mongo.client.start_session() as session:
        yield session


async def verify_key(x_key: str = Header(...)) -> None:
    if x_key != SECRET_KEY:
        raise HTTPException(status_code=400, detail="X-Key header invalid")


# endregion: dependencies

# region: app definitions

app = FastAPI(dependencies=[Depends(verify_key)])


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


class HistoricResponse(BaseModel):
    historic: List[HistoricResponseType]
    avg: Decimal


# endregion: typing

# region: endpoints


@app.get("/revenues/reports/historic", response_model=HistoricResponse)
def revenue_historic_endpoint(
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        return {"historic": uow.revenues.query.historic(), **uow.revenues.query.avg().next()}


@app.get("/revenues/reports/indicators", response_model=IndicatorsResponseType)
def revenue_indicators_endpoint(
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.query.indicators()


@app.get("/revenues/{revenue_id}", response_model=RevenueReadModel)
def get_revenue_endpoint(
    revenue_id: PyObjectId,
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        revenue = uow.revenues.query.get(revenue_id=revenue_id)
        if revenue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")

        return revenue


@app.get("/revenues", response_model=Page[RevenueReadModel])
def list_revenues_endpoint(
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=5, ge=1, le=100),
    description: Optional[str] = None,
    start_date: Union[date, None, str] = None,
    end_date: Union[date, None, str] = None,
):
    # fastapi considers a query param equals to `?start_date=` as an empty string
    # so this endpoint would return "422 Unprocessable Entity" for `date` params.
    # NOTE: for a bigger project, consider using a middleware
    start_date = start_date or None
    end_date = end_date or None
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        cursor = uow.revenues.query.list(
            description=description, start_date=start_date, end_date=end_date
        )
        return mongo.paginate(cursor=cursor, total=uow.revenues.query.count(), page=page, size=size)


@app.delete(
    "/revenues/{revenue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=PlainTextResponse,
)
def delete_revenue_endpoint(
    revenue_id: PyObjectId,
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        result = uow.revenues.delete(revenue_id=revenue_id)
        uow.commit()
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")


@app.post("/revenues", status_code=status.HTTP_202_ACCEPTED)
async def create_revenue_endpoint(
    data: CreateRevenue,
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    messagebus.handle(message=data, uow=MongoUnitOfWork(user_id=user_id, session=session))


@app.patch("/revenues/{revenue_id}", response_model=RevenueReadModel)
async def update_revenue_endpoint(
    revenue_id: PyObjectId,
    data: CreateRevenue,
    user_id: int = Header(...),
    session: MongoSession = Depends(get_session),
):
    with MongoUnitOfWork(user_id=user_id, session=session) as uow:
        result = uow.revenues.update(revenue_id=revenue_id, revenue=Revenue(**data.dict()))
        uow.commit()
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")
        return result


# endregion: endpoints
