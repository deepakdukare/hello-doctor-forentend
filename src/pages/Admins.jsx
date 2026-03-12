import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle, CheckCircle2, Edit2, Eye, Mail, Plus, RefreshCw, Search,
    Shield, ShieldCheck, ShieldX, Trash2, User, Users, X, Fingerprint
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

const ROLE_PRESETS = [
    { id: 'super_admin', label: 'Super Admin', description: 'Full system access' },
    { id: 'admin', label: 'Admin', description: 'Clinic management access' },
    { id: 'staff', label: 'Staff', description: 'Appointment and patient access' },
    { id: 'secretary', label: 'Secretary', description: 'Reception and scheduling' },
    { id: 'doctor', label: 'Doctor', description: 'Clinical and Medical Documentation access' },
    { id: 'nurse', label: 'Nurse', description: 'Vitals and clinical assistance' },
    { id: 'receptionist', label: 'Receptionist', description: 'Tokens, billing and registration' }
];

const PERMISSION_LABELS = {
    view_dashboard: 'Dashboard',
    view_patients: 'Patients',
    view_appointments: 'Appointments',
    edit_appointments: 'Appointments Edit',
    view_scheduling: 'Scheduling',
    view_queue: 'Queue Tokens',
    view_mrd: 'Medical Documentation',
    view_bot_hub: 'Bot Hub',
    view_doctors: 'Doctors',
    view_admins: 'Admin Control',
    view_reports: 'Reports',
    view_notifications: 'Notifications',
    view_settings: 'Settings',
    view_patient_mobile: 'Show Patient Mobile',
    view_patient_email: 'Show Patient Email',
};

const normalizeRole = (role) => {
    const normalized = String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
    return normalized === 'superadmin' ? 'super_admin' : normalized;
};

const toRoleLabel = (role) => {
    const key = normalizeRole(role);
    const preset = ROLE_PRESETS.find((r) => r.id === key);
    if (preset) return preset.label;
    if (!key) return 'User';
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const toPermissionLabel = (permission) => {
    const key = String(permission || '').trim();
    if (!key) return '';
    if (PERMISSION_LABELS[key]) return PERMISSION_LABELS[key];
    return key
        .replace(/^view_/, '')
        .replace(/^edit_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

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
    const [activeSection, setActiveSection] = useState('roles');
    const [editingProfile, setEditingProfile] = useState(false);

    const localUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
    const isDoctor = localUser?.role === 'doctor';

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

    const roleCards = useMemo(() => {
        const presetMap = new Map(ROLE_PRESETS.map((role) => [role.id, role]));
        const dynamicRoles = (roles || []).map((role) => {
            const roleId = normalizeRole(role.id || role.role);
            return {
                id: roleId,
                label: role.label || toRoleLabel(roleId),
                description: role.description || presetMap.get(roleId)?.description || 'System role'
            };
        });
        const merged = [...ROLE_PRESETS];
        dynamicRoles.forEach((role) => {
            if (!merged.some((preset) => preset.id === role.id)) {
                merged.push(role);
            }
        });
        return merged;
    }, [roles]);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            const roleOk = roleFilter === 'all' || normalizeRole(u.role) === normalizeRole(roleFilter);
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
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>System Settings</h1>
                    <p>Configuration and access control</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={refreshAll} disabled={refreshing || loading}>
                        <RefreshCw size={16} className={refreshing || loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                    {!isDoctor && (
                        <button className="btn-header-v4 btn-primary-v4" onClick={handleCreateClick}>
                            <Plus size={16} />
                            <span>New Admin</span>
                        </button>
                    )}
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

            <div className="stats-grid-v4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
                <StatCard title="Active Users" value={overview?.counts?.active_users} icon={Users} color="#6366f1" />
                <StatCard title="Clinicians" value={overview?.counts?.doctors} icon={Shield} color="#0ea5e9" />
                <StatCard title="Patients" value={overview?.counts?.patients} icon={User} color="#10b981" />
                <StatCard title="Audit Logs" value={overview?.counts?.total_audit_logs} icon={Eye} color="#f59e0b" />
            </div>

            {/* Tab Navigation */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '0' }}>
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9' }}>
                    <button
                        onClick={() => setActiveSection('roles')}
                        style={{
                            flex: 1,
                            padding: '1.5rem 2rem',
                            border: 'none',
                            background: activeSection === 'roles' ? '#fff' : '#fcfdfe',
                            borderBottom: activeSection === 'roles' ? '3px solid #6366f1' : 'none',
                            color: activeSection === 'roles' ? '#6366f1' : '#64748b',
                            fontWeight: activeSection === 'roles' ? 800 : 600,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left'
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== 'roles') {
                                e.target.style.background = '#f8fafc';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== 'roles') {
                                e.target.style.background = '#fcfdfe';
                            }
                        }}
                    >
                        Role Distribution
                    </button>
                    <button
                        onClick={() => setActiveSection('account')}
                        style={{
                            flex: 1,
                            padding: '1.5rem 2rem',
                            border: 'none',
                            background: activeSection === 'account' ? '#fff' : '#fcfdfe',
                            borderBottom: activeSection === 'account' ? '3px solid #6366f1' : 'none',
                            color: activeSection === 'account' ? '#6366f1' : '#64748b',
                            fontWeight: activeSection === 'account' ? 800 : 600,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            borderLeft: '1px solid #f1f5f9'
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== 'account') {
                                e.target.style.background = '#f8fafc';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== 'account') {
                                e.target.style.background = '#fcfdfe';
                            }
                        }}
                    >
                        Account Settings
                    </button>
                    <button
                        onClick={() => setActiveSection('directory')}
                        style={{
                            flex: 1,
                            padding: '1.5rem 2rem',
                            border: 'none',
                            background: activeSection === 'directory' ? '#fff' : '#fcfdfe',
                            borderBottom: activeSection === 'directory' ? '3px solid #6366f1' : 'none',
                            color: activeSection === 'directory' ? '#6366f1' : '#64748b',
                            fontWeight: activeSection === 'directory' ? 800 : 600,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            borderLeft: '1px solid #f1f5f9'
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== 'directory') {
                                e.target.style.background = '#f8fafc';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== 'directory') {
                                e.target.style.background = '#fcfdfe';
                            }
                        }}
                    >
                        Admin User Directory
                    </button>
                    <button
                        onClick={() => setActiveSection('clinic')}
                        style={{
                            flex: 1,
                            padding: '1.5rem 2rem',
                            border: 'none',
                            background: activeSection === 'clinic' ? '#fff' : '#fcfdfe',
                            borderBottom: activeSection === 'clinic' ? '3px solid #6366f1' : 'none',
                            color: activeSection === 'clinic' ? '#6366f1' : '#64748b',
                            fontWeight: activeSection === 'clinic' ? 800 : 600,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            borderLeft: '1px solid #f1f5f9'
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== 'clinic') {
                                e.target.style.background = '#f8fafc';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== 'clinic') {
                                e.target.style.background = '#fcfdfe';
                            }
                        }}
                    >
                        Clinic Config
                    </button>
                </div>
            </div>

            {/* Tab Content - Clinic Config */}
            {activeSection === 'clinic' && (
                <div className="card shadow-premium" style={{ marginBottom: '1.5rem', padding: '2rem' }}>
                    <div className="card-header" style={{ padding: '0 0 1.5rem 0', borderBottom: '1px solid #f1f5f9', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Clinical Configuration</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div className="clinic-info-group">
                            <h4 style={{ color: '#6366f1', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={18} /> General Identity
                            </h4>
                            <div className="input-group-v3" style={{ marginBottom: '1rem' }}>
                                <label>Clinic Name</label>
                                <input type="text" className="input-premium" value="Dr. Indu Child Care Clinic" readOnly />
                            </div>
                            <div className="input-group-v3">
                                <label>Provider ID / License</label>
                                <input type="text" className="input-premium" value="DICC-HR-001" readOnly />
                            </div>
                        </div>

                        <div className="clinic-info-group">
                            <h4 style={{ color: '#0ea5e9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={18} /> Communication
                            </h4>
                            <div className="input-group-v3" style={{ marginBottom: '1rem' }}>
                                <label>Primary Email</label>
                                <input type="text" className="input-premium" value="support@drinduchildcare.com" readOnly />
                            </div>
                            <div className="input-group-v3">
                                <label>Contact Number</label>
                                <input type="text" className="input-premium" value="+91 99999 99999" readOnly />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b' }}>
                            <AlertCircle size={20} />
                            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                                Clinic-wide configurations are managed by the System Super-Admin. Contact IT support for changes.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content - Role Distribution */}
            {activeSection === 'roles' && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <h3>Role Distribution</h3>
                    </div>
                    <div className="roles-grid">
                        {roleCards.map((role) => {
                            const roleId = normalizeRole(role.id || role.role);
                            const roleCount = overview?.roles?.[roleId]
                                ?? (roleId === 'super_admin' ? overview?.roles?.superadmin : undefined)
                                ?? 0;
                            return (
                                <div key={roleId} className="role-chip">
                                    <div>
                                        <div className="role-chip-title">{role.label || toRoleLabel(roleId)}</div>
                                        <div className="role-chip-desc">{role.description || 'System role'}</div>
                                    </div>
                                    <span className="badge badge-primary">{roleCount}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tab Content - Account Settings */}
            {activeSection === 'account' && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header" style={{ padding: '1.75rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Account Settings</h3>
                        </div>
                        {!editingProfile && (
                            <button
                                onClick={() => setEditingProfile(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.65rem 1.25rem',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                                onMouseLeave={(e) => e.target.style.opacity = '1'}
                                title="Edit Profile"
                            >
                                <Edit2 size={16} />
                                Edit
                            </button>
                        )}
                    </div>
                    <div style={{ padding: '1.5rem 2rem' }}>
                        {!editingProfile ? (
                            <>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '16px' }}>
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: '1.4rem'
                                    }}>
                                        {(profile?.full_name || profile?.username || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{profile?.full_name || 'System Admin'}</div>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                            <span style={{
                                                background: '#6366f1',
                                                color: '#fff',
                                                padding: '0.35rem 0.85rem',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                {toRoleLabel(profile?.role).toUpperCase()}
                                            </span>
                                            <span style={{
                                                background: profile?.is_active ? '#d1fae5' : '#fee2e2',
                                                color: profile?.is_active ? '#059669' : '#dc2626',
                                                padding: '0.35rem 0.85rem',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                {profile?.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                    <div style={{
                                        padding: '1.25rem',
                                        border: '1px solid #f1f5f9',
                                        borderRadius: '12px',
                                        background: '#fff'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Fingerprint size={14} /> Username
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{profile?.username || '-'}</div>
                                    </div>
                                    <div style={{
                                        padding: '1.25rem',
                                        border: '1px solid #f1f5f9',
                                        borderRadius: '12px',
                                        background: '#fff'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Mail size={14} /> Email
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', wordBreak: 'break-all' }}>{profile?.email || '-'}</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <AdminProfile
                                    profile={profile}
                                    profileForm={profileForm}
                                    setProfileForm={setProfileForm}
                                    onSaveProfile={(e) => {
                                        handleSaveProfile(e);
                                        setEditingProfile(false);
                                    }}
                                    loading={profileLookupLoading}
                                    submitting={submittingProfile}
                                    formatDate={formatDate}
                                />
                                <button
                                    onClick={() => setEditingProfile(false)}
                                    style={{
                                        marginTop: '1rem',
                                        padding: '0.7rem 1.5rem',
                                        background: '#f1f5f9',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = '#e2e8f0';
                                        e.target.style.borderColor = '#cbd5e1';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = '#f1f5f9';
                                        e.target.style.borderColor = '#e2e8f0';
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* optional user form overlay remains unchanged */}
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

            {!isDoctor && activeSection === 'directory' && (
                <div className="card shadow-premium" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden' }}>
                    <div
                        className="card-header"
                        style={{ padding: '1.75rem 2rem', borderBottom: '1px solid #f1f5f9' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Admin User Directory</h3>
                            </div>
                            <span className="badge-v3" style={{ background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem' }}>
                                {filteredUsers.length} Total Users
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
                                {roleCards.map((r) => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                            </select>
                            <select className="select-v3" value={permissionFilter} onChange={(e) => setPermissionFilter(e.target.value)}>
                                <option value="all">Any Permission</option>
                                {permissionTags.map((tag) => (
                                    <option key={tag} value={tag}>{toPermissionLabel(tag)}</option>
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
                            <div className="admin-table-wrap">
                                <table className="admin-table-premium">
                                    <thead>
                                        <tr>
                                            <th>Identity Profile</th>
                                            <th>Access Level</th>
                                            <th>Authorized Pages</th>
                                            <th>Status</th>
                                            <th>Safety Check</th>
                                            <th style={{ textAlign: 'right' }}>Management</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="admin-empty-cell">No matching users found for current filters.</td>
                                            </tr>
                                        ) : filteredUsers.map((user) => (
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
                                                    {(() => {
                                                        const roleKey = normalizeRole(user.role);
                                                        const isSuperAdminRole = roleKey === 'super_admin';
                                                        const isDoctorRole = roleKey === 'doctor';
                                                        return (
                                                            <span className="role-badge-v3" style={{
                                                                background: isSuperAdminRole ? '#fef2f2' : isDoctorRole ? '#ecfdf5' : '#eff6ff',
                                                                color: isSuperAdminRole ? '#ef4444' : isDoctorRole ? '#10b981' : '#3b82f6',
                                                                border: `1px solid ${isSuperAdminRole ? '#fee2e2' : isDoctorRole ? '#d1fae5' : '#dbeafe'}`
                                                            }}>
                                                                {toRoleLabel(user.role)}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    <div className="permission-list" style={{ display: 'flex', gap: '0.35rem' }}>
                                                        {(user.permissions || []).slice(0, 3).map((p) => (
                                                            <span key={p} className="tag-badge-v3">{toPermissionLabel(p)}</span>
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
                                                        {normalizeRole(user.role) !== 'super_admin' && (
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
                            </div>
                        )}
                    </div>
                </div>
            )}



        </div>
    );
};

export default Admins;
