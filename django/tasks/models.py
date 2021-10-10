from typing import Optional
from django.db import models
from django.conf import settings
from django.utils import timezone

from .choices import TaskStates


class TaskHistory(models.Model):
    id = models.UUIDField(editable=False, primary_key=True)
    name = models.CharField(max_length=50)
    state = models.CharField(
        max_length=20, choices=TaskStates.choices, default=TaskStates.pending
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.deletion.CASCADE,
        related_name="tasks",
    )

    class Meta:
        ordering = ("-finished_at",)

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
            self. error = error
            update_fields += ("error",)
        self.save(update_fields=update_fields)
