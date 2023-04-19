from abc import ABC, abstractmethod, abstractproperty
from datetime import date, datetime
from decimal import Decimal, DecimalException
from typing import Any, Dict, Iterable, List, Literal, Optional, Set, Type, Union
from typing_extensions import TypedDict
from bson import Decimal128, ObjectId
from pydantic import BaseModel, validator

from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.client_session import ClientSession as MongoSession
from pymongo.collection import Collection
from pymongo.cursor import Cursor

from ..adapters.mongo import mongo, RevenueMongoDoc as RevenueMongoDocType
from ..domain.events import RevenueCreated
from ..domain.models import Revenue
from ..settings import COLLECTION_NAME, DATABASE_NAME

# region: types


class RevenueMongoDoc(RevenueMongoDocType):
    _id: ObjectId
    user_id: int


class HistoricResponseType(TypedDict):
    date: str  # mm/yyyy
    total: Decimal


class IndicatorsResponseType(TypedDict):
    avg: Decimal
    total: Decimal
    diff: Decimal
    year: Optional[int]
    month: Optional[int]


# endregion: types

# region: abstract classes
class AbstractQueryFilter(BaseModel, ABC):
    user_id: int
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort: Optional[Literal["value", "-value", "created_at", "-created_at"]] = None

    @abstractproperty
    def base_filter(self) -> Any:
        raise NotImplementedError

    @abstractmethod
    def resolve(self) -> Any:
        raise NotImplementedError


class AbstractQueryRepository(ABC):
    filter_class: Type[AbstractQueryFilter]

    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id
        self.filters = self.filter_class(user_id=user_id)

    @abstractmethod
    def get(self, revenue_id: ObjectId) -> Optional[RevenueMongoDoc]:  # pragma: no cover
        raise NotImplementedError

    def list(
        self,
        description: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sort: Optional[str] = None,
    ) -> Iterable[Revenue]:
        self.filters = self.filter_class(
            user_id=self.user_id,
            description=description,
            start_date=start_date,
            end_date=end_date,
            sort=sort,
        )
        return self._list()

    @abstractmethod  # pragma: no cover
    def _list(self) -> Iterable[Revenue]:
        raise NotImplementedError

    @abstractmethod
    def historic(self):  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def indicators(self) -> IndicatorsResponseType:  # pragma: no cover
        raise NotImplementedError


class AbstractCommandRepository(ABC):
    query: AbstractQueryRepository

    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id
        self.seen: Set[Revenue] = set()

    def add(self, revenue: Revenue) -> None:
        _id = self._add(revenue=revenue)
        revenue.id = _id
        revenue.events.append(RevenueCreated(value=revenue.value, description=revenue.description))
        self.seen.add(revenue)

    @abstractmethod
    def _add(self, revenue: Revenue) -> ObjectId:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def delete(self, revenue_id: ObjectId) -> int:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def update(self, revenue_id: ObjectId, revenue: Revenue):  # pragma: no cover
        raise NotImplementedError


# endregion: abstract classes


# region: repository classes


class RevenuesMongoFilter(AbstractQueryFilter):
    @property
    def base_filter(self) -> Dict[str, int]:
        return {"user_id": self.user_id}

    @validator("description")
    def convert_description(cls, v: Optional[str]) -> Optional[Dict[str, str]]:
        return {"$regex": mongo._convert(v), "$options": "i"} if v is not None else v

    @validator("start_date")
    def convert_start_date(cls, v: Optional[date]) -> Optional[Dict[str, datetime]]:
        return {"$gte": mongo._convert(v)} if v is not None else v

    @validator("end_date")
    def convert_end_date(cls, v: Optional[date]) -> Optional[Dict[str, datetime]]:
        return {"$lte": mongo._convert(v)} if v is not None else v

    def resolve(self) -> Dict[str, Union[str, Dict[str, Union[str, datetime]]]]:
        result = self.dict(exclude_none=True, exclude={"sort"})
        date_filters = {**result.pop("start_date", {}), **result.pop("end_date", {})}
        filters = {**self.base_filter, **result}
        return {"created_at": date_filters, **filters} if date_filters else filters


class MongoQueryRepository(AbstractQueryRepository):
    filter_class = RevenuesMongoFilter

    def __init__(self, *, user_id: int, session: MongoSession) -> None:
        super().__init__(user_id=user_id)
        self.session = session
        self._collection: Collection = self.session._client[DATABASE_NAME][COLLECTION_NAME]
        self._today = date.today()

    @property
    def _historic_pipeline(self) -> List[Dict[str, str]]:
        return [
            {"$match": self.filters.base_filter},
            {
                "$group": {
                    "_id": {
                        "month": {
                            "$month": {"$dateTrunc": {"date": "$created_at", "unit": "month"}}
                        },
                        "year": {"$year": {"$dateTrunc": {"date": "$created_at", "unit": "year"}}},
                    },
                    "total": {"$sum": "$value"},
                }
            },
            {
                "$match": {
                    "$or": [
                        {
                            "$and": [
                                {"_id.month": {"$gte": self._today.month}},
                                {"_id.year": {"$eq": self._today.year - 1}},
                            ]
                        },
                        {
                            "$and": [
                                {"_id.month": {"$lte": self._today.month}},
                                {"_id.year": {"$eq": self._today.year}},
                            ]
                        },
                    ]
                }
            },
        ]

    def get(self, revenue_id: ObjectId) -> Optional[RevenueMongoDoc]:
        return self._collection.find_one(filter={"_id": revenue_id, **self.filters.base_filter})

    def _list(self) -> Cursor:
        sort = self.filters.sort or "-_id"
        return self._collection.find(filter=self.filters.resolve()).sort(
            sort.lstrip("-"), direction=DESCENDING if sort.startswith("-") else ASCENDING
        )

    def count(self) -> int:
        return self._collection.count_documents(filter=self.filters.resolve())

    def historic(self) -> List[HistoricResponseType]:
        cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$sort": {"_id.year": ASCENDING, "_id.month": ASCENDING}},
            ]
        )
        # TODO: do this at DB level
        return [
            {
                "date": f"{doc['_id']['month']}/{doc['_id']['year']}",
                "total": doc["total"].to_decimal(),
            }
            for doc in cursor
        ]

    def avg(self) -> Cursor:
        return self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {
                    "$match": {
                        "$or": [
                            {"_id.month": {"$ne": self._today.month}},
                            {"_id.year": {"$ne": self._today.year}},
                        ]
                    }
                },
                {"$group": {"_id": 0, "avg": {"$avg": "$total"}}},
                {"$project": {"_id": 0, "avg": {"$ifNull": ["$avg", Decimal128("0.0")]}}},
            ]
        )

    def indicators(self) -> IndicatorsResponseType:
        # region: Last month total query
        last_month_total_cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$sort": {"_id.year": DESCENDING, "_id.month": DESCENDING}},
                {
                    "$project": {
                        "month": "$_id.month",
                        "year": "$_id.year",
                        "_id": 0,
                        "total": 1,
                    }
                },
            ]
        )
        # endregion: Last month total query

        # region: Calculate percentage
        try:
            avg = self.avg().next()["avg"].to_decimal()
        except StopIteration:
            avg = Decimal()

        try:
            last_month_total_dict = last_month_total_cursor.next()
        except StopIteration:
            last_month_total_dict = {"total": Decimal128("0.0")}
        total = last_month_total_dict["total"].to_decimal()

        try:
            percentage = ((total / avg) - Decimal("1.0")) * Decimal("100.0")
        except DecimalException:
            percentage = Decimal()
        # endregion: Calculate percentage

        return {
            "avg": avg,
            "total": total,
            "diff": percentage,
            "year": last_month_total_dict.get("year"),
            "month": last_month_total_dict.get("month"),
        }


class MongoCommandRepository(AbstractCommandRepository):
    def __init__(self, *, user_id: int, session: MongoSession) -> None:
        super().__init__(user_id=user_id)
        self.session = session
        self.query = MongoQueryRepository(user_id=user_id, session=session)
        self._collection: Collection = self.session._client[DATABASE_NAME][COLLECTION_NAME]

    def _add(self, revenue: Revenue) -> ObjectId:
        return self._collection.insert_one(
            {**mongo.convert_revenue(revenue=revenue), **self.query.filters.base_filter}
        ).inserted_id

    def delete(self, revenue_id: ObjectId) -> int:
        result = self._collection.delete_one(
            filter={"_id": revenue_id, **self.query.filters.base_filter}
        )
        return result.deleted_count

    def update(self, revenue_id: ObjectId, revenue: Revenue) -> Optional[RevenueMongoDoc]:
        return self._collection.find_one_and_update(
            filter={"_id": revenue_id, **self.query.filters.base_filter},
            update={"$set": mongo.convert_revenue(revenue=revenue)},
            return_document=ReturnDocument.AFTER,
        )


# endregion: repository classes
