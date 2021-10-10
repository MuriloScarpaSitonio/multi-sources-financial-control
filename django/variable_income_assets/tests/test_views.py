import pytest

from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import client, user
from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.usefixtures("transactions", "passive_incomes")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 1),
        ("code=ALUP", 1),
        # ("ROI_type=PROFIT", 1),
        # ("ROI_type=LOSS", 0),
        ("type=STOCK", 1),
        ("type=STOCK USA", 0),
    ],
)
def test_should_filter_assets(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


def test_should_call_cei_crawler_celery_task(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.cei_assets_crawler.apply_async"
    )

    # WHEN
    response = client.get(f"{URL}/fetch_cei")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user.username
