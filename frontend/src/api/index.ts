// =============================================================================
// API Layer - Demo Mode Enabled (No Backend Required)
// =============================================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { mockAuthApi, mockMediaApi, mockStorageApi, mockGroupApi, mockAdminApi, DEMO_MODE } from './mockApi';
import type {
    AuthResponse,
    Employee,
    MediaWithDetails,
    MediaGroup,
    StorageAccountWithStats,
    PaginatedResponse,
    MediaFilter,
    UploadResponse,
    CreateMediaGroupRequest,
    CreateStorageAccountRequest,
    SyncResult,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance (used when not in demo mode)
const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = useAuthStore.getState().refreshToken;
            if (refreshToken) {
                try {
                    const response = await axios.post<AuthResponse>(`${API_BASE}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });

                    useAuthStore.getState().setAuth(response.data);
                    originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
                    return api(originalRequest);
                } catch {
                    useAuthStore.getState().logout();
                }
            } else {
                useAuthStore.getState().logout();
            }
        }

        return Promise.reject(error);
    }
);

// =============================================================================
// Auth API
// =============================================================================
export const authApi = {
    login: async (email: string, password: string): Promise<AuthResponse> => {
        if (DEMO_MODE) return mockAuthApi.login(email, password);
        const response = await api.post<AuthResponse>('/auth/login', { email, password });
        return response.data;
    },

    refresh: async (refreshToken: string): Promise<AuthResponse> => {
        if (DEMO_MODE) return mockAuthApi.refresh();
        const response = await api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
        return response.data;
    },

    getCurrentUser: async (): Promise<Employee> => {
        if (DEMO_MODE) return mockAuthApi.me();
        const response = await api.get<Employee>('/auth/me');
        return response.data;
    },
};

// =============================================================================
// Media API
// =============================================================================
export const mediaApi = {
    list: async (filters: MediaFilter = {}): Promise<PaginatedResponse<MediaWithDetails>> => {
        if (DEMO_MODE) return mockMediaApi.list(filters);
        const response = await api.get<PaginatedResponse<MediaWithDetails>>('/media', { params: filters });
        return response.data;
    },

    get: async (id: string): Promise<MediaWithDetails> => {
        const response = await api.get<MediaWithDetails>(`/media/${id}`);
        return response.data;
    },

    initiateUpload: async (data: {
        filename: string;
        content_type: string;
        file_size: number;
        media_group_id?: string;
        folder_path?: string;
        storage_account_id?: string;
        tags?: string[];
    }): Promise<UploadResponse> => {
        const response = await api.post<UploadResponse>('/media/upload/init', data);
        return response.data;
    },

    completeUpload: async (data: {
        media_id: string;
        file_size_bytes: number;
        mime_type: string;
        width?: number;
        height?: number;
        duration_seconds?: number;
        public_url?: string;
    }): Promise<MediaWithDetails> => {
        const response = await api.post<MediaWithDetails>('/media/upload/complete', data);
        return response.data;
    },

    update: async (id: string, data: {
        media_group_id?: string;
        folder_id?: string;
        tags?: string[];
    }): Promise<MediaWithDetails> => {
        const response = await api.patch<MediaWithDetails>(`/media/${id}`, data);
        return response.data;
    },

    move: async (id: string, data: {
        media_group_id?: string;
        folder_path?: string;
        storage_account_id?: string;
    }): Promise<MediaWithDetails> => {
        const response = await api.post<MediaWithDetails>(`/media/${id}/move`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        if (DEMO_MODE) return mockMediaApi.delete(id);
        await api.delete(`/media/${id}`);
    },

    batchDelete: async (ids: string[]): Promise<void> => {
        if (DEMO_MODE) return;
        await api.post('/media/batch-delete', { ids });
    },

    getPublicUrl: async (id: string): Promise<string> => {
        if (DEMO_MODE) return mockMediaApi.getPublicUrl(id);
        const response = await api.get<{ url: string }>(`/media/${id}/url`);
        return response.data.url;
    },

    download: async (id: string, filename: string): Promise<void> => {
        if (DEMO_MODE) return;
        const response = await api.get(`/media/${id}/download`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    batchDownload: async (ids: string[]): Promise<void> => {
        if (DEMO_MODE) return;
        const response = await api.post('/media/batch-download', { ids }, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'media_vault_export.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
};

// =============================================================================
// Storage Account API
// =============================================================================
export const storageApi = {
    list: async (): Promise<StorageAccountWithStats[]> => {
        if (DEMO_MODE) return mockStorageApi.list();
        const response = await api.get<StorageAccountWithStats[]>('/storage-accounts');
        return response.data;
    },

    get: async (id: string): Promise<StorageAccountWithStats> => {
        const response = await api.get<StorageAccountWithStats>(`/storage-accounts/${id}`);
        return response.data;
    },

    create: async (data: CreateStorageAccountRequest): Promise<StorageAccountWithStats> => {
        const response = await api.post<StorageAccountWithStats>('/storage-accounts', data);
        return response.data;
    },

    update: async (id: string, data: Partial<CreateStorageAccountRequest>): Promise<StorageAccountWithStats> => {
        const response = await api.patch<StorageAccountWithStats>(`/storage-accounts/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        if (DEMO_MODE) return mockStorageApi.delete(id);
        await api.delete(`/storage-accounts/${id}`);
    },

    test: async (id: string): Promise<void> => {
        if (DEMO_MODE) return mockStorageApi.test(id);
        await api.post(`/storage-accounts/${id}/test`);
    },

    sync: async (id: string): Promise<SyncResult> => {
        const response = await api.post<SyncResult>(`/storage-accounts/${id}/sync`);
        return response.data;
    },

    getAccess: async (id: string): Promise<Employee[]> => {
        if (DEMO_MODE) return [];
        const response = await api.get<Employee[]>(`/storage-accounts/${id}/access`);
        return response.data;
    },

    grantAccess: async (id: string, employeeId: string): Promise<void> => {
        if (DEMO_MODE) return;
        await api.post(`/storage-accounts/${id}/access`, { employee_id: employeeId });
    },

    revokeAccess: async (id: string, employeeId: string): Promise<void> => {
        if (DEMO_MODE) return;
        await api.delete(`/storage-accounts/${id}/access/${employeeId}`);
    },
};

// =============================================================================
// Media Group API
// =============================================================================
export const groupApi = {
    list: async (): Promise<MediaGroup[]> => {
        if (DEMO_MODE) return mockGroupApi.list();
        const response = await api.get<MediaGroup[]>('/groups');
        return response.data;
    },

    get: async (id: string): Promise<MediaGroup> => {
        const response = await api.get<MediaGroup>(`/groups/${id}`);
        return response.data;
    },

    create: async (data: CreateMediaGroupRequest): Promise<MediaGroup> => {
        if (DEMO_MODE) return mockGroupApi.create(data);
        const response = await api.post<MediaGroup>('/groups', data);
        return response.data;
    },

    update: async (id: string, data: Partial<CreateMediaGroupRequest>): Promise<MediaGroup> => {
        if (DEMO_MODE) {
            const result = await mockGroupApi.update(id, data);
            if (!result) throw new Error('Group not found');
            return result;
        }
        const response = await api.patch<MediaGroup>(`/groups/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        if (DEMO_MODE) return mockGroupApi.delete(id);
        await api.delete(`/groups/${id}`);
    },
};

// =============================================================================
// Admin API
// =============================================================================
export const adminApi = {
    listEmployees: async (page = 1, pageSize = 50): Promise<PaginatedResponse<Employee>> => {
        if (DEMO_MODE) return mockAdminApi.listEmployees() as Promise<PaginatedResponse<Employee>>;
        const response = await api.get<PaginatedResponse<Employee>>('/admin/employees', {
            params: { page, page_size: pageSize },
        });
        return response.data;
    },

    createEmployee: async (data: {
        email: string;
        password: string;
        full_name: string;
        role: string;
    }): Promise<Employee> => {
        if (DEMO_MODE) return mockAdminApi.createEmployee(data);
        const response = await api.post<Employee>('/admin/employees', data);
        return response.data;
    },

    updateEmployee: async (id: string, data: {
        full_name?: string;
        role?: string;
        is_active?: boolean;
    }): Promise<Employee> => {
        if (DEMO_MODE) {
            const result = await mockAdminApi.updateEmployee(id, data);
            if (!result) throw new Error('Employee not found');
            return result;
        }
        const response = await api.patch<Employee>(`/admin/employees/${id}`, data);
        return response.data;
    },

    deleteEmployee: async (id: string): Promise<void> => {
        if (DEMO_MODE) return mockAdminApi.deleteEmployee(id);
        await api.delete(`/admin/employees/${id}`);
    },

    getAuditLogs: async (filters: any = {}): Promise<PaginatedResponse<any>> => {
        if (DEMO_MODE) return mockAdminApi.getAuditLogs();
        const response = await api.get<PaginatedResponse<any>>('/admin/audit-logs', { params: filters });
        return response.data;
    },
};

// Upload file directly to storage via signed URL
export const uploadToStorage = async (
    uploadUrl: string,
    file: File,
    method: string,
    headers?: Record<string, string>
): Promise<void> => {
    await axios({
        method: method as 'PUT' | 'POST',
        url: uploadUrl,
        data: file,
        headers: {
            'Content-Type': file.type,
            ...headers,
        },
    });
};

export default api;
