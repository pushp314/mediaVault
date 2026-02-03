import { create } from 'zustand';
import type { MediaWithDetails, MediaGroup, StorageAccountWithStats, MediaFilter } from '../types';

interface MediaState {
    // Media
    media: MediaWithDetails[];
    selectedMedia: MediaWithDetails | null;
    totalMedia: number;
    currentPage: number;
    isLoading: boolean;

    // Filters
    filters: MediaFilter;

    // Groups
    groups: MediaGroup[];
    selectedGroup: MediaGroup | null;

    // Storage Accounts
    storageAccounts: StorageAccountWithStats[];
    selectedStorageAccount: StorageAccountWithStats | null;

    // Upload
    isUploading: boolean;
    uploadProgress: number;

    // Actions
    setMedia: (media: MediaWithDetails[], total: number) => void;
    setSelectedMedia: (media: MediaWithDetails | null) => void;
    setIsLoading: (loading: boolean) => void;
    setFilters: (filters: Partial<MediaFilter>) => void;
    resetFilters: () => void;
    setGroups: (groups: MediaGroup[]) => void;
    setSelectedGroup: (group: MediaGroup | null) => void;
    setStorageAccounts: (accounts: StorageAccountWithStats[]) => void;
    setSelectedStorageAccount: (account: StorageAccountWithStats | null) => void;
    setIsUploading: (uploading: boolean) => void;
    setUploadProgress: (progress: number) => void;
}

const defaultFilters: MediaFilter = {
    page: 1,
    page_size: 50,
    sort_by: 'created_at',
    sort_order: 'desc',
};

export const useMediaStore = create<MediaState>((set) => ({
    // Initial state
    media: [],
    selectedMedia: null,
    totalMedia: 0,
    currentPage: 1,
    isLoading: false,
    filters: defaultFilters,
    groups: [],
    selectedGroup: null,
    storageAccounts: [],
    selectedStorageAccount: null,
    isUploading: false,
    uploadProgress: 0,

    // Actions
    setMedia: (media, total) => set({ media, totalMedia: total }),
    setSelectedMedia: (selectedMedia) => set({ selectedMedia }),
    setIsLoading: (isLoading) => set({ isLoading }),

    setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters },
    })),

    resetFilters: () => set({ filters: defaultFilters }),

    setGroups: (groups) => set({ groups }),
    setSelectedGroup: (selectedGroup) => set({
        selectedGroup,
        filters: selectedGroup
            ? { ...defaultFilters, media_group_id: selectedGroup.id }
            : defaultFilters,
    }),

    setStorageAccounts: (storageAccounts) => set({ storageAccounts }),
    setSelectedStorageAccount: (selectedStorageAccount) => set({
        selectedStorageAccount,
        filters: selectedStorageAccount
            ? { ...defaultFilters, storage_account_id: selectedStorageAccount.id }
            : defaultFilters,
    }),

    setIsUploading: (isUploading) => set({ isUploading }),
    setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}));
