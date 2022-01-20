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


@pytest.fixture(autouse=True)
def celery_always_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


@pytest.fixture
def simple_task_history(user):
    return TaskHistoryFactory(
        id=uuid4(),
        name="test_task",
        started_at=timezone.now(),
        finished_at=timezone.now(),
        created_by=user,
    )
