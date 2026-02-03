package handlers

import (
	"log"
	"net/http"

	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles employee login
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid request body",
			Code:  "INVALID_REQUEST",
		})
		return
	}

	log.Printf("Login attempt for email: %s", req.Email)
	response, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		log.Printf("Login failed for email %s: %v", req.Email, err)
		status := http.StatusUnauthorized
		code := "INVALID_CREDENTIALS"
		if err == services.ErrAccountDisabled {
			code = "ACCOUNT_DISABLED"
		}
		c.JSON(status, models.ErrorResponse{
			Error: err.Error(),
			Code:  code,
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// RefreshToken handles token refresh
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid request body",
			Code:  "INVALID_REQUEST",
		})
		return
	}

	response, err := h.authService.RefreshTokens(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: "Invalid or expired refresh token",
			Code:  "INVALID_TOKEN",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetCurrentUser returns the current authenticated user
// GET /api/auth/me
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	employeeID := c.MustGet("employee_id").(uuid.UUID)

	employee, err := h.authService.GetEmployee(c.Request.Context(), employeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Employee not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, employee)
}

// CreateEmployee creates a new employee (admin only)
// POST /api/admin/employees
func (h *AuthHandler) CreateEmployee(c *gin.Context) {
	var req models.CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, err := h.authService.CreateEmployee(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "CREATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusCreated, employee)
}

// ListEmployees lists all employees (admin only)
// GET /api/admin/employees
func (h *AuthHandler) ListEmployees(c *gin.Context) {
	page := 1
	pageSize := 50

	if p := c.Query("page"); p != "" {
		if parsed, err := uuid.Parse(p); err == nil {
			_ = parsed // Use proper int parsing
		}
	}

	response, err := h.authService.ListEmployees(c.Request.Context(), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to list employees",
			Code:  "LIST_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetEmployee gets a specific employee (admin only)
// GET /api/admin/employees/:id
func (h *AuthHandler) GetEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid employee ID",
			Code:  "INVALID_ID",
		})
		return
	}

	employee, err := h.authService.GetEmployee(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Employee not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, employee)
}

// UpdateEmployee updates an employee (admin only)
// PATCH /api/admin/employees/:id
func (h *AuthHandler) UpdateEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid employee ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req models.UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, err := h.authService.UpdateEmployee(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, employee)
}

// DeleteEmployee soft deletes an employee (admin only)
// DELETE /api/admin/employees/:id
func (h *AuthHandler) DeleteEmployee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid employee ID",
			Code:  "INVALID_ID",
		})
		return
	}

	if err := h.authService.DeleteEmployee(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "DELETE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee deleted successfully",
	})
}
