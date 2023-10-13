#!/bin/sh
# python manage.py migrate --noinput

cat <<EOF | python manage.py shell
import os
if '$PERFORM_METADATA_UPDATES'.lower() in ("true", "1"):
    from variable_income_assets.adapters.key_value_store import update_dollar_conversion_rate
    update_dollar_conversion_rate()
    print("USD-BRL convertion rate updated!")
    from variable_income_assets.scripts import update_assets_metadata_current_price
    update_assets_metadata_current_price()
    print("Assets price updated!")
EOF

exec "$@"