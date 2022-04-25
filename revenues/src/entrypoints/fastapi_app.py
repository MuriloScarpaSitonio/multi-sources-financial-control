from decimal import Decimal
from typing import Iterator, List
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from sqlmodel import Session, SQLModel
from fastapi_pagination import Page, add_pagination
from fastapi_pagination.ext.sqlalchemy import paginate

from ..adapters import orm
from ..adapters.repository import HistoricResponseType, IndicatorsResponseType
from ..domain.commands import CreateRevenue
from ..domain.models import Revenue
from ..domain.utils import generate_pydantic_model
from ..service_layer import messagebus
from ..service_layer.unit_of_work import SqlModelUnitOfWork

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
    orm.create_tables()
    orm.start_mappers()


def get_session() -> Iterator[Session]:  # pragma: no cover
    with Session(orm.engine) as session:
        yield session


def get_user_id() -> int:
    return 1


@app.get("/indicators/", response_model=IndicatorsResponseType)
def revenue_indicators_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.query.indicators()


@app.get("/historic/", response_model=List[HistoricResponseType])
def revenue_historic_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.query.historic()


RevenueReadModel = generate_pydantic_model(
    Revenue, __base__=SQLModel, default_field_definitions={"id": (int, ...)}
)


@app.get("/revenues/{revenue_id}", response_model=RevenueReadModel)
def get_revenue_endpoint(
    revenue_id: int, user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        revenue = uow.revenues.query.get(revenue_id=revenue_id)
        if revenue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")
        # else:
        #     # without `__dict__` we get `sqlalchemy.orm.exc.DetachedInstanceError`
        #     # we also can't return directly because we get a strange
        #     # `pydantic.error_wrappers.ValidationError` for `id`, `value` and `description`
        #     revenue = revenue.__dict__

        return {
            "id": revenue.id,
            "value": revenue.value,
            "description": revenue.description,
            "created_at": revenue.created_at,
        }


@app.get("/revenues/", response_model=Page[RevenueReadModel])
def list_revenue_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return paginate(uow.revenues.query.list())


@app.delete("/revenues/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revenue_endpoint(
    revenue_id: int, user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        result = uow.revenues.delete(revenue_id=revenue_id)
        uow.commit()
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")


RevenueWriteModel = generate_pydantic_model(
    Revenue, __base__=SQLModel, model_name_suffix="PydanticWriteModel"
)


@app.post("/revenues/", status_code=status.HTTP_204_NO_CONTENT)
def create_revenue_endpoint(
    revenue: RevenueWriteModel,
    user_id: int = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    messagebus.handle(
        message=CreateRevenue(**revenue.dict()),
        uow=SqlModelUnitOfWork(user_id=user_id, session=session),
    )


add_pagination(app)

# TODO: onde emitir `RevenueCreated`?
