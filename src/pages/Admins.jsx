import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Plus, Edit2, Shield, RefreshCw,
    AlertCircle, Check, X, User, Mail, ShieldCheck,
    Calendar, Clock, Lock, ShieldAlert, MoreVertical
} from 'lucide-react';
import {
    getAdminUsers, createAdminUser, updateAdminUser
} from '../api/index';

const Admins = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'admin',
        is_active: true
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAdminUsers();
            // The API returns { success: true, data: [...] }
            setUsers(res.data.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (user) => {
        setEditingId(user._id);
        setForm({
            username: user.username,
            email: user.email || '',
            full_name: user.full_name || '',
            role: user.role || 'admin',
            is_active: user.is_active,
            password: '' // Don't pre-fill password
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (editingId) {
                // Remove username and email from update if they shouldn't be changed via this endpoint
                // The snippet shows full_name, role, is_active for PATCH
                const updateData = {
                    full_name: form.full_name,
                    role: form.role,
                    is_active: form.is_active
                };
                if (form.password) updateData.password = form.password;

                await updateAdminUser(editingId, updateData);
                setSuccess("User updated successfully.");
            } else {
                await createAdminUser(form);
                setSuccess("New admin user created.");
            }
            setShowForm(false);
            setEditingId(null);
            setForm({ username: '', email: '', password: '', full_name: '', role: 'admin', is_active: true });
            fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRoleBadgeClass = (role) => {
        switch (role?.toLowerCase()) {
            case 'superadmin': return 'badge-danger';
            case 'admin': return 'badge-primary';
            case 'staff': return 'badge-gray';
            case 'secretary': return 'badge-warning';
            default: return 'badge-gray';
        }
    };

    const getRoleIcon = (role) => {
        switch (role?.toLowerCase()) {
            case 'superadmin': return <ShieldAlert size={14} />;
            case 'admin': return <Shield size={14} />;
            default: return <User size={14} />;
        }
    };

    return (
        <div className="admins-page" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="title-section" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                                <ShieldCheck size={24} />
                            </div>
                            <h1>Admin Users</h1>
                        </div>
                        <p>Manage access levels, staff accounts, and security permissions.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className="btn btn-outline"
                            onClick={fetchData}
                            disabled={loading}
                            style={{ padding: '0.75rem' }}
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (showForm) {
                                    setShowForm(false);
                                    setEditingId(null);
                                    setForm({ username: '', email: '', password: '', full_name: '', role: 'admin', is_active: true });
                                } else {
                                    setShowForm(true);
                                }
                            }}
                        >
                            {showForm ? <X size={18} /> : <Plus size={18} />}
                            {showForm ? 'Cancel' : 'Add New User'}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert-item" style={{
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#e11d48',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.05)'
                }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                </div>
            )}

            {success && (
                <div className="alert-item" style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#16a34a',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.05)'
                }}>
                    <Check size={20} />
                    <span style={{ fontWeight: 600 }}>{success}</span>
                </div>
            )}

            {showForm && (
                <div className="card" style={{
                    marginBottom: '2.5rem',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    background: 'linear-gradient(to bottom right, #ffffff, #fcfdff)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)'
                }}>
                    <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {editingId ? <Edit2 size={18} color="var(--primary)" /> : <User size={18} color="var(--primary)" />}
                            {editingId ? 'Edit User Permissions' : 'Register New Staff Account'}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {editingId ? 'Update existing user credentials and access level.' : 'Create a new account with specific access rights.'}
                        </p>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Full Name *</label>
                            <div style={{ position: 'relative' }}>
                                <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <input
                                    required
                                    type="text"
                                    value={form.full_name}
                                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                    placeholder="e.g. Dr. Indu Dukare"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Username / Access ID *</label>
                            <div style={{ position: 'relative' }}>
                                <Shield style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <input
                                    required
                                    disabled={!!editingId}
                                    type="text"
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.75rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        backgroundColor: editingId ? '#f8fafc' : 'white'
                                    }}
                                    placeholder="e.g. staff_indu_01"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <input
                                    type="email"
                                    disabled={!!editingId}
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.75rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        backgroundColor: editingId ? '#f8fafc' : 'white'
                                    }}
                                    placeholder="name@dicc.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                                {editingId ? 'Update Password (Optional)' : 'Secret Password *'}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <input
                                    required={!editingId}
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Access Hierarchy</label>
                            <div style={{ position: 'relative' }}>
                                <ShieldAlert style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', appearance: 'none', fontSize: '0.95rem' }}
                                >
                                    <option value="superadmin">Super Administrator</option>
                                    <option value="admin">Clinic Administrator</option>
                                    <option value="secretary">Clinic Secretary</option>
                                    <option value="staff">Staff Member</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', height: '48px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    className="custom-checkbox"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                    id="is-active-staff"
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="is-active-staff" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Account Active</label>
                            </div>
                            <button className="btn btn-primary" style={{ flex: 1.5, height: '48px' }} disabled={submitting}>
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : (editingId ? <Check size={18} /> : <ShieldCheck size={18} />)}
                                {editingId ? 'Save Changes' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h3>Authorized Access Points</h3>
                        <span className="badge badge-primary" style={{ borderRadius: '20px', padding: '0.2rem 0.75rem' }}>{users.length} Total</span>
                    </div>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                    {loading && !users.length ? (
                        <div style={{ textAlign: 'center', padding: '5rem' }}>
                            <div className="loader-container">
                                <RefreshCw className="animate-spin" size={40} color="var(--primary)" />
                                <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Syncing user database...</p>
                            </div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '1.25rem' }}>Identity</th>
                                    <th>Role & Authorization</th>
                                    <th>Status</th>
                                    <th>Last Activity</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user._id} className="user-row">
                                        <td style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: '14px',
                                                    background: user.role === 'superadmin' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: '1.1rem',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                                }}>
                                                    {user.full_name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{user.full_name || user.username}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <Mail size={12} /> {user.email || 'No email'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ textTransform: 'uppercase', fontSize: '0.65rem', gap: '0.4rem' }}>
                                                    {getRoleIcon(user.role)}
                                                    {user.role}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: user.is_active ? '#10b981' : '#94a3b8'
                                                }}></div>
                                                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: user.is_active ? '#059669' : '#64748b' }}>
                                                    {user.is_active ? 'ENABLED' : 'DISABLED'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Calendar size={12} /> Joined: {formatDate(user.created_at).split(',')[0]}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Clock size={12} /> Last: {formatDate(user.last_login_at)}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    className="btn-action"
                                                    title="Edit Access"
                                                    onClick={() => handleEdit(user)}
                                                    style={{
                                                        background: '#f1f5f9',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        width: '36px',
                                                        height: '36px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#475569',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-action"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        width: '36px',
                                                        height: '36px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#94a3b8',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .user-row {
                    transition: all 0.2s;
                }
                
                .user-row:hover {
                    background-color: #f8fafc !important;
                }
                
                .user-row:hover .btn-action {
                    background-color: var(--primary-light) !important;
                    color: var(--primary) !important;
                }
                
                .btn-action:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }

                .custom-checkbox:checked {
                    accent-color: var(--primary);
                }

                input:focus, select:focus {
                    outline: none;
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
                }

                @media (max-width: 768px) {
                    .admins-page {
                        padding-bottom: 2rem;
                    }
                    th:nth-child(4), td:nth-child(4) {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default Admins;

