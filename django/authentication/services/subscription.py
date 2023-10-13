from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.utils import timezone

from ..choices import SubscriptionStatus
from . import stripe

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


def activate_user(user: UserModel) -> UserModel:
    customer = stripe.create_customer(email=user.email)
    subscription = stripe.create_trial_subscription(customer=customer)

    now = timezone.localtime()
    user.is_active = True
    user.is_personal_finances_module_enabled = True
    user.is_investments_module_enabled = True
    user.is_investments_integrations_module_enabled = True
    user.stripe_customer_id = customer.stripe_id
    user.stripe_subscription_id = subscription.stripe_id
    user.stripe_subscription_updated_at = now
    user.subscription_ends_at = now + timedelta(days=settings.DEFAULT_TRIAL_PERIOD_IN_DAYS)
    user.subscription_status = SubscriptionStatus.TRIALING
    user.save(
        update_fields=(
            "is_active",
            "is_personal_finances_module_enabled",
            "is_investments_module_enabled",
            "is_investments_integrations_module_enabled",
            "stripe_customer_id",
            "stripe_subscription_id",
            "stripe_subscription_updated_at",
            "subscription_ends_at",
            "subscription_status",
        )
    )
    return user
