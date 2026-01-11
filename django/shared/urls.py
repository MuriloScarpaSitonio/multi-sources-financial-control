from rest_framework.routers import DefaultRouter

from .views import PatrimonyViewSet

router = DefaultRouter(trailing_slash=False)
router.register(prefix="patrimony", viewset=PatrimonyViewSet, basename="patrimony")

urlpatterns = router.urls
