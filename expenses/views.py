from django.db.models import QuerySet

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import ModelViewSet

from .filters import ExpenseFilterSet, ExpenseReportFilterSet
from .models import Expense
from .serializers import (
    ExpenseSerializer,
    ExpenseHistoricSerializer,
    ExpenseReportSerializer,
)


class ExpenseViewSet(ModelViewSet):
    filterset_class = ExpenseFilterSet
    serializer_class = ExpenseSerializer
    ordering_fields = ("description", "price", "created_at", "category", "source")

    def get_queryset(self) -> QuerySet:
        if self.request.user.is_authenticated:
            return self.request.user.expenses.all()
        return Expense.objects.none()  # drf-spectatular

    @action(methods=["GET"], detail=False)
    def report(self, request: Request) -> Response:
        filterset = ExpenseReportFilterSet(
            data=request.GET, queryset=self.get_queryset()
        )
        serializer = ExpenseReportSerializer(filterset.qs.report())
        return Response(serializer.data, status=HTTP_200_OK)

    @action(methods=["GET"], detail=False)
    def historic(self, _: Request) -> Response:
        serializer = ExpenseHistoricSerializer(
            self.get_queryset().historic(), many=True
        )
        return Response(serializer.data, status=HTTP_200_OK)
