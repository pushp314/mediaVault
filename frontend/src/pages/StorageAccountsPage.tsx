import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDown,
    Plus,
    X,
    Settings,
    HardDrive,
    Trash2,
    RefreshCw,
    Database,
    Archive,
    Cloud,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { storageApi } from '../api';
import { useMediaStore } from '../store/mediaStore';
import type { StorageAccountWithStats, ProviderType } from '../types';

const providerIcons: Record<ProviderType, typeof Cloud> = {
    cloudinary: Cloud,
    r2: Database,
    s3: HardDrive,
    b2: Archive,
};

/**
 * Extracts the Cloudflare R2 Account ID from a full endpoint URL if provided.
 * Example: https://<account_id>.r2.cloudflarestorage.com -> <account_id>
 */
const extractR2AccountId = (url: string): string => {
    if (!url) return '';
    try {
        // Handle full URL input
        if (url.startsWith('http')) {
            const match = url.match(/https:\/\/([a-z0-9]+)\.r2\.cloudflarestorage\.com/i);
            if (match && match[1]) return match[1];

            // If it doesn't match the standard pattern but is a URL, just return it as is
            // as the backend handles EndpointURL override anyway.
            return url;
        }
    } catch (e) {
        console.error('Failed to parse R2 Account ID from URL:', e);
    }
    return url;
};

export default function StorageAccountsPage() {
    const navigate = useNavigate();
    const { storageAccounts, setStorageAccounts } = useMediaStore();
    const [isLoading, setIsLoading] = useState(true);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<StorageAccountWithStats | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        provider: 's3' as ProviderType,
        bucket_name: '',
        region: '',
        endpoint_url: '',
        public_url_base: '',
        accessKeyId: '',
        secretAccessKey: '',
        is_default: false,
        is_public: false,
        max_file_size_mb: 100,
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        setIsLoading(true);
        try {
            const accounts = await storageApi.list();
            setStorageAccounts(accounts || []);
        } catch (error) {
            toast.error('Failed to load storage accounts');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (account: StorageAccountWithStats) => {
        setEditingAccount(account);
        setFormData({
            name: account.name,
            provider: account.provider,
            bucket_name: account.bucket_name || '',
            region: account.region || '',
            endpoint_url: account.endpoint_url || '',
            public_url_base: account.public_url_base || '',
            accessKeyId: '',
            secretAccessKey: '',
            is_default: account.is_default,
            is_public: account.is_public,
            max_file_size_mb: account.max_file_size_mb || 100,
        });
        setShowModal(true);
    };

    const handleOpenAddModal = () => {
        setEditingAccount(null);
        setFormData({
            name: '',
            provider: 's3',
            bucket_name: '',
            region: '',
            endpoint_url: '',
            public_url_base: '',
            accessKeyId: '',
            secretAccessKey: '',
            is_default: false,
            is_public: false,
            max_file_size_mb: 100,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const credentials: Record<string, string> = {};
            let hasCredentials = false;

            if (formData.accessKeyId || formData.secretAccessKey) {
                hasCredentials = true;
                if (formData.provider === 'cloudinary') {
                    credentials.cloud_name = formData.bucket_name;
                    credentials.api_key = formData.accessKeyId;
                    credentials.api_secret = formData.secretAccessKey;
                } else {
                    credentials.access_key_id = formData.accessKeyId;
                    credentials.secret_access_key = formData.secretAccessKey;

                    if (formData.region) credentials.region = formData.region;
                    if (formData.bucket_name) credentials.bucket_name = formData.bucket_name;

                    if (formData.provider === 'r2') {
                        credentials.account_id = extractR2AccountId(formData.endpoint_url);
                    }
                }
            }

            const payload: any = {
                name: formData.name,
                provider: formData.provider,
                bucket_name: formData.bucket_name || undefined,
                region: formData.region || undefined,
                endpoint_url: formData.endpoint_url || undefined,
                public_url_base: formData.public_url_base || undefined,
                is_default: formData.is_default,
                is_public: formData.is_public,
                max_file_size_mb: Number(formData.max_file_size_mb),
            };

            if (hasCredentials) {
                payload.credentials = credentials;
            }

            if (editingAccount) {
                await storageApi.update(editingAccount.id, payload);
                toast.success('Storage account updated');
            } else {
                if (!hasCredentials) {
                    toast.error('Credentials are required for new accounts');
                    setIsSaving(false);
                    return;
                }
                await storageApi.create(payload);
                toast.success('Storage node established successfully');
            }

            setShowModal(false);
            loadAccounts();
        } catch (error: any) {
            console.error('[StorageAccountsPage] Error saving storage account:', error);
            const errMsg = error.response?.data?.error || error.message || 'Failed to save storage account';
            const details = error.response?.data?.details;
            toast.error(details ? `${errMsg}: ${details}` : errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const testConnection = async (account: StorageAccountWithStats) => {
        setTestingId(account.id);
        try {
            await storageApi.test(account.id);
            toast.success(`Connection to ${account.name} successful`);
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Connection failed';
            toast.error(`${account.name}: ${msg}`);
        } finally {
            setTestingId(null);
        }
    };

    const syncAccount = async (account: StorageAccountWithStats) => {
        setSyncingId(account.id);
        const toastId = toast.loading(`Syncing ${account.name}...`);
        try {
            const result = await storageApi.sync(account.id);
            toast.success(`Sync complete: ${result.added_count} new files found`, { id: toastId });
            loadAccounts();
        } catch (error: any) {
            console.error('Sync failed:', error);
            const errMsg = error.response?.data?.error || 'Sync failed';
            toast.error(errMsg, { id: toastId });
        } finally {
            setSyncingId(null);
        }
    };

    const deleteAccount = async (account: StorageAccountWithStats) => {
        if (!confirm(`Are you sure you want to delete ${account.name}? This will PERMANENTLY remove the link to all ${account.media_count} files. Files in the cloud provider will not be deleted.`)) return;

        try {
            await storageApi.delete(account.id);
            toast.success('Storage account disconnected');
            loadAccounts();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete account');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-100 pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">Storage Accounts</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        Connect and manage your cloud storage buckets.
                    </p>
                </div>

                <button
                    onClick={handleOpenAddModal}
                    className="btn-primary"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                </button>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-10 h-10 text-neutral-300 animate-spin" />
                </div>
            )}

            {/* Empty State */}
            {!isLoading && storageAccounts.length === 0 && (
                <div className="text-center py-32 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                    <div className="w-20 h-20 mx-auto bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                        <HardDrive className="w-10 h-10 text-neutral-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-black mb-3">No storage connected</h3>
                    <p className="text-neutral-500 text-sm font-medium mb-10 max-w-[320px] mx-auto leading-relaxed">
                        Connect a cloud provider to start uploading and managing your media assets.
                    </p>
                    <button
                        onClick={handleOpenAddModal}
                        className="btn-secondary"
                    >
                        Connect Your First Provider
                    </button>
                </div>
            )}

            {/* Storage Cards */}
            {!isLoading && storageAccounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {storageAccounts.map((account) => {
                        const Icon = providerIcons[account.provider];

                        return (
                            <div
                                key={account.id}
                                className="bg-white border border-neutral-200 rounded-3xl flex flex-col group card-hover overflow-hidden cursor-pointer"
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    navigate(`/storage/${account.id}`);
                                }}
                            >
                                <div className="p-8 pb-6">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center border border-neutral-100 group-hover:bg-black group-hover:border-black transition-colors duration-300">
                                            <Icon className="w-7 h-7 text-black group-hover:text-white transition-colors duration-300" />
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {account.is_default && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-black px-2.5 py-1 rounded-full">
                                                    Primary
                                                </span>
                                            )}
                                            {account.is_public && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-600 px-2.5 py-1 rounded-full">
                                                    Public
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                {account.provider}
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-black truncate mb-1">{account.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                            {account.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                <div className="px-8 space-y-6 flex-1">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Files</p>
                                            <p className="text-lg font-bold text-black">{account.media_count.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Storage</p>
                                            <p className="text-lg font-bold text-black">{formatBytes(account.total_size_bytes)}</p>
                                        </div>
                                    </div>

                                    <div className="pb-8 space-y-4">
                                        {account.bucket_name && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-neutral-400 uppercase tracking-widest">Bucket</span>
                                                <span className="font-bold text-black truncate max-w-[140px]">{account.bucket_name}</span>
                                            </div>
                                        )}
                                        {account.region && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-neutral-400 uppercase tracking-widest">Region</span>
                                                <span className="font-bold text-black">{account.region}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-neutral-400 uppercase tracking-widest">Max File Size</span>
                                            <span className="font-bold text-black">{account.max_file_size_mb} MB</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                                    <button
                                        onClick={() => testConnection(account)}
                                        disabled={testingId === account.id}
                                        className="text-xs font-bold text-neutral-500 hover:text-black transition-colors disabled:opacity-50"
                                    >
                                        {testingId === account.id ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button
                                        onClick={() => syncAccount(account)}
                                        disabled={syncingId === account.id}
                                        className="text-xs font-bold text-neutral-500 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-4"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${syncingId === account.id ? 'animate-spin' : ''}`} />
                                        {syncingId === account.id ? 'Syncing...' : 'Sync'}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditClick(account)}
                                            className="p-2.5 bg-white border border-neutral-200 rounded-xl hover:border-black transition-all"
                                            title="Edit Storage Account"
                                        >
                                            <Settings className="w-4 h-4 text-black" />
                                        </button>
                                        <button
                                            onClick={() => deleteAccount(account)}
                                            className="p-2.5 bg-white border border-neutral-200 rounded-xl hover:border-red-600 hover:text-red-600 transition-all text-neutral-400"
                                            title="Delete Storage Account"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white border border-neutral-200 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 pb-4 flex items-center justify-between border-b border-neutral-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center border border-neutral-100">
                                    {editingAccount ? <Settings className="w-6 h-6 text-black" /> : <Plus className="w-6 h-6 text-black" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-black">
                                        {editingAccount ? 'Edit Storage Node' : 'Initialize Storage Node'}
                                    </h2>
                                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                        {editingAccount ? `Modifying: ${editingAccount.name}` : 'Establish a new cloud connection'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-neutral-50 border border-neutral-100 rounded-2xl hover:bg-neutral-100 transition-all">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-10">
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-black ml-1">General Identity</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Display Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="Production R2"
                                                    className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Max File Size (MB)</label>
                                                <input
                                                    required
                                                    type="number"
                                                    placeholder="100"
                                                    className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                    value={formData.max_file_size_mb}
                                                    onChange={e => setFormData({ ...formData, max_file_size_mb: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-black ml-1">Connectivity</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Provider Type</label>
                                                <div className="relative">
                                                    <select
                                                        disabled={!!editingAccount}
                                                        className="input appearance-none bg-neutral-50 border-neutral-100 hover:border-black transition-all disabled:opacity-50"
                                                        value={formData.provider}
                                                        onChange={e => setFormData({ ...formData, provider: e.target.value as ProviderType })}
                                                    >
                                                        <option value="s3">Amazon S3</option>
                                                        <option value="r2">Cloudflare R2</option>
                                                        <option value="b2">Backblaze B2</option>
                                                        <option value="cloudinary">Cloudinary</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                                    {formData.provider === 'cloudinary' ? 'Access Mode' : 'Region'}
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={formData.provider === 'cloudinary' ? 'Standard' : 'auto'}
                                                    className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                    value={formData.region}
                                                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                                                    disabled={formData.provider === 'cloudinary'}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100">
                                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1 mb-6">Preferences</h3>
                                        <div className="space-y-6">
                                            <label className="flex items-center gap-4 cursor-pointer group p-2">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={formData.is_default}
                                                        onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                                                    />
                                                    <div className={`w-12 h-7 rounded-full border-2 border-neutral-100 transition-colors duration-300 ${formData.is_default ? 'bg-black border-black' : 'bg-neutral-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${formData.is_default ? 'right-1 bg-white' : 'left-1 bg-neutral-400'}`} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-black transition-colors">Set as Default Primary</span>
                                                    <span className="text-[10px] text-neutral-400 font-medium tracking-tight">System-wide default choice for uploads</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-4 cursor-pointer group p-2">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={formData.is_public}
                                                        onChange={e => setFormData({ ...formData, is_public: e.target.checked })}
                                                    />
                                                    <div className={`w-12 h-7 rounded-full border-2 border-neutral-100 transition-colors duration-300 ${formData.is_public ? 'bg-emerald-600 border-emerald-600' : 'bg-neutral-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${formData.is_public ? 'right-1 bg-white' : 'left-1 bg-neutral-400'}`} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-black transition-colors">Public Access Permission</span>
                                                    <span className="text-[10px] text-neutral-400 font-medium tracking-tight">Allow unauthenticated public URL generation</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-black ml-1">Authentication Keys</h3>

                                        {formData.provider === 'cloudinary' ? (
                                            <div className="space-y-6">
                                                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 mb-2">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <AlertCircle className="w-4 h-4 text-blue-600" />
                                                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest pl-1">Configuration Note</h4>
                                                    </div>
                                                    <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
                                                        Cloudinary uses your <span className="text-blue-900 underline">Cloud Name</span> as a bucket. Find your API Key and Secret in the Cloudinary Console.
                                                    </p>
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Cloud Name</label>
                                                        <input
                                                            required={!editingAccount}
                                                            type="text"
                                                            placeholder="e.g. appnity-vault"
                                                            className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                            value={formData.bucket_name}
                                                            onChange={e => setFormData({ ...formData, bucket_name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">API Key</label>
                                                            <input
                                                                required={!editingAccount}
                                                                type="text"
                                                                className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                                value={formData.accessKeyId}
                                                                onChange={e => setFormData({ ...formData, accessKeyId: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">API Secret</label>
                                                            <input
                                                                required={!editingAccount}
                                                                type="password"
                                                                className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                                value={formData.secretAccessKey}
                                                                onChange={e => setFormData({ ...formData, secretAccessKey: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Bucket Name</label>
                                                    <input
                                                        required={!editingAccount}
                                                        type="text"
                                                        placeholder="e.g. my-media-bucket"
                                                        className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                        value={formData.bucket_name}
                                                        onChange={e => setFormData({ ...formData, bucket_name: e.target.value })}
                                                    />
                                                </div>

                                                {(formData.provider === 'r2' || formData.provider === 's3' || formData.provider === 'b2') && (
                                                    <div className="grid grid-cols-1 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                                                {formData.provider === 'r2' ? 'Endpoint URL (Required)' : 'Endpoint URL (Optional)'}
                                                            </label>
                                                            <input
                                                                required={formData.provider === 'r2'}
                                                                type="text"
                                                                placeholder={formData.provider === 'r2' ? 'https://<id>.r2.cloudflarestorage.com' : 'Only if using custom endpoint'}
                                                                className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                                value={formData.endpoint_url}
                                                                onChange={e => setFormData({ ...formData, endpoint_url: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Public URL Base (CDN)</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. https://cdn.example.com"
                                                                className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                                value={formData.public_url_base}
                                                                onChange={e => setFormData({ ...formData, public_url_base: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Access Key ID</label>
                                                        <input
                                                            required={!editingAccount}
                                                            type="text"
                                                            className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                            value={formData.accessKeyId}
                                                            onChange={e => setFormData({ ...formData, accessKeyId: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Secret Access Key</label>
                                                        <input
                                                            required={!editingAccount}
                                                            type="password"
                                                            className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                                            value={formData.secretAccessKey}
                                                            onChange={e => setFormData({ ...formData, secretAccessKey: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end pt-8 border-t border-neutral-100 mt-12 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-10 py-5 bg-neutral-50 text-neutral-500 font-bold uppercase tracking-widest text-xs rounded-[2rem] hover:bg-neutral-100 transition-all"
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 lg:flex-none px-20 py-5 bg-black text-white font-black uppercase tracking-[0.2em] text-xs rounded-[2rem] hover:bg-neutral-800 shadow-2xl transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Processing Evolution...' : (editingAccount ? 'Update Configuration' : 'Establish Network Node')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
