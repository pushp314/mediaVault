.PHONY: dev dev-backend dev-frontend build clean docker-up docker-down migrate

# Development
dev: 
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	@cd backend && go run cmd/server/main.go

dev-frontend:
	@cd frontend && npm run dev

# Install dependencies
install:
	@cd backend && go mod download
	@cd frontend && npm install

# Build
build: build-backend build-frontend

build-backend:
	@cd backend && go build -o bin/server cmd/server/main.go

build-frontend:
	@cd frontend && npm run build

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
migrate:
	@echo "Running migrations..."
	@psql $${DATABASE_URL} -f backend/migrations/001_initial_schema.sql

migrate-reset:
	@echo "Resetting database..."
	@psql $${DATABASE_URL} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	@make migrate

# Lint
lint:
	@cd backend && go vet ./...
	@cd frontend && npm run lint

# Clean
clean:
	@rm -rf backend/bin
	@rm -rf frontend/dist
	@rm -rf frontend/node_modules/.vite

# Help
help:
	@echo "MediaVault Development Commands:"
	@echo ""
	@echo "  make dev           - Start both backend and frontend"
	@echo "  make dev-backend   - Start Go backend only"
	@echo "  make dev-frontend  - Start React frontend only"
	@echo "  make install       - Install all dependencies"
	@echo "  make build         - Build for production"
	@echo "  make docker-up     - Start Docker services"
	@echo "  make docker-down   - Stop Docker services"
	@echo "  make migrate       - Run database migrations"
	@echo "  make lint          - Run linters"
	@echo "  make clean         - Clean build artifacts"
