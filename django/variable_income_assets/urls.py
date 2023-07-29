from django.urls import path

from rest_framework.routers import DefaultRouter

from shared.routers import NestedDefaultRouter

from .integrations import qstash_views
from .views import (
    AssetIncomesiewSet,
    AssetTransactionViewSet,
    AssetViewSet,
    PassiveIncomeViewSet,
    TransactionViewSet,
)

assets_router = DefaultRouter(trailing_slash=False)
assets_router.register(prefix="assets", viewset=AssetViewSet, basename="assets")

assets_transactions_router = NestedDefaultRouter(
    parent_router=assets_router, trailing_slash=False, parent_prefix="assets"
)
assets_transactions_router.register(
    prefix="transactions", viewset=AssetTransactionViewSet, basename="assets_transactions"
)
assets_incomes_router = NestedDefaultRouter(
    parent_router=assets_router, trailing_slash=False, parent_prefix="assets"
)
assets_incomes_router.register(
    prefix="incomes", viewset=AssetIncomesiewSet, basename="assets_incomes"
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
    + assets_incomes_router.urls
    + assets_transactions_router.urls
    + transactions_router.urls
    + [
        path(
            "assets/qstash/update_prices",
            qstash_views.update_prices_endpoint,
            name="qstash_update_prices_endpoint",
        ),
        path(
            "transactions/qstash/binance",
            qstash_views.sync_binance_transactions_endpoint,
            name="qstash_sync_binance_transactions_endpoint",
        ),
        path(
            "transactions/qstash/kucoin",
            qstash_views.sync_kucoin_transactions_endpoint,
            name="qstash_sync_kucoin_transactions_endpoint",
        ),
    ]
)
