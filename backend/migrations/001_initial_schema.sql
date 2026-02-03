-- MediaVault Database Schema
-- Internal Media Management Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE role_type AS ENUM ('admin', 'developer', 'marketing', 'viewer');
CREATE TYPE provider_type AS ENUM ('cloudinary', 'r2', 's3', 'b2');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document', 'other');
CREATE TYPE audit_action AS ENUM ('upload', 'delete', 'move', 'update', 'view', 'download');

-- =====================================================
-- EMPLOYEES TABLE
-- =====================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role role_type NOT NULL DEFAULT 'viewer',
    avatar_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_employees_email ON employees(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_role ON employees(role) WHERE deleted_at IS NULL;

-- =====================================================
-- STORAGE ACCOUNTS TABLE
-- Stores encrypted credentials for each cloud provider
-- =====================================================

CREATE TABLE storage_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider provider_type NOT NULL,
    
    -- Encrypted credentials (JSON encrypted with AES-256-GCM)
    encrypted_credentials BYTEA NOT NULL,
    credentials_nonce BYTEA NOT NULL,
    
    -- Provider-specific config (non-sensitive)
    bucket_name VARCHAR(255),
    region VARCHAR(100),
    endpoint_url VARCHAR(500),
    public_url_base VARCHAR(500),
    
    -- Settings
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_file_size_mb INTEGER DEFAULT 100,
    allowed_types media_type[] DEFAULT ARRAY['image', 'video', 'audio', 'document', 'other']::media_type[],
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_storage_accounts_name_unique ON storage_accounts(name) WHERE deleted_at IS NULL;

CREATE INDEX idx_storage_accounts_provider ON storage_accounts(provider) WHERE deleted_at IS NULL;
CREATE INDEX idx_storage_accounts_default ON storage_accounts(is_default) WHERE deleted_at IS NULL AND is_active = true;

-- =====================================================
-- MEDIA GROUPS TABLE
-- Logical groupings for media (e.g., Website Assets, Marketing)
-- =====================================================

CREATE TABLE media_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
    icon VARCHAR(50) DEFAULT 'folder', -- Icon name for UI
    
    -- Default storage routing
    default_storage_account_id UUID REFERENCES storage_accounts(id),
    
    -- Access control
    allowed_roles role_type[] DEFAULT ARRAY['admin', 'developer', 'marketing']::role_type[],
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_media_groups_name_unique ON media_groups(name) WHERE deleted_at IS NULL;

CREATE INDEX idx_media_groups_name ON media_groups(name) WHERE deleted_at IS NULL;

-- =====================================================
-- FOLDERS TABLE
-- Physical folder structure within storage
-- =====================================================

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_account_id UUID NOT NULL REFERENCES storage_accounts(id),
    media_group_id UUID REFERENCES media_groups(id),
    
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1000) NOT NULL, -- Full path like /marketing/campaigns/2024
    parent_id UUID REFERENCES folders(id),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_folders_path_unique ON folders(storage_account_id, path) WHERE deleted_at IS NULL;

CREATE INDEX idx_folders_path ON folders(path) WHERE deleted_at IS NULL;
CREATE INDEX idx_folders_parent ON folders(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_folders_group ON folders(media_group_id) WHERE deleted_at IS NULL;

-- =====================================================
-- MEDIA TABLE
-- Actual uploaded files
-- =====================================================

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Storage location
    storage_account_id UUID NOT NULL REFERENCES storage_accounts(id),
    folder_id UUID REFERENCES folders(id),
    media_group_id UUID REFERENCES media_groups(id),
    
    -- File info
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(1000) NOT NULL, -- Full path/key in storage
    
    -- File metadata
    media_type media_type NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    -- Image/Video dimensions (if applicable)
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER, -- For videos
    
    -- URLs (cached for performance)
    public_url VARCHAR(1000),
    thumbnail_url VARCHAR(1000),
    
    -- Provider-specific data
    provider_id VARCHAR(500), -- e.g., Cloudinary public_id
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Tags for search
    tags VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    
    -- Access & ownership
    uploaded_by UUID NOT NULL REFERENCES employees(id),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

CREATE UNIQUE INDEX idx_media_key_unique ON media(storage_account_id, storage_key) WHERE deleted_at IS NULL;

-- Indexes for common queries
CREATE INDEX idx_media_storage_account ON media(storage_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_group ON media(media_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_folder ON media(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_type ON media(media_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_created_at ON media(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_tags ON media USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_filename ON media(filename) WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX idx_media_search ON media USING GIN(
    to_tsvector('english', COALESCE(filename, '') || ' ' || COALESCE(original_filename, ''))
) WHERE deleted_at IS NULL;

-- =====================================================
-- AUDIT LOGS TABLE
-- Track all operations for compliance and debugging
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Who
    employee_id UUID NOT NULL REFERENCES employees(id),
    employee_email VARCHAR(255) NOT NULL, -- Denormalized for historical records
    
    -- What
    action audit_action NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'media', 'storage_account', 'media_group', etc.
    resource_id UUID,
    
    -- Details
    details JSONB DEFAULT '{}'::jsonb, -- Action-specific data
    
    -- Request context
    ip_address INET,
    user_agent VARCHAR(500),
    
    -- When
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Partitioning-friendly indexes
CREATE INDEX idx_audit_logs_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- STORAGE ROUTING RULES TABLE
-- Smart routing based on file type, size, group
-- =====================================================

CREATE TABLE storage_routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = checked first
    
    -- Conditions (all must match if set)
    media_group_id UUID REFERENCES media_groups(id),
    media_type media_type,
    min_file_size_bytes BIGINT,
    max_file_size_bytes BIGINT,
    mime_type_pattern VARCHAR(100), -- e.g., 'image/*' or 'video/mp4'
    
    -- Target
    storage_account_id UUID NOT NULL REFERENCES storage_accounts(id),
    target_folder_prefix VARCHAR(500), -- e.g., '/archive/' or '/images/'
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(name)
);

CREATE INDEX idx_routing_rules_priority ON storage_routing_rules(priority DESC) WHERE is_active = true;

-- =====================================================
-- REFRESH TOKENS TABLE
-- For JWT refresh token rotation
-- =====================================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_refresh_tokens_employee ON refresh_tokens(employee_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_storage_accounts_updated_at BEFORE UPDATE ON storage_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_media_groups_updated_at BEFORE UPDATE ON media_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- VIEWS
-- =====================================================

-- Media with storage info
CREATE VIEW media_with_storage AS
SELECT 
    m.*,
    sa.name as storage_account_name,
    sa.provider as storage_provider,
    mg.name as group_name,
    mg.color as group_color,
    e.full_name as uploaded_by_name,
    e.email as uploaded_by_email,
    f.path as folder_path
FROM media m
LEFT JOIN storage_accounts sa ON m.storage_account_id = sa.id
LEFT JOIN media_groups mg ON m.media_group_id = mg.id
LEFT JOIN employees e ON m.uploaded_by = e.id
LEFT JOIN folders f ON m.folder_id = f.id
WHERE m.deleted_at IS NULL;

-- Storage account usage stats
CREATE VIEW storage_account_stats AS
SELECT 
    sa.id,
    sa.name,
    sa.provider,
    COUNT(m.id) as media_count,
    COALESCE(SUM(m.file_size_bytes), 0) as total_size_bytes,
    MAX(m.created_at) as last_upload_at
FROM storage_accounts sa
LEFT JOIN media m ON sa.id = m.storage_account_id AND m.deleted_at IS NULL
WHERE sa.deleted_at IS NULL
GROUP BY sa.id, sa.name, sa.provider;

-- =====================================================
-- SEED DATA
-- =====================================================

-- This will be done by the application on first run
-- See cmd/migrate/main.go for seeding logic
