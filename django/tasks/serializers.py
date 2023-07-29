from django.utils import timezone

from rest_framework import serializers

from .choices import TaskStates
from .managers import TaskHistoryQuerySet
from .models import TaskHistory


class TaskHistorySerializer(serializers.ModelSerializer):
    notification_display_title = serializers.SerializerMethodField()

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
            "notification_display_text",
            "notification_display_title",
        )

    def get_notification_display_title(self, obj: TaskHistory) -> str:
        # in a bigger project we'd store this kind of configuration in the DB
        tasks_notification_display_map = {
            "sync_binance_transactions_task": "Transações da Binance",
            "sync_kucoin_transactions_task": "Transações da KuCoin",
        }
        try:
            return "Integração '{}' {}".format(
                tasks_notification_display_map[obj.name],
                TaskStates.get_choice(obj.state).notification_display,
            )
        except KeyError:
            return "Integração depreceada"


class TaskHistoryBulkSaveAsNotifiedSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)

    def bulk_update(self, queryset: TaskHistoryQuerySet[TaskHistory]) -> int:
        return (
            queryset.filter(id__in=self.validated_data["ids"])
            .filter_updated_after_notified()
            .update(notified_at=timezone.now())
        )
