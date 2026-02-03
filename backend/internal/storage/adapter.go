package storage

import (
	"context"
	"io"
	"time"

	"github.com/appnity/media-vault/internal/models"
	"github.com/google/uuid"
)

// StorageAdapter defines the common interface for all storage providers.
// All providers must implement this interface.
type StorageAdapter interface {
	// Provider returns the type of this storage adapter
	Provider() models.ProviderType

	// Upload uploads a file to storage and returns the storage key and public URL
	Upload(ctx context.Context, input UploadInput) (*UploadResult, error)

	// GenerateSignedUploadURL creates a pre-signed URL for direct upload
	// Used for client-side uploads to bypass backend for large files
	GenerateSignedUploadURL(ctx context.Context, input SignedUploadInput) (*SignedUploadResult, error)

	// Download retrieves a file from storage
	Download(ctx context.Context, storageKey string) (io.ReadCloser, error)

	// Delete removes a file from storage
	Delete(ctx context.Context, storageKey string) error

	// Move moves/renames a file within the storage
	Move(ctx context.Context, sourceKey, destinationKey string) error

	// GetPublicURL returns the public URL for a stored file
	GetPublicURL(ctx context.Context, storageKey string) (string, error)

	// GenerateSignedDownloadURL creates a time-limited URL for private files
	GenerateSignedDownloadURL(ctx context.Context, storageKey string, expiry time.Duration) (string, error)

	// List lists files in a given prefix/folder
	List(ctx context.Context, prefix string, limit int, cursor string) (*ListResult, error)

	// Exists checks if a file exists at the given storage key
	Exists(ctx context.Context, storageKey string) (bool, error)

	// GetMetadata retrieves file metadata from storage
	GetMetadata(ctx context.Context, storageKey string) (*FileMetadata, error)

	// Close releases any resources held by the adapter
	Close() error
}

// UploadInput contains all data needed for upload
type UploadInput struct {
	Reader      io.Reader
	StorageKey  string
	Filename    string
	ContentType string
	ContentSize int64
	Metadata    map[string]string
}

// UploadResult contains the result of an upload operation
type UploadResult struct {
	StorageKey   string         `json:"storage_key"`
	PublicURL    string         `json:"public_url"`
	ThumbnailURL string         `json:"thumbnail_url,omitempty"`
	ProviderID   string         `json:"provider_id,omitempty"`
	ETag         string         `json:"etag,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}

// SignedUploadInput contains data for generating signed upload URLs
type SignedUploadInput struct {
	StorageKey  string
	ContentType string
	Expiry      time.Duration
	MaxSize     int64
	Metadata    map[string]string
}

// SignedUploadResult contains the signed URL and related info
type SignedUploadResult struct {
	UploadURL  string            `json:"upload_url"`
	Method     string            `json:"method"` // PUT or POST
	StorageKey string            `json:"storage_key"`
	Headers    map[string]string `json:"headers,omitempty"`
	FormData   map[string]string `json:"form_data,omitempty"` // For POST multipart
	ExpiresAt  time.Time         `json:"expires_at"`
}

// ListResult contains paginated list of files
type ListResult struct {
	Files      []FileInfo `json:"files"`
	NextCursor string     `json:"next_cursor,omitempty"`
	HasMore    bool       `json:"has_more"`
}

// FileInfo represents basic file information from listing
type FileInfo struct {
	StorageKey   string    `json:"storage_key"`
	Size         int64     `json:"size"`
	ContentType  string    `json:"content_type,omitempty"`
	LastModified time.Time `json:"last_modified"`
	ETag         string    `json:"etag,omitempty"`
}

// FileMetadata contains detailed file metadata
type FileMetadata struct {
	StorageKey   string            `json:"storage_key"`
	Size         int64             `json:"size"`
	ContentType  string            `json:"content_type"`
	LastModified time.Time         `json:"last_modified"`
	ETag         string            `json:"etag,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	// Image/Video specific
	Width    int `json:"width,omitempty"`
	Height   int `json:"height,omitempty"`
	Duration int `json:"duration_seconds,omitempty"`
}

// Credentials holds decrypted credentials for each provider type
type Credentials struct {
	// Cloudinary
	CloudName string `json:"cloud_name,omitempty"`
	APIKey    string `json:"api_key,omitempty"`
	APISecret string `json:"api_secret,omitempty"`

	// S3-compatible (R2, S3, B2)
	AccessKeyID     string `json:"access_key_id,omitempty"`
	SecretAccessKey string `json:"secret_access_key,omitempty"`
	Endpoint        string `json:"endpoint,omitempty"`
	Region          string `json:"region,omitempty"`
	BucketName      string `json:"bucket_name,omitempty"`

	// B2 specific
	KeyID          string `json:"key_id,omitempty"`
	ApplicationKey string `json:"application_key,omitempty"`
}

// AdapterFactory creates storage adapters from storage accounts
type AdapterFactory struct {
	decryptFunc func(encrypted []byte, nonce []byte) ([]byte, error)
}

// NewAdapterFactory creates a new adapter factory
func NewAdapterFactory(decryptFunc func(encrypted []byte, nonce []byte) ([]byte, error)) *AdapterFactory {
	return &AdapterFactory{decryptFunc: decryptFunc}
}

// CreateAdapter creates an appropriate adapter based on provider type
func (f *AdapterFactory) CreateAdapter(ctx context.Context, account *models.StorageAccount) (StorageAdapter, error) {
	// Decrypt credentials
	credJSON, err := f.decryptFunc(account.EncryptedCredentials, account.CredentialsNonce)
	if err != nil {
		return nil, err
	}

	switch account.Provider {
	case models.ProviderCloudinary:
		return NewCloudinaryAdapter(credJSON, account)
	case models.ProviderR2:
		return NewR2Adapter(credJSON, account)
	case models.ProviderS3:
		return NewS3Adapter(credJSON, account)
	case models.ProviderB2:
		return NewB2Adapter(credJSON, account)
	default:
		return nil, ErrUnsupportedProvider
	}
}

// AdapterPool manages a pool of adapters per storage account
type AdapterPool struct {
	adapters map[uuid.UUID]StorageAdapter
	factory  *AdapterFactory
}

// NewAdapterPool creates a new adapter pool
func NewAdapterPool(factory *AdapterFactory) *AdapterPool {
	return &AdapterPool{
		adapters: make(map[uuid.UUID]StorageAdapter),
		factory:  factory,
	}
}

// GetAdapter retrieves or creates an adapter for the given storage account
func (p *AdapterPool) GetAdapter(ctx context.Context, account *models.StorageAccount) (StorageAdapter, error) {
	if adapter, ok := p.adapters[account.ID]; ok {
		return adapter, nil
	}

	adapter, err := p.factory.CreateAdapter(ctx, account)
	if err != nil {
		return nil, err
	}

	p.adapters[account.ID] = adapter
	return adapter, nil
}

// InvalidateAdapter removes an adapter from the pool (e.g., after credentials update)
func (p *AdapterPool) InvalidateAdapter(accountID uuid.UUID) {
	if adapter, ok := p.adapters[accountID]; ok {
		adapter.Close()
		delete(p.adapters, accountID)
	}
}

// Close closes all adapters in the pool
func (p *AdapterPool) Close() {
	for _, adapter := range p.adapters {
		adapter.Close()
	}
	p.adapters = make(map[uuid.UUID]StorageAdapter)
}
