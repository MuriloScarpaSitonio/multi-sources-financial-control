from celery import signals

from .models import TaskHistory


@signals.task_prerun.connect
def start_history(task_id: str, *args, **kwargs) -> None:
    TaskHistory.objects.get(pk=task_id).start()
