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

echo "Step 2: Truncating tables with migration data..."
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-test_db}" \
    -c "TRUNCATE variable_income_assets_conversionrate CASCADE;" 2>/dev/null || true

echo "Step 3: Loading data..."
# Remove Supabase-specific \restrict and \unrestrict commands, then load
grep -v '\\restrict\|\\unrestrict' "$DUMP_FILE" | \
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-test_db}"

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
