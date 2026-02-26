import React, { useState, useEffect, useCallback } from 'react';
import {
    Stethoscope, Plus, Edit2, Trash2, RefreshCw,
    AlertCircle, Check, X, User, Briefcase, Mail,
    Shield, CheckCircle2, MoreVertical, Star, Award,
    Activity, ArrowRight, ExternalLink
} from 'lucide-react';
import {
    getDoctors, createDoctor, updateDoctor, deleteDoctor
} from '../api/index';

const Doctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        name: '',
        registration_number: '',
        speciality: 'Pediatrics',
        is_active: true
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getDoctors();
            setDoctors(res.data.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (doc) => {
        setEditingId(doc.doctor_id);
        setForm({
            name: doc.name,
            registration_number: doc.registration_number || '',
            speciality: doc.speciality || 'Pediatrics',
            is_active: doc.is_active
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this doctor profile? This might affect existing appointment records.")) return;
        try {
            await deleteDoctor(id);
            setSuccess("Doctor profile removed successfully.");
            fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError("Failed to delete doctor profile.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (editingId) {
                await updateDoctor(editingId, form);
                setSuccess("Doctor profile updated successfully.");
            } else {
                await createDoctor(form);
                setSuccess("New doctor added to the registry.");
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ name: '', registration_number: '', speciality: 'Pediatrics', is_active: true });
            fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (doc) => {
        try {
            await updateDoctor(doc.doctor_id, { ...doc, is_active: !doc.is_active });
            fetchData();
        } catch (err) {
            setError("Failed to toggle status");
        }
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #1e293b 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Medical Practitioners
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Manage clinic doctors, specialities, and clinical credentials</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchData}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '14px', background: '#fff', border: '1px solid var(--border-color)', fontWeight: 600 }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh Registry
                    </button>
                    <button
                        onClick={() => { setShowModal(true); setEditingId(null); setForm({ name: '', registration_number: '', speciality: 'Pediatrics', is_active: true }); }}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', border: 'none', color: '#fff', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' }}
                    >
                        <Plus size={20} />
                        Add New Doctor
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '2rem', color: '#ef4444', display: 'flex', gap: '1rem', alignItems: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                    <AlertCircle size={22} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                    <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={20} /></button>
                </div>
            )}

            {success && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '2rem', color: '#16a34a', display: 'flex', gap: '1rem', alignItems: 'center', animation: 'fadeInUp 0.3s ease-out' }}>
                    <CheckCircle2 size={22} />
                    <span style={{ fontWeight: 600 }}>{success}</span>
                </div>
            )}

            {/* Content Section */}
            {loading && !doctors.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card skeleton" style={{ height: '240px', borderRadius: '24px' }}></div>
                    ))}
                </div>
            ) : !doctors.length ? (
                <div className="card" style={{ padding: '6rem 2rem', textAlign: 'center', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '32px' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', width: '100px', height: '100px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--primary)' }}>
                        <Stethoscope size={48} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem 0' }}>Registry is Empty</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 2rem', fontSize: '1.1rem' }}>Enroll your clinic practitioners to start managing appointments and schedules.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 2rem', borderRadius: '14px' }}
                    >
                        Enroll First Doctor
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
                    {doctors.map((doc) => (
                        <div key={doc.doctor_id} className="card hover-card" style={{ padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.5)', background: doc.is_active ? 'rgba(255,255,255,0.8)' : '#f8fafc', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}>
                            {!doc.is_active && <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#e2e8f0', color: '#64748b', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800 }}>INACTIVE</div>}

                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={32} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleEdit(doc)} className="icon-btn-v2" style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.08)' }}><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(doc.doctor_id)} className="icon-btn-v2" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}><Trash2 size={18} /></button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.25rem 0' }}>{doc.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', fontWeight: 700, fontSize: '0.9rem' }}>
                                    <Award size={16} />
                                    {doc.speciality}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'rgba(241, 245, 249, 0.5)', borderRadius: '16px', marginBottom: '1.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Registry ID</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{doc.doctor_id}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>License No.</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{doc.registration_number || 'PENDING'}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    onClick={() => toggleActive(doc)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid',
                                        borderColor: doc.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                                        background: doc.is_active ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                        color: doc.is_active ? '#10b981' : '#64748b',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: doc.is_active ? '#10b981' : '#64748b' }}></div>
                                    {doc.is_active ? 'PRACTICING' : 'ON LEAVE'}
                                </button>
                                <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                    Schedules <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Form */}
            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ width: '480px', padding: 0, overflow: 'hidden', borderRadius: '32px' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', padding: '2rem', color: '#fff', position: 'relative' }}>
                            <div style={{ background: 'rgba(255,255,255,0.15)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                <Stethoscope size={32} />
                            </div>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 800 }}>{editingId ? 'Edit Profile' : 'Practitioner Enrollment'}</h2>
                            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8, fontSize: '0.95rem' }}>
                                {editingId ? `Updating record for ${form.name}` : 'Enter doctor details to add to registry'}
                            </p>
                            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Doctor's Full Name *</label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            required
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '14px', border: '1px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '1rem' }}
                                            placeholder="e.g. Dr. Jane Smith"
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Specialization *</label>
                                    <div style={{ position: 'relative' }}>
                                        <Award size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            required
                                            type="text"
                                            value={form.speciality}
                                            onChange={e => setForm({ ...form, speciality: e.target.value })}
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '14px', border: '1px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '1rem' }}
                                            placeholder="e.g. Pediatric Surgeon"
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Medical Registration Number</label>
                                    <div style={{ position: 'relative' }}>
                                        <Shield size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            value={form.registration_number}
                                            onChange={e => setForm({ ...form, registration_number: e.target.value })}
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '14px', border: '1px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '1rem' }}
                                            placeholder="e.g. MED-887766"
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Active Status</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Visible in appointment booking lists</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1, height: '3.25rem', borderRadius: '16px', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 2, height: '3.25rem', borderRadius: '16px', fontWeight: 700, background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', border: 'none' }}>
                                    {submitting ? 'Authenticating...' : editingId ? 'Update Record' : 'Enroll Practitioner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .hover-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
                    border-color: var(--primary-light) !important;
                }
                .icon-btn-v2 {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .icon-btn-v2:hover {
                    transform: scale(1.1);
                    filter: brightness(0.95);
                }
                .skeleton {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: skeleton-loading 1.5s infinite;
                }
                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default Doctors;
