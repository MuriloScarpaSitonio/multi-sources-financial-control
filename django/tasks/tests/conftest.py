import pytest
from django.utils import timezone
from factory.django import DjangoModelFactory

from authentication.tests.conftest import secrets, user

from ..choices import TaskStates
from ..models import TaskHistory


class TaskHistoryFactory(DjangoModelFactory):
    state = TaskStates.success

    class Meta:
        model = TaskHistory


@pytest.fixture
def simple_task_history(user):
    return TaskHistoryFactory(
        name="sync_binance_transactions_task",
        started_at=timezone.now(),
        finished_at=timezone.now(),
        created_by=user,
    )
