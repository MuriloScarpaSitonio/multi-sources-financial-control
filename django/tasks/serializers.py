from django.utils import timezone

from rest_framework import serializers

from variable_income_assets.serializers import TransactionSerializer, PassiveIncomeSerializer

from .bases import TaskWithHistory
from .choices import TaskStates
from .managers import TaskHistoryQuerySet
from .models import TaskHistory


class TaskHistorySerializer(serializers.ModelSerializer):
    transactions = TransactionSerializer(read_only=True, many=True)
    incomes = PassiveIncomeSerializer(read_only=True, many=True)
    notification_display_title = serializers.SerializerMethodField()
    notification_display_text = serializers.SerializerMethodField()

    class Meta:
        model = TaskHistory
        fields = (
            "id",
            "name",
            "state",
            "started_at",
            "finished_at",
            "error",
            "notified_at",
            "updated_at",
            "opened_at",
            "transactions",
            "incomes",
            "notification_display_text",
            "notification_display_title",
        )

    def get_notification_display_title(self, obj: TaskHistory) -> str:
        # in a bigger project we'd store this kind of configuration in the DB
        tasks_notification_display_map = TaskWithHistory.get_notification_display_map()
        return "Integração '{}' {}".format(
            tasks_notification_display_map[obj.name],
            TaskStates.get_choice(obj.state).notification_display,
        )

    def get_notification_display_text(self, obj: TaskHistory) -> str:
        # in a bigger project we'd store this kind of configuration in the DB
        if obj.is_failed_task:
            text = "Por favor, clique para visitar a página da tarefa e ver o erro completo"
        elif obj.is_transaction_task:
            text = f"{obj.transactions.count()} transações encontradas"
        elif obj.is_passive_incomes_task:
            text = f"{obj.incomes.count()} rendimentos passivos encontrados"
        elif obj.is_prices_task:
            text = "Preços atualizados"
        else:
            text = ""

        return text


class TaskHistoryBulkSaveAsNotifiedSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)

    def bulk_update(self, queryset: TaskHistoryQuerySet[TaskHistory]) -> int:
        return (
            queryset.filter(id__in=self.validated_data["ids"])
            .was_updated_after_notified()
            .update(notified_at=timezone.now())
        )
