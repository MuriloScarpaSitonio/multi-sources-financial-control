from datetime import date as date_typing
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status

from sqlmodel import Session, SQLModel
from cei_crawler.models import AssetExtract, PassiveIncome

from .database import engine
from .responses import NotFoundResponse
from .utils import CeiCrawler
from .database.crud import get_user

app = FastAPI()


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


def get_db() -> Session:
    with Session(engine) as session:
        yield session


@app.get(
    "/cei/assets",
    response_model=AssetExtract,
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def get_assets_extract(
    username: str,
    start_date: Optional[date_typing] = None,
    end_date: Optional[date_typing] = None,
    db: Session = Depends(get_db),
):
    user = await get_user(username=username, db=db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    crawler = CeiCrawler(user=user)
    return await crawler.get_assets(start_date=start_date, end_date=end_date)


@app.get(
    "/passive_incomes",
    response_model=PassiveIncome,
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def get_passive_incomes_extract(
    username: str,
    date: Optional[date_typing] = None,
    db: Session = Depends(get_db),
):
    user = await get_user(username=username, db=db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    crawler = CeiCrawler(user=user)
    return await crawler.get_passive_incomes(date=date)
