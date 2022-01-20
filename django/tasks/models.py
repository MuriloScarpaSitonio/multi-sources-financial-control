from typing import Optional
from django.db import models
from django.conf import settings
from django.utils import timezone

from .choices import TaskStates
from .managers import TaskHistoryQuerySet


class TaskHistory(models.Model):
    id = models.UUIDField(editable=False, primary_key=True)
    name = models.CharField(max_length=50)
    state = models.CharField(max_length=20, choices=TaskStates.choices, default=TaskStates.pending)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.deletion.CASCADE,
        related_name="tasks",
    )
    # when an user clicks on the notification icon in the frontend
    notified_at = models.DateTimeField(null=True, blank=True)
    # when an user visits the task page
    opened_at = models.DateTimeField(null=True, blank=True)

    objects = TaskHistoryQuerySet.as_manager()

    class Meta:
        ordering = ("-finished_at",)

    def __str__(self) -> str:
        return f"<TaskHistory {self.name} {self.state} ({self.id})>"  # pragma: no cover

    __repr__ = __str__

    def start(self) -> None:
        self.started_at = timezone.now()
        self.state = TaskStates.started
        self.save(update_fields=("started_at", "state"))

    def finish(self, error: Optional[str] = None) -> None:
        update_fields = ("finished_at", "state")
        self.finished_at = timezone.now()
        if error is None:
            self.state = TaskStates.success
        else:
            self.state = TaskStates.failure
            self.error = error
            update_fields += ("error",)
        self.save(update_fields=update_fields)
