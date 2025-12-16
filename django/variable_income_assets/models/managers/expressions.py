from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Case, F, Q, Sum, Value, When
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Coalesce, Greatest

from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import TransactionActions

if TYPE_CHECKING:
    from django.db.models import Combinable, Expression


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
            * self.get_quantity()
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

    def get_normalized_total_sold(self) -> CombinedExpression:
        return self.sum(
            F(f"{self.prefix}price")
            * self.get_quantity()
            * F(f"{self.prefix}current_currency_conversion_rate"),
            filter=self.filters.sold,
            cast=True,
        )

    def get_current_normalized_total_sold(self) -> CombinedExpression:
        return self.get_normalized_total_sold() - self.closed_operations_normalized_total_sold

    def get_quantity(self) -> Combinable:
        return Coalesce(F(f"{self.prefix}quantity"), Value(Decimal("1.0")))

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
            F(f"{self.prefix}price") * self.get_quantity(),
            filter=Q(self.filters.bought, extra_filters),
        )

    def get_normalized_total_bought(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.sum(
            (
                F(f"{self.prefix}price")
                * self.get_quantity()
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
            self.get_quantity(),
            filter=Q(self.filters.bought, extra_filters),
        )

    def get_quantity_balance(self, extra_filters: Q | None = None) -> CombinedExpression:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return self.get_quantity_bought(extra_filters=extra_filters) - self.sum(
            self.get_quantity(), filter=Q(self.filters.sold, extra_filters)
        )

    def get_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        return Coalesce(
            self.get_total_bought(extra_filters=extra_filters)
            / Greatest(
                self.get_quantity_bought(extra_filters=extra_filters), Value(Decimal("1.0"))
            ),
            Decimal(),
        )

    def get_current_normalized_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        _extra_filters = extra_filters if extra_filters is not None else Q()
        quantity = (
            (self.get_quantity_bought(_extra_filters) - self.closed_operations_quantity_bought)
            # sem filtros extras devemos com certeza diminuir as operações finalizadas,
            # uma vez que estamos considerando todas as transações.
            # com filtros extras, nao temos como garantir que os valores agregados das
            # operações finalizadas estarão incluídos no aggregation, logo, retirá-los
            # pode introduzir erros.
            # assume-se, então, que se passarmos filtros, cuidaremos para incluir ou
            # nao as transações desejadas.
            # EXEMPLO: cáclulo do IRPF
            if extra_filters is None
            else self.get_quantity_bought(_extra_filters)
        )
        return Coalesce(
            # Pass original extra_filters (not _extra_filters) to preserve None check
            self.get_normalized_current_total_bought(extra_filters)
            / Greatest(quantity, Value(Decimal("1.0"))),
            Decimal(),
        )

    def get_normalized_current_total_bought(
        self, extra_filters: Q | None = None
    ) -> CombinedExpression:
        _extra_filters = extra_filters if extra_filters is not None else Q()
        return (
            (
                self.get_normalized_total_bought(_extra_filters)
                - self.get_closed_operations_normalized_total_bought()
            )
            if extra_filters is None
            # sem filtros extras devemos com certeza diminuir as operações finalizadas,
            # uma vez que estamos considerando todas as transações.
            # com filtros extras, nao temos como garantir que os valores agregados das
            # operações finalizadas estarão incluídos no aggregation, logo, retirá-los
            # pode introduzir erros.
            # assume-se, então, que se passarmos filtros, cuidaremos para incluir ou
            # nao as transações desejadas.
            # EXEMPLO: cáclulo do IRPF
            else self.get_normalized_total_bought(_extra_filters)
        )

    def get_current_avg_price(self, extra_filters: Q | None = None) -> Coalesce:
        extra_filters = extra_filters if extra_filters is not None else Q()
        denominator = (
            self.get_quantity_bought(extra_filters=extra_filters)
            - self.closed_operations_quantity_bought
        )
        return Coalesce(
            (self.get_total_bought(extra_filters) - self.closed_operations_total_bought)
            / Greatest(denominator, Value(Decimal("1.0"))),
            Decimal(),
        )

    @staticmethod
    def sum(expression: Expression, cast: bool = True, **extra) -> Sum | CombinedExpression:
        s = Sum(expression, default=Decimal(), **extra)
        return s * Value(Decimal("1.0")) if cast else s

    def get_avg_price_held_in_self_custody(self):
        return Case(
            # aqui assumimos que uma renda fixa custodiada fora da b3 nunca terá um ROI negativo
            # logo, se há uma transação de venda e ela supera o total de compras, então devemos
            # encerrar a operação e o preço médio deve ser zero
            When(normalized_total_sold__gt=F("normalized_total_bought"), then=Value(Decimal())),
            default=F("normalized_total_bought") - F("normalized_total_sold"),
        )

    def get_quantity_balance_held_in_self_custody(self):
        return Case(
            # aqui assumimos que uma renda fixa custodiada fora da b3 nunca terá um ROI negativo
            # logo, se há uma transação de venda e ela supera o total de compras, então devemos
            # encerrar a operação e a quantidade deve ser zero
            When(
                Q(normalized_total_sold__gt=F("normalized_total_bought"))
                | Q(normalized_closed_roi__gt=0)
                | Q(normalized_total_bought=0),
                then=Value(Decimal()),
            ),
            default=Decimal("1.0"),
        )
