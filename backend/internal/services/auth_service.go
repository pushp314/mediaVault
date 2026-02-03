package services

import (
	"context"
	"errors"
	"time"

	"github.com/appnity/media-vault/internal/config"
	"github.com/appnity/media-vault/internal/crypto"
	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

// AuthService handles authentication
type AuthService struct {
	repo      *repository.Repository
	cfg       *config.Config
	encryptor *crypto.Encryptor
}

// NewAuthService creates a new auth service
func NewAuthService(repo *repository.Repository, cfg *config.Config, encryptor *crypto.Encryptor) *AuthService {
	return &AuthService{
		repo:      repo,
		cfg:       cfg,
		encryptor: encryptor,
	}
}

// JWTClaims represents the JWT claims
type JWTClaims struct {
	EmployeeID uuid.UUID   `json:"employee_id"`
	Email      string      `json:"email"`
	Role       models.Role `json:"role"`
	jwt.RegisteredClaims
}

// Login authenticates an employee and returns tokens
func (s *AuthService) Login(ctx context.Context, email, password string) (*models.AuthResponse, error) {
	employee, err := s.repo.GetEmployeeByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if !employee.IsActive {
		return nil, ErrAccountDisabled
	}

	if !crypto.CheckPassword(password, employee.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(employee)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(ctx, employee.ID)
	if err != nil {
		return nil, err
	}

	// Update last login
	s.repo.UpdateEmployeeLastLogin(ctx, employee.ID)

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.AccessTokenExpiry * 60),
		Employee:     *employee,
	}, nil
}

// RefreshTokens refreshes access and refresh tokens
func (s *AuthService) RefreshTokens(ctx context.Context, refreshToken string) (*models.AuthResponse, error) {
	// In a full implementation, you'd verify the hashed token from the database
	// _ = crypto.HashToken(refreshToken)

	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	employee, err := s.repo.GetEmployeeByID(ctx, claims.EmployeeID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if !employee.IsActive {
		return nil, ErrAccountDisabled
	}

	// Generate new tokens
	newAccessToken, err := s.generateAccessToken(employee)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.generateRefreshToken(ctx, employee.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int64(s.cfg.AccessTokenExpiry * 60),
		Employee:     *employee,
	}, nil
}

// ValidateToken validates an access token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.cfg.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// generateAccessToken creates a new access token
func (s *AuthService) generateAccessToken(employee *models.Employee) (string, error) {
	claims := JWTClaims{
		EmployeeID: employee.ID,
		Email:      employee.Email,
		Role:       employee.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.cfg.AccessTokenExpiry) * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   employee.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// generateRefreshToken creates a new refresh token
func (s *AuthService) generateRefreshToken(_ context.Context, employeeID uuid.UUID) (string, error) {
	claims := JWTClaims{
		EmployeeID: employeeID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.cfg.RefreshTokenExpiry) * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   employeeID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// CreateEmployee creates a new employee (admin only)
func (s *AuthService) CreateEmployee(ctx context.Context, req *models.CreateEmployeeRequest) (*models.Employee, error) {
	// Hash password
	passwordHash, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	employee := &models.Employee{
		Email:        req.Email,
		PasswordHash: passwordHash,
		FullName:     req.FullName,
		Role:         req.Role,
		IsActive:     true,
	}

	if err := s.repo.CreateEmployee(ctx, employee); err != nil {
		return nil, err
	}

	return employee, nil
}

// GetEmployee gets an employee by ID
func (s *AuthService) GetEmployee(ctx context.Context, id uuid.UUID) (*models.Employee, error) {
	return s.repo.GetEmployeeByID(ctx, id)
}

// ListEmployees lists all employees
func (s *AuthService) ListEmployees(ctx context.Context, page, pageSize int) (*models.PaginatedResponse[models.Employee], error) {
	employees, total, err := s.repo.ListEmployees(ctx, page, pageSize)
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &models.PaginatedResponse[models.Employee]{
		Data:       employees,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// UpdateEmployee updates an employee
func (s *AuthService) UpdateEmployee(ctx context.Context, id uuid.UUID, req *models.UpdateEmployeeRequest) (*models.Employee, error) {
	employee, err := s.repo.GetEmployeeByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.FullName != nil {
		employee.FullName = *req.FullName
	}
	if req.Role != nil {
		employee.Role = *req.Role
	}
	if req.IsActive != nil {
		employee.IsActive = *req.IsActive
	}
	if req.AvatarURL != nil {
		employee.AvatarURL = req.AvatarURL
	}

	if err := s.repo.UpdateEmployee(ctx, employee); err != nil {
		return nil, err
	}

	return employee, nil
}

// DeleteEmployee soft deletes an employee
func (s *AuthService) DeleteEmployee(ctx context.Context, id uuid.UUID) error {
	return s.repo.SoftDeleteEmployee(ctx, id)
}
