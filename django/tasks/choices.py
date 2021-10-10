from djchoices import DjangoChoices, ChoiceItem

from celery import states


class TaskStates(DjangoChoices):
    pending = ChoiceItem(states.PENDING, label="Pending")
    received = ChoiceItem(states.RECEIVED, label="Received")
    started = ChoiceItem(states.STARTED, label="Started")
    success = ChoiceItem(states.SUCCESS, label="Success")
    failure = ChoiceItem(states.FAILURE, label="Failure")
    revoked = ChoiceItem(states.REVOKED, label="Revoked")
    rejected = ChoiceItem(states.REJECTED, label="Rejected")
    retry = ChoiceItem(states.RETRY, label="Retry")
    ignored = ChoiceItem(states.IGNORED, label="Ignored")
