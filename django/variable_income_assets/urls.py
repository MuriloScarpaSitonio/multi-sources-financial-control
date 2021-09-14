from rest_framework import routers

from .views import AssetViewSet

assets_router = routers.DefaultRouter(trailing_slash=False)
assets_router.register(prefix="assets", viewset=AssetViewSet, basename="assets")

urlpatterns = assets_router.urls
