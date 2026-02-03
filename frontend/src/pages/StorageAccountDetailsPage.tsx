import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    HardDrive,
    Cloud,
    Database,
    Archive,
    ArrowLeft,
    Image as ImageIcon,
    X,
    ChevronLeft,
    ChevronRight,
    Download,
    Trash2,
    Video,
    Music,
    FileText,
    Layers,
    Copy,
} from 'lucide-react';
import { storageApi, mediaApi } from '../api';
import type { StorageAccountWithStats, MediaWithDetails, ProviderType, MediaType } from '../types';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Pagination } from '../components/common/Pagination';
import { MediaCardSkeleton } from '../components/common/Skeleton';

const providerIcons: Record<ProviderType, typeof Cloud> = {
    cloudinary: Cloud,
    r2: Database,
    s3: HardDrive,
    b2: Archive,
};

const mediaTypeIcons: Record<string, typeof ImageIcon> = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    document: FileText,
    other: HardDrive,
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export default function StorageAccountDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState<MediaType | 'all'>('all');
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Queries
    const { data: account, isLoading: isAccountLoading, error: accountError } = useQuery<StorageAccountWithStats>({
        queryKey: ['storage-account', id],
        queryFn: () => storageApi.get(id!),
        enabled: !!id,
        retry: 1,
    });

    if (accountError) {
        toast.error('Failed to load storage account');
        navigate('/storage');
    }

    const { data: mediaResponse, isLoading: isMediaLoading } = useQuery({
        queryKey: ['media', id, activeTab, currentPage],
        queryFn: () => mediaApi.list({
            storage_account_id: id,
            media_type: activeTab === 'all' ? undefined : activeTab,
            page: currentPage,
            page_size: 50,
        }),
        enabled: !!id,
    });

    const media = mediaResponse?.data || [];
    const totalMedia = mediaResponse?.total || 0;

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (mediaId: string) => mediaApi.delete(mediaId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['media'] });
            queryClient.invalidateQueries({ queryKey: ['storage-account', id] });
            toast.success('Media deleted');
        },
    });

    const batchDeleteMutation = useMutation({
        mutationFn: (ids: string[]) => mediaApi.batchDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['media'] });
            queryClient.invalidateQueries({ queryKey: ['storage-account', id] });
            setSelectedIds([]);
            toast.success('Batch deletion complete');
        },
    });

    // Handlers
    const handleDownload = async (item: MediaWithDetails) => {
        try {
            await mediaApi.download(item.id, item.original_filename);
            toast.success('Download started');
        } catch {
            toast.error('Download failed');
        }
    };

    const handleBatchDownload = async () => {
        if (selectedIds.length === 0) return;
        const toastId = toast.loading(`Preparing ZIP for ${selectedIds.length} items...`);
        try {
            await mediaApi.batchDownload(selectedIds);
            toast.success('Download started', { id: toastId });
        } catch {
            toast.error('Batch download failed', { id: toastId });
        }
    };

    const copyUrl = async (item: MediaWithDetails) => {
        try {
            const url = item.public_url || await mediaApi.getPublicUrl(item.id);
            await navigator.clipboard.writeText(url);
            toast.success('URL copied');
        } catch {
            toast.error('Failed to copy URL');
        }
    };

    const toggleSelection = (mediaId: string) => {
        setSelectedIds(prev =>
            prev.includes(mediaId) ? prev.filter(i => i !== mediaId) : [...prev, mediaId]
        );
    };

    const selectAll = useCallback(() => {
        if (selectedIds.length === media.length && media.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(media.map(m => m.id));
        }
    }, [media, selectedIds]);

    if (isAccountLoading || !account) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    const ProviderIcon = providerIcons[account.provider];
    const percentUsed = ((account.total_size_bytes ?? 0) / STORAGE_LIMIT_BYTES) * 100;
    const isLowStorage = percentUsed > 80;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/storage')}
                    className="flex items-center gap-2 text-neutral-500 hover:text-black transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Storage</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neutral-100 rounded-xl">
                        <ProviderIcon className="w-8 h-8 text-black" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-black">{account.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{account.provider}</span>
                            {account.is_default && (
                                <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Default</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mass Action Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-black text-white px-8 py-4 rounded-[2rem] flex items-center justify-between sticky top-4 z-40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <span className="text-lg font-black tracking-tighter">{selectedIds.length}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Items Selected</span>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <button onClick={() => setSelectedIds([])} className="text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors">Deselect all</button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleBatchDownload} className="px-8 py-3 bg-white hover:bg-neutral-100 text-black rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-all">
                            <Download className="w-4 h-4" />
                            Download ZIP
                        </button>
                        <button onClick={() => {
                            if (confirm(`Delete ${selectedIds.length} items?`)) batchDeleteMutation.mutate(selectedIds);
                        }} className="px-8 py-3 bg-red-500 hover:bg-red-600 rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                            <Trash2 className="w-4 h-4" />
                            Delete Permanent
                        </button>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">Storage Used</span>
                    <p className="text-3xl font-black">{formatBytes(account.total_size_bytes ?? 0)}</p>
                    <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={clsx("h-full rounded-full transition-all", isLowStorage ? 'bg-red-500' : 'bg-black')} style={{ width: `${Math.min(percentUsed, 100)}%` }} />
                    </div>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">Total Assets</span>
                    <p className="text-3xl font-black">{account.media_count ?? 0}</p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">Bucket Name</span>
                    <p className="text-xl font-black truncate" title={account.bucket_name || 'N/A'}>{account.bucket_name || 'N/A'}</p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">Status</span>
                    <div className="flex items-center gap-2">
                        <div className={clsx("w-3 h-3 rounded-full", account.is_active ? "bg-emerald-500" : "bg-neutral-300")} />
                        <span className="text-lg font-black">{account.is_active ? "Active" : "Inactive"}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1.5 rounded-[2rem] w-fit">
                {[
                    { id: 'all', label: 'All Files', icon: Layers },
                    { id: 'image', label: 'Images', icon: ImageIcon },
                    { id: 'video', label: 'Videos', icon: Video },
                    { id: 'audio', label: 'Audio', icon: Music },
                    { id: 'document', label: 'Documents', icon: FileText },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as MediaType | 'all'); setCurrentPage(1); }}
                            className={clsx("flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all", isActive ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black hover:bg-white/50")}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Gallery */}
            <div className="space-y-12">
                {isMediaLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-8">
                        {[...Array(12)].map((_, i) => <MediaCardSkeleton key={i} />)}
                    </div>
                ) : media.length === 0 ? (
                    <div className="text-center py-32 bg-neutral-50 rounded-[3rem] border border-dashed border-neutral-200">
                        <h3 className="text-2xl font-black text-black">No Assets Found</h3>
                    </div>
                ) : (
                    <div className="space-y-12">
                        <div className="flex items-center justify-between px-4">
                            <button onClick={selectAll} className={clsx("px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2", selectedIds.length === media.length && media.length > 0 ? "bg-black text-white border-black" : "bg-white text-neutral-500 border-neutral-200 hover:border-black hover:text-black")}>
                                <div className={clsx("w-4 h-4 rounded border flex items-center justify-center", selectedIds.length === media.length && media.length > 0 ? "border-white" : "border-neutral-300")}>
                                    {selectedIds.length === media.length && media.length > 0 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                Select All Assets
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {media.map((item, index) => {
                                const Icon = mediaTypeIcons[item.media_type] || HardDrive;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedMediaIndex(index)}
                                        className={clsx(
                                            "group relative aspect-square bg-white rounded-3xl border overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300",
                                            selectedIds.includes(item.id) ? "border-black ring-4 ring-black/5" : "border-neutral-200"
                                        )}
                                    >
                                        <div className="absolute top-3 right-3 z-30">
                                            <button onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }} className={clsx("w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center", selectedIds.includes(item.id) ? "bg-black border-black text-white" : "bg-white/80 backdrop-blur-sm border-neutral-200 opacity-0 group-hover:opacity-100")}>
                                                {selectedIds.includes(item.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </button>
                                        </div>
                                        {item.media_type === 'image' && (item.public_url || item.thumbnail_url) ? (
                                            <img src={item.public_url || item.thumbnail_url} alt={item.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50">
                                                <div className="p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm transition-all"><Icon className="w-10 h-10 text-neutral-400" /></div>
                                                <span className="text-[10px] font-black text-neutral-300 uppercase tracking-[0.2em] mt-4">{item.media_type}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <Pagination currentPage={currentPage} totalPages={Math.ceil(totalMedia / 50)} onPageChange={setCurrentPage} />
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {selectedMediaIndex !== null && media && media[selectedMediaIndex] && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col h-screen w-screen animate-in fade-in duration-300">
                    <div className="flex items-center justify-between p-8 z-50">
                        <div className="flex items-center gap-6 text-white text-xl font-black">{media[selectedMediaIndex].filename}</div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => handleDownload(media[selectedMediaIndex])} className="p-4 bg-white/10 rounded-2xl hover:bg-white text-white hover:text-black transition-all flex items-center gap-3">
                                <Download className="w-5 h-5" /> <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Download</span>
                            </button>
                            <button onClick={() => copyUrl(media[selectedMediaIndex])} className="p-4 bg-white/10 rounded-2xl hover:bg-white text-white hover:text-black transition-all flex items-center gap-3">
                                <Copy className="w-5 h-5" /> <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Copy Link</span>
                            </button>
                            <button onClick={() => { if (confirm('Delete media?')) deleteMutation.mutate(media[selectedMediaIndex].id); setSelectedMediaIndex(null); }} className="p-4 bg-white/10 rounded-2xl hover:bg-red-500 text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                            <button onClick={() => setSelectedMediaIndex(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-white text-white hover:text-black transition-all"><X className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-between px-12">
                        <button onClick={() => setSelectedMediaIndex((prev) => (prev! - 1 + media.length) % media.length)} className="p-6 rounded-full bg-white/5 hover:bg-white text-white hover:text-black transition-all"><ChevronLeft className="w-10 h-10" /></button>
                        <div className="flex-1 h-full flex items-center justify-center p-8">
                            {media[selectedMediaIndex].media_type === 'image' ? (
                                <img src={media[selectedMediaIndex].public_url} className="max-h-full max-w-full object-contain shadow-2xl rounded-xl" />
                            ) : media[selectedMediaIndex].media_type === 'video' ? (
                                <video src={media[selectedMediaIndex].public_url} controls className="max-h-full max-w-full" />
                            ) : (
                                <div className="text-center text-white/60">Preview Not Available</div>
                            )}
                        </div>
                        <button onClick={() => setSelectedMediaIndex((prev) => (prev! + 1) % media.length)} className="p-6 rounded-full bg-white/5 hover:bg-white text-white hover:text-black transition-all"><ChevronRight className="w-10 h-10" /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
