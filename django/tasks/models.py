from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone

from .choices import TaskStates
from .constants import ERROR_DISPLAY_TEXT
from .managers import TaskHistoryQuerySet


class TaskHistory(models.Model):
    id = models.UUIDField(editable=False, primary_key=True, default=uuid4)
    name = models.CharField(max_length=50)
    state = models.CharField(
        max_length=20, validators=[TaskStates.validator], default=TaskStates.pending
    )
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.deletion.CASCADE,
        related_name="tasks",
    )

    # TODO: move to notifications table
    # when an user clicks on the notification icon in the frontend
    notified_at = models.DateTimeField(null=True, blank=True)

    # TODO: move to notifications table
    notification_display_text = models.TextField(blank=True, default="")

    objects = TaskHistoryQuerySet.as_manager()

    class Meta:
        ordering = ("-finished_at",)

    def __str__(self) -> str:
        return f"<TaskHistory {self.name} {self.state} ({self.id})>"  # pragma: no cover

    __repr__ = __str__

    async def start(self) -> str:
        self.started_at = timezone.now()
        self.state = TaskStates.started
        await self.asave(update_fields=("started_at", "state", "updated_at"))

    async def finish(
        self, notification_display_text: str = "", error: Exception | None = None
    ) -> None:
        update_fields = ["finished_at", "state", "updated_at", "notification_display_text"]
        self.finished_at = timezone.now()

        if error is None:
            self.state = TaskStates.success
            self.notification_display_text = notification_display_text
        else:
            self.state = TaskStates.failure
            self.error = repr(error)
            self.notification_display_text = ERROR_DISPLAY_TEXT
            update_fields.append("error")

        await self.asave(update_fields=update_fields)
