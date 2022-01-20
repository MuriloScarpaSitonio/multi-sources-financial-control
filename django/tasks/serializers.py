from datetime import timezone
from django.db.models import QuerySet

from rest_framework import serializers

from variable_income_assets.serializers import TransactionSerializer, PassiveIncomeSerializer

from .models import TaskHistory


class TaskHistorySerializer(serializers.ModelSerializer):
    transactions = TransactionSerializer(read_only=True, many=True)
    incomes = PassiveIncomeSerializer(read_only=True, many=True)

    class Meta:
        model = TaskHistory
        fields = (
            "id",
            "name",
            "state",
            "started_at",
            "finished_at",
            "error",
            "transactions",
            "incomes",
        )


class TaskHistoryBulkSaveAsNotifiedSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)

    def bulk_update(self, queryset: QuerySet[TaskHistory]) -> int:
        return queryset.filter(id__in=self.validated_data["ids"]).update(
            notificated_at=timezone.now()
        )
