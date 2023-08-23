from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from dateutil.relativedelta import relativedelta
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
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
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

    @action(methods=("POST",), detail=False)
    def fixed_from_last_month(self, _: Request) -> Response:
        # expenses = self._get_fixed_expenses_from_queryset()

        # data = Expense.objects.bulk_create(objs=expenses)
        # serializer = self.get_serializer(data=data, many=True)
        # serializer.is_valid()
        # return Response(serializer.data, status=HTTP_201_CREATED)
        return Response(status=HTTP_201_CREATED)

    def _get_fixed_expenses_from_queryset(self) -> list[Expense]:  # pragma: no cover
        today = timezone.localdate()
        one_month_before = today - relativedelta(months=1)
        two_months_before = today - relativedelta(months=2)
        qs = (
            self.get_queryset()
            .filter_by_month_and_year(month=one_month_before.month, year=one_month_before.year)
            .filter(is_fixed=True)
            .values()
        )

        today_date_str = f"{today.month:02}/{str(today.year)[2:]}"
        one_month_before_date_str = f"{one_month_before.month:02}/{str(one_month_before.year)[2:]}"
        two_months_before_date_str = (
            f"{two_months_before.month:02}/{str(two_months_before.year)[2:]}"
        )
        expenses = []
        for expense in qs:
            del expense["id"]
            description = expense.pop("description")
            # TODO: change to regex
            if one_month_before_date_str in description:
                description = description.replace(
                    f"{one_month_before_date_str}", f"{today_date_str}"
                )
            elif two_months_before_date_str in description:
                description = description.replace(
                    f"{two_months_before_date_str}", f"{today_date_str}"
                )
            else:
                description = f"{description} ({today_date_str})"

            expenses.append(
                Expense(
                    **expense,
                    created_at=expense.pop("created_at") + relativedelta(months=1),
                    description=description,
                )
            )
        return expenses
