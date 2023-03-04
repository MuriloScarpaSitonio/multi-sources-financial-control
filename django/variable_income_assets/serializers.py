from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_UP, DecimalException
from typing import List

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import NotFound

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
from .domain.exceptions import ValidationError as DomainValidationError
from .domain.models import Asset as AssetDomainModel, TransactionDTO
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


class TransactionListSerializer(TransactionSerializer):
    action = CustomChoiceField(choices=TransactionActions.choices)
    asset_code = serializers.CharField(source="asset.code")

    class Meta(TransactionSerializer.Meta):
        fields = TransactionSerializer.Meta.fields + ("asset_code",)

    def create(self, validated_data):
        try:
            asset: Asset = Asset.objects.get(
                user=validated_data.pop("user"), code=validated_data.pop("asset")["code"]
            )
        except Asset.DoesNotExist:
            raise NotFound({"asset": "Not found."})

        try:
            transaction = asset.to_domain().add_transaction(
                transaction_dto=TransactionDTO(**validated_data)
            )
            transaction.asset_id = asset.pk
            transaction.save()
            return transaction
        except DomainValidationError as e:
            raise serializers.ValidationError({e.field: e.message})

    def update(self, instance: Transaction, validated_data: dict):
        try:
            validated_data.pop("user")
            validated_data.pop("asset")
            if "created_at" not in validated_data:
                validated_data.update(created_at=instance.created_at)

            asset: AssetDomainModel = instance.asset.to_domain()

            asset.update_transaction(dto=TransactionDTO(**validated_data), transaction=instance)
            instance.save()
            return instance
        except DomainValidationError as e:
            raise serializers.ValidationError({e.field: e.message})


class PassiveIncomeSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    asset_code = serializers.CharField(source="asset.code")
    type = CustomChoiceField(choices=PassiveIncomeTypes.choices)
    event_type = CustomChoiceField(choices=PassiveIncomeEventTypes.choices)

    class Meta:
        model = PassiveIncome
        fields = ("id", "asset_code", "type", "event_type", "operation_date", "amount", "user")

    def update(self, instance: PassiveIncome, validated_data: dict) -> PassiveIncome:
        validated_data.pop("asset")
        return super().update(instance, validated_data)

    def create(self, validated_data: dict) -> PassiveIncome:
        validated_data.update(
            asset_id=(
                Asset.objects.only("pk")
                .get(user=validated_data.pop("user"), code=validated_data.pop("asset")["code"])
                .pk
            )
        )
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
