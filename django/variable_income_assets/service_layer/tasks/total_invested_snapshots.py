from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.utils import timezone

from dateutil import relativedelta

from shared.exceptions import NotFirstDayOfMonthException

from ...adapters import DjangoSQLAssetTotalInvestedSnapshotRepository
from ...models import Asset, AssetReadModel, AssetsTotalInvestedSnapshot

if TYPE_CHECKING:
    from datetime import date
    from decimal import Decimal

UserModel = get_user_model()


def create_total_invested_snapshot_for_all_users():
    operation_date = timezone.localdate()
    if operation_date.day != 1:
        raise NotFirstDayOfMonthException

    for user_id in UserModel.objects.filter_investments_module_active().values_list(
        "pk", flat=True
    ):
        _create_assets_total_invested_snapshot(user_id=user_id, operation_date=operation_date)


def _create_assets_total_invested_snapshot(user_id: int, operation_date: date):
    result = (
        AssetReadModel.objects.select_related("metadata")
        .filter(user_id=user_id)
        .aggregate_normalized_current_total()
    )
    AssetsTotalInvestedSnapshot.objects.create(
        user_id=user_id, operation_date=operation_date, total=result["total"]
    )


# TODO: UoW?!
def update_snapshot_from_diff(asset_pk: int, snapshot_operation_date: date, quantity_diff: Decimal):
    from ...integrations.helpers import fetch_asset_close_price

    first_day_of_month = timezone.localdate() - relativedelta(day=1)
    for diff in range(1, relativedelta(first_day_of_month, snapshot_operation_date) + 1):
        op_date = first_day_of_month - relativedelta(months=diff)
        try:
            asset: Asset = (
                Asset.objects.filter_opened_after(operation_date=op_date)
                .only("code", "type", "currency")
                .get(id=asset_pk)
            )
        except Asset.DoesNotExist:
            # TODO: log error
            return

        price = fetch_asset_close_price(
            code=asset.code,
            asset_type=asset.type,
            currency=asset.currency,
            operation_date=op_date,
        )

    DjangoSQLAssetTotalInvestedSnapshotRepository.update_total_from_diff(
        user_id=asset.user_id,
        operation_date=op_date,
        total_change=price * quantity_diff,
    )
