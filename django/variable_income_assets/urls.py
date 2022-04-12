from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, PassiveIncomeViewSet

assets_router = DefaultRouter(trailing_slash=False)
assets_router.register(prefix="assets", viewset=AssetViewSet, basename="assets")

incomes_router = DefaultRouter(trailing_slash=False)
incomes_router.register(prefix="incomes", viewset=PassiveIncomeViewSet, basename="incomes")

urlpatterns = assets_router.urls + incomes_router.urls

# from variable_income_assets.scripts import generate_irpf
# generate_irpf()
