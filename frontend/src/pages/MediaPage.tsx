import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Image,
    Video,
    FileText,
    File as FileIcon,
    Copy,
    Trash2,
    Filter,
    Grid3X3,
    List,
    X,
    ChevronLeft,
    ChevronRight,
    Download,
    Music,
    FolderPlus,
    Loader2,
    Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { mediaApi } from '../api';
import { useMediaStore } from '../store/mediaStore';
import type { MediaWithDetails, MediaType } from '../types';
import { Pagination } from '../components/common/Pagination';
import { MediaCardSkeleton } from '../components/common/Skeleton';

const mediaTypeIcons: Record<MediaType, typeof Image> = {
    image: Image,
    video: Video,
    audio: Music,
    document: FileText,
    other: FileIcon,
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Memoized Card Component for Performance
const MediaGridCard = memo(({
    item,
    index,
    isSelected,
    onSelect,
    onView,
    onCopy,
    onDelete,
    onDownload
}: {
    item: MediaWithDetails;
    index: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onView: (index: number) => void;
    onCopy: (item: MediaWithDetails) => void;
    onDelete: (item: MediaWithDetails) => void;
    onDownload: (item: MediaWithDetails) => void;
}) => {
    const Icon = mediaTypeIcons[item.media_type] || FileIcon;

    return (
        <div
            className={clsx(
                "group relative bg-white border rounded-[2rem] overflow-hidden cursor-pointer card-hover transition-all animate-in fade-in duration-500",
                isSelected ? "border-black ring-4 ring-black/5" : "border-neutral-200"
            )}
            onClick={() => onView(index)}
        >
            {/* Selection Checkbox */}
            <div className="absolute top-4 right-4 z-20">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item.id);
                    }}
                    className={clsx(
                        "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center shadow-md",
                        isSelected
                            ? "bg-black border-black text-white"
                            : "bg-white/90 backdrop-blur-sm border-neutral-200 opacity-0 group-hover:opacity-100"
                    )}
                >
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full scale-in-center" />}
                </button>
            </div>

            {/* Thumbnail */}
            <div className="aspect-square bg-neutral-50 flex items-center justify-center overflow-hidden border-b border-neutral-100">
                {item.media_type === 'image' && (item.thumbnail_url || item.public_url) ? (
                    <img
                        src={item.thumbnail_url || item.public_url}
                        alt={item.filename}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center border border-neutral-100 group-hover:bg-black group-hover:border-black transition-all duration-300 shadow-sm">
                            <Icon className="w-8 h-8 text-black group-hover:text-white transition-colors duration-300" />
                        </div>
                        <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{item.media_type}</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-6">
                <p className="text-sm font-black text-black truncate" title={item.filename}>
                    {item.filename}
                </p>
                <div className="flex items-center justify-between mt-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <span>{formatFileSize(item.file_size_bytes)}</span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {item.group_name && (
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: item.group_color || '#000' }}
                                title={item.group_name}
                            />
                        )}
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: false })}
                    </span>
                </div>
            </div>

            {/* Hover Actions */}
            <div className="absolute inset-x-4 bottom-24 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                <div className="bg-black/80 backdrop-blur-md rounded-2xl p-1.5 flex items-center justify-around shadow-2xl">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(item);
                        }}
                        className="p-3 text-white hover:bg-white/20 rounded-xl transition-colors"
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy(item);
                        }}
                        className="p-3 text-white hover:bg-white/20 rounded-xl transition-colors"
                        title="Copy URL"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item);
                        }}
                        className="p-3 text-red-400 hover:bg-red-400/20 rounded-xl transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Provider Badge */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur-sm text-black text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-sm border border-neutral-100 uppercase tracking-tight">
                    {item.storage_provider}
                </div>
                {item.group_name && (
                    <div
                        className="text-white text-[9px] font-black px-3 py-1 rounded-full shadow-sm border border-white/10 uppercase tracking-widest max-w-[100px] truncate"
                        style={{ backgroundColor: (item.group_color || '#000000') + 'CC' }}
                    >
                        {item.group_name}
                    </div>
                )}
            </div>
        </div>
    );
});

export default function MediaPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        filters,
        setFilters,
        groups,
        storageAccounts,
    } = useMediaStore();

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBatchGroupModal, setShowBatchGroupModal] = useState(false);
    const [batchTargetGroupId, setBatchTargetGroupId] = useState('');
    const [isBatchUpdating, setIsBatchUpdating] = useState(false);

    const queryClient = useQueryClient();

    // Queries
    const { data: mediaResponse, isLoading: isMediaLoading } = useQuery({
        queryKey: ['media', filters],
        queryFn: () => mediaApi.list(filters),
    });

    const media = mediaResponse?.data || [];
    const totalMedia = mediaResponse?.total || 0;

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) => mediaApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['media'] });
            toast.success('Media deleted');
        },
        onError: () => toast.error('Failed to delete media'),
    });

    const batchDeleteMutation = useMutation({
        mutationFn: (ids: string[]) => mediaApi.batchDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['media'] });
            setSelectedIds([]);
            toast.success('Batch deletion complete');
        },
        onError: () => toast.error('Batch deletion failed'),
    });

    useEffect(() => {
        const groupId = searchParams.get('group');
        if (groupId) {
            setFilters({ ...filters, media_group_id: groupId });
        }
    }, [searchParams]);

    // Handlers
    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }, []);

    const selectAll = useCallback(() => {
        if (selectedIds.length === media.length && media.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(media.map(m => m.id));
        }
    }, [media, selectedIds]);

    const handleBatchDelete = () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} items?`)) return;
        batchDeleteMutation.mutate(selectedIds);
    };

    const handleBatchGroupUpdate = async () => {
        if (!batchTargetGroupId || selectedIds.length === 0) return;

        setIsBatchUpdating(true);
        const toastId = toast.loading(`Moving ${selectedIds.length} items to ${groups.find(g => g.id === batchTargetGroupId)?.name || 'group'}...`);

        try {
            // Sequential updates as the backend doesn't have a batch endpoint for metadata yet
            await Promise.all(
                selectedIds.map(id => mediaApi.update(id, { media_group_id: batchTargetGroupId }))
            );

            queryClient.invalidateQueries({ queryKey: ['media'] });
            setSelectedIds([]);
            setShowBatchGroupModal(false);
            toast.success('Media organized successfully', { id: toastId });
        } catch (error) {
            toast.error('Failed to update group', { id: toastId });
        } finally {
            setIsBatchUpdating(false);
        }
    };

    const handleBatchDownload = async () => {
        if (selectedIds.length === 0) return;
        const toastId = toast.loading(`Preparing download for ${selectedIds.length} items...`);
        try {
            await mediaApi.batchDownload(selectedIds);
            toast.success('Download started', { id: toastId });
        } catch (error) {
            toast.error('Batch download failed', { id: toastId });
        }
    };

    const handleDownload = async (item: MediaWithDetails) => {
        try {
            await mediaApi.download(item.id, item.original_filename);
            toast.success('Download started');
        } catch (error) {
            toast.error('Download failed');
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

    const handleDelete = (item: MediaWithDetails) => {
        if (!confirm(`Delete ${item.filename}?`)) return;
        deleteMutation.mutate(item.id);
    };

    const clearFilters = () => {
        setFilters({
            page: 1,
            page_size: 50,
            sort_by: 'created_at',
            sort_order: 'desc',
        });
        setSearchParams({});
    };

    const hasActiveFilters = useMemo(() => !!(
        filters.storage_account_id ||
        filters.media_group_id ||
        filters.media_type ||
        filters.search
    ), [filters]);

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">Media Library</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        {totalMedia} {totalMedia === 1 ? 'asset' : 'assets'} across {storageAccounts.length} storage nodes
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-neutral-100 rounded-2xl p-1.5 border border-neutral-200">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={clsx(
                                'p-2.5 rounded-xl transition-all',
                                viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'
                            )}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                                'p-2.5 rounded-xl transition-all',
                                viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'
                            )}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={clsx(
                            'btn-secondary rounded-2xl relative px-6',
                            hasActiveFilters && 'border-black bg-neutral-50'
                        )}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Refine
                        {hasActiveFilters && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-black rounded-full ring-4 ring-white" />
                        )}
                    </button>
                </div>
            </div>

            {/* Mass Action Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-black text-white px-8 py-4 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between sticky top-4 z-40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 gap-4">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-black tracking-tighter">{selectedIds.length}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Selected Assets</span>
                        </div>
                        <div className="hidden md:block h-8 w-px bg-white/10" />
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setShowBatchGroupModal(true)}
                            className="px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-black rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all border border-white/5"
                        >
                            <FolderPlus className="w-4 h-4" />
                            Categorize
                        </button>
                        <button
                            onClick={handleBatchDownload}
                            className="px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-black rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all border border-white/5"
                        >
                            <Download className="w-4 h-4" />
                            Archival ZIP
                        </button>
                        <button
                            onClick={handleBatchDelete}
                            className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all border border-red-500/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            Purge
                        </button>
                    </div>
                </div>
            )}

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-[2.5rem] p-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Search Infrastructure</h3>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-xs font-bold text-black border-b-2 border-black pb-0.5 hover:text-neutral-600 hover:border-neutral-600 transition-colors">
                                Reset Workspace
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Storage Node</label>
                            <select
                                value={filters.storage_account_id || ''}
                                onChange={(e) => setFilters({ ...filters, storage_account_id: e.target.value || undefined, page: 1 })}
                                className="input rounded-2xl h-12 bg-white"
                            >
                                <option value="">Global Search</option>
                                {storageAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>{account.name} ({account.provider})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Collection</label>
                            <select
                                value={filters.media_group_id || ''}
                                onChange={(e) => setFilters({ ...filters, media_group_id: e.target.value || undefined, page: 1 })}
                                className="input rounded-2xl h-12 bg-white"
                            >
                                <option value="">All Collections</option>
                                {groups.map((group) => (
                                    <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Asset Category</label>
                            <select
                                value={filters.media_type || ''}
                                onChange={(e) => setFilters({ ...filters, media_type: e.target.value as MediaType || undefined, page: 1 })}
                                className="input rounded-2xl h-12 bg-white"
                            >
                                <option value="">Every Category</option>
                                <option value="image">Still Images</option>
                                <option value="video">Motion Video</option>
                                <option value="audio">Sonic Assets</option>
                                <option value="document">Documentation</option>
                                <option value="other">Unclassified</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Temporal Sort</label>
                            <select
                                value={`${filters.sort_by}-${filters.sort_order}`}
                                onChange={(e) => {
                                    const [sortBy, sortOrder] = e.target.value.split('-');
                                    setFilters({ ...filters, sort_by: sortBy, sort_order: sortOrder as 'asc' | 'desc', page: 1 });
                                }}
                                className="input rounded-2xl h-12 bg-white"
                            >
                                <option value="created_at-desc">Chronological (Newest)</option>
                                <option value="created_at-asc">Chronological (Oldest)</option>
                                <option value="filename-asc">Alphabetical (A-Z)</option>
                                <option value="filename-desc">Alphabetical (Z-A)</option>
                                <option value="file_size_bytes-desc">Magnitude (Largest)</option>
                                <option value="file_size_bytes-asc">Magnitude (Smallest)</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Type Tabs */}
            <div className="flex items-center gap-1.5 bg-neutral-100 p-2 rounded-[2.5rem] w-fit border border-neutral-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                {[
                    { id: 'all', label: 'Omni', icon: Grid3X3 },
                    { id: 'image', label: 'Images', icon: Image },
                    { id: 'video', label: 'Videos', icon: Video },
                    { id: 'audio', label: 'Audio', icon: Music },
                    { id: 'document', label: 'Docs', icon: FileText },
                    { id: 'other', label: 'Other', icon: FileIcon },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = (!filters.media_type && tab.id === 'all') || filters.media_type === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (tab.id === 'all') {
                                    const { media_type, ...rest } = filters;
                                    setFilters({ ...rest, page: 1, media_type: undefined });
                                } else {
                                    setFilters({ ...filters, media_type: tab.id as MediaType, page: 1 });
                                }
                            }}
                            className={clsx(
                                "flex items-center gap-3 px-8 py-4 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap",
                                isActive ? "bg-black text-white shadow-xl shadow-black/20 scale-105" : "text-neutral-500 hover:text-black hover:bg-white/50"
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            {isMediaLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                    {[...Array(12)].map((_, i) => <MediaCardSkeleton key={i} />)}
                </div>
            ) : media.length === 0 ? (
                <div className="text-center py-40 bg-neutral-50 rounded-[4rem] border-2 border-dashed border-neutral-200">
                    <div className="w-24 h-24 mx-auto bg-white rounded-[2rem] flex items-center justify-center mb-8 shadow-xl">
                        <Image className="w-12 h-12 text-neutral-200" />
                    </div>
                    <h3 className="text-3xl font-black text-black mb-3">Void Detected</h3>
                    <p className="text-neutral-500 text-sm font-medium max-w-xs mx-auto leading-relaxed">
                        {hasActiveFilters ? "Your current query parameters yielded zero results from the infrastructure." : "The global asset repository is currently empty. Initialize an upload to begin."}
                    </p>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="mt-8 text-xs font-black uppercase tracking-widest text-black hover:underline underline-offset-8 transition-all">
                            Collapse Filters
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="space-y-16">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                        {media.map((item, index) => (
                            <MediaGridCard
                                key={item.id}
                                item={item}
                                index={index}
                                isSelected={selectedIds.includes(item.id)}
                                onSelect={toggleSelection}
                                onView={setSelectedMediaIndex}
                                onCopy={copyUrl}
                                onDelete={handleDelete}
                                onDownload={handleDownload}
                            />
                        ))}
                    </div>
                    <Pagination
                        currentPage={filters.page || 1}
                        totalPages={Math.ceil(totalMedia / (filters.page_size || 50))}
                        onPageChange={(page) => setFilters({ ...filters, page })}
                    />
                </div>
            ) : (
                <div className="table-container border-none shadow-none bg-white rounded-[3rem] overflow-hidden border border-neutral-100">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100">
                                    <th className="pl-10 pr-0 py-6 w-10">
                                        <button onClick={selectAll} className={clsx("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", selectedIds.length === media.length && media.length > 0 ? "bg-black border-black text-white" : "bg-white border-neutral-200")}>
                                            {selectedIds.length === media.length && media.length > 0 && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </button>
                                    </th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Identity</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Infrastructure</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Magnitude</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Timeline</th>
                                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {media.map((item, index) => (
                                    <tr key={item.id} className={clsx("hover:bg-neutral-50/50 transition-all group cursor-pointer", selectedIds.includes(item.id) && "bg-neutral-50")} onClick={() => setSelectedMediaIndex(index)}>
                                        <td className="pl-10 pr-0 py-7">
                                            <button onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }} className={clsx("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", selectedIds.includes(item.id) ? "bg-black border-black text-white" : "bg-white border-neutral-200")}>
                                                {selectedIds.includes(item.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </button>
                                        </td>
                                        <td className="px-10 py-7">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl border border-neutral-100 bg-white overflow-hidden flex items-center justify-center p-1 shadow-sm">
                                                    {item.media_type === 'image' && (item.thumbnail_url || item.public_url) ? (
                                                        <img src={item.thumbnail_url || item.public_url} className="w-full h-full object-cover rounded-xl" />
                                                    ) : (
                                                        <div className="w-full h-full bg-neutral-50 rounded-xl flex items-center justify-center">
                                                            {React.createElement(mediaTypeIcons[item.media_type] || FileIcon, { className: "w-6 h-6 text-neutral-300" })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-black truncate max-w-[250px]">{item.filename}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.media_type}</span>
                                                        {item.group_name && (
                                                            <>
                                                                <span className="text-[10px] text-neutral-200">•</span>
                                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-white/90 border border-white/10 shadow-sm" style={{ backgroundColor: item.group_color }}>{item.group_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7"><span className="text-[10px] font-black text-black uppercase tracking-widest px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg">{item.storage_provider}</span></td>
                                        <td className="px-10 py-7 text-xs font-bold text-neutral-600">{formatFileSize(item.file_size_bytes)}</td>
                                        <td className="px-10 py-7 text-xs font-bold text-neutral-400">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</td>
                                        <td className="px-10 py-7">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="p-3 bg-white border border-neutral-200 rounded-xl hover:border-black transition-all shadow-sm"><Download className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); copyUrl(item); }} className="p-3 bg-white border border-neutral-200 rounded-xl hover:border-black transition-all shadow-sm"><Copy className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-3 bg-white border border-neutral-200 rounded-xl hover:border-red-600 hover:text-red-600 transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Batch Group Modal */}
            {showBatchGroupModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowBatchGroupModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 pb-4 border-b border-neutral-100">
                            <h2 className="text-3xl font-black text-black">Mass Organization</h2>
                            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mt-1">Assign {selectedIds.length} assets to a collection</p>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest pl-1">Target Collection</label>
                                <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            onClick={() => setBatchTargetGroupId(group.id)}
                                            className={clsx(
                                                "flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all text-left",
                                                batchTargetGroupId === group.id
                                                    ? "border-black bg-black text-white"
                                                    : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
                                            )}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                                                style={{ backgroundColor: batchTargetGroupId === group.id ? 'rgba(255,255,255,0.2)' : group.color + '20' }}
                                            >
                                                <FolderPlus className={clsx("w-5 h-5", batchTargetGroupId === group.id ? "text-white" : "")} style={{ color: batchTargetGroupId === group.id ? 'white' : group.color }} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black">{group.name}</p>
                                                <p className={clsx("text-[10px] font-bold uppercase tracking-widest truncate", batchTargetGroupId === group.id ? "text-white/60" : "text-neutral-400")}>
                                                    {group.description || 'Asset Collection'}
                                                </p>
                                            </div>
                                            {batchTargetGroupId === group.id && <Check className="w-5 h-5 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowBatchGroupModal(false)} className="flex-1 py-5 bg-neutral-100 hover:bg-neutral-200 text-black rounded-[1.8rem] font-black uppercase tracking-widest transition-all">Discard</button>
                                <button
                                    onClick={handleBatchGroupUpdate}
                                    disabled={!batchTargetGroupId || isBatchUpdating}
                                    className="flex-[2] py-5 bg-black hover:bg-black/90 text-white rounded-[1.8rem] font-black uppercase tracking-widest transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                >
                                    {isBatchUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Apply Categorization'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {selectedMediaIndex !== null && media && media[selectedMediaIndex] && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col h-screen w-screen animate-in fade-in duration-300">
                    <div className="flex items-center justify-between p-8 z-50">
                        <div className="flex items-center gap-6">
                            <div className="p-3 bg-white/10 rounded-2xl">
                                {React.createElement(mediaTypeIcons[media[selectedMediaIndex].media_type] || FileIcon, { className: "w-6 h-6 text-white" })}
                            </div>
                            <div>
                                <h3 className="text-white text-xl font-black tracking-tight truncate max-w-lg">{media[selectedMediaIndex].filename}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-black text-white/60 uppercase tracking-widest border border-white/5">{media[selectedMediaIndex].mime_type}</span>
                                    {media[selectedMediaIndex].group_name && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-sm" style={{ backgroundColor: media[selectedMediaIndex].group_color }}>{media[selectedMediaIndex].group_name}</span>
                                    )}
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{formatFileSize(media[selectedMediaIndex].file_size_bytes)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => handleDownload(media[selectedMediaIndex])} className="p-4 bg-white/10 rounded-2xl hover:bg-white text-white hover:text-black transition-all group flex items-center gap-3">
                                <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                                <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Archival</span>
                            </button>
                            <button onClick={() => copyUrl(media[selectedMediaIndex])} className="p-4 bg-white/10 rounded-2xl hover:bg-white text-white hover:text-black transition-all group flex items-center gap-3">
                                <Copy className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Link</span>
                            </button>
                            <button onClick={() => handleDelete(media[selectedMediaIndex])} className="p-4 bg-white/10 rounded-[1.5rem] hover:bg-red-500 text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                            <button onClick={() => setSelectedMediaIndex(null)} className="p-4 bg-white/10 rounded-[1.5rem] hover:bg-white text-white hover:text-black transition-all"><X className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-between px-12 relative overflow-hidden">
                        <button onClick={() => setSelectedMediaIndex((prev) => (prev! - 1 + media.length) % media.length)} className="p-6 rounded-full bg-white/5 hover:bg-white text-white hover:text-black transition-all backdrop-blur-sm z-20"><ChevronLeft className="w-10 h-10" /></button>
                        <div className="flex-1 h-full flex items-center justify-center p-8">
                            {media[selectedMediaIndex].media_type === 'image' ? (
                                <img src={media[selectedMediaIndex].public_url} className="max-h-full max-w-full object-contain shadow-2xl rounded-xl animate-in zoom-in-95 duration-500" alt="" />
                            ) : media[selectedMediaIndex].media_type === 'video' ? (
                                <video src={media[selectedMediaIndex].public_url} controls className="max-h-full max-w-full shadow-2xl rounded-xl" />
                            ) : (
                                <div className="text-center">
                                    <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10">
                                        {React.createElement(mediaTypeIcons[media[selectedMediaIndex].media_type] || FileIcon, { className: "w-16 h-16 text-white" })}
                                    </div>
                                    <p className="text-white/60 font-black uppercase tracking-[0.3em] text-sm">Preview Not Available</p>
                                </div>
                            )}
                        </div>
                        <button onClick={() => setSelectedMediaIndex((prev) => (prev! + 1) % media.length)} className="p-6 rounded-full bg-white/5 hover:bg-white text-white hover:text-black transition-all backdrop-blur-sm z-20"><ChevronRight className="w-10 h-10" /></button>
                    </div>

                    <div className="p-8 flex justify-center gap-3 overflow-x-auto bg-black/40 backdrop-blur-md">
                        {media.slice(Math.max(0, (selectedMediaIndex || 0) - 5), (selectedMediaIndex || 0) + 6).map((item) => (
                            <button key={`strip-${item.id}`} onClick={() => setSelectedMediaIndex(media.indexOf(item))} className={clsx("w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0", media[selectedMediaIndex].id === item.id ? "border-white scale-110 shadow-lg" : "border-transparent opacity-40 hover:opacity-100")}>
                                {item.media_type === 'image' ? <img src={item.thumbnail_url || item.public_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-white/10 flex items-center justify-center text-white">{React.createElement(mediaTypeIcons[item.media_type] || FileIcon, { className: "w-5 h-5" })}</div>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
