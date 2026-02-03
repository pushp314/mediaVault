package services

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strings"
	"time"

	"github.com/appnity/media-vault/internal/crypto"
	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/repository"
	"github.com/appnity/media-vault/internal/storage"
	"github.com/google/uuid"
)

var (
	ErrUnauthorized     = errors.New("unauthorized")
	ErrForbidden        = errors.New("forbidden")
	ErrInvalidInput     = errors.New("invalid input")
	ErrStorageNotFound  = errors.New("storage account not found")
	ErrMediaNotFound    = errors.New("media not found")
	ErrGroupNotFound    = errors.New("media group not found")
	ErrEmployeeNotFound = errors.New("employee not found")
)

// MediaService handles media operations
type MediaService struct {
	repo        *repository.Repository
	encryptor   *crypto.Encryptor
	adapterPool *storage.AdapterPool
}

// NewMediaService creates a new media service
func NewMediaService(repo *repository.Repository, encryptor *crypto.Encryptor) *MediaService {
	factory := storage.NewAdapterFactory(encryptor.Decrypt)
	return &MediaService{
		repo:        repo,
		encryptor:   encryptor,
		adapterPool: storage.NewAdapterPool(factory),
	}
}

// InitiateUpload starts the upload process and returns a signed URL
func (s *MediaService) InitiateUpload(ctx context.Context, req *models.UploadMediaRequest, filename, contentType string, fileSize int64, employee *models.Employee) (*models.UploadResponse, error) {
	// Determine media type from content type
	mediaType := s.determineMediaType(contentType)

	// Find the appropriate storage account
	storageAccount, folderPrefix, err := s.routeStorage(ctx, req.StorageAccountID, req.MediaGroupID, mediaType, contentType, fileSize)
	if err != nil {
		return nil, err
	}

	// Generate storage key
	storageKey := s.generateStorageKey(folderPrefix, req.FolderPath, filename)

	// Create pending media record
	media := &models.Media{
		StorageAccountID: storageAccount.ID,
		MediaGroupID:     req.MediaGroupID,
		Filename:         filepath.Base(filename),
		OriginalFilename: filename,
		StorageKey:       storageKey,
		MediaType:        mediaType,
		MimeType:         contentType,
		FileSizeBytes:    0, // Will be updated after upload
		Tags:             req.Tags,
		UploadedBy:       employee.ID,
	}

	if err := s.repo.CreateMedia(ctx, media); err != nil {
		return nil, fmt.Errorf("failed to create media record: %w", err)
	}

	// Get storage adapter and generate signed URL
	adapter, err := s.adapterPool.GetAdapter(ctx, storageAccount)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage adapter: %w", err)
	}

	signedResult, err := adapter.GenerateSignedUploadURL(ctx, storage.SignedUploadInput{
		StorageKey:  storageKey,
		ContentType: contentType,
		Expiry:      15 * time.Minute,
		MaxSize:     int64(storageAccount.MaxFileSizeMB) * 1024 * 1024,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate signed URL: %w", err)
	}

	return &models.UploadResponse{
		MediaID:          media.ID,
		UploadURL:        signedResult.UploadURL,
		UploadMethod:     signedResult.Method,
		StorageAccountID: storageAccount.ID,
		StorageKey:       storageKey,
		ExpiresAt:        signedResult.ExpiresAt.Unix(),
		Headers:          signedResult.Headers,
		FormData:         signedResult.FormData,
	}, nil
}

// CompleteUpload finalizes the upload after client uploads directly
func (s *MediaService) CompleteUpload(ctx context.Context, req *models.UploadCompleteRequest, employee *models.Employee) (*models.MediaWithDetails, error) {
	// Get media record
	media, err := s.repo.GetMediaByID(ctx, req.MediaID)
	if err != nil {
		return nil, ErrMediaNotFound
	}

	// Verify ownership
	if media.UploadedBy != employee.ID && employee.Role != models.RoleAdmin {
		return nil, ErrForbidden
	}

	// Get storage account to get public URL
	storageAccount, err := s.repo.GetStorageAccountByID(ctx, media.StorageAccountID)
	if err != nil {
		return nil, ErrStorageNotFound
	}

	adapter, err := s.adapterPool.GetAdapter(ctx, storageAccount)
	if err != nil {
		return nil, err
	}

	publicURL, err := adapter.GetPublicURL(ctx, media.StorageKey)
	if err != nil {
		return nil, err
	}

	// Update media record with final details
	media.FileSizeBytes = req.FileSizeBytes
	media.MimeType = req.MimeType
	media.Width = req.Width
	media.Height = req.Height
	media.DurationSeconds = req.Duration
	media.PublicURL = &publicURL

	if err := s.repo.UpdateMedia(ctx, &media.Media); err != nil {
		return nil, err
	}

	// Log the audit
	s.logAudit(ctx, employee, models.AuditActionUpload, "media", &media.ID, map[string]any{
		"filename": media.OriginalFilename,
		"size":     req.FileSizeBytes,
		"storage":  storageAccount.Name,
	})

	return media, nil
}

// ListMedia lists media with filters
func (s *MediaService) ListMedia(ctx context.Context, filters *models.MediaFilterRequest, employee *models.Employee) (*models.PaginatedResponse[models.MediaWithDetails], error) {
	// Set defaults
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PageSize < 1 || filters.PageSize > 100 {
		filters.PageSize = 50
	}

	mediaList, total, err := s.repo.ListMedia(ctx, filters)
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / filters.PageSize
	if int(total)%filters.PageSize > 0 {
		totalPages++
	}

	return &models.PaginatedResponse[models.MediaWithDetails]{
		Data:       mediaList,
		Total:      total,
		Page:       filters.Page,
		PageSize:   filters.PageSize,
		TotalPages: totalPages,
	}, nil
}

// GetMedia gets a single media item
func (s *MediaService) GetMedia(ctx context.Context, id uuid.UUID) (*models.MediaWithDetails, error) {
	return s.repo.GetMediaByID(ctx, id)
}

// DeleteMedia soft deletes a media item
func (s *MediaService) DeleteMedia(ctx context.Context, id uuid.UUID, employee *models.Employee) error {
	media, err := s.repo.GetMediaByID(ctx, id)
	if err != nil {
		return ErrMediaNotFound
	}

	// Check permissions
	if media.UploadedBy != employee.ID && employee.Role != models.RoleAdmin {
		return ErrForbidden
	}

	// Delete from cloud storage
	storageAccount, err := s.repo.GetStorageAccountByID(ctx, media.StorageAccountID)
	if err == nil {
		if adapter, err := s.adapterPool.GetAdapter(ctx, storageAccount); err == nil {
			if err := adapter.Delete(ctx, media.StorageKey); err != nil {
				// Log error but proceed? Or fail? User insisted on deletion.
				// Let's return error to ensure user knows if it failed.
				return fmt.Errorf("failed to delete from cloud storage: %w", err)
			}
		}
	}

	// Soft delete in database
	if err := s.repo.SoftDeleteMedia(ctx, id); err != nil {
		return err
	}

	// Log audit
	s.logAudit(ctx, employee, models.AuditActionDelete, "media", &id, map[string]any{
		"filename": media.OriginalFilename,
	})

	return nil
}

// BatchDeleteMedia soft deletes multiple media items concurrently for improved performance
func (s *MediaService) BatchDeleteMedia(ctx context.Context, ids []uuid.UUID, employee *models.Employee) error {
	errChan := make(chan error, len(ids))

	for _, id := range ids {
		go func(mid uuid.UUID) {
			errChan <- s.DeleteMedia(ctx, mid, employee)
		}(id)
	}

	var lastErr error
	for i := 0; i < len(ids); i++ {
		if err := <-errChan; err != nil {
			lastErr = err
		}
	}

	return lastErr
}

// MoveMedia moves media to a different group/folder
func (s *MediaService) MoveMedia(ctx context.Context, id uuid.UUID, req *models.MoveMediaRequest, employee *models.Employee) (*models.MediaWithDetails, error) {
	media, err := s.repo.GetMediaByID(ctx, id)
	if err != nil {
		return nil, ErrMediaNotFound
	}

	// Check permissions
	if media.UploadedBy != employee.ID && employee.Role != models.RoleAdmin && employee.Role != models.RoleDeveloper {
		return nil, ErrForbidden
	}

	// If moving to different storage, need to actually move the file
	if req.StorageAccountID != nil && *req.StorageAccountID != media.StorageAccountID {
		// Cross-storage move - complex operation
		// For MVP, we'll just update the metadata
		// In production, you'd copy to new storage and delete from old
	}

	// Update media record
	if req.MediaGroupID != nil {
		media.MediaGroupID = req.MediaGroupID
	}

	if err := s.repo.UpdateMedia(ctx, &media.Media); err != nil {
		return nil, err
	}

	// Log audit
	s.logAudit(ctx, employee, models.AuditActionMove, "media", &id, map[string]any{
		"new_folder": req.FolderPath,
	})

	return s.repo.GetMediaByID(ctx, id)
}

// GetPublicURL gets the public URL for a media item
func (s *MediaService) GetPublicURL(ctx context.Context, id uuid.UUID) (string, error) {
	media, err := s.repo.GetMediaByID(ctx, id)
	if err != nil {
		return "", ErrMediaNotFound
	}

	if media.PublicURL != nil && *media.PublicURL != "" {
		return *media.PublicURL, nil
	}

	// Generate URL from storage adapter
	storageAccount, err := s.repo.GetStorageAccountByID(ctx, media.StorageAccountID)
	if err != nil {
		return "", err
	}

	adapter, err := s.adapterPool.GetAdapter(ctx, storageAccount)
	if err != nil {
		return "", err
	}

	return adapter.GetPublicURL(ctx, media.StorageKey)
}

// DownloadMedia retrieves a file stream for download
func (s *MediaService) DownloadMedia(ctx context.Context, id uuid.UUID) (*models.MediaWithDetails, io.ReadCloser, error) {
	media, err := s.repo.GetMediaByID(ctx, id)
	if err != nil {
		return nil, nil, ErrMediaNotFound
	}

	storageAccount, err := s.repo.GetStorageAccountByID(ctx, media.StorageAccountID)
	if err != nil {
		return nil, nil, err
	}

	adapter, err := s.adapterPool.GetAdapter(ctx, storageAccount)
	if err != nil {
		return nil, nil, err
	}

	reader, err := adapter.Download(ctx, media.StorageKey)
	if err != nil {
		return nil, nil, err
	}

	// Increment download count
	go s.repo.IncrementDownloadCount(context.Background(), id)

	return media, reader, nil
}

// BatchDownloadMedia creates a ZIP of multiple media items
func (s *MediaService) BatchDownloadMedia(ctx context.Context, ids []uuid.UUID, w io.Writer) error {
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	for _, id := range ids {
		media, reader, err := s.DownloadMedia(ctx, id)
		if err != nil {
			// Skip files that can't be downloaded, log and continue
			continue
		}

		f, err := zipWriter.Create(media.OriginalFilename)
		if err != nil {
			reader.Close()
			return err
		}

		_, err = io.Copy(f, reader)
		reader.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// routeStorage determines which storage account to use
func (s *MediaService) routeStorage(ctx context.Context, overrideID, groupID *uuid.UUID, mediaType models.MediaType, mimeType string, fileSize int64) (*models.StorageAccount, string, error) {
	// If override specified, use it
	if overrideID != nil {
		acc, err := s.repo.GetStorageAccountByID(ctx, *overrideID)
		if err != nil {
			return nil, "", ErrStorageNotFound
		}
		if err := s.validateAccountLimits(acc, mediaType, fileSize); err != nil {
			return nil, "", err
		}
		return acc, "", nil
	}

	// Check if media group has a default storage
	if groupID != nil {
		group, err := s.repo.GetMediaGroupByID(ctx, *groupID)
		if err == nil && group.DefaultStorageAccountID != nil {
			acc, err := s.repo.GetStorageAccountByID(ctx, *group.DefaultStorageAccountID)
			if err == nil {
				if err := s.validateAccountLimits(acc, mediaType, fileSize); err == nil {
					return acc, "", nil
				}
			}
		}
	}

	// Check routing rules
	rules, err := s.repo.GetActiveRoutingRules(ctx)
	if err == nil {
		for _, rule := range rules {
			if s.ruleMatches(rule, groupID, mediaType, mimeType, fileSize) {
				acc, err := s.repo.GetStorageAccountByID(ctx, rule.StorageAccountID)
				if err == nil {
					if err := s.validateAccountLimits(acc, mediaType, fileSize); err == nil {
						prefix := ""
						if rule.TargetFolderPfx != nil {
							prefix = *rule.TargetFolderPfx
						}
						return acc, prefix, nil
					}
				}
			}
		}
	}

	// Fall back to default storage account
	acc, err := s.repo.GetDefaultStorageAccount(ctx)
	if err != nil {
		return nil, "", ErrStorageNotFound
	}
	if err := s.validateAccountLimits(acc, mediaType, fileSize); err != nil {
		return nil, "", err
	}
	return acc, "", nil
}

// validateAccountLimits checks if a file exceeds account or provider limits
func (s *MediaService) validateAccountLimits(acc *models.StorageAccount, mediaType models.MediaType, fileSize int64) error {
	// 1. Check account-specific limit (if set)
	if acc.MaxFileSizeMB > 0 {
		limit := int64(acc.MaxFileSizeMB) * 1024 * 1024
		if fileSize > limit {
			return fmt.Errorf("file size exceeds storage account limit (%d MB)", acc.MaxFileSizeMB)
		}
	}

	// 2. Check provider-specific limits
	if acc.Provider == models.ProviderCloudinary {
		if mediaType == models.MediaTypeImage && fileSize > 10*1024*1024 {
			return fmt.Errorf("Cloudinary image limit exceeded (max 10MB)")
		}
		if mediaType == models.MediaTypeVideo && fileSize > 100*1024*1024 {
			return fmt.Errorf("Cloudinary video limit exceeded (max 100MB)")
		}
	}

	// ProviderR2 is assumed to have no enforced limits here as per user request

	return nil
}

// ruleMatches checks if a routing rule matches the upload
func (s *MediaService) ruleMatches(rule models.StorageRoutingRule, groupID *uuid.UUID, mediaType models.MediaType, mimeType string, fileSize int64) bool {
	if rule.MediaGroupID != nil && (groupID == nil || *rule.MediaGroupID != *groupID) {
		return false
	}
	if rule.MediaType != nil && *rule.MediaType != mediaType {
		return false
	}
	if rule.MinFileSizeBytes != nil && fileSize < *rule.MinFileSizeBytes {
		return false
	}
	if rule.MaxFileSizeBytes != nil && fileSize > *rule.MaxFileSizeBytes {
		return false
	}
	if rule.MimeTypePattern != nil {
		if !s.matchMimePattern(*rule.MimeTypePattern, mimeType) {
			return false
		}
	}
	return true
}

// matchMimePattern matches mime type against a pattern like "image/*"
func (s *MediaService) matchMimePattern(pattern, mimeType string) bool {
	if pattern == "*" || pattern == "*/*" {
		return true
	}
	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return strings.HasPrefix(mimeType, prefix+"/")
	}
	return pattern == mimeType
}

// generateStorageKey creates a unique storage key
func (s *MediaService) generateStorageKey(prefix, folderPath, filename string) string {
	// Clean filename
	ext := filepath.Ext(filename)
	baseName := strings.TrimSuffix(filename, ext)
	safeName := strings.ReplaceAll(baseName, " ", "_")

	// Generate unique ID
	uniqueID := uuid.New().String()[:8]

	// Build path
	parts := []string{}
	if prefix != "" {
		parts = append(parts, strings.Trim(prefix, "/"))
	}
	if folderPath != "" {
		parts = append(parts, strings.Trim(folderPath, "/"))
	}
	parts = append(parts, fmt.Sprintf("%s_%s%s", safeName, uniqueID, ext))

	return strings.Join(parts, "/")
}

// determineMediaType determines media type from content type
func (s *MediaService) determineMediaType(contentType string) models.MediaType {
	mainType := strings.Split(contentType, "/")[0]
	switch mainType {
	case "image":
		return models.MediaTypeImage
	case "video":
		return models.MediaTypeVideo
	case "audio":
		return models.MediaTypeAudio
	case "application":
		if strings.Contains(contentType, "pdf") ||
			strings.Contains(contentType, "msword") ||
			strings.Contains(contentType, "vnd.openxmlformats-officedocument") ||
			strings.Contains(contentType, "vnd.ms-") ||
			strings.Contains(contentType, "zip") ||
			strings.Contains(contentType, "octet-stream") {
			// Some octet-stream might be documents, but let's be careful.
			// If it's application and we don't know, it might be 'other'.
			if strings.Contains(contentType, "pdf") || strings.Contains(contentType, "document") || strings.Contains(contentType, "sheet") || strings.Contains(contentType, "presentation") {
				return models.MediaTypeDocument
			}
		}
	case "text":
		return models.MediaTypeDocument
	}
	return models.MediaTypeOther
}

// logAudit creates an audit log entry
func (s *MediaService) logAudit(_ context.Context, employee *models.Employee, action models.AuditAction, resourceType string, resourceID *uuid.UUID, details map[string]any) {
	log := &models.AuditLog{
		EmployeeID:    employee.ID,
		EmployeeEmail: employee.Email,
		Action:        action,
		ResourceType:  resourceType,
		ResourceID:    resourceID,
		Details:       details,
	}
	// Fire and forget - don't block on audit logging
	go s.repo.CreateAuditLog(context.Background(), log)
}

// DetermineContentType guesses content type from filename
func DetermineContentType(filename string) string {
	ext := filepath.Ext(filename)
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return "application/octet-stream"
	}
	return mimeType
}

// SyncStorageAccount scans the storage account for existing files and adds them to DB
func (s *MediaService) SyncStorageAccount(ctx context.Context, storageAccountID uuid.UUID, employeeID uuid.UUID) (*models.SyncResult, error) {
	// 1. Get Storage Account
	account, err := s.repo.GetStorageAccountByID(ctx, storageAccountID)
	if err != nil {
		return nil, ErrStorageNotFound
	}
	// 2. Get Adapter
	adapter, err := s.adapterPool.GetAdapter(ctx, account)
	if err != nil {
		return nil, err
	}
	// 3. List Files (pagination loop)
	var added, skipped int
	var syncErrors []string
	cursor := ""
	for {
		result, err := adapter.List(ctx, "", 100, cursor)
		if err != nil {
			return nil, fmt.Errorf("failed to list files: %w", err)
		}
		for _, file := range result.Files {
			// Check existence
			exists, err := s.repo.CheckMediaExists(ctx, account.ID, file.StorageKey)
			if err != nil {
				syncErrors = append(syncErrors, fmt.Sprintf("db check error for %s: %v", file.StorageKey, err))
				continue
			}
			if exists {
				skipped++
				continue
			}

			// Fix mime type if necessary
			mimeType := file.ContentType
			if mimeType == "" || !strings.Contains(mimeType, "/") {
				// Guess from extension or format
				ext := filepath.Ext(file.StorageKey)
				if ext == "" && mimeType != "" {
					ext = "." + mimeType
				}

				// Handle common short formats from Cloudinary etc.
				switch mimeType {
				case "jpg", "jpeg":
					mimeType = "image/jpeg"
				case "png":
					mimeType = "image/png"
				case "gif":
					mimeType = "image/gif"
				case "webp":
					mimeType = "image/webp"
				case "mp4":
					mimeType = "video/mp4"
				case "pdf":
					mimeType = "application/pdf"
				default:
					guessed := mime.TypeByExtension(ext)
					if guessed != "" {
						mimeType = guessed
					} else if mimeType == "" {
						mimeType = "application/octet-stream"
					}
				}
			}

			// Get Public URL
			publicURL, _ := adapter.GetPublicURL(ctx, file.StorageKey)

			// Create media
			media := &models.Media{
				StorageAccountID: account.ID,
				Filename:         filepath.Base(file.StorageKey),
				OriginalFilename: filepath.Base(file.StorageKey),
				StorageKey:       file.StorageKey,
				FileSizeBytes:    file.Size,
				MimeType:         mimeType,
				MediaType:        s.determineMediaType(mimeType),
				UploadedBy:       employeeID,
				Tags:             []string{"synced"},
				PublicURL:        &publicURL,
			}
			if err := s.repo.CreateMedia(ctx, media); err != nil {
				syncErrors = append(syncErrors, fmt.Sprintf("create db error for %s: %v", file.StorageKey, err))
			} else {
				added++
			}
		}
		if !result.HasMore {
			break
		}
		cursor = result.NextCursor
	}
	return &models.SyncResult{AddedCount: added, SkippedCount: skipped, Errors: syncErrors}, nil
}
