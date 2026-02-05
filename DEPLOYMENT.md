# Media Vault Deployment Guide

## 1. Prerequisites (IMPORTANT)
Before doing anything on the VPS, you MUST push your latest code changes to GitHub. I have made changes to the code (fixing API URLs, adding .gitignore) that are currently only on your local machine.

Run these commands in your local project folder:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```
*(If you are on a different branch, push that branch and update the script to checkout that branch, or merge to main).*

---

## 2. DNS Configuration
Set these A Records on your domain registrar:
*   **media.appnity.cloud** -> `46.28.44.37`
*   **api.launchit.co.in** -> `46.28.44.37`

---

## 3. Deploy on VPS

1.  **SSH into your VPS**:
    ```bash
    ssh root@46.28.44.37
    ```

2.  **Create the Setup Script**:
    ```bash
    nano deploy.sh
    ```

3.  **Paste the Script Content**:
    Copy the entire code block below and paste it into `nano`.

    *(See `vps_setup.sh` file content)*

    Save and exit: `Ctrl+O`, `Enter`, `Ctrl+X`.

4.  **Run the Script**:
    ```bash
    chmod +x deploy.sh
    ./deploy.sh
    ```

The script will automatically:
*   Install all necessary software (Node, Go, Nginx, Postgres).
*   Clone your GitHub repo to `/var/www/media-vault`.
*   Build the frontend and backend.
*   Setup the database.
*   Configure Nginx and SSL.
*   **It runs on port 8082** to avoid conflicting with your existing services.

---

## 4. Feature Flags
I have implemented a **Feature Flag** system to protect the production environment. 
- You can enable/disable features (like `enable_audit_logs`) via the `feature_flags` table in PostgreSQL.
- By default, all new features are enabled. If something crashes, set `is_enabled = false` for the relevant key.

## 5. Updates & Migrations
To update the site in the future, just run:
```bash
./redeploy.sh
```
This script automatically pulls code, applies new SQL migrations from `backend/migrations/`, rebuilds, and restarts services.
