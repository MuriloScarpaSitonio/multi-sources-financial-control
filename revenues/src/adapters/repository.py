from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal, DecimalException
from typing import Dict, Iterable, List, Optional, Set
from typing_extensions import TypedDict
from bson import Decimal128, ObjectId

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


class AbstractQueryRepository(ABC):
    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id

    @abstractmethod
    def get(self, revenue_id: ObjectId) -> Optional[RevenueMongoDoc]:  # pragma: no cover
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
    def delete(self, revenue_id: ObjectId) -> int:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def update(self, revenue_id: ObjectId, revenue: Revenue):
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

    def get(self, revenue_id: ObjectId) -> Optional[RevenueMongoDoc]:
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
        # region: Avg query
        avg_cursor = self._collection.aggregate(
            pipeline=[
                *self._historic_pipeline,
                {"$group": {"_id": 0, "avg": {"$avg": "$total"}}},
                {"$project": {"_id": 0, "avg": {"$ifNull": ["$avg", Decimal128("0.0")]}}},
            ]
        )
        # endregion: Avg query

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
        avg = avg_cursor.next()["avg"].to_decimal()
        try:
            last_month_total_dict = last_month_total_cursor.next()
        except StopIteration:
            last_month_total_dict = {"total": Decimal128("0.0")}
        total = last_month_total_dict["total"].to_decimal()
        try:
            percentage = ((total / avg) - Decimal("1.0")) * Decimal("100.0")
        except DecimalException:
            percentage = Decimal("0.0")
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
            {**mongo.convert_revenue(revenue=revenue), "user_id": self.user_id}
        ).inserted_id

    def delete(self, revenue_id: ObjectId) -> int:
        result = self._collection.delete_one(filter={"_id": revenue_id, "user_id": self.user_id})
        return result.deleted_count

    def update(self, revenue_id: ObjectId, revenue: Revenue) -> Optional[RevenueMongoDoc]:
        return self._collection.find_one_and_update(
            filter={"_id": revenue_id, "user_id": self.user_id},
            update={"$set": mongo.convert_revenue(revenue=revenue)},
            return_document=ReturnDocument.AFTER,
        )


# endregion: repository classes
