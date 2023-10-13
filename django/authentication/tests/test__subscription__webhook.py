from datetime import datetime, timezone
from time import time

from django.db.utils import IntegrityError
from django.utils.timezone import now

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_405_METHOD_NOT_ALLOWED,
)

from config.settings.base import BASE_API_URL

from ..choices import SubscriptionStatus

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "subscription/webhook"


@pytest.mark.freeze_time("2023-09-01")
@pytest.fixture
def event_factory(stripe_customer_id):
    class Plan:
        product = "prd_2804yhdn"

    class Obj:
        id = "sub_ndjiu2y34"
        customer = stripe_customer_id
        current_period_end = int(time()) + 24 * 60 * 60
        status = "active"
        plan = Plan()

        def __init__(self, default_payment_method: str | None):
            self.default_payment_method = default_payment_method

    class Data:
        def __init__(self, default_payment_method: str | None, previous_attributes: dict):
            self.object = Obj(default_payment_method=default_payment_method)
            self.previous_attributes = previous_attributes

    class Event:
        def __init__(self, t: str, default_payment_method: str | None, previous_attributes: dict):
            self.type = t
            self.data = Data(default_payment_method, previous_attributes)

    def _factory(
        event_type: str,
        previous_attributes: dict | None = None,
        default_payment_method: str | None = "pm_2839yhdn",
    ) -> Event:
        return Event(event_type, default_payment_method, previous_attributes or {})

    return _factory


@pytest.mark.freeze_time("2023-09-01")
def test__webhook__subscription_updated(api_client, event_factory, stripe_user, mocker):
    # GIVEN
    stripe_user.is_personal_finances_module_enabled = False
    stripe_user.is_investments_module_enabled = False
    stripe_user.is_investments_integrations_module_enabled = False
    stripe_user.save()

    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.updated"),
    )
    mocker.patch(
        "authentication.services.stripe.stripe.Product.retrieve",
        return_value=mocker.Mock(metadata=mocker.Mock(modules="investments;personal_finances")),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    assert stripe_user.subscription_status == SubscriptionStatus.ACTIVE
    assert stripe_user.is_personal_finances_module_enabled
    assert stripe_user.is_investments_module_enabled
    assert not stripe_user.is_investments_integrations_module_enabled
    assert stripe_user.has_default_payment_method
    assert stripe_user.subscription_ends_at == datetime.fromtimestamp(
        int(time()) + 24 * 60 * 60, tz=timezone.utc
    )
    assert stripe_user.stripe_subscription_updated_at == now()


@pytest.mark.freeze_time("2023-09-01")
def test__webhook__subscription_updated__has_default_payment_method__false(
    api_client, event_factory, stripe_user, mocker
):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.updated", default_payment_method=None),
    )
    mocker.patch(
        "authentication.services.stripe.stripe.Product.retrieve",
        return_value=mocker.Mock(metadata=mocker.Mock(modules="investments;personal_finances")),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    assert not stripe_user.has_default_payment_method


@pytest.mark.freeze_time("2023-09-01")
def test__webhook__subscription_updated__is_cancellation_details_update(
    api_client, event_factory, stripe_user, mocker
):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory(
            "customer.subscription.updated",
            previous_attributes={"cancellation_details": {"feedback": None}},
        ),
    )
    mocker.patch(
        "authentication.services.stripe.stripe.Product.retrieve",
        return_value=mocker.Mock(metadata=mocker.Mock(modules="investments;personal_finances")),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    # this was supposed to be true if it wans't for the condition we are testing
    assert not stripe_user.has_default_payment_method


def test__webhook__enforce_model_constraints(api_client, event_factory, stripe_user, mocker):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.updated"),
    )
    mocker.patch(
        "authentication.services.stripe.stripe.Product.retrieve",
        return_value=mocker.Mock(
            metadata=mocker.Mock(modules="investments_integrations;personal_finances")
        ),
    )

    # WHEN
    with pytest.raises(IntegrityError) as e:
        api_client.post(URL)

    # THEN
    assert (
        str(e.value)
        == "CHECK constraint failed: investments_integrations_module_cant_be_enabled_alone"
    )


@pytest.mark.freeze_time("2023-09-01")
def test__webhook__subscription_deleted(api_client, event_factory, stripe_user, mocker):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.deleted"),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    assert stripe_user.subscription_status == SubscriptionStatus.CANCELED
    assert not stripe_user.is_personal_finances_module_enabled
    assert not stripe_user.is_investments_module_enabled
    assert not stripe_user.is_investments_integrations_module_enabled
    assert not stripe_user.stripe_subscription_id
    assert stripe_user.subscription_ends_at == now()
    assert stripe_user.stripe_subscription_updated_at == now()


def test__webhook__subscription_trial_will_end(api_client, stripe_user, event_factory, mocker):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.trial_will_end"),
    )
    mocked_email_dispatcher = mocker.patch(
        "authentication.services.stripe.dispatch_trial_will_end_email"
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    assert mocked_email_dispatcher.call_args[1] == {"user": stripe_user}


def test__webhook__event_not_registered(api_client, event_factory, mocker):
    # GIVEN
    mocker.patch(
        "authentication.views.stripe.construct_event",
        return_value=event_factory("customer.subscription.pending_update_applied"),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK


def test__webhook__invalid_data(api_client, mocker):
    # GIVEN
    mocker.patch("authentication.views.stripe.construct_event", side_effect=Exception)

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST


def test__webhook__method_not_allowed(api_client):
    # GIVEN

    # WHEN
    response = api_client.get(URL)

    # THEN
    assert response.status_code == HTTP_405_METHOD_NOT_ALLOWED
