import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Loader2, Check, AlertCircle, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { mediaApi, uploadToStorage } from '../../api';
import { useMediaStore } from '../../store/mediaStore';

interface UploadModalProps {
    open: boolean;
    onClose: () => void;
}

interface UploadFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
    error?: string;
}

export default function UploadModal({ open, onClose }: UploadModalProps) {
    const { groups, storageAccounts } = useMediaStore();

    const [files, setFiles] = useState<UploadFile[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [folderPath, setFolderPath] = useState('');
    const [selectedStorage, setSelectedStorage] = useState<string>('');
    const [tags, setTags] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map((file) => ({
            file,
            status: 'pending' as const,
            progress: 0,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
            'video/*': ['.mp4', '.webm', '.mov', '.avi'],
            'application/pdf': ['.pdf'],
        },
        maxSize: 100 * 1024 * 1024, // 100MB
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const uploadFiles = async () => {
        if (files.length === 0) {
            toast.error('Please select files to upload');
            return;
        }

        setIsUploading(true);
        const tagsList = tags.split(',').map((t) => t.trim()).filter(Boolean);

        for (let i = 0; i < files.length; i++) {
            const uploadFile = files[i];

            // Update status to uploading
            setFiles((prev) => prev.map((f, idx) =>
                idx === i ? { ...f, status: 'uploading' } : f
            ));

            try {
                // Step 1: Initiate upload
                const initResponse = await mediaApi.initiateUpload({
                    filename: uploadFile.file.name,
                    content_type: uploadFile.file.type,
                    file_size: uploadFile.file.size,
                    media_group_id: selectedGroup || undefined,
                    folder_path: folderPath || undefined,
                    storage_account_id: selectedStorage || undefined,
                    tags: tagsList.length > 0 ? tagsList : undefined,
                });

                // Step 2: Upload to storage via signed URL
                await uploadToStorage(
                    initResponse.upload_url,
                    uploadFile.file,
                    initResponse.upload_method,
                    initResponse.headers
                );

                // Step 3: Complete upload
                await mediaApi.completeUpload({
                    media_id: initResponse.media_id,
                    file_size_bytes: uploadFile.file.size,
                    mime_type: uploadFile.file.type,
                });

                // Update status to completed
                setFiles((prev) => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'completed', progress: 100 } : f
                ));
            } catch (error: any) {
                const errorMessage = error.response?.data?.error || 'Upload failed';
                setFiles((prev) => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'error', error: errorMessage } : f
                ));
            }
        }

        setIsUploading(false);

        const successCount = files.filter((f) => f.status === 'completed').length;
        if (successCount > 0) {
            toast.success(`${successCount} file(s) uploaded successfully`);
        }
    };

    const handleClose = () => {
        if (!isUploading) {
            setFiles([]);
            setSelectedGroup('');
            setFolderPath('');
            setSelectedStorage('');
            setTags('');
            onClose();
        }
    };

    if (!open) return null;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-900">Upload Media</h2>
                    <button
                        onClick={handleClose}
                        disabled={isUploading}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-white">
                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={clsx(
                            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
                            isDragActive
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                        )}
                    >
                        <input {...getInputProps()} />
                        <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-100">
                            <Upload className="w-8 h-8 text-primary-600" />
                        </div>
                        <p className="text-slate-900 font-bold text-lg mb-1">
                            {isDragActive ? 'Drop files here...' : 'Click or drag files to upload'}
                        </p>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            Images, videos, and documents up to 100MB are supported
                        </p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                Selected Files ({files.length})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {files.map((uploadFile, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 group transition-all hover:bg-white hover:shadow-sm"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 flex-shrink-0">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{uploadFile.file.name}</p>
                                            <p className="text-[11px] font-medium text-slate-500 uppercase">{formatFileSize(uploadFile.file.size)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {uploadFile.status === 'pending' && (
                                                <button
                                                    onClick={() => removeFile(index)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                            {uploadFile.status === 'uploading' && (
                                                <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                                            )}
                                            {uploadFile.status === 'completed' && (
                                                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                </div>
                                            )}
                                            {uploadFile.status === 'error' && (
                                                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center" title={uploadFile.error}>
                                                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Destination Group
                            </label>
                            <select
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="input"
                            >
                                <option value="">Select group (optional)</option>
                                {groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Storage Provider
                            </label>
                            <select
                                value={selectedStorage}
                                onChange={(e) => setSelectedStorage(e.target.value)}
                                className="input"
                            >
                                <option value="">Auto-select (recommended)</option>
                                {storageAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name} ({account.provider})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Folder Path
                            </label>
                            <div className="relative">
                                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={folderPath}
                                    onChange={(e) => setFolderPath(e.target.value)}
                                    placeholder="/images/2024"
                                    className="input pl-9"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Tags (comma separated)
                            </label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="marketing, hero, banner"
                                className="input"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={handleClose}
                        disabled={isUploading}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={uploadFiles}
                        disabled={files.length === 0 || isUploading}
                        className="btn-primary min-w-[140px]"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload {files.length > 0 && `(${files.length})`}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
