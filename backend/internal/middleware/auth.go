package middleware

import (
	"net/http"
	"strings"

	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/services"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware creates JWT authentication middleware
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: "Missing authorization header",
				Code:  "UNAUTHORIZED",
			})
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: "Invalid authorization header format",
				Code:  "UNAUTHORIZED",
			})
			return
		}

		token := parts[1]
		claims, err := authService.ValidateToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: "Invalid or expired token",
				Code:  "TOKEN_EXPIRED",
			})
			return
		}

		// Set claims in context
		c.Set("employee_id", claims.EmployeeID)
		c.Set("employee_email", claims.Email)
		c.Set("employee_role", claims.Role)

		c.Next()
	}
}

// RoleMiddleware checks if the user has one of the required roles
func RoleMiddleware(allowedRoles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("employee_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: "Authentication required",
				Code:  "UNAUTHORIZED",
			})
			return
		}

		role := roleVal.(models.Role)
		for _, allowed := range allowedRoles {
			if role == allowed {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
			Error: "Insufficient permissions",
			Code:  "FORBIDDEN",
		})
	}
}

// AdminOnly is a shortcut for admin-only routes
func AdminOnly() gin.HandlerFunc {
	return RoleMiddleware(models.RoleAdmin)
}

// DeveloperOrAdmin allows developers and admins
func DeveloperOrAdmin() gin.HandlerFunc {
	return RoleMiddleware(models.RoleAdmin, models.RoleDeveloper)
}

// AllExceptViewer allows all roles except viewers
func AllExceptViewer() gin.HandlerFunc {
	return RoleMiddleware(models.RoleAdmin, models.RoleDeveloper, models.RoleMarketing)
}

// RequestLogger logs request details
func RequestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return "" // Use default or custom logging
	})
}

// CORSMiddleware handles CORS
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
