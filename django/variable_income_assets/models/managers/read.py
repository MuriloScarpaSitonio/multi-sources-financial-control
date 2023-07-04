from __future__ import annotations

from decimal import Decimal
from typing import Self, TYPE_CHECKING

from django.db import models

from config.settings.dynamic import dynamic_settings

from ...adapters.repositories import DjangoSQLAssetMetaDataRepository
from ...choices import AssetsTotalInvestedReportAggregations, Currencies

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
    def normalized_current_total(self) -> models.Case:
        return self.get_dollar_conversion_expression(
            expression=self.metadata_repository.get_current_price_annotation()
            * models.F("quantity_balance")
        )

    @property
    def normalized_total_invested(self) -> models.Case:
        return self.get_dollar_conversion_expression(
            expression=models.F("avg_price") * models.F("quantity_balance")
        )

    @property
    def normalized_roi(self) -> models.CombinedExpression:
        current_total = models.F("quantity_balance") * self.get_dollar_conversion_expression(
            self.metadata_repository.get_current_price_annotation()
        )
        total_invested = self.get_dollar_conversion_expression(models.F("avg_price")) * models.F(
            "quantity_balance"
        )
        return current_total - (
            total_invested
            - models.F("normalized_credited_incomes")
            - models.F("normalized_total_sold")
        )

    def get_dollar_conversion_expression(self, expression: models.Expression) -> models.Case:
        return models.Case(
            models.When(
                models.Q(currency=Currencies.dollar),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )


class AssetReadModelQuerySet(models.QuerySet):
    expressions = _Expressions(metadata_repository=DjangoSQLAssetMetaDataRepository)

    def opened(self) -> Self:
        return self.filter(
            models.Q(quantity_balance__gt=0)
            # if no currency it means that we couldn't get it from the transactions
            # which ultimately means that the asset has no transactions yet
            | models.Q(total_bought=0)
        )

    def finished(self) -> Self:
        return self.filter(quantity_balance__lte=0)

    def annotate_normalized_current_total(self) -> Self:
        return self.annotate(normalized_current_total=self.expressions.normalized_current_total)

    def annotate_normalized_total_invested(self) -> Self:
        return self.annotate(normalized_total_invested=self.expressions.normalized_total_invested)

    def indicators(self) -> dict[str, Decimal]:
        return (
            self.annotate_normalized_current_total()
            .annotate(normalized_roi=self.expressions.normalized_roi)
            .aggregate(
                ROI=models.Sum("normalized_roi", default=Decimal()),
                ROI_opened=models.Sum(
                    "normalized_roi", filter=models.Q(quantity_balance__gt=0), default=Decimal()
                ),
                ROI_finished=models.Sum(
                    "normalized_roi", filter=models.Q(quantity_balance__lte=0), default=Decimal()
                ),
                total=models.Sum("normalized_current_total", default=Decimal()),
            )
        )

    def total_invested_report(self, group_by: str, current: bool) -> Self:
        choice = AssetsTotalInvestedReportAggregations.get_choice(group_by)
        if current:
            qs = self.alias(normalized_current_total=self.expressions.normalized_current_total)
        else:
            qs = self.alias(
                normalized_current_total=self.expressions.get_dollar_conversion_expression(
                    expression=models.F("avg_price") * models.F("quantity_balance")
                )
            )
        f = "metadata__sector" if choice.field_name == "sector" else choice.field_name
        qs = (
            qs.values(f)
            .annotate(total=models.Sum("normalized_current_total"))
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
            self.alias(normalized_roi=self.expressions.normalized_roi)
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
