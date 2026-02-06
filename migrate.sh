#!/bin/bash
# Apply all SQL migrations to the database

DB_URL=$1
if [ -z "$DB_URL" ]; then
    echo "Usage: ./migrate.sh <database_url>"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/backend/migrations"

echo ">>> Applying database migrations from $MIGRATIONS_DIR..."

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found at $MIGRATIONS_DIR"
    exit 1
fi

for file in "$MIGRATIONS_DIR"/*.sql; do
    echo ">>> Applying $(basename "$file")..."
    psql "$DB_URL" -f "$file"
done

echo ">>> Migrations complete."
