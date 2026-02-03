package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/appnity/media-vault/internal/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// B2Adapter implements StorageAdapter for Backblaze B2
// B2 is S3-compatible, so we use the AWS SDK
type B2Adapter struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucketName    string
	region        string
	publicURLBase string
}

// NewB2Adapter creates a new Backblaze B2 adapter
func NewB2Adapter(credJSON []byte, account *models.StorageAccount) (*B2Adapter, error) {
	var creds struct {
		KeyID          string `json:"key_id"`
		ApplicationKey string `json:"application_key"`
		Region         string `json:"region"`
		BucketName     string `json:"bucket_name"`
		Endpoint       string `json:"endpoint"`
	}
	if err := json.Unmarshal(credJSON, &creds); err != nil {
		return nil, ErrInvalidCredentials
	}

	region := creds.Region
	if account.Region != nil && *account.Region != "" {
		region = *account.Region
	}
	if region == "" {
		region = "us-west-002"
	}

	// B2 S3-compatible endpoint
	endpoint := creds.Endpoint
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://s3.%s.backblazeb2.com", region)
	}
	if account.EndpointURL != nil && *account.EndpointURL != "" {
		endpoint = *account.EndpointURL
	}

	cfg := aws.Config{
		Region: region,
		Credentials: credentials.NewStaticCredentialsProvider(
			creds.KeyID,
			creds.ApplicationKey,
			"",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	bucketName := creds.BucketName
	if account.BucketName != nil && *account.BucketName != "" {
		bucketName = *account.BucketName
	}

	// B2 friendly URL format
	publicURLBase := fmt.Sprintf("https://f%s.backblazeb2.com/file/%s", region[len(region)-3:], bucketName)
	if account.PublicURLBase != nil && *account.PublicURLBase != "" {
		publicURLBase = *account.PublicURLBase
	}

	return &B2Adapter{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucketName:    bucketName,
		region:        region,
		publicURLBase: publicURLBase,
	}, nil
}

func (a *B2Adapter) Provider() models.ProviderType {
	return models.ProviderB2
}

func (a *B2Adapter) Upload(ctx context.Context, input UploadInput) (*UploadResult, error) {
	putInput := &s3.PutObjectInput{
		Bucket:        aws.String(a.bucketName),
		Key:           aws.String(input.StorageKey),
		Body:          input.Reader,
		ContentType:   aws.String(input.ContentType),
		ContentLength: aws.Int64(input.ContentSize),
	}

	if len(input.Metadata) > 0 {
		putInput.Metadata = input.Metadata
	}

	result, err := a.client.PutObject(ctx, putInput)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUploadFailed, err)
	}

	publicURL := fmt.Sprintf("%s/%s", a.publicURLBase, input.StorageKey)

	return &UploadResult{
		StorageKey: input.StorageKey,
		PublicURL:  publicURL,
		ETag:       aws.ToString(result.ETag),
	}, nil
}

func (a *B2Adapter) GenerateSignedUploadURL(ctx context.Context, input SignedUploadInput) (*SignedUploadResult, error) {
	putInput := &s3.PutObjectInput{
		Bucket:      aws.String(a.bucketName),
		Key:         aws.String(input.StorageKey),
		ContentType: aws.String(input.ContentType),
	}

	presigned, err := a.presignClient.PresignPutObject(ctx, putInput, s3.WithPresignExpires(input.Expiry))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSignedURLFailed, err)
	}

	return &SignedUploadResult{
		UploadURL:  presigned.URL,
		Method:     presigned.Method,
		StorageKey: input.StorageKey,
		Headers: map[string]string{
			"Content-Type": input.ContentType,
		},
		ExpiresAt: time.Now().Add(input.Expiry),
	}, nil
}

func (a *B2Adapter) Download(ctx context.Context, storageKey string) (io.ReadCloser, error) {
	result, err := a.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFileNotFound, err)
	}
	return result.Body, nil
}

func (a *B2Adapter) Delete(ctx context.Context, storageKey string) error {
	_, err := a.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrDeleteFailed, err)
	}
	return nil
}

func (a *B2Adapter) Move(ctx context.Context, sourceKey, destinationKey string) error {
	// Copy then delete
	_, err := a.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(a.bucketName),
		CopySource: aws.String(fmt.Sprintf("%s/%s", a.bucketName, sourceKey)),
		Key:        aws.String(destinationKey),
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrMoveFailed, err)
	}

	return a.Delete(ctx, sourceKey)
}

func (a *B2Adapter) GetPublicURL(ctx context.Context, storageKey string) (string, error) {
	return fmt.Sprintf("%s/%s", a.publicURLBase, storageKey), nil
}

func (a *B2Adapter) GenerateSignedDownloadURL(ctx context.Context, storageKey string, expiry time.Duration) (string, error) {
	presigned, err := a.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(storageKey),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrSignedURLFailed, err)
	}
	return presigned.URL, nil
}

func (a *B2Adapter) List(ctx context.Context, prefix string, limit int, cursor string) (*ListResult, error) {
	input := &s3.ListObjectsV2Input{
		Bucket:  aws.String(a.bucketName),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int32(int32(limit)),
	}
	if cursor != "" {
		input.ContinuationToken = aws.String(cursor)
	}

	result, err := a.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrListFailed, err)
	}

	files := make([]FileInfo, len(result.Contents))
	for i, obj := range result.Contents {
		files[i] = FileInfo{
			StorageKey:   aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: aws.ToTime(obj.LastModified),
			ETag:         aws.ToString(obj.ETag),
		}
	}

	nextCursor := ""
	if result.NextContinuationToken != nil {
		nextCursor = *result.NextContinuationToken
	}

	return &ListResult{
		Files:      files,
		NextCursor: nextCursor,
		HasMore:    aws.ToBool(result.IsTruncated),
	}, nil
}

func (a *B2Adapter) Exists(ctx context.Context, storageKey string) (bool, error) {
	_, err := a.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return false, nil
	}
	return true, nil
}

func (a *B2Adapter) GetMetadata(ctx context.Context, storageKey string) (*FileMetadata, error) {
	result, err := a.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(a.bucketName),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFileNotFound, err)
	}

	return &FileMetadata{
		StorageKey:   storageKey,
		Size:         aws.ToInt64(result.ContentLength),
		ContentType:  aws.ToString(result.ContentType),
		LastModified: aws.ToTime(result.LastModified),
		ETag:         aws.ToString(result.ETag),
		Metadata:     result.Metadata,
	}, nil
}

func (a *B2Adapter) Close() error {
	return nil
}
