import React from 'react';
import { RefreshCw, CheckCircle2, User, Shield, Mail, Lock, ShieldAlert, KeyRound, X } from 'lucide-react';

const AdminUserForm = ({
    userForm,
    setUserForm,
    onSubmit,
    onCancel,
    submitting,
    editingId,
    roles = []
}) => {
    return (
        <div className="card-premium-v3">
            <div className="card-header" style={{ padding: '2rem 2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                        {editingId ? 'Edit Management Identity' : 'Enroll New Administrator'}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                        Configure profile details and granular page permissions.
                    </p>
                </div>
                <button
                    onClick={onCancel}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                    <X size={18} />
                </button>
            </div>

            <form style={{ padding: '0 2rem 2rem' }} onSubmit={onSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                    <div className="field-v3">
                        <span>Legal Full Name</span>
                        <div className="input-with-icon">
                            <User size={18} className="input-icon" />
                            <input
                                required
                                value={userForm.full_name}
                                onChange={(e) => setUserForm((p) => ({ ...p, full_name: e.target.value }))}
                                placeholder="Amit Kumar"
                            />
                        </div>
                    </div>

                    <div className="field-v3">
                        <span>Username</span>
                        <div className="input-with-icon">
                            <Shield size={18} className="input-icon" />
                            <input
                                required
                                disabled={!!editingId}
                                value={userForm.username}
                                onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                                placeholder="staff_profile"
                            />
                        </div>
                    </div>

                    <div className="field-v3">
                        <span>Corporate Email</span>
                        <div className="input-with-icon">
                            <Mail size={18} className="input-icon" />
                            <input
                                required={!editingId}
                                type="email"
                                disabled={!!editingId}
                                value={userForm.email}
                                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                                placeholder="staff@hospital.com"
                            />
                        </div>
                    </div>

                    <div className="field-v3">
                        <span>{editingId ? 'Reset Access Password' : 'Initial Password'}</span>
                        <div className="input-with-icon">
                            <Lock size={18} className="input-icon" />
                            <input
                                required={!editingId}
                                type="password"
                                value={userForm.password}
                                onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                                placeholder={editingId ? "Leave blank to keep current" : "Secure password"}
                            />
                        </div>
                    </div>
                </div>

                <div className="section-divider-v3">
                    <span>Account Access & Security</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                    <div className="field-v3">
                        <span>Assigned Access Role</span>
                        <select
                            value={userForm.role}
                            onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}
                            className="select-v3"
                        >
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '18px', border: '1px solid #e2e8f0', height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: userForm.is_active ? '#ecfdf5' : '#fee2e2', color: userForm.is_active ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>Access Status</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Revoke or grant authorization</div>
                            </div>
                        </div>
                        <label className="switch-premium">
                            <input
                                type="checkbox"
                                checked={userForm.is_active}
                                onChange={(e) => setUserForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <span className="slider-premium"></span>
                        </label>
                    </div>
                </div>

                <div className="field-v3" style={{ marginTop: '2rem' }}>
                    <span>Page Accessibility (Granular Permissions)</span>
                    <div className="permissions-grid-v3">
                        {[
                            { id: 'view_dashboard', label: 'Dashboard' },
                            { id: 'view_patients', label: 'Patients' },
                            { id: 'view_appointments', label: 'Appointments' },
                            { id: 'view_scheduling', label: 'Scheduling' },
                            { id: 'view_queue', label: 'Queue Tokens' },
                            { id: 'view_mrd', label: 'MRD' },
                            { id: 'view_bot_hub', label: 'Bot Hub' },
                            { id: 'view_doctors', label: 'Doctors' },
                            { id: 'view_admins', label: 'Admin Control' },
                            { id: 'view_reports', label: 'Reports' },
                            { id: 'view_notifications', label: 'Notifications' },
                            { id: 'view_settings', label: 'Settings' }
                        ].map((perm) => (
                            <label key={perm.id} className="permission-item-v3">
                                <input
                                    type="checkbox"
                                    checked={(userForm.permissions || []).includes(perm.id)}
                                    onChange={(e) => {
                                        const current = userForm.permissions || [];
                                        const next = e.target.checked
                                            ? [...current, perm.id]
                                            : current.filter((id) => id !== perm.id);
                                        setUserForm((p) => ({ ...p, permissions: next }));
                                    }}
                                />
                                <span>{perm.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                    <button className="btn-primary-v3" disabled={submitting} style={{ flex: 1, padding: '1rem' }}>
                        {submitting ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                        {editingId ? 'Synchronize Identity' : 'Complete Enrollment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminUserForm;
