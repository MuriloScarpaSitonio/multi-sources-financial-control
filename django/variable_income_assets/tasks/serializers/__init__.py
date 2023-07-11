from copy import deepcopy

from rest_framework import ISO_8601, serializers

from .fields import CeiPassiveIncomeChoiceField, CeiTransactionChoiceField, TimeStampToDateField
from ..utils import fetch_currency_conversion_rate
from ...choices import PassiveIncomeEventTypes, PassiveIncomeTypes, TransactionActions
from ...domain.commands import CreateTransactions
from ...domain.models import TransactionDTO
from ...models import Asset, PassiveIncome, Transaction
from ...service_layer.unit_of_work import DjangoUnitOfWork


class CryptoTransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15)
    operation_date = TimeStampToDateField()
    action = serializers.ChoiceField(choices=TransactionActions.choices)

    def validate_id(self, external_id: str) -> str:
        if Transaction.objects.filter(external_id=external_id).exists():
            raise serializers.ValidationError("Transaction already exists")
        return external_id

    def create(self, asset: Asset, task_history_id: int) -> Transaction:
        from ...service_layer import messagebus  # avoid cirtular import error

        data = deepcopy(self.validated_data)
        external_id = data.pop("id")
        current_currency_conversion_rate = (
            fetch_currency_conversion_rate(
                operation_date=data["operation_date"], currency=asset.currency
            )
            if data["action"] == TransactionActions.sell
            else None
        )

        asset_domain = asset.to_domain()
        asset_domain.add_transaction(
            transaction_dto=TransactionDTO(
                **data,
                external_id=external_id,
                fetched_by_id=task_history_id,
                current_currency_conversion_rate=current_currency_conversion_rate
            )
        )
        uow = DjangoUnitOfWork(asset_pk=asset.pk)
        messagebus.handle(
            message=CreateTransactions(asset=asset_domain, dispatch_event=False), uow=uow
        )
        return uow.assets.transactions.seen.pop()  # hacky for DRF


class CeiTransactionSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(decimal_places=8, max_digits=15)
    unit_amount = serializers.DecimalField(decimal_places=8, max_digits=15)
    operation_date = serializers.DateField(input_formats=(ISO_8601,))
    action = CeiTransactionChoiceField(choices=TransactionActions.choices)

    def create(self, asset: Asset, task_history_id: int) -> Transaction:  # pragma: no cover
        transaction = asset.to_domain().add_transaction(
            transaction_dto=TransactionDTO(
                action=getattr(TransactionActions, self.validated_data["action"]),
                quantity=self.validated_data["unit_amount"],
                operation_date=self.validated_data["operation_date"],
                price=self.validated_data["unit_price"],
            )
        )
        transaction.asset_id = asset.pk
        transaction.fetched_by_id = task_history_id
        transaction.save()
        return transaction


class CeiPassiveIncomeSerializer(serializers.Serializer):
    income_type = CeiPassiveIncomeChoiceField(choices=PassiveIncomeTypes.choices)
    net_value = serializers.DecimalField(decimal_places=2, max_digits=6)
    operation_date = serializers.DateField(input_formats=(ISO_8601,))
    event_type = CeiPassiveIncomeChoiceField(choices=PassiveIncomeEventTypes.choices)

    def update_or_create(self, asset: Asset) -> tuple[PassiveIncome, bool]:  # pragma: no cover
        return PassiveIncome.objects.update_or_create(
            asset=asset,
            type=self.validated_data["income_type"],
            amount=self.validated_data["net_value"],
            operation_date=self.validated_data["operation_date"],
            defaults={"event_type": self.validated_data["event_type"]},
        )
