from rest_framework import routers

from .views import ExpenseViewSet

expenses_router = routers.DefaultRouter(trailing_slash=False)
expenses_router.register(prefix="expenses", viewset=ExpenseViewSet, basename="expenses")

urlpatterns = expenses_router.urls
