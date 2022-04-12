from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Union

from sqlmodel import Session
from sqlalchemy import desc, extract, func
from sqlalchemy.sql.functions import coalesce
from sqlalchemy.orm.query import Query

from ..domain.models import Revenue


class AbstractRepository(ABC):
    @abstractmethod
    def add(self, revenue: Revenue):
        raise NotImplementedError

    @abstractmethod
    def get(self, id: int) -> Revenue:
        raise NotImplementedError


class SqlAlchemyRepository(AbstractRepository):
    def __init__(self, *, user_id: int, session: Session) -> None:
        self.user_id = user_id
        self.session = session

    def add(self, revenue: Revenue) -> None:
        self.session.add(revenue)

    # def get(self, revenue_id: int) -> Revenue:
    #     return self.session.query(Revenue).filter_by(id=revenue_id, user_id=self.user_id).first()

    def get(self, revenue_id: int):
        result = self.session.execute(
            """
            SELECT id, value, created_at, description
            FROM revenues_revenue 
            WHERE id = :revenue_id AND user_id = :user_id
            """,
            dict(revenue_id=revenue_id, user_id=self.user_id),
        ).one_or_none()
        if result is not None:
            return dict(result)

    def list(self) -> Query:
        return (
            self.session.query(Revenue).filter_by(user_id=self.user_id).order_by(desc("created_at"))
        )

    def delete(self, revenue_id: int) -> int:
        rows = self.session.query(Revenue).filter_by(id=revenue_id, user_id=self.user_id).delete()
        return rows

    def historic(
        self, as_query: bool = False
    ) -> Union[Query, List[Dict[str, Union[int, Decimal]]]]:
        qs = (
            self.session.query(
                extract("year", Revenue.created_at).label("year"),
                extract("month", Revenue.created_at).label("month"),
                func.sum(Revenue.value).label("total"),
            )
            .filter_by(user_id=self.user_id)
            .group_by("year", "month")
            .order_by("year", "month")
        )
        if as_query:
            return qs
        # print([dict(r) for r in qs])
        results = []
        for row in qs:
            d = dict(row)
            results.append({"date": f"{d.pop('month')}/{d.pop('year'):02d}", **d})
        return results

    def indicators(self) -> Dict[str, Decimal]:
        historic_query = self.historic(as_query=True)
        today = datetime.now().date()

        # region: Avg query
        avg_query = self.session.query(func.avg(historic_query.subquery().c.total).label("avg"))
        # endregion: Avg query

        # region: Last month total query
        trunc_month_func = extract("month", Revenue.created_at).label("month")
        last_month_total_subquery = historic_query.filter(
            Revenue.user_id == self.user_id,
            trunc_month_func.in_((today.month - 1, today.month)),
        ).subquery()
        last_month_total_query = self.session.query(
            last_month_total_subquery.c.total,
            last_month_total_subquery.c.year,
            last_month_total_subquery.c.month,
        )
        # endregion: Last month total query

        # region: Calculate percentage
        avg_dict = dict(avg_query.first())
        last_month_total_dict = dict(last_month_total_query.first())
        percentage = (
            (last_month_total_dict["total"] / Decimal(avg_dict["avg"])) - Decimal("1.0")
        ) * Decimal("100.0")
        # endregion: Calculate percentage

        return {**avg_dict, **last_month_total_dict, "diff": percentage}
