import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMediaStore } from '../store/mediaStore';
import { mediaApi } from '../api';
import toast from 'react-hot-toast';

interface UploadFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
    error?: string;
}

export default function UploadPage() {
    const navigate = useNavigate();
    const { groups, storageAccounts } = useMediaStore();

    const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [selectedStorageId, setSelectedStorageId] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                status: 'pending' as const,
                progress: 0
            }));
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast.error('Please select files to upload');
            return;
        }

        setIsUploading(true);

        for (let i = 0; i < selectedFiles.length; i++) {
            const fileItem = selectedFiles[i];
            if (fileItem.status === 'completed') continue;

            // Client-side provider specific limit checks
            const acc = storageAccounts.find(a => a.id === selectedStorageId);
            if (acc?.provider === 'cloudinary') {
                const isImage = fileItem.file.type.startsWith('image/');
                const isVideo = fileItem.file.type.startsWith('video/');
                if (isImage && fileItem.file.size > 10 * 1024 * 1024) {
                    toast.error(`${fileItem.file.name} exceeds Cloudinary 10MB image limit`);
                    continue;
                }
                if (isVideo && fileItem.file.size > 100 * 1024 * 1024) {
                    toast.error(`${fileItem.file.name} exceeds Cloudinary 100MB video limit`);
                    continue;
                }
            }

            try {
                // Update status to uploading
                setSelectedFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'uploading', progress: 10 } : f
                ));

                // 1. Initiate - get upload URL and signed params from backend
                const initResponse = await mediaApi.initiateUpload({
                    filename: fileItem.file.name,
                    content_type: fileItem.file.type,
                    file_size: fileItem.file.size,
                    media_group_id: selectedGroupId || undefined,
                    storage_account_id: selectedStorageId || undefined,
                });

                console.log('[UploadPage] initResponse:', initResponse);

                setSelectedFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, progress: 30 } : f
                ));

                // 2. Upload file directly to Cloudinary
                const formData = new FormData();
                formData.append('file', fileItem.file);

                // Add form data from backend (includes signature, timestamp, etc.)
                if (initResponse.form_data) {
                    Object.entries(initResponse.form_data).forEach(([key, value]) => {
                        formData.append(key, value as string);
                    });
                }

                // For Cloudinary unsigned upload, we need api_key
                // The backend should provide this in headers or form_data
                if (initResponse.headers) {
                    Object.entries(initResponse.headers).forEach(([key, value]) => {
                        if (key.toLowerCase() !== 'content-type') {
                            formData.append(key, value);
                        }
                    });
                }

                console.log('[UploadPage] Uploading to:', initResponse.upload_url);

                // Upload with progress tracking
                const uploadResponse = await fetch(initResponse.upload_url, {
                    method: initResponse.upload_method || 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('[UploadPage] Upload failed:', errorText);
                    throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
                }

                const cloudinaryResult = await uploadResponse.json();
                console.log('[UploadPage] Cloudinary result:', cloudinaryResult);

                setSelectedFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, progress: 80 } : f
                ));

                // 3. Complete - tell backend the upload finished
                await mediaApi.completeUpload({
                    media_id: initResponse.media_id,
                    file_size_bytes: cloudinaryResult.bytes || fileItem.file.size,
                    mime_type: fileItem.file.type,
                    public_url: cloudinaryResult.secure_url,
                });

                setSelectedFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'completed', progress: 100 } : f
                ));
            } catch (error: unknown) {
                console.error('Upload failed:', error);
                const errMsg = (error as Error).message || 'Upload failed';
                setSelectedFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'error', error: errMsg } : f
                ));
            }
        }

        setIsUploading(false);
        toast.success('Upload process finished');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">Upload Media</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        Upload your files to any connected cloud storage provider.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="btn-secondary rounded-2xl"
                >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Options Column */}
                <div className="space-y-8">
                    <div className="bg-white border border-neutral-200 rounded-[2rem] p-8 space-y-8 shadow-sm">
                        <section className="space-y-3">
                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                Assignment Group
                            </label>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="input rounded-2xl"
                                disabled={isUploading}
                            >
                                <option value="">No Group</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-neutral-400 font-medium px-1 leading-relaxed">
                                Choose a group to organize these files after upload.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                Storage Account
                            </label>
                            <select
                                value={selectedStorageId}
                                onChange={(e) => setSelectedStorageId(e.target.value)}
                                className="input rounded-2xl"
                                disabled={isUploading}
                            >
                                <option value="">Auto-select (Default)</option>
                                {storageAccounts.map(account => (
                                    <option key={account.id} value={account.id}>{account.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-neutral-400 font-medium px-1 leading-relaxed">
                                Select which cloud provider should host these files.
                            </p>
                        </section>

                        <div className="pt-4">
                            <button
                                onClick={handleUpload}
                                disabled={isUploading || selectedFiles.length === 0}
                                className="btn-primary w-full py-5 text-sm font-bold tracking-wider rounded-3xl"
                            >
                                {isUploading ? 'Uploading...' : 'Start Upload'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dropzone/List Column */}
                <div className="lg:col-span-2 space-y-8">
                    {!isUploading && (
                        <div
                            className="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-[3rem] p-16 text-center hover:bg-neutral-100 hover:border-black transition-all cursor-pointer group"
                            onClick={() => document.getElementById('file-input')?.click()}
                        >
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                <Upload className="w-10 h-10 text-black" />
                            </div>
                            <p className="text-xl font-bold text-black">Click or drag files here</p>
                            <p className="text-neutral-500 text-sm font-medium mt-2">
                                {(() => {
                                    if (!selectedStorageId) return 'Maximum file size depends on current provider rules';
                                    const acc = storageAccounts.find(a => a.id === selectedStorageId);
                                    if (!acc) return 'Maximum file size: 50MB';
                                    if (acc.provider === 'cloudinary') return 'Cloudinary limits: 10MB Image / 100MB Video';
                                    if (acc.provider === 'r2') return 'Unrestricted (Cloudflare R2)';
                                    return `Maximum file size: ${acc.max_file_size_mb}MB`;
                                })()}
                            </p>
                            <input
                                id="file-input"
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    {selectedFiles.length > 0 && (
                        <div className="bg-white border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="bg-neutral-50 border-b border-neutral-100 px-8 py-4 flex justify-between items-center">
                                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Upload Queue ({selectedFiles.length})</span>
                                {selectedFiles.some(f => f.status === 'completed') && (
                                    <button
                                        onClick={() => setSelectedFiles(prev => prev.filter(f => f.status !== 'completed'))}
                                        className="text-xs font-bold text-black hover:text-neutral-600 transition-colors"
                                    >
                                        Clear Completed
                                    </button>
                                )}
                            </div>
                            <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                                {selectedFiles.map((item, index) => (
                                    <div key={index} className="px-8 py-5 flex items-center justify-between group hover:bg-neutral-50 transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <File className="w-6 h-6 text-neutral-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-black truncate">{item.file.name}</p>
                                                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            {item.status === 'uploading' && (
                                                <div className="w-32 h-2 bg-neutral-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-black transition-all duration-300 rounded-full"
                                                        style={{ width: `${item.progress}%` }}
                                                    />
                                                </div>
                                            )}

                                            {item.status === 'completed' && (
                                                <div className="flex items-center gap-2 text-emerald-600">
                                                    <span className="text-xs font-bold uppercase tracking-widest">Done</span>
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            )}
                                            {item.status === 'error' && (
                                                <div className="flex items-center gap-2 text-red-600">
                                                    <span className="text-xs font-bold uppercase tracking-widest">Error</span>
                                                    <AlertCircle className="w-5 h-5" />
                                                </div>
                                            )}

                                            {!isUploading && item.status !== 'completed' && (
                                                <button
                                                    onClick={() => removeFile(index)}
                                                    className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
