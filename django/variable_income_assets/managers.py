from decimal import Decimal
from typing import Dict, Iterable, Union

from django.db.models import F, Q, QuerySet, Sum
from django.db.models.expressions import CombinedExpression

from shared.managers_utils import SumMixin
from .choices import TransactionActions


class TransactionQuerySet(QuerySet, SumMixin):
    _bought_filter = Q(action=TransactionActions.buy)
    _sold_filter = Q(action=TransactionActions.sell)

    @staticmethod
    def get_sum_expression(sum_field_name: Union[str, Iterable[str]]) -> Dict[str, Sum]:
        if isinstance(sum_field_name, str):
            return {f"{sum_field_name}_sum": Sum(sum_field_name)}
        return {f"{field_name}_sum": Sum(field_name) for field_name in sum_field_name}

    def _get_ROI_expression(self, percentage: bool) -> Union[Sum, CombinedExpression]:
        expression = Sum(
            (F("price") - F("initial_price")) * F("quantity"),
            filter=self._sold_filter,
        )
        total_invested_expression = Sum(
            F("price") * F("quantity"),
            filter=self._bought_filter,
        )
        return (
            # models.functions.Cast won't work; cast result to a decimal value
            (expression * Decimal("1.0")) / total_invested_expression
            if percentage
            else expression
        )

    def bought(self) -> QuerySet:
        return self.filter(self._bought_filter)

    def sold(self) -> QuerySet:
        return self.filter(self._sold_filter)

    def avg_price(self, include_quantity: bool = False) -> QuerySet:
        """
        Args:
            include_quantity (bool, optional): True, se devemos incluir a quantidade dos ativos.
                False, do contrário. Defaults to False.
                Esse parâmetro é essencial para gerar a property adjusted_avg_price do model.
        """
        expressions = {
            "avg_price": (
                # models.functions.Cast won't work
                Sum(F("price") * F("quantity"))
                * Decimal("1.0")  # cast result to a decimal value
            )
            / Sum("quantity")
        }
        if include_quantity:
            expressions = {
                **expressions,
                **self.get_sum_expression(sum_field_name="quantity"),
            }
        return self.bought().aggregate(**expressions)

    def get_current_quantity(self) -> QuerySet:
        """A quantidade ajustada é a diferença entre transações de compra e de venda"""
        return self.aggregate(
            quantity=Sum("quantity", filter=self._bought_filter)
            - Sum("quantity", filter=self._sold_filter)
        )

    def roi(self, percentage: bool = False) -> QuerySet:
        """ROI: Return On Investment"""
        return self.aggregate(ROI=self._get_ROI_expression(percentage=percentage))


class PassiveIncomeQuerySet(QuerySet, SumMixin):
    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("amount")}

    def credited(self) -> QuerySet:
        return self.filter(credited_at__isnull=False)
