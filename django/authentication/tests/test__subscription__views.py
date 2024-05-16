import pytest
from rest_framework.status import HTTP_200_OK

from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "subscription"


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
    assert mocked_session.call_args.kwargs == {"customer_id": stripe_customer_id}
