// Types for the Media Vault API

export type Role = 'admin' | 'developer' | 'marketing' | 'viewer';
export type ProviderType = 'cloudinary' | 'r2' | 's3' | 'b2';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface Employee {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    avatar_url?: string;
    is_active: boolean;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}

export interface StorageAccount {
    id: string;
    name: string;
    provider: ProviderType;
    bucket_name?: string;
    region?: string;
    endpoint_url?: string;
    public_url_base?: string;
    is_default: boolean;
    is_active: boolean;
    max_file_size_mb: number;
    // Specific limits 
    max_image_size_mb?: number;
    max_video_size_mb?: number;
    max_raw_size_mb?: number;
    max_img_transformation_mb?: number;
    max_vid_transformation_mb?: number;
    max_img_megapixel?: number;
    max_total_megapixel?: number;

    allowed_types: MediaType[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unreachable';
export type RetentionPolicy = 'temporary' | 'project' | 'permanent';

export interface StorageAccountWithStats extends StorageAccount {
    media_count: number;
    total_size_bytes: number;
    last_upload_at?: string;
    // Health monitoring (from feedback)
    last_health_check?: string;
    health_status?: HealthStatus;
}

export interface MediaGroup {
    id: string;
    name: string;
    description?: string;
    color: string;
    icon: string;
    default_storage_account_id?: string;
    allowed_roles: Role[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface Media {
    id: string;
    storage_account_id: string;
    folder_id?: string;
    media_group_id?: string;
    filename: string;
    original_filename: string;
    storage_key: string;
    media_type: MediaType;
    mime_type: string;
    file_size_bytes: number;
    width?: number;
    height?: number;
    duration_seconds?: number;
    public_url?: string;
    thumbnail_url?: string;
    provider_id?: string;
    provider_metadata?: Record<string, unknown>;
    tags: string[];
    uploaded_by: string;
    last_accessed_at?: string;
    download_count: number;
    created_at: string;
    updated_at: string;
}

export interface MediaWithDetails extends Media {
    storage_account_name: string;
    storage_provider: string;
    group_name?: string;
    group_color?: string;
    uploader_name?: string;
    uploaded_by_name?: string;
    uploaded_by_email?: string;
    folder_path?: string;
    is_public?: boolean;
    // Retention policy (from feedback)
    retention_policy?: RetentionPolicy;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    employee: Employee;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface UploadResponse {
    media_id: string;
    upload_url: string;
    upload_method: string;
    storage_account_id: string;
    storage_key: string;
    expires_at: number;
    headers?: Record<string, string>;
    form_data?: Record<string, string>;
}

export interface SyncResult {
    added_count: number;
    skipped_count: number;
    errors?: string[];
}

export interface MediaFilter {
    storage_account_id?: string;
    media_group_id?: string;
    folder_id?: string;
    media_type?: MediaType;
    uploaded_by?: string;
    min_size?: number;
    max_size?: number;
    tags?: string[];
    search?: string;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export interface CreateMediaGroupRequest {
    name: string;
    description?: string;
    color: string;
    icon: string;
    default_storage_account_id?: string;
    allowed_roles?: Role[];
}

export interface CreateStorageAccountRequest {
    name: string;
    provider: ProviderType;
    credentials: Record<string, string>;
    bucket_name?: string;
    region?: string;
    endpoint_url?: string;
    public_url_base?: string;
    is_default?: boolean;
    max_file_size_mb?: number;
    allowed_types?: MediaType[];
}
