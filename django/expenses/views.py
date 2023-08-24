from decimal import Decimal

from django.db.models import Q

from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.status import HTTP_200_OK
from rest_framework.utils.serializer_helpers import ReturnList
from rest_framework.viewsets import GenericViewSet

from shared.utils import insert_zeros_if_no_data_in_monthly_historic_data

from .choices import ExpenseCategory, ExpenseReportType
from .filters import ExpenseFilterSet, ExpenseHistoricFilterSet, ExpenseReportFilterSet
from .managers import ExpenseQueryset
from .models import Expense
from .serializers import (
    ExpenseHistoricResponseSerializer,
    ExpenseIndicatorsSerializer,
    ExpenseSerializer,
)


class ExpenseViewSet(
    CreateModelMixin, UpdateModelMixin, DestroyModelMixin, ListModelMixin, GenericViewSet
):
    filterset_class = ExpenseFilterSet
    serializer_class = ExpenseSerializer
    ordering_fields = ("description", "price", "created_at", "category", "source")

    def get_queryset(self) -> ExpenseQueryset[Expense]:
        return (
            self.request.user.expenses.all()
            if self.request.user.is_authenticated
            else Expense.objects.none()  # pragma: no cover -- drf-spectatular
        )

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> type[Serializer]:
        module = __import__("expenses.serializers", fromlist=[choice.serializer_name])
        return getattr(module, choice.serializer_name)

    def _get_report_data(self, filterset: ExpenseReportFilterSet) -> ReturnList:
        qs = filterset.qs
        choice = ExpenseReportType.get_choice(value=filterset.form.data["of"])
        Serializer = self._get_report_serializer_class(choice=choice)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=("GET",), detail=False)
    def report(self, request: Request) -> Response:
        filterset = ExpenseReportFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(self._get_report_data(filterset=filterset), status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def historic(self, request: Request) -> Response:
        qs = ExpenseHistoricFilterSet(data=request.GET, queryset=self.get_queryset()).qs
        serializer = ExpenseHistoricResponseSerializer(
            {
                "historic": insert_zeros_if_no_data_in_monthly_historic_data(
                    historic=list(qs.trunc_months().order_by("month"))
                ),
                **qs.monthly_avg(),
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

        serializer = ExpenseIndicatorsSerializer({**qs, "diff": percentage})
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def cnpj(self, _: Request) -> Response:  # pragma: no cover
        qs = (
            self.get_queryset()
            .since_a_year_ago()
            .filter(category=ExpenseCategory.cnpj)
            .filter(
                Q(description__icontains="DAS")
                | Q(description__icontains="IRRF")
                | Q(description__icontains="INSS")
            )
        )
        return Response(qs.trunc_months().order_by("month"), status=HTTP_200_OK)
