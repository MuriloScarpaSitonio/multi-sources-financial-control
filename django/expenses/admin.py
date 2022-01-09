from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    search_fields = ("description",)
    list_filter = ("category", "is_fixed")
