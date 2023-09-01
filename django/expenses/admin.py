from django.contrib import admin

from .models import Expense, Revenue


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    search_fields = ("description",)
    list_filter = ("category", "is_fixed")


@admin.register(Revenue)
class RevenueAdmin(admin.ModelAdmin):
    search_fields = ("description",)
    list_filter = ("is_fixed",)
