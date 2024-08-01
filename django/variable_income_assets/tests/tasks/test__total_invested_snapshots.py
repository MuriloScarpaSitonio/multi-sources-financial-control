from datetime import date

import pytest

from shared.exceptions import NotFirstDayOfMonthException

from ...models import Asset, AssetsTotalInvestedSnapshot
from ...service_layer.tasks import create_total_invested_snapshot_for_all_users
from ...tests.shared import get_current_total_invested_brute_force

pytestmark = pytest.mark.django_db


@pytest.mark.freeze_time("2024-07-24")
def test_should_raise_error_if_not_1st_day_of_month():
    # GIVEN

    # WHEN
    with pytest.raises(NotFirstDayOfMonthException):
        create_total_invested_snapshot_for_all_users()

    # THEN


@pytest.mark.usefixtures("report_data", "sync_assets_read_model")
@pytest.mark.freeze_time("2024-07-01", tz_offset=+3)
def test_should_create_snapshot(user):
    # GIVEN
    current_total_invested = sum(
        get_current_total_invested_brute_force(asset) for asset in Asset.objects.filter(user=user)
    )

    # WHEN
    create_total_invested_snapshot_for_all_users()

    # THEN
    assert (
        AssetsTotalInvestedSnapshot.objects.filter(
            user=user, operation_date=date(2024, 7, 1), total=current_total_invested
        ).count()
        == 1
    )
