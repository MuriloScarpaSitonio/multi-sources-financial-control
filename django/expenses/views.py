from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar

from django.db.models import Max
from django.db.transaction import atomic
from django.utils import timezone

from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.utils.serializer_helpers import ReturnList
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from shared.permissions import SubscriptionEndedPermission
from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data

from . import filters, serializers
from .choices import ExpenseReportType
from .domain import commands, events
from .managers import ExpenseQueryset, RevenueQueryset
from .models import BankAccount, Expense, Revenue
from .permissions import PersonalFinancesModulePermission
from .service_layer import messagebus
from .service_layer.unit_of_work import ExpenseUnitOfWork, RevenueUnitOfWork

if TYPE_CHECKING:
    from django_filters.filterset import FilterSet
    from rest_framework.request import Request
    from rest_framework.serializers import Serializer


class _PersonalFinanceViewSet(
    CreateModelMixin, UpdateModelMixin, DestroyModelMixin, ListModelMixin, GenericViewSet
):
    historic_filterset_class: ClassVar[FilterSet]
    indicators_serializer_class: ClassVar[Serializer]
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)
    ordering_fields = ("created_at", "value")

    def get_serializer_context(self):
        filterset = filters.PersonalFinanceContextFilterSet(
            data=self.request.GET, queryset=self.get_queryset()
        )
        return {**super().get_serializer_context(), **filterset.get_cleaned_data()}

    @action(methods=("GET",), detail=False)
    def historic(self, request: Request) -> Response:
        filterset = self.historic_filterset_class(data=request.GET, queryset=self.get_queryset())
        serializer = serializers.HistoricResponseSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(filterset.qs.trunc_months().order_by("month"))
                ),
                **filterset.qs.monthly_avg(),
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()
        # TODO: do this via SQL
        percentage = (
            (((qs["total"] / qs["avg"]) - Decimal("1.0")) * Decimal("100.0"))
            if qs["avg"]
            else Decimal()
        )

        serializer = self.indicators_serializer_class({**qs, "diff": percentage})
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def sum(self, request: Request) -> Response:
        filterset = filters.PersonalFinanceIndicatorsV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(serializers.TotalSerializer(filterset.qs.sum()).data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def avg(self, _: Request) -> Response:
        return Response(
            serializers.AvgSerializer(self.get_queryset().since_a_year_ago_avg()).data,
            status=HTTP_200_OK,
        )

    @action(methods=("GET",), detail=False)
    def higher_value(self, request: Request) -> Response:
        filterset = filters.PersonalFinanceIndicatorsV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        entity = filterset.qs.annotate(max_value=Max("value")).order_by("-max_value").first()
        return Response(self.serializer_class(entity).data, status=HTTP_200_OK)


class ExpenseViewSet(_PersonalFinanceViewSet):
    filterset_class = filters.ExpenseFilterSet
    historic_filterset_class = filters.ExpenseHistoricFilterSet
    serializer_class = serializers.ExpenseSerializer
    indicators_serializer_class = serializers.ExpenseIndicatorsSerializer

    def get_queryset(self) -> ExpenseQueryset[Expense]:
        return (
            self.request.user.expenses.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_destroy(self, instance: Expense) -> None:
        context = self.get_serializer_context()
        messagebus.handle(
            message=commands.DeleteExpense(
                expense=instance.to_domain(),
                perform_actions_on_future_fixed_expenses=context.get(
                    "perform_actions_on_future_fixed_expenses", False
                ),
            ),
            uow=ExpenseUnitOfWork(user_id=self.request.user.id),
        )

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem, avg: bool) -> type[Serializer]:
        name = (
            choice.serializer_name.replace("Report", "ReportAvg") if avg else choice.serializer_name
        )
        module = __import__("expenses.serializers", fromlist=[name])
        return getattr(module, name)

    def _get_report_data(
        self, filterset: filters.ExpenseAvgComparasionReportFilterSet, avg: bool
    ) -> ReturnList:
        qs = filterset.qs
        choice = ExpenseReportType.get_choice(value=filterset.form.cleaned_data["group_by"])
        Serializer = self._get_report_serializer_class(choice=choice, avg=avg)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def avg_comparasion_report(self, request: Request) -> Response:
        filterset = filters.ExpenseAvgComparasionReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(self._get_report_data(filterset=filterset, avg=True), status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def percentage_report(self, request: Request) -> Response:
        filterset = filters.ExpensePercentageReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        return Response(self._get_report_data(filterset=filterset, avg=False), status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def historic_report(self, request: Request) -> Response:
        filterset = filters.ExpenseHistoricV2FilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        qs = filterset.qs
        serializer = serializers.HistoricResponseSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(qs.trunc_months().order_by("month"))
                ),
                **qs.monthly_avg(),
            }
        )
        return Response(serializer.data, status=HTTP_200_OK)


class RevenueViewSet(_PersonalFinanceViewSet):
    filterset_class = filters.RevenueFilterSet
    historic_filterset_class = filters.RevenueHistoricFilterSet
    serializer_class = serializers.RevenueSerializer
    indicators_serializer_class = serializers.RevenueIndicatorsSerializer

    def get_queryset(self) -> RevenueQueryset[Revenue]:
        return (
            self.request.user.revenues.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    @atomic
    def perform_create(self, serializer: serializers.RevenueSerializer) -> None:
        super().perform_create(serializer)

        if serializer.instance.created_at > timezone.localdate():
            # TODO: how to increment bank account when a future revenue is created?
            return

        with RevenueUnitOfWork(user_id=self.request.user.id) as uow:
            messagebus.handle(
                message=events.RevenueCreated(value=serializer.instance.value), uow=uow
            )

    @atomic
    def perform_update(self, serializer: serializers.RevenueSerializer) -> None:
        prev_value = serializer.instance.value
        super().perform_update(serializer)

        if serializer.instance.created_at > timezone.localdate():
            # TODO: how to increment bank account when a future revenue is updated?
            return

        with RevenueUnitOfWork(user_id=self.request.user.id) as uow:
            messagebus.handle(
                message=events.RevenueUpdated(diff=prev_value - serializer.instance.value), uow=uow
            )

    @atomic
    def perform_destroy(self, instance: Revenue):
        super().perform_destroy(instance)
        with RevenueUnitOfWork(user_id=self.request.user.id) as uow:
            messagebus.handle(message=events.RevenueDeleted(value=instance.value), uow=uow)


class BankAccountView(APIView):
    permission_classes = (SubscriptionEndedPermission, PersonalFinancesModulePermission)

    def get_object(self) -> BankAccount:
        return get_object_or_404(BankAccount.objects.all(), user_id=self.request.user.id)

    def get(self, _: Request) -> Response:
        return Response(
            data=serializers.BankAccountSerializer(instance=self.get_object()).data,
            status=HTTP_200_OK,
        )

    def put(self, request: Request) -> Response:
        serializer = serializers.BankAccountSerializer(
            instance=self.get_object(), data=request.data
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(data=serializer.data, status=HTTP_200_OK)
