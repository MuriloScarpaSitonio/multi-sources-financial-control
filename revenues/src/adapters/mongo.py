from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Dict, Optional, Type, Union
from typing_extensions import TypedDict
from bson import Decimal128, ObjectId

from pymongo import MongoClient
from pymongo.cursor import Cursor

from ..domain.models import Revenue

# region: types

PY_MONGO_COVERSION_MAP: Dict[Type[Any], Dict[str, Union[Type[Any], Callable[[Any], Any]]]] = {
    Decimal: {"type": Decimal128},
    date: {"type": datetime, "func": lambda v: datetime.combine(v, datetime.min.time())},
}


def create_revenue_mongo_typed_doc_class():
    class RevenueMongoDocType(TypedDict):
        pass

    for name, annotation in Revenue.__init__.__annotations__.items():
        RevenueMongoDocType.__annotations__[name] = PY_MONGO_COVERSION_MAP.get(annotation, {}).get(
            "func", annotation
        )
    return RevenueMongoDocType


RevenueMongoDoc = create_revenue_mongo_typed_doc_class()
# endregion: types


class Mongo:
    client: Optional[MongoClient] = None

    @classmethod
    def _convert(cls, raw_value: Any) -> Any:
        mongo_conversion_infos = PY_MONGO_COVERSION_MAP.get(raw_value.__class__)
        if mongo_conversion_infos is None:
            return raw_value

        mongo_type_conversion_func = mongo_conversion_infos.get("func")
        if mongo_type_conversion_func is None:
            return mongo_conversion_infos["type"](raw_value)
        return mongo_type_conversion_func(raw_value)

    @staticmethod
    def paginate(cursor: Cursor, total: int, page: int, size: int):
        return {
            "items": list(cursor.skip((page - 1) * size).limit(size)),
            "total": total,
            "page": page,
            "size": size,
        }

    @classmethod
    def convert_revenue(cls, revenue: Revenue) -> RevenueMongoDoc:
        return {k: cls._convert(v) for k, v in revenue.__dict__.items() if k != "events"}


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
