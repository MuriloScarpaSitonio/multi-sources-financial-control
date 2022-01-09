from copy import deepcopy
from rest_framework import serializers

from tasks.models import TaskHistory
from .fields import TimeStampToDateField
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
        data = deepcopy(self.data)
        data["initial_price"] = (
            asset.avg_price_from_transactions if data["action"] == TransactionActions.sell else None
        )
        return Transaction.objects.create(
            external_id=data.pop("id"), asset=asset, fetched_by=task_history, **data
        )
