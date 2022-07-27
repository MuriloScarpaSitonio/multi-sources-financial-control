from typing import TYPE_CHECKING

from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_UP, DecimalException

from rest_framework import serializers

from config.settings.dynamic import dynamic_settings
from shared.serializers_utils import CustomChoiceField

from .choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionCurrencies,
)
from .models import Asset, PassiveIncome, Transaction

if TYPE_CHECKING:  # pragma: no cover
    from rest_framework.utils.serializer_helpers import ReturnList


class TransactionSimulateSerializer(serializers.Serializer):
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15, required=False)
    total = serializers.DecimalField(decimal_places=8, max_digits=15, required=False)

    def validate(self, attrs):
        if attrs.get("quantity") is None and attrs.get("total") is None:
            raise serializers.ValidationError("`quantity` or `total` is required")
        return attrs


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("action", "price", "currency", "quantity", "created_at")


class AssetSerializer(serializers.ModelSerializer):
    roi = serializers.SerializerMethodField(read_only=True)
    roi_percentage = serializers.SerializerMethodField(read_only=True)
    adjusted_avg_price = serializers.SerializerMethodField(read_only=True)
    total_invested = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        read_only=True,
        rounding=ROUND_HALF_UP,
        source="total_adjusted_invested_from_transactions",
    )

    class Meta:
        model = Asset
        fields = (
            "code",
            "adjusted_avg_price",
            "roi",
            "roi_percentage",
            "total_invested",
        )

    def get_roi(self, obj: Asset) -> Decimal:
        return obj.get_roi()

    def get_roi_percentage(self, obj: Asset) -> Decimal:
        return obj.get_roi(percentage=True)

    def get_adjusted_avg_price(self, obj: Asset) -> Decimal:
        return (
            obj.adjusted_avg_price_from_transactions
            if obj.currency_from_transactions == TransactionCurrencies.real
            else obj.adjusted_avg_price_from_transactions / dynamic_settings.DOLLAR_CONVERSION_RATE
        )


class AssetListSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=AssetTypes.choices)
    sector = CustomChoiceField(choices=AssetSectors.choices)
    objective = CustomChoiceField(choices=AssetObjectives.choices)
    currency = serializers.CharField(read_only=True)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    quantity_balance = serializers.DecimalField(
        decimal_places=8, max_digits=15, read_only=True, rounding=ROUND_HALF_UP
    )
    adjusted_avg_price = serializers.SerializerMethodField(read_only=True)
    roi = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True, rounding=ROUND_HALF_UP
    )
    roi_percentage = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True, rounding=ROUND_HALF_UP
    )
    total_invested = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True, rounding=ROUND_HALF_UP
    )
    percentage_invested = serializers.SerializerMethodField(read_only=True)
    current_percentage = serializers.SerializerMethodField(read_only=True)
    transactions = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "code",
            "type",
            "sector",
            "objective",
            "user",
            "quantity_balance",
            "current_price",
            "adjusted_avg_price",
            "roi",
            "roi_percentage",
            "total_invested",
            "currency",
            "percentage_invested",
            "current_percentage",
            "transactions",
        )

    def get_adjusted_avg_price(self, obj: Asset) -> Decimal:
        return (
            obj.adjusted_avg_price
            if obj.currency == TransactionCurrencies.real
            else obj.adjusted_avg_price / dynamic_settings.DOLLAR_CONVERSION_RATE
        )

    def get_percentage_invested(self, obj: Asset) -> Decimal:
        try:
            result = obj.total_invested / self.context["total_invested_agg"]
        except DecimalException:  # pragma: no cover
            result = Decimal()
        return result * Decimal("100.0")

    def get_current_percentage(self, obj: Asset) -> Decimal:
        value = (
            (obj.current_price or Decimal())
            if obj.currency == TransactionCurrencies.real
            else (obj.current_price or Decimal()) * dynamic_settings.DOLLAR_CONVERSION_RATE
        )

        try:
            result = (value * obj.quantity_balance) / self.context["current_total_agg"]
        except DecimalException:
            result = Decimal()
        return result * Decimal("100.0")

    def get_transactions(self, obj: Asset) -> "ReturnList":
        return TransactionSerializer(obj.transactions.all()[:5], many=True).data


class AssetRoidIndicatorsSerializer(serializers.Serializer):
    current_total = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    ROI = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    ROI_opened = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    ROI_finished = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class AssetIncomesIndicatorsSerializer(serializers.Serializer):
    incomes = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class PassiveIncomeSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=PassiveIncomeTypes.choices)
    event_type = CustomChoiceField(choices=PassiveIncomeEventTypes.choices)
    code = serializers.CharField(source="asset.code")

    class Meta:
        model = PassiveIncome
        fields = ("type", "event_type", "operation_date", "amount", "code")


class PassiveIncomesIndicatorsSerializer(serializers.Serializer):
    avg = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_credited = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    provisioned_future = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class _AssetReportSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class AssetTypeReportSerializer(_AssetReportSerializer):
    type = CustomChoiceField(choices=AssetTypes.choices)


class AssetTotalInvestedBySectorReportSerializer(_AssetReportSerializer):
    sector = CustomChoiceField(choices=AssetSectors.choices)


class AssetTotalInvestedByObjectiveReportSerializer(_AssetReportSerializer):
    objective = CustomChoiceField(choices=AssetObjectives.choices)
