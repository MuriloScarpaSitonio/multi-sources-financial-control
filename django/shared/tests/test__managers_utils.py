from decimal import Decimal

import pytest
from dateutil.relativedelta import relativedelta
from variable_income_assets.models import AssetsTotalInvestedSnapshot

from django.utils import timezone

pytestmark = pytest.mark.django_db


class TestLatestBeforeQuerySet:
    def test__earliest__returns_oldest_snapshot(self, user):
        # GIVEN
        today = timezone.localdate()
        oldest_date = today - relativedelta(years=2)
        middle_date = today - relativedelta(years=1)
        newest_date = today - relativedelta(months=1)

        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=middle_date, total=Decimal("2000")
        )
        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=oldest_date, total=Decimal("1000")
        )
        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=newest_date, total=Decimal("3000")
        )

        # WHEN
        result = AssetsTotalInvestedSnapshot.objects.earliest(user.id)

        # THEN
        assert result == {"total": Decimal("1000"), "operation_date": oldest_date}

    def test__earliest__returns_none_when_no_snapshots(self, user):
        # GIVEN
        # No snapshots created

        # WHEN
        result = AssetsTotalInvestedSnapshot.objects.earliest(user.id)

        # THEN
        assert result is None

    def test__latest_before_or_earliest__returns_latest_before_when_exists(self, user):
        # GIVEN
        today = timezone.localdate()
        target_date = today - relativedelta(months=6)

        # Snapshot before target (should be returned)
        before_target = target_date - relativedelta(days=10)
        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=before_target, total=Decimal("1500")
        )

        # Snapshot after target (should be ignored)
        after_target = target_date + relativedelta(days=10)
        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=after_target, total=Decimal("2500")
        )

        # WHEN
        result = AssetsTotalInvestedSnapshot.objects.latest_before_or_earliest(user.id, target_date)

        # THEN
        assert result == {"total": Decimal("1500"), "operation_date": before_target}

    def test__latest_before_or_earliest__falls_back_to_earliest_when_no_snapshot_before_target(
        self, user
    ):
        # GIVEN
        today = timezone.localdate()
        target_date = today - relativedelta(years=3)  # Very far in the past

        # Only snapshots after target date
        earliest_date = today - relativedelta(years=2)
        AssetsTotalInvestedSnapshot.objects.create(
            user=user, operation_date=earliest_date, total=Decimal("1000")
        )
        AssetsTotalInvestedSnapshot.objects.create(
            user=user,
            operation_date=today - relativedelta(months=6),
            total=Decimal("2000"),
        )

        # WHEN
        result = AssetsTotalInvestedSnapshot.objects.latest_before_or_earliest(user.id, target_date)

        # THEN - should fall back to the earliest available snapshot
        assert result == {"total": Decimal("1000"), "operation_date": earliest_date}

    def test__latest_before_or_earliest__returns_none_when_no_snapshots(self, user):
        # GIVEN
        today = timezone.localdate()
        target_date = today - relativedelta(months=6)
        # No snapshots created

        # WHEN
        result = AssetsTotalInvestedSnapshot.objects.latest_before_or_earliest(user.id, target_date)

        # THEN
        assert result is None
