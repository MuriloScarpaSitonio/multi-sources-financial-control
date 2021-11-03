from typing import Type
from django.db.models import QuerySet

from django_filters import FilterSet
from djchoices.choices import ChoiceItem
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import ModelViewSet
from rest_framework.utils.serializer_helpers import ReturnList

from .choices import ExpenseReportType
from .filters import ExpenseFilterSet, ExpenseReportFilterSet
from .models import Expense
from .serializers import (
    ExpenseSerializer,
    ExpenseHistoricSerializer,
    ExpenseIndicatorsSerializer,
)


class ExpenseViewSet(ModelViewSet):
    filterset_class = ExpenseFilterSet
    serializer_class = ExpenseSerializer
    _fields = ("description", "price", "created_at", "category", "source")

    def get_queryset(self) -> QuerySet:
        if self.request.user.is_authenticated:
            return self.request.user.expenses.all()
        return Expense.objects.none()  # pragma: no cover -- drf-spectatular

    @staticmethod
    def _get_serializer_class(choice: ChoiceItem) -> Type[Serializer]:
        module = __import__("expenses.serializers", fromlist=[choice.serializer_name])
        return getattr(module, choice.serializer_name)

    def _get_report_data(self, filterset: FilterSet) -> ReturnList:
        qs = filterset.qs
        choice = ExpenseReportType.get_choice(value=filterset.form.data["of"])
        Serializer = self._get_serializer_class(choice=choice)
        serializer = Serializer(qs, many=True)
        return serializer.data

    @action(methods=["GET"], detail=False)
    def report(self, request: Request) -> Response:
        filterset = ExpenseReportFilterSet(data=request.GET, queryset=self.get_queryset())
        return Response(self._get_report_data(filterset=filterset), status=HTTP_200_OK)

    @action(methods=["GET"], detail=False)
    def historic(self, _: Request) -> Response:
        serializer = ExpenseHistoricSerializer(self.get_queryset().historic(), many=True)
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=["GET"], detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()
        # the other record in the qs was used only for the construction of the annotated
        # parameters and it will always be None. In other words, it is irrelevant.
        serializer = ExpenseIndicatorsSerializer(qs[0])
        return Response(serializer.data, status=HTTP_200_OK)
