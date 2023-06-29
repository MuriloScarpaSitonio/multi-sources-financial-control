from __future__ import annotations

from decimal import Decimal
from typing import Self, TYPE_CHECKING

from django.db import models

from config.settings.dynamic import dynamic_settings

from ...adapters.repositories import DjangoSQLAssetMetaDataRepository
from ...choices import AssetsTotalInvestedReportAggregations, TransactionCurrencies

if TYPE_CHECKING:
    from ...adapters.repositories import AbstractAssetMetaDataRepository


class _Expressions:
    def __init__(
        self,
        metadata_repository: AbstractAssetMetaDataRepository,
        dollar_conversion_rate: Decimal | None = None,
    ) -> None:
        self.dollar_conversion_rate = (
            models.Value(dollar_conversion_rate)
            if dollar_conversion_rate is not None
            else models.Value(dynamic_settings.DOLLAR_CONVERSION_RATE)
        )
        self.metadata_repository = metadata_repository

    @property
    def current_total_expression(self) -> models.Case:
        return self.get_dollar_conversion_expression(
            expression=self.metadata_repository.get_current_price_annotation()
            * models.F("quantity_balance")
        )

    @property
    def normalized_total_invested_expression(self) -> models.Case:
        return self.get_dollar_conversion_expression(expression=models.F("total_invested"))

    def get_roi_expression(
        self, normalized: bool = False
    ) -> models.CombinedExpression | models.Case:
        expression = (
            models.F("quantity_balance") * self.metadata_repository.get_current_price_annotation()
        ) - models.F("total_invested_adjusted")
        return (
            self.get_dollar_conversion_expression(expression=expression)
            if normalized
            else expression
        )

    def get_dollar_conversion_expression(self, expression: models.Expression) -> models.Case:
        return models.Case(
            models.When(
                models.Q(currency=TransactionCurrencies.dollar),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )


class AssetReadModelQuerySet(models.QuerySet):
    expressions = _Expressions(metadata_repository=DjangoSQLAssetMetaDataRepository)

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
            normalized_roi=self.expressions.get_roi_expression(normalized=True),
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
        f = "metadata__sector" if choice.field_name == "sector" else choice.field_name
        qs = (
            qs.values(f)
            .annotate(total=models.Sum("current_total"))
            .filter(total__gt=0)
            .order_by("-total")
        )
        return (
            qs
            if f == choice.field_name
            else qs.annotate(**{choice.field_name: models.F(f)}).values(choice.field_name, "total")
        )

    def roi_report(self, opened: bool = True, finished: bool = True) -> Self:
        qs = (
            self.alias(normalized_roi=self.expressions.get_roi_expression(normalized=True))
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
