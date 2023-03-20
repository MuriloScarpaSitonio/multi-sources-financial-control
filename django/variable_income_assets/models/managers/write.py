from __future__ import annotations

from decimal import Decimal
from typing import Dict, Union

from django.db.models import (
    Case,
    CharField,
    Count,
    F,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Concat, Coalesce, TruncMonth

from shared.managers_utils import CustomQueryset, GenericFilters, MonthlyFilterMixin
from shared.utils import coalesce_sum_expression

from ...choices import (
    AssetTypes,
    AssetsTotalInvestedReportAggregations,
    PassiveIncomeEventTypes,
    TransactionCurrencies,
)
from ...expressions import GenericQuerySetExpressions


class AssetQuerySet(QuerySet):
    expressions = GenericQuerySetExpressions(prefix="transactions")

    def _transactions_count_alias(self) -> AssetQuerySet:
        return self.alias(transactions_count=Count("transactions"))

    def _annotate_quantity_balance(self) -> AssetQuerySet:
        return self.annotate(quantity_balance=self.expressions.quantity_balance).order_by()

    def opened(self) -> AssetQuerySet:
        return (
            self._transactions_count_alias()
            ._annotate_quantity_balance()
            .filter(Q(transactions_count=0) | Q(quantity_balance__gt=0))
        )

    def finished(self) -> AssetQuerySet:
        return (
            self._transactions_count_alias()
            ._annotate_quantity_balance()
            .filter(transactions_count__gt=0, quantity_balance__lte=0)
        )

    def stocks(self) -> AssetQuerySet:  # pragma: no cover
        return self.filter(type=AssetTypes.stock)

    def stocks_usa(self) -> AssetQuerySet:  # pragma: no cover
        return self.filter(type=AssetTypes.stock_usa)

    def cryptos(self) -> AssetQuerySet:  # pragma: no cover
        return self.filter(type=AssetTypes.crypto)


class TransactionQuerySet(QuerySet):
    expressions = GenericQuerySetExpressions()
    filters = GenericFilters(date_field_name="created_at")

    def _get_roi_expression(
        self, incomes: Decimal, percentage: bool
    ) -> Union[Sum, CombinedExpression]:
        """
        We are passing the incomes explicity instead of defining a expression such as
        ```
        PASSIVE_INCOMES_TOTAL = coalesce_sum_expression(
            "asset__incomes__amount",
            filter=Q(asset__incomes__event_type=PassiveIncomeEventTypes.credited),
            extra=Decimal("1.0"),
        )
        ```
        at `GenericQuerySetExpressions` because we are using SQLite,
        which does not support the `DISTINCT ON` clause.

        This means that if we pass `distinct=True` to `coalesce_sum_expression`,
        we'd get only one income if their `amount`s are equal. In a production environment,
        ie, using PostgreSQL, we could do something like
        `self.distinct('asset__incomes').aggregate(...)` to distinct the incomes and avoid
        the need for this input queried outside of this manager.
        """
        ROI = self.expressions.current_total - self.expressions.get_total_adjusted(
            incomes=Value(incomes)
        )

        expression = (ROI / self.expressions.total_bought) * Decimal("100.0") if percentage else ROI
        return Coalesce(expression, Decimal())

    def bought(self) -> TransactionQuerySet:
        return self.filter(self.expressions.filters.bought)

    def sold(self) -> TransactionQuerySet:
        return self.filter(self.expressions.filters.sold)

    def since_a_year_ago(self) -> TransactionQuerySet:
        return self.filter(self.filters.since_a_year_ago)

    def avg_price(self, incomes: Decimal = Decimal()) -> Dict[str, Decimal]:
        expression = (
            self.expressions.get_adjusted_avg_price(incomes=Value(incomes))
            if incomes
            else self.expressions.avg_price
        )
        return self.aggregate(avg_price=expression)

    def get_current_quantity(self) -> Dict[str, Decimal]:
        return self.aggregate(quantity=self.expressions.quantity_balance)

    def roi(self, incomes: Decimal, percentage: bool = False) -> Dict[str, Decimal]:
        """ROI: Return On Investment"""
        return self.aggregate(ROI=self._get_roi_expression(incomes=incomes, percentage=percentage))

    def _annotate_totals(self) -> TransactionQuerySet:
        return self.annotate(
            total_bought=self.expressions.total_bought, total_sold=self.expressions.total_sold_raw
        )

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return (
            coalesce_sum_expression("total_bought", filter=~self.filters.current)
            - coalesce_sum_expression("total_sold", filter=~self.filters.current)
        ) / (
            Count(
                Concat("created_at__month", "created_at__year", output_field=CharField()),
                filter=~self.filters.current,
                distinct=True,
            )
            * Decimal("1.0")
        )

    def indicators(self) -> Dict[str, Decimal]:
        return self._annotate_totals().aggregate(
            current_bought=coalesce_sum_expression("total_bought", filter=self.filters.current),
            current_sold=coalesce_sum_expression("total_sold", filter=self.filters.current),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )

    def monthly_avg(self) -> Dict[str, Decimal]:
        return self._annotate_totals().aggregate(avg=self._monthly_avg_expression)

    def historic(self) -> TransactionQuerySet:
        return (
            self.annotate(
                total=self.expressions.get_dollar_conversion_expression(F("price") * F("quantity")),
                month=TruncMonth("created_at"),
            )
            .values("month")
            .annotate(
                total_bought=coalesce_sum_expression(
                    "total", filter=self.expressions.filters.bought
                ),
                total_sold=coalesce_sum_expression(
                    "total", filter=self.expressions.filters.sold, extra=Decimal("-1")
                ),
                diff=F("total_bought") + F("total_sold"),
            )
            .values("month", "total_bought", "total_sold", "diff")
            .order_by("month")
        )


class PassiveIncomeQuerySet(CustomQueryset, MonthlyFilterMixin):
    date_field_name = "operation_date"
    filters = GenericFilters(date_field_name="operation_date")

    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": coalesce_sum_expression("amount")}

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return coalesce_sum_expression(
            "amount",
            filter=(
                Q(event_type=PassiveIncomeEventTypes.credited)
                & self.filters.since_a_year_ago
                & ~self.filters.current
            ),
        ) / (
            Count(
                Concat("operation_date__month", "operation_date__year", output_field=CharField()),
                filter=(
                    Q(event_type=PassiveIncomeEventTypes.credited)
                    & self.filters.since_a_year_ago
                    & ~self.filters.current
                ),
                distinct=True,
            )
            * Decimal("1.0")
        )

    def credited(self) -> PassiveIncomeQuerySet:
        return self.filter(event_type=PassiveIncomeEventTypes.credited)

    def provisioned(self) -> PassiveIncomeQuerySet:
        return self.filter(event_type=PassiveIncomeEventTypes.provisioned)

    def future(self) -> PassiveIncomeQuerySet:
        return self.filter(self.filters.future)

    def since_a_year_ago(self) -> PassiveIncomeQuerySet:
        return self.filter(self.filters.since_a_year_ago)

    def indicators(self, fixed_avg_denominator: bool) -> Dict[str, Decimal]:
        """
        Args:
            fixed_avg_denominator (bool): If True the denominator will be 12, indicating the last 12 months. If False,
                The denominator will be dynamically calculated.
        """
        avg_denominator = (
            Value(Decimal("12.0"))
            if fixed_avg_denominator
            else (
                Count(
                    Concat(
                        "operation_date__month", "operation_date__year", output_field=CharField()
                    ),
                    filter=(
                        Q(event_type=PassiveIncomeEventTypes.credited)
                        & self.filters.since_a_year_ago
                        & ~self.filters.current
                    ),
                    distinct=True,
                )
                * Decimal("1.0")
            )
        )
        return self.aggregate(
            current_credited=coalesce_sum_expression(
                "amount",
                filter=Q(event_type=PassiveIncomeEventTypes.credited) & self.filters.current,
            ),
            provisioned_future=coalesce_sum_expression(
                "amount",
                filter=(
                    Q(event_type=PassiveIncomeEventTypes.provisioned)
                    & (self.filters.future | self.filters.current)
                ),
            ),
            avg=Coalesce(
                coalesce_sum_expression(
                    "amount",
                    filter=(
                        Q(event_type=PassiveIncomeEventTypes.credited)
                        & self.filters.since_a_year_ago
                        & ~self.filters.current
                    ),
                )
                / avg_denominator,
                Decimal(),
            ),
        )

    def monthly_avg(self) -> Dict[str, Decimal]:
        return self.aggregate(avg=self._monthly_avg_expression)

    def trunc_months(self) -> PassiveIncomeQuerySet:
        return self.annotate(month=TruncMonth("operation_date")).values("month").annotate_sum()

    def assets_aggregation(
        self, credited: bool = True, provisioned: bool = False
    ) -> PassiveIncomeQuerySet:
        """Returns the 10 assets that paid more incomes"""
        if credited and not provisioned:
            qs = self.credited()
        if provisioned and not credited:
            qs = self.provisioned()
        if provisioned and credited:
            qs = self.all()
        if not credited and not provisioned:
            qs = self.none()

        return qs.annotate(code=F("asset__code")).aggregate_field("code")[:10]
