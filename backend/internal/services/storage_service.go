package services

import (
	"context"
	"encoding/json"

	"github.com/appnity/media-vault/internal/crypto"
	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/repository"
	"github.com/appnity/media-vault/internal/storage"
	"github.com/google/uuid"
)

// StorageService handles storage account operations
type StorageService struct {
	repo        *repository.Repository
	encryptor   *crypto.Encryptor
	adapterPool *storage.AdapterPool
}

// NewStorageService creates a new storage service
func NewStorageService(repo *repository.Repository, encryptor *crypto.Encryptor) *StorageService {
	factory := storage.NewAdapterFactory(encryptor.Decrypt)
	return &StorageService{
		repo:        repo,
		encryptor:   encryptor,
		adapterPool: storage.NewAdapterPool(factory),
	}
}

// CreateStorageAccount creates a new storage account with encrypted credentials
func (s *StorageService) CreateStorageAccount(ctx context.Context, req *models.CreateStorageAccountRequest, employeeID uuid.UUID) (*models.StorageAccountWithStats, error) {
	// Serialize and encrypt credentials
	credJSON, err := json.Marshal(req.Credentials)
	if err != nil {
		return nil, ErrInvalidInput
	}

	encryptedCreds, nonce, err := s.encryptor.Encrypt(credJSON)
	if err != nil {
		return nil, err
	}

	// Check if this should be the default (auto-set if no default exists)
	isDefault := req.IsDefault
	if !isDefault {
		// Check if there's already a default storage account
		_, err := s.repo.GetDefaultStorageAccount(ctx)
		if err != nil {
			// No default exists, make this one the default
			isDefault = true
		}
	}

	account := &models.StorageAccount{
		Name:                 req.Name,
		Provider:             req.Provider,
		EncryptedCredentials: encryptedCreds,
		CredentialsNonce:     nonce,
		BucketName:           req.BucketName,
		Region:               req.Region,
		EndpointURL:          req.EndpointURL,
		PublicURLBase:        req.PublicURLBase,
		IsDefault:            isDefault,
		IsActive:             true,
		IsPublic:             req.IsPublic,
		MaxFileSizeMB:        req.MaxFileSizeMB,
		AllowedTypes:         req.AllowedTypes,
		CreatedBy:            employeeID,
	}

	if account.MaxFileSizeMB == 0 {
		account.MaxFileSizeMB = 100 // Default 100MB
	}
	if len(account.AllowedTypes) == 0 {
		account.AllowedTypes = []models.MediaType{
			models.MediaTypeImage,
			models.MediaTypeVideo,
			models.MediaTypeDocument,
			models.MediaTypeOther,
		}
	}

	if err := s.repo.CreateStorageAccount(ctx, account); err != nil {
		return nil, err
	}

	// Return with stats
	return &models.StorageAccountWithStats{
		StorageAccount: *account,
		MediaCount:     0,
		TotalSizeBytes: 0,
	}, nil
}

// ListStorageAccounts lists storage accounts based on permissions
func (s *StorageService) ListStorageAccounts(ctx context.Context, employeeID uuid.UUID, role models.Role) ([]models.StorageAccountWithStats, error) {
	var uidPtr *uuid.UUID
	if role != models.RoleAdmin {
		uidPtr = &employeeID
	}
	return s.repo.ListStorageAccounts(ctx, uidPtr)
}

// GrantStorageAccess grants access to a storage account
func (s *StorageService) GrantStorageAccess(ctx context.Context, accountID, employeeID uuid.UUID) error {
	return s.repo.GrantStorageAccess(ctx, accountID, employeeID)
}

// RevokeStorageAccess revokes access to a storage account
func (s *StorageService) RevokeStorageAccess(ctx context.Context, accountID, employeeID uuid.UUID) error {
	return s.repo.RevokeStorageAccess(ctx, accountID, employeeID)
}

// GetStorageAccountAccess returns a list of users with access to a storage account
func (s *StorageService) GetStorageAccountAccess(ctx context.Context, accountID uuid.UUID) ([]models.Employee, error) {
	return s.repo.GetStorageAccountAccessList(ctx, accountID)
}

// GetStorageAccount gets a storage account by ID
func (s *StorageService) GetStorageAccount(ctx context.Context, id uuid.UUID) (*models.StorageAccountWithStats, error) {
	return s.repo.GetStorageAccountWithStatsByID(ctx, id)
}

// UpdateStorageAccount updates a storage account
func (s *StorageService) UpdateStorageAccount(ctx context.Context, id uuid.UUID, req *models.UpdateStorageAccountRequest) (*models.StorageAccount, error) {
	account, err := s.repo.GetStorageAccountByID(ctx, id)
	if err != nil {
		return nil, ErrStorageNotFound
	}

	if req.Name != nil {
		account.Name = *req.Name
	}
	if req.Credentials != nil {
		credJSON, err := json.Marshal(req.Credentials)
		if err != nil {
			return nil, ErrInvalidInput
		}
		encryptedCreds, nonce, err := s.encryptor.Encrypt(credJSON)
		if err != nil {
			return nil, err
		}
		account.EncryptedCredentials = encryptedCreds
		account.CredentialsNonce = nonce
		// Invalidate cached adapter
		s.adapterPool.InvalidateAdapter(id)
	}
	if req.BucketName != nil {
		account.BucketName = req.BucketName
	}
	if req.Region != nil {
		account.Region = req.Region
	}
	if req.EndpointURL != nil {
		account.EndpointURL = req.EndpointURL
	}
	if req.PublicURLBase != nil {
		account.PublicURLBase = req.PublicURLBase
	}
	if req.IsDefault != nil {
		account.IsDefault = *req.IsDefault
	}
	if req.IsActive != nil {
		account.IsActive = *req.IsActive
	}
	if req.IsPublic != nil {
		account.IsPublic = *req.IsPublic
	}
	if req.MaxFileSizeMB != nil {
		account.MaxFileSizeMB = *req.MaxFileSizeMB
	}
	if len(req.AllowedTypes) > 0 {
		account.AllowedTypes = req.AllowedTypes
	}

	if err := s.repo.UpdateStorageAccount(ctx, account); err != nil {
		return nil, err
	}

	return account, nil
}

// DeleteStorageAccount soft deletes a storage account and its associated media
func (s *StorageService) DeleteStorageAccount(ctx context.Context, id uuid.UUID) error {
	// 1. Get the account
	account, err := s.repo.GetStorageAccountByID(ctx, id)
	if err != nil {
		return ErrStorageNotFound
	}

	// 2. Get the adapter
	adapter, err := s.adapterPool.GetAdapter(ctx, account)
	if err == nil {
		// 3. Get all media for this account
		media, _, err := s.repo.ListMedia(ctx, &models.MediaFilterRequest{StorageAccountID: id.String()})
		if err == nil {
			for _, m := range media {
				// Delete each file from cloud
				_ = adapter.Delete(ctx, m.StorageKey)
				_ = s.repo.SoftDeleteMedia(ctx, m.ID)
			}
		}
	}

	s.adapterPool.InvalidateAdapter(id)
	return s.repo.SoftDeleteStorageAccount(ctx, id)
}

// TestStorageConnection tests the connection to a storage account
func (s *StorageService) TestStorageConnection(ctx context.Context, id uuid.UUID) error {
	account, err := s.repo.GetStorageAccountByID(ctx, id)
	if err != nil {
		return ErrStorageNotFound
	}

	adapter, err := s.adapterPool.GetAdapter(ctx, account)
	if err != nil {
		return err
	}

	// Try to list files to test connection
	_, err = adapter.List(ctx, "", 1, "")
	return err
}

// GroupService handles media group operations
type GroupService struct {
	repo *repository.Repository
}

// NewGroupService creates a new group service
func NewGroupService(repo *repository.Repository) *GroupService {
	return &GroupService{repo: repo}
}

// CreateMediaGroup creates a new media group
func (s *GroupService) CreateMediaGroup(ctx context.Context, req *models.CreateMediaGroupRequest, employeeID uuid.UUID) (*models.MediaGroup, error) {
	group := &models.MediaGroup{
		Name:                    req.Name,
		Description:             req.Description,
		Color:                   req.Color,
		Icon:                    req.Icon,
		DefaultStorageAccountID: req.DefaultStorageAccountID,
		AllowedRoles:            req.AllowedRoles,
		CreatedBy:               employeeID,
	}

	if len(group.AllowedRoles) == 0 {
		group.AllowedRoles = []models.Role{
			models.RoleAdmin,
			models.RoleDeveloper,
			models.RoleMarketing,
		}
	}

	if err := s.repo.CreateMediaGroup(ctx, group); err != nil {
		return nil, err
	}

	return group, nil
}

// ListMediaGroups lists media groups accessible by the employee's role
func (s *GroupService) ListMediaGroups(ctx context.Context, role models.Role) ([]models.MediaGroup, error) {
	return s.repo.ListMediaGroups(ctx, role)
}

// GetMediaGroup gets a media group by ID
func (s *GroupService) GetMediaGroup(ctx context.Context, id uuid.UUID) (*models.MediaGroup, error) {
	return s.repo.GetMediaGroupByID(ctx, id)
}

// UpdateMediaGroup updates a media group
func (s *GroupService) UpdateMediaGroup(ctx context.Context, id uuid.UUID, req *models.UpdateMediaGroupRequest) (*models.MediaGroup, error) {
	group, err := s.repo.GetMediaGroupByID(ctx, id)
	if err != nil {
		return nil, ErrGroupNotFound
	}

	if req.Name != nil {
		group.Name = *req.Name
	}
	if req.Description != nil {
		group.Description = req.Description
	}
	if req.Color != nil {
		group.Color = *req.Color
	}
	if req.Icon != nil {
		group.Icon = *req.Icon
	}
	if req.DefaultStorageAccountID != nil {
		group.DefaultStorageAccountID = req.DefaultStorageAccountID
	}
	if len(req.AllowedRoles) > 0 {
		group.AllowedRoles = req.AllowedRoles
	}

	if err := s.repo.UpdateMediaGroup(ctx, group); err != nil {
		return nil, err
	}

	return group, nil
}

// DeleteMediaGroup soft deletes a media group
func (s *GroupService) DeleteMediaGroup(ctx context.Context, id uuid.UUID) error {
	return s.repo.SoftDeleteMediaGroup(ctx, id)
}
