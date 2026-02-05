package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/appnity/media-vault/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("record not found")
	ErrAlreadyExists = errors.New("record already exists")
	ErrDBOperation   = errors.New("database operation failed")
)

// Repository provides database access methods
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new repository
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ==========================================
// Employee Methods
// ==========================================

// CreateEmployee creates a new employee
func (r *Repository) CreateEmployee(ctx context.Context, emp *models.Employee) error {
	query := `
		INSERT INTO employees (id, email, password_hash, full_name, role, avatar_url, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	emp.ID = uuid.New()
	emp.CreatedAt = time.Now()
	emp.UpdatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		emp.ID, emp.Email, emp.PasswordHash, emp.FullName, emp.Role,
		emp.AvatarURL, emp.IsActive, emp.CreatedAt, emp.UpdatedAt,
	)
	return err
}

// GetEmployeeByID retrieves an employee by ID
func (r *Repository) GetEmployeeByID(ctx context.Context, id uuid.UUID) (*models.Employee, error) {
	query := `
		SELECT id, email, password_hash, full_name, role, avatar_url, is_active, last_login_at, created_at, updated_at
		FROM employees WHERE id = $1 AND deleted_at IS NULL
	`
	var emp models.Employee
	err := r.db.QueryRow(ctx, query, id).Scan(
		&emp.ID, &emp.Email, &emp.PasswordHash, &emp.FullName, &emp.Role,
		&emp.AvatarURL, &emp.IsActive, &emp.LastLoginAt, &emp.CreatedAt, &emp.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &emp, err
}

// GetEmployeeByEmail retrieves an employee by email
func (r *Repository) GetEmployeeByEmail(ctx context.Context, email string) (*models.Employee, error) {
	query := `
		SELECT id, email, password_hash, full_name, role, avatar_url, is_active, last_login_at, created_at, updated_at
		FROM employees WHERE email = $1 AND deleted_at IS NULL
	`
	var emp models.Employee
	err := r.db.QueryRow(ctx, query, email).Scan(
		&emp.ID, &emp.Email, &emp.PasswordHash, &emp.FullName, &emp.Role,
		&emp.AvatarURL, &emp.IsActive, &emp.LastLoginAt, &emp.CreatedAt, &emp.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &emp, err
}

// ListEmployees lists all active employees
func (r *Repository) ListEmployees(ctx context.Context, page, pageSize int) ([]models.Employee, int64, error) {
	countQuery := `SELECT COUNT(*) FROM employees WHERE deleted_at IS NULL`
	var total int64
	if err := r.db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, email, password_hash, full_name, role, avatar_url, is_active, last_login_at, created_at, updated_at
		FROM employees WHERE deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	offset := (page - 1) * pageSize
	rows, err := r.db.Query(ctx, query, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var emp models.Employee
		if err := rows.Scan(
			&emp.ID, &emp.Email, &emp.PasswordHash, &emp.FullName, &emp.Role,
			&emp.AvatarURL, &emp.IsActive, &emp.LastLoginAt, &emp.CreatedAt, &emp.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		employees = append(employees, emp)
	}
	return employees, total, nil
}

// UpdateEmployee updates an employee
func (r *Repository) UpdateEmployee(ctx context.Context, emp *models.Employee) error {
	query := `
		UPDATE employees 
		SET full_name = $2, role = $3, avatar_url = $4, is_active = $5, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query, emp.ID, emp.FullName, emp.Role, emp.AvatarURL, emp.IsActive)
	return err
}

// UpdateEmployeeLastLogin updates the last login timestamp
func (r *Repository) UpdateEmployeeLastLogin(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE employees SET last_login_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// SoftDeleteEmployee soft deletes an employee
func (r *Repository) SoftDeleteEmployee(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE employees SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ==========================================
// Storage Account Methods
// ==========================================

// CreateStorageAccount creates a new storage account
func (r *Repository) CreateStorageAccount(ctx context.Context, acc *models.StorageAccount) error {
	query := `
		INSERT INTO storage_accounts (
			id, name, provider, encrypted_credentials, credentials_nonce,
			bucket_name, region, endpoint_url, public_url_base,
			is_default, is_active, is_public, max_file_size_mb, allowed_types,
			created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::media_type[], $15, $16, $17)
	`
	acc.ID = uuid.New()
	acc.CreatedAt = time.Now()
	acc.UpdatedAt = time.Now()

	// Convert MediaType slice to string slice for PostgreSQL ENUM array
	allowedTypesStr := make([]string, len(acc.AllowedTypes))
	for i, t := range acc.AllowedTypes {
		allowedTypesStr[i] = string(t)
	}

	_, err := r.db.Exec(ctx, query,
		acc.ID, acc.Name, acc.Provider, acc.EncryptedCredentials, acc.CredentialsNonce,
		acc.BucketName, acc.Region, acc.EndpointURL, acc.PublicURLBase,
		acc.IsDefault, acc.IsActive, acc.IsPublic, acc.MaxFileSizeMB, allowedTypesStr,
		acc.CreatedBy, acc.CreatedAt, acc.UpdatedAt,
	)
	return err
}

// GetStorageAccountByID retrieves a storage account by ID
func (r *Repository) GetStorageAccountByID(ctx context.Context, id uuid.UUID) (*models.StorageAccount, error) {
	query := `
		SELECT id, name, provider, encrypted_credentials, credentials_nonce,
			bucket_name, region, endpoint_url, public_url_base,
			is_default, is_active, is_public, max_file_size_mb, allowed_types::text[],
			created_by, created_at, updated_at
		FROM storage_accounts WHERE id = $1 AND deleted_at IS NULL
	`
	var acc models.StorageAccount
	var allowedTypesStr []string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&acc.ID, &acc.Name, &acc.Provider, &acc.EncryptedCredentials, &acc.CredentialsNonce,
		&acc.BucketName, &acc.Region, &acc.EndpointURL, &acc.PublicURLBase,
		&acc.IsDefault, &acc.IsActive, &acc.IsPublic, &acc.MaxFileSizeMB, &allowedTypesStr,
		&acc.CreatedBy, &acc.CreatedAt, &acc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	// Convert string slice to MediaType slice
	acc.AllowedTypes = make([]models.MediaType, len(allowedTypesStr))
	for i, s := range allowedTypesStr {
		acc.AllowedTypes[i] = models.MediaType(s)
	}
	return &acc, nil
}

// GetStorageAccountWithStatsByID retrieves a storage account with usage stats
func (r *Repository) GetStorageAccountWithStatsByID(ctx context.Context, id uuid.UUID) (*models.StorageAccountWithStats, error) {
	query := `
		SELECT sa.id, sa.name, sa.provider, sa.encrypted_credentials, sa.credentials_nonce,
			sa.bucket_name, sa.region, sa.endpoint_url, sa.public_url_base,
			sa.is_default, sa.is_active, sa.is_public, sa.max_file_size_mb, sa.allowed_types::text[],
			sa.created_by, sa.created_at, sa.updated_at,
			COUNT(m.id) as media_count,
			COALESCE(SUM(m.file_size_bytes), 0) as total_size_bytes
		FROM storage_accounts sa
		LEFT JOIN media m ON sa.id = m.storage_account_id AND m.deleted_at IS NULL
		WHERE sa.id = $1 AND sa.deleted_at IS NULL
		GROUP BY sa.id
	`
	var acc models.StorageAccountWithStats
	var allowedTypesStr []string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&acc.ID, &acc.Name, &acc.Provider, &acc.EncryptedCredentials, &acc.CredentialsNonce,
		&acc.BucketName, &acc.Region, &acc.EndpointURL, &acc.PublicURLBase,
		&acc.IsDefault, &acc.IsActive, &acc.IsPublic, &acc.MaxFileSizeMB, &allowedTypesStr,
		&acc.CreatedBy, &acc.CreatedAt, &acc.UpdatedAt,
		&acc.MediaCount, &acc.TotalSizeBytes,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	acc.AllowedTypes = make([]models.MediaType, len(allowedTypesStr))
	for i, s := range allowedTypesStr {
		acc.AllowedTypes[i] = models.MediaType(s)
	}
	return &acc, nil
}

// ListStorageAccounts lists storage accounts, potentially filtered by owner and access
func (r *Repository) ListStorageAccounts(ctx context.Context, employeeID *uuid.UUID) ([]models.StorageAccountWithStats, error) {
	whereClause := "WHERE sa.deleted_at IS NULL"
	args := []any{}
	if employeeID != nil {
		whereClause += " AND (sa.created_by = $1 OR sa.is_public = true OR sa.id IN (SELECT storage_account_id FROM storage_account_access WHERE employee_id = $1))"
		args = append(args, *employeeID)
	}

	query := fmt.Sprintf(`
		SELECT 
			sa.id, sa.name, sa.provider, sa.encrypted_credentials, sa.credentials_nonce,
			sa.bucket_name, sa.region, sa.endpoint_url, sa.public_url_base,
			sa.is_default, sa.is_active, sa.is_public, sa.max_file_size_mb, sa.allowed_types::text[],
			sa.created_by, sa.created_at, sa.updated_at,
			COUNT(m.id) as media_count,
			COALESCE(SUM(m.file_size_bytes), 0) as total_size_bytes,
			MAX(m.created_at) as last_upload_at
		FROM storage_accounts sa
		LEFT JOIN media m ON sa.id = m.storage_account_id AND m.deleted_at IS NULL
		%s
		GROUP BY sa.id
		ORDER BY sa.created_at DESC
	`, whereClause)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.StorageAccountWithStats
	for rows.Next() {
		var acc models.StorageAccountWithStats
		var allowedTypesStr []string
		if err := rows.Scan(
			&acc.ID, &acc.Name, &acc.Provider, &acc.EncryptedCredentials, &acc.CredentialsNonce,
			&acc.BucketName, &acc.Region, &acc.EndpointURL, &acc.PublicURLBase,
			&acc.IsDefault, &acc.IsActive, &acc.IsPublic, &acc.MaxFileSizeMB, &allowedTypesStr,
			&acc.CreatedBy, &acc.CreatedAt, &acc.UpdatedAt,
			&acc.MediaCount, &acc.TotalSizeBytes, &acc.LastUploadAt,
		); err != nil {
			return nil, err
		}
		// Convert string slice to MediaType slice
		acc.AllowedTypes = make([]models.MediaType, len(allowedTypesStr))
		for i, s := range allowedTypesStr {
			acc.AllowedTypes[i] = models.MediaType(s)
		}
		accounts = append(accounts, acc)
	}
	return accounts, nil
}

// GrantStorageAccess grants an employee access to a storage account
func (r *Repository) GrantStorageAccess(ctx context.Context, accountID, employeeID uuid.UUID) error {
	query := `INSERT INTO storage_account_access (storage_account_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	_, err := r.db.Exec(ctx, query, accountID, employeeID)
	return err
}

// RevokeStorageAccess revokes an employee's access to a storage account
func (r *Repository) RevokeStorageAccess(ctx context.Context, accountID, employeeID uuid.UUID) error {
	query := `DELETE FROM storage_account_access WHERE storage_account_id = $1 AND employee_id = $2`
	_, err := r.db.Exec(ctx, query, accountID, employeeID)
	return err
}

// GetStorageAccountAccessList returns a list of employees with access to a storage account
func (r *Repository) GetStorageAccountAccessList(ctx context.Context, accountID uuid.UUID) ([]models.Employee, error) {
	query := `
		SELECT e.id, e.email, e.full_name, e.role, e.avatar_url, e.is_active, e.created_at, e.updated_at
		FROM employees e
		JOIN storage_account_access saa ON e.id = saa.employee_id
		WHERE saa.storage_account_id = $1 AND e.deleted_at IS NULL
	`
	rows, err := r.db.Query(ctx, query, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var emp models.Employee
		if err := rows.Scan(
			&emp.ID, &emp.Email, &emp.FullName, &emp.Role, &emp.AvatarURL, &emp.IsActive, &emp.CreatedAt, &emp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		employees = append(employees, emp)
	}
	return employees, nil
}

// GetDefaultStorageAccount gets the default storage account
func (r *Repository) GetDefaultStorageAccount(ctx context.Context) (*models.StorageAccount, error) {
	query := `
		SELECT id, name, provider, encrypted_credentials, credentials_nonce,
			bucket_name, region, endpoint_url, public_url_base,
			is_default, is_active, is_public, max_file_size_mb, allowed_types::text[],
			created_by, created_at, updated_at
		FROM storage_accounts WHERE is_default = true AND is_active = true AND deleted_at IS NULL
		LIMIT 1
	`
	var acc models.StorageAccount
	var allowedTypesStr []string
	err := r.db.QueryRow(ctx, query).Scan(
		&acc.ID, &acc.Name, &acc.Provider, &acc.EncryptedCredentials, &acc.CredentialsNonce,
		&acc.BucketName, &acc.Region, &acc.EndpointURL, &acc.PublicURLBase,
		&acc.IsDefault, &acc.IsActive, &acc.IsPublic, &acc.MaxFileSizeMB, &allowedTypesStr,
		&acc.CreatedBy, &acc.CreatedAt, &acc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	// Convert string slice to MediaType slice
	acc.AllowedTypes = make([]models.MediaType, len(allowedTypesStr))
	for i, s := range allowedTypesStr {
		acc.AllowedTypes[i] = models.MediaType(s)
	}
	return &acc, nil
}

// UpdateStorageAccount updates a storage account
func (r *Repository) UpdateStorageAccount(ctx context.Context, acc *models.StorageAccount) error {
	query := `
		UPDATE storage_accounts SET
			name = $2, encrypted_credentials = $3, credentials_nonce = $4,
			bucket_name = $5, region = $6, endpoint_url = $7, public_url_base = $8,
			is_default = $9, is_active = $10, is_public = $11, max_file_size_mb = $12, allowed_types = $13::media_type[],
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	// Convert MediaType slice to string slice for PostgreSQL ENUM array
	allowedTypesStr := make([]string, len(acc.AllowedTypes))
	for i, t := range acc.AllowedTypes {
		allowedTypesStr[i] = string(t)
	}

	_, err := r.db.Exec(ctx, query,
		acc.ID, acc.Name, acc.EncryptedCredentials, acc.CredentialsNonce,
		acc.BucketName, acc.Region, acc.EndpointURL, acc.PublicURLBase,
		acc.IsDefault, acc.IsActive, acc.IsPublic, acc.MaxFileSizeMB, allowedTypesStr,
	)
	return err
}

// SoftDeleteStorageAccount soft deletes a storage account
func (r *Repository) SoftDeleteStorageAccount(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE storage_accounts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
