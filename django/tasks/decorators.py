from functools import wraps
from typing import Callable
from uuid import uuid4

from celery import Task

from .models import TaskHistory


def celery_task_endpoint(task: Task) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            task_id = uuid4()
            TaskHistory.objects.create(
                id=task_id, name=task.name, created_by=request.user
            )
            task_id = str(task_id)  # str beacause amqp does not handle uuid.UUID
            task.apply_async(
                task_id=task_id, kwargs={"username": request.user.username}
            )
            return func(self, request, task_id, *args, **kwargs)

        return wrapper

    return decorator
