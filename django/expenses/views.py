from decimal import Decimal
from typing import List, Type

from django.utils import timezone

from dateutil.relativedelta import relativedelta
from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.viewsets import ModelViewSet
from rest_framework.utils.serializer_helpers import ReturnList

from .choices import ExpenseReportType
from .filters import ExpenseFilterSet, ExpenseReportFilterSet
from .managers import ExpenseQueryset
from .models import Expense
from .serializers import (
    ExpenseSerializer,
    ExpenseHistoricResponseSerializer,
    ExpenseIndicatorsSerializer,
)


class ExpenseViewSet(ModelViewSet):
    filterset_class = ExpenseFilterSet
    serializer_class = ExpenseSerializer
    ordering_fields = ("description", "price", "created_at", "category", "source")

    def get_queryset(self) -> ExpenseQueryset:
        if self.request.user.is_authenticated:
            return (
                self.request.user.expenses.since_a_year_ago()
                if self.action in ("list", "historic")
                else self.request.user.expenses.all()
            )
        return Expense.objects.none()  # pragma: no cover -- drf-spectatular

    @staticmethod
    def _get_report_serializer_class(choice: ChoiceItem) -> Type[Serializer]:
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
    def historic(self, _: Request) -> Response:
        qs = self.get_queryset()
        serializer = ExpenseHistoricResponseSerializer(
            {"historic": qs.trunc_months().order_by("month"), **qs.monthly_avg()}
        )
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("GET",), detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()

        # TODO: do this via SQL
        percentage = ((qs["total"] / qs["avg"]) - Decimal("1.0")) * Decimal("100.0")

        serializer = ExpenseIndicatorsSerializer({**qs, "diff": percentage})
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=("POST",), detail=False)
    def fixed_from_last_month(self, _: Request) -> Response:
        today = timezone.now().date()
        one_month_before = today - relativedelta(months=1)
        qs = (
            self.get_queryset()
            .filter_by_month_and_year(month=one_month_before.month, year=one_month_before.year)
            .filter(is_fixed=True)
            .values()
        )

        expenses = self._get_fixed_expenses_from_queryset(
            queryset=qs,
            today_date_str=f"{today.month:02}/{str(today.year)[2:]}",
            one_month_before_date_str=(
                f"{one_month_before.month:02}/{str(one_month_before.year)[2:]}"
            ),
        )

        data = Expense.objects.bulk_create(objs=expenses)
        serializer = self.get_serializer(data=data, many=True)
        serializer.is_valid()
        return Response(serializer.data, status=HTTP_201_CREATED)

    @staticmethod
    def _get_fixed_expenses_from_queryset(
        queryset: ExpenseQueryset[Expense], today_date_str: str, one_month_before_date_str: str
    ) -> List[Expense]:
        expenses = []
        for expense in queryset:
            del expense["id"]
            description = expense.pop("description")
            # TODO: change to regex
            description = (
                f"{description} ({today_date_str})"
                if f"{one_month_before_date_str}" not in description
                else description.replace(
                    f"{one_month_before_date_str}",
                    f"{today_date_str}",
                )
            )
            expenses.append(
                Expense(
                    **expense,
                    created_at=expense.pop("created_at") + relativedelta(months=1),
                    description=description,
                )
            )
        return expenses
