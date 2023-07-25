from django.urls import path, re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import RevenuesAPIGatewayView, TokenWUserObtainPairView, UserViewSet

router = DefaultRouter(trailing_slash=False)
router.register(prefix="users", viewset=UserViewSet, basename="users")


urlpatterns = [
    path("token", TokenWUserObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    re_path(r"^gateway/revenues", RevenuesAPIGatewayView.as_view()),
] + router.urls
