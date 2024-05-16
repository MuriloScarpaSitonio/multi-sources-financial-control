from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import DecimalField, F, Q, Sum
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Cast, Coalesce

from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import TransactionActions

if TYPE_CHECKING:
    from django.db.models import Expression


class _GenericQueryHelperIntializer:
    def __init__(self, prefix: str | None = None) -> None:
        self.prefix = f"{prefix}__" if prefix is not None else ""

        # hacky pq em alguns casos pode ser o contrario
        self._inverse_prefix = "asset__" if not self.prefix else ""


class GenericQuerySetFilters(_GenericQueryHelperIntializer):
    @property
    def bought(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.buy})

    @property
    def sold(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.sell})


class GenericQuerySetExpressions(_GenericQueryHelperIntializer):
    def __init__(self, prefix: str | None = None) -> None:
        super().__init__(prefix=prefix)
        self.filters = GenericQuerySetFilters(prefix=prefix)

    @property
    def normalized_incomes_total(self) -> CombinedExpression:
        return F(f"{self.prefix}amount") * F(f"{self.prefix}current_currency_conversion_rate")

    @property
    def normalized_total_raw_expression(self) -> CombinedExpression:
        return (
            F(f"{self.prefix}price")
            * F(f"{self.prefix}quantity")
            * F(f"{self.prefix}current_currency_conversion_rate")
        )

    @property
    def closed_operations_normalized_total_sold(self) -> Sum:
        return self.sum(
            F(f"{self._inverse_prefix}closed_operations__normalized_total_sold"),
            distinct=True,
            cast=False,
        )

    @property
    def closed_operations_total_bought(self) -> Sum:
        return self.sum(
            F(f"{self._inverse_prefix}closed_operations__total_bought"),
            distinct=True,
            cast=False,
        )

    @property
    def closed_operations_quantity_bought(self) -> Sum:
        return self.sum(
            F(f"{self._inverse_prefix}closed_operations__quantity_bought"),
            distinct=True,
            cast=False,
        )

    @property
    def normalized_closed_roi(self) -> Sum:
        return self.sum(
            F(f"{self._inverse_prefix}closed_operations__normalized_total_sold")
            - (
                F(f"{self._inverse_prefix}closed_operations__normalized_total_bought")
                - F(f"{self._inverse_prefix}closed_operations__normalized_credited_incomes")
            ),
            distinct=True,
            cast=False,
        )

    @property
    def normalized_total_sold(self) -> CombinedExpression:
        return self.sum(
            F(f"{self.prefix}price")
            * F(f"{self.prefix}quantity")
            * F(f"{self.prefix}current_currency_conversion_rate"),
            filter=self.filters.sold,
            cast=True,
        )

    @property
    def current_normalized_total_sold(self) -> CombinedExpression:
        return self.normalized_total_sold - self.closed_operations_normalized_total_sold

    def get_closed_operations_normalized_total_bought(self, extra_filters: Q | None = None) -> Sum:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.sum(
            F(f"{self._inverse_prefix}closed_operations__normalized_total_bought"),
            distinct=True,
            cast=False,
            filter=extra_filters,
        )

    def get_total_bought(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.sum(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=Q(self.filters.bought, extra_filters),
        )

    def get_normalized_total_bought(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.sum(
            (
                F(f"{self.prefix}price")
                * F(f"{self.prefix}quantity")
                * Coalesce(
                    F(f"{self.prefix}current_currency_conversion_rate"),
                    get_dollar_conversion_rate(),
                )
            ),
            filter=Q(self.filters.bought, extra_filters),
        )

    def get_quantity_bought(self, extra_filters: Q | None = None) -> Sum:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.sum(
            f"{self.prefix}quantity",
            filter=Q(self.filters.bought, extra_filters),
        )

    def get_quantity_balance(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.get_quantity_bought(extra_filters=extra_filters) - self.sum(
            f"{self.prefix}quantity", filter=Q(self.filters.sold, extra_filters)
        )

    def get_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Coalesce(
            self.get_total_bought(extra_filters=extra_filters)
            / self.get_quantity_bought(extra_filters=extra_filters),
            Decimal(),
        )

    def get_current_normalized_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Coalesce(
            self.get_normalized_current_total_bought(extra_filters=extra_filters)
            / (
                self.get_quantity_bought(extra_filters=extra_filters)
                - self.closed_operations_quantity_bought
            ),
            Decimal(),
        )

    def get_normalized_current_total_bought(
        self, extra_filters: Q | None = None
    ) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return (
            self.get_normalized_total_bought(extra_filters)
            - self.get_closed_operations_normalized_total_bought()
        )

    def get_current_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Coalesce(
            (self.get_total_bought(extra_filters) - self.closed_operations_total_bought)
            / (
                self.get_quantity_bought(extra_filters=extra_filters)
                - self.closed_operations_quantity_bought
            ),
            Decimal(),
        )

    @staticmethod
    def sum(expression: Expression, cast: bool = True, **extra) -> Sum | CombinedExpression:
        s = Sum(expression, default=Decimal(), **extra)
        return s * Cast(1.0, DecimalField()) if cast else s
