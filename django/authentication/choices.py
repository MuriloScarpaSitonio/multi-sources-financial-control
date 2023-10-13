from enum import auto

from django.db.models import TextChoices


class SubscriptionStatus(TextChoices):
    # https://stripe.com/docs/api/subscriptions/object#subscription_object-status
    INACTIVE = auto(), "Inativa"  # not actually in stripe
    TRIALING = auto(), "Em período de teste"
    ACTIVE = auto(), "Ativa"
    PAST_DUE = auto(), "Vencida"
    UNPAID = auto(), "Sem pagamento"
    CANCELED = auto(), "Cancelada"
    INCOMPLETE = auto(), "Incompleta"
    INCOMPLETE_EXPIRED = auto(), "Incompleta e expirada"
    PAUSED = auto(), "Pausada"
