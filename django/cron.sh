#!/bin/sh

# Cron script for Render - uses the pre-built venv instead of uv
cd /opt/render/project/src/django

python manage.py shell <<EOF
import os
from django.utils import timezone

from expenses.tasks import create_bank_account_snapshot_for_all_users, create_fixed_expenses_from_last_month_to_all_users, create_fixed_revenues_from_last_month_to_all_users, decrement_credit_card_bill_today
from shared.exceptions import NotFirstDayOfMonthException
from variable_income_assets.adapters import DjangoSQLAssetMetaDataRepository
from variable_income_assets.adapters.key_value_store import update_dollar_conversion_rate
from variable_income_assets.choices import AssetTypes
from variable_income_assets.scripts import update_assets_metadata_current_price
from variable_income_assets.service_layer.tasks.total_invested_snapshots import create_total_invested_snapshot_for_all_users


decrement_credit_card_bill_today()
print("Bank accounts (maybe) decremented!")

try:
    create_bank_account_snapshot_for_all_users()
    print("Bank account snapshots created!")
except NotFirstDayOfMonthException:
    pass

try:
    create_fixed_expenses_from_last_month_to_all_users()
    print("Fixed expenses created!")
except NotFirstDayOfMonthException:
    pass

try:
    create_fixed_revenues_from_last_month_to_all_users()
    print("Fixed revenues created!")
except NotFirstDayOfMonthException:
    pass

if os.environ.get('PERFORM_METADATA_UPDATES', '').lower() in ("true", "1"):
    value = update_dollar_conversion_rate()
    print(f"USD-BRL convertion rate updated to {float(value)}")
    quoted_assets = DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update().exclude(type=AssetTypes.fixed_br)
    expected_ids = list(quoted_assets.values_list("pk", flat=True))
    started_at = timezone.now()
    exc = update_assets_metadata_current_price()
    if exc is not None:
        raise exc
    stale_codes = list(
        quoted_assets.filter(pk__in=expected_ids)
        .exclude(current_price_updated_at__gte=started_at)
        .values_list("code", flat=True)
        .order_by("code")
    )
    if stale_codes:
        raise RuntimeError(f"Prices not refreshed: {', '.join(stale_codes)}")
    print("Assets prices updated!")

    try:
        create_total_invested_snapshot_for_all_users()
        print("Assets total invested snapshots created!")
    except NotFirstDayOfMonthException:
        pass
EOF

