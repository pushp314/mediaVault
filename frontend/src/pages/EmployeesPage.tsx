import { useEffect, useState } from 'react';
import {
    Users,
    Plus,
    Trash2,
    X,
    Loader2,
    Shield,
    ShieldCheck,
    User,
    Eye,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { adminApi } from '../api';
import type { Employee, Role } from '../types';

const roleIcons: Record<Role, typeof Shield> = {
    admin: ShieldCheck,
    developer: Shield,
    marketing: User,
    viewer: Eye,
};

const roleColors: Record<Role, string> = {
    admin: 'bg-black text-white',
    developer: 'bg-neutral-200 text-black',
    marketing: 'bg-neutral-100 text-black',
    viewer: 'border border-black text-black',
};

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<Role>('viewer');
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.listEmployees();
            setEmployees(response.data || []);
        } catch (error) {
            toast.error('Failed to load employees');
        } finally {
            setIsLoading(false);
        }
    };

    const openCreateModal = () => {
        setEmail('');
        setPassword('');
        setFullName('');
        setRole('viewer');
        setEditingEmployee(null);
        setIsModalOpen(true);
    };

    const openEditModal = (emp: Employee) => {
        setEditingEmployee(emp);
        setFullName(emp.full_name);
        setEmail(emp.email);
        setRole(emp.role);
        setPassword('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || (!editingEmployee && !password) || !fullName) {
            toast.error('Please fill all required fields');
            return;
        }

        if (!editingEmployee && password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setIsSubmitting(true);

        try {
            if (editingEmployee) {
                await adminApi.updateEmployee(editingEmployee.id, {
                    full_name: fullName,
                    role: role,
                });
                toast.success('Member updated');
            } else {
                await adminApi.createEmployee({
                    email,
                    password,
                    full_name: fullName,
                    role,
                });
                toast.success('Member created');
            }
            loadEmployees();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to sync member data');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (emp: Employee) => {
        try {
            await adminApi.updateEmployee(emp.id, { is_active: !emp.is_active });
            toast.success(emp.is_active ? 'Employee deactivated' : 'Employee activated');
            loadEmployees();
        } catch {
            toast.error('Failed to update employee');
        }
    };

    const deleteEmployee = async (emp: Employee) => {
        if (!confirm(`Delete ${emp.full_name}? This cannot be undone.`)) return;

        try {
            await adminApi.deleteEmployee(emp.id);
            toast.success('Employee deleted');
            loadEmployees();
        } catch {
            toast.error('Failed to delete employee');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-black">Team Members</h1>
                    <p className="text-neutral-500 mt-2 text-sm font-medium">
                        View and manage team access controls and permissions.
                    </p>
                </div>

                <button
                    onClick={openCreateModal}
                    className="btn-primary rounded-2xl px-8"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                </button>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-10 h-10 text-neutral-300 animate-spin" />
                </div>
            )}

            {/* Employee Table */}
            {!isLoading && employees.length > 0 && (
                <div className="table-container border-none shadow-none">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                <th className="text-left text-xs font-bold text-neutral-500 uppercase tracking-widest px-8 py-5">
                                    Name
                                </th>
                                <th className="text-left text-xs font-bold text-neutral-500 uppercase tracking-widest px-8 py-5">
                                    Role
                                </th>
                                <th className="text-left text-xs font-bold text-neutral-500 uppercase tracking-widest px-8 py-5">
                                    Status
                                </th>
                                <th className="text-left text-xs font-bold text-neutral-500 uppercase tracking-widest px-8 py-5">
                                    Last Active
                                </th>
                                <th className="text-right text-xs font-bold text-neutral-500 uppercase tracking-widest px-8 py-5">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {employees.map((emp) => {
                                const RoleIcon = roleIcons[emp.role];

                                return (
                                    <tr key={emp.id} className="hover:bg-neutral-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                    {emp.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-black">{emp.full_name}</p>
                                                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={clsx('inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider', roleColors[emp.role])}>
                                                <RoleIcon className="w-3.5 h-3.5 mr-2" />
                                                {emp.role}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <button
                                                onClick={() => toggleActive(emp)}
                                                className={clsx(
                                                    'px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all',
                                                    emp.is_active
                                                        ? 'bg-neutral-800 text-white hover:bg-black'
                                                        : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                                                )}
                                            >
                                                {emp.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-medium text-neutral-400">
                                            {emp.last_login_at
                                                ? formatDistanceToNow(new Date(emp.last_login_at), { addSuffix: true })
                                                : 'Never'
                                            }
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(emp)}
                                                    className="p-2.5 bg-white border border-neutral-200 rounded-xl hover:border-black hover:text-black transition-all shadow-sm"
                                                    title="Edit Member"
                                                >
                                                    <User className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteEmployee(emp)}
                                                    className="p-2.5 bg-white border border-neutral-200 rounded-xl hover:border-red-600 hover:text-red-600 transition-all shadow-sm"
                                                    title="Delete Member"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}


            {/* Empty State */}
            {!isLoading && employees.length === 0 && (
                <div className="text-center py-32 bg-neutral-50 rounded-[3rem] border border-dashed border-neutral-200">
                    <div className="w-20 h-20 mx-auto bg-white rounded-3xl flex items-center justify-center mb-8 shadow-sm">
                        <Users className="w-10 h-10 text-neutral-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-black mb-3">No members added yet</h3>
                    <p className="text-neutral-500 text-sm font-medium max-w-xs mx-auto leading-relaxed">
                        Add your first team member to start managing access controls.
                    </p>
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />

                    <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-10 py-8 border-b border-neutral-100">
                            <div>
                                <h2 className="text-3xl font-extrabold text-black">
                                    {editingEmployee ? 'Adjust Privileges' : 'Invite Member'}
                                </h2>
                                <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest mt-1 pl-1">
                                    {editingEmployee ? `Editing security profile for ${editingEmployee.full_name}` : 'Provisioning new system credentials'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-4 bg-neutral-50 rounded-2xl hover:bg-neutral-100 transition-all"
                            >
                                <X className="w-6 h-6 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-black ml-1">Identity Profile</h3>

                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                            Official Designation *
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="e.g. Satya Nadella"
                                            className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                            Corporate Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            readOnly={!!editingEmployee}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="email@company.com"
                                            className={clsx(
                                                "input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all",
                                                editingEmployee && "opacity-50 cursor-not-allowed bg-neutral-100"
                                            )}
                                        />
                                        {editingEmployee && (
                                            <p className="text-[10px] text-neutral-400 font-medium px-1">Email identification is fixed once provisioned.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-black ml-1">Access Protocol</h3>

                                    {!editingEmployee && (
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                                Security Key *
                                            </label>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Initialize complex sequence"
                                                className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">
                                            Permission Level *
                                        </label>
                                        <select
                                            value={role}
                                            onChange={(e) => setRole(e.target.value as Role)}
                                            className="input bg-neutral-50/50 border-neutral-100 hover:border-black transition-all"
                                        >
                                            <option value="viewer">Viewer - Read only clearance</option>
                                            <option value="marketing">Marketing - Content orchestration</option>
                                            <option value="developer">Developer - Infrastructure access</option>
                                            <option value="admin">Admin - Full sovereignty</option>
                                        </select>
                                    </div>

                                    {editingEmployee && (
                                        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShieldCheck className="w-4 h-4 text-amber-600" />
                                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Authority Lock</span>
                                            </div>
                                            <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                                                Changing a member's role will immediately revoke their active sessions and apply new clearance protocols.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-10 border-t border-neutral-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-4 bg-neutral-50 text-neutral-500 font-bold uppercase tracking-widest text-[10px] rounded-2xl hover:bg-neutral-100 transition-all border border-neutral-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-12 py-4 bg-black text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-neutral-800 shadow-2xl transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        'Processing...'
                                    ) : (
                                        editingEmployee ? 'Sync Profile' : 'Grant Clearances'
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
