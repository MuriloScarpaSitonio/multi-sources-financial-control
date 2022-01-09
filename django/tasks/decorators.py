from functools import wraps
from typing import Callable, Optional
from uuid import uuid4

from django.conf import settings

from celery import Task

from .models import TaskHistory


def celery_task_endpoint(task: Optional[Task] = None, task_name: Optional[str] = None) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            task_id = uuid4()
            task_history = TaskHistory.objects.create(
                id=task_id, name=task_name or task.name, created_by=request.user
            )
            if settings.CELERY_TASK_ALWAYS_EAGER:
                task_history.start()
            task_id = str(task_id)  # str beacause amqp does not handle uuid.UUID
            if task is not None:
                task.apply_async(task_id=task_id, kwargs={"username": request.user.username})
            return func(self, request, task_id, *args, **kwargs)

        return wrapper

    return decorator
