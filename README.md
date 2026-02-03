# MediaVault - Internal Media Management Platform

An internal employee tool for managing media assets across multiple cloud storage providers.

## 🏗️ Architecture

```
media-vault/
├── backend/           # Go + Gin API Server
│   ├── cmd/           # Application entrypoints
│   ├── internal/      # Private application code
│   │   ├── config/    # Configuration management
│   │   ├── handlers/  # HTTP handlers
│   │   ├── services/  # Business logic
│   │   ├── storage/   # Storage adapters (Cloudinary, R2, S3, B2)
│   │   ├── repository/# Database access layer
│   │   ├── models/    # Domain models
│   │   ├── middleware/# Auth, logging, etc.
│   │   └── crypto/    # Encryption utilities
│   ├── migrations/    # SQL migrations
│   └── pkg/           # Shared utilities
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── hooks/
│   │   └── store/
│   └── public/
└── docker-compose.yml # Local development setup
```

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- PostgreSQL 15+
- Docker (optional)

### Backend Setup
```bash
cd backend
cp .env.example .env
go mod download
go run cmd/server/main.go
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Database
```bash
# Using Docker
docker-compose up -d postgres

# Run migrations
cd backend
go run cmd/migrate/main.go
```

## 📦 Supported Storage Providers

| Provider | Features | Best For |
|----------|----------|----------|
| Cloudinary | Transformations, CDN | Images, previews |
| Cloudflare R2 | S3-compatible, free egress | Primary storage |
| AWS S3 | Industry standard | Enterprise backups |
| Backblaze B2 | Cost-effective | Archive storage |

## 👥 Roles

- **Admin**: Full access, manage accounts & employees
- **Developer**: Upload, organize, delete own media
- **Marketing**: Upload, organize media
- **Viewer**: Read-only access

## 🔐 Security

- JWT-based internal authentication
- Encrypted credentials at rest (AES-256-GCM)
- Signed URLs for uploads
- Audit logging for all operations
- Soft delete with 30-day retention

---

**This is an INTERNAL tool. Not for public deployment.**
# mediaVault
