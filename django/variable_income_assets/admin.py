from django.contrib import admin
from django.forms import CharField, ModelForm, Select
from django.db.models import QuerySet

from .choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)
from .models import Asset, AssetMetaData, AssetReadModel, PassiveIncome, Transaction


class _TransactionForm(ModelForm):
    action = CharField(max_length=50, widget=Select(choices=TransactionActions.choices))
    currency = CharField(max_length=50, widget=Select(choices=TransactionCurrencies.choices))

    class Meta:
        model = Transaction
        fields = "__all__"


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    search_fields = ("asset__code",)
    list_filter = ("asset__code",)
    form = _TransactionForm


class _PassiveIncomeForm(ModelForm):
    type = CharField(max_length=50, widget=Select(choices=PassiveIncomeTypes.choices))
    event_type = CharField(max_length=50, widget=Select(choices=PassiveIncomeEventTypes.choices))

    class Meta:
        model = PassiveIncome
        fields = "__all__"


@admin.register(PassiveIncome)
class PassiveIncomeAdmin(admin.ModelAdmin):
    list_filter = ("asset__code",)
    form = _PassiveIncomeForm


def _create_form(django_model: Asset | AssetMetaData | AssetReadModel, *fields) -> ModelForm:
    mapping = {
        "objective": CharField(max_length=50, widget=Select(choices=AssetObjectives.choices)),
        "sector": CharField(max_length=50, widget=Select(choices=AssetSectors.choices)),
        "type": CharField(max_length=50, widget=Select(choices=AssetTypes.choices)),
        "currency": CharField(max_length=50, widget=Select(choices=TransactionCurrencies.choices)),
    }

    class _ModelForm(ModelForm):
        class Meta:
            model = django_model
            fields = "__all__"

    for field in fields:
        _ModelForm.declared_fields[field] = mapping[field]
    return _ModelForm


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    search_fields = ("code",)
    list_filter = ("type",)
    form = _create_form(Asset, "type", "objective")


@admin.register(AssetMetaData)
class AssetMetaDataAdmin(admin.ModelAdmin):
    search_fields = ("code",)
    list_filter = ("type", "sector")
    form = _create_form(AssetMetaData, "type", "currency", "sector")


@admin.register(AssetReadModel)
class AssetReadModelAdmin(admin.ModelAdmin):
    search_fields = ("code",)
    list_filter = (
        "type",
        "metadata__sector",  # TODO: unable to resolve via repository?
    )
    form = _create_form(AssetMetaData, "type", "currency", "objective")
