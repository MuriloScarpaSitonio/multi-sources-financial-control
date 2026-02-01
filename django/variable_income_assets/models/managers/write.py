from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Literal, Self

from django.db.models import Case, CharField, Count, F, OuterRef, Q, QuerySet, Subquery, Sum, Value
from django.db.models.functions import Coalesce, Concat, Greatest, TruncMonth, TruncYear

from shared.managers_utils import GenericDateFilters

from ...choices import AssetTypes, PassiveIncomeEventTypes
from .expressions import GenericQuerySetExpressions

if TYPE_CHECKING:  # pragma: no cover
    from datetime import date

    from django.db.models.expressions import CombinedExpression


AggregatePeriod = Literal["month", "year"]


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

    def annotate_normalized_total_bought(self) -> Self:
        return self.annotate(
            normalized_total_bought=self.expressions.get_normalized_current_total_bought(),
            total_bought=self.expressions.get_normalized_total_bought(),
            closed_operations_normalized_total_bought=self.expressions.get_closed_operations_normalized_total_bought(),
        )

    def annotate_current_normalized_total_sold(self) -> Self:
        return self.annotate(
            normalized_total_sold=self.expressions.get_current_normalized_total_sold()
        )

    def annotate_normalized_closed_roi(self) -> Self:
        return self.annotate(normalized_closed_roi=self.expressions.normalized_closed_roi)

    def annotate_current_credited_incomes(self) -> Self:
        from ..write import AssetClosedOperation, PassiveIncome  # avoid circular ImportError

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

    def annotate_for_domain(self, is_held_in_self_custody: bool = False) -> Self:
        qs = self.annotate_quantity_balance().annotate_current_avg_price()
        if is_held_in_self_custody:
            return qs.annotate(
                total_sold=self.expressions.get_normalized_total_sold(),
            )
        return qs

    def annotate_read_fields(self, is_held_in_self_custody: bool = False) -> Self:
        if is_held_in_self_custody:
            return self._annotate_read_fields_for_is_held_in_self_custody()
        return (
            self.annotate_for_domain()
            .annotate_current_normalized_avg_price()
            .annotate_normalized_total_bought()
            .annotate_current_normalized_total_sold()
            .annotate_normalized_closed_roi()
            .annotate_current_credited_incomes()
        )

    def _annotate_read_fields_for_is_held_in_self_custody(self) -> Self:
        return (
            self.annotate(
                normalized_total_bought=self.expressions.get_normalized_current_total_bought(),
                normalized_total_sold=self.expressions.get_current_normalized_total_sold(),
                avg_price=self.expressions.get_avg_price_held_in_self_custody(),
                # apenas ativos de renda fixa BRL sao aceitos no momento
                normalized_avg_price=F("avg_price"),
                #
                credited_incomes=Value(Decimal()),
                normalized_credited_incomes=Value(Decimal()),
            )
            .annotate_normalized_closed_roi()
            .annotate(quantity_balance=self.expressions.get_quantity_balance_held_in_self_custody())
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
        from datetime import date

        from ..write import AssetClosedOperation

        extra_filters = Q(
            transactions__operation_date__year__lte=year,
            transactions__operation_date__gt=F("newest_closed_operation"),
        )
        subquery = (
            AssetClosedOperation.objects.filter(asset_id=OuterRef("pk"))
            .exclude(operation_datetime__year=year + 1)
            .order_by("-operation_datetime")
            .values("operation_datetime")
        )
        return self.alias(
            newest_closed_operation=Coalesce(Subquery(subquery[:1]), Value(date.min)),
            normalized_avg_price=self.expressions.get_current_normalized_avg_price(extra_filters),
        ).annotate(
            transactions_balance=self.expressions.get_quantity_balance(extra_filters),
            avg_price=self.expressions.get_avg_price(extra_filters),
            total_invested=F("normalized_avg_price") * F("transactions_balance"),
        )

    def filter_opened_after(self, operation_date: date) -> Self:
        extra_filters = Q(transactions__operation_date__gte=operation_date)
        return (
            self.filter(extra_filters)
            .annotate(transactions_balance=self.expressions.get_quantity_balance(extra_filters))
            .filter(transactions_balance__gt=0)
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

    def annotate_totals(self) -> Self:
        return self.annotate(
            total_bought=self.expressions.get_normalized_total_bought(),
            total_sold=self.expressions.get_normalized_total_sold(),
        )

    def since_a_year_ago_monthly_avg(self) -> dict[str, Decimal]:
        return (
            self.annotate_totals()
            .since_a_year_ago()
            .exclude(self.date_filters.current)
            .aggregate(
                avg=Coalesce(
                    (Sum("total_bought", default=Decimal()) - Sum("total_sold", default=Decimal()))
                    / (
                        Greatest(
                            Count(
                                Concat(
                                    "operation_date__month",
                                    "operation_date__year",
                                    output_field=CharField(),
                                ),
                                distinct=True,
                            ),
                            1,
                        )
                        * Value(Decimal("1.0"))
                    ),
                    Decimal(),
                ),
            )
        )

    def sum(self) -> dict[str, Decimal]:
        return self.annotate_totals().aggregate(
            bought=Sum("total_bought", default=Decimal()), sold=Sum("total_sold", default=Decimal())
        )

    def historic(self, aggregate_period: AggregatePeriod = "month") -> Self:
        if aggregate_period == "month":
            kwargs = {aggregate_period: TruncMonth("operation_date")}
        else:
            kwargs = {aggregate_period: TruncYear("operation_date")}
        return (
            self.annotate(total=self.expressions.normalized_total_raw_expression, **kwargs)
            .values(aggregate_period)
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
                    * Value(Decimal("-1.0"))
                ),
                diff=F("total_bought") + F("total_sold"),
            )
            .values(aggregate_period, "total_bought", "total_sold", "diff")
            .order_by(aggregate_period)
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
            normalized_total_sold=self.expressions.get_normalized_total_sold(),
            normalized_total_bought=self.expressions.get_normalized_total_bought(),
            total_bought=self.expressions.get_total_bought(),
            quantity_bought=self.expressions.get_quantity_bought(),
        )

    def filter_bought_and_group_by_asset_type(self) -> Self:
        return (
            self.bought()
            .values("asset__type")
            .annotate(
                total_bought=Sum(
                    self.expressions.normalized_total_raw_expression,
                    default=Decimal(),
                ),
                asset_type=F("asset__type"),
            )
            .filter(total_bought__gt=0)
            .values("asset_type", "total_bought")
            .order_by("-total_bought")
        )


class PassiveIncomeQuerySet(QuerySet):
    date_filters = GenericDateFilters(date_field_name="operation_date")

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.expressions = GenericQuerySetExpressions()

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return Coalesce(
            self.expressions.sum(
                self.expressions.normalized_incomes_total,
                filter=~self.date_filters.current,
                cast=False,
            )
            / (
                Greatest(
                    Count(
                        Concat(
                            "operation_date__month",
                            "operation_date__year",
                            output_field=CharField(),
                        ),
                        filter=~self.date_filters.current,
                        distinct=True,
                    ),
                    1,
                )
                * Value(Decimal("1.0"))
            ),
            Decimal(),
        )

    def credited(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.credited)

    def provisioned(self) -> Self:
        return self.filter(event_type=PassiveIncomeEventTypes.provisioned)

    def since_a_year_ago(self) -> Self:
        return self.filter(self.date_filters.since_a_year_ago)

    def future(self) -> Self:
        return self.filter(self.date_filters.future)

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
                Greatest(
                    Count(
                        Concat(
                            "operation_date__month",
                            "operation_date__year",
                            output_field=CharField(),
                        ),
                        filter=(
                            Q(event_type=PassiveIncomeEventTypes.credited)
                            & self.date_filters.since_a_year_ago
                            & ~self.date_filters.current
                        ),
                        distinct=True,
                    ),
                    1,
                )
                * Value(Decimal("1.0"))
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

    def sum_credited(self) -> dict[str, Decimal]:
        return self.credited().aggregate(
            total=self.expressions.sum(self.expressions.normalized_incomes_total)
        )

    def sum_provisioned_future(self) -> dict[str, Decimal]:
        return (
            self.provisioned()
            .future()
            .aggregate(total=self.expressions.sum(self.expressions.normalized_incomes_total))
        )

    def since_a_year_ago_credited_monthly_avg(self) -> dict[str, Decimal]:
        return (
            self.credited()
            .since_a_year_ago()
            .exclude(self.date_filters.current)
            .aggregate(
                avg=Coalesce(
                    self.expressions.sum(self.expressions.normalized_incomes_total, cast=False)
                    / (
                        Greatest(
                            Count(
                                Concat(
                                    "operation_date__month",
                                    "operation_date__year",
                                    output_field=CharField(),
                                ),
                                distinct=True,
                            ),
                            1,
                        )
                        * Value(Decimal("1.0"))
                    ),
                    Decimal(),
                )
            )
        )

    def monthly_avg(self) -> dict[str, Decimal]:
        # TODO: dollar tests
        return self.aggregate(avg=self._monthly_avg_expression)

    def assets_aggregation(self, top: int = 10) -> Self:
        """Returns the {top} assets that paid more incomes"""
        return (
            self.annotate(code=F("asset__code"))
            .values("code")
            .annotate(
                # TODO: dollar tests
                credited=self.expressions.sum(
                    self.expressions.normalized_incomes_total,
                    filter=Q(event_type=PassiveIncomeEventTypes.credited),
                ),
                provisioned=self.expressions.sum(
                    self.expressions.normalized_incomes_total,
                    filter=Q(event_type=PassiveIncomeEventTypes.provisioned),
                ),
                total=F("credited") + F("provisioned"),
            )
            .order_by("-total")[:top]
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

    def historic(self, aggregate_period: AggregatePeriod = "month") -> Self:
        if aggregate_period == "month":
            kwargs = {aggregate_period: TruncMonth("operation_date")}
        else:
            kwargs = {aggregate_period: TruncYear("operation_date")}
        return (
            self.annotate(**kwargs)
            .values(aggregate_period)
            .annotate(
                # TODO: dollar tests
                credited=self.expressions.sum(
                    self.expressions.normalized_incomes_total,
                    filter=Q(event_type=PassiveIncomeEventTypes.credited),
                ),
                provisioned=self.expressions.sum(
                    self.expressions.normalized_incomes_total,
                    filter=Q(event_type=PassiveIncomeEventTypes.provisioned),
                ),
            )
            .order_by(aggregate_period)
        )

    def credited_aggregation_by_asset_type(self) -> Self:
        return (
            self.credited()
            .values("asset__type")
            .annotate(
                total_credited=self.expressions.sum(self.expressions.normalized_incomes_total),
                asset_type=F("asset__type"),
            )
            .filter(total_credited__gt=0)
            .values("asset_type", "total_credited")
            .order_by("-total_credited")
        )


class AssetClosedOperationQuerySet(QuerySet):
    def annotate_roi(self) -> Self:
        return self.annotate(roi=F("normalized_total_sold") - F("normalized_total_bought"))
