from functools import wraps
from typing import Callable
from uuid import uuid4

from django.utils import timezone

from authentication.models import CustomUser

from .choices import TaskStates
from .models import TaskHistory


def start_task(task_name: str, user: CustomUser, return_obj: bool = False) -> TaskHistory | str:
    task_id = uuid4()
    task = TaskHistory.objects.create(
        id=task_id,
        name=task_name,
        created_by=user,
        started_at=timezone.now(),
        state=TaskStates.started,
    )
    return task if return_obj else str(task_id)


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
