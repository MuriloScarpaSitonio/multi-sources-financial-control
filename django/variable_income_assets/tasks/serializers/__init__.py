from copy import deepcopy
from typing import Tuple

from rest_framework import ISO_8601, serializers

from shared.serializers_utils import CustomChoiceField

from .fields import CeiPassiveIncomeChoiceField, CeiTransactionChoiceField, TimeStampToDateField
from ...choices import (
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)
from ...domain.models import TransactionDTO
from ...models import Asset, PassiveIncome, Transaction


class CryptoTransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    currency = CustomChoiceField(choices=TransactionCurrencies.choices)
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15)
    created_at = TimeStampToDateField()
    action = serializers.ChoiceField(choices=TransactionActions.choices)

    def validate_id(self, external_id: str) -> str:
        if Transaction.objects.filter(external_id=external_id).exists():
            raise serializers.ValidationError("Transaction already exists")
        return external_id

    def create(self, asset: Asset, task_history_id: int) -> Transaction:
        data = deepcopy(self.validated_data)
        external_id = data.pop("id")

        transaction = asset.to_domain().add_transaction(transaction_dto=TransactionDTO(**data))
        transaction.asset_id = asset.pk
        transaction.external_id = external_id
        transaction.fetched_by_id = task_history_id
        transaction.save()

        return transaction


class CeiTransactionSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(decimal_places=8, max_digits=15)
    unit_amount = serializers.DecimalField(decimal_places=8, max_digits=15)
    operation_date = serializers.DateField(input_formats=(ISO_8601,))
    action = CeiTransactionChoiceField(choices=TransactionActions.choices)

    def create(self, asset: Asset, task_history_id: int) -> Transaction:
        transaction = asset.to_domain().add_transaction(
            transaction_dto=TransactionDTO(
                action=getattr(TransactionActions, self.validated_data["action"]),
                quantity=self.validated_data["unit_amount"],
                created_at=self.validated_data["operation_date"],
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

    def update_or_create(self, asset: Asset) -> Tuple[PassiveIncome, bool]:
        return PassiveIncome.objects.update_or_create(
            asset=asset,
            type=self.validated_data["income_type"],
            amount=self.validated_data["net_value"],
            operation_date=self.validated_data["operation_date"],
            defaults={"event_type": self.validated_data["event_type"]},
        )
