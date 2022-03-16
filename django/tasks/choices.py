from djchoices import DjangoChoices, ChoiceItem

from celery import states


class TaskStates(DjangoChoices):
    pending = ChoiceItem(states.PENDING, label="Pending", notification_display="enfileirada")
    received = ChoiceItem(states.RECEIVED, label="Received", notification_display="recebida")
    started = ChoiceItem(states.STARTED, label="Started", notification_display="iniciada")
    success = ChoiceItem(states.SUCCESS, label="Success", notification_display="finalizada")
    failure = ChoiceItem(states.FAILURE, label="Failure", notification_display="falhou")
    revoked = ChoiceItem(states.REVOKED, label="Revoked", notification_display="revogada")
    rejected = ChoiceItem(states.REJECTED, label="Rejected", notification_display="rejeitada")
    retry = ChoiceItem(states.RETRY, label="Retry", notification_display="esperando retry")
    ignored = ChoiceItem(states.IGNORED, label="Ignored", notification_display="ignorada")
