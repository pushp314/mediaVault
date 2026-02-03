#!/bin/bash

# Exit on error
set -e

# Configuration
FRONTEND_DOMAIN="media.appnity.cloud"
BACKEND_DOMAIN="api.launchit.co.in"
DB_NAME="mediavault"
DB_USER="mediavault"
DB_PASSWORD="MediaVault@25"
EMAIL="admin@appnity.cloud" # Used for Let's Encrypt
APP_DIR="/var/www/media-vault"
BACKEND_PORT=8080

echo "Starting VPS Setup for Media Vault..."

# 1. Update System
echo "Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git make wget unzip nginx postgresql postgresql-contrib

# 2. Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install Go 1.22
echo "Installing Go 1.22..."
if ! command -v go &> /dev/null; then
    wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    rm go1.22.0.linux-amd64.tar.gz
fi

# 4. Install Certbot
echo "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# 5. Configure PostgreSQL
echo "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;" # Grant permissions for migrations

# 6. Deploy Backend
echo "Deploying Backend..."
# Assume script is run from inside the project directory, copy to APP_DIR
mkdir -p $APP_DIR
cp -r backend $APP_DIR/
cp -r frontend $APP_DIR/

cd $APP_DIR/backend

# Create .env
cat > .env <<EOF
PORT=$BACKEND_PORT
GIN_MODE=release
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32) # Must be 32 bytes
DEFAULT_ADMIN_EMAIL=admin@appnity.cloud
DEFAULT_ADMIN_PASSWORD=MediaVaultAdmin123!
EOF

# Build Backend
/usr/local/go/bin/go build -o server cmd/server/main.go
# Run Migrations
# Assuming migration binary or sql runs via code on start, or use make migrate
# For this setup, we'll let the app handle it or run manually.
# But wait, Makefile says: psql $${DATABASE_URL} -f backend/migrations/001_initial_schema.sql
# We should run the SQL file.
export DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable"
sudo -u postgres psql $DB_NAME -f migrations/001_initial_schema.sql || echo "Migration might have failed or already exists"

# Setup Systemd
cat > /etc/systemd/system/mediavault-backend.service <<EOF
[Unit]
Description=Media Vault Backend
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/server
Restart=always
EnvironmentFile=$APP_DIR/backend/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mediavault-backend
systemctl restart mediavault-backend

# 7. Deploy Frontend
echo "Deploying Frontend..."
cd $APP_DIR/frontend

# Create .env for build
echo "VITE_API_BASE_URL=https://$BACKEND_DOMAIN" > .env

# Install and Build
npm install
npm run build

# Move build to web root config
# We keep it in $APP_DIR/frontend/dist but make sure nginx can read it

# 8. Configure Nginx
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/mediavault <<EOF
server {
    server_name $FRONTEND_DOMAIN;

    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}

server {
    server_name $BACKEND_DOMAIN;

    location / {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/mediavault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

# 9. SSL Setup
echo "Setting up SSL with Let's Encrypt..."
certbot --nginx -d $FRONTEND_DOMAIN -d $BACKEND_DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "Deployment Complete!"
echo "Frontend: https://$FRONTEND_DOMAIN"
echo "Backend: https://$BACKEND_DOMAIN"
