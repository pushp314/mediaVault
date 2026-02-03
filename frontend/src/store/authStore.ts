import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee, AuthResponse } from '../types';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    employee: Employee | null;
    isAuthenticated: boolean;
    setAuth: (auth: AuthResponse) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            employee: null,
            isAuthenticated: false,

            setAuth: (auth: AuthResponse) => {
                set({
                    accessToken: auth.access_token,
                    refreshToken: auth.refresh_token,
                    employee: auth.employee,
                    isAuthenticated: true,
                });
            },

            logout: () => {
                set({
                    accessToken: null,
                    refreshToken: null,
                    employee: null,
                    isAuthenticated: false,
                });
            },
        }),
        {
            name: 'media-vault-auth',
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                employee: state.employee,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
