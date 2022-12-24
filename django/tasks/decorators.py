from functools import wraps
from typing import Callable, Optional
from uuid import uuid4

from django.conf import settings

from celery import Task
from rest_framework.exceptions import PermissionDenied

from authentication.models import CustomUser

from .models import TaskHistory


def start_celery_task(task_name: str, user: CustomUser) -> str:
    task_id = uuid4()
    task_history = TaskHistory.objects.create(id=task_id, name=task_name, created_by=user)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        task_history.start()
    return str(task_id)  # str beacause amqp does not handle uuid.UUID


def celery_task_endpoint(
    *,
    task: Optional[Task] = None,
    task_name: Optional[str] = None,
    deprecated: bool = False,
) -> Callable:
    # if task is None and task_name is None:
    #     raise

    # if task is not None and task_name is not None:
    #     raise

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            if not deprecated:
                task_id = start_celery_task(task_name=task_name or task.name, user=request.user)
                if task is not None:
                    task.apply_async(task_id=task_id, kwargs={"username": request.user.username})
            else:
                task_id = None
            return func(self, request, task_id, *args, **kwargs)

        return wrapper

    return decorator
