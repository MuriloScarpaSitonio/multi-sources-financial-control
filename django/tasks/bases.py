from datetime import datetime, timedelta
from typing import Dict, Union
from uuid import uuid4

from celery import Task
from billiard.einfo import ExceptionInfo
from requests.exceptions import RequestException

from .choices import TaskStates
from .models import TaskHistory


class TaskWithHistory(Task):
    autoretry_for = (RequestException,)
    max_retries = 5
    retry_backoff = True
    retry_backoff_max = 300  # 5min

    def get_last_run(
        self, username: str, as_date: bool = False, timedelta_kwargs: Dict[str, int] = dict()
    ) -> Union[datetime, None]:
        last_history = TaskHistory.objects.filter(
            name=self.name, state=TaskStates.success, created_by__username=username
        ).first()
        if last_history is not None:
            finished_at = last_history.finished_at
            if finished_at is not None:
                return (
                    finished_at.date() - timedelta(**timedelta_kwargs)
                    if as_date
                    else finished_at - timedelta(**timedelta_kwargs)
                )

    def on_failure(self, exc, task_id, args, kwargs, einfo: ExceptionInfo) -> None:
        TaskHistory.objects.get(pk=task_id).finish(error=str(einfo.exception))
        super().on_failure(exc, task_id, args, kwargs, einfo)

    def on_success(self, retval, task_id, args, kwargs):
        TaskHistory.objects.get(pk=task_id).finish()
        super().on_success(retval, task_id, args, kwargs)
