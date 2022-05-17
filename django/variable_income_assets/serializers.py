from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_UP, DecimalException

from rest_framework import serializers

from config.settings.base import DOLLAR_CONVERSION_RATE
from shared.serializers_utils import CustomChoiceField

from .choices import AssetTypes, PassiveIncomeEventTypes, PassiveIncomeTypes, TransactionCurrencies
from .models import Asset, PassiveIncome, Transaction


class AssetSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=AssetTypes.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    quantity_balance = serializers.DecimalField(
        decimal_places=8, max_digits=15, read_only=True, rounding=ROUND_HALF_UP
    )
    current_price = serializers.SerializerMethodField(read_only=True)
    adjusted_avg_price = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True, rounding=ROUND_HALF_UP
    )
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

    class Meta:
        model = Asset
        fields = (
            "code",
            "type",
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
        )

    @staticmethod
    def _convert_value(value: Decimal, currency: str) -> Decimal:
        return (
            (value or Decimal())
            if currency == TransactionCurrencies.real
            # TODO: change this hardcoded conversion to a dynamic one
            else (value or Decimal()) * DOLLAR_CONVERSION_RATE
        )

    def get_current_price(self, obj: Asset) -> Decimal:
        return self._convert_value(obj.current_price, currency=obj.currency)

    def get_percentage_invested(self, obj: Asset) -> Decimal:
        try:
            result = obj.total_invested / self.context["total_invested_agg"]
        except DecimalException:
            result = Decimal()
        return result * Decimal("100.0")

    def get_current_percentage(self, obj: Asset) -> Decimal:
        try:
            result = (self.get_current_price(obj) * obj.quantity_balance) / self.context[
                "current_total_agg"
            ]
        except DecimalException:
            result = Decimal()
        return result * Decimal("100.0")


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
    total = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    credited_total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    provisioned_total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff_percentage = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class AssetReportSerializer(serializers.Serializer):
    type = CustomChoiceField(choices=AssetTypes.choices)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class TransactionSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="asset.code")

    class Meta:
        model = Transaction
        fields = ("action", "price", "currency", "quantity", "created_at", "code")
