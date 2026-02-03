// Mock API implementation for demo mode (no backend required)
import { mockEmployee, mockStorageAccounts, mockGroups, mockMedia, mockEmployees, mockAuditLogs } from './mockData';
import type { MediaFilter, AuthResponse, PaginatedResponse, MediaWithDetails, Employee } from '../types';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const DEMO_MODE = false;

export const mockAuthApi = {
    async login(email: string, password: string): Promise<AuthResponse> {
        await delay(500);
        if (email && password.length >= 4) {
            return {
                access_token: 'demo-token-' + Date.now(),
                refresh_token: 'demo-refresh-' + Date.now(),
                expires_in: 3600,
                employee: mockEmployee,
            };
        }
        throw { response: { data: { error: 'Invalid credentials' } } };
    },

    async refresh(): Promise<AuthResponse> {
        await delay(200);
        return {
            access_token: 'demo-token-' + Date.now(),
            refresh_token: 'demo-refresh-' + Date.now(),
            expires_in: 3600,
            employee: mockEmployee,
        };
    },

    async me(): Promise<Employee> {
        await delay(200);
        return mockEmployee;
    },

    async logout(): Promise<void> {
        await delay(100);
    },
};

export const mockMediaApi = {
    async list(filters?: MediaFilter): Promise<PaginatedResponse<MediaWithDetails>> {
        await delay(300);
        let filtered = [...mockMedia];

        if (filters?.media_type) {
            filtered = filtered.filter(m => m.media_type === filters.media_type);
        }
        if (filters?.media_group_id) {
            filtered = filtered.filter(m => m.media_group_id === filters.media_group_id);
        }
        if (filters?.storage_account_id) {
            filtered = filtered.filter(m => m.storage_account_id === filters.storage_account_id);
        }
        if (filters?.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(m => m.filename.toLowerCase().includes(search));
        }

        return {
            data: filtered,
            total: filtered.length,
            page: 1,
            page_size: 50,
            total_pages: 1,
        };
    },

    async getPublicUrl(id: string): Promise<string> {
        await delay(100);
        const media = mockMedia.find(m => m.id === id);
        return media?.public_url || '';
    },

    async delete(id: string): Promise<void> {
        await delay(300);
        const index = mockMedia.findIndex(m => m.id === id);
        if (index > -1) mockMedia.splice(index, 1);
    },
};

export const mockStorageApi = {
    async list() {
        await delay(300);
        return mockStorageAccounts;
    },

    async test(_id: string) {
        await delay(1000);
        // Simulate occasional failures
        if (Math.random() < 0.1) {
            throw new Error('Connection test failed');
        }
    },

    async delete(_id: string) {
        await delay(300);
    },
};

export const mockGroupApi = {
    async list() {
        await delay(200);
        return mockGroups;
    },

    async create(data: any) {
        await delay(300);
        const newGroup = { id: 'g-' + Date.now(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        mockGroups.push(newGroup);
        return newGroup;
    },

    async update(id: string, data: any) {
        await delay(300);
        const group = mockGroups.find(g => g.id === id);
        if (group) Object.assign(group, data);
        return group;
    },

    async delete(id: string) {
        await delay(300);
        const index = mockGroups.findIndex(g => g.id === id);
        if (index > -1) mockGroups.splice(index, 1);
    },
};

export const mockAdminApi = {
    async listEmployees() {
        await delay(300);
        return { data: mockEmployees, total: mockEmployees.length };
    },

    async createEmployee(data: any) {
        await delay(500);
        const newEmployee = { id: 'e-' + Date.now(), ...data, is_active: true, created_at: new Date().toISOString() };
        mockEmployees.push(newEmployee);
        return newEmployee;
    },

    async updateEmployee(id: string, data: any) {
        await delay(300);
        const emp = mockEmployees.find(e => e.id === id);
        if (emp) Object.assign(emp, data);
        return emp;
    },

    async deleteEmployee(id: string) {
        await delay(300);
        const index = mockEmployees.findIndex(e => e.id === id);
        if (index > -1) mockEmployees.splice(index, 1);
    },

    async getAuditLogs() {
        await delay(300);
        return { data: mockAuditLogs, total: mockAuditLogs.length };
    },
};
