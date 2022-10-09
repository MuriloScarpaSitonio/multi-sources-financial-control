from rest_framework.routers import DefaultRouter

from shared.routers import NestedDefaultRouter

from .views import AssetViewSet, AssetTransactionViewSet, PassiveIncomeViewSet, TransactionViewSet

assets_router = DefaultRouter(trailing_slash=False)
assets_router.register(prefix="assets", viewset=AssetViewSet, basename="assets")

assets_transactions_router = NestedDefaultRouter(
    parent_router=assets_router, trailing_slash=False, parent_prefix="assets"
)
assets_transactions_router.register(
    prefix="transactions", viewset=AssetTransactionViewSet, basename="assets_transactions"
)

transactions_router = DefaultRouter(trailing_slash=False)
transactions_router.register(
    prefix="transactions", viewset=TransactionViewSet, basename="transactions"
)

incomes_router = DefaultRouter(trailing_slash=False)
incomes_router.register(prefix="incomes", viewset=PassiveIncomeViewSet, basename="incomes")

urlpatterns = (
    assets_router.urls
    + incomes_router.urls
    + assets_transactions_router.urls
    + transactions_router.urls
)
