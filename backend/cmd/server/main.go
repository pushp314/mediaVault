package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/appnity/media-vault/internal/config"
	"github.com/appnity/media-vault/internal/crypto"
	"github.com/appnity/media-vault/internal/handlers"
	"github.com/appnity/media-vault/internal/middleware"
	"github.com/appnity/media-vault/internal/models"
	"github.com/appnity/media-vault/internal/repository"
	"github.com/appnity/media-vault/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Connect to database
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Test database connection
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database")

	// Initialize encryptor
	encryptor, err := crypto.NewEncryptor(cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("Failed to create encryptor: %v", err)
	}

	// Initialize repository
	repo := repository.NewRepository(pool)

	// Initialize services
	authService := services.NewAuthService(repo, cfg, encryptor)
	mediaService := services.NewMediaService(repo, encryptor)
	storageService := services.NewStorageService(repo, encryptor)
	groupService := services.NewGroupService(repo)

	// Create default admin if not exists
	createDefaultAdmin(repo, cfg)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	mediaHandler := handlers.NewMediaHandler(mediaService, repo)
	storageHandler := handlers.NewStorageHandler(storageService, mediaService)
	groupHandler := handlers.NewGroupHandler(groupService)

	// Setup router
	router := setupRouter(authService, authHandler, mediaHandler, storageHandler, groupHandler)

	// Create server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}

func setupRouter(
	authService *services.AuthService,
	authHandler *handlers.AuthHandler,
	mediaHandler *handlers.MediaHandler,
	storageHandler *handlers.StorageHandler,
	groupHandler *handlers.GroupHandler,
) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "media-vault"})
	})

	// API routes
	api := router.Group("/api")

	// Auth routes (public)
	auth := api.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
	}

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(authService))
	{
		// Current user
		protected.GET("/auth/me", authHandler.GetCurrentUser)

		// Media routes
		media := protected.Group("/media")
		{
			media.GET("", mediaHandler.ListMedia)
			media.GET("/:id", mediaHandler.GetMedia)
			media.GET("/:id/url", mediaHandler.GetPublicURL)
			media.GET("/:id/download", mediaHandler.DownloadMedia)
			media.POST("/batch-download", mediaHandler.BatchDownloadMedia)

			// Upload routes (require write access)
			upload := media.Group("")
			upload.Use(middleware.AllExceptViewer())
			{
				upload.POST("/upload/init", mediaHandler.InitiateUpload)
				upload.POST("/upload/complete", mediaHandler.CompleteUpload)
				upload.PATCH("/:id", mediaHandler.UpdateMedia)
				upload.POST("/:id/move", mediaHandler.MoveMedia)
				upload.DELETE("/:id", mediaHandler.DeleteMedia)
				upload.POST("/batch-delete", mediaHandler.BatchDeleteMedia)
			}
		}

		// Storage account routes
		storage := protected.Group("/storage-accounts")
		{
			storage.GET("", storageHandler.ListStorageAccounts)
			storage.GET("/:id", storageHandler.GetStorageAccount)
			storage.POST("", storageHandler.CreateStorageAccount)
			storage.PATCH("/:id", storageHandler.UpdateStorageAccount)
			storage.DELETE("/:id", storageHandler.DeleteStorageAccount)
			storage.POST("/:id/test", storageHandler.TestStorageConnection)
			storage.POST("/:id/sync", storageHandler.SyncStorageAccount)
		}

		// Media group routes
		groups := protected.Group("/groups")
		{
			groups.GET("", groupHandler.ListMediaGroups)
			groups.GET("/:id", groupHandler.GetMediaGroup)

			// Write operations
			groupWrite := groups.Group("")
			groupWrite.Use(middleware.DeveloperOrAdmin())
			{
				groupWrite.POST("", groupHandler.CreateMediaGroup)
				groupWrite.PATCH("/:id", groupHandler.UpdateMediaGroup)
				groupWrite.DELETE("/:id", groupHandler.DeleteMediaGroup)
			}
		}
	}

	// Admin routes
	admin := api.Group("/admin")
	admin.Use(middleware.AuthMiddleware(authService))
	admin.Use(middleware.AdminOnly())
	{
		// Employee management
		admin.POST("/employees", authHandler.CreateEmployee)
		admin.GET("/employees", authHandler.ListEmployees)
		admin.GET("/employees/:id", authHandler.GetEmployee)
		admin.PATCH("/employees/:id", authHandler.UpdateEmployee)
		admin.DELETE("/employees/:id", authHandler.DeleteEmployee)

		// Audit logs
		admin.GET("/audit-logs", mediaHandler.ListAuditLogs)
	}

	return router
}

func createDefaultAdmin(repo *repository.Repository, cfg *config.Config) {
	ctx := context.Background()

	// Check if admin exists
	_, err := repo.GetEmployeeByEmail(ctx, cfg.DefaultAdminEmail)
	if err == nil {
		// Admin already exists
		return
	}

	if cfg.DefaultAdminPassword == "" {
		log.Println("Warning: DEFAULT_ADMIN_PASSWORD not set, skipping default admin creation")
		return
	}

	// Create default admin
	passwordHash, err := crypto.HashPassword(cfg.DefaultAdminPassword)
	if err != nil {
		log.Printf("Failed to hash default admin password: %v", err)
		return
	}

	admin := &models.Employee{
		Email:        cfg.DefaultAdminEmail,
		PasswordHash: passwordHash,
		FullName:     "System Administrator",
		Role:         models.RoleAdmin,
		IsActive:     true,
	}

	if err := repo.CreateEmployee(ctx, admin); err != nil {
		log.Printf("Failed to create default admin: %v", err)
		return
	}

	log.Printf("Created default admin: %s", cfg.DefaultAdminEmail)
}
