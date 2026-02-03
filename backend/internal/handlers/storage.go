package handlers

import (
	"log"
	"net/http"

	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StorageHandler handles storage account endpoints
type StorageHandler struct {
	storageService *services.StorageService
	mediaService   *services.MediaService
}

// NewStorageHandler creates a new storage handler
func NewStorageHandler(storageService *services.StorageService, mediaService *services.MediaService) *StorageHandler {
	return &StorageHandler{
		storageService: storageService,
		mediaService:   mediaService,
	}
}

// CreateStorageAccount creates a new storage account
// POST /api/admin/storage-accounts
func (h *StorageHandler) CreateStorageAccount(c *gin.Context) {
	var req models.CreateStorageAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[StorageHandler] CreateStorageAccount: JSON binding failed: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	log.Printf("[StorageHandler] CreateStorageAccount: Received request for provider=%s, name=%s", req.Provider, req.Name)

	employeeID := c.MustGet("employee_id").(uuid.UUID)

	account, err := h.storageService.CreateStorageAccount(c.Request.Context(), &req, employeeID)
	if err != nil {
		log.Printf("[StorageHandler] CreateStorageAccount: Service error: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   err.Error(),
			Code:    "CREATE_FAILED",
			Details: err.Error(),
		})
		return
	}

	log.Printf("[StorageHandler] CreateStorageAccount: Success, account_id=%s", account.ID)
	c.JSON(http.StatusCreated, account)
}

// ListStorageAccounts lists storage accounts
// GET /api/storage-accounts
func (h *StorageHandler) ListStorageAccounts(c *gin.Context) {
	employeeID := c.MustGet("employee_id").(uuid.UUID)
	role := c.MustGet("employee_role").(models.Role)

	accounts, err := h.storageService.ListStorageAccounts(c.Request.Context(), employeeID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to list storage accounts",
			Code:  "LIST_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, accounts)
}

// GetStorageAccount gets a storage account by ID
// GET /api/storage-accounts/:id
func (h *StorageHandler) GetStorageAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid storage account ID",
			Code:  "INVALID_ID",
		})
		return
	}

	account, err := h.storageService.GetStorageAccount(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Storage account not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, account)
}

// UpdateStorageAccount updates a storage account
// PATCH /api/admin/storage-accounts/:id
func (h *StorageHandler) UpdateStorageAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid storage account ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req models.UpdateStorageAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	account, err := h.storageService.UpdateStorageAccount(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, account)
}

// DeleteStorageAccount soft deletes a storage account
// DELETE /api/admin/storage-accounts/:id
func (h *StorageHandler) DeleteStorageAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid storage account ID",
			Code:  "INVALID_ID",
		})
		return
	}

	if err := h.storageService.DeleteStorageAccount(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "DELETE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Storage account deleted successfully",
	})
}

// TestStorageConnection tests the connection to a storage account
// POST /api/admin/storage-accounts/:id/test
func (h *StorageHandler) TestStorageConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid storage account ID",
			Code:  "INVALID_ID",
		})
		return
	}

	if err := h.storageService.TestStorageConnection(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Connection test failed",
			Code:    "CONNECTION_FAILED",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Connection successful",
	})
}

// SyncStorageAccount syncs files from the storage provider
// POST /api/storage-accounts/:id/sync
func (h *StorageHandler) SyncStorageAccount(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid storage account ID",
			Code:  "INVALID_ID",
		})
		return
	}

	employeeID := c.MustGet("employee_id").(uuid.UUID)

	result, err := h.mediaService.SyncStorageAccount(c.Request.Context(), id, employeeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
			Code:  "SYNC_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GroupHandler handles media group endpoints
type GroupHandler struct {
	groupService *services.GroupService
}

// NewGroupHandler creates a new group handler
func NewGroupHandler(groupService *services.GroupService) *GroupHandler {
	return &GroupHandler{groupService: groupService}
}

// CreateMediaGroup creates a new media group
// POST /api/groups
func (h *GroupHandler) CreateMediaGroup(c *gin.Context) {
	var req models.CreateMediaGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[GroupHandler] CreateMediaGroup: JSON binding failed: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	employeeID := c.MustGet("employee_id").(uuid.UUID)

	group, err := h.groupService.CreateMediaGroup(c.Request.Context(), &req, employeeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "CREATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusCreated, group)
}

// ListMediaGroups lists all media groups accessible by user's role
// GET /api/groups
func (h *GroupHandler) ListMediaGroups(c *gin.Context) {
	role := c.MustGet("employee_role").(models.Role)

	groups, err := h.groupService.ListMediaGroups(c.Request.Context(), role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to list media groups",
			Code:  "LIST_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// GetMediaGroup gets a media group by ID
// GET /api/groups/:id
func (h *GroupHandler) GetMediaGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid group ID",
			Code:  "INVALID_ID",
		})
		return
	}

	group, err := h.groupService.GetMediaGroup(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Media group not found",
			Code:  "NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, group)
}

// UpdateMediaGroup updates a media group
// PATCH /api/groups/:id
func (h *GroupHandler) UpdateMediaGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid group ID",
			Code:  "INVALID_ID",
		})
		return
	}

	var req models.UpdateMediaGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Code:    "INVALID_REQUEST",
			Details: err.Error(),
		})
		return
	}

	group, err := h.groupService.UpdateMediaGroup(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, group)
}

// DeleteMediaGroup soft deletes a media group
// DELETE /api/groups/:id
func (h *GroupHandler) DeleteMediaGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid group ID",
			Code:  "INVALID_ID",
		})
		return
	}

	if err := h.groupService.DeleteMediaGroup(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
			Code:  "DELETE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Media group deleted successfully",
	})
}
