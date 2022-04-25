from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal
from typing import Iterable, List, Optional, Set, Union
from typing_extensions import TypedDict

from sqlmodel import Session
from sqlalchemy import and_, desc, extract, func
from sqlalchemy.orm.query import Query

from ..domain.events import RevenueCreated
from ..domain.models import Revenue


# region: types


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
    def get(self, revenue_id: int) -> Revenue:  # pragma: no cover
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


# endregion: abstract classes


# region: repository classes


class AbstractCommandRepository(ABC):
    query: AbstractQueryRepository

    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id
        self.seen: Set[Revenue] = set()

    def add(self, revenue: Revenue) -> None:
        revenue.user_id = self.user_id
        self._add(revenue=revenue)
        revenue.events.append(RevenueCreated(value=revenue.value, description=revenue.description))
        self.seen.add(revenue)

    @abstractmethod
    def _add(self, revenue: Revenue) -> None:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def delete(self, revenue_id: int) -> int:  # pragma: no cover
        raise NotImplementedError


class SqlModelQueryRepository(AbstractQueryRepository):
    def __init__(self, *, user_id: int, session: Session) -> None:
        super().__init__(user_id=user_id)
        self.session = session

    def get(self, revenue_id: int) -> Optional[Revenue]:
        return self.session.query(Revenue).filter_by(id=revenue_id, user_id=self.user_id).first()

    def list(self) -> Query:
        return (
            self.session.query(Revenue).filter_by(user_id=self.user_id).order_by(desc("created_at"))
        )

    def historic(self, as_query: bool = False) -> Union[Query, List[HistoricResponseType]]:
        today = date.today()
        qs = (
            self.session.query(
                extract("year", Revenue.created_at).label("year"),
                extract("month", Revenue.created_at).label("month"),
                func.sum(Revenue.value).label("total"),
            )
            .filter(
                and_(
                    extract("month", Revenue.created_at) >= today.month,
                    extract("year", Revenue.created_at) == today.year - 1,
                )
                | and_(
                    extract("month", Revenue.created_at) <= today.month,
                    extract("year", Revenue.created_at) == today.year,
                ),
            )
            .filter_by(user_id=self.user_id)
            .group_by("year", "month")
            .order_by("year", "month")
        )
        if as_query:
            return qs

        # TODO: do this via the ORM
        # NOTE: SQLite does not have a `concat` func
        results = []
        for row in qs:
            d = dict(row)
            results.append({"date": f"{d.pop('month')}/{d.pop('year'):02d}", **d})
        return results

    def indicators(self) -> IndicatorsResponseType:
        historic_query = self.historic(as_query=True)
        today = date.today()

        # region: Avg query
        avg_query = self.session.query(func.avg(historic_query.subquery().c.total).label("avg"))
        # endregion: Avg query

        # region: Last month total query
        last_month_total_subquery = historic_query.filter(
            extract("month", Revenue.created_at).label("month").in_((today.month - 1, today.month)),
            extract("year", Revenue.created_at) == today.year,
        ).subquery()
        last_month_total_query = self.session.query(
            last_month_total_subquery.c.total,
            last_month_total_subquery.c.year,
            last_month_total_subquery.c.month,
        ).order_by(desc("month"))
        # endregion: Last month total query

        # region: Calculate percentage
        avg_dict = dict(avg_query.first())
        avg_dict["avg"] = Decimal(avg_dict["avg"])
        last_month_total_dict = dict(last_month_total_query.first())
        percentage = (
            (last_month_total_dict["total"] / avg_dict["avg"]) - Decimal("1.0")
        ) * Decimal("100.0")
        # endregion: Calculate percentage

        return {**avg_dict, **last_month_total_dict, "diff": percentage}


class SqlModelCommandRepository(AbstractCommandRepository):
    def __init__(self, *, user_id: int, session: Session) -> None:
        super().__init__(user_id=user_id)
        self.session = session
        self.query = SqlModelQueryRepository(user_id=user_id, session=session)

    def _add(self, revenue: Revenue) -> None:
        self.session.add(revenue)

    def delete(self, revenue_id: int) -> int:
        return self.session.query(Revenue).filter_by(id=revenue_id, user_id=self.user_id).delete()


# endregion: repository classes
