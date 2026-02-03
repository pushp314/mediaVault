package storage

import "errors"

var (
	// ErrUnsupportedProvider is returned when an unknown provider is specified
	ErrUnsupportedProvider = errors.New("unsupported storage provider")

	// ErrInvalidCredentials is returned when credentials are invalid
	ErrInvalidCredentials = errors.New("invalid storage credentials")

	// ErrFileNotFound is returned when a file doesn't exist
	ErrFileNotFound = errors.New("file not found in storage")

	// ErrUploadFailed is returned when upload fails
	ErrUploadFailed = errors.New("failed to upload file to storage")

	// ErrDeleteFailed is returned when delete fails
	ErrDeleteFailed = errors.New("failed to delete file from storage")

	// ErrMoveFailed is returned when move/rename fails
	ErrMoveFailed = errors.New("failed to move file in storage")

	// ErrListFailed is returned when listing fails
	ErrListFailed = errors.New("failed to list files in storage")

	// ErrSignedURLFailed is returned when signed URL generation fails
	ErrSignedURLFailed = errors.New("failed to generate signed URL")

	// ErrFileTooLarge is returned when file exceeds max size
	ErrFileTooLarge = errors.New("file exceeds maximum allowed size")

	// ErrInvalidFileType is returned for disallowed file types
	ErrInvalidFileType = errors.New("file type not allowed")

	// ErrConnectionFailed is returned when can't connect to provider
	ErrConnectionFailed = errors.New("failed to connect to storage provider")
)
