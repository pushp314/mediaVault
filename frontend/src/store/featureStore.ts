import { create } from 'zustand';
import api from '../api';

interface FeatureStore {
    flags: Record<string, boolean>;
    isLoading: boolean;
    fetchFlags: () => Promise<void>;
    isEnabled: (key: string) => boolean;
}

export const useFeatureStore = create<FeatureStore>((set, get) => ({
    flags: {},
    isLoading: false,
    fetchFlags: async () => {
        set({ isLoading: true });
        try {
            const response = await api.get('/config/features');
            set({ flags: response.data, isLoading: false });
        } catch (error) {
            console.error('Failed to fetch feature flags:', error);
            set({ isLoading: false });
        }
    },
    isEnabled: (key: string) => {
        return get().flags[key] ?? false;
    },
}));
