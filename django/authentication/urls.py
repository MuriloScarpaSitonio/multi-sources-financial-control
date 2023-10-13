from django.urls import path

from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AuthViewSet,
    SubscriptionViewSet,
    TokenWUserObtainPairView,
    UserViewSet,
    stripe_webhook,
)

router = DefaultRouter(trailing_slash=False)
router.register(prefix="users", viewset=UserViewSet, basename="users")
router.register(prefix="auth", viewset=AuthViewSet, basename="auth")
router.register(prefix="subscription", viewset=SubscriptionViewSet, basename="subscription")


urlpatterns = [
    path("token", TokenWUserObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("subscription/webhook", stripe_webhook, name="stripe_webhook"),
] + router.urls
