from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from functools import wraps
from typing import TYPE_CHECKING, Any, Literal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

import stripe

from ..choices import SubscriptionStatus
from .mailing import dispatch_trial_will_end_email

if TYPE_CHECKING:
    from django.core.handlers.asgi import ASGIRequest
    from django.core.handlers.wsgi import WSGIRequest

    SubscriptionModule = Literal["investments", "investments_integrations", "personal_finances"]

UserModel = get_user_model()

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeHandlersRegistry:
    _registry: dict[str, Callable[..., Any]] = {}

    @classmethod
    def _register_decorator(cls, func) -> Callable[[stripe.Event], Any]:
        @wraps(func)
        def wrapper(event: stripe.Event) -> Any:
            kwargs = {}
            for arg in func.__annotations__:
                if arg == "return":
                    continue
                kwargs[arg] = getattr(cls, f"parse_{arg}")(event)
            return func(**kwargs)

        return wrapper

    @staticmethod
    def parse_customer_id(event: stripe.Event) -> str:
        return event.data.object.customer

    @staticmethod
    def parse_status(event: stripe.Event) -> SubscriptionStatus:
        return SubscriptionStatus[event.data.object.status.upper()]

    @staticmethod
    def parse_has_default_payment_method(event: stripe.Event) -> bool:
        return event.data.object.default_payment_method is not None

    @staticmethod
    def parse_is_cancellation_details_update(event: stripe.Event) -> bool:
        return event.data.previous_attributes == {"cancellation_details": {"feedback": None}}

    @staticmethod
    def parse_subscription_ends_at(event: stripe.Event) -> datetime:
        return datetime.fromtimestamp(
            event.data.object.current_period_end, tz=timezone.get_current_timezone()
        )

    @staticmethod
    def parse_subscription_id(event: stripe.Event) -> str:
        return event.data.object.id

    @staticmethod
    def parse_modules(event: stripe.Event) -> list[SubscriptionModule]:
        # as we are not directly creating the subscription we can't append this
        # metadata there so we have to fetch from the product
        product = stripe.Product.retrieve(event.data.object.plan.product)
        return product.metadata.modules.split(";")

    @classmethod
    def register(cls, *event_types: str):
        def decorator(func: Callable[..., Any]) -> Callable:
            for event_type in event_types:
                cls._registry[event_type] = func

            return cls._register_decorator(func)

        return decorator

    @classmethod
    def run(cls, event: stripe.Event) -> Any:
        if func := cls._registry.get(event.type):
            return cls._register_decorator(func)(event)


process_event = StripeHandlersRegistry.run  # alias


@StripeHandlersRegistry.register("customer.subscription.deleted")
def handle_subscription_deleted(*, customer_id: str) -> None:
    UserModel.objects.filter(stripe_customer_id=customer_id).update(
        is_personal_finances_module_enabled=False,
        is_investments_module_enabled=False,
        is_investments_integrations_module_enabled=False,
        stripe_subscription_id=None,
        subscription_status=SubscriptionStatus.CANCELED,
        subscription_ends_at=timezone.localtime(),
        stripe_subscription_updated_at=timezone.localtime(),
    )


@StripeHandlersRegistry.register("customer.subscription.updated")
def handle_subscription_updated(
    *,
    customer_id: str,
    subscription_id: str,
    subscription_ends_at: datetime,
    status: SubscriptionStatus,
    modules: list[SubscriptionModule],
    has_default_payment_method: bool,
    is_cancellation_details_update: bool,
) -> None:
    if not is_cancellation_details_update:
        # se decidir oferecer um desconto, olhar por event.data.object.cancel_at_period_end
        UserModel.objects.filter(stripe_customer_id=customer_id).update(
            stripe_subscription_id=subscription_id,
            subscription_ends_at=subscription_ends_at,
            subscription_status=status,
            stripe_subscription_updated_at=timezone.localtime(),
            has_default_payment_method=has_default_payment_method,
            is_personal_finances_module_enabled="personal_finances" in modules,
            is_investments_module_enabled="investments" in modules,
            is_investments_integrations_module_enabled="investments_integrations" in modules,
        )


@StripeHandlersRegistry.register("customer.subscription.trial_will_end")
def handle_subscription_trial_will_end(*, customer_id: str) -> None:
    dispatch_trial_will_end_email(
        user=UserModel.objects.only("email").get(stripe_customer_id=customer_id)
    )


def create_customer(email: str) -> stripe.Customer:
    return stripe.Customer.create(email=email)


def create_trial_subscription(customer: stripe.Customer) -> stripe.Subscription:
    return stripe.Subscription.create(
        customer=customer.stripe_id,
        items=[{"price": settings.STRIPE_TRIAL_SUBSCRIPTION_PRICE_ID}],
        trial_period_days=settings.DEFAULT_TRIAL_PERIOD_IN_DAYS,
        payment_settings={"save_default_payment_method": "on_subscription"},
        trial_settings={"end_behavior": {"missing_payment_method": "cancel"}},
    )


def create_portal_session(customer_id: str) -> stripe.billing_portal.Session:
    return stripe.billing_portal.Session.create(
        customer=customer_id, return_url=settings.FRONTEND_BASE_URL + "/me?tab=1&refresh=true"
    )


def create_checkout_session(price_id: str, customer_id: str) -> stripe.checkout.Session:
    return stripe.checkout.Session.create(
        success_url=settings.FRONTEND_BASE_URL + "/subscription/done",
        cancel_url=settings.FRONTEND_BASE_URL + "/subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        payment_method_types=["card"],
        customer=customer_id,
    )


def list_active_products() -> list[stripe.Product]:
    return stripe.Product.search(expand=["data.default_price"], query="active:'true'").data


def construct_event(request: WSGIRequest | ASGIRequest) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload=request.body,
        sig_header=request.headers.get("Stripe-Signature"),
        secret=settings.STRIPE_WEBHOOK_SECRET,
    )
