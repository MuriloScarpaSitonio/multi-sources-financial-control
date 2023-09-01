from django.urls import path

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthViewSet, TokenWUserObtainPairView, UserViewSet

users_router = DefaultRouter(trailing_slash=False)
users_router.register(prefix="users", viewset=UserViewSet, basename="users")

auth_router = DefaultRouter(trailing_slash=False)
auth_router.register(prefix="auth", viewset=AuthViewSet, basename="auth")


@extend_schema_view(post=extend_schema(exclude=True))
class _TokenRefreshView(TokenRefreshView):
    ...


urlpatterns = (
    [
        path("token", TokenWUserObtainPairView.as_view(), name="token_obtain_pair"),
        path("token/refresh", _TokenRefreshView.as_view(), name="token_refresh"),
    ]
    + users_router.urls
    + auth_router.urls
)
