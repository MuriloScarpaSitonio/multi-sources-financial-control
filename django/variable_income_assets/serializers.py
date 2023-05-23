from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_UP, DecimalException

from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import NotFound

from config.settings.dynamic import dynamic_settings
from shared.serializers_utils import CustomChoiceField

from . import choices
from .domain import commands
from .domain.exceptions import ValidationError as DomainValidationError
from .domain.models import Asset as AssetDomainModel, TransactionDTO
from .models import Asset, AssetReadModel, PassiveIncome, Transaction
from .service_layer import messagebus
from .service_layer.unit_of_work import DjangoUnitOfWork


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
            "currency": {"default": choices.TransactionCurrencies.real},
        }


class TransactionListSerializer(TransactionSerializer):
    action = CustomChoiceField(choices=choices.TransactionActions.choices)
    asset_code = serializers.CharField(source="asset.code")
    asset_type = CustomChoiceField(
        source="asset.type", choices=choices.AssetTypes.choices, read_only=True
    )

    class Meta(TransactionSerializer.Meta):
        fields = TransactionSerializer.Meta.fields + ("asset_code", "asset_type")

    def create(self, validated_data):
        try:
            asset: Asset = Asset.objects.annotate_for_domain().get(
                user=validated_data.pop("user"), code=validated_data.pop("asset")["code"]
            )
        except Asset.DoesNotExist:
            raise NotFound({"asset": "Not found."})

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
            raise serializers.ValidationError(e.detail)

    def update(self, instance: Transaction, validated_data: dict):
        try:
            validated_data.pop("user")
            validated_data.pop("asset")
            if "created_at" not in validated_data:
                validated_data.update(created_at=instance.created_at)

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
            raise serializers.ValidationError(e.detail)

    def delete(self) -> None:
        asset_domain: AssetDomainModel = (
            Asset.objects.annotate_for_domain().get(id=self.instance.asset_id).to_domain()
        )
        try:
            asset_domain.validate_delete_transaction_command(
                dto=TransactionDTO(
                    action=self.instance.action,
                    quantity=self.instance.quantity,
                    # No need for these fields
                    currency="",
                    price=Decimal(),
                )
            )
        except DomainValidationError as e:
            raise serializers.ValidationError(e.detail)

        messagebus.handle(
            message=commands.DeleteTransaction(transaction=self.instance, asset=asset_domain),
            uow=DjangoUnitOfWork(asset_pk=self.instance.asset_id),
        )


class PassiveIncomeSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    asset_code = serializers.CharField(source="asset.code")
    type = CustomChoiceField(choices=choices.PassiveIncomeTypes.choices)
    event_type = CustomChoiceField(choices=choices.PassiveIncomeEventTypes.choices)

    class Meta:
        model = PassiveIncome
        fields = ("id", "asset_code", "type", "event_type", "operation_date", "amount", "user")

    def update(self, instance: PassiveIncome, validated_data: dict) -> PassiveIncome:
        validated_data.pop("asset")
        return super().update(instance, validated_data)

    def create(self, validated_data: dict) -> PassiveIncome:
        try:
            asset_pk = (
                Asset.objects.only("pk")
                .get(user=validated_data.pop("user"), code=validated_data.pop("asset")["code"])
                .pk
            )
        except Asset.DoesNotExist:
            raise NotFound({"asset": "Not found."})

        validated_data.update(asset_id=asset_pk)
        return super().create(validated_data=validated_data)


class AssetSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(choices=choices.AssetTypes.choices)
    sector = CustomChoiceField(choices=choices.AssetSectors.choices)
    objective = CustomChoiceField(choices=choices.AssetObjectives.choices)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Asset
        fields = (
            "id",
            "code",
            "type",
            "sector",
            "objective",
            "user",
            "current_price",
            "current_price_updated_at",
        )
        extra_kwargs = {"current_price_updated_at": {"read_only": True}}

    @property
    def validated_data(self) -> dict:
        _validated_data = super().validated_data
        if "current_price" in _validated_data:
            _validated_data.update(current_price_updated_at=timezone.now())
        return _validated_data

    # TODO
    # def validate(self, data: dict):
    #     choice = AssetSectors.get_choice(data["sector"])
    #     if data["type"] not in choice.valid_types:
    #         raise serializers.ValidationError(
    #             {
    #                 "type_sector": f"{data['type']} is not a valid type of asset for the {data['sector']} "
    #                 f"sector. Valid choices: {', '.join(choice.valid_types)}"
    #             }
    #         )
    #     return data

    def validate_code(self, code: str) -> str:
        if (
            self.instance is None
            and Asset.objects.filter(user=self.context["request"].user, code=code).exists()
        ):
            raise serializers.ValidationError("Asset with given code already exists", code="unique")
        return code


class AssetSimulateSerializer(serializers.ModelSerializer):
    roi = serializers.SerializerMethodField(read_only=True)
    roi_percentage = serializers.SerializerMethodField(read_only=True)
    adjusted_avg_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        read_only=True,
        rounding=ROUND_HALF_UP,
        source="adjusted_avg_price_from_transactions",
    )
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


class AssetTransactionSimulateEndpointSerializer(serializers.Serializer):
    old = AssetSimulateSerializer()
    new = AssetSimulateSerializer()


class AssetReadModelSerializer(serializers.ModelSerializer):
    type = CustomChoiceField(read_only=True, choices=choices.AssetTypes.choices)
    sector = CustomChoiceField(read_only=True, choices=choices.AssetSectors.choices)
    objective = CustomChoiceField(read_only=True, choices=choices.AssetObjectives.choices)
    currency = serializers.SerializerMethodField(read_only=True)
    total_invested = serializers.SerializerMethodField(read_only=True)
    roi = serializers.SerializerMethodField(read_only=True)
    percentage_invested = serializers.SerializerMethodField(read_only=True)
    current_percentage = serializers.SerializerMethodField(read_only=True)

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
            "roi",
            "roi_percentage",
            "total_invested",
            "currency",
            "percentage_invested",
            "current_percentage",
        )

    def get_currency(self, obj: AssetReadModel) -> str:
        return obj.currency if obj.currency else choices.ASSET_TYPE_CURRENCY_MAP[obj.type]

    def get_total_invested(self, obj: AssetReadModel) -> Decimal:
        return (
            obj.total_invested
            if obj.currency == choices.TransactionCurrencies.real
            else obj.total_invested * dynamic_settings.DOLLAR_CONVERSION_RATE
        )

    def get_roi(self, obj: AssetReadModel) -> Decimal:
        return (
            obj.roi
            if obj.currency == choices.TransactionCurrencies.real
            else obj.roi * dynamic_settings.DOLLAR_CONVERSION_RATE
        )

    def get_percentage_invested(self, obj: AssetReadModel) -> Decimal:
        try:
            result = self.get_total_invested(obj) / self.context["total_invested_agg"]
        except DecimalException:  # pragma: no cover
            result = Decimal()
        return result * Decimal("100.0")

    def get_current_percentage(self, obj: Asset) -> Decimal:
        value = (
            (obj.current_price or Decimal())
            if obj.currency == choices.TransactionCurrencies.real
            else (obj.current_price or Decimal()) * dynamic_settings.DOLLAR_CONVERSION_RATE
        )

        try:
            result = (value * obj.quantity_balance) / self.context["current_total_agg"]
        except DecimalException:
            result = Decimal()
        return result * Decimal("100.0")


class AssetRoidIndicatorsSerializer(serializers.Serializer):
    total = serializers.DecimalField(
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
    type = CustomChoiceField(choices=choices.AssetTypes.choices)


class AssetTotalInvestedBySectorReportSerializer(_AssetReportSerializer):
    sector = CustomChoiceField(choices=choices.AssetSectors.choices)


class AssetTotalInvestedByObjectiveReportSerializer(_AssetReportSerializer):
    objective = CustomChoiceField(choices=choices.AssetObjectives.choices)


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
