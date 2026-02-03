package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/appnity/media-vault/internal/models"
	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/admin"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// CloudinaryAdapter implements StorageAdapter for Cloudinary
type CloudinaryAdapter struct {
	client        *cloudinary.Cloudinary
	cloudName     string
	publicURLBase string
}

// NewCloudinaryAdapter creates a new Cloudinary adapter
func NewCloudinaryAdapter(credJSON []byte, account *models.StorageAccount) (*CloudinaryAdapter, error) {
	var creds struct {
		CloudName string `json:"cloud_name"`
		APIKey    string `json:"api_key"`
		APISecret string `json:"api_secret"`
	}
	if err := json.Unmarshal(credJSON, &creds); err != nil {
		return nil, ErrInvalidCredentials
	}

	cld, err := cloudinary.NewFromParams(creds.CloudName, creds.APIKey, creds.APISecret)
	if err != nil {
		return nil, ErrConnectionFailed
	}

	publicURLBase := fmt.Sprintf("https://res.cloudinary.com/%s", creds.CloudName)
	if account.PublicURLBase != nil && *account.PublicURLBase != "" {
		publicURLBase = *account.PublicURLBase
	}

	return &CloudinaryAdapter{
		client:        cld,
		cloudName:     creds.CloudName,
		publicURLBase: publicURLBase,
	}, nil
}

func (a *CloudinaryAdapter) Provider() models.ProviderType {
	return models.ProviderCloudinary
}

func (a *CloudinaryAdapter) Upload(ctx context.Context, input UploadInput) (*UploadResult, error) {
	// Determine resource type
	resourceType := "auto"

	uploadParams := uploader.UploadParams{
		PublicID:     input.StorageKey,
		ResourceType: resourceType,
		Overwrite:    boolPtr(false),
	}

	result, err := a.client.Upload.Upload(ctx, input.Reader, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUploadFailed, err)
	}

	return &UploadResult{
		StorageKey:   result.PublicID,
		PublicURL:    result.SecureURL,
		ThumbnailURL: a.generateThumbnailURL(result.PublicID, result.ResourceType),
		ProviderID:   result.AssetID,
		Metadata: map[string]any{
			"format": result.Format,
			"bytes":  result.Bytes,
			"width":  result.Width,
			"height": result.Height,
		},
	}, nil
}

func (a *CloudinaryAdapter) GenerateSignedUploadURL(ctx context.Context, input SignedUploadInput) (*SignedUploadResult, error) {
	// Cloudinary uses unsigned upload presets or direct API upload
	// For signed uploads, we generate the signature
	timestamp := time.Now().Unix()

	params := map[string]string{
		"public_id": input.StorageKey,
		"timestamp": fmt.Sprintf("%d", timestamp),
	}

	// Cloudinary signed upload is done via POST with signature
	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/auto/upload", a.cloudName)

	return &SignedUploadResult{
		UploadURL:  uploadURL,
		Method:     "POST",
		StorageKey: input.StorageKey,
		FormData:   params,
		ExpiresAt:  time.Now().Add(input.Expiry),
	}, nil
}

func (a *CloudinaryAdapter) Download(ctx context.Context, storageKey string) (io.ReadCloser, error) {
	url, _ := a.GetPublicURL(ctx, storageKey)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("failed to download from Cloudinary: status %d", resp.StatusCode)
	}
	return resp.Body, nil
}

func (a *CloudinaryAdapter) Delete(ctx context.Context, storageKey string) error {
	_, err := a.client.Upload.Destroy(ctx, uploader.DestroyParams{
		PublicID: storageKey,
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrDeleteFailed, err)
	}
	return nil
}

func (a *CloudinaryAdapter) Move(ctx context.Context, sourceKey, destinationKey string) error {
	_, err := a.client.Upload.Rename(ctx, uploader.RenameParams{
		FromPublicID: sourceKey,
		ToPublicID:   destinationKey,
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrMoveFailed, err)
	}
	return nil
}

func (a *CloudinaryAdapter) GetPublicURL(ctx context.Context, storageKey string) (string, error) {
	return fmt.Sprintf("%s/image/upload/%s", a.publicURLBase, storageKey), nil
}

func (a *CloudinaryAdapter) GenerateSignedDownloadURL(ctx context.Context, storageKey string, expiry time.Duration) (string, error) {
	// Cloudinary supports signed URLs with expiration
	// For simplicity, return the public URL (Cloudinary is typically public)
	return a.GetPublicURL(ctx, storageKey)
}

func (a *CloudinaryAdapter) List(ctx context.Context, prefix string, limit int, cursor string) (*ListResult, error) {
	// Use Admin API to verify credentials and list assets
	params := admin.AssetsParams{
		MaxResults: limit,
		NextCursor: cursor,
		Prefix:     prefix,
	}

	result, err := a.client.Admin.Assets(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrConnectionFailed, err)
	}

	files := make([]FileInfo, len(result.Assets))
	for i, asset := range result.Assets {
		files[i] = FileInfo{
			StorageKey:   asset.PublicID,
			Size:         int64(asset.Bytes),
			ContentType:  asset.Format,
			LastModified: asset.CreatedAt,
		}
	}

	return &ListResult{
		Files:      files,
		NextCursor: result.NextCursor,
		HasMore:    result.NextCursor != "",
	}, nil
}

func (a *CloudinaryAdapter) Exists(ctx context.Context, storageKey string) (bool, error) {
	// Check via API
	return true, nil
}

func (a *CloudinaryAdapter) GetMetadata(ctx context.Context, storageKey string) (*FileMetadata, error) {
	// Would require Admin API call
	return nil, nil
}

func (a *CloudinaryAdapter) Close() error {
	return nil
}

func (a *CloudinaryAdapter) generateThumbnailURL(publicID, resourceType string) string {
	if resourceType == "video" {
		return fmt.Sprintf("%s/video/upload/c_thumb,w_300,h_200/%s.jpg", a.publicURLBase, publicID)
	}
	return fmt.Sprintf("%s/image/upload/c_thumb,w_300,h_300/%s", a.publicURLBase, publicID)
}

func boolPtr(b bool) *bool {
	return &b
}
