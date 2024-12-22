from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    BankAccountView,
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

urlpatterns = router.urls + [path("bank_account", BankAccountView.as_view(), name="bank_account")]
