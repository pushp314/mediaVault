package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/repository"
	"github.com/appnity/media-vault/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MediaHandler handles media endpoints
type MediaHandler struct {
	mediaService *services.MediaService
	repo         *repository.Repository
}

// NewMediaHandler creates a new media handler
func NewMediaHandler(mediaService *services.MediaService, repo *repository.Repository) *MediaHandler {
	return &MediaHandler{
		mediaService: mediaService,
		repo:         repo,
	}
}

// getEmployee retrieves the current employee from context
func (h *MediaHandler) getEmployee(c *gin.Context) (*models.Employee, error) {
	employeeID := c.MustGet("employee_id").(uuid.UUID)
	email := c.MustGet("employee_email").(string)
	role := c.MustGet("employee_role").(models.Role)

	return &models.Employee{
		ID:    employeeID,
		Email: email,
		Role:  role,
	}, nil
}

// InitiateUpload starts the upload process
// POST /api/media/upload/init
func (h *MediaHandler) InitiateUpload(c *gin.Context) {
	var req struct {
		Filename         string     `json:"filename" binding:"required"`
		ContentType      string     `json:"content_type" binding:"required"`
		FileSize         int64      `json:"file_size" binding:"required"`
		MediaGroupID     *uuid.UUID `json:"media_group_id"`
		FolderPath       string     `json:"folder_path"`
		StorageAccountID *uuid.UUID `json:"storage_account_id"`
		Tags             []string   `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[MediaHandler] InitiateUpload: JSON binding failed: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	log.Printf("[MediaHandler] InitiateUpload: filename=%s, content_type=%s, size=%d, storage_account_id=%v",
		req.Filename, req.ContentType, req.FileSize, req.StorageAccountID)

	employee, _ := h.getEmployee(c)

	uploadReq := &models.UploadMediaRequest{
		MediaGroupID:     req.MediaGroupID,
		FolderPath:       req.FolderPath,
		StorageAccountID: req.StorageAccountID,
		Tags:             req.Tags,
	}

	response, err := h.mediaService.InitiateUpload(
		c.Request.Context(),
		uploadReq,
		req.Filename,
		req.ContentType,
		req.FileSize,
		employee,
	)
	if err != nil {
		log.Printf("[MediaHandler] InitiateUpload: Service error: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   err.Error(),
			Code:    "UPLOAD_INIT_FAILED",
			Details: err.Error(),
		})
		return
	}

	log.Printf("[MediaHandler] InitiateUpload: Success, media_id=%s", response.MediaID)
	c.JSON(http.StatusOK, response)
}

// CompleteUpload finalizes the upload
// POST /api/media/upload/complete
func (h *MediaHandler) CompleteUpload(c *gin.Context) {
	var req models.UploadCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, _ := h.getEmployee(c)

	media, err := h.mediaService.CompleteUpload(c.Request.Context(), &req, employee)
	if err != nil {
		var status int
		switch err {
		case services.ErrMediaNotFound:
			status = http.StatusNotFound
		case services.ErrForbidden:
			status = http.StatusForbidden
		default:
			status = http.StatusBadRequest
		}
		c.JSON(status, models.ErrorResponse{
			Error: err.Error(),
			Code:  "UPLOAD_COMPLETE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, media)
}

// ListMedia lists media with filters
// GET /api/media
func (h *MediaHandler) ListMedia(c *gin.Context) {
	var filters models.MediaFilterRequest
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid query parameters",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, _ := h.getEmployee(c)

	response, err := h.mediaService.ListMedia(c.Request.Context(), &filters, employee)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to list media",
			Code:  "LIST_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetMedia gets a single media item
// GET /api/media/:id
func (h *MediaHandler) GetMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	media, err := h.mediaService.GetMedia(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Media not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, media)
}

// UpdateMedia updates media metadata
// PATCH /api/media/:id
func (h *MediaHandler) UpdateMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req models.UpdateMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	// Get current media
	media, err := h.mediaService.GetMedia(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Media not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	// Update fields
	if req.MediaGroupID != nil {
		media.MediaGroupID = req.MediaGroupID
	}
	if req.FolderID != nil {
		media.FolderID = req.FolderID
	}
	if req.Tags != nil {
		media.Tags = req.Tags
	}

	if err := h.repo.UpdateMedia(c.Request.Context(), &media.Media); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to update media",
			Code:  "UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, media)
}

// DeleteMedia soft deletes a media item
// DELETE /api/media/:id
func (h *MediaHandler) DeleteMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	employee, _ := h.getEmployee(c)

	if err := h.mediaService.DeleteMedia(c.Request.Context(), id, employee); err != nil {
		var status int
		var code string
		switch err {
		case services.ErrMediaNotFound:
			status = http.StatusNotFound
			code = "NOT_FOUND"
		case services.ErrForbidden:
			status = http.StatusForbidden
			code = "FORBIDDEN"
		default:
			status = http.StatusBadRequest
			code = "DELETE_FAILED"
		}
		c.JSON(status, models.ErrorResponse{
			Error: err.Error(),
			Code:  code,
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Media deleted successfully",
	})
}

// BatchDeleteMedia soft deletes multiple media items
// POST /api/media/batch-delete
func (h *MediaHandler) BatchDeleteMedia(c *gin.Context) {
	var req struct {
		IDs []uuid.UUID `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, _ := h.getEmployee(c)

	if err := h.mediaService.BatchDeleteMedia(c.Request.Context(), req.IDs, employee); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
			Code:  "BATCH_DELETE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Media items deleted successfully",
	})
}

// MoveMedia moves media to a different group/folder
// POST /api/media/:id/move
func (h *MediaHandler) MoveMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req models.MoveMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employee, _ := h.getEmployee(c)

	media, err := h.mediaService.MoveMedia(c.Request.Context(), id, &req, employee)
	if err != nil {
		var status int
		switch err {
		case services.ErrMediaNotFound:
			status = http.StatusNotFound
		case services.ErrForbidden:
			status = http.StatusForbidden
		default:
			status = http.StatusBadRequest
		}
		c.JSON(status, models.ErrorResponse{
			Error: err.Error(),
			Code:  "MOVE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, media)
}

// GetPublicURL gets the public URL for a media item
// GET /api/media/:id/url
func (h *MediaHandler) GetPublicURL(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	url, err := h.mediaService.GetPublicURL(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Media not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": url,
	})
}

// DownloadMedia downloads a media item
// GET /api/media/:id/download
func (h *MediaHandler) DownloadMedia(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid media ID",
			Code:  "INVALID_ID",
		})
		return
	}

	media, reader, err := h.mediaService.DownloadMedia(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Failed to download media",
			Code:  "DOWNLOAD_FAILED",
		})
		return
	}
	defer reader.Close()

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", media.OriginalFilename))
	c.Header("Content-Type", media.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", media.FileSizeBytes))

	if _, err := io.Copy(c.Writer, reader); err != nil {
		log.Printf("Failed to stream download: %v", err)
	}
}

// BatchDownloadMedia downloads multiple media items as a ZIP
// POST /api/media/batch-download
func (h *MediaHandler) BatchDownloadMedia(c *gin.Context) {
	var req struct {
		IDs []uuid.UUID `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=\"media_vault_export.zip\"")

	err := h.mediaService.BatchDownloadMedia(c.Request.Context(), req.IDs, c.Writer)
	if err != nil {
		log.Printf("Batch download failed: %v", err)
		// Header is already sent, so we can't send a JSON error
	}
}

// ListAuditLogs lists audit logs (admin only)
// GET /api/admin/audit-logs
func (h *MediaHandler) ListAuditLogs(c *gin.Context) {
	var filter models.AuditLogFilterRequest
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid query parameters",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 50
	}

	logs, total, err := h.repo.ListAuditLogs(c.Request.Context(), &filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to list audit logs",
			Code:  "LIST_FAILED",
		})
		return
	}

	totalPages := int(total) / filter.PageSize
	if int(total)%filter.PageSize > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, models.PaginatedResponse[models.AuditLog]{
		Data:       logs,
		Total:      total,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	})
}
