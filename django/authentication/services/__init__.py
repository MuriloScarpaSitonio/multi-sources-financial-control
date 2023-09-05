from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.utils import timezone

from . import stripe

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


def activate_user(user: UserModel) -> UserModel:
    customer = stripe.create_customer(email=user.email)
    subscription = stripe.create_trial_subscription(customer=customer)
    user.is_active = True
    user.stripe_customer_id = customer.stripe_id
    user.stripe_subscription_id = subscription.stripe_id
    user.subscription_ends_at = timezone.localtime() + timedelta(days=7)
    user.save(
        update_fields=(
            "is_active",
            "stripe_customer_id",
            "stripe_subscription_id",
            "subscription_ends_at",
        )
    )
    return user
