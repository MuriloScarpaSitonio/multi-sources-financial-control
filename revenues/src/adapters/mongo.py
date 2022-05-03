from datetime import datetime
from typing import Optional
from typing_extensions import TypedDict
from bson import Decimal128, ObjectId

from pymongo import MongoClient
from pymongo.cursor import Cursor

from ..domain.models import Revenue

# region: types


class RevenueMongoDoc(TypedDict):
    description: str
    value: Decimal128
    created_at: datetime
    user_id: int


# endregion: types


class Mongo:
    client: Optional[MongoClient] = None

    @staticmethod
    def paginate(cursor: Cursor, total: int, page: int, size: int):
        return {
            "items": list(cursor.skip((page - 1) * size).limit(size)),
            "total": total,
            "page": page,
            "size": size,
        }

    @staticmethod
    def convert_to_mongo_doc(revenue: Revenue, user_id: int) -> RevenueMongoDoc:
        return {
            "user_id": user_id,
            "value": Decimal128(str(revenue.value)),
            "description": revenue.description,
            # mongo does not suppor `date` types
            "created_at": datetime.combine(revenue.created_at, datetime.min.time()),
        }


mongo = Mongo()


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)
