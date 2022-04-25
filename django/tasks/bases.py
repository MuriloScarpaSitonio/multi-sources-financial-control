from datetime import datetime, timedelta
from typing import Any, Dict, Union

from django.db.models import QuerySet

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

    @classmethod
    def get_notification_display_map(cls):
        return {
            task_name: task.notification_display
            for task_name, task in cls.app.tasks.items()
            if getattr(task, "notification_display", None) is not None
        }

    def get_last_run(
        self, username: str, as_date: bool = False, timedelta_kwargs: Dict[str, int] = dict()
    ) -> Union[datetime, None]:
        last_history = TaskHistory.objects.filter(
            name=self.name, state=TaskStates.success, created_by__username=username
        ).first()
        finished_at = last_history.finished_at if last_history is not None else None
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

    def get_extra_kwargs_from_queryset(self, queryset: QuerySet) -> Dict[str, Any]:
        # in a bigger project we'd store this kind of configuration in the DB
        return (
            {"codes": list(queryset.opened().values_list("code", flat=True))}
            if self.name == "fetch_current_assets_prices"
            else {}
        )
