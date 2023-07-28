from django.urls import path, re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthViewSet, RevenuesAPIGatewayView, TokenWUserObtainPairView, UserViewSet

users_router = DefaultRouter(trailing_slash=False)
users_router.register(prefix="users", viewset=UserViewSet, basename="users")

auth_router = DefaultRouter(trailing_slash=False)
auth_router.register(prefix="auth", viewset=AuthViewSet, basename="auth")


urlpatterns = (
    [
        path("token", TokenWUserObtainPairView.as_view(), name="token_obtain_pair"),
        path("token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
        re_path(r"^gateway/revenues", RevenuesAPIGatewayView.as_view()),
    ]
    + users_router.urls
    + auth_router.urls
)
