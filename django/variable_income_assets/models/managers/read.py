from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Self

from django.db import models

from ...adapters import DjangoSQLAssetMetaDataRepository
from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import AssetsTotalInvestedReportAggregations, AssetTypes, Currencies

if TYPE_CHECKING:
    from ...adapters.sql import AbstractAssetMetaDataRepository


class _Filters:
    @property
    def _without_closed_roi(self) -> models.Q:
        # bug em potencial se um ativo for fechado, mas o roi de fato for zero.
        # ideal seria persistir o count de transactions ou closed operations
        return models.Q(normalized_closed_roi=0)

    @property
    def opened(self) -> models.Q:
        return models.Q(quantity_balance__gt=0) | self._without_closed_roi

    @property
    def closed(self) -> models.Q:
        return models.Q(quantity_balance__lte=0) & ~self._without_closed_roi


class _Expressions:
    def __init__(
        self,
        metadata_repository: AbstractAssetMetaDataRepository,
        dollar_conversion_rate: Decimal | None = None,
    ) -> None:
        self.dollar_conversion_rate = (
            models.Value(dollar_conversion_rate)
            if dollar_conversion_rate is not None
            else models.Value(get_dollar_conversion_rate())
        )
        self.metadata_repository = metadata_repository
        self.filters = _Filters()

    @property
    def normalized_current_total(self) -> models.Case:
        return self.get_dollar_conversion_expression(
            expression=self.metadata_repository.get_current_price_annotation(source="read")
            * models.F("quantity_balance")
        )

    @property
    def normalized_total_invested(self) -> models.Case:
        return models.F("normalized_avg_price") * models.F("quantity_balance")

    @property
    def normalized_roi(self) -> models.Case:
        return models.Case(
            models.When(
                models.Q(self.filters.opened),
                then=(
                    self.normalized_current_total
                    - (
                        models.F("normalized_total_bought")
                        - models.F("normalized_credited_incomes")
                        - models.F("normalized_total_sold")
                    )
                ),
            ),
            default=models.F("normalized_closed_roi"),
        )

    # TODO: evaluate this query to see if it's worth to add it for closed assets
    # as will be used quite rarely and might degradate performance
    # @property
    # def roi_percentage(self) -> models.Case:
    #     from ...models import AssetClosedOperation

    #     return models.Case(
    #         models.When(
    #             models.Q(self.filters.opened),
    #             then=(
    #                 (
    #                     models.F("normalized_roi")
    #                     / (
    #                         models.F("normalized_total_bought")
    #                         * models.functions.Cast(1.0, models.DecimalField())
    #                     )
    #                 )
    #                 * Decimal("100.0")
    #             ),
    #         ),
    #         default=(
    #             models.Subquery(
    #                AssetClosedOperation.objects.filter(asset_id=models.OuterRef("write_model_pk"))
    #                 .alias(
    #                     _normalized_roi=(
    #                        models.F("normalized_total_sold") - models.F("normalized_total_bought")
    #                     )
    #                 )
    #                 .alias(
    #                     normalized_roi=models.Sum("_normalized_roi"),
    #                     agg_normalized_total_bought=models.Sum("normalized_total_bought"),
    #                 )
    #                 .annotate(
    #                     roi_percentage=(
    #                         (
    #                             models.F("normalized_roi")
    #                             / (
    #                                 models.F("agg_normalized_total_bought")
    #                                 * models.functions.Cast(1.0, models.DecimalField())
    #                             )
    #                         )
    #                         * Decimal("100.0")
    #                     )
    #                 )
    #                 .values("roi_percentage")[:1]
    #             )
    #         ),
    #     )

    @property
    def roi_percentage(self) -> models.CombinedExpression:
        return models.functions.Coalesce(
            models.F("normalized_roi")
            / (
                models.F("normalized_total_bought")
                * models.functions.Cast(1.0, models.DecimalField())
            ),
            Decimal(),
        ) * Decimal("100.0")

    def get_dollar_conversion_expression(self, expression: models.Expression) -> models.Case:
        return models.Case(
            models.When(
                models.Q(currency=Currencies.dollar),
                then=expression * self.dollar_conversion_rate,
            ),
            default=expression,
        )


class AssetReadModelQuerySet(models.QuerySet):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.expressions = _Expressions(metadata_repository=DjangoSQLAssetMetaDataRepository)

    def opened(self) -> Self:
        return self.filter(self.expressions.filters.opened)

    def closed(self) -> Self:
        return self.filter(self.expressions.filters.closed)

    def stocks(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock)

    def stocks_usa(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.stock_usa)

    def cryptos(self) -> Self:  # pragma: no cover
        return self.filter(type=AssetTypes.crypto)

    def annotate_normalized_current_total(self) -> Self:
        return self.annotate(normalized_current_total=self.expressions.normalized_current_total)

    def annotate_normalized_total_invested(self) -> Self:
        return self.annotate(normalized_total_invested=self.expressions.normalized_total_invested)

    def annotate_normalized_roi(self) -> Self:
        return self.annotate(normalized_roi=self.expressions.normalized_roi)

    def annotate_roi_percentage(self) -> Self:
        return self.annotate(roi_percentage=self.expressions.roi_percentage)

    def annotate_for_serializer(self) -> Self:
        return (
            self.annotate_normalized_total_invested()
            .annotate_normalized_roi()
            .annotate_roi_percentage()
        )

    def indicators(self) -> dict[str, Decimal]:
        return (
            self.annotate_normalized_current_total()
            .annotate_normalized_roi()
            .aggregate(
                ROI_opened=models.Sum(
                    "normalized_roi",
                    filter=models.Q(self.expressions.filters.opened),
                    default=Decimal(),
                ),
                ROI_closed=models.Sum(
                    "normalized_roi",
                    filter=models.Q(quantity_balance__lte=0),
                    default=Decimal(),
                ),
                total=models.Sum("normalized_current_total", default=Decimal()),
            )
        )

    def total_invested_report(self, group_by: str, current: bool) -> Self:
        choice = AssetsTotalInvestedReportAggregations.get_choice(group_by)
        if current:
            qs = self.alias(normalized_total=self.expressions.normalized_current_total)
        else:
            qs = self.alias(normalized_total=self.expressions.normalized_total_invested)

        f = "metadata__sector" if choice.field_name == "sector" else choice.field_name
        qs = (
            qs.values(f)
            .annotate(total=models.Sum("normalized_total"))
            .filter(total__gt=0)
            .order_by("-total")
        )
        return (
            qs
            if f == choice.field_name
            else qs.annotate(**{choice.field_name: models.F(f)}).values(choice.field_name, "total")
        )

    def roi_report(self, opened: bool = True, closed: bool = True) -> Self:
        qs = (
            self.alias(
                normalized_roi=models.Case(
                    models.When(
                        self.expressions.filters.opened,
                        then=self.expressions.normalized_roi,
                    ),
                    default=models.F("normalized_closed_roi"),
                )
            )
            .values("type")
            .annotate(total=models.Sum("normalized_roi"))
            .order_by("-total")
        )
        if opened and not closed:
            qs = qs.opened()
        if closed and not opened:
            qs = qs.closed()
        if not opened and not closed:
            qs = qs.none()

        return qs
