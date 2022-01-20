from django.db.models import QuerySet

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.viewsets import GenericViewSet

from .models import TaskHistory
from .serializers import TaskHistoryBulkSaveAsNotifiedSerializer, TaskHistorySerializer


class TaskHistoryViewSet(GenericViewSet, ListModelMixin):
    serializer_class = TaskHistorySerializer

    def get_queryset(self) -> QuerySet[TaskHistory]:
        return (
            self.request.user.tasks.all()
            if self.request.user.is_authenticated
            else TaskHistory.objects.none()  # drf-spectatular
        )

    @extend_schema(request=TaskHistoryBulkSaveAsNotifiedSerializer)
    @action(methods=("POST",), detail=False)
    def bulk_update_notified_at(self, request: Request) -> Response:
        serializer = TaskHistoryBulkSaveAsNotifiedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.bulk_update(queryset=self.get_queryset())
        return Response(status=HTTP_200_OK)
