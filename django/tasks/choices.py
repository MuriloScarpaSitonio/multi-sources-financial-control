from djchoices import DjangoChoices, ChoiceItem


class TaskStates(DjangoChoices):
    pending = ChoiceItem("PENDING", label="Pending", notification_display="enfileirada")
    received = ChoiceItem("RECEIVED", label="Received", notification_display="recebida")
    started = ChoiceItem("STARTED", label="Started", notification_display="iniciada")
    success = ChoiceItem("SUCCESS", label="Success", notification_display="finalizada")
    failure = ChoiceItem("FAILURE", label="Failure", notification_display="falhou")
    revoked = ChoiceItem("REVOKED", label="Revoked", notification_display="revogada")
    rejected = ChoiceItem("REJECTED", label="Rejected", notification_display="rejeitada")
    retry = ChoiceItem("RETRY", label="Retry", notification_display="esperando retry")
    ignored = ChoiceItem("IGNORED", label="Ignored", notification_display="ignorada")
