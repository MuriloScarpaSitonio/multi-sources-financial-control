from django.contrib import admin

from .models import TaskHistory


@admin.register(TaskHistory)
class TransactionAdmin(admin.ModelAdmin):
    search_fields = ("name",)
    list_filter = ("state",)
