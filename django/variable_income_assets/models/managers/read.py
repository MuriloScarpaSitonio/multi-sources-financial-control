from __future__ import annotations

from decimal import Decimal
from typing import Self

from django.db import models

from config.settings.dynamic import dynamic_settings

from ...choices import AssetsTotalInvestedReportAggregations, TransactionCurrencies


class _Expressions:
    def __init__(
        self,
        dollar_conversion_rate: Decimal | None = None,
    ) -> None:
        self.dollar_conversion_rate = (
            models.Value(dollar_conversion_rate)
            if dollar_conversion_rate is not None
            else models.Value(dynamic_settings.DOLLAR_CONVERSION_RATE)
        )

    @property
    def current_total_expression(self) -> models.Case:
        return self.get_dollar_conversion_expression(
            expression=models.F("current_price") * models.F("quantity_balance")
        )

    @property
    def normalized_roi_expression(self) -> models.Case:
        return self.get_dollar_conversion_expression(expression=models.F("roi"))

    @property
    def normalized_total_invested_expression(self) -> models.Case:
        return self.get_dollar_conversion_expression(expression=models.F("total_invested"))

    def get_dollar_conversion_expression(self, expression: models.Expression) -> models.Case:
        return models.Case(
            models.When(
                models.Q(currency=TransactionCurrencies.dollar),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )


class AssetReadModelQuerySet(models.QuerySet):
    expressions = _Expressions()

    def annotate_totals(self) -> Self:
        return self.annotate(
            current_total=self.expressions.current_total_expression,
            normalized_total_invested=self.expressions.normalized_total_invested_expression,
        )

    def opened(self) -> Self:
        return self.filter(
            models.Q(quantity_balance__gt=0)
            # if no currency it means that we couldn't get it from the transactions
            # which ultimately means that the asset has no transactions yet
            | models.Q(currency="")
        )

    def finished(self) -> Self:
        return self.filter(quantity_balance__lte=0)

    def indicators(self) -> dict[str, Decimal]:
        return self.annotate(
            current_total=self.expressions.current_total_expression,
            normalized_roi=self.expressions.normalized_roi_expression,
        ).aggregate(
            ROI=models.Sum("normalized_roi", default=Decimal()),
            ROI_opened=models.Sum(
                "normalized_roi", filter=models.Q(quantity_balance__gt=0), default=Decimal()
            ),
            ROI_finished=models.Sum(
                "normalized_roi", filter=models.Q(quantity_balance__lte=0), default=Decimal()
            ),
            total=models.Sum("current_total", default=Decimal()),
        )

    def total_invested_report(self, group_by: str, current: bool) -> Self:
        choice = AssetsTotalInvestedReportAggregations.get_choice(group_by)
        if current:
            qs = self.alias(current_total=self.expressions.current_total_expression)
        else:
            qs = self.alias(
                current_total=self.expressions.get_dollar_conversion_expression(
                    expression=models.F("avg_price") * models.F("quantity_balance")
                )
            )

        return (
            qs.values(choice.field_name)
            .annotate(total=models.Sum("current_total"))
            .filter(total__gt=0)
            .order_by("-total")
        )

    def roi_report(self, opened: bool = True, finished: bool = True) -> Self:
        qs = (
            self.alias(normalized_roi=self.expressions.normalized_roi_expression)
            .values("type")
            .annotate(total=models.Sum("normalized_roi"))
            .order_by("-total")
        )
        if opened and not finished:
            qs = qs.opened()
        if finished and not opened:
            qs = qs.finished()
        if not opened and not finished:
            qs = qs.none()

        return qs
