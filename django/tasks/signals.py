from celery import signals  # pragma: no cover

from .models import TaskHistory  # pragma: no cover


@signals.task_prerun.connect  # pragma: no cover
def start_history(task_id: str, *_, **__) -> None:
    TaskHistory.objects.get(pk=task_id).start()
