#!/bin/sh
# python manage.py migrate --noinput

cat <<EOF | python manage.py shell
import os
if bool(os.getenv("PERFORM_METADATA_UPDATES")):
    from variable_income_assets.integrations.handlers import update_dollar_conversion_rate
    update_dollar_conversion_rate()
    print("USD-BRL convertion rate updated!")
    from variable_income_assets.scripts import update_assets_metadata_current_price
    update_assets_metadata_current_price()
    print("Assets price updated!")
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$ADMIN_USERNAME').exists():
    User.objects.create_superuser(username='$ADMIN_USERNAME', password='$ADMIN_PASSWORD')
    print("Superuser created!")
EOF

exec "$@"