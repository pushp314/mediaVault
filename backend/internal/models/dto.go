package models

import (
	"github.com/google/uuid"
)

// =====================================
// Request DTOs
// =====================================

// LoginRequest for employee authentication
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// CreateEmployeeRequest for admin to create employees
type CreateEmployeeRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name" binding:"required,min=2"`
	Role     Role   `json:"role" binding:"required,oneof=admin developer marketing viewer"`
}

// UpdateEmployeeRequest for updating employee
type UpdateEmployeeRequest struct {
	FullName  *string `json:"full_name,omitempty"`
	Role      *Role   `json:"role,omitempty"`
	IsActive  *bool   `json:"is_active,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

// CreateStorageAccountRequest for adding storage provider
type CreateStorageAccountRequest struct {
	Name          string            `json:"name" binding:"required,min=2"`
	Provider      ProviderType      `json:"provider" binding:"required,oneof=cloudinary r2 s3 b2"`
	Credentials   map[string]string `json:"credentials" binding:"required"`
	BucketName    *string           `json:"bucket_name,omitempty"`
	Region        *string           `json:"region,omitempty"`
	EndpointURL   *string           `json:"endpoint_url,omitempty"`
	PublicURLBase *string           `json:"public_url_base,omitempty"`
	IsDefault     bool              `json:"is_default"`
	MaxFileSizeMB int               `json:"max_file_size_mb"`
	AllowedTypes  []MediaType       `json:"allowed_types"`
}

// UpdateStorageAccountRequest for modifying storage account
type UpdateStorageAccountRequest struct {
	Name          *string           `json:"name,omitempty"`
	Credentials   map[string]string `json:"credentials,omitempty"`
	BucketName    *string           `json:"bucket_name,omitempty"`
	Region        *string           `json:"region,omitempty"`
	EndpointURL   *string           `json:"endpoint_url,omitempty"`
	PublicURLBase *string           `json:"public_url_base,omitempty"`
	IsDefault     *bool             `json:"is_default,omitempty"`
	IsActive      *bool             `json:"is_active,omitempty"`
	MaxFileSizeMB *int              `json:"max_file_size_mb,omitempty"`
	AllowedTypes  []MediaType       `json:"allowed_types,omitempty"`
}

// CreateMediaGroupRequest for creating media groups
type CreateMediaGroupRequest struct {
	Name                    string     `json:"name" binding:"required,min=2"`
	Description             *string    `json:"description,omitempty"`
	Color                   string     `json:"color" binding:"required,len=7"`
	Icon                    string     `json:"icon" binding:"required"`
	DefaultStorageAccountID *uuid.UUID `json:"default_storage_account_id,omitempty"`
	AllowedRoles            []Role     `json:"allowed_roles"`
}

// UpdateMediaGroupRequest for modifying media groups
type UpdateMediaGroupRequest struct {
	Name                    *string    `json:"name,omitempty"`
	Description             *string    `json:"description,omitempty"`
	Color                   *string    `json:"color,omitempty"`
	Icon                    *string    `json:"icon,omitempty"`
	DefaultStorageAccountID *uuid.UUID `json:"default_storage_account_id,omitempty"`
	AllowedRoles            []Role     `json:"allowed_roles,omitempty"`
}

// UploadMediaRequest for initiating upload
type UploadMediaRequest struct {
	MediaGroupID     *uuid.UUID `json:"media_group_id,omitempty"`
	FolderPath       string     `json:"folder_path"`
	StorageAccountID *uuid.UUID `json:"storage_account_id,omitempty"` // Override routing
	Tags             []string   `json:"tags,omitempty"`
}

// UpdateMediaRequest for updating media metadata
type UpdateMediaRequest struct {
	MediaGroupID *uuid.UUID `json:"media_group_id,omitempty"`
	FolderID     *uuid.UUID `json:"folder_id,omitempty"`
	Tags         []string   `json:"tags,omitempty"`
}

// MoveMediaRequest for moving media
type MoveMediaRequest struct {
	MediaGroupID     *uuid.UUID `json:"media_group_id,omitempty"`
	FolderPath       string     `json:"folder_path"`
	StorageAccountID *uuid.UUID `json:"storage_account_id,omitempty"` // Move to different provider
}

// MediaFilterRequest for listing/searching media
type MediaFilterRequest struct {
	StorageAccountID string     `form:"storage_account_id"`
	MediaGroupID     string     `form:"media_group_id"`
	FolderID         string     `form:"folder_id"`
	MediaType        *MediaType `form:"media_type"`
	UploadedBy       string     `form:"uploaded_by"`
	MinSize          *int64     `form:"min_size"`
	MaxSize          *int64     `form:"max_size"`
	Tags             []string   `form:"tags"`
	Search           string     `form:"search"`
	Page             int        `form:"page,default=1"`
	PageSize         int        `form:"page_size,default=50"`
	SortBy           string     `form:"sort_by,default=created_at"`
	SortOrder        string     `form:"sort_order,default=desc"`
}

// CreateRoutingRuleRequest for smart routing
type CreateRoutingRuleRequest struct {
	Name             string     `json:"name" binding:"required"`
	Priority         int        `json:"priority"`
	MediaGroupID     *uuid.UUID `json:"media_group_id,omitempty"`
	MediaType        *MediaType `json:"media_type,omitempty"`
	MinFileSizeBytes *int64     `json:"min_file_size_bytes,omitempty"`
	MaxFileSizeBytes *int64     `json:"max_file_size_bytes,omitempty"`
	MimeTypePattern  *string    `json:"mime_type_pattern,omitempty"`
	StorageAccountID uuid.UUID  `json:"storage_account_id" binding:"required"`
	TargetFolderPfx  *string    `json:"target_folder_prefix,omitempty"`
}

// =====================================
// Response DTOs
// =====================================

// AuthResponse for login/refresh
type AuthResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int64    `json:"expires_in"` // seconds
	Employee     Employee `json:"employee"`
}

// PaginatedResponse for list endpoints
type PaginatedResponse[T any] struct {
	Data       []T   `json:"data"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
}

// UploadResponse with signed URL details
type UploadResponse struct {
	MediaID          uuid.UUID         `json:"media_id"`
	UploadURL        string            `json:"upload_url"`
	UploadMethod     string            `json:"upload_method"` // PUT, POST
	StorageAccountID uuid.UUID         `json:"storage_account_id"`
	StorageKey       string            `json:"storage_key"`
	ExpiresAt        int64             `json:"expires_at"` // Unix timestamp
	Headers          map[string]string `json:"headers,omitempty"`
	FormData         map[string]string `json:"form_data,omitempty"`
}

// UploadCompleteRequest for confirming upload completion
type UploadCompleteRequest struct {
	MediaID       uuid.UUID `json:"media_id" binding:"required"`
	FileSizeBytes int64     `json:"file_size_bytes" binding:"required"`
	MimeType      string    `json:"mime_type" binding:"required"`
	Width         *int      `json:"width,omitempty"`
	Height        *int      `json:"height,omitempty"`
	Duration      *int      `json:"duration_seconds,omitempty"`
	PublicURL     string    `json:"public_url,omitempty"`
}

// SyncResult result of synchronization
type SyncResult struct {
	AddedCount   int      `json:"added_count"`
	SkippedCount int      `json:"skipped_count"`
	Errors       []string `json:"errors,omitempty"`
}

// ErrorResponse for error handling
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details any    `json:"details,omitempty"`
}

// SuccessResponse for simple confirmations
type SuccessResponse struct {
	Message string `json:"message"`
}

// StatsResponse for dashboard
type DashboardStats struct {
	TotalMedia          int64                     `json:"total_media"`
	TotalSizeBytes      int64                     `json:"total_size_bytes"`
	MediaByType         map[string]int64          `json:"media_by_type"`
	MediaByProvider     map[string]int64          `json:"media_by_provider"`
	RecentUploads       []MediaWithDetails        `json:"recent_uploads"`
	StorageAccountStats []StorageAccountWithStats `json:"storage_account_stats"`
}
