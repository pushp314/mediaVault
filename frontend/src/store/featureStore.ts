import { create } from 'zustand';
import axios from 'axios';

interface FeatureStore {
    flags: Record<string, boolean>;
    isLoading: boolean;
    fetchFlags: () => Promise<void>;
    isEnabled: (key: string) => boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const useFeatureStore = create<FeatureStore>((set, get) => ({
    flags: {},
    isLoading: false,
    fetchFlags: async () => {
        set({ isLoading: true });
        try {
            const response = await axios.get(`${API_URL}/config/features`);
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
