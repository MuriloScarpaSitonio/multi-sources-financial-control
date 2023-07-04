from __future__ import annotations

from decimal import Decimal
from typing import Type, TYPE_CHECKING

from django.db import transaction as djtransaction
from django.db.models import Sum
from django.utils import timezone

from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data
from tasks.decorators import start_task

from . import choices, filters, serializers
from .domain import events
from .models import Asset, AssetReadModel, PassiveIncome, Transaction
from .models.managers import (
    AssetQuerySet,
    AssetReadModelQuerySet,
    PassiveIncomeQuerySet,
    TransactionQuerySet,
)
from .permissions import BinancePermission, CeiPermission, KuCoinPermission
from .service_layer import messagebus
from .service_layer.unit_of_work import DjangoUnitOfWork
from .tasks import sync_binance_transactions_task, sync_kucoin_transactions_task

if TYPE_CHECKING:  # pragma: no cover
    from djchoices import ChoiceItem
    from django_filters import FilterSet
    from rest_framework.request import Request
    from rest_framework.serializers import Serializer
    from rest_framework.utils.serializer_helpers import ReturnList


class AssetViewSet(
    GenericViewSet, ListModelMixin, CreateModelMixin, UpdateModelMixin, DestroyModelMixin
):
    filter_backends = (filters.CQRSDjangoFilterBackend, OrderingFilter)
    ordering_fields = ("normalized_total_invested", "roi", "roi_percentage")

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
                    .opened()
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

    def perform_create(self, serializer: serializers.AssetSerializer) -> None:
        super().perform_create(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.pk) as uow:
            messagebus.handle(message=events.AssetCreated(asset_pk=serializer.instance.pk), uow=uow)

    def perform_update(self, serializer: serializers.AssetReadModelSerializer) -> None:
        super().perform_update(serializer)
        with DjangoUnitOfWork(asset_pk=serializer.instance.pk) as uow:
            messagebus.handle(message=events.AssetUpdated(asset_pk=serializer.instance.pk), uow=uow)

    def perform_destroy(self, instance: Asset) -> None:
        AssetReadModel.objects.filter(write_model_pk=instance.pk).delete()
        super().perform_destroy(instance)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        serializer = serializers.AssetRoidIndicatorsSerializer(self.get_queryset().indicators())
        return Response(serializer.data, status=HTTP_200_OK)

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> Type[Serializer]:
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

    @extend_schema(deprecated=True)
    @action(methods=("GET",), detail=False, permission_classes=(CeiPermission,))
    def sync_cei_transactions(self, _: Request) -> Response:
        return Response({"task_id": None, "warning": "Integration is deprecated"}, status=299)

    @extend_schema(deprecated=True)
    @action(methods=("GET",), detail=False, permission_classes=(CeiPermission,))
    def sync_cei_passive_incomes(self, _: Request) -> Response:
        return Response({"task_id": None, "warning": "Integration is deprecated"}, status=299)

    @action(methods=("GET",), detail=False, permission_classes=(KuCoinPermission,))
    def sync_kucoin_transactions(self, request: Request) -> Response:
        task_id = start_task(task_name="sync_kucoin_transactions_task", user=request.user)
        sync_kucoin_transactions_task(task_history_id=task_id, username=request.user.username)
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False, permission_classes=(BinancePermission,))
    def sync_binance_transactions(self, request: Request) -> Response:
        task_id = start_task(task_name="sync_binance_transactions_task", user=request.user)
        sync_binance_transactions_task(task_history_id=task_id, username=request.user.username)
        return Response({"task_id": task_id}, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def sync_all(self, request: Request) -> Response:
        TASK_USER_PROPERTY_MAP = {
            # "has_cei_integration": (sync_cei_transactions_task, sync_cei_passive_incomes_task),
            "has_kucoin_integration": (sync_kucoin_transactions_task,),
            "has_binance_integration": (sync_binance_transactions_task,),
        }

        response = {}
        for property_name, tasks in TASK_USER_PROPERTY_MAP.items():
            if getattr(request.user, property_name):
                for task in tasks:
                    task_id = start_task(task_name=task.__name__, user=request.user)
                    task(username=request.user.username, task_history_id=task_id)
                    response[task.__name__] = task_id
        return Response(response, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def codes_and_currencies(self, _: Request) -> Response:
        # TODO: change `list` endpoint to support `fields` kwarg on serializer and set the return values
        # by doing `/assets?fields=code,currency`
        return Response(
            data=self.get_queryset().values("code", "currency").order_by("code"),
            status=HTTP_200_OK,
        )


class AssetTransactionViewSet(GenericViewSet):
    serializer_class = serializers.AssetTransactionSimulateEndpointSerializer  # drf-spectacular

    def get_related_queryset(self) -> AssetQuerySet[Asset]:
        return self.request.user.assets.all()

    @extend_schema(
        parameters=[
            OpenApiParameter(name="pk", type=OpenApiTypes.INT, location=OpenApiParameter.PATH)
        ],
    )
    @action(methods=("POST",), detail=False)
    def simulate(self, request: Request, pk: int) -> Response:
        asset = get_object_or_404(self.get_related_queryset(), pk=pk)
        serializer = serializers.TransactionSimulateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.data

        kwargs = {"price": data["price"]}
        if data.get("quantity") is not None:
            kwargs["quantity"] = data["quantity"]
        else:
            kwargs["quantity"] = data["total"] / data["price"]

        old = serializers.AssetSimulateSerializer(instance=asset).data
        with djtransaction.atomic():
            Transaction.objects.create(asset=asset, action=choices.TransactionActions.buy, **kwargs)

            # clear cached properties
            del asset.__dict__["adjusted_avg_price_from_transactions"]
            del asset.__dict__["quantity_from_transactions"]

            new = serializers.AssetSimulateSerializer(instance=asset).data
            djtransaction.set_rollback(True)
        return Response({"old": old, "new": new}, status=HTTP_200_OK)


class PassiveIncomeViewSet(ModelViewSet):
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
        qs = self.get_queryset().since_a_year_ago()
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


class TransactionViewSet(ModelViewSet):
    serializer_class = serializers.TransactionListSerializer
    filterset_class = filters.TransactionFilterSet
    ordering_fields = ("operation_date", "asset__code")

    def get_queryset(self) -> TransactionQuerySet[Transaction]:
        if self.request.user.is_authenticated:
            qs = Transaction.objects.filter(asset__user=self.request.user).order_by(
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
