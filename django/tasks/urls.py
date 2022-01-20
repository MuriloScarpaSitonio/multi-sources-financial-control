from rest_framework.routers import DefaultRouter

from .views import TaskHistoryViewSet

router = DefaultRouter(trailing_slash=False)
router.register(prefix="tasks", viewset=TaskHistoryViewSet, basename="tasks")


urlpatterns = router.urls
