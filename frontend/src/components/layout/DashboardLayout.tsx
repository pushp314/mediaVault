import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Image,
    FolderOpen,
    HardDrive,
    Users,
    LogOut,
    Menu,
    X,
    ChevronDown,
    Search,
    Plus,
    Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useMediaStore } from '../../store/mediaStore';
import { groupApi, storageApi } from '../../api';

const navigation = [
    { name: 'Media', href: '/', icon: Image },
    { name: 'Storage', href: '/storage', icon: HardDrive },
    { name: 'Groups', href: '/groups', icon: FolderOpen },
];

const adminNavigation = [
    { name: 'Employees', href: '/employees', icon: Users },
    { name: 'Activity', href: '/activity', icon: Activity },
];

export default function DashboardLayout() {
    const navigate = useNavigate();
    const { employee, logout } = useAuthStore();
    const { groups, setGroups, setStorageAccounts } = useMediaStore();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    useEffect(() => {
        // Load groups and storage accounts
        const loadData = async () => {
            try {
                const [groupsData, storageData] = await Promise.all([
                    groupApi.list(),
                    storageApi.list(),
                ]);
                setGroups(groupsData || []);
                setStorageAccounts(storageData || []);
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        };
        loadData();
    }, [setGroups, setStorageAccounts]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isAdmin = employee?.role === 'admin';

    return (
        <div className="min-h-screen bg-neutral-50 flex">
            {/* Sidebar - Desktop */}
            <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-white border-r border-neutral-100 shadow-sm">
                {/* Logo */}
                <div className="flex items-center h-20 px-8 border-b border-neutral-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-sm">
                            <Image className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-extrabold tracking-tight text-black">MediaVault</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
                    <div className="px-4 mb-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-5">
                        Main Menu
                    </div>
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            end={item.href === '/'}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-4 px-5 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200',
                                    isActive
                                        ? 'bg-black text-white shadow-lg'
                                        : 'text-neutral-500 hover:text-black hover:bg-neutral-50'
                                )
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </NavLink>
                    ))}

                    {/* Groups Section */}
                    <div className="pt-10">
                        <div className="px-4 mb-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-5">
                            Media Groups
                        </div>
                        <div className="space-y-1">
                            {groups.slice(0, 5).map((group) => (
                                <button
                                    key={group.id}
                                    onClick={() => navigate(`/?group=${group.id}`)}
                                    className="flex items-center gap-4 w-full px-5 py-3 text-sm font-semibold text-neutral-500 hover:text-black hover:bg-neutral-50 rounded-2xl transition-all"
                                >
                                    <div className="w-2 h-2 rounded-full bg-neutral-200" />
                                    <span className="truncate">{group.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="pt-10">
                            <div className="px-4 mb-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-5">
                                Administration
                            </div>
                            <div className="space-y-1">
                                {adminNavigation.map((item) => (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        className={({ isActive }) =>
                                            clsx(
                                                'flex items-center gap-4 px-5 py-3.5 text-sm font-bold rounded-2xl transition-all',
                                                isActive
                                                    ? 'bg-black text-white shadow-lg'
                                                    : 'text-neutral-500 hover:text-black hover:bg-neutral-50'
                                            )
                                        }
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.name === 'Employees' ? 'Team Members' : item.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-neutral-50">
                    <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-[2rem] border border-neutral-100 group">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-sm">
                            {employee?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-black truncate">
                                {employee?.full_name}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{employee?.role}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-400 hover:text-black hover:border-black transition-all shadow-sm"
                            title="Logout"
                        >
                            <LogOut className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Sidebar */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSidebarOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 w-80 bg-white border-r border-neutral-200 shadow-2xl overflow-y-auto">
                        <div className="flex items-center justify-between h-20 px-8 border-b border-neutral-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
                                    <Image className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-extrabold tracking-tight text-black">MediaVault</span>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-all"
                            >
                                <X className="w-6 h-6 text-neutral-500" />
                            </button>
                        </div>
                        <nav className="px-4 py-8 space-y-2">
                            {navigation.map((item) => (
                                <NavLink
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        clsx(
                                            'flex items-center gap-4 px-6 py-4 text-base font-bold rounded-2xl transition-all',
                                            isActive
                                                ? 'bg-black text-white shadow-xl'
                                                : 'text-neutral-500 hover:text-black hover:bg-neutral-50'
                                        )
                                    }
                                >
                                    <item.icon className="w-6 h-6" />
                                    {item.name}
                                </NavLink>
                            ))}
                        </nav>
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <div className="lg:pl-72 flex flex-col flex-1 min-w-0">
                {/* Top Bar */}
                <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
                    <div className="flex items-center justify-between h-20 px-4 lg:px-12">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-3 bg-white border border-neutral-200 rounded-xl shadow-sm text-black"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        {/* Search */}
                        <div className="flex-1 max-w-2xl mx-6 lg:mx-0">
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-black transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search library..."
                                    className="w-full pl-14 pr-6 py-3.5 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:bg-neutral-100 focus:ring-0 transition-all"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => navigate('/upload')}
                                className="btn-primary hidden sm:inline-flex px-10 rounded-2xl shadow-lg hover:shadow-xl py-3.5"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Upload
                            </button>


                            {/* User Menu (Mobile) */}
                            <div className="relative lg:hidden">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-3 bg-white border border-neutral-200 p-2 rounded-xl shadow-sm"
                                >
                                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                                        {employee?.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-neutral-400" />
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-4 w-56 bg-white rounded-3xl shadow-2xl py-3 border border-neutral-50 animate-in fade-in slide-in-from-top-4 duration-200">
                                        <div className="px-6 py-3 border-b border-neutral-50 mb-2">
                                            <p className="text-sm font-bold text-black">{employee?.full_name}</p>
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{employee?.role}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-3 w-full px-6 py-4 text-sm font-bold text-neutral-600 hover:text-black hover:bg-neutral-50 transition-all"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 lg:p-12 overflow-x-hidden min-h-screen">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
