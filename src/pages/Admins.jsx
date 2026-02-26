import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Plus, Edit2, Shield, RefreshCw,
    AlertCircle, Check, X, User, Mail, ShieldCheck
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (editingId) {
                // Remove password from update if empty
                const updateData = { ...form };
                if (!updateData.password) delete updateData.password;

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
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="title-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Admin & Staff</h1>
                        <p>Manage dashboard access for clinic staff.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
                            {showForm ? <X size={18} /> : <Plus size={18} />}
                            {showForm ? 'Cancel' : 'New User'}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert-item" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', marginBottom: '1.5rem' }}>
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {success && (
                <div className="alert-item" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', marginBottom: '1.5rem' }}>
                    <Check size={20} /> {success}
                </div>
            )}

            {showForm && (
                <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--primary)', background: '#fcfdff' }}>
                    <div className="card-header">
                        <h3>{editingId ? 'Edit User Access' : 'Register New Staff'}</h3>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Full Name *</label>
                            <input
                                required
                                type="text"
                                value={form.full_name}
                                onChange={e => setForm({ ...form, full_name: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="E.g. Dr. Indu"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Username / ID *</label>
                            <input
                                required
                                type="text"
                                value={form.username}
                                onChange={e => setForm({ ...form, username: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="dr_indu_official"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Email Address</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="name@clinic.com"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                {editingId ? 'New Password (Optional)' : 'Default Password *'}
                            </label>
                            <input
                                required={!editingId}
                                type="password"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Access Level</label>
                            <select
                                value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white' }}
                            >
                                <option value="admin">Administrator</option>
                                <option value="staff">Staff / Secretary</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, height: '45px' }}>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                    id="is-active-staff"
                                />
                                <label htmlFor="is-active-staff" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Enabled</label>
                            </div>
                            <button className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                                {editingId ? 'Update Access' : 'Grant Access'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3>Authorized Users ({users.length})</h3>
                </div>
                {loading && !users.length ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name & Username</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user._id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {user.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{user.full_name || user.username}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>@{user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Shield size={14} color={user.role === 'admin' ? '#6366f1' : '#64748b'} />
                                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{user.role}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-gray'}`}>
                                            {user.is_active ? 'ACTIVE' : 'DISABLED'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-outline" style={{ padding: '0.4rem', height: 'auto' }} onClick={() => handleEdit(user)}>
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Admins;
