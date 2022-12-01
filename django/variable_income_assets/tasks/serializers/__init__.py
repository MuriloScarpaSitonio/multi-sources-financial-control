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
from ...models import Asset, PassiveIncome, Transaction


class CryptoTransactionAlreadyExistsException(Exception):
    pass


class CryptoTransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    currency = CustomChoiceField(choices=TransactionCurrencies.choices)
    price = serializers.DecimalField(decimal_places=8, max_digits=15)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15)
    created_at = TimeStampToDateField()
    action = serializers.ChoiceField(choices=TransactionActions.choices)

    def is_valid(self, raise_exception: bool = False) -> bool:
        result = super().is_valid(raise_exception=raise_exception)
        already_exists = Transaction.objects.filter(external_id=self.data["id"]).exists()
        if already_exists and raise_exception:
            raise CryptoTransactionAlreadyExistsException
        return result and not already_exists

    def create(self, asset: Asset, task_history_id: int) -> Transaction:
        data = deepcopy(self.validated_data)
        data.update({"external_id": data.pop("id")})
        return Transaction.objects.create(asset=asset, fetched_by_id=task_history_id, **data)


class CeiTransactionSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(decimal_places=8, max_digits=15)
    unit_amount = serializers.DecimalField(decimal_places=8, max_digits=15)
    operation_date = serializers.DateField(input_formats=(ISO_8601,))
    action = CeiTransactionChoiceField(choices=TransactionActions.choices)

    def get_or_create(self, asset: Asset) -> Tuple[Transaction, bool]:
        return Transaction.objects.get_or_create(
            asset=asset,
            price=self.validated_data["unit_price"],
            quantity=self.validated_data["unit_amount"],
            created_at=self.validated_data["operation_date"],
            defaults={"action": getattr(TransactionActions, self.validated_data["action"])},
        )


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
