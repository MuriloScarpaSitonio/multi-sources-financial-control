from django.db.models import QuerySet

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import ModelViewSet

from .filters import RevenueFilterSet
from .models import Revenue
from .serializers import RevenueSerializer, RevenueIndicatorsSerializer


class RevenueViewSet(ModelViewSet):
    filterset_class = RevenueFilterSet
    serializer_class = RevenueSerializer
    ordering_fields = ("description", "value", "created_at")

    def get_queryset(self) -> QuerySet:
        if self.request.user.is_authenticated:
            return self.request.user.revenues.all()
        return Revenue.objects.none()  # pragma: no cover -- drf-spectatular

    @action(methods=["GET"], detail=False)
    def indicators(self, _: Request) -> Response:
        qs = self.get_queryset().indicators()
        serializer = RevenueIndicatorsSerializer(qs[0])
        return Response(serializer.data, status=HTTP_200_OK)
