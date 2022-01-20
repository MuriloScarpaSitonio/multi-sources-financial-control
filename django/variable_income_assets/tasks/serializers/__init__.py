from copy import deepcopy
from rest_framework import ISO_8601, serializers

from tasks.models import TaskHistory
from .fields import CeiTransactionChoiceField, TimeStampToDateField
from ...choices import TransactionActions
from ...models import Asset, Transaction

class CryptoTransactionAlreadyExistsException(Exception):
    pass


class CryptoTransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    currency = serializers.CharField()
    price = serializers.DecimalField(decimal_places=6, max_digits=13)
    quantity = serializers.DecimalField(decimal_places=8, max_digits=15)
    created_at = TimeStampToDateField()
    action = serializers.ChoiceField(choices=TransactionActions.choices)

    def is_valid(self, raise_exception: bool = False) -> bool:
        result = super().is_valid(raise_exception=raise_exception)
        already_exists = Transaction.objects.filter(external_id=self.data["id"]).exists()
        if already_exists and raise_exception:
            raise CryptoTransactionAlreadyExistsException
        return result and not already_exists

    def create(self, asset: Asset, task_history: TaskHistory) -> Transaction:
        data = deepcopy(self.validated_data)
        data.update({"external_id": data.pop("id")})
        return Transaction.objects.create(asset=asset, fetched_by=task_history, **data)


class CeiTransactionSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(decimal_places=6, max_digits=13)
    unit_amount = serializers.DecimalField(decimal_places=8, max_digits=15)
    operation_date = serializers.DateField(input_formats=(ISO_8601,))
    action = CeiTransactionChoiceField(choices=TransactionActions.choices)

    def create(self, asset: Asset, task_history: TaskHistory) -> Transaction:
        data = deepcopy(self.validated_data)
        data.update(
            {
                "price": data.pop("unit_price"),
                "quantity": data.pop("unit_amount"),
                "created_at": data.pop("operation_date"),
            }
        )
        return Transaction.objects.create(asset=asset, fetched_by=task_history, **data)
