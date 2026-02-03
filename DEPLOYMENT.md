# Media Vault Deployment Guide

## 1. DNS Configuration (GoDaddy / Domain Registrar)

You are using two different domains. You need to configure DNS records for **both** domains to point to your VPS IP: **46.28.44.37**.

### For `appnity.cloud` (Frontend)
1.  Log in to your domain registrar (e.g., GoDaddy).
2.  Go to DNS Management for **appnity.cloud**.
3.  Add an **A Record**:
    *   **Type**: A
    *   **Name**: media
    *   **Value**: 46.28.44.37
    *   **TTL**: Default (e.g., 3600 or 1 Hour)

### For `launchit.co.in` (Backend)
1.  Go to DNS Management for **launchit.co.in**.
2.  Add an **A Record**:
    *   **Type**: A
    *   **Name**: api
    *   **Value**: 46.28.44.37
    *   **TTL**: Default

*Note: DNS propagation can take 1-48 hours, but usually happens within minutes.*

---

## 2. Deploy Code to VPS

You need to copy your project files to the VPS and run the setup script.

### Step 1: Prepare Local Files
Ensure you are in the project root directory (where this file is located).
Make sure `vps_setup.sh` is executable:
```bash
chmod +x vps_setup.sh
```

### Step 2: Copy Files to VPS
Run the following command from your local terminal to upload the code to the VPS (replace `46.28.44.37` if changed):

```bash
scp -r . root@46.28.44.37:~/media-vault-setup
```
*Enter your VPS root password when prompted.*

### Step 3: Run Setup Script on VPS
SSH into your server:
```bash
ssh root@46.28.44.37
```

Navigate to the uploaded folder and run the script:
```bash
cd ~/media-vault-setup
chmod +x vps_setup.sh
./vps_setup.sh
```

The script will:
1.  Update the system and install dependencies (Node, Go, Nginx, Postgres, Certbot).
2.  Configure PostgreSQL with the password `MediaVault@25`.
3.  Build and start the Backend API at `api.launchit.co.in`.
4.  Build and serve the Frontend at `media.appnity.cloud`.
5.  Set up SSL (HTTPS) automatically.

### Verifying Deployment
*   **Frontend**: Visit [https://media.appnity.cloud](https://media.appnity.cloud)
*   **Backend**: Visit [https://api.launchit.co.in/health](https://api.launchit.co.in/health) (Assuming /health endpoint exists, otherwise /api/health)

## Troubleshooting
*   **Logs**:
    *   Backend: `journalctl -u mediavault-backend -f`
    *   Nginx: `tail -f /var/log/nginx/error.log`
*   **Database**:
    *   Connect: `sudo -u postgres psql mediavault`
