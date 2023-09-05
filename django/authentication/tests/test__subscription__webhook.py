from datetime import datetime, timezone
from time import time

from django.utils.timezone import now

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "subscription/webhook"


@pytest.mark.freeze_time("2023-09-01")
@pytest.fixture
def event_factory(stripe_customer_id):
    class Obj:
        customer = stripe_customer_id
        current_period_end = int(time()) + 24 * 60 * 60

    class Data:
        object = Obj()

    class Event:
        data = Data()

        def __init__(self, t) -> None:
            self.type = t

    return lambda event_type: Event(event_type)


@pytest.mark.freeze_time("2023-09-01")
@pytest.mark.parametrize(
    "event_type", ("customer.subscription.updated", "customer.subscription.resumed")
)
def test__webhook__subscription_activated(
    api_client, event_factory, event_type, stripe_user, mocker
):
    # GIVEN
    stripe_user.is_active = False
    stripe_user.save()

    mocker.patch(
        "authentication.views.StripeWebhook.construct_event", return_value=event_factory(event_type)
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    assert stripe_user.is_active
    assert stripe_user.subscription_ends_at == datetime.fromtimestamp(
        int(time()) + 24 * 60 * 60, tz=timezone.utc
    )


@pytest.mark.freeze_time("2023-09-01")
@pytest.mark.parametrize(
    "event_type", ("customer.subscription.deleted", "customer.subscription.paused")
)
def test__webhook__subscription_inactivated(
    api_client, event_factory, event_type, stripe_user, mocker
):
    # GIVEN
    mocker.patch(
        "authentication.views.StripeWebhook.construct_event", return_value=event_factory(event_type)
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stripe_user.refresh_from_db()
    assert not stripe_user.is_active
    assert stripe_user.subscription_ends_at == now()


def test__webhook__subscription_trial_will_end(api_client, stripe_user, event_factory, mocker):
    # GIVEN
    mocker.patch(
        "authentication.views.StripeWebhook.construct_event",
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
        "authentication.views.StripeWebhook.construct_event",
        return_value=event_factory("customer.subscription.pending_update_applied"),
    )

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK


def test__webhook__invalid_data(api_client, mocker):
    # GIVEN
    mocker.patch("authentication.views.StripeWebhook.construct_event", side_effect=Exception)

    # WHEN
    response = api_client.post(URL)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
