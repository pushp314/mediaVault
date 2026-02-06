#!/bin/bash

# ==========================================
# Media Vault - Quick Redeploy Script
# ==========================================
# This script pulls the latest code from Git, 
# rebuilds both backend and frontend, and restarts services.

# Exit on any error
set -e

APP_DIR="/var/www/media-vault"

echo ">>> Starting Redeployment..."

cd $APP_DIR

# 1. Pull latest code
echo ">>> Pulling latest changes from GitHub..."
git fetch origin main
git reset --hard origin/main
chmod +x $APP_DIR/redeploy.sh
chmod +x $APP_DIR/migrate.sh

# 1.2 Fix old password issue in .env if it exists (fixes the @ ambiguity for psql)
if grep -q "MediaVault@25" $APP_DIR/backend/.env; then
    echo ">>> Updating database password format to fix URI parsing..."
    sed -i 's/MediaVault@25/MediaVault_25/g' $APP_DIR/backend/.env
    # Also update the postgres user password to match
    sudo -u postgres psql -c "ALTER USER mediavault WITH PASSWORD 'MediaVault_25';" || true
fi

# 1.5 Apply Migrations
echo ">>> Applying Database Migrations..."
# In production, DB_URL should be in env or config
DB_URL=$(grep DATABASE_URL $APP_DIR/backend/.env | cut -d '=' -f2-)
chmod +x $APP_DIR/migrate.sh
$APP_DIR/migrate.sh "$DB_URL"

# 2. Rebuild Backend
echo ">>> Rebuilding Backend..."
cd $APP_DIR/backend
/usr/local/go/bin/go build -o server cmd/server/main.go

# 3. Restart Backend Service
echo ">>> Restarting Backend Service..."
sudo systemctl restart mediavault-backend

# 4. Rebuild Frontend
echo ">>> Rebuilding Frontend..."
cd $APP_DIR/frontend
npm install
npm run build

# 5. Reload Nginx
echo ">>> Reloading Nginx..."
sudo systemctl reload nginx

echo "==========================================="
echo "   REDEPLOYMENT COMPLETE!"
echo "==========================================="
