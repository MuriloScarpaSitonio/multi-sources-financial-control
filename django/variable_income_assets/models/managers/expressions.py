from decimal import Decimal
from typing import Optional, Union


from django.db.models import Case, Expression, F, Q, Value, When
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Coalesce

from config.settings.dynamic import dynamic_settings
from shared.utils import coalesce_sum_expression

from ...choices import TransactionActions, TransactionCurrencies


class _GenericQueryHelperIntializer:
    def __init__(self, prefix: Optional[str] = None) -> None:
        self.prefix = f"{prefix}__" if prefix is not None else ""


class GenericQuerySetFilters(_GenericQueryHelperIntializer):
    @property
    def bought(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.buy})

    @property
    def sold(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.sell})


class GenericQuerySetExpressions(_GenericQueryHelperIntializer):
    def __init__(
        self,
        prefix: Optional[str] = None,
        dollar_conversion_rate: Optional[Decimal] = None,
    ) -> None:
        super().__init__(prefix=prefix)
        self.dollar_conversion_rate = (
            Value(dollar_conversion_rate)
            if dollar_conversion_rate is not None
            else Value(dynamic_settings.DOLLAR_CONVERSION_RATE)
        )
        self.filters = GenericQuerySetFilters(prefix=prefix)

    @property
    def total_sold(self) -> Expression:
        return coalesce_sum_expression(
            (F(f"{self.prefix}price") - F(f"{self.prefix}initial_price"))
            * F(f"{self.prefix}quantity"),
            filter=self.filters.sold,
            extra=Decimal("1.0"),
        )

    @property
    def total_sold_raw(self) -> Case:
        expression = coalesce_sum_expression(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=self.filters.sold,
            extra=Decimal("1.0"),
        )
        return self.get_dollar_conversion_expression(expression=expression)

    @property
    def total_bought_normalized(self) -> Case:
        expression = coalesce_sum_expression(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=self.filters.bought,
            # models.functions.Cast won't work;
            # cast result to a decimal value using `extra`
            extra=Decimal("1.0"),
        )
        return self.get_dollar_conversion_expression(expression=expression)

    @property
    def current_total(self) -> Case:
        # hacky
        field_name = "asset__current_price" if not self.prefix else "current_price"
        return Coalesce(F(field_name), Decimal()) * self.get_quantity_balance()

    def get_avg_price(self, extra_filters: Q = Q()) -> Coalesce:
        return Coalesce(
            self.get_total_bought(extra_filters=extra_filters)
            / self.get_quantity_bought(extra_filters=extra_filters),
            Decimal(),
        )

    def get_total_bought(self, extra_filters: Q = Q()) -> Expression:
        return coalesce_sum_expression(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=Q(self.filters.bought, extra_filters),
            # models.functions.Cast won't work;
            # cast result to a decimal value using `extra`
            extra=Decimal("1.0"),
        )

    def get_quantity_bought(self, extra_filters: Q = Q()) -> Coalesce:
        return coalesce_sum_expression(
            f"{self.prefix}quantity", filter=Q(self.filters.bought, extra_filters)
        )

    def get_quantity_balance(self, extra_filters: Q = Q()) -> Coalesce:
        return self.get_quantity_bought(extra_filters=extra_filters) - coalesce_sum_expression(
            f"{self.prefix}quantity", filter=Q(self.filters.sold, extra_filters)
        )

    def get_dollar_conversion_expression(self, expression: Expression) -> Case:
        return Case(
            When(
                Q(**{f"{self.prefix}currency": TransactionCurrencies.dollar}),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )

    def get_adjusted_avg_price(self, incomes: Union[Expression, Value]) -> Coalesce:
        return Coalesce(
            ((self.get_quantity_balance() * self.get_avg_price()) - incomes)
            / self.get_quantity_balance(),
            Decimal(),
        )

    def get_total_adjusted(self, incomes: Union[Expression, Value]) -> CombinedExpression:
        return (self.get_quantity_balance() * self.get_avg_price()) - incomes - self.total_sold

    def get_total_raw_expression(self, aggregate: bool = False, **kwargs) -> Case:
        expression = (
            coalesce_sum_expression(
                F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
                extra=Decimal("1.0"),
                **kwargs,
            )
            if aggregate
            else F(f"{self.prefix}price") * F(f"{self.prefix}quantity")
        )
        return self.get_dollar_conversion_expression(expression=expression)
