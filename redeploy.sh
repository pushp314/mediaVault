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
