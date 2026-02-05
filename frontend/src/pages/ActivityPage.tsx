import { useEffect, useState, useCallback } from 'react';
import {
    Activity,
    User,
    Clock,
    Database,
    Search,
    ArrowUpRight,
    Trash2,
    Move,
    Loader2,
    FileText,
    Settings,
    ShieldAlert,
    Filter,
    Calendar,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    ShieldCheck,
    Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, isValid, format } from 'date-fns';
import { adminApi } from '../api';
import toast from 'react-hot-toast';

interface AuditLog {
    id: string;
    action: string;
    severity: 'info' | 'warning' | 'critical';
    employee_id: string;
    employee_email: string;
    resource_type: string;
    resource_id?: string;
    details: any;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

const actionIcons: Record<string, any> = {
    upload: ArrowUpRight,
    delete: Trash2,
    move: Move,
    update: Settings,
    view: FileText,
    download: ArrowUpRight,
    create: RefreshCw,
};

const severityConfig = {
    info: {
        icon: Info,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        label: 'Informational'
    },
    warning: {
        icon: ShieldAlert,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        label: 'Warning'
    },
    critical: {
        icon: ShieldAlert,
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-100',
        label: 'Critical'
    }
};

interface Personnel {
    id: string;
    full_name: string;
    email: string;
}

export default function ActivityPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        employee_id: '',
        severity: '',
        action: '',
        start_date: '',
        end_date: '',
        search: '',
    });

    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadPersonnel();
    }, []);

    const loadLogs = useCallback(async (currentPage: number, currentFilters: typeof filters) => {
        setIsLoading(true);
        try {
            const apiFilters: any = {
                page: currentPage,
                page_size: 20,
            };

            if (currentFilters.employee_id) apiFilters.employee_id = currentFilters.employee_id;
            if (currentFilters.severity) apiFilters.severity = currentFilters.severity;
            if (currentFilters.action) apiFilters.action = currentFilters.action;
            if (currentFilters.start_date) apiFilters.start_date = currentFilters.start_date;
            if (currentFilters.end_date) apiFilters.end_date = currentFilters.end_date;
            // The search is handled locally for now or we could add backend support

            const response = await adminApi.getAuditLogs(apiFilters);
            setLogs(response.data || []);
            setTotal(response.total);
            setTotalPages(response.total_pages);
        } catch (error) {
            console.error('Failed to load logs', error);
            toast.error('Failed to synchronize audit trail');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadPersonnel = async () => {
        try {
            const response = await adminApi.listEmployees();
            setPersonnel(response.data || []);
        } catch (error) {
            console.error('Failed to load personnel', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadLogs(page, filters);
        }, 300);
        return () => clearTimeout(timer);
    }, [page, filters, loadLogs]);

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to first page on filter change
    };

    const getFormattedDate = (dateStr: string) => {
        if (!dateStr) return 'Recently';
        const date = new Date(dateStr);
        if (!isValid(date)) return 'Recently';
        return formatDistanceToNow(date, { addSuffix: true });
    };

    const getTargetName = (log: AuditLog) => {
        if (log.details?.filename) return log.details.filename;
        if (log.details?.name) return log.details.name;
        if (log.resource_type) return `${log.resource_type.replace('_', ' ')}: ${log.resource_id?.slice(0, 8)}`;
        return 'System Event';
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-neutral-100">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Security Console</h2>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-black leading-none">Audit Logs</h1>
                    <p className="text-neutral-500 font-medium max-w-xl text-lg">
                        Immutable record of platform operations, access patterns, and infrastructure modifications.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-black transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by action, resource..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="bg-neutral-50 border-none focus:ring-2 focus:ring-black/5 pl-12 h-14 w-full sm:w-80 rounded-2xl transition-all font-bold text-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={clsx(
                            "h-14 px-6 rounded-2xl flex items-center gap-3 font-bold text-sm border-2 transition-all",
                            showFilters ? "bg-black border-black text-white" : "bg-white border-neutral-100 text-neutral-600 hover:border-black hover:text-black"
                        )}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {Object.values(filters).filter(v => v !== '').length > 0 && (
                            <span className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center text-[10px] font-black">
                                {Object.values(filters).filter(v => v !== '').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => loadLogs(page, filters)}
                        className="h-14 w-14 rounded-2xl flex items-center justify-center border-2 border-neutral-100 text-neutral-400 hover:border-black hover:text-black transition-all bg-white"
                    >
                        <RefreshCw className={clsx("w-5 h-5", isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Personnel</label>
                        <select
                            value={filters.employee_id}
                            onChange={(e) => handleFilterChange('employee_id', e.target.value)}
                            className="w-full h-12 bg-white border-neutral-100 rounded-xl text-sm font-bold focus:border-black transition-all"
                        >
                            <option value="">All Members</option>
                            {personnel.map(p => (
                                <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Severity</label>
                        <select
                            value={filters.severity}
                            onChange={(e) => handleFilterChange('severity', e.target.value)}
                            className="w-full h-12 bg-white border-neutral-100 rounded-xl text-sm font-bold focus:border-black transition-all"
                        >
                            <option value="">All Severities</option>
                            <option value="info">Informational</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Timeframe Start</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                            <input
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                className="w-full h-12 pl-10 bg-white border-neutral-100 rounded-xl text-sm font-bold focus:border-black transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Timeframe End</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                            <input
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                className="w-full h-12 pl-10 bg-white border-neutral-100 rounded-xl text-sm font-bold focus:border-black transition-all"
                            />
                        </div>
                    </div>
                    <div className="lg:col-span-4 flex justify-end pt-2">
                        <button
                            onClick={() => {
                                setFilters({
                                    employee_id: '',
                                    severity: '',
                                    action: '',
                                    start_date: '',
                                    end_date: '',
                                    search: '',
                                });
                                setPage(1);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
                        >
                            Clear All Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Logs Section */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-6">
                    <Loader2 className="w-16 h-16 text-black animate-spin stroke-[1.5]" />
                    <div className="text-center">
                        <p className="text-sm font-black uppercase tracking-[0.3em] text-black">Synchronizing Trail</p>
                        <p className="text-neutral-400 text-xs mt-1 font-medium">Fetching secure records from infrastructure...</p>
                    </div>
                </div>
            ) : logs.length > 0 ? (
                <div className="space-y-6">
                    <div className="bg-white border border-neutral-100 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/[0.02]">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-neutral-50/50 border-b border-neutral-100">
                                        <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-8 w-64">
                                            Operation & Security
                                        </th>
                                        <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-8">
                                            Personnel
                                        </th>
                                        <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-8">
                                            Target Resource
                                        </th>
                                        <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-8">
                                            Connectivity
                                        </th>
                                        <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-8">
                                            Timeline
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {logs.map((log) => {
                                        const ActionIcon = actionIcons[log.action] || Activity;
                                        const sev = severityConfig[log.severity] || severityConfig.info;
                                        const SevIcon = sev.icon;
                                        const targetName = getTargetName(log);

                                        return (
                                            <tr key={log.id} className="group hover:bg-neutral-50/40 transition-all">
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className={clsx(
                                                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 duration-500 shadow-lg shadow-black/[0.03]",
                                                            log.severity === 'critical' ? 'bg-red-50 text-red-600' :
                                                                log.severity === 'warning' ? 'bg-amber-50 text-amber-600' :
                                                                    'bg-neutral-900 text-white'
                                                        )}>
                                                            <ActionIcon className="w-7 h-7" strokeWidth={2.5} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base font-black text-black capitalize">{log.action}</span>
                                                                <div className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border", sev.bg, sev.color, sev.border)}>
                                                                    <SevIcon className="w-2.5 h-2.5" />
                                                                    {log.severity}
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                                                {log.resource_type.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-neutral-50 border border-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                                                            <User className="w-5 h-5 text-neutral-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-neutral-900">{log.employee_email.split('@')[0]}</span>
                                                            <span className="text-[11px] font-semibold text-neutral-400">{log.employee_email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="max-w-md">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-black truncate" title={targetName}>
                                                                {targetName}
                                                            </span>
                                                            <ArrowUpRight className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        {log.details?.reason && (
                                                            <span className="text-xs text-neutral-500 mt-1 block italic">{log.details.reason}</span>
                                                        )}
                                                        {log.details?.storage && (
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <Database className="w-3 h-3 text-neutral-400" />
                                                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{log.details.storage}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-neutral-300">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-neutral-600">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                                            <span className="text-xs font-mono font-bold">{log.ip_address || '127.0.0.1'}</span>
                                                        </div>
                                                        <span className="text-[10px] font-medium text-neutral-400 block truncate max-w-[120px]" title={log.user_agent}>
                                                            {log.user_agent || 'Browser Client'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex flex-col items-end text-neutral-400 gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-neutral-300" />
                                                            <span className="text-sm font-black text-neutral-900 tabular-nums">
                                                                {getFormattedDate(log.created_at)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-neutral-300 tracking-wider">
                                                            {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-10 py-8 bg-black rounded-3xl text-white shadow-xl shadow-black/10">
                            <div className="text-xs font-black uppercase tracking-widest text-white/50">
                                Showing <span className="text-white">{(page - 1) * 20 + 1}-{Math.min(page * 20, total)}</span> of <span className="text-white">{total}</span> records
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    disabled={page === 1}
                                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-all border border-white/5"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (page <= 3) pageNum = i + 1;
                                        else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = page - 2 + i;

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setPage(pageNum)}
                                                className={clsx(
                                                    "w-12 h-12 rounded-xl text-sm font-black transition-all border",
                                                    page === pageNum
                                                        ? "bg-white text-black border-white shadow-lg"
                                                        : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={page === totalPages}
                                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-all border border-white/5"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-40 bg-neutral-50 rounded-[5rem] border-4 border-dashed border-neutral-100">
                    <div className="w-32 h-32 mx-auto bg-white rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl border border-neutral-100 relative">
                        <Activity className="w-16 h-16 text-neutral-100" />
                        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center border border-neutral-100 text-neutral-300">
                            <Search className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-4xl font-black text-black mb-4">No Security Records</h3>
                    <p className="text-neutral-500 font-medium max-w-sm mx-auto text-lg leading-relaxed">
                        No audit logs match your current filtration criteria.
                    </p>
                    <button
                        onClick={() => setFilters({
                            employee_id: '',
                            severity: '',
                            action: '',
                            start_date: '',
                            end_date: '',
                            search: '',
                        })}
                        className="mt-10 px-8 py-4 bg-black text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95"
                    >
                        Reset Filtration Parameters
                    </button>
                </div>
            )}
        </div>
    );
}
