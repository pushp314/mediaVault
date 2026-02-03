#!/bin/bash

# ==========================================
# Media Vault - VPS Deployment Script
# ==========================================

# Exit on any error
set -e

# --- Configuration ---
REPO_URL="https://github.com/pushp314/mediaVault.git"
APP_DIR="/var/www/media-vault"
FRONTEND_DOMAIN="media.appnity.cloud"
BACKEND_DOMAIN="api.launchit.co.in"
BACKEND_PORT=8082
DB_NAME="mediavault"
DB_USER="mediavault"
DB_PASSWORD="MediaVault@25"
EMAIL="admin@appnity.cloud"

# Ensure we are running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit 1
fi

echo "==========================================="
echo "Starting Deployment for Media Vault..."
echo "Target Directory: $APP_DIR"
echo "Frontend Domain:  $FRONTEND_DOMAIN"
echo "Backend Domain:   $BACKEND_DOMAIN"
echo "Backend Port:     $BACKEND_PORT"
echo "==========================================="

# 1. Update System & Install Dependencies
echo ">>> Updating system and installing dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt upgrade -y
apt install -y curl git make wget unzip nginx postgresql postgresql-contrib

# 2. Install Node.js 20 (LTS)
echo ">>> Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo "Node.js is already installed: $(node -v)"
fi

# 3. Install Go 1.22
echo ">>> Checking Go..."
if ! command -v go &> /dev/null; then
    echo "Installing Go 1.22..."
    wget -q https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
    rm go1.22.0.linux-amd64.tar.gz
    
    # Add to path for this session
    export PATH=$PATH:/usr/local/go/bin
    
    # Add to bashrc if not present
    if ! grep -q "/usr/local/go/bin" ~/.bashrc; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    fi
else
    echo "Go is already installed: $(go version)"
    export PATH=$PATH:/usr/local/go/bin
fi

# 4. Install Certbot
echo ">>> Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# 5. Configure PostgreSQL
echo ">>> Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create User if not exists
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    echo "Creating database user '$DB_USER'..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;"
else
    echo "Database user '$DB_USER' already exists. Updating password..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
fi

# Create Database if not exists
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    echo "Creating database '$DB_NAME'..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
else
    echo "Database '$DB_NAME' already exists."
fi

# 6. Fetch Code (Clone or Pull)
echo ">>> Fetching Code..."
mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
    echo "Directory exists at $APP_DIR. Pulling latest changes..."
    cd $APP_DIR
    # Reset any local changes to ensure clean pull
    git reset --hard
    git pull
else
    echo "Cloning repository to $APP_DIR..."
    cd /var/www
    git clone $REPO_URL media-vault
    cd $APP_DIR
fi

# 7. Setup Backend (Go)
echo ">>> Setting up Backend..."
cd $APP_DIR/backend

# Write .env file
echo "Writing backend .env file..."
cat > .env <<EOF
PORT=$BACKEND_PORT
GIN_MODE=release
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DEFAULT_ADMIN_EMAIL=admin@appnity.cloud
DEFAULT_ADMIN_PASSWORD=MediaVaultAdmin123!
EOF

# Install Go deps and Build
echo "Building Go backend..."
/usr/local/go/bin/go mod download
/usr/local/go/bin/go build -o server cmd/server/main.go

# Run Migrations
if [ -f "migrations/001_initial_schema.sql" ]; then
    echo "Running DB Migrations..."
    export DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable"
    # Execute SQL using psql as postgres user but connecting to local db with password requires setup
    # Easier way for script: run as postgres user directly on the system socket
    sudo -u postgres psql -d $DB_NAME -f migrations/001_initial_schema.sql || echo "Note: Migration might have specific errors if objects exist, ignoring."
fi

# Setup Systemd Service
echo "Configuring Systemd for Backend..."
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
echo "Restarting Backend Service..."
systemctl restart mediavault-backend

# 8. Setup Frontend (React/Vite)
echo ">>> Setting up Frontend..."
cd $APP_DIR/frontend

# Write .env for build
echo "Writing frontend .env file..."
echo "VITE_API_BASE_URL=https://$BACKEND_DOMAIN" > .env

# Install deps and Build
echo "Installing NPM dependencies..."
npm install
echo "Building Frontend..."
npm run build

# 9. Configure Nginx
echo ">>> Configuring Nginx..."
cat > /etc/nginx/sites-available/mediavault <<EOF
server {
    server_name $FRONTEND_DOMAIN;

    root $APP_DIR/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

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

# Enable Site
ln -sf /etc/nginx/sites-available/mediavault /etc/nginx/sites-enabled/

# Test Config
nginx -t

echo "Reloading Nginx..."
systemctl reload nginx

# 10. SSL Setup (LetsEncrypt)
echo ">>> Setting up SSL..."
if [ -d "/etc/letsencrypt/live/$FRONTEND_DOMAIN" ]; then
    echo "SSL Certificate likely exists for $FRONTEND_DOMAIN. Skipping to avoid rate limits."
else
    certbot --nginx -d $FRONTEND_DOMAIN -d $BACKEND_DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect || echo "WARNING: SSL Setup failed. Check DNS entries."
fi

echo "=================================================="
echo "   DEPLOYMENT SUCCESSFUL!"
echo "=================================================="
echo "Frontend: https://$FRONTEND_DOMAIN"
echo "Backend:  https://$BACKEND_DOMAIN"
echo "App Dir:  $APP_DIR"
echo "Port:     $BACKEND_PORT"
echo "=================================================="
