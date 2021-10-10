# assets/views.py

from django.db.models import QuerySet

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import ModelViewSet

from tasks.decorators import celery_task_endpoint

from .filters import AssetFilterSet
from .models import Asset
from .serializers import AssetSerializer
from .tasks import cei_assets_crawler


class AssetViewSet(ModelViewSet):
    serializer_class = AssetSerializer
    filterset_class = AssetFilterSet

    def get_queryset(self) -> QuerySet:
        if self.request.user.is_authenticated:
            return self.request.user.assets.all()
        return Asset.objects.none()  # pragma: no cover -- drf-spectatular

    @action(methods=("GET",), detail=False)
    @celery_task_endpoint(task=cei_assets_crawler)
    def fetch_cei(self, _: Request, task_id: str) -> Response:
        return Response({"task_id": task_id}, status=HTTP_200_OK)
