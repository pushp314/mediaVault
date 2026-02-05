package models

import (
	"time"

	"github.com/google/uuid"
)

// Role types for employees
type Role string

const (
	RoleAdmin     Role = "admin"
	RoleDeveloper Role = "developer"
	RoleMarketing Role = "marketing"
	RoleViewer    Role = "viewer"
)

// Provider types for storage
type ProviderType string

const (
	ProviderCloudinary ProviderType = "cloudinary"
	ProviderR2         ProviderType = "r2"
	ProviderS3         ProviderType = "s3"
	ProviderB2         ProviderType = "b2"
)

// MediaType for file classification
type MediaType string

const (
	MediaTypeImage    MediaType = "image"
	MediaTypeVideo    MediaType = "video"
	MediaTypeAudio    MediaType = "audio"
	MediaTypeDocument MediaType = "document"
	MediaTypeOther    MediaType = "other"
)

// AuditAction for logging
type AuditAction string

const (
	AuditActionUpload   AuditAction = "upload"
	AuditActionDelete   AuditAction = "delete"
	AuditActionMove     AuditAction = "move"
	AuditActionUpdate   AuditAction = "update"
	AuditActionView     AuditAction = "view"
	AuditActionDownload AuditAction = "download"
	AuditActionCreate   AuditAction = "create"
)

type AuditSeverity string

const (
	SeverityInfo     AuditSeverity = "info"
	SeverityWarning  AuditSeverity = "warning"
	SeverityCritical AuditSeverity = "critical"
)

// Employee represents an internal user
type Employee struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	FullName     string     `json:"full_name" db:"full_name"`
	Role         Role       `json:"role" db:"role"`
	AvatarURL    *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	IsActive     bool       `json:"is_active" db:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"-" db:"deleted_at"`
}

// StorageAccount represents a cloud storage configuration
type StorageAccount struct {
	ID                   uuid.UUID    `json:"id" db:"id"`
	Name                 string       `json:"name" db:"name"`
	Provider             ProviderType `json:"provider" db:"provider"`
	EncryptedCredentials []byte       `json:"-" db:"encrypted_credentials"`
	CredentialsNonce     []byte       `json:"-" db:"credentials_nonce"`
	BucketName           *string      `json:"bucket_name,omitempty" db:"bucket_name"`
	Region               *string      `json:"region,omitempty" db:"region"`
	EndpointURL          *string      `json:"endpoint_url,omitempty" db:"endpoint_url"`
	PublicURLBase        *string      `json:"public_url_base,omitempty" db:"public_url_base"`
	IsDefault            bool         `json:"is_default" db:"is_default"`
	IsActive             bool         `json:"is_active" db:"is_active"`
	IsPublic             bool         `json:"is_public" db:"is_public"`
	MaxFileSizeMB        int          `json:"max_file_size_mb" db:"max_file_size_mb"`
	AllowedTypes         []MediaType  `json:"allowed_types" db:"allowed_types"`
	CreatedBy            uuid.UUID    `json:"created_by" db:"created_by"`
	CreatedAt            time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time    `json:"updated_at" db:"updated_at"`
	DeletedAt            *time.Time   `json:"-" db:"deleted_at"`
}

// StorageAccountWithStats extends StorageAccount with usage stats
type StorageAccountWithStats struct {
	StorageAccount
	MediaCount     int64      `json:"media_count"`
	TotalSizeBytes int64      `json:"total_size_bytes"`
	LastUploadAt   *time.Time `json:"last_upload_at,omitempty"`
}

// MediaGroup represents a logical grouping of media
type MediaGroup struct {
	ID                      uuid.UUID  `json:"id" db:"id"`
	Name                    string     `json:"name" db:"name"`
	Description             *string    `json:"description,omitempty" db:"description"`
	Color                   string     `json:"color" db:"color"`
	Icon                    string     `json:"icon" db:"icon"`
	DefaultStorageAccountID *uuid.UUID `json:"default_storage_account_id,omitempty" db:"default_storage_account_id"`
	AllowedRoles            []Role     `json:"allowed_roles" db:"allowed_roles"`
	CreatedBy               uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt               time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt               *time.Time `json:"-" db:"deleted_at"`
}

// Folder represents a physical folder in storage
type Folder struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	StorageAccountID uuid.UUID  `json:"storage_account_id" db:"storage_account_id"`
	MediaGroupID     *uuid.UUID `json:"media_group_id,omitempty" db:"media_group_id"`
	Name             string     `json:"name" db:"name"`
	Path             string     `json:"path" db:"path"`
	ParentID         *uuid.UUID `json:"parent_id,omitempty" db:"parent_id"`
	CreatedBy        uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"-" db:"deleted_at"`
}

// Media represents an uploaded file
type Media struct {
	ID               uuid.UUID      `json:"id" db:"id"`
	StorageAccountID uuid.UUID      `json:"storage_account_id" db:"storage_account_id"`
	FolderID         *uuid.UUID     `json:"folder_id,omitempty" db:"folder_id"`
	MediaGroupID     *uuid.UUID     `json:"media_group_id,omitempty" db:"media_group_id"`
	Filename         string         `json:"filename" db:"filename"`
	OriginalFilename string         `json:"original_filename" db:"original_filename"`
	StorageKey       string         `json:"storage_key" db:"storage_key"`
	MediaType        MediaType      `json:"media_type" db:"media_type"`
	MimeType         string         `json:"mime_type" db:"mime_type"`
	FileSizeBytes    int64          `json:"file_size_bytes" db:"file_size_bytes"`
	Width            *int           `json:"width,omitempty" db:"width"`
	Height           *int           `json:"height,omitempty" db:"height"`
	DurationSeconds  *int           `json:"duration_seconds,omitempty" db:"duration_seconds"`
	PublicURL        *string        `json:"public_url,omitempty" db:"public_url"`
	ThumbnailURL     *string        `json:"thumbnail_url,omitempty" db:"thumbnail_url"`
	ProviderID       *string        `json:"provider_id,omitempty" db:"provider_id"`
	ProviderMetadata map[string]any `json:"provider_metadata,omitempty" db:"provider_metadata"`
	Tags             []string       `json:"tags" db:"tags"`
	UploadedBy       uuid.UUID      `json:"uploaded_by" db:"uploaded_by"`
	LastAccessedAt   *time.Time     `json:"last_accessed_at,omitempty" db:"last_accessed_at"`
	DownloadCount    int            `json:"download_count" db:"download_count"`
	CreatedAt        time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time     `json:"-" db:"deleted_at"`
}

// MediaWithDetails extends Media with joined data
type MediaWithDetails struct {
	Media
	StorageAccountName string  `json:"storage_account_name"`
	StorageProvider    string  `json:"storage_provider"`
	GroupName          *string `json:"group_name,omitempty"`
	GroupColor         *string `json:"group_color,omitempty"`
	UploadedByName     string  `json:"uploaded_by_name"`
	UploadedByEmail    string  `json:"uploaded_by_email"`
	FolderPath         *string `json:"folder_path,omitempty"`
}

// AuditLog for tracking operations
type AuditLog struct {
	ID            uuid.UUID      `json:"id" db:"id"`
	EmployeeID    uuid.UUID      `json:"employee_id" db:"employee_id"`
	EmployeeEmail string         `json:"employee_email" db:"employee_email"`
	Action        AuditAction    `json:"action" db:"action"`
	Severity      AuditSeverity  `json:"severity" db:"severity"`
	ResourceType  string         `json:"resource_type" db:"resource_type"`
	ResourceID    *uuid.UUID     `json:"resource_id,omitempty" db:"resource_id"`
	Details       map[string]any `json:"details" db:"details"`
	IPAddress     *string        `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent     *string        `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt     time.Time      `json:"created_at" db:"created_at"`
}

// StorageRoutingRule for smart storage routing
type StorageRoutingRule struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	Name             string     `json:"name" db:"name"`
	Priority         int        `json:"priority" db:"priority"`
	MediaGroupID     *uuid.UUID `json:"media_group_id,omitempty" db:"media_group_id"`
	MediaType        *MediaType `json:"media_type,omitempty" db:"media_type"`
	MinFileSizeBytes *int64     `json:"min_file_size_bytes,omitempty" db:"min_file_size_bytes"`
	MaxFileSizeBytes *int64     `json:"max_file_size_bytes,omitempty" db:"max_file_size_bytes"`
	MimeTypePattern  *string    `json:"mime_type_pattern,omitempty" db:"mime_type_pattern"`
	StorageAccountID uuid.UUID  `json:"storage_account_id" db:"storage_account_id"`
	TargetFolderPfx  *string    `json:"target_folder_prefix,omitempty" db:"target_folder_prefix"`
	IsActive         bool       `json:"is_active" db:"is_active"`
	CreatedBy        uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// RefreshToken for JWT auth
type RefreshToken struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	EmployeeID uuid.UUID  `json:"employee_id" db:"employee_id"`
	TokenHash  string     `json:"-" db:"token_hash"`
	ExpiresAt  time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	RevokedAt  *time.Time `json:"-" db:"revoked_at"`
}

// StorageAccountAccess represents a user's access to a storage account
type StorageAccountAccess struct {
	ID               uuid.UUID `json:"id" db:"id"`
	StorageAccountID uuid.UUID `json:"storage_account_id" db:"storage_account_id"`
	EmployeeID       uuid.UUID `json:"employee_id" db:"employee_id"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

// FeatureFlag represents a system feature toggle
type FeatureFlag struct {
	Key         string    `json:"key" db:"key"`
	IsEnabled   bool      `json:"is_enabled" db:"is_enabled"`
	Description string    `json:"description" db:"description"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
