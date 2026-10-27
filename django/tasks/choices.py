from django.db.models import TextChoices


class TaskStates(TextChoices):
    pending = "PENDING", "Pending"
    started = "STARTED", "Started"
    success = "SUCCESS", "Success"
    failure = "FAILURE", "Failure"

    @property
    def notification_display(self) -> str:
        return {
            self.pending: "enfileirada",
            self.started: "iniciada",
            self.success: "finalizada",
            self.failure: "falhou",
        }[self]
