from typing import Self

from django.db.models import F, Q, QuerySet
from django.utils import timezone

from .choices import TaskStates


class TaskHistoryQuerySet(QuerySet):
    def filter_updated_after_notified(self) -> Self:
        return self.filter(Q(notified_at__lt=F("updated_at")) | Q(notified_at__isnull=True))

    def was_successfully_executed_today(self, name: str, created_by_id: int) -> bool:
        return self.filter(
            name=name,
            created_by_id=created_by_id,
            state=TaskStates.success,
            finished_at__date=timezone.localdate(),
        ).exists()
