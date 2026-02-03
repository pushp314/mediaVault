import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please enter email and password');
            return;
        }

        setIsLoading(true);

        try {
            const response = await authApi.login(email, password);
            setAuth(response);
            toast.success(`Welcome back, ${response.employee.full_name}!`);
            navigate('/');
        } catch (error: any) {
            const message = error.response?.data?.error || 'Login failed';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-10 sm:p-12 rounded-[3.5rem] shadow-2xl space-y-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-black text-white rounded-3xl shadow-lg mb-4">
                        <Lock className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">MediaVault</h1>
                    <p className="text-neutral-500 text-sm font-medium">Welcome back. Please login to your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input rounded-2xl"
                            placeholder="admin@appnity.co.in"
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                Password
                            </label>
                            <button type="button" className="text-xs font-bold text-black hover:underline transition-all">Forgot password?</button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input rounded-2xl"
                                placeholder="••••••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-5 flex items-center text-neutral-300 hover:text-black transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full py-5 text-sm font-bold tracking-wider rounded-3xl shadow-lg hover:shadow-xl transition-all"
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="pt-8 border-t border-neutral-100 flex flex-col items-center gap-6">
                    <p className="text-[11px] font-bold text-neutral-300 tracking-widest uppercase">
                        © 2026 Appnity Softwares Pvt. Ltd.
                    </p>
                    <div className="flex gap-3">
                        <span className="w-2 h-2 rounded-full bg-black shadow-sm"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-200"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-100"></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
