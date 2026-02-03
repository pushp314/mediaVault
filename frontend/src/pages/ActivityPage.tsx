import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, isValid } from 'date-fns';
import { adminApi } from '../api';

interface AuditLog {
    id: string;
    action: string;
    actor?: string;
    employee_email?: string;
    target?: string;
    resource_type?: string;
    provider?: string;
    timestamp?: string;
    created_at?: string;
    details?: any;
}

const actionIcons: Record<string, any> = {
    upload: ArrowUpRight,
    delete: Trash2,
    move: Move,
    update: Settings,
    view: FileText,
    download: ArrowUpRight,
};

const actionColors: Record<string, string> = {
    upload: 'bg-black text-white',
    delete: 'bg-red-50 text-red-600 border border-red-100',
    move: 'bg-blue-50 text-blue-600 border border-blue-100',
    update: 'bg-amber-50 text-amber-600 border border-amber-100',
    view: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    download: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
};

export default function ActivityPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.getAuditLogs();
            // The backend returns a paginated response with a "data" field
            const logData = response.data || (Array.isArray(response) ? response : []);
            setLogs(logData);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getActorName = (log: AuditLog) => {
        return log.actor || log.employee_email || 'System';
    };

    const getTargetName = (log: AuditLog) => {
        if (log.target) return log.target;
        if (log.details?.filename) return log.details.filename;
        if (log.details?.name) return log.details.name;
        if (log.resource_type) return `${log.resource_type} (${log.id.slice(0, 8)})`;
        return 'Unknown Resource';
    };

    const getFormattedDate = (dateStr?: string) => {
        if (!dateStr) return 'Recently';
        const date = new Date(dateStr);
        if (!isValid(date)) return 'Recently';
        return formatDistanceToNow(date, { addSuffix: true });
    };

    const filteredLogs = logs.filter(log => {
        const actor = getActorName(log).toLowerCase();
        const target = getTargetName(log).toLowerCase();
        const action = (log.action || '').toLowerCase();
        const s = search.toLowerCase();
        return actor.includes(s) || target.includes(s) || action.includes(s);
    });

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
                <div>
                    <h2 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 mb-2">Audit Logs</h2>
                    <h1 className="text-5xl font-black tracking-tight text-black">System Activity</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        Real-time audit trail of all platform operations.
                    </p>
                </div>

                <div className="relative group">
                    <div className="absolute inset-0 bg-black/5 blur-2xl group-focus-within:bg-black/10 transition-all rounded-full" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-black transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by user, action, or file..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="relative bg-white border border-neutral-200 focus:border-black focus:ring-0 pl-12 h-14 w-full sm:w-80 rounded-2xl transition-all font-medium text-sm"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-4">
                    <Loader2 className="w-12 h-12 text-black animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Fetching Audit Trail...</p>
                </div>
            ) : filteredLogs.length > 0 ? (
                <div className="bg-white border border-neutral-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-neutral-50/50 border-b border-neutral-100">
                                    <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-6">
                                        Operation
                                    </th>
                                    <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-6">
                                        Personnel
                                    </th>
                                    <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-6">
                                        Resource
                                    </th>
                                    <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-6">
                                        Infrastructure
                                    </th>
                                    <th className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest px-10 py-6">
                                        Timeline
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {filteredLogs.map((log) => {
                                    const Icon = actionIcons[log.action] || Activity;
                                    const actorName = getActorName(log);
                                    const targetName = getTargetName(log);
                                    const timestamp = log.timestamp || log.created_at;

                                    return (
                                        <tr key={log.id} className="group hover:bg-neutral-50/50 transition-all cursor-default">
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className={clsx(
                                                        'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm',
                                                        actionColors[log.action] || 'bg-neutral-100 text-neutral-400'
                                                    )}>
                                                        <Icon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-black text-black capitalize block">{log.action}</span>
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{log.resource_type || 'System'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-neutral-100 rounded-xl flex items-center justify-center border border-neutral-200">
                                                        <User className="w-4 h-4 text-neutral-400" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-neutral-700 block">{actorName.split('@')[0]}</span>
                                                        <span className="text-[10px] font-medium text-neutral-400">{actorName}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="max-w-xs">
                                                    <span className="text-xs font-bold text-black truncate block" title={targetName}>
                                                        {targetName}
                                                    </span>
                                                    {log.details?.path && (
                                                        <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block truncate">{log.details.path}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-neutral-50 border border-neutral-100 rounded-lg">
                                                        <Database className="w-3 h-3 text-neutral-400" />
                                                    </div>
                                                    <span className="text-[11px] text-black font-black uppercase tracking-wider">{log.provider || 'Internal'}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <Clock className="w-4 h-4" />
                                                    <span className="text-xs font-bold whitespace-nowrap">
                                                        {getFormattedDate(timestamp)}
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
            ) : (
                <div className="text-center py-40 bg-neutral-50 rounded-[4rem] border-2 border-dashed border-neutral-200">
                    <div className="w-24 h-24 mx-auto bg-white rounded-[2rem] flex items-center justify-center mb-8 shadow-xl border border-neutral-100">
                        <Activity className="w-12 h-12 text-neutral-200" />
                    </div>
                    <h3 className="text-3xl font-black text-black mb-3">Void of Activity</h3>
                    <p className="text-neutral-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
                        The audit trail currently reflects no matching entries for your search parameters.
                    </p>
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="mt-8 text-xs font-black uppercase tracking-widest text-black hover:underline underline-offset-8"
                        >
                            Reset Search Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
