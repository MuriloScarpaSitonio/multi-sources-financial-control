#!/bin/sh
# python manage.py migrate --noinput

cat <<EOF | python manage.py shell
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$ADMIN_USERNAME').exists():
    User.objects.create_superuser(username='$ADMIN_USERNAME', password='$ADMIN_PASSWORD')
    print("Superuser created!")
EOF

exec "$@"