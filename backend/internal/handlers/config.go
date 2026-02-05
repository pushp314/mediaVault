package handlers

import (
	"net/http"

	"github.com/appnity/media-vault/internal/repository"
	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	repo *repository.Repository
}

func NewConfigHandler(repo *repository.Repository) *ConfigHandler {
	return &ConfigHandler{repo: repo}
}

// GetFeatureFlags handles GET /api/config/features
func (h *ConfigHandler) GetFeatureFlags(c *gin.Context) {
	flags, err := h.repo.ListFeatureFlags(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch feature flags"})
		return
	}
	c.JSON(http.StatusOK, flags)
}
