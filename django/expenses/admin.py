from django.contrib import admin
from django.forms import CharField, ModelForm, Select

from .choices import Colors
from .models import BankAccount, Expense, Revenue

admin.site.register(BankAccount)


class _ExpenseForm(ModelForm):
    category_hex_color = CharField(max_length=50, widget=Select(choices=Colors.choices))
    source_hex_color = CharField(max_length=50, widget=Select(choices=Colors.choices))

    class Meta:
        model = Expense
        fields = "__all__"  # noqa: DJ007


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    search_fields = ("description",)
    list_filter = ("category", "is_fixed")
    form = _ExpenseForm


@admin.register(Revenue)
class RevenueAdmin(admin.ModelAdmin):
    search_fields = ("description",)
    list_filter = ("is_fixed",)
