from __future__ import annotations

from decimal import Decimal
from typing import Any, Self, TYPE_CHECKING

from django.db.models import (
    Case,
    CharField,
    Count,
    DecimalField,
    F,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Cast, Concat, Coalesce, TruncMonth

from shared.managers_utils import GenericDateFilters

from ...choices import AssetTypes, PassiveIncomeEventTypes
from .expressions import GenericQuerySetExpressions

if TYPE_CHECKING:  # pragma: no cover
    from django.db.models.expressions import CombinedExpression


class AssetQuerySet(QuerySet):
    expressions = GenericQuerySetExpressions(prefix="transactions")

    def using_dollar_as(self, dollar_conversion_rate: Decimal) -> Self:
        self.expressions.dollar_conversion_rate = dollar_conversion_rate
        return self

    @staticmethod
    def _get_passive_incomes_subquery() -> Self:
        from ..write import PassiveIncome  # avoid circular ImportError

        return (
            PassiveIncome.objects.filter(asset=OuterRef("pk"))
            .values("asset__pk")  # group by as we can't aggregate directly
            .credited()
            .annotate(credited_incomes=Sum("amount"))
            .values("credited_incomes")
        )

    def _transactions_count_alias(self) -> Self:
        return self.alias(transactions_count=Count("transactions"))

    def _annotate_quantity_balance(self) -> Self:
        return self.annotate(quantity_balance=self.expressions.get_quantity_balance()).order_by()

    def opened(self) -> Self:
        return (
            self._transactions_count_alias()
            ._annotate_quantity_balance()
            .filter(Q(transactions_count=0) | Q(quantity_balance__gt=0))
        )

    def finished(self) -> Self:
        return self._annotate_quantity_balance().filter(quantity_balance__lte=0)

    def stocks(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock)

    def stocks_usa(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock_usa)

    def cryptos(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.crypto)

    def annotate_currency(self, fallback: Any = "") -> Self:
        return self.annotate(currency=Coalesce(F("transactions__currency"), Value(fallback)))

    def annotate_adjusted_avg_price(self, annotate_passive_incomes_subquery: bool = True) -> Self:
        if annotate_passive_incomes_subquery:  # pragma: no cover
            subquery = self._get_passive_incomes_subquery()

        expression = self.expressions.get_adjusted_avg_price(
            incomes=Coalesce(F("credited_incomes_total"), Decimal())
        )
        return (
            self.annotate(
                credited_incomes_total=Subquery(subquery.values("credited_incomes"))
            ).annotate(adjusted_avg_price=Coalesce(expression, Decimal()))
            if annotate_passive_incomes_subquery
            else self.annotate(adjusted_avg_price=Coalesce(expression, Decimal()))
        )

    def annotate_total_invested_adjusted(
        self, annotate_passive_incomes_subquery: bool = True
    ) -> Self:
        if annotate_passive_incomes_subquery:
            subquery = self._get_passive_incomes_subquery()

        expression = Coalesce(
            self.expressions.get_total_adjusted(
                incomes=Coalesce(F("credited_incomes_total"), Decimal())
            ),
            Decimal(),
        )

        return (
            self.annotate(
                credited_incomes_total=Subquery(subquery.values("credited_incomes"))
            ).annotate(total_invested_adjusted=expression)
            if annotate_passive_incomes_subquery
            else self.annotate(total_invested_adjusted=expression)
        )

    def annotate_total_adjusted_invested(self) -> Self:  # pragma: no cover
        return self.annotate(
            total_adjusted_invested=F("adjusted_avg_price") * F("quantity_balance")
        )

    def annotate_avg_price(self) -> Self:
        return self.annotate(avg_price=self.expressions.get_avg_price())

    def annotate_total_invested(self) -> Self:
        return self.annotate(
            total_invested=Coalesce(F("avg_price") * F("quantity_balance"), Decimal())
        )

    def annotate_total_bought(self) -> Self:
        return self.annotate(total_bought=self.expressions.get_total_bought())

    def annotate_read_fields(self) -> Self:
        return (
            self._annotate_quantity_balance()
            .annotate_currency()
            .annotate_adjusted_avg_price()
            .annotate_avg_price()
            .annotate_total_bought()
            .annotate_total_invested()
            .annotate_total_invested_adjusted(annotate_passive_incomes_subquery=False)
        )

    def annotate_irpf_infos(self, year: int) -> Self:
        return self.annotate_currency().annotate(
            transactions_balance=self.expressions.get_quantity_balance(
                extra_filters=Q(transactions__created_at__year__lte=year)
            ),
            avg_price=self.expressions.get_avg_price(
                extra_filters=Q(transactions__created_at__year__lte=year)
            ),
            total_invested=self.expressions.get_dollar_conversion_expression(
                F("avg_price") * F("transactions_balance")
            ),
        )

    def annotate_credited_incomes_at_given_year(
        self, year: int, incomes_type: PassiveIncomeEventTypes
    ) -> Self:
        return self.annotate(
            credited_incomes_total=Subquery(
                self._get_passive_incomes_subquery()
                .filter(operation_date__year=year, type=incomes_type)
                .values("credited_incomes")
            )
        )

    def annotate_for_domain(self) -> Self:
        return (
            self._annotate_quantity_balance().annotate_currency(fallback=None).annotate_avg_price()
        )


class TransactionQuerySet(QuerySet):
    expressions = GenericQuerySetExpressions()
    filters = GenericDateFilters(date_field_name="created_at")

    def using_dollar_as(self, dollar_conversion_rate: Decimal) -> Self:
        self.expressions.dollar_conversion_rate = dollar_conversion_rate
        return self

    def _get_roi_expression(self, incomes: Decimal, percentage: bool) -> Sum | CombinedExpression:
        """
        We are passing the incomes explicity instead of defining a expression such as
        ```
        PASSIVE_INCOMES_TOTAL = Sum(
            "asset__incomes__amount",
            filter=Q(asset__incomes__event_type=PassiveIncomeEventTypes.credited),
            default=Decimal()
        )
        ```
        at `GenericQuerySetExpressions` because we are using SQLite,
        which does not support the `DISTINCT ON` clause.

        This means that if we pass `distinct=True` to `Sum`,
        we'd get only one income if their `amount`s are equal. In a production environment,
        ie, using PostgreSQL, we could do something like
        `self.distinct('asset__incomes').aggregate(...)` to distinct the incomes and avoid
        the need for this input queried outside of this manager.
        """
        ROI = self.expressions.current_total - self.expressions.get_total_adjusted(
            incomes=Value(incomes)
        )

        expression = (
            (ROI / self.expressions.get_total_bought()) * Decimal("100.0") if percentage else ROI
        )
        return Coalesce(expression, Decimal())

    def bought(self) -> Self:
        return self.filter(self.expressions.filters.bought)

    def sold(self) -> Self:
        return self.filter(self.expressions.filters.sold)

    def since_a_year_ago(self) -> Self:
        return self.filter(self.filters.since_a_year_ago)

    def avg_price(self, incomes: Decimal = Decimal()) -> dict[str, Decimal]:
        expression = (
            self.expressions.get_adjusted_avg_price(incomes=Value(incomes))
            if incomes
            else self.expressions.get_avg_price()
        )
        return self.aggregate(avg_price=expression)

    def get_quantity_balance(self) -> dict[str, Decimal]:
        return self.aggregate(quantity=self.expressions.get_quantity_balance())

    def annotate_current_price(self) -> Self:
        from ...adapters.repositories import DjangoSQLAssetMetaDataRepository

        return self.annotate(
            current_price_metadata=DjangoSQLAssetMetaDataRepository.get_current_price_annotation(
                fk_connection=False
            )
        )

    def roi(self, incomes: Decimal, percentage: bool = False) -> dict[str, Decimal]:
        """ROI: Return On Investment"""
        return self.annotate_current_price().aggregate(
            ROI=self._get_roi_expression(incomes=incomes, percentage=percentage)
        )

    def annotate_raw_roi(self, normalize: bool = True) -> Self:
        expression = (F("price") - F("initial_price")) * F("quantity")
        return self.annotate(
            roi=(
                self.expressions.get_dollar_conversion_expression(expression=expression)
                if normalize
                else expression
            )
        )

    def _annotate_totals(self) -> Self:
        return self.annotate(
            total_bought=self.expressions.total_bought_normalized,
            total_sold=self.expressions.total_sold_raw,
        )

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return (
            Sum("total_bought", filter=~self.filters.current, default=Decimal())
            - Sum("total_sold", filter=~self.filters.current, default=Decimal())
        ) / (
            Count(
                Concat("created_at__month", "created_at__year", output_field=CharField()),
                filter=~self.filters.current,
                distinct=True,
            )
            * Cast(1.0, DecimalField())
        )

    def indicators(self) -> dict[str, Decimal]:
        return self._annotate_totals().aggregate(
            current_bought=Sum("total_bought", filter=self.filters.current, default=Decimal()),
            current_sold=Sum("total_sold", filter=self.filters.current, default=Decimal()),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )

    def monthly_avg(self) -> dict[str, Decimal]:
        return self._annotate_totals().aggregate(avg=self._monthly_avg_expression)

    def historic(self) -> Self:
        return (
            self.annotate(
                total=self.expressions.get_total_raw_expression(), month=TruncMonth("created_at")
            )
            .values("month")
            .annotate(
                total_bought=Sum(
                    "total", filter=self.expressions.filters.bought, default=Decimal()
                ),
                total_sold=(
                    Sum(
                        "total",
                        filter=self.expressions.filters.sold,
                        default=Decimal(),
                    )
                    * Cast(-1.0, DecimalField())
                ),
                diff=F("total_bought") + F("total_sold"),
            )
            .values("month", "total_bought", "total_sold", "diff")
            .order_by("month")
        )

    def aggregate_total_sold_per_type(self, only: set[str] | None = None) -> dict[str, Decimal]:
        type_expression_map: dict[str, Case] = {}
        for v in only & set(AssetTypes.values) if only is not None else AssetTypes.values:
            type_expression_map[v] = self.expressions.get_total_raw_expression(
                aggregate=True, filter=Q(asset__type=v)
            )
        return self.filter(self.expressions.filters.sold).aggregate(**type_expression_map)


class PassiveIncomeQuerySet(QuerySet):
    date_field_name = "operation_date"
    filters = GenericDateFilters(date_field_name="operation_date")

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return Sum(
            "amount",
            filter=(
                Q(event_type=PassiveIncomeEventTypes.credited)
                & self.filters.since_a_year_ago
                & ~self.filters.current
            ),
            default=Decimal(),
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
            * Cast(1.0, DecimalField())
        )

    def credited(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.credited)

    def provisioned(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.provisioned)

    def since_a_year_ago(self) -> Self:
        return self.filter(self.filters.since_a_year_ago)

    def indicators(self, fixed_avg_denominator: bool) -> dict[str, Decimal]:
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
                * Cast(1.0, DecimalField())
            )
        )
        return self.aggregate(
            current_credited=Sum(
                "amount",
                filter=Q(event_type=PassiveIncomeEventTypes.credited) & self.filters.current,
                default=Decimal(),
            ),
            provisioned_future=Sum(
                "amount",
                filter=(
                    Q(event_type=PassiveIncomeEventTypes.provisioned)
                    & (self.filters.future | self.filters.current)
                ),
                default=Decimal(),
            ),
            avg=Coalesce(
                Sum(
                    "amount",
                    filter=(
                        Q(event_type=PassiveIncomeEventTypes.credited)
                        & self.filters.since_a_year_ago
                        & ~self.filters.current
                    ),
                    default=Decimal(),
                )
                / avg_denominator,
                Decimal(),
            ),
        )

    def monthly_avg(self) -> dict[str, Decimal]:
        return self.aggregate(avg=self._monthly_avg_expression)

    def trunc_months(self) -> Self:
        return (
            self.annotate(month=TruncMonth("operation_date"))
            .values("month")
            .annotate(total=Sum("amount", default=Decimal()))
            .order_by("-total")
        )

    def assets_aggregation(self, credited: bool = True, provisioned: bool = False) -> Self:
        """Returns the 10 assets that paid more incomes"""
        if credited and not provisioned:
            qs = self.credited()
        if provisioned and not credited:
            qs = self.provisioned()
        if provisioned and credited:
            qs = self.all()
        if not credited and not provisioned:
            qs = self.none()

        return (
            qs.annotate(code=F("asset__code"))
            .values("code")
            .annotate(total=Sum("amount", default=Decimal()))
            .order_by("-total")[:10]
        )

    def sum(self) -> dict[str, Decimal]:
        return self.aggregate(total=Sum("amount", default=Decimal()))
