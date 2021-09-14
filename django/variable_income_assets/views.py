from django.db.models import QuerySet

from rest_framework.viewsets import ModelViewSet

from .filters import AssetFilterSet
from .models import Asset
from .serializers import AssetSerializer


class AssetViewSet(ModelViewSet):
    serializer_class = AssetSerializer
    filterset_class = AssetFilterSet

    def get_queryset(self) -> QuerySet:
        if self.request.user.is_authenticated:
            return self.request.user.assets.all()
        return Asset.objects.none()  # drf-spectatular
