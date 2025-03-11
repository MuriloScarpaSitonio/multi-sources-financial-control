from rest_framework.routers import DefaultRouter

from .views import (
    BankAccountViewSet,
    ExpenseCategoryViewSet,
    ExpenseSourceViewSet,
    ExpenseViewSet,
    RevenueCategoryViewSet,
    RevenueViewSet,
)

router = DefaultRouter(trailing_slash=False)
router.register(
    prefix="expenses/categories", viewset=ExpenseCategoryViewSet, basename="expenses_categories"
)
router.register(
    prefix="expenses/sources", viewset=ExpenseSourceViewSet, basename="expenses_sources"
)
router.register(prefix="expenses", viewset=ExpenseViewSet, basename="expenses")

router.register(
    prefix="revenues/categories", viewset=RevenueCategoryViewSet, basename="revenues_categories"
)
router.register(prefix="revenues", viewset=RevenueViewSet, basename="revenues")
router.register(prefix="bank_account", viewset=BankAccountViewSet, basename="bank_account")

urlpatterns = router.urls
