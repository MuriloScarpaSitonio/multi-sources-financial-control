from rest_framework import routers

from .views import AssetViewSet, PassiveIncomeViewSet

assets_router = routers.DefaultRouter(trailing_slash=False)
assets_router.register(prefix="assets", viewset=AssetViewSet, basename="assets")

incomes_router = routers.DefaultRouter(trailing_slash=False)
incomes_router.register(prefix="incomes", viewset=PassiveIncomeViewSet, basename="incomes")

urlpatterns = assets_router.urls + incomes_router.urls
