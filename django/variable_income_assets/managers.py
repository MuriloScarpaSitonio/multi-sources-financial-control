from decimal import Decimal
from typing import Dict, Union

from django.db.models import Case, F, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Coalesce
from django.db.models.query import QuerySet

from shared.managers_utils import CustomQueryset, IndicatorsMixin, MonthlyFilterMixin
from shared.utils import coalesce_sum_expression

from .choices import AssetTypes, PassiveIncomeEventTypes, TransactionCurrencies
from .expressions import GenericQuerySetExpressions


class AssetQuerySet(CustomQueryset):
    expressions = GenericQuerySetExpressions(prefix="transactions")

    @staticmethod
    def _get_passive_incomes_subquery(
        field_name: str = "credited_incomes",
    ) -> "PassiveIncomeQuerySet":
        from .models import PassiveIncome  # avoid circular ImportError

        return (
            PassiveIncome.objects.filter(asset=OuterRef("pk"))
            .values("asset__pk")  # group by as we can't aggregate directly
            .credited()
            .annotate(**{field_name: Sum("amount")})
            .values(field_name)
        )

    def _annotate_quantity_balance(self) -> "AssetQuerySet":
        return self.annotate(quantity_balance=self.expressions.quantity_balance).order_by()

    def opened(self) -> "AssetQuerySet":
        return self._annotate_quantity_balance().filter(quantity_balance__gt=0)

    def finished(self) -> "AssetQuerySet":
        return self._annotate_quantity_balance().filter(quantity_balance__lte=0)

    def stocks(self):
        return self.filter(type=AssetTypes.stock)

    def cryptos(self):
        return self.filter(type=AssetTypes.crypto)

    def current_total(self):
        return self.annotate(total=self.expressions.current_total).aggregate(
            current_total=Sum("total")
        )

    def total_invested(self):
        return self.annotate(
            total=self.expressions.avg_price * self.expressions.quantity_balance
        ).aggregate(total_invested=Sum("total"))

    def annotate_roi(
        self, percentage: bool = False, annotate_passive_incomes_subquery: bool = True
    ) -> "AssetQuerySet":
        if annotate_passive_incomes_subquery:
            subquery = self._get_passive_incomes_subquery()

        ROI = self.expressions.current_total - self.expressions.get_total_adjusted(
            incomes=Coalesce(F("credited_incomes_total"), Decimal())
        )
        if percentage:
            expression = (ROI / self.expressions.total_bought) * Decimal("100.0")
            field_name = "roi_percentage"
        else:
            expression = ROI
            field_name = "roi"

        return (
            self.annotate(
                credited_incomes_total=Subquery(subquery.values("credited_incomes"))
            ).annotate(**{field_name: Coalesce(expression, Decimal())})
            if annotate_passive_incomes_subquery
            else self.annotate(**{field_name: Coalesce(expression, Decimal())})
        )

    def annotate_adjusted_avg_price(
        self, annotate_passive_incomes_subquery: bool = True
    ) -> "AssetQuerySet":
        if annotate_passive_incomes_subquery:
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

    def annotate_total_adjusted_invested(self):  # pragma: no cover
        return self.annotate(
            total_adjusted_invested=F("adjusted_avg_price") * F("quantity_balance")
        )

    def annotate_avg_price(self) -> "AssetQuerySet":
        return self.annotate(avg_price=self.expressions.avg_price)

    def annotate_total_invested(self):
        return self.annotate(total_invested=F("avg_price") * F("quantity_balance"))

    def annotate_for_serializer(self) -> "AssetQuerySet":
        return (
            self.annotate_roi()
            .annotate_roi(percentage=True, annotate_passive_incomes_subquery=False)
            .annotate_adjusted_avg_price(annotate_passive_incomes_subquery=False)
            .annotate_avg_price()
            .annotate_total_invested()
        )

    def report(self):
        from .models import Transaction  # avoid circular ImportError

        subquery = (
            Transaction.objects.filter(asset=OuterRef("pk"))
            .values("asset__pk")  # group by as we can't aggregate directly
            .annotate(balance=TransactionQuerySet.expressions.quantity_balance)
        )

        # expression = Case(
        #     When(
        #         ~Q(transactions__currency=TransactionCurrencies.real),
        #         # TODO: change this hardcoded conversion to a dynamic one
        #         then=Sum(
        #             Coalesce((F("current_price") * Value(Decimal("5.68"))), Decimal())
        #             * F("transactions_balance")
        #         ),
        #     ),
        #     default=Sum(Coalesce("current_price", Decimal()) * F("transactions_balance")),
        # )

        return (
            self.annotate(transactions_balance=Subquery(subquery.values("balance")))
            .filter(transactions_balance__gt=0)
            .values("type")
            .annotate(total=Sum(Coalesce("current_price", Decimal()) * F("transactions_balance")))
            .order_by("-total")
        )


class TransactionQuerySet(QuerySet):
    expressions = GenericQuerySetExpressions()

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

    def bought(self) -> "TransactionQuerySet":
        return self.filter(self.expressions.filters.bought)

    def sold(self) -> "TransactionQuerySet":
        return self.filter(self.expressions.filters.sold)

    def avg_price(self, incomes: Decimal = Decimal()) -> Dict[str, Decimal]:
        expression = (
            self.expressions.get_adjusted_avg_price(incomes=Value(incomes))
            if incomes
            else self.expressions.avg_price
        )
        return self.aggregate(avg_price=expression)

    def get_current_quantity(self) -> Dict[str, Decimal]:
        """A quantidade ajustada é a diferença entre transações de compra e de venda"""
        return self.aggregate(quantity=self.expressions.quantity_balance)

    def roi(self, incomes: Decimal, percentage: bool = False) -> Dict[str, Decimal]:
        """ROI: Return On Investment"""
        return self.aggregate(ROI=self._get_roi_expression(incomes=incomes, percentage=percentage))


class PassiveIncomeQuerySet(CustomQueryset, IndicatorsMixin, MonthlyFilterMixin):
    DATE_FIELD_NAME = "operation_date"

    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": coalesce_sum_expression("amount")}

    def credited(self) -> "PassiveIncomeQuerySet":
        return self.filter(event_type=PassiveIncomeEventTypes.credited)

    def provisioned(self) -> "PassiveIncomeQuerySet":
        return self.filter(event_type=PassiveIncomeEventTypes.provisioned)
