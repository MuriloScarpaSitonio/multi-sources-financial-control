from decimal import Decimal

from django.db.models import Case, DecimalField, Expression, F, Q, Sum, Value, When
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Cast, Coalesce

from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import Currencies, TransactionActions


class _GenericQueryHelperIntializer:
    def __init__(self, prefix: str | None = None) -> None:
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
        prefix: str | None = None,
        dollar_conversion_rate: Decimal | None = None,
    ) -> None:
        super().__init__(prefix=prefix)
        self.dollar_conversion_rate = (
            Value(dollar_conversion_rate)
            if dollar_conversion_rate is not None
            else Value(get_dollar_conversion_rate())
        )
        self.filters = GenericQuerySetFilters(prefix=prefix)

    @property
    def total_sold(self) -> CombinedExpression:
        return Sum(
            (F(f"{self.prefix}price") - F(f"{self.prefix}initial_price"))
            * F(f"{self.prefix}quantity"),
            filter=self.filters.sold,
            default=Decimal(),
            # I don't know why an out `Cast` doesn't work...
        ) * Cast(1.0, DecimalField())

    @property
    def normalized_total_sold(self) -> CombinedExpression:
        expression = (F(f"{self.prefix}price") - F(f"{self.prefix}initial_price")) * F(
            f"{self.prefix}quantity"
        )
        return Sum(
            Case(
                When(
                    # hacky because the currency goes the other way around
                    Q(**{f"{'asset__' if not self.prefix else ''}currency": Currencies.dollar}),
                    then=expression * F(f"{self.prefix}current_currency_conversion_rate"),
                ),
                default=expression,
            ),
            filter=self.filters.sold,
            default=Decimal(),
            # I don't know why an out `Cast` doesn't work...
        ) * Cast(1.0, DecimalField())

    @property
    def total_sold_raw(self) -> Case:
        expression = Sum(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=self.filters.sold,
            default=Decimal(),
        )
        # I don't know why an out `Cast` doesn't work...
        return self.get_dollar_conversion_expression(
            expression=expression * Cast(1.0, DecimalField())
        )

    @property
    def total_bought_normalized(self) -> Case:
        expression = Sum(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=self.filters.bought,
            default=Decimal(),
        )
        # I don't know why an out `Cast` doesn't work...
        return self.get_dollar_conversion_expression(
            expression=expression * Cast(1.0, DecimalField())
        )

    @property
    def current_total(self) -> Case:
        return Coalesce(F("current_price_metadata"), Decimal()) * self.get_quantity_balance()

    def get_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Coalesce(
            self.get_total_bought(extra_filters=extra_filters)
            / self.get_quantity_bought(extra_filters=extra_filters),
            Decimal(),
        )

    def get_total_bought(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Sum(
            F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
            filter=Q(self.filters.bought, extra_filters),
            default=Decimal()
            # I don't know why an out `Cast` doesn't work...
        ) * Cast(1.0, DecimalField())

    def get_quantity_bought(self, extra_filters: Q | None = None) -> Sum:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Sum(
            f"{self.prefix}quantity",
            filter=Q(self.filters.bought, extra_filters),
            default=Decimal(),
        )

    def get_quantity_balance(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.get_quantity_bought(extra_filters=extra_filters) - Sum(
            f"{self.prefix}quantity", filter=Q(self.filters.sold, extra_filters), default=Decimal()
        )

    def get_dollar_conversion_expression(self, expression: Expression) -> Case:
        # hacky because the currency goes the other way around
        prefix = "asset__" if not self.prefix else ""
        return Case(
            When(
                Q(**{f"{prefix}currency": Currencies.dollar}),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )

    def get_adjusted_avg_price(self, incomes: Expression | Value) -> Coalesce:
        return Coalesce(
            ((self.get_quantity_balance() * self.get_avg_price()) - incomes)
            / self.get_quantity_balance(),
            Decimal(),
        )

    def get_total_adjusted(self, incomes: Expression | Value) -> CombinedExpression:
        return (self.get_quantity_balance() * self.get_avg_price()) - incomes - self.total_sold

    def get_total_raw_expression(self, aggregate: bool = False, **kwargs) -> Case:
        expression = (
            Sum(
                F(f"{self.prefix}price") * F(f"{self.prefix}quantity"),
                edefault=Decimal(),
                **kwargs,
            )
            * Cast(1.0, DecimalField())
            if aggregate
            else F(f"{self.prefix}price") * F(f"{self.prefix}quantity")
        )
        return self.get_dollar_conversion_expression(expression=expression)
