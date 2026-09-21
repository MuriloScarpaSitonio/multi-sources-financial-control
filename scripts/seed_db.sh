#!/bin/bash
set -e

DUMP_FILE="${1:-/app/db_dump.sql}"

echo "=== Database Seeding Script ==="

if [ ! -f "$DUMP_FILE" ]; then
    echo "Error: Dump file not found at $DUMP_FILE"
    exit 1
fi

echo "Step 1: Running migrations..."
uv run python manage.py migrate --skip-checks --noinput

echo "Step 2: Truncating tables that the dump repopulates..."
# Only truncate tables the dump actually loads into, so framework tables that
# migrations populate (django_content_type, auth_permission, django_migrations)
# stay intact and FKs like django_admin_log.content_type_id keep their targets.
DUMP_TABLES=$(awk '$1 == "COPY" { sub(/^public\./, "", $2); printf "%s%s", sep, $2; sep="," }' "$DUMP_FILE")

if [ -z "$DUMP_TABLES" ]; then
    echo "Error: no COPY tables found in $DUMP_FILE"
    exit 1
fi

PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-test_db}" \
    -v ON_ERROR_STOP=1 \
    -c "truncate table ${DUMP_TABLES} restart identity cascade;"

echo "Step 3: Loading data..."
# Remove Supabase-specific \restrict and \unrestrict commands, then load
grep -v '\\restrict\|\\unrestrict' "$DUMP_FILE" | \
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-test_db}" \
    -v ON_ERROR_STOP=1

echo ""
echo "Step 4: Verifying..."
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-test_db}" \
    -c "SELECT 
        (SELECT COUNT(*) FROM authentication_customuser) as users,
        (SELECT COUNT(*) FROM expenses_expense) as expenses,
        (SELECT COUNT(*) FROM variable_income_assets_asset) as assets;"

echo "=== Done ==="
