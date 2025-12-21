from __future__ import annotations

from decimal import Decimal
from statistics import fmean
from typing import TYPE_CHECKING

from django.db import transaction as djtransaction
from django.db.models import BooleanField, Case, F, Sum, Value, When
from django.utils import timezone

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.generics import get_object_or_404
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_204_NO_CONTENT
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from shared.permissions import SubscriptionEndedPermission
from shared.utils import (
    insert_zeros_if_no_data_in_monthly_historic_data,
    insert_zeros_if_no_data_in_yearly_historic_data,
)
from variable_income_assets.models.managers.write import AssetClosedOperationQuerySet

from . import choices, filters, serializers
from .adapters.key_value_store import get_dollar_conversion_rate
from .domain import events
from .models import (
    Asset,
    AssetClosedOperation,
    AssetMetaData,
    AssetReadModel,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)
from .models.managers import (
    AssetQuerySet,
    AssetReadModelQuerySet,
    PassiveIncomeQuerySet,
    TransactionQuerySet,
)
from .permissions import InvestmentsModulePermission
from .service_layer import messagebus
from .service_layer.unit_of_work import DjangoUnitOfWork

if TYPE_CHECKING:  # pragma: no cover
    from datetime import date

    from django_filters import FilterSet
    from djchoices import ChoiceItem
    from rest_framework.request import Request
    from rest_framework.serializers import Serializer
    from rest_framework.utils.serializer_helpers import ReturnList


class AssetViewSet(
    GenericViewSet, ListModelMixin, CreateModelMixin, UpdateModelMixin, DestroyModelMixin
):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    filter_backends = (filters.CQRSDjangoFilterBackend, OrderingFilter)
    ordering_fields = ("code", "normalized_total_invested", "normalized_roi", "roi_percentage")

    def _is_write_action(self) -> bool:
        return self.action in ("create", "update", "destroy", "update_price")

    def get_queryset(self) -> AssetReadModelQuerySet[AssetReadModel] | AssetQuerySet[Asset]:
        if self.request.user.is_authenticated:
            if self._is_write_action():
                return Asset.objects.filter(user_id=self.request.user.id)
            qs = AssetReadModel.objects.select_related("metadata").filter(
                user_id=self.request.user.id
            )
            return (
                qs.annotate_for_serializer().order_by("-normalized_total_invested")
                if self.action == "list"
                else qs
            )
        return AssetReadModel.objects.none()  # pragma: no cover -- drf-spectacular

    def get_filterset_class(self) -> FilterSet:
        return filters.AssetFilterSet if self._is_write_action() else filters.AssetReadFilterSet

    def get_serializer_class(self):
        return (
            serializers.AssetReadModelSerializer
            if self.action == "list"
            else serializers.AssetSerializer
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return (
            {
                **context,
                **(
                    self.get_queryset().aggregate(
                        total_invested_agg=Sum("normalized_total_invested")
                    )
                ),
            }
            if self.action == "list"
            else context
        )

    @djtransaction.atomic
    def perform_destroy(self, instance: Asset) -> None:
        AssetReadModel.objects.filter(write_model_pk=instance.pk).delete()
        super().perform_destroy(instance)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()
        last_snapshot = dict(
            AssetsTotalInvestedSnapshot.objects.filter(user_id=self.request.user.id)
            .order_by("-operation_date")
            .values("total")
            .first()
            or {}
        )
        total_diff_percentage = (
            ((qs["total"]) / last_snapshot.get("total", 1)) - Decimal("1.0")
        ) * Decimal("100.0")
        serializer = serializers.AssetRoidIndicatorsSerializer(
            {**qs, "total_diff_percentage": total_diff_percentage}
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> type[Serializer]:
        module = __import__("variable_income_assets.serializers", fromlist=[choice.serializer_name])
        return getattr(module, choice.serializer_name)

    def _get_report_data(self, filterset: FilterSet) -> ReturnList:
        qs = filterset.qs
        choice = choices.AssetsReportsAggregations.get_choice(value=filterset.form.data["group_by"])
        Serializer = self._get_report_serializer_class(choice=choice)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def reports(self, request: Request) -> Response:
        filterset = filters.AssetReportsFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(self._get_report_data(filterset=filterset), status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def total_invested_history(self, request: Request) -> Response:
        qs = (
            AssetsTotalInvestedSnapshot.objects.filter(user_id=request.user.id)
            .order_by("operation_date")
            .values("total", "operation_date")
        )
        filterset = filters.MonthlyDateRangeFilterSet(data=request.GET, queryset=qs)
        serializer = serializers.AssetsTotalInvestedSnapshotSerializer(
            data=insert_zeros_if_no_data_in_monthly_historic_data(
                filterset.qs,
                start_date=filterset.form.cleaned_data["start_date"],
                end_date=filterset.form.cleaned_data["end_date"],
                month_field="operation_date",
            ),
            many=True,
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def minimal_data(self, request: Request) -> Response:
        # TODO: change `list` endpoint to support `fields` kwarg on serializer and set the return
        # values by doing `/assets?fields=code,currency`
        filterset = filters.AssetReadStatusFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(
            data=filterset.qs.annotate(
                pk=F("write_model_pk"),
                is_held_in_self_custody=Case(
                    When(metadata__asset_id__isnull=False, then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
            )
            .values("code", "currency", "pk", "is_held_in_self_custody")
            .order_by("code"),
            status=HTTP_200_OK,
        )

    @action(methods=("PATCH",), detail=True)
    def update_price(self, request: Request, **_) -> Response:
        serializer = serializers.AssetMetadataWriteSerializer(self.get_object(), data=request.data)
        serializer.is_valid(raise_exception=True)
        AssetMetaData.objects.filter(asset_id=serializer.instance.id).update(
            current_price=serializer.validated_data["current_price"],
            current_price_updated_at=timezone.now(),
        )
        return Response(status=HTTP_204_NO_CONTENT)


class TransactionViewSet(ModelViewSet):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.TransactionListSerializer
    filterset_class = filters.TransactionFilterSet
    ordering_fields = ("operation_date", "asset__code")
    ordering = ("-operation_date",)

    def get_queryset(self) -> TransactionQuerySet[Transaction]:
        if self.request.user.is_authenticated:
            qs = Transaction.objects.filter(asset__user_id=self.request.user.pk)
            return (
                qs.select_related("asset")
                if self.action in ("list", "retrieve", "update", "destroy")
                else qs
            )

        return Transaction.objects.none()  # pragma: no cover -- drf-spectacular

    def perform_destroy(self, instance: Transaction):
        serializers.TransactionListSerializer(instance=instance).delete()

    @action(methods=("GET",), detail=False)
    def sum(self, request: Request) -> Response:
        filterset = filters.DateRangeFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(
            serializers.TransactionsSumSerializer(filterset.qs.sum()).data, status=HTTP_200_OK
        )

    @action(methods=("GET",), detail=False)
    def avg(self, _: Request) -> Response:
        return Response(
            serializers.AvgSerializer(self.get_queryset().since_a_year_ago_monthly_avg()).data,
            status=HTTP_200_OK,
        )

    @action(methods=("GET",), detail=False)
    def historic_report(self, request: Request) -> Response:
        filterset = filters.MonthlyDateRangeFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        qs = filterset.qs  # triggers validation
        aggregate_period = filterset.form.cleaned_data.get("aggregate_period") or "month"
        kwargs = {
            "historic": list(qs.historic(aggregate_period)),
            "start_date": filterset.form.cleaned_data["start_date"],
            "end_date": filterset.form.cleaned_data["end_date"],
            "total_fields": ("total_bought", "total_sold", "diff"),
        }
        if aggregate_period == "month":
            historic = insert_zeros_if_no_data_in_monthly_historic_data(**kwargs)
            serializer = serializers.TransactionHistoricSerializer(
                {"historic": historic, "avg": fmean([h["diff"] for h in historic])}
            )
        else:
            historic = insert_zeros_if_no_data_in_yearly_historic_data(**kwargs)
            serializer = serializers.TransactionYearlyHistoricSerializer(
                {"historic": historic, "avg": fmean([h["diff"] for h in historic])}
            )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def total_bought_per_asset_type_report(self, request: Request) -> Response:
        filterset = filters.DateRangeFilterSet(data=request.GET, queryset=self.get_queryset())
        qs = filterset.qs.filter_bought_and_group_by_asset_type()
        serializer = serializers.TransactionsAssetTypeReportSerializer(qs, many=True)
        return Response(serializer.data, status=HTTP_200_OK)


class PassiveIncomeViewSet(ModelViewSet):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.PassiveIncomeSerializer
    filterset_class = filters.PassiveIncomeFilterSet
    ordering_fields = ("operation_date", "amount", "asset__code")
    ordering = ("-operation_date", "id")

    def get_queryset(self) -> PassiveIncomeQuerySet[PassiveIncome]:
        return (
            PassiveIncome.objects.select_related("asset").filter(
                asset__user_id=self.request.user.pk
            )
            if self.request.user.is_authenticated
            else PassiveIncome.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_create(self, serializer: serializers.PassiveIncomeSerializer) -> None:
        super().perform_create(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.asset_id) as uow:
            messagebus.handle(
                message=events.PassiveIncomeCreated(asset_pk=serializer.instance.asset_id), uow=uow
            )

    def perform_update(self, serializer: serializers.PassiveIncomeSerializer) -> None:
        super().perform_update(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.asset_id) as uow:
            messagebus.handle(
                message=events.PassiveIncomeUpdated(asset_pk=serializer.instance.asset_id), uow=uow
            )

    def perform_destroy(self, instance: PassiveIncome):
        super().perform_destroy(instance)
        with DjangoUnitOfWork(asset_pk=instance.asset_id) as uow:
            messagebus.handle(
                message=events.PassiveIncomeDeleted(asset_pk=instance.asset_id), uow=uow
            )

    # TODO: consider using same endpoint to return both sums
    @action(methods=("GET",), detail=False)
    def sum_credited(self, request: Request) -> Response:
        filterset = filters.DateRangeFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(
            serializers.TotalSerializer(filterset.qs.sum_credited()).data,
            status=HTTP_200_OK,
        )

    @action(methods=("GET",), detail=False)
    def sum_provisioned_future(self, _: Request) -> Response:
        return Response(
            serializers.TotalSerializer(self.get_queryset().sum_provisioned_future()).data,
            status=HTTP_200_OK,
        )

    #

    @action(methods=("GET",), detail=False)
    def avg(self, _: Request) -> Response:
        return Response(
            serializers.AvgSerializer(
                self.get_queryset().since_a_year_ago_credited_monthly_avg()
            ).data,
            status=HTTP_200_OK,
        )

    @action(methods=("GET",), detail=False)
    def historic_report(self, request: Request) -> Response:
        filterset = filters.MonthlyDateRangeFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        qs = filterset.qs  # triggers validation
        aggregate_period = filterset.form.cleaned_data.get("aggregate_period") or "month"
        kwargs = {
            "historic": list(qs.historic(aggregate_period)),
            "start_date": filterset.form.cleaned_data["start_date"],
            "end_date": filterset.form.cleaned_data["end_date"],
            "total_fields": ("credited", "provisioned"),
        }
        if aggregate_period == "month":
            historic = insert_zeros_if_no_data_in_monthly_historic_data(**kwargs)
            serializer = serializers.PassiveIncomeHistoricSerializer(
                {"historic": historic, "avg": fmean([h["credited"] for h in historic])}
            )
        else:
            historic = insert_zeros_if_no_data_in_yearly_historic_data(**kwargs)
            serializer = serializers.PassiveIncomeYearlyHistoricSerializer(
                {"historic": historic, "avg": fmean([h["credited"] for h in historic])}
            )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def assets_aggregation_report(self, request: Request) -> Response:
        filterset = filters.DateRangeFilterSet(data=request.GET, queryset=self.get_queryset())
        qs: PassiveIncomeQuerySet = filterset.qs
        serializer = serializers.PassiveIncomeAssetsAggregationSerializer(
            qs.assets_aggregation(), many=True
        )
        return Response(serializer.data, status=HTTP_200_OK)


class AssetTransactionViewSet(GenericViewSet, ListModelMixin):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.TransactionListSerializer
    filterset_class = filters.TransactionFilterSet
    ordering_fields = ("operation_date", "asset__code")
    ordering = ("-operation_date",)

    def get_queryset(self) -> TransactionQuerySet[Transaction]:
        return Transaction.objects.filter(
            asset__user_id=self.request.user.pk, asset_id=self.kwargs["pk"]
        )

    @extend_schema(
        responses={200: serializers.AssetTransactionSimulateEndpointSerializer},
        parameters=[
            OpenApiParameter(name="pk", type=OpenApiTypes.INT, location=OpenApiParameter.PATH)
        ],
    )
    @action(methods=("POST",), detail=False)
    def simulate(self, request: Request, pk: int) -> Response:
        asset: Asset = get_object_or_404(request.user.assets.annotate_for_simulation(), pk=pk)
        serializer = serializers.TransactionSimulateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.data

        kwargs = {
            "price": data["price"],
            "current_currency_conversion_rate": (
                1 if asset.currency == choices.Currencies.real else get_dollar_conversion_rate()
            ),
        }
        if data.get("quantity") is not None:
            kwargs["quantity"] = data["quantity"]
        else:
            kwargs["quantity"] = data["total"] / data["price"]

        old = serializers.AssetSimulateSerializer(instance=asset).data
        with djtransaction.atomic():
            Transaction.objects.create(asset=asset, action=choices.TransactionActions.buy, **kwargs)
            new = serializers.AssetSimulateSerializer(
                instance=request.user.assets.annotate_for_simulation().get(pk=pk)
            ).data
            djtransaction.set_rollback(True)
        return Response({"old": old, "new": new}, status=HTTP_200_OK)


class AssetIncomesViewSet(GenericViewSet, ListModelMixin):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.PassiveIncomeSerializer
    filterset_class = filters.PassiveIncomeFilterSet
    ordering_fields = ("operation_date", "amount", "asset__code")
    ordering = ("-operation_date",)

    def get_queryset(self) -> PassiveIncomeQuerySet[PassiveIncome]:
        return PassiveIncome.objects.filter(
            asset__user_id=self.request.user.pk, asset_id=self.kwargs["pk"]
        )


class AssetOperationPeriodsViewSet(GenericViewSet, ListModelMixin):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.AssetOperationPeriodSerializer

    def get_queryset(self) -> AssetClosedOperationQuerySet[AssetClosedOperation]:
        return AssetClosedOperation.objects.filter(
            asset__user_id=self.request.user.pk, asset_id=self.kwargs["pk"]
        )

    def _get_first_transaction_date(
        self, asset_id: int, after_date: date | None = None
    ) -> date | None:
        filters: dict[str, int | date] = {"asset_id": asset_id}
        if after_date:
            filters["operation_date__gt"] = after_date

        return (
            Transaction.objects.filter(**filters)
            .order_by("operation_date")
            .values_list("operation_date", flat=True)
            .first()
        )

    def list(self, request: Request, pk: int) -> Response:
        periods = []
        previous_close_date = None

        for close_datetime, roi in (
            self.get_queryset()
            .annotate_roi()
            .order_by("operation_datetime")
            .values_list("operation_datetime", "roi")
        ):
            if first_transaction_date := self._get_first_transaction_date(pk, previous_close_date):
                periods.append(
                    {
                        "started_at": first_transaction_date,
                        "closed_at": close_datetime.date(),
                        "roi": roi,
                    }
                )

            previous_close_date = close_datetime.date()

        # Check if there's a current open operation
        current_quantity = (
            Asset.objects.filter(user_id=self.request.user.pk, pk=pk)
            .annotate_quantity_balance()
            .values_list("quantity_balance", flat=True)
            .first()
        )

        if current_quantity and current_quantity > 0:
            first_transaction_date = self._get_first_transaction_date(pk, previous_close_date)
            if first_transaction_date:
                periods.append(
                    {"started_at": first_transaction_date, "closed_at": None, "roi": None}
                )

        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data, status=HTTP_200_OK)
