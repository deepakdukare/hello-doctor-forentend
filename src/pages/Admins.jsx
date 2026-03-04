import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle, CheckCircle2, Edit2, Eye, Mail, Plus, RefreshCw, Search,
    Shield, ShieldCheck, ShieldX, Trash2, User, Users
} from 'lucide-react';
import StatCard from '../components/StatCard';
import AdminUserForm from '../components/AdminUserForm';
import AdminProfile from '../components/AdminProfile';
import {
    createAdminUser,
    deleteAdminUser,
    getAdminOverview,
    getAdminProfile,
    getAdminRoles,
    getAdminUsers,
    updateAdminProfile,
    updateAdminUser
} from '../api/index';

const emptyUserForm = {
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'admin',
    is_active: true,
    permissions: ['view_dashboard']
};

const Admins = () => {
    const [users, setUsers] = useState([]);
    const [overview, setOverview] = useState(null);
    const [roles, setRoles] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submittingUser, setSubmittingUser] = useState(false);
    const [submittingProfile, setSubmittingProfile] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [permissionFilter, setPermissionFilter] = useState('all');

    const [showUserForm, setShowUserForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [userForm, setUserForm] = useState(emptyUserForm);

    const [profileForm, setProfileForm] = useState({
        full_name: '',
        email: '',
        current_password: '',
        new_password: ''
    });
    const [profileLookupLoading, setProfileLookupLoading] = useState(false);

    const localUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
    const isDoctor = localUser?.role === 'doctor';
    const isSuperAdmin = localUser?.role === 'super_admin';

    const loadAdminData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');
            const profileQuery = localUser?.id
                ? { user_id: localUser.id }
                : localUser?._id
                    ? { user_id: localUser._id }
                    : localUser?.username
                        ? { username: localUser.username }
                        : undefined;

            const [overviewRes, rolesRes, usersRes, profileRes] = await Promise.allSettled([
                getAdminOverview(),
                getAdminRoles(),
                getAdminUsers({ limit: 100 }),
                getAdminProfile(profileQuery)
            ]);

            if (overviewRes.status === 'fulfilled') {
                setOverview(overviewRes.value.data?.data || null);
            }
            if (rolesRes.status === 'fulfilled') {
                setRoles(rolesRes.value.data?.data || []);
            }
            if (usersRes.status === 'fulfilled') {
                setUsers(usersRes.value.data?.data || []);
            }
            if (profileRes.status === 'fulfilled') {
                const profileData = profileRes.value.data?.data || null;
                setProfile(profileData);
                setProfileForm({
                    full_name: profileData?.full_name || '',
                    email: profileData?.email || '',
                    current_password: '',
                    new_password: ''
                });
            }

            if (profileRes.status === 'rejected' && overviewRes.status === 'fulfilled') {
                setError('Profile lookup failed. Overview data is loaded.');
            }
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load admin data.');
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        await loadAdminData();
        setRefreshing(false);
    }, [loadAdminData]);

    useEffect(() => {
        loadAdminData();
    }, [loadAdminData]);

    useEffect(() => {
        if (!success) return undefined;
        const t = setTimeout(() => setSuccess(''), 2500);
        return () => clearTimeout(t);
    }, [success]);

    const permissionTags = useMemo(() => {
        const tags = new Set();
        users.forEach((u) => (u.permissions || []).forEach((p) => tags.add(p)));
        return [...tags];
    }, [users]);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            const roleOk = roleFilter === 'all' || String(u.role || '').toLowerCase() === roleFilter;
            const permissionOk =
                permissionFilter === 'all' || (u.permissions || []).includes(permissionFilter);
            const textOk =
                !q ||
                [u.username, u.email, u.full_name, u.role]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q));
            return roleOk && permissionOk && textOk;
        });
    }, [users, query, roleFilter, permissionFilter]);

    const handleCreateClick = () => {
        setEditingId(null);
        setUserForm(emptyUserForm);
        setShowUserForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEditClick = (user) => {
        setEditingId(user._id);
        setUserForm({
            username: user.username || '',
            email: user.email || '',
            password: '',
            full_name: user.full_name || '',
            role: user.role || 'admin',
            is_active: !!user.is_active,
            permissions: user.permissions || []
        });
        setShowUserForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSubmittingUser(true);
        setError('');
        try {
            const permissions = userForm.permissions || [];

            if (editingId) {
                const payload = {
                    full_name: userForm.full_name,
                    role: userForm.role,
                    is_active: userForm.is_active,
                    permissions
                };
                if (userForm.password) payload.password = userForm.password;
                await updateAdminUser(editingId, payload);
                setSuccess('Admin user updated.');
            } else {
                await createAdminUser({
                    username: userForm.username,
                    email: userForm.email,
                    password: userForm.password,
                    full_name: userForm.full_name,
                    role: userForm.role,
                    permissions
                });
                setSuccess('Admin user created.');
            }
            setShowUserForm(false);
            setUserForm(emptyUserForm);
            setEditingId(null);
            await refreshAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save admin user.');
        } finally {
            setSubmittingUser(false);
        }
    };

    const handleDeactivate = async (user) => {
        const ok = window.confirm(`Deactivate user "${user.username}"?`);
        if (!ok) return;
        setError('');
        try {
            await deleteAdminUser(user._id);
            setSuccess('Admin user deactivated.');
            await refreshAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to deactivate user.');
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!profile) return;
        setSubmittingProfile(true);
        setError('');
        try {
            await updateAdminProfile({
                user_id: profile.id,
                username: profile.username,
                current_password: profileForm.current_password,
                full_name: profileForm.full_name,
                email: profileForm.email,
                ...(profileForm.new_password ? { new_password: profileForm.new_password } : {})
            });
            setProfileForm((prev) => ({ ...prev, current_password: '', new_password: '' }));
            setSuccess('Profile updated.');
            await refreshAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSubmittingProfile(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="admins-page">
            <div className="title-section" style={{ marginBottom: '1.75rem' }}>
                <div className="admins-head">
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={28} /> Admin Control Center
                        </h1>
                        <p>Manage admin accounts, access roles, permission tags, and your own profile.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <button className="btn btn-outline" onClick={refreshAll} disabled={refreshing || loading}>
                            <RefreshCw size={16} className={refreshing || loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        {!isDoctor && (
                            <button className="btn btn-primary" onClick={handleCreateClick}>
                                <Plus size={16} />
                                New Admin User
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {(error || success) && (
                <div className="admins-message-wrap">
                    {error && (
                        <div className="alert-premium error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="alert-premium success">
                            <CheckCircle2 size={18} />
                            <span>{success}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="stats-grid" style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <StatCard label="Active Users" value={overview?.counts?.active_users} icon={Users} color="#6366f1" className="stat-pill-premium-v3" />
                <StatCard label="Doctors" value={overview?.counts?.doctors} icon={Shield} color="#0ea5e9" className="stat-pill-premium-v3" />
                <StatCard label="Patients" value={overview?.counts?.patients} icon={User} color="#10b981" className="stat-pill-premium-v3" />
                <StatCard label="Audit Logs" value={overview?.counts?.total_audit_logs} icon={Eye} color="#f59e0b" className="stat-pill-premium-v3" />
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3>Role Distribution</h3>
                </div>
                <div className="roles-grid">
                    {(roles.length ? roles : [{ id: 'admin', label: 'Admin' }]).map((role) => {
                        const roleId = role.id || role.role;
                        const roleCount = overview?.roles?.[roleId] ?? 0;
                        return (
                            <div key={roleId} className="role-chip">
                                <div>
                                    <div className="role-chip-title">{role.label || roleId}</div>
                                    <div className="role-chip-desc">{role.description || 'System role'}</div>
                                </div>
                                <span className="badge badge-primary">{roleCount}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="admins-grid">
                <AdminProfile
                    profile={profile}
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    onSaveProfile={handleSaveProfile}
                    loading={profileLookupLoading}
                    submitting={submittingProfile}
                    formatDate={formatDate}
                />

                {showUserForm && (
                    <AdminUserForm
                        userForm={userForm}
                        setUserForm={setUserForm}
                        onSubmit={handleSaveUser}
                        onCancel={() => { setShowUserForm(false); setEditingId(null); setUserForm(emptyUserForm); }}
                        submitting={submittingUser}
                        editingId={editingId}
                        roles={roles}
                    />
                )}
            </div>

            {!isDoctor && (
                <div className="card shadow-premium" style={{ marginTop: '2.5rem', padding: '0', borderRadius: '24px', overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '1.75rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Admin User Directory</h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Manage system access for staff, doctors, and operators.</p>
                            </div>
                            <span className="badge-v3" style={{ background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem' }}>
                                {filteredUsers.length} Logged Identities
                            </span>
                        </div>
                    </div>

                    <div className="admin-filters" style={{ padding: '1.5rem 2rem', background: '#fcfdfe', borderBottom: '1px solid #f1f5f9' }}>
                        <div className="search-box-v3" style={{ flex: 1, minWidth: '300px' }}>
                            <Search size={20} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Search identities by name, username, or role..."
                                style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none', padding: '0.85rem 0', fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <select className="select-v3" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                <option value="all">Every Role</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                            </select>
                            <select className="select-v3" value={permissionFilter} onChange={(e) => setPermissionFilter(e.target.value)}>
                                <option value="all">Any Permission</option>
                                {permissionTags.map((tag) => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ padding: '1rem 2rem 2rem' }}>
                        {loading ? (
                            <div style={{ padding: '4rem', textAlign: 'center' }}>
                                <RefreshCw size={32} className="animate-spin text-primary" style={{ marginBottom: '1rem' }} />
                                <p style={{ fontWeight: 700, color: '#64748b' }}>Syncing user registry...</p>
                            </div>
                        ) : (
                            <table className="admin-table-premium">
                                <thead>
                                    <tr>
                                        <th>Identity Profile</th>
                                        <th>Access level</th>
                                        <th>Authorized Pages</th>
                                        <th>Status</th>
                                        <th>Safety Check</th>
                                        <th style={{ textAlign: 'right' }}>Management</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr key={user._id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)', width: '48px', height: '48px', borderRadius: '15px' }}>
                                                        {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{user.full_name || user.username}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                                            <Mail size={12} /> {user.email || 'No email attached'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="role-badge-v3" style={{
                                                    background: user.role === 'super_admin' ? '#fef2f2' : user.role === 'doctor' ? '#ecfdf5' : '#eff6ff',
                                                    color: user.role === 'super_admin' ? '#ef4444' : user.role === 'doctor' ? '#10b981' : '#3b82f6',
                                                    border: `1px solid ${user.role === 'super_admin' ? '#fee2e2' : user.role === 'doctor' ? '#d1fae5' : '#dbeafe'}`
                                                }}>
                                                    {String(user.role || 'User').replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="permission-list" style={{ display: 'flex', gap: '0.35rem' }}>
                                                    {(user.permissions || []).slice(0, 3).map((p) => (
                                                        <span key={p} className="tag-badge-v3">{p}</span>
                                                    ))}
                                                    {(user.permissions || []).length > 3 && (
                                                        <span className="tag-badge-v3" style={{ background: '#fff' }}>+{(user.permissions || []).length - 3} more</span>
                                                    )}
                                                    {!(user.permissions || []).length && (
                                                        <span style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 600 }}>Standard Default</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {user.is_active ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 800, fontSize: '0.75rem' }}>
                                                        <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
                                                        ACTIVE
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f43f5e', fontWeight: 800, fontSize: '0.75rem' }}>
                                                        <div style={{ width: '6px', height: '6px', background: '#f43f5e', borderRadius: '50%' }}></div>
                                                        RESTRICTED
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                    Last seen: <span style={{ color: '#1e293b' }}>{formatDate(user.last_login_at)}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.6rem' }}>
                                                    <button className="btn-action" onClick={() => handleEditClick(user)} title="Configure Access">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    {user.role !== 'super_admin' && (
                                                        <button className="btn-action btn-danger" onClick={() => handleDeactivate(user)} title="Revoke Access">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .admins-page { animation: fadeIn 0.35s ease-out; padding: 2.5rem; max-width: 1400px; margin: 0 auto; }
                .admins-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 1rem;
                    align-items: flex-start;
                    flex-wrap: wrap;
                }
                .admins-message-wrap {
                    display: grid;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                }
                .admins-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 2rem;
                    align-items: start;
                }
                .roles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 0.75rem;
                }
                .role-chip {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    padding: 1.25rem;
                    background: linear-gradient(135deg, #ffffff, #f8fbff);
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }
                .role-chip-title { font-weight: 700; color: #0f172a; font-size: 0.95rem; }
                .role-chip-desc { color: #64748b; font-size: 0.8rem; margin-top: 0.2rem; }
                
                .profile-summary {
                    border: 1px solid #f1f5f9;
                    border-radius: 18px;
                    padding: 1.5rem;
                    display: flex;
                    gap: 1.25rem;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    background: linear-gradient(135deg, #ffffff, #f8fbff);
                }
                .profile-avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #4338ca, #6366f1);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.4rem;
                }
                .profile-name { font-size: 1.15rem; font-weight: 800; color: #0f172a; }
                .profile-meta { display: flex; gap: 0.5rem; margin-top: 0.35rem; }
                .profile-kv-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.85rem;
                    margin-bottom: 1.5rem;
                }
                .profile-kv {
                    border: 1px solid #f1f5f9;
                    border-radius: 14px;
                    padding: 1rem;
                    display: grid;
                    gap: 0.25rem;
                    background: #fff;
                }
                .profile-kv span { font-size: 0.725rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; }
                .profile-kv strong { font-size: 0.9rem; color: #1e293b; word-break: break-all; }
                .admin-filters {
                    padding: 1.25rem;
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                    align-items: center;
                    background: #fcfdfe;
                }
                .admin-filters select {
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 0.75rem 1rem;
                    min-width: 180px;
                    background: #fff;
                    font-weight: 600;
                    color: #475569;
                    font-family: inherit;
                    outline: none;
                }
                .admin-filters select:focus { border-color: #6366f1; }
                .user-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 15px;
                    background: linear-gradient(135deg, #4338ca, #6366f1);
                    color: #fff;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                }
                .permission-list {
                    display: flex;
                    gap: 0.4rem;
                    flex-wrap: wrap;
                }
                .btn-action {
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    width: 38px;
                    height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-action:hover { background: #f8fafc; border-color: #6366f1; color: #6366f1; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
                .btn-action.btn-danger:hover { background: #fee2e2; border-color: #ef4444; color: #ef4444; }
                
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                @media (max-width: 768px) {
                    .admins-page { padding: 1rem; }
                    .admin-filters select { min-width: 100%; }
                    .admins-grid { grid-template-columns: 1fr; }
                }

                .alert-premium {
                    padding: 1.25rem 2rem;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-weight: 700;
                    border: 1px solid transparent;
                }
                .alert-premium.success { background: #f0fdf4; border-color: #dcfce7; color: #166534; }
                .alert-premium.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
            `}</style>

        </div>
    );
};

export default Admins;
