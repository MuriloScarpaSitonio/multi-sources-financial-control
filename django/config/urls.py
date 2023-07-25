from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.settings.base import BASE_API_URL

urlpatterns = [
    path(BASE_API_URL + "docs", SpectacularAPIView.as_view(), name="schema"),
    path(
        BASE_API_URL + "swagger", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"
    ),
    path("admin/", admin.site.urls),
    path(BASE_API_URL, include("authentication.urls")),
    path(BASE_API_URL, include("expenses.urls")),
    path(BASE_API_URL, include("variable_income_assets.urls")),
    path(BASE_API_URL, include("tasks.urls")),
]
