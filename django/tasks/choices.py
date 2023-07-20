from djchoices import ChoiceItem, DjangoChoices


class TaskStates(DjangoChoices):
    pending = ChoiceItem("PENDING", label="Pending", notification_display="enfileirada")
    started = ChoiceItem("STARTED", label="Started", notification_display="iniciada")
    success = ChoiceItem("SUCCESS", label="Success", notification_display="finalizada")
    failure = ChoiceItem("FAILURE", label="Failure", notification_display="falhou")
