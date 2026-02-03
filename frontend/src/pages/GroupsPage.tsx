import { useState, useEffect } from 'react';
import {
    FolderOpen,
    Plus,
    Trash2,
    Edit2,
    X,
    Grid,
    Image as ImageIcon,
    Film,
    FileText,
    Globe,
    Star,
    Heart,
    Zap,
    Check,
    Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { groupApi, storageApi } from '../api';
import { useMediaStore } from '../store/mediaStore';
import { useAuthStore } from '../store/authStore';
import type { MediaGroup, StorageAccountWithStats } from '../types';
import { clsx } from 'clsx';

const iconOptions = [
    { name: 'folder', icon: FolderOpen },
    { name: 'image', icon: ImageIcon },
    { name: 'film', icon: Film },
    { name: 'file', icon: FileText },
    { name: 'globe', icon: Globe },
    { name: 'star', icon: Star },
    { name: 'heart', icon: Heart },
    { name: 'zap', icon: Zap },
];

const colorOptions = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#000000', // Black
];

export default function GroupsPage() {
    const { groups, setGroups } = useMediaStore();
    const [storageAccounts, setStorageAccounts] = useState<StorageAccountWithStats[]>([]);
    const employee = useAuthStore((state) => state.employee);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<MediaGroup | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('folder');
    const [color, setColor] = useState(colorOptions[0]);
    const [defaultStorage, setDefaultStorage] = useState('');

    const canManage = employee?.role === 'admin' || employee?.role === 'developer' || employee?.role === 'marketing';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [groupsData, accountsData] = await Promise.all([
                groupApi.list(),
                storageApi.list()
            ]);
            setGroups(groupsData || []);
            setStorageAccounts(accountsData || []);
        } catch (error) {
            toast.error('Failed to load groups data');
        } finally {
            setIsLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingGroup(null);
        setName('');
        setDescription('');
        setIcon('folder');
        setColor(colorOptions[0]);
        setDefaultStorage('');
        setIsModalOpen(true);
    };

    const openEditModal = (group: MediaGroup) => {
        setEditingGroup(group);
        setName(group.name);
        setDescription(group.description || '');
        setIcon(group.icon || 'folder');
        setColor(group.color || colorOptions[0]);
        setDefaultStorage(group.default_storage_account_id || '');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Please enter a group name');
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                name,
                description: description || undefined,
                color,
                icon,
                default_storage_account_id: defaultStorage || undefined,
            };

            if (editingGroup) {
                await groupApi.update(editingGroup.id, payload);
                toast.success('Group updated');
            } else {
                await groupApi.create(payload);
                toast.success('Group created');
            }

            loadData();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Group operation error:", error.response?.data);
            const msg = error.response?.data?.error || 'Operation failed';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteGroup = async (group: MediaGroup) => {
        if (!confirm(`Delete "${group.name}"? Media files in this group will NOT be deleted, but they will be removed from this group.`)) return;

        try {
            await groupApi.delete(group.id);
            toast.success('Group deleted');
            loadData();
        } catch {
            toast.error('Failed to delete group');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">Groups</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        Logical collections for your media library.
                    </p>
                </div>

                {canManage && (
                    <button
                        onClick={openCreateModal}
                        className="btn-primary rounded-2xl px-8"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Group
                    </button>
                )}
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="flex items-center justify-center py-40">
                    <Loader2 className="w-10 h-10 text-neutral-200 animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-32 bg-neutral-50 rounded-[3rem] border border-dashed border-neutral-200">
                    <div className="w-20 h-20 mx-auto bg-white rounded-3xl flex items-center justify-center mb-8 shadow-sm">
                        <Grid className="w-10 h-10 text-neutral-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-black mb-3">No groups established</h3>
                    <p className="text-neutral-500 text-sm font-medium max-w-xs mx-auto leading-relaxed">
                        Establish your first media group to start organizing assets for your projects.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {groups.map((group) => {
                        const IconComponent = iconOptions.find(i => i.name === group.icon)?.icon || FolderOpen;
                        return (
                            <div
                                key={group.id}
                                className="bg-white border border-neutral-200 p-8 rounded-[2.5rem] flex flex-col justify-between card-hover group"
                            >
                                <div className="space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-300"
                                            style={{ backgroundColor: group.color + '10', border: `1px solid ${group.color}20` }}
                                        >
                                            <IconComponent className="w-8 h-8" style={{ color: group.color }} />
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[120px]">
                                            {group.allowed_roles.map((role) => (
                                                <span key={role} className="text-[9px] font-black uppercase tracking-wider text-neutral-400 bg-neutral-50 px-2.5 py-1 rounded-lg border border-neutral-100">
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-black truncate">{group.name}</h3>
                                        <p className="text-sm font-medium text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
                                            {group.description || 'No description provided.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-neutral-50 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-1">Infrastructure</span>
                                        <span className="text-xs font-bold text-black border-l-2 pl-3" style={{ borderColor: group.color }}>
                                            {group.default_storage_account_id
                                                ? storageAccounts.find(a => a.id === group.default_storage_account_id)?.name || 'Custom'
                                                : 'System Global'
                                            }
                                        </span>
                                    </div>
                                    {canManage && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(group)}
                                                className="p-3 bg-neutral-50 text-neutral-400 rounded-xl hover:text-black hover:bg-neutral-100 transition-all border border-transparent hover:border-neutral-200"
                                                title="Modify Group"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteGroup(group)}
                                                className="p-3 bg-neutral-50 text-neutral-400 rounded-xl hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                                title="Delete Group"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Creation/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsModalOpen(false)} />

                    <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between px-10 py-8 border-b border-neutral-100">
                            <div>
                                <h2 className="text-3xl font-black text-black">
                                    {editingGroup ? 'Modify Group' : 'New Collection'}
                                </h2>
                                <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    Define a logical container for your media assets
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-neutral-50 rounded-2xl hover:bg-neutral-100 transition-all border border-neutral-100"
                            >
                                <X className="w-6 h-6 text-neutral-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto max-h-[75vh]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-10">
                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-neutral-400 uppercase tracking-[0.2em] pl-1">
                                            Identity & Label
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Website Hero Sections"
                                            className="input rounded-2xl h-14 font-bold"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-neutral-400 uppercase tracking-[0.2em] pl-1">
                                            Description (Optional)
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What assets will be managed here?"
                                            rows={4}
                                            className="input rounded-2xl resize-none p-4 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <div className="space-y-4">
                                        <label className="block text-xs font-black text-neutral-400 uppercase tracking-[0.2em] pl-1">
                                            Visual Palette
                                        </label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {colorOptions.map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setColor(c)}
                                                    className={clsx(
                                                        "w-full aspect-square rounded-xl transition-all relative flex items-center justify-center border-4",
                                                        color === c ? "border-black scale-105" : "border-transparent hover:scale-105"
                                                    )}
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {color === c && <Check className="w-5 h-5 text-white" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-xs font-black text-neutral-400 uppercase tracking-[0.2em] pl-1">
                                            Icon Signature
                                        </label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {iconOptions.map((opt) => {
                                                const OptIcon = opt.icon;
                                                return (
                                                    <button
                                                        key={opt.name}
                                                        type="button"
                                                        onClick={() => setIcon(opt.name)}
                                                        className={clsx(
                                                            "aspect-square rounded-xl flex items-center justify-center transition-all border-2",
                                                            icon === opt.name
                                                                ? "bg-black border-black text-white"
                                                                : "bg-neutral-50 border-neutral-100 text-neutral-400 hover:bg-neutral-100 hover:text-black"
                                                        )}
                                                    >
                                                        <OptIcon className="w-5 h-5" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-neutral-100">
                                <div className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                                            <Globe className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-black">Infrastructure Routing</h4>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Optional storage override</p>
                                        </div>
                                    </div>
                                    <select
                                        value={defaultStorage}
                                        onChange={(e) => setDefaultStorage(e.target.value)}
                                        className="input rounded-xl h-12 bg-white font-bold text-xs"
                                    >
                                        <option value="">Use System Global Provider</option>
                                        {storageAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.name} ({account.provider})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-3 text-[10px] text-neutral-400 font-medium leading-relaxed pl-1">
                                        Selecting a provider here will force all uploads in this group to that specific account. Leave as "Global" to use the primary system storage.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-5 bg-neutral-100 hover:bg-neutral-200 text-black rounded-[1.8rem] font-black uppercase tracking-widest transition-all"
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-5 bg-black hover:bg-black/90 text-white rounded-[1.8rem] font-black uppercase tracking-widest transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        editingGroup ? 'Commit Changes' : 'Initialize Group'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
