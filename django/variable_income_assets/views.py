from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction as djtransaction
from django.db.models import F, Sum
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
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from shared.permissions import SubscriptionEndedPermission
from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data

from . import choices, filters, serializers
from .adapters.key_value_store import get_dollar_conversion_rate
from .domain import events
from .models import Asset, AssetReadModel, PassiveIncome, Transaction
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
        return self.action in ("create", "update", "destroy")

    def get_queryset(self) -> AssetReadModelQuerySet[AssetReadModel] | AssetQuerySet[Asset]:
        if self.request.user.is_authenticated:
            if self._is_write_action():
                return Asset.objects.filter(user_id=self.request.user.id)
            qs = AssetReadModel.objects.select_related("metadata").filter(
                user_id=self.request.user.id
            )
            return (
                (
                    qs.annotate_normalized_total_invested()
                    .annotate_normalized_roi()
                    .order_by("-normalized_total_invested")
                )
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
                    self.get_queryset()
                    .annotate_normalized_current_total()
                    .aggregate(
                        current_total_agg=Sum("normalized_current_total"),
                        total_invested_agg=Sum("normalized_total_invested"),
                    )
                ),
            }
            if self.action == "list"
            else context
        )

    @djtransaction.atomic
    def perform_create(self, serializer: serializers.AssetSerializer) -> None:
        super().perform_create(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.pk) as uow:
            messagebus.handle(
                message=events.AssetCreated(asset_pk=serializer.instance.pk, sync=True), uow=uow
            )

    @djtransaction.atomic
    def perform_update(self, serializer: serializers.AssetReadModelSerializer) -> None:
        super().perform_update(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.pk) as uow:
            messagebus.handle(
                message=events.AssetUpdated(asset_pk=serializer.instance.pk, sync=True), uow=uow
            )

    @djtransaction.atomic
    def perform_destroy(self, instance: Asset) -> None:
        AssetReadModel.objects.filter(write_model_pk=instance.pk).delete()
        super().perform_destroy(instance)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        data = self.get_queryset().indicators()
        serializer = serializers.AssetRoidIndicatorsSerializer(
            {"ROI": data["ROI_opened"] + data["ROI_closed"], **data}
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> type[Serializer]:
        module = __import__("variable_income_assets.serializers", fromlist=[choice.serializer_name])
        return getattr(module, choice.serializer_name)

    def _get_total_invested_report_data(
        self, filterset: filters.AssetTotalInvestedReportFilterSet
    ) -> ReturnList:
        qs = filterset.qs
        choice = choices.AssetsTotalInvestedReportAggregations.get_choice(
            value=filterset.form.data["group_by"]
        )
        Serializer = self._get_report_serializer_class(choice=choice)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def total_invested_report(self, request: Request) -> Response:
        filterset = filters.AssetTotalInvestedReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(
            self._get_total_invested_report_data(filterset=filterset), status=HTTP_200_OK
        )

    @action(methods=("GET",), detail=False)
    def roi_report(self, request: Request) -> Response:
        filterset = filters.AssetRoiReportFilterSet(data=request.GET, queryset=self.get_queryset())
        serializer = serializers.AssetTypeReportSerializer(filterset.qs, many=True)
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def minimal_data(self, _: Request) -> Response:
        # TODO: change `list` endpoint to support `fields` kwarg on serializer and set the return
        # values by doing `/assets?fields=code,currency`
        return Response(
            data=self.get_queryset()
            .annotate(pk=F("write_model_pk"))
            .values("code", "currency", "pk")
            .order_by("code"),
            status=HTTP_200_OK,
        )


class TransactionViewSet(ModelViewSet):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.TransactionListSerializer
    filterset_class = filters.TransactionFilterSet
    ordering_fields = ("operation_date", "asset__code")

    def get_queryset(self) -> TransactionQuerySet[Transaction]:
        if self.request.user.is_authenticated:
            qs = Transaction.objects.filter(asset__user=self.request.user.pk).order_by(
                "-operation_date"
            )
            return (
                qs.select_related("asset")
                if self.action in ("list", "retrieve", "update", "destroy")
                else qs.since_a_year_ago()
            )

        return Transaction.objects.none()  # pragma: no cover -- drf-spectacular

    def perform_destroy(self, instance: Transaction):
        serializers.TransactionListSerializer(instance=instance).delete()

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()

        # TODO: do this via SQL
        percentage_invested = (
            (((qs["current_bought"] - qs["current_sold"]) / qs["avg"]) - Decimal("1.0"))
            * Decimal("100.0")
            if qs["avg"]
            else Decimal()
        )
        serializer = serializers.TransactionsIndicatorsSerializer(
            {**qs, "diff_percentage": percentage_invested}
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def historic(self, _: Request) -> Response:
        qs = self.get_queryset()
        serializer = serializers.TransactionHistoricSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(qs.historic()),
                    total_fields=("total_bought", "total_sold", "diff"),
                ),
                **qs.monthly_avg(),
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)


class PassiveIncomeViewSet(ModelViewSet):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.PassiveIncomeSerializer
    filterset_class = filters.PassiveIncomeFilterSet
    ordering_fields = ("operation_date", "amount", "asset__code")

    def get_queryset(self) -> PassiveIncomeQuerySet[PassiveIncome]:
        return (
            (
                PassiveIncome.objects.select_related("asset")
                .filter(asset__user=self.request.user)
                .order_by("-operation_date")
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

    @action(methods=("GET",), detail=False)
    def indicators(self, request: Request) -> Response:
        first_transaction_date = (
            Transaction.objects.filter(asset__user=request.user)
            .order_by("operation_date")
            .values_list("operation_date", flat=True)
            .first()
        )
        qs = self.get_queryset().indicators(
            fixed_avg_denominator=(timezone.localdate() - first_transaction_date).days > 365
            if first_transaction_date is not None
            else False
        )
        percentage = (
            ((qs["current_credited"] / qs["avg"]) - Decimal("1.0")) * Decimal("100.0")
            if qs["avg"]
            else Decimal()
        )
        serializer = serializers.PassiveIncomesIndicatorsSerializer(
            {**qs, "diff_percentage": percentage}
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def historic(self, _: Request) -> Response:
        qs = self.get_queryset().credited().since_a_year_ago()
        historic = list(qs.trunc_months().order_by("month"))
        serializer = serializers.PassiveIncomeHistoricSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(historic=historic),
                **qs.monthly_avg(),
            }
        )

        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def assets_aggregation_report(self, request: Request) -> Response:
        filterset = filters.PassiveIncomeAssetsAgreggationReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        serializer = serializers.PassiveIncomeAssetsAggregationSerializer(filterset.qs, many=True)
        return Response(serializer.data, status=HTTP_200_OK)


class AssetTransactionViewSet(GenericViewSet, ListModelMixin):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.TransactionListSerializer
    filterset_class = filters.TransactionFilterSet
    ordering_fields = ("operation_date", "asset__code")

    def get_queryset(self) -> TransactionQuerySet[Transaction]:
        return Transaction.objects.filter(
            asset__user_id=self.request.user.pk, asset_id=self.kwargs["pk"]
        ).order_by("-operation_date")

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
                instance=request.user.assets.annotate_for_simulation().all().get(pk=pk)
            ).data
            djtransaction.set_rollback(True)
        return Response({"old": old, "new": new}, status=HTTP_200_OK)


class AssetIncomesiewSet(GenericViewSet, ListModelMixin):
    permission_classes = (SubscriptionEndedPermission, InvestmentsModulePermission)
    serializer_class = serializers.PassiveIncomeSerializer
    filterset_class = filters.PassiveIncomeFilterSet
    ordering_fields = ("operation_date", "amount", "asset__code")

    def get_queryset(self) -> PassiveIncomeQuerySet[PassiveIncome]:
        return PassiveIncome.objects.filter(
            asset__user_id=self.request.user.pk, asset_id=self.kwargs["pk"]
        ).order_by("-operation_date")
