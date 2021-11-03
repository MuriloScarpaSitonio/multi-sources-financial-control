from rest_framework.routers import DefaultRouter

from .views import RevenueViewSet

router = DefaultRouter(trailing_slash=False)
router.register(prefix="revenues", viewset=RevenueViewSet, basename="expenses")

urlpatterns = router.urls
