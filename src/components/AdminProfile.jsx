import React from 'react';
import { RefreshCw, Search, ShieldCheck, ShieldX, KeyRound, User as UserIcon, Mail, Fingerprint } from 'lucide-react';

const AdminProfile = ({
    profile,
    profileForm,
    setProfileForm,
    profileLookup,
    setProfileLookup,
    onFetchProfile,
    onSaveProfile,
    loading,
    submitting,
    formatDate
}) => {
    return (
        <div className="card shadow-premium" style={{ borderRadius: '24px' }}>
            <div className="card-header" style={{ padding: '2rem 2rem 1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
                    <UserIcon size={24} className="text-primary" />
                    Account Settings
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>View and update your administrative profile details.</p>
            </div>

            <div style={{ padding: '0 2rem 2rem' }}>
                <div className="profile-summary" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '20px', marginBottom: '2rem' }}>
                    <div className="profile-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                        {(profile?.full_name || profile?.username || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="profile-name" style={{ fontSize: '1.25rem' }}>{profile?.full_name || 'System Admin'}</div>
                        <div className="profile-meta" style={{ marginTop: '0.5rem' }}>
                            <span className="badge-v3" style={{ background: '#6366f1', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {String(profile?.role || 'Admin').toUpperCase()}
                            </span>
                            {profile?.is_active ? (
                                <span className="status-pill confirmed" style={{ padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                                    <ShieldCheck size={14} /> Active Account
                                </span>
                            ) : (
                                <span className="status-pill cancelled" style={{ padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                                    <ShieldX size={14} /> Inactive
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="profile-kv-grid" style={{ marginBottom: '2.5rem' }}>
                    <div className="profile-kv" style={{ padding: '1.25rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Fingerprint size={14} color="#94a3b8" />
                            <span>Username</span>
                        </div>
                        <strong>{profile?.username || '-'}</strong>
                    </div>
                    <div className="profile-kv" style={{ padding: '1.25rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Mail size={14} color="#94a3b8" />
                            <span>Email</span>
                        </div>
                        <strong>{profile?.email || '-'}</strong>
                    </div>
                </div>

                <form className="form-grid-1" onSubmit={onSaveProfile}>
                    <div className="section-divider-v3" style={{ marginBottom: '1.5rem' }}>
                        <span>Update Information</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="field-v3">
                            <span>Full Name</span>
                            <div className="input-with-icon">
                                <UserIcon size={18} className="input-icon" />
                                <input
                                    required
                                    value={profileForm.full_name}
                                    onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>
                        <div className="field-v3">
                            <span>Email Address</span>
                            <div className="input-with-icon">
                                <Mail size={18} className="input-icon" />
                                <input
                                    required
                                    type="email"
                                    value={profileForm.email}
                                    onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
                        <div className="field-v3">
                            <span>Current Password</span>
                            <div className="input-with-icon">
                                <KeyRound size={18} className="input-icon" />
                                <input
                                    required
                                    type="password"
                                    value={profileForm.current_password}
                                    onChange={(e) => setProfileForm((p) => ({ ...p, current_password: e.target.value }))}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div className="field-v3">
                            <span>New Password (Optional)</span>
                            <div className="input-with-icon">
                                <RefreshCw size={18} className="input-icon" />
                                <input
                                    type="password"
                                    value={profileForm.new_password}
                                    onChange={(e) => setProfileForm((p) => ({ ...p, new_password: e.target.value }))}
                                    placeholder="Enter new password"
                                />
                            </div>
                        </div>
                    </div>

                    <button className="btn-primary-v3" disabled={submitting} style={{ marginTop: '2rem', width: '100%', padding: '1rem', borderRadius: '14px' }}>
                        {submitting ? <RefreshCw size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminProfile;
