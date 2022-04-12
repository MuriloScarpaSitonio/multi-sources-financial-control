from typing import Any, Dict, Iterator, Optional, Tuple, Type
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import create_model

from sqlmodel import Session, SQLModel
from fastapi_pagination import Page, add_pagination
from fastapi_pagination.ext.sqlalchemy import paginate

from ..adapters import orm
from ..domain.commands import CreateRevenue as CreateRevenueCommand
from ..domain.models import Revenue
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
def on_startup():
    orm.create_tables()
    orm.start_mappers()


def get_session() -> Iterator[Session]:
    with Session(orm.engine) as session:
        yield session


def get_user_id() -> int:
    return 1


def generate_response_model(
    clas: Type[Any],
    default_field_definitions: Optional[Dict[str, Tuple[type, Any]]] = None,
    model_name_suffix: str = "ReadModel",
) -> Type[SQLModel]:
    field_definitions = default_field_definitions if default_field_definitions is not None else {}
    for name, annotation in clas.__init__.__annotations__.items():
        field_definitions[name] = (annotation, clas.__init__.__kwdefaults__.get(name, ...))
    new_class = create_model(
        clas.__name__ + model_name_suffix, __base__=SQLModel, **field_definitions
    )
    return new_class


RevenueReadModel = generate_response_model(Revenue, default_field_definitions={"id": (int, ...)})


@app.get("/indicators/")
def revenue_indicators_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.indicators()


@app.get("/historic/")
def revenue_indicators_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return uow.revenues.historic()


@app.get("/revenues/{revenue_id}", response_model=RevenueReadModel)
def get_revenue_endpoint(
    revenue_id: int, user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        revenue = uow.revenues.get(revenue_id=revenue_id)
        if revenue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")
        return revenue


@app.get("/revenues/", response_model=Page[RevenueReadModel])
def list_revenue_endpoint(
    user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        return paginate(uow.revenues.list())


@app.delete("/revenues/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revenue_endpoint(
    revenue_id: int, user_id: int = Depends(get_user_id), session: Session = Depends(get_session)
):
    with SqlModelUnitOfWork(user_id=user_id, session=session) as uow:
        result = uow.revenues.delete(revenue_id=revenue_id)
        uow.commit()
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revenue not found")


RevenueWriteModel = generate_response_model(Revenue, model_name_suffix="WriteModel")


@app.post("/revenues/")
def create_revenue_endpoint(
    revenue: RevenueWriteModel,
    user_id: int = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    cmd = CreateRevenueCommand(user_id=user_id, **revenue.dict())
    messagebus.handle(cmd, SqlModelUnitOfWork(session=session))


add_pagination(app)
