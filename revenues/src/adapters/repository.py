from abc import ABC, abstractmethod
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Set
from typing_extensions import TypedDict
from bson import Decimal128, ObjectId

from pymongo import ASCENDING, DESCENDING
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


class HistoricResponseType(TypedDict):
    date: str  # mm/yyyy
    total: Decimal


class IndicatorsResponseType(TypedDict):
    avg: Decimal
    total: Decimal
    diff: Decimal
    year: int
    month: int


# endregion: types

# region: abstract classes


class AbstractQueryRepository(ABC):
    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id

    @abstractmethod
    def get(self, revenue_id: int) -> Optional[RevenueMongoDoc]:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def list(self) -> Iterable[Revenue]:  # pragma: no cover
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
    def delete(self, revenue_id: int) -> int:  # pragma: no cover
        raise NotImplementedError


# endregion: abstract classes


# region: repository classes


class MongoQueryRepository(AbstractQueryRepository):
    def __init__(self, *, user_id: int, session: MongoSession) -> None:
        super().__init__(user_id=user_id)
        self.session = session
        self._collection: Collection = self.session._client[DATABASE_NAME][COLLECTION_NAME]

    @property
    def _historic_pipeline(self) -> List[Dict[str, str]]:
        today = date.today()
        return [
            {"$match": {"user_id": self.user_id}},
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
                                {"_id.month": {"$gte": today.month}},
                                {"_id.year": {"$eq": today.year - 1}},
                            ]
                        },
                        {
                            "$and": [
                                {"_id.month": {"$lte": today.month}},
                                {"_id.year": {"$eq": today.year}},
                            ]
                        },
                    ]
                }
            },
        ]

    def get(self, revenue_id: int) -> Optional[RevenueMongoDoc]:
        return self._collection.find_one(filter={"_id": revenue_id})

    def list(self) -> Cursor:
        return self._collection.find(filter={"user_id": self.user_id}).sort(
            "created_at", direction=DESCENDING
        )

    def count(self) -> int:
        return self._collection.count_documents(filter={"user_id": self.user_id})

    def historic(self) -> List[HistoricResponseType]:
        cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$sort": {"_id.year": ASCENDING, "_id.month": ASCENDING}},
            ]
        )
        # TODO: do this at the DB level
        return [
            {"date": f"{doc['_id']['month']}/{doc['_id']['year']}", "total": doc["total"]}
            for doc in cursor
        ]

    def indicators(self) -> IndicatorsResponseType:
        today = date.today()

        # region: Avg query
        avg_cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$group": {"_id": 0, "avg": {"$avg": "$total"}}},
                {"$project": {"_id": 0}},
            ]
        )
        # endregion: Avg query

        # region: Last month total query
        last_month_total_cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$sort": {"_id.year": ASCENDING, "_id.month": DESCENDING}},
                {
                    "$match": {
                        "_id.month": {"$in": [today.month - 1, today.month]},
                        "_id.year": today.year,
                    }
                },
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
        avg = next(avg_cursor)["avg"].to_decimal()
        last_month_total_dict = next(last_month_total_cursor)
        total = last_month_total_dict["total"].to_decimal()
        percentage = ((total / avg) - Decimal("1.0")) * Decimal("100.0")
        # endregion: Calculate percentage

        return {
            "avg": avg,
            "total": last_month_total_dict["total"],
            "diff": percentage,
            "year": last_month_total_dict["year"],
            "month": last_month_total_dict["month"],
        }


class MongoCommandRepository(AbstractCommandRepository):
    def __init__(self, *, user_id: int, session: MongoSession) -> None:
        super().__init__(user_id=user_id)
        self.session = session
        self.query = MongoQueryRepository(user_id=user_id, session=session)
        self._collection: Collection = self.session._client[DATABASE_NAME][COLLECTION_NAME]

    def _add(self, revenue: Revenue) -> ObjectId:
        return self._collection.insert_one(
            mongo.convert_to_mongo_doc(revenue=revenue, user_id=self.user_id)
        ).inserted_id

    def delete(self, revenue_id: int) -> int:
        result = self._collection.delete_one(filter={"_id": revenue_id, "user_id": self.user_id})
        return result.deleted_count


# endregion: repository classes
