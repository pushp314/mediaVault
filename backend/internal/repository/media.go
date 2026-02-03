package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/appnity/media-vault/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ==========================================
// Media Group Methods
// ==========================================

// CreateMediaGroup creates a new media group
func (r *Repository) CreateMediaGroup(ctx context.Context, group *models.MediaGroup) error {
	query := `
		INSERT INTO media_groups (
			id, name, description, color, icon,
			default_storage_account_id, allowed_roles,
			created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7::role_type[], $8, $9, $10)
	`
	group.ID = uuid.New()
	group.CreatedAt = time.Now()
	group.UpdatedAt = time.Now()

	allowedRolesStr := make([]string, len(group.AllowedRoles))
	for i, r := range group.AllowedRoles {
		allowedRolesStr[i] = string(r)
	}

	_, err := r.db.Exec(ctx, query,
		group.ID, group.Name, group.Description, group.Color, group.Icon,
		group.DefaultStorageAccountID, allowedRolesStr,
		group.CreatedBy, group.CreatedAt, group.UpdatedAt,
	)
	return err
}

// GetMediaGroupByID retrieves a media group by ID
func (r *Repository) GetMediaGroupByID(ctx context.Context, id uuid.UUID) (*models.MediaGroup, error) {
	query := `
		SELECT id, name, description, color, icon,
			default_storage_account_id, allowed_roles::text[],
			created_by, created_at, updated_at
		FROM media_groups WHERE id = $1 AND deleted_at IS NULL
	`
	var group models.MediaGroup
	var allowedRolesStr []string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&group.ID, &group.Name, &group.Description, &group.Color, &group.Icon,
		&group.DefaultStorageAccountID, &allowedRolesStr,
		&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	group.AllowedRoles = make([]models.Role, len(allowedRolesStr))
	for i, s := range allowedRolesStr {
		group.AllowedRoles[i] = models.Role(s)
	}

	return &group, nil
}

// ListMediaGroups lists all media groups
func (r *Repository) ListMediaGroups(ctx context.Context, role models.Role) ([]models.MediaGroup, error) {
	query := `
		SELECT id, name, description, color, icon,
			default_storage_account_id, allowed_roles::text[],
			created_by, created_at, updated_at
		FROM media_groups 
		WHERE deleted_at IS NULL AND $1 = ANY(allowed_roles)
		ORDER BY name ASC
	`
	rows, err := r.db.Query(ctx, query, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.MediaGroup
	for rows.Next() {
		var group models.MediaGroup
		var allowedRolesStr []string
		if err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.Color, &group.Icon,
			&group.DefaultStorageAccountID, &allowedRolesStr,
			&group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
		); err != nil {
			return nil, err
		}

		group.AllowedRoles = make([]models.Role, len(allowedRolesStr))
		for i, s := range allowedRolesStr {
			group.AllowedRoles[i] = models.Role(s)
		}

		groups = append(groups, group)
	}
	return groups, nil
}

// UpdateMediaGroup updates a media group
func (r *Repository) UpdateMediaGroup(ctx context.Context, group *models.MediaGroup) error {
	query := `
		UPDATE media_groups SET
			name = $2, description = $3, color = $4, icon = $5,
			default_storage_account_id = $6, allowed_roles = $7::role_type[],
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	allowedRolesStr := make([]string, len(group.AllowedRoles))
	for i, r := range group.AllowedRoles {
		allowedRolesStr[i] = string(r)
	}

	_, err := r.db.Exec(ctx, query,
		group.ID, group.Name, group.Description, group.Color, group.Icon,
		group.DefaultStorageAccountID, allowedRolesStr,
	)
	return err
}

// SoftDeleteMediaGroup soft deletes a media group
func (r *Repository) SoftDeleteMediaGroup(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE media_groups SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ==========================================
// Media Methods
// ==========================================

// CreateMedia creates a new media record
func (r *Repository) CreateMedia(ctx context.Context, media *models.Media) error {
	query := `
		INSERT INTO media (
			id, storage_account_id, folder_id, media_group_id,
			filename, original_filename, storage_key,
			media_type, mime_type, file_size_bytes,
			width, height, duration_seconds,
			public_url, thumbnail_url, provider_id, provider_metadata,
			tags, uploaded_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`
	media.ID = uuid.New()
	media.CreatedAt = time.Now()
	media.UpdatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		media.ID, media.StorageAccountID, media.FolderID, media.MediaGroupID,
		media.Filename, media.OriginalFilename, media.StorageKey,
		media.MediaType, media.MimeType, media.FileSizeBytes,
		media.Width, media.Height, media.DurationSeconds,
		media.PublicURL, media.ThumbnailURL, media.ProviderID, media.ProviderMetadata,
		media.Tags, media.UploadedBy, media.CreatedAt, media.UpdatedAt,
	)
	return err
}

// CheckMediaExists checks if media with storage key exists for account
func (r *Repository) CheckMediaExists(ctx context.Context, storageAccountID uuid.UUID, storageKey string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM media WHERE storage_account_id = $1 AND storage_key = $2 AND deleted_at IS NULL)`
	var exists bool
	err := r.db.QueryRow(ctx, query, storageAccountID, storageKey).Scan(&exists)
	return exists, err
}

// GetMediaByID retrieves media by ID
func (r *Repository) GetMediaByID(ctx context.Context, id uuid.UUID) (*models.MediaWithDetails, error) {
	query := `
		SELECT 
			m.id, m.storage_account_id, m.folder_id, m.media_group_id,
			m.filename, m.original_filename, m.storage_key,
			m.media_type, m.mime_type, m.file_size_bytes,
			m.width, m.height, m.duration_seconds,
			m.public_url, m.thumbnail_url, m.provider_id, m.provider_metadata,
			m.tags, m.uploaded_by, m.last_accessed_at, m.download_count,
			m.created_at, m.updated_at,
			sa.name as storage_account_name, sa.provider as storage_provider,
			mg.name as group_name, mg.color as group_color,
			e.full_name as uploaded_by_name, e.email as uploaded_by_email,
			f.path as folder_path
		FROM media m
		LEFT JOIN storage_accounts sa ON m.storage_account_id = sa.id
		LEFT JOIN media_groups mg ON m.media_group_id = mg.id
		LEFT JOIN employees e ON m.uploaded_by = e.id
		LEFT JOIN folders f ON m.folder_id = f.id
		WHERE m.id = $1 AND m.deleted_at IS NULL
	`
	var media models.MediaWithDetails
	err := r.db.QueryRow(ctx, query, id).Scan(
		&media.ID, &media.StorageAccountID, &media.FolderID, &media.MediaGroupID,
		&media.Filename, &media.OriginalFilename, &media.StorageKey,
		&media.MediaType, &media.MimeType, &media.FileSizeBytes,
		&media.Width, &media.Height, &media.DurationSeconds,
		&media.PublicURL, &media.ThumbnailURL, &media.ProviderID, &media.ProviderMetadata,
		&media.Tags, &media.UploadedBy, &media.LastAccessedAt, &media.DownloadCount,
		&media.CreatedAt, &media.UpdatedAt,
		&media.StorageAccountName, &media.StorageProvider,
		&media.GroupName, &media.GroupColor,
		&media.UploadedByName, &media.UploadedByEmail,
		&media.FolderPath,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &media, err
}

// ListMedia lists media with filters
func (r *Repository) ListMedia(ctx context.Context, filters *models.MediaFilterRequest) ([]models.MediaWithDetails, int64, error) {
	// Build dynamic query
	conditions := []string{"m.deleted_at IS NULL"}
	args := []any{}
	argNum := 1

	if filters.StorageAccountID != "" {
		conditions = append(conditions, fmt.Sprintf("m.storage_account_id = $%d", argNum))
		args = append(args, filters.StorageAccountID)
		argNum++
	}
	if filters.MediaGroupID != "" {
		conditions = append(conditions, fmt.Sprintf("m.media_group_id = $%d", argNum))
		args = append(args, filters.MediaGroupID)
		argNum++
	}
	if filters.FolderID != "" {
		conditions = append(conditions, fmt.Sprintf("m.folder_id = $%d", argNum))
		args = append(args, filters.FolderID)
		argNum++
	}
	if filters.MediaType != nil {
		conditions = append(conditions, fmt.Sprintf("m.media_type = $%d", argNum))
		args = append(args, *filters.MediaType)
		argNum++
	}
	if filters.UploadedBy != "" {
		conditions = append(conditions, fmt.Sprintf("m.uploaded_by = $%d", argNum))
		args = append(args, filters.UploadedBy)
		argNum++
	}
	if filters.MinSize != nil {
		conditions = append(conditions, fmt.Sprintf("m.file_size_bytes >= $%d", argNum))
		args = append(args, *filters.MinSize)
		argNum++
	}
	if filters.MaxSize != nil {
		conditions = append(conditions, fmt.Sprintf("m.file_size_bytes <= $%d", argNum))
		args = append(args, *filters.MaxSize)
		argNum++
	}
	if filters.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"to_tsvector('english', COALESCE(m.filename, '') || ' ' || COALESCE(m.original_filename, '')) @@ plainto_tsquery('english', $%d)",
			argNum,
		))
		args = append(args, filters.Search)
		argNum++
	}
	if len(filters.Tags) > 0 {
		conditions = append(conditions, fmt.Sprintf("m.tags && $%d", argNum))
		args = append(args, filters.Tags)
		argNum++
	}

	whereClause := strings.Join(conditions, " AND ")

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM media m WHERE %s", whereClause)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Validate sort
	validSorts := map[string]bool{
		"created_at": true, "filename": true, "file_size_bytes": true, "updated_at": true,
	}
	sortBy := "created_at"
	if validSorts[filters.SortBy] {
		sortBy = filters.SortBy
	}
	sortOrder := "DESC"
	if strings.ToUpper(filters.SortOrder) == "ASC" {
		sortOrder = "ASC"
	}

	// Main query with pagination
	offset := (filters.Page - 1) * filters.PageSize
	query := fmt.Sprintf(`
		SELECT 
			m.id, m.storage_account_id, m.folder_id, m.media_group_id,
			m.filename, m.original_filename, m.storage_key,
			m.media_type, m.mime_type, m.file_size_bytes,
			m.width, m.height, m.duration_seconds,
			m.public_url, m.thumbnail_url, m.provider_id, m.provider_metadata,
			m.tags, m.uploaded_by, m.last_accessed_at, m.download_count,
			m.created_at, m.updated_at,
			COALESCE(sa.name, '') as storage_account_name, 
			COALESCE(sa.provider::text, '') as storage_provider,
			mg.name as group_name, mg.color as group_color,
			COALESCE(e.full_name, '') as uploaded_by_name, 
			COALESCE(e.email, '') as uploaded_by_email,
			f.path as folder_path
		FROM media m
		LEFT JOIN storage_accounts sa ON m.storage_account_id = sa.id
		LEFT JOIN media_groups mg ON m.media_group_id = mg.id
		LEFT JOIN employees e ON m.uploaded_by = e.id
		LEFT JOIN folders f ON m.folder_id = f.id
		WHERE %s
		ORDER BY m.%s %s
		LIMIT $%d OFFSET $%d
	`, whereClause, sortBy, sortOrder, argNum, argNum+1)
	args = append(args, filters.PageSize, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	mediaList := make([]models.MediaWithDetails, 0)
	for rows.Next() {
		var media models.MediaWithDetails
		if err := rows.Scan(
			&media.ID, &media.StorageAccountID, &media.FolderID, &media.MediaGroupID,
			&media.Filename, &media.OriginalFilename, &media.StorageKey,
			&media.MediaType, &media.MimeType, &media.FileSizeBytes,
			&media.Width, &media.Height, &media.DurationSeconds,
			&media.PublicURL, &media.ThumbnailURL, &media.ProviderID, &media.ProviderMetadata,
			&media.Tags, &media.UploadedBy, &media.LastAccessedAt, &media.DownloadCount,
			&media.CreatedAt, &media.UpdatedAt,
			&media.StorageAccountName, &media.StorageProvider,
			&media.GroupName, &media.GroupColor,
			&media.UploadedByName, &media.UploadedByEmail,
			&media.FolderPath,
		); err != nil {
			return nil, 0, err
		}
		mediaList = append(mediaList, media)
	}
	return mediaList, total, nil
}

// UpdateMedia updates media metadata
func (r *Repository) UpdateMedia(ctx context.Context, media *models.Media) error {
	query := `
		UPDATE media SET
			media_group_id = $2, folder_id = $3, tags = $4,
			public_url = $5, thumbnail_url = $6, storage_key = $7,
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query,
		media.ID, media.MediaGroupID, media.FolderID, media.Tags,
		media.PublicURL, media.ThumbnailURL, media.StorageKey,
	)
	return err
}

// SoftDeleteMedia soft deletes media
func (r *Repository) SoftDeleteMedia(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE media SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// IncrementDownloadCount increments the download counter
func (r *Repository) IncrementDownloadCount(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE media SET download_count = download_count + 1, last_accessed_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ==========================================
// Audit Log Methods
// ==========================================

// CreateAuditLog creates an audit log entry
func (r *Repository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	query := `
		INSERT INTO audit_logs (id, employee_id, employee_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	log.ID = uuid.New()
	log.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		log.ID, log.EmployeeID, log.EmployeeEmail, log.Action, log.ResourceType,
		log.ResourceID, log.Details, log.IPAddress, log.UserAgent, log.CreatedAt,
	)
	return err
}

// ListAuditLogs lists audit logs with pagination
func (r *Repository) ListAuditLogs(ctx context.Context, page, pageSize int, resourceType string, resourceID *uuid.UUID) ([]models.AuditLog, int64, error) {
	conditions := []string{}
	args := []any{}
	argNum := 1

	if resourceType != "" {
		conditions = append(conditions, fmt.Sprintf("resource_type = $%d", argNum))
		args = append(args, resourceType)
		argNum++
	}
	if resourceID != nil {
		conditions = append(conditions, fmt.Sprintf("resource_id = $%d", argNum))
		args = append(args, *resourceID)
		argNum++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", whereClause)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// List
	offset := (page - 1) * pageSize
	query := fmt.Sprintf(`
		SELECT id, employee_id, employee_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at
		FROM audit_logs %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argNum, argNum+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		if err := rows.Scan(
			&log.ID, &log.EmployeeID, &log.EmployeeEmail, &log.Action,
			&log.ResourceType, &log.ResourceID, &log.Details,
			&log.IPAddress, &log.UserAgent, &log.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}
	return logs, total, nil
}

// ==========================================
// Routing Rules Methods
// ==========================================

// GetActiveRoutingRules gets all active routing rules ordered by priority
func (r *Repository) GetActiveRoutingRules(ctx context.Context) ([]models.StorageRoutingRule, error) {
	query := `
		SELECT id, name, priority, media_group_id, media_type,
			min_file_size_bytes, max_file_size_bytes, mime_type_pattern,
			storage_account_id, target_folder_prefix, is_active,
			created_by, created_at, updated_at
		FROM storage_routing_rules
		WHERE is_active = true
		ORDER BY priority DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.StorageRoutingRule
	for rows.Next() {
		var rule models.StorageRoutingRule
		if err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Priority, &rule.MediaGroupID, &rule.MediaType,
			&rule.MinFileSizeBytes, &rule.MaxFileSizeBytes, &rule.MimeTypePattern,
			&rule.StorageAccountID, &rule.TargetFolderPfx, &rule.IsActive,
			&rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

// CreateRoutingRule creates a new routing rule
func (r *Repository) CreateRoutingRule(ctx context.Context, rule *models.StorageRoutingRule) error {
	query := `
		INSERT INTO storage_routing_rules (
			id, name, priority, media_group_id, media_type,
			min_file_size_bytes, max_file_size_bytes, mime_type_pattern,
			storage_account_id, target_folder_prefix, is_active,
			created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	rule.ID = uuid.New()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		rule.ID, rule.Name, rule.Priority, rule.MediaGroupID, rule.MediaType,
		rule.MinFileSizeBytes, rule.MaxFileSizeBytes, rule.MimeTypePattern,
		rule.StorageAccountID, rule.TargetFolderPfx, rule.IsActive,
		rule.CreatedBy, rule.CreatedAt, rule.UpdatedAt,
	)
	return err
}
