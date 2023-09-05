import pytest
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "subscription"


@pytest.fixture
def stripe_settings(settings, stripe_secret_key, stripe_plan_id):
    settings.STRIPE_SUBSCRIPTION_TYPE_PRICE_MAP = {"ALL_MONTHLY": stripe_plan_id}
    settings.STRIPE_SECRET_KEY = stripe_secret_key


@pytest.mark.usefixtures("stripe_user", "stripe_settings")
def test__checkout_session(client, stripe_customer_id, stripe_secret_key, stripe_plan_id, mocker):
    # GIVEN
    mocked_session = mocker.patch(
        "authentication.views.stripe.create_checkout_session",
        return_value=mocker.Mock(stripe_id="se_284o", url="test.com"),
    )

    # WHEN
    response = client.post(f"{URL}/checkout_session", data={"plan_id": "ALL_MONTHLY"})

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"session_id": "se_284o", "url": "test.com"}
    assert mocked_session.call_args[1] == {
        "stripe_customer_id": stripe_customer_id,
        "price_id": stripe_plan_id,
    }


def test__checkout_session__invalid_plan_id(client):
    # GIVEN
    data = {"plan_id": "test"}

    # WHEN
    response = client.post(f"{URL}/checkout_session", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"plan_id": ['"test" is not a valid choice.']}


@pytest.mark.usefixtures("stripe_user", "stripe_settings")
def test__portal_session(client, stripe_customer_id, mocker):
    # GIVEN
    mocked_session = mocker.patch(
        "authentication.views.stripe.create_portal_session",
        return_value=mocker.Mock(url="test.com"),
    )

    # WHEN
    response = client.post(f"{URL}/portal_session")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"url": "test.com"}
    assert mocked_session.call_args[1] == {"stripe_customer_id": stripe_customer_id}


@pytest.mark.usefixtures("stripe_user", "stripe_settings")
def test__modify(client, mocker, stripe_secret_key, stripe_plan_id, stripe_subscription_id):
    # GIVEN
    class Fake:
        id = "2843y"

    mocked_subscription_item_list = mocker.patch(
        "authentication.services.stripe.SubscriptionItem.list",
        return_value=mocker.Mock(data=[Fake()]),
    )
    mocked_subscription_modify = mocker.patch("authentication.services.stripe.Subscription.modify")

    # WHEN
    response = client.patch(f"{URL}/modify", data={"plan_id": "ALL_MONTHLY"})

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_subscription_item_list.call_args[1] == {
        "subscription": stripe_subscription_id,
        "api_key": stripe_secret_key,
    }
    assert mocked_subscription_modify.call_args[1] == {
        "sid": stripe_subscription_id,
        "items": [{"id": "2843y", "price": stripe_plan_id}],
        "api_key": stripe_secret_key,
    }


def test__modify__invalid_plan_id(client):
    # GIVEN
    data = {"plan_id": "ttt"}

    # WHEN
    response = client.patch(f"{URL}/modify", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"plan_id": ['"ttt" is not a valid choice.']}
