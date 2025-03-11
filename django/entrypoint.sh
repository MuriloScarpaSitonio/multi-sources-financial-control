#!/bin/sh
# python manage.py migrate --noinput

cat <<EOF | python manage.py shell
import os
from datetime import date

from expenses.tasks import create_bank_account_snapshot_for_all_users, create_fixed_expenses_from_last_month_to_all_users, create_fixed_revenues_from_last_month_to_all_users, decrement_credit_card_bill_today
from shared.exceptions import NotFirstDayOfMonthException
from variable_income_assets.adapters.key_value_store import update_dollar_conversion_rate
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

if '$PERFORM_METADATA_UPDATES'.lower() in ("true", "1"):
    value = update_dollar_conversion_rate()
    print(f"USD-BRL convertion rate updated to {float(value)}")
    exc = update_assets_metadata_current_price()
    if exc is None:
        print("Assets prices updated!")

        try:
            create_total_invested_snapshot_for_all_users()
            print("Assets total invested snapshots created!")
        except NotFirstDayOfMonthException:
            pass
    else:
        print(f"Error when trying to update assets prices: {exc}")

EOF

exec "$@"