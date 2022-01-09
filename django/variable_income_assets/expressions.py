from decimal import Decimal
from typing import Optional, Union

from django.db.models import Case, Expression, F, Q, Value, When
from django.db.models.expressions import CombinedExpression
from django.utils.functional import cached_property
from django.db.models.functions import Coalesce

from shared.utils import coalesce_sum_expression
from .choices import TransactionActions, TransactionCurrencies


class _GenericQuerySetMixin:
    def __init__(self, prefix: Optional[str] = None) -> None:
        self.prefix = f"{prefix}__" if prefix is not None else ""


class GenericQuerySetFilters(_GenericQuerySetMixin):
    @property
    def bought(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.buy})

    @property
    def sold(self) -> Q:
        return Q(**{f"{self.prefix}action": TransactionActions.sell})


class GenericQuerySetExpressions(_GenericQuerySetMixin):
    def __init__(self, prefix: Optional[str] = None) -> None:
        super().__init__(prefix=prefix)
        self.filters = GenericQuerySetFilters(prefix=prefix)

    @cached_property
    def quantity_bought(self) -> Coalesce:
        return coalesce_sum_expression(f"{self.prefix}quantity", filter=self.filters.bought)

    @cached_property
    def quantity_balance(self) -> Coalesce:
        return self.quantity_bought - coalesce_sum_expression(
            f"{self.prefix}quantity", filter=self.filters.sold
        )

    @property
    def total_sold(self) -> Case:
        expression = (F(f"{self.prefix}price") - F(f"{self.prefix}initial_price")) * F(
            f"{self.prefix}quantity"
        )
        return Case(
            When(
                ~Q(**{f"{self.prefix}currency": TransactionCurrencies.real}),
                then=coalesce_sum_expression(expression, filter=self.filters.sold)
                # TODO: change this hardcoded conversion to a dynamic one
                * Value(Decimal("5.68")),
            ),
            default=coalesce_sum_expression(expression, filter=self.filters.sold),
        )

    @cached_property
    def total_bought(self) -> Case:
        expression = F(f"{self.prefix}price") * F(f"{self.prefix}quantity")
        return Case(
            When(
                ~Q(**{f"{self.prefix}currency": TransactionCurrencies.real}),
                then=coalesce_sum_expression(
                    expression,
                    filter=self.filters.bought,
                    # models.functions.Cast won't work;
                    # cast result to a decimal value using `extra`
                    extra=Decimal("1.0"),
                )
                # TODO: change this hardcoded conversion to a dynamic one
                * Value(Decimal("5.68")),
            ),
            default=coalesce_sum_expression(
                expression,
                filter=self.filters.bought,
                extra=Decimal("1.0"),
            ),
        )

    @cached_property
    def avg_price(self) -> Coalesce:
        return self.total_bought / self.quantity_bought

    def get_adjusted_avg_price(self, incomes: Union[Expression, Value]) -> CombinedExpression:
        return ((self.quantity_balance * self.avg_price) - incomes) / self.quantity_balance

    def get_total_adjusted(self, incomes: Union[Expression, Value]) -> CombinedExpression:
        return (self.quantity_balance * self.avg_price) - incomes - self.total_sold