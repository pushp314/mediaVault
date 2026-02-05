import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import MediaPage from './pages/MediaPage';
import StorageAccountsPage from './pages/StorageAccountsPage';
import StorageAccountDetailsPage from './pages/StorageAccountDetailsPage';
import GroupsPage from './pages/GroupsPage';
import EmployeesPage from './pages/EmployeesPage';
import ActivityPage from './pages/ActivityPage';
import UploadPage from './pages/UploadPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const employee = useAuthStore((state) => state.employee);
    if (employee?.role !== 'admin') {
        return <Navigate to="/" />;
    }
    return <>{children}</>;
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30,    // 30 minutes
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

import { useFeatureStore } from './store/featureStore';

export default function App() {
    const fetchFlags = useFeatureStore((state) => state.fetchFlags);

    useEffect(() => {
        fetchFlags();
    }, [fetchFlags]);

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#ffffff',
                            color: '#000000',
                            border: '1px solid #f0f0f0',
                            borderRadius: '1.25rem',
                            fontSize: '14px',
                            fontWeight: '600',
                            padding: '16px 24px',
                            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                        },
                        success: {
                            iconTheme: {
                                primary: '#10b981',
                                secondary: '#ffffff',
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: '#ef4444',
                                secondary: '#ffffff',
                            },
                        },
                    }}
                />
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/"
                        element={
                            <PrivateRoute>
                                <DashboardLayout />
                            </PrivateRoute>
                        }
                    >
                        <Route index element={<MediaPage />} />
                        <Route path="upload" element={<UploadPage />} />
                        <Route path="storage" element={<StorageAccountsPage />} />
                        <Route path="storage/:id" element={<StorageAccountDetailsPage />} />
                        <Route path="groups" element={<GroupsPage />} />
                        <Route
                            path="employees"
                            element={
                                <AdminRoute>
                                    <EmployeesPage />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="activity"
                            element={
                                <AdminRoute>
                                    <ActivityPage />
                                </AdminRoute>
                            }
                        />
                    </Route>
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </BrowserRouter>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
