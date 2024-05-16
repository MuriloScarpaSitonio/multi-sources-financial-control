from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Self

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
    When,
)
from django.db.models.functions import Cast, Coalesce, Concat, TruncMonth

from shared.managers_utils import GenericDateFilters

from ...choices import AssetTypes, PassiveIncomeEventTypes
from .expressions import GenericQuerySetExpressions

if TYPE_CHECKING:  # pragma: no cover
    from django.db.models.expressions import CombinedExpression


class AssetQuerySet(QuerySet):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.expressions = GenericQuerySetExpressions(prefix="transactions")

    @staticmethod
    def _get_passive_incomes_qs_w_normalized_amount() -> PassiveIncomeQuerySet:
        from ..write import PassiveIncome  # avoid circular ImportError

        return (
            PassiveIncome.objects.filter(asset=OuterRef("pk"))
            .values("asset__pk")  # group by as we can't aggregate directly
            .credited()
            .alias(normalized_amount=F("amount") * F("current_currency_conversion_rate"))
            .annotate(_normalized_credited_incomes=Sum("normalized_amount"))
        )

    def _transactions_count_alias(self) -> Self:
        return self.alias(transactions_count=Count("transactions"))

    def annotate_quantity_balance(self) -> Self:
        return self.annotate(quantity_balance=self.expressions.get_quantity_balance()).order_by()

    def opened(self) -> Self:
        return (
            self._transactions_count_alias()
            .annotate_quantity_balance()
            .filter(Q(transactions_count=0) | Q(quantity_balance__gt=0))
        )

    def closed(self) -> Self:
        return self.annotate_quantity_balance().filter(quantity_balance__lte=0)

    def stocks(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock)

    def stocks_usa(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock_usa)

    def cryptos(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.crypto)

    def annotate_current_avg_price(self) -> Self:
        return self.annotate(avg_price=self.expressions.get_current_avg_price())

    def annotate_current_normalized_avg_price(self) -> Self:
        return self.annotate(
            normalized_avg_price=self.expressions.get_current_normalized_avg_price()
        )

    def t(self):
        return self.annotate_current_avg_price().annotate(
            total_bought=self.expressions.get_total_bought(),
            qty_bought=self.expressions.get_quantity_bought(),
            closed_operations_total_bought=self.expressions.closed_operations_total_bought,
        )

    def annotate_normalized_total_bought(self) -> Self:
        return self.annotate(
            normalized_total_bought=self.expressions.get_normalized_current_total_bought()
        )

    def annotate_current_normalized_total_sold(self) -> Self:
        return self.annotate(normalized_total_sold=self.expressions.current_normalized_total_sold)

    def annotate_normalized_closed_roi(self) -> Self:
        return self.annotate(normalized_closed_roi=self.expressions.normalized_closed_roi)

    def annotate_current_credited_incomes(self) -> Self:
        from ..write import (  # avoid circular ImportError
            AssetClosedOperation,
            PassiveIncome,
        )

        incomes_qs = (
            PassiveIncome.objects.filter(asset=OuterRef("pk"))
            .values("asset__pk")  # group by as we can't aggregate directly
            .credited()
        )
        operations_qs = AssetClosedOperation.objects.filter(asset=OuterRef("pk")).values(
            "asset__pk"
        )
        return self.annotate(
            normalized_credited_incomes=(
                Coalesce(
                    Subquery(
                        self._get_passive_incomes_qs_w_normalized_amount().values(
                            "_normalized_credited_incomes"
                        )
                    ),
                    Decimal(),
                )
                - Coalesce(
                    Subquery(
                        operations_qs.annotate(
                            credited_incomes=Sum("normalized_credited_incomes")
                        ).values("credited_incomes")
                    ),
                    Decimal(),
                )
            ),
            credited_incomes=(
                Coalesce(
                    Subquery(
                        incomes_qs.annotate(_credited_incomes=Sum("amount")).values(
                            "_credited_incomes"
                        )
                    ),
                    Decimal(),
                )
                - Coalesce(
                    Subquery(
                        operations_qs.annotate(_credited_incomes=Sum("credited_incomes")).values(
                            "_credited_incomes"
                        )
                    ),
                    Decimal(),
                )
            ),
        )

    def annotate_for_domain(self) -> Self:
        return self.annotate_quantity_balance().annotate_current_avg_price()

    def annotate_read_fields(self) -> Self:
        return (
            self.annotate_for_domain()
            .annotate_current_normalized_avg_price()
            .annotate_normalized_total_bought()
            .annotate_current_normalized_total_sold()
            .annotate_normalized_closed_roi()
            .annotate_current_credited_incomes()
        )

    def annotate_for_simulation(self) -> Self:
        from ...adapters import DjangoSQLAssetMetaDataRepository

        return (
            self.annotate_for_domain()
            .annotate_current_normalized_avg_price()
            .annotate_normalized_total_bought()
            .annotate_current_normalized_total_sold()
            .annotate_current_credited_incomes()
            .annotate(
                current_price_metadata=DjangoSQLAssetMetaDataRepository.get_current_price_annotation(
                    source="write"
                )
            )
        )

    def annotate_irpf_infos(self, year: int) -> Self:
        extra_filters = Q(transactions__operation_date__year__lte=year)
        return self.alias(
            normalized_avg_price=self.expressions.get_current_normalized_avg_price(extra_filters)
        ).annotate(
            transactions_balance=self.expressions.get_quantity_balance(extra_filters),
            avg_price=self.expressions.get_avg_price(extra_filters),
            total_invested=Case(
                When(
                    Q(closed_operations__isnull=True),
                    then=F("normalized_avg_price") * F("transactions_balance"),
                ),
                default=self.expressions.get_closed_operations_normalized_total_bought(
                    extra_filters=Q(closed_operations__operation_datetime__year=year + 1)
                ),
            ),
        )

    def annotate_credited_incomes_at_given_year(
        self, year: int, incomes_type: PassiveIncomeEventTypes
    ) -> Self:
        return self.annotate(
            normalized_credited_incomes_total=Coalesce(
                Subquery(
                    self._get_passive_incomes_qs_w_normalized_amount()
                    .filter(operation_date__year=year, type=incomes_type)
                    .values("_normalized_credited_incomes")
                ),
                Decimal(),
            )
        )


class TransactionQuerySet(QuerySet):
    date_filters = GenericDateFilters(date_field_name="operation_date")

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.expressions = GenericQuerySetExpressions()

    def bought(self) -> Self:
        return self.filter(self.expressions.filters.bought)

    def sold(self) -> Self:
        return self.filter(self.expressions.filters.sold)

    def since_a_year_ago(self) -> Self:
        return self.filter(self.date_filters.since_a_year_ago)

    def _annotate_totals(self) -> Self:
        return self.annotate(
            total_bought=self.expressions.get_normalized_total_bought(),
            total_sold=self.expressions.normalized_total_sold,
        )

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return (
            Sum("total_bought", filter=~self.date_filters.current, default=Decimal())
            - Sum("total_sold", filter=~self.date_filters.current, default=Decimal())
        ) / (
            Count(
                Concat("operation_date__month", "operation_date__year", output_field=CharField()),
                filter=~self.date_filters.current,
                distinct=True,
            )
            * Cast(1.0, DecimalField())
        )

    def indicators(self) -> dict[str, Decimal]:
        return self._annotate_totals().aggregate(
            current_bought=Sum("total_bought", filter=self.date_filters.current, default=Decimal()),
            current_sold=Sum("total_sold", filter=self.date_filters.current, default=Decimal()),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )

    def monthly_avg(self) -> dict[str, Decimal]:
        return self._annotate_totals().aggregate(avg=self._monthly_avg_expression)

    def historic(self) -> Self:
        return (
            self.annotate(
                total=self.expressions.normalized_total_raw_expression,
                month=TruncMonth("operation_date"),
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
            type_expression_map[v] = self.expressions.sum(
                self.expressions.normalized_total_raw_expression
            )
        return self.filter(self.expressions.filters.sold, asset__type=v).aggregate(
            **type_expression_map
        )

    def aggregate_normalized_totals(self) -> dict[str, Decimal]:
        return self.aggregate(
            normalized_total_sold=self.expressions.normalized_total_sold,
            normalized_total_bought=self.expressions.get_normalized_total_bought(),
            total_bought=self.expressions.get_total_bought(),
            quantity_bought=self.expressions.get_quantity_bought(),
        )

    def annotate_normalized_roi(self) -> Self:
        return self.alias(avg_price=self.expressions.get_current_normalized_avg_price()).annotate(
            roi=(
                (F("price") - F("avg_price"))
                * F("quantity")
                * F("current_currency_conversion_rate")
            )
        )


class PassiveIncomeQuerySet(QuerySet):
    date_filters = GenericDateFilters(date_field_name="operation_date")

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.expressions = GenericQuerySetExpressions()

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return self.expressions.sum(
            self.expressions.normalized_incomes_total, filter=~self.date_filters.current
        ) / (
            Count(
                Concat("operation_date__month", "operation_date__year", output_field=CharField()),
                filter=~self.date_filters.current,
                distinct=True,
            )
            * Cast(1.0, DecimalField())
        )

    def credited(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.credited)

    def provisioned(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.provisioned)

    def since_a_year_ago(self) -> Self:
        return self.filter(self.date_filters.since_a_year_ago)

    def indicators(self, fixed_avg_denominator: bool) -> dict[str, Decimal]:
        """
        Args:
            fixed_avg_denominator (bool): If True the denominator will be 12, indicating the
                last 12 months. If False, The denominator will be dynamically calculated.
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
                        & self.date_filters.since_a_year_ago
                        & ~self.date_filters.current
                    ),
                    distinct=True,
                )
                * Cast(1.0, DecimalField())
            )
        )
        return self.aggregate(
            # TODO: dollar tests
            current_credited=self.expressions.sum(
                self.expressions.normalized_incomes_total,
                filter=Q(event_type=PassiveIncomeEventTypes.credited) & self.date_filters.current,
            ),
            provisioned_future=self.expressions.sum(
                self.expressions.normalized_incomes_total,
                filter=(
                    Q(event_type=PassiveIncomeEventTypes.provisioned)
                    & (self.date_filters.future | self.date_filters.current)
                ),
            ),
            avg=Coalesce(
                self.expressions.sum(
                    self.expressions.normalized_incomes_total,
                    filter=(
                        Q(event_type=PassiveIncomeEventTypes.credited)
                        & self.date_filters.since_a_year_ago
                        & ~self.date_filters.current
                    ),
                )
                / avg_denominator,
                Decimal(),
            ),
        )

    def monthly_avg(self) -> dict[str, Decimal]:
        # TODO: dollar tests
        return self.aggregate(avg=self._monthly_avg_expression)

    def trunc_months(self) -> Self:
        return (
            self.annotate(month=TruncMonth("operation_date"))
            .values("month")
            .annotate(
                # TODO: dollar tests
                total=self.expressions.sum(self.expressions.normalized_incomes_total)
            )
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
            .annotate(
                # TODO: dollar tests
                total=self.expressions.sum(self.expressions.normalized_incomes_total)
            )
            .order_by("-total")[:10]
        )

    def aggregate_credited_totals(self) -> dict[str, Decimal]:
        return self.aggregate(
            normalized_credited_incomes=self.expressions.sum(
                self.expressions.normalized_incomes_total,
                filter=Q(event_type=PassiveIncomeEventTypes.credited),
            ),
            credited_incomes=Sum(
                "amount", filter=Q(event_type=PassiveIncomeEventTypes.credited), default=Decimal()
            ),
        )
