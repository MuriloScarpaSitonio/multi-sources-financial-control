from uuid import uuid4

import pytest
from factory.django import DjangoModelFactory

from django.utils import timezone

from authentication.tests.conftest import user, secrets

from ..choices import TaskStates
from ..models import TaskHistory


class TaskHistoryFactory(DjangoModelFactory):
    state = TaskStates.success

    class Meta:
        model = TaskHistory


@pytest.fixture
def simple_task_history(user):
    return TaskHistoryFactory(
        id=uuid4(),
        name="sync_binance_transactions_task",
        started_at=timezone.now(),
        finished_at=timezone.now(),
        created_by=user,
    )
