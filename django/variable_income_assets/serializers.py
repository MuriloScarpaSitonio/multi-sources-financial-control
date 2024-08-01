from decimal import ROUND_HALF_UP, Decimal, DecimalException

from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import NotFound

from shared.serializers_utils import CustomChoiceField

from . import choices
from .adapters.key_value_store import get_dollar_conversion_rate
from .domain import commands
from .domain.exceptions import ValidationError as DomainValidationError
from .domain.models import Asset as AssetDomainModel
from .domain.models import TransactionDTO
from .models import (
    Asset,
    AssetReadModel,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)
from .service_layer import messagebus
from .service_layer.unit_of_work import DjangoUnitOfWork

# region: custom fields


class UpperCharField(serializers.CharField):
    def to_internal_value(self, data) -> str:
        return super().to_internal_value(data).upper()


# endregion: custom fields


class MinimalAssetSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=choices.AssetTypes.choices)
    currency = CustomChoiceField(choices=choices.Currencies.choices)
    code = UpperCharField(max_length=10)

    class Meta:
        model = Asset
        fields = ("pk", "code", "type", "currency")


class TransactionSimulateSerializer(serializers.Serializer):
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15, required=False)
    total = serializers.DecimalField(decimal_places=8, max_digits=20, required=False)

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
            "quantity",
            "operation_date",
            "user",
            "current_currency_conversion_rate",
        )
        extra_kwargs = {
            "operation_date": {"required": True},
            "current_currency_conversion_rate": {"allow_null": False, "min_value": 1},
        }


class TransactionListSerializer(TransactionSerializer):
    action = CustomChoiceField(choices=choices.TransactionActions.choices)
    asset = MinimalAssetSerializer(read_only=True)
    asset_pk = serializers.IntegerField(write_only=True, allow_null=False, required=False)

    class Meta(TransactionSerializer.Meta):
        fields = TransactionSerializer.Meta.fields + ("asset", "asset_pk")

    def create(self, validated_data: dict) -> Transaction:
        try:
            asset: Asset = Asset.objects.annotate_for_domain().get(
                user=validated_data.pop("user"), pk=validated_data.pop("asset_pk")
            )
        except Asset.DoesNotExist as e:
            raise NotFound({"asset": "Not found."}) from e

        try:
            asset_domain = asset.to_domain()
            asset_domain.add_transaction(transaction_dto=TransactionDTO(**validated_data))
            uow = DjangoUnitOfWork(asset_pk=asset.pk)
            messagebus.handle(message=commands.CreateTransactions(asset=asset_domain), uow=uow)
            transaction = uow.assets.transactions.seen.pop()  # hacky for DRF
            transaction.asset = asset  # set to avoid doing a query to get `Asset` infos when
            # serializing `transaction` object
            return transaction
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail) from e

    def update(self, instance: Transaction, validated_data: dict) -> Transaction:
        try:
            user = validated_data.pop("user")
            validated_data.pop("asset_pk", None)

            asset_domain: AssetDomainModel = (
                Asset.objects.annotate_for_domain().get(id=instance.asset_id).to_domain()
            )

            asset_domain.update_transaction(
                dto=TransactionDTO(**validated_data), transaction=instance
            )
            messagebus.handle(
                message=commands.UpdateTransaction(transaction=instance, asset=asset_domain),
                uow=DjangoUnitOfWork(asset_pk=instance.asset_id),
            )
            return instance
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail) from e

    def delete(self) -> None:
        asset_domain: AssetDomainModel = (
            Asset.objects.annotate_for_domain().get(id=self.instance.asset_id).to_domain()
        )
        try:
            asset_domain.validate_delete_transaction_command(
                dto=TransactionDTO(
                    action=self.instance.action,
                    quantity=self.instance.quantity,
                    price=Decimal(),
                    operation_date=self.instance.operation_date,
                )
            )
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail) from e

        messagebus.handle(
            message=commands.DeleteTransaction(transaction=self.instance, asset=asset_domain),
            uow=DjangoUnitOfWork(asset_pk=self.instance.asset_id),
        )


class PassiveIncomeSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    type = CustomChoiceField(choices=choices.PassiveIncomeTypes.choices)
    event_type = CustomChoiceField(choices=choices.PassiveIncomeEventTypes.choices)
    asset = MinimalAssetSerializer(read_only=True)
    asset_pk = serializers.IntegerField(write_only=True, allow_null=False, required=False)

    class Meta:
        model = PassiveIncome
        fields = (
            "id",
            "type",
            "event_type",
            "operation_date",
            "amount",
            "user",
            "asset",
            "asset_pk",
            "current_currency_conversion_rate",
        )
        extra_kwargs = {"current_currency_conversion_rate": {"allow_null": False, "min_value": 1}}

    def validate(self, attrs: dict) -> dict:
        asset_pk = self.instance.asset_id if self.instance is not None else attrs.get("asset_pk")
        current_currency_conversion_rate = attrs.get("current_currency_conversion_rate")
        if (
            current_currency_conversion_rate
            and attrs["event_type"] == choices.PassiveIncomeEventTypes.provisioned
        ):
            raise serializers.ValidationError(
                {
                    "current_currency_conversion_rate": (
                        "This value must be ommited for "
                        f"{choices.PassiveIncomeEventTypes.provisioned} events"
                    )
                }
            )

        try:
            currency = (
                Asset.objects.only("currency").get(user=attrs.pop("user"), pk=asset_pk).currency
            )
        except Asset.DoesNotExist as e:
            raise NotFound({"asset": "Not found."}) from e

        if attrs["event_type"] == choices.PassiveIncomeEventTypes.credited:
            if attrs["operation_date"] > timezone.localdate():
                raise serializers.ValidationError(
                    {
                        "operation_date": (
                            "The date can't be in the future if the income was already credited"
                        )
                    }
                )
            if currency == choices.Currencies.real:
                attrs["current_currency_conversion_rate"] = 1
            else:
                if current_currency_conversion_rate in (None, 1):
                    raise serializers.ValidationError(
                        {
                            "current_currency_conversion_rate": (
                                "This value can't be ommited or set to 1 if the asset's currency "
                                f"is different than {choices.Currencies.real}"
                            )
                        }
                    )
        return attrs

    def create(self, validated_data: dict) -> PassiveIncome:
        validated_data.update(asset_id=validated_data.pop("asset_pk"))
        return super().create(validated_data=validated_data)

    def update(self, instance: PassiveIncome, validated_data: dict) -> PassiveIncome:
        if validated_data["event_type"] == choices.PassiveIncomeEventTypes.provisioned:
            validated_data["current_currency_conversion_rate"] = None
        return super().update(instance, validated_data)


class AssetSerializer(MinimalAssetSerializer):
    objective = CustomChoiceField(choices=choices.AssetObjectives.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Asset
        fields = MinimalAssetSerializer.Meta.fields + ("id", "objective", "user")

    def validate(self, attrs: dict) -> dict:
        if attrs["currency"] not in choices.AssetTypes.get_choice(attrs["type"]).valid_currencies:
            raise serializers.ValidationError(
                {
                    "currency__type": (
                        f"{attrs['currency']} is not valid for an asset of type {attrs['type']}"
                    )
                }
            )
        if (
            self.instance is None
            or (self.instance is not None and self.instance.currency != attrs["currency"])
        ) and Asset.objects.filter(
            user=self.context["request"].user,
            code=attrs["code"],
            type=attrs["type"],
            currency=attrs["currency"],
        ).exists():
            raise serializers.ValidationError(
                {
                    "code__currency__type__user__unique": (
                        "You can't have two assets with the same code, currency and type"
                    )
                }
            )
        return attrs


class AssetSimulateSerializer(serializers.ModelSerializer):
    roi = serializers.SerializerMethodField(read_only=True)
    roi_percentage = serializers.SerializerMethodField(read_only=True)
    normalized_total_invested = serializers.SerializerMethodField(read_only=True)
    adjusted_avg_price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Asset
        fields = (
            "code",
            "adjusted_avg_price",
            "roi",
            "roi_percentage",
            "normalized_total_invested",
        )

    def get_roi(self, obj: Asset) -> Decimal:
        current_price = (
            obj.current_price_metadata
            if obj.currency == choices.Currencies.real
            else obj.current_price_metadata * get_dollar_conversion_rate()
        )
        return (current_price * obj.quantity_balance) - (
            (obj.normalized_avg_price * obj.quantity_balance)
            - obj.normalized_credited_incomes
            - obj.normalized_total_sold
        )

    def get_roi_percentage(self, obj: Asset) -> Decimal:
        return (self.get_roi(obj) / obj.normalized_total_bought) * Decimal("100.00")

    def get_normalized_total_invested(self, obj: Asset) -> Decimal:
        return obj.normalized_avg_price * obj.quantity_balance

    def get_adjusted_avg_price(self, obj: Asset) -> Decimal:
        return (
            (obj.quantity_balance * obj.avg_price) - obj.credited_incomes
        ) / obj.quantity_balance


class AssetTransactionSimulateEndpointSerializer(serializers.Serializer):
    old = AssetSimulateSerializer()
    new = AssetSimulateSerializer()


class AssetReadModelSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(read_only=True, choices=choices.AssetTypes.choices)
    sector = CustomChoiceField(read_only=True, choices=choices.AssetSectors.choices)
    objective = CustomChoiceField(read_only=True, choices=choices.AssetObjectives.choices)
    normalized_total_invested = serializers.DecimalField(decimal_places=4, max_digits=20)
    normalized_roi = serializers.DecimalField(decimal_places=4, max_digits=20)
    roi_percentage = serializers.DecimalField(decimal_places=3, max_digits=20)
    percentage_invested = serializers.SerializerMethodField(read_only=True)
    current_price = serializers.DecimalField(
        max_digits=13, decimal_places=6, read_only=True, source="metadata.current_price"
    )
    current_price_updated_at = serializers.DateTimeField(
        read_only=True, source="metadata.current_price_updated_at"
    )

    class Meta:
        model = AssetReadModel
        fields = (
            "write_model_pk",
            "code",
            "type",
            "sector",
            "objective",
            "quantity_balance",
            "current_price",
            "current_price_updated_at",
            "adjusted_avg_price",
            "normalized_roi",
            "roi_percentage",
            "normalized_total_invested",
            "currency",
            "percentage_invested",
        )

    def get_percentage_invested(self, obj: AssetReadModel) -> Decimal:
        try:
            result = obj.normalized_total_invested / self.context["total_invested_agg"]
        except (DecimalException, KeyError):
            result = Decimal()
        return result * Decimal("100.0")


class AssetRoidIndicatorsSerializer(serializers.Serializer):
    total = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    total_diff_percentage = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    ROI_opened = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    ROI_closed = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class PassiveIncomesIndicatorsSerializer(serializers.Serializer):
    avg = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_credited = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    provisioned_future = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff_percentage = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class TransactionsIndicatorsSerializer(serializers.Serializer):
    avg = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_bought = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    current_sold = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff_percentage = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class _TransactionHistoricSerializer(serializers.Serializer):
    month = serializers.DateField(format="%d/%m/%Y")
    total_bought = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    total_sold = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )
    diff = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class TransactionHistoricSerializer(serializers.Serializer):
    historic = _TransactionHistoricSerializer(many=True)
    avg = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class _AssetReportSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=20, decimal_places=2, rounding=ROUND_HALF_UP)


class AssetTypeReportSerializer(_AssetReportSerializer):
    type = CustomChoiceField(choices=choices.AssetTypes.choices)


class AssetTotalInvestedBySectorReportSerializer(_AssetReportSerializer):
    sector = CustomChoiceField(choices=choices.AssetSectors.choices)


class AssetTotalInvestedByObjectiveReportSerializer(_AssetReportSerializer):
    objective = CustomChoiceField(choices=choices.AssetObjectives.choices)


class _PassiveIncomeHistoricSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=20, decimal_places=2, rounding=ROUND_HALF_UP)
    month = serializers.DateField(format="%d/%m/%Y")


class PassiveIncomeHistoricSerializer(serializers.Serializer):
    historic = _PassiveIncomeHistoricSerializer(many=True)
    avg = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, rounding=ROUND_HALF_UP
    )


class PassiveIncomeAssetsAggregationSerializer(serializers.Serializer):
    code = serializers.CharField()
    total = serializers.DecimalField(max_digits=20, decimal_places=2, rounding=ROUND_HALF_UP)


class AssetsTotalInvestedSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetsTotalInvestedSnapshot
        fields = ("operation_date", "total")
        fields = ("operation_date", "total")
