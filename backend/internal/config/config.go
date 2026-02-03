package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	// Server
	Port    string
	GinMode string

	// Database
	DatabaseURL string

	// Security
	JWTSecret          string
	EncryptionKey      []byte
	AccessTokenExpiry  int // minutes
	RefreshTokenExpiry int // days

	// Default Admin
	DefaultAdminEmail    string
	DefaultAdminPassword string
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	godotenv.Load()

	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if len(encryptionKey) != 32 {
		return nil, fmt.Errorf("ENCRYPTION_KEY must be exactly 32 bytes")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	cfg := &Config{
		Port:                 getEnvOrDefault("PORT", "8080"),
		GinMode:              getEnvOrDefault("GIN_MODE", "debug"),
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		JWTSecret:            jwtSecret,
		EncryptionKey:        []byte(encryptionKey),
		AccessTokenExpiry:    getEnvAsIntOrDefault("ACCESS_TOKEN_EXPIRY_MIN", 15),
		RefreshTokenExpiry:   getEnvAsIntOrDefault("REFRESH_TOKEN_EXPIRY_DAYS", 7),
		DefaultAdminEmail:    getEnvOrDefault("DEFAULT_ADMIN_EMAIL", "admin@company.com"),
		DefaultAdminPassword: os.Getenv("DEFAULT_ADMIN_PASSWORD"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
