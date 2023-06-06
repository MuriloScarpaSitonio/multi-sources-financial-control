from functools import wraps
from typing import Callable, Optional
from uuid import uuid4

from django.utils import timezone

from authentication.models import CustomUser

from .choices import TaskStates
from .models import TaskHistory


def start_task(task_name: str, user: CustomUser) -> str:
    task_id = uuid4()
    TaskHistory.objects.create(
        id=task_id,
        name=task_name,
        created_by=user,
        started_at=timezone.now(),
        state=TaskStates.started,
    )
    return str(task_id)  # str beacause amqp does not handle uuid.UUID


def task_finisher(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, task_history_id: str, **kwargs):
        error = None
        try:
            func(*args, task_history_id=task_history_id, **kwargs)
        except Exception as e:
            error = repr(e)
        TaskHistory.objects.get(pk=task_history_id).finish(error=error)

    return wrapper
