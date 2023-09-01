from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, ClassVar

from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.utils.serializer_helpers import ReturnList
from rest_framework.viewsets import GenericViewSet

from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data

from .choices import ExpenseReportType
from .filters import (
    ExpenseFilterSet,
    ExpenseHistoricFilterSet,
    ExpenseReportFilterSet,
    RevenueFilterSet,
    RevenueHistoricFilterSet,
)
from .managers import ExpenseQueryset, RevenueQueryset
from .models import Expense, Revenue
from .serializers import (
    ExpenseIndicatorsSerializer,
    ExpenseSerializer,
    HistoricResponseSerializer,
    RevenueIndicatorsSerializer,
    RevenueSerializer,
)

if TYPE_CHECKING:
    from django_filters.filterset import FilterSet
    from rest_framework.request import Request
    from rest_framework.serializers import Serializer


class _PersonalFinanceViewSet(
    CreateModelMixin, UpdateModelMixin, DestroyModelMixin, ListModelMixin, GenericViewSet
):
    historic_filterset_class: ClassVar[FilterSet]
    indicators_serializer_class: ClassVar[Serializer]
    ordering_fields = ("created_at",)

    @action(methods=("GET",), detail=False)
    def historic(self, request: Request) -> Response:
        filterset = self.historic_filterset_class(data=request.GET, queryset=self.get_queryset())
        serializer = HistoricResponseSerializer(
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


class ExpenseViewSet(_PersonalFinanceViewSet):
    filterset_class = ExpenseFilterSet
    historic_filterset_class = ExpenseHistoricFilterSet
    serializer_class = ExpenseSerializer
    indicators_serializer_class = ExpenseIndicatorsSerializer
    ordering_fields = ("created_at",)

    def get_queryset(self) -> ExpenseQueryset[Expense]:
        return (
            self.request.user.expenses.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    def perform_destroy(self, instance: Expense) -> None:
        if instance.installments_id is None:
            instance.delete()
        else:
            Expense.objects.filter(installments_id=instance.installments_id).delete()

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> type[Serializer]:
        module = __import__("expenses.serializers", fromlist=[choice.serializer_name])
        return getattr(module, choice.serializer_name)

    def _get_report_data(self, filterset: ExpenseReportFilterSet) -> ReturnList:
        qs = filterset.qs
        choice = ExpenseReportType.get_choice(value=filterset.form.cleaned_data["kind"])
        Serializer = self._get_report_serializer_class(choice=choice)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def report(self, request: Request) -> Response:
        filterset = ExpenseReportFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(self._get_report_data(filterset=filterset), status=HTTP_200_OK)


class RevenueViewSet(_PersonalFinanceViewSet):
    filterset_class = RevenueFilterSet
    historic_filterset_class = RevenueHistoricFilterSet
    serializer_class = RevenueSerializer
    indicators_serializer_class = RevenueIndicatorsSerializer

    def get_queryset(self) -> RevenueQueryset[Revenue]:
        return (
            self.request.user.revenues.all().order_by("-created_at")
            if self.request.user.is_authenticated
            else Revenue.objects.none()  # pragma: no cover -- drf-spectatular
        )
