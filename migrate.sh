#!/bin/bash
# Apply all SQL migrations to the database

DB_URL=$1
if [ -z "$DB_URL" ]; then
    echo "Usage: ./migrate.sh <database_url>"
    exit 1
fi

echo ">>> Applying database migrations..."

for file in backend/migrations/*.sql; do
    echo ">>> Applying $file..."
    psql "$DB_URL" -f "$file"
done

echo ">>> Migrations complete."
