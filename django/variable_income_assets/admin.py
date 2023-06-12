from django.contrib import admin
from django.db.models import QuerySet

from .choices import TransactionActions
from .models import Asset, PassiveIncome, Transaction


class TransactionSellInitialPriceAdminFilter(admin.SimpleListFilter):  # pragma: no cover
    # Human-readable title which will be displayed in the
    # right admin sidebar just above the filter options.
    title = "SELL __ initial_price"

    # Parameter for the filter that will be used in the URL query.
    parameter_name = "initial_price__isnull"

    def lookups(self, *_, **__) -> tuple[tuple[str, str], tuple[str, str]]:
        """
        Returns a list of tuples. The first element in each
        tuple is the coded value for the option that will
        appear in the URL query. The second element is the
        human-readable name for the option that will appear
        in the right sidebar.
        """
        return (("False", "with"), ("True", "without"))

    def queryset(self, _, queryset: QuerySet) -> QuerySet:
        """
        Returns the filtered queryset based on the value
        provided in the query string and retrievable via
        `self.value()`.
        """
        value = self.value()
        if value is not None:
            return queryset.filter(
                action=TransactionActions.sell, initial_price__isnull=value == "True"
            )


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    search_fields = ("asset__code",)
    list_filter = (TransactionSellInitialPriceAdminFilter, "asset__code")


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_filter = ("type",)


@admin.register(PassiveIncome)
class PassiveIncomeAdmin(admin.ModelAdmin):
    list_filter = ("asset__code",)
