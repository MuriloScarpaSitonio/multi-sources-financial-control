from collections.abc import Callable
from datetime import datetime
from datetime import timezone as dttimezone
from functools import wraps
from typing import Any
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone as djtimezone

from stripe import Event
from stripe.api_resources.billing_portal import Session as PortalSession
from stripe.api_resources.checkout import Session as CheckoutSession
from stripe.api_resources.customer import Customer
from stripe.api_resources.subscription import Subscription
from stripe.api_resources.subscription_item import SubscriptionItem

from .mailing import dispatch_trial_will_end_email

UserModel = get_user_model()


class StripeHandlersRegistry:
    _registry = {}

    @classmethod
    def _register_decorator(cls, func):
        @wraps(func)
        def wrapper(event: Event) -> Any:
            kwargs = {}
            for arg in func.__annotations__:
                kwargs[arg] = getattr(cls, f"parse_{arg}")(event)
            return func(**kwargs)

        return wrapper

    @staticmethod
    def parse_customer_id(event: Event) -> str:
        return event.data.object.customer

    @staticmethod
    def parse_subscription_ends_at(event: Event) -> datetime:
        return datetime.fromtimestamp(event.data.object.current_period_end, tz=dttimezone.utc)

    @classmethod
    def register(cls, *event_types: str):
        def decorator(func: Callable[..., Any]) -> Callable:
            for event_type in event_types:
                cls._registry[event_type] = func

            return cls._register_decorator(func)

        return decorator

    @classmethod
    def run(cls, event: Event) -> Any:
        if func := cls._registry.get(event.type):
            return cls._register_decorator(func)(event)


@StripeHandlersRegistry.register("customer.subscription.deleted", "customer.subscription.paused")
def handle_subscription_inactivated(customer_id: str):
    UserModel.objects.filter(stripe_customer_id=customer_id).update(
        is_active=False, subscription_ends_at=djtimezone.localtime()
    )


@StripeHandlersRegistry.register("customer.subscription.updated", "customer.subscription.resumed")
def handle_subscription_activated(customer_id: str, subscription_ends_at: datetime):
    UserModel.objects.filter(stripe_customer_id=customer_id).update(
        subscription_ends_at=subscription_ends_at, is_active=True
    )


@StripeHandlersRegistry.register("customer.subscription.trial_will_end")
def handle_subscription_trial_will_end(customer_id: str):
    dispatch_trial_will_end_email(
        user=UserModel.objects.only("email").get(stripe_customer_id=customer_id)
    )


def create_customer(email: str) -> Customer:
    return Customer.create(email=email, api_key=settings.STRIPE_SECRET_KEY)


def create_trial_subscription(customer: Customer) -> Subscription:
    return Subscription.create(
        customer=customer.stripe_id,
        items=[{"price": settings.STRIPE_SUBSCRIPTION_TYPE_PRICE_MAP["ALL_MONTHLY"]}],
        trial_period_days=7,
        payment_settings={"save_default_payment_method": "on_subscription"},
        trial_settings={"end_behavior": {"missing_payment_method": "pause"}},
        api_key=settings.STRIPE_SECRET_KEY,
    )


def create_checkout_session(stripe_customer_id: str, price_id: str) -> CheckoutSession:
    return CheckoutSession.create(
        customer=stripe_customer_id,
        success_url=urljoin(
            settings.FRONTEND_BASE_URL, "/subscription/success?session_id={CHECKOUT_SESSION_ID}"
        ),
        cancel_url=urljoin(settings.FRONTEND_BASE_URL, "/subscription/cancelled"),
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": price_id}],
        api_key=settings.STRIPE_SECRET_KEY,
    )


def create_portal_session(stripe_customer_id: str) -> PortalSession:
    return PortalSession.create(
        customer=stripe_customer_id,
        return_url=settings.FRONTEND_BASE_URL,
        api_key=settings.STRIPE_SECRET_KEY,
    )


def modify_subscription(stripe_subscription_id: str, price_id: str) -> Subscription:
    subscription_item_id = (
        SubscriptionItem.list(
            subscription=stripe_subscription_id, api_key=settings.STRIPE_SECRET_KEY
        )
        .data[0]
        .id
    )

    return Subscription.modify(
        sid=stripe_subscription_id,
        items=[{"id": subscription_item_id, "price": price_id}],
        api_key=settings.STRIPE_SECRET_KEY,
    )
