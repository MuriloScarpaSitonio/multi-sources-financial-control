from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_UP, DecimalException
from typing import List, Union

from django.db.transaction import atomic

from rest_framework import serializers

from config.settings.dynamic import dynamic_settings
from shared.serializers_utils import CustomChoiceField

from .choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)
from .models import Asset, PassiveIncome, Transaction


class TransactionSimulateSerializer(serializers.Serializer):
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15, required=False)
    total = serializers.DecimalField(decimal_places=8, max_digits=15, required=False)

    def validate(self, attrs):
        if attrs.get("quantity") is None and attrs.get("total") is None:
            raise serializers.ValidationError("`quantity` or `total` is required")
        return attrs


class TransactionSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Transaction
        fields = (
            "id",
            "action",
            "price",
            "currency",
            "quantity",
            "created_at",
            "user",
            "initial_price",
        )
        extra_kwargs = {
            "initial_price": {"write_only": True, "allow_null": False},
            "currency": {"default": TransactionCurrencies.real},
        }


class NestedAssetCreationMixin:
    @staticmethod
    def _get_or_create_asset(validated_data: dict):
        asset_data = validated_data.pop("asset")
        asset, created = Asset.objects.get_or_create(
            user=validated_data.pop("user"),
            **asset_data,
        )

        if created and asset_data.get("type") is None:
            raise serializers.ValidationError(
                detail={"asset.type": "If the asset does not exist, `type` is required"}
            )
        return asset, created

    def update(
        self, instance: Union[Transaction, PassiveIncome], validated_data: dict
    ) -> Union[Transaction, PassiveIncome]:
        with atomic():
            asset, _ = Asset.objects.get_or_create(
                user=validated_data.pop("user"),
                **validated_data.pop("asset"),
            )
            validated_data.update(asset=asset)
            return super().update(instance, validated_data)


class TransactionListSerializer(NestedAssetCreationMixin, TransactionSerializer):
    action = CustomChoiceField(choices=TransactionActions.choices)
    asset_code = serializers.CharField(source="asset.code")
    asset_type = serializers.ChoiceField(
        source="asset.type",
        choices=AssetTypes.choices,
        write_only=True,
        required=False,
        allow_blank=False,
    )

    class Meta(TransactionSerializer.Meta):
        fields = TransactionSerializer.Meta.fields + ("asset_code", "asset_type")

    def create(self, validated_data: dict) -> Transaction:
        is_sell_transaction = validated_data["action"] == TransactionActions.sell
        with atomic():
            asset, _ = self._get_or_create_asset(validated_data=validated_data)

            if is_sell_transaction:
                if validated_data["quantity"] > asset.quantity_from_transactions:
                    raise serializers.ValidationError(
                        detail={"action": "You can't sell more assets than you own"}
                    )
                if "initial_price" not in validated_data:
                    validated_data.update(initial_price=asset.avg_price_from_transactions)

            if (
                asset.currency_from_transactions  # this value is cached
                and asset.currency_from_transactions != validated_data["currency"]
            ):
                raise serializers.ValidationError(
                    detail={
                        "currency": (
                            "Only one currency per asset is supported. "
                            f"Current currency: {asset.currency_from_transactions}"
                        )
                    }
                )
            validated_data.update(asset=asset)
            return super().create(validated_data=validated_data)


class PassiveIncomeSerializer(NestedAssetCreationMixin, serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    asset_code = serializers.CharField(source="asset.code")
    type = CustomChoiceField(choices=PassiveIncomeTypes.choices)
    event_type = CustomChoiceField(choices=PassiveIncomeEventTypes.choices)

    class Meta:
        model = PassiveIncome
        fields = ("id", "asset_code", "type", "event_type", "operation_date", "amount", "user")

    def create(self, validated_data: dict) -> PassiveIncome:
        with atomic():
            asset, _ = self._get_or_create_asset(validated_data=validated_data)
            validated_data.update(asset=asset)
            return super().create(validated_data=validated_data)


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


class AssetTransactionSimulateEndpointSerializer(serializers.Serializer):
    old = AssetSerializer()
    new = AssetSerializer()


from drf_spectacular.utils import extend_schema_field


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
    passive_incomes = serializers.SerializerMethodField()

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
            "passive_incomes",
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

    @extend_schema_field(TransactionSerializer(many=True))
    def get_transactions(self, obj: Asset) -> List[TransactionSerializer]:  # drf-spectacular
        return TransactionSerializer(obj.transactions.all()[:5], many=True).data

    @extend_schema_field(PassiveIncomeSerializer(many=True))
    def get_passive_incomes(self, obj: Asset) -> List[PassiveIncomeSerializer]:  # drf-spectacular
        return PassiveIncomeSerializer(obj.incomes.all()[:5], many=True).data


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


class TransactionsIndicatorsSerializer(serializers.Serializer):
    avg = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_bought = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_sold = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff_percentage = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class _TransactionHistoricSerializer(serializers.Serializer):
    month = serializers.DateField(format="%d/%m/%Y")
    total_bought = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    total_sold = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class TransactionHistoricSerializer(serializers.Serializer):
    historic = _TransactionHistoricSerializer(many=True)
    avg = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class _AssetReportSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)


class AssetTypeReportSerializer(_AssetReportSerializer):
    type = CustomChoiceField(choices=AssetTypes.choices)


class AssetTotalInvestedBySectorReportSerializer(_AssetReportSerializer):
    sector = CustomChoiceField(choices=AssetSectors.choices)


class AssetTotalInvestedByObjectiveReportSerializer(_AssetReportSerializer):
    objective = CustomChoiceField(choices=AssetObjectives.choices)


class _PassiveIncomeHistoricSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
    month = serializers.DateField(format="%d/%m/%Y")


class PassiveIncomeHistoricSerializer(serializers.Serializer):
    historic = _PassiveIncomeHistoricSerializer(many=True)
    avg = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class PassiveIncomeAssetsAggregationSerializer(serializers.Serializer):
    code = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2, rounding=ROUND_HALF_UP)
