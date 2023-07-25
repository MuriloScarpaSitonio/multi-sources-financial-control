from django.contrib import admin

from .models import CustomUser, IntegrationSecret

admin.site.register(CustomUser)
admin.site.register(IntegrationSecret)
