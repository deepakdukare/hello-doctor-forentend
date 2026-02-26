import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Stethoscope, Plus, Edit2, Trash2, RefreshCw,
    AlertCircle, Check, X, User, Briefcase, Mail,
    Shield, CheckCircle2, MoreVertical, Star, Award,
    Activity, ArrowRight, ExternalLink, Calendar
} from 'lucide-react';
import {
    getDoctors, createDoctor, updateDoctor, deleteDoctor
} from '../api/index';

const Doctors = () => {
    const navigate = useNavigate();
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
        speciality: 'Pulmonary Specialist',
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
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#fdfdff' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, background: 'linear-gradient(135deg, #0f172a 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
                        Doctors
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '1.15rem', fontWeight: 500 }}>
                        Manage clinic doctors, specialities, and clinical credentials
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                    <button
                        onClick={fetchData}
                        className="btn-glass"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1.5rem', borderRadius: '16px', fontWeight: 600, color: '#4338ca' }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setShowModal(true); setEditingId(null); setForm({ name: '', registration_number: '', speciality: 'Pediatrics', is_active: true }); }}
                        className="btn-primary-premium"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 2rem', borderRadius: '16px', fontWeight: 700 }}
                    >
                        <Plus size={22} />
                        Add New Doctor
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '18px', padding: '1.25rem 1.75rem', marginBottom: '2.5rem', color: '#ef4444', display: 'flex', gap: '1.25rem', alignItems: 'center', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)', animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ background: '#fee2e2', padding: '0.5rem', borderRadius: '12px' }}><AlertCircle size={22} /></div>
                    <span style={{ fontWeight: 600, flex: 1 }}>{error}</span>
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>
            )}

            {success && (
                <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '18px', padding: '1.25rem 1.75rem', marginBottom: '2.5rem', color: '#16a34a', display: 'flex', gap: '1.25rem', alignItems: 'center', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)', animation: 'slideUp 0.4s ease-out' }}>
                    <div style={{ background: '#dcfce7', padding: '0.5rem', borderRadius: '12px' }}><CheckCircle2 size={22} /></div>
                    <span style={{ fontWeight: 600 }}>{success}</span>
                </div>
            )}

            {/* Content Section */}
            {loading && !doctors.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card skeleton-premium" style={{ height: '320px', borderRadius: '32px' }}></div>
                    ))}
                </div>
            ) : !doctors.length ? (
                <div className="card-premium" style={{ padding: '8rem 2rem', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.03)' }}>
                    <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(67, 56, 202, 0.1) 100%)', width: '120px', height: '120px', borderRadius: '35%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem', color: '#4338ca' }}>
                        <Stethoscope size={56} />
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem 0' }}>Registry is Empty</h2>
                    <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 2.5rem', fontSize: '1.15rem', lineHeight: 1.6 }}>Enhance your clinic by enrolling practitioners to start managing specialized patient care and schedules.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary-premium"
                        style={{ padding: '1rem 3rem', borderRadius: '18px', fontSize: '1.1rem' }}
                    >
                        Enroll First Doctor
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '2.5rem' }}>
                    {doctors.map((doc) => (
                        <div key={doc.doctor_id} className="doctor-card" style={{ background: doc.is_active ? '#fff' : '#f8fafc', border: doc.is_active ? '1px solid #e2e8f0' : '1px solid #f1f5f9' }}>
                            {!doc.is_active && (
                                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#f1f5f9', color: '#94a3b8', padding: '0.4rem 1rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                                    ON LEAVE
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)' }}>
                                        <User size={40} />
                                    </div>
                                    {doc.is_active && <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '22px', height: '22px', background: '#10b981', border: '4px solid #fff', borderRadius: '50%' }}></div>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>{doc.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4338ca', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.35rem' }}>
                                        <Award size={18} />
                                        {doc.speciality}
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(doc.doctor_id)} className="delete-trigger" style={{ alignSelf: 'flex-start', color: '#94a3b8' }}>
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '20px', marginBottom: '2rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>Registry ID</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{doc.doctor_id}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>License No.</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{doc.registration_number || 'PENDING'}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                                <button
                                    onClick={() => navigate('/scheduling')}
                                    className="action-btn-primary"
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                                >
                                    <Calendar size={18} />
                                    Schedules
                                </button>
                                <button
                                    onClick={() => handleEdit(doc)}
                                    className="action-btn-secondary"
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                                >
                                    <Edit2 size={18} />
                                    Edit Profile
                                </button>
                            </div>

                            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                                <div
                                    onClick={() => toggleActive(doc)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                                    className="status-toggle"
                                >
                                    <div style={{ width: '40px', height: '22px', borderRadius: '20px', background: doc.is_active ? '#10b981' : '#e2e8f0', position: 'relative', transition: 'all 0.3s' }}>
                                        <div style={{ position: 'absolute', top: '3px', left: doc.is_active ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: doc.is_active ? '#10b981' : '#64748b' }}>
                                        {doc.is_active ? 'PRACTICING' : 'ON LEAVE'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Form */}
            {showModal && (
                <div className="modal-overlay-premium" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content-premium" style={{ width: '420px', padding: 0, overflow: 'hidden', borderRadius: '32px', boxShadow: '0 50px 100px -20px rgba(15, 23, 42, 0.3)' }}>
                        <div style={{ background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)', padding: '2.5rem 2rem', color: '#fff', position: 'relative' }}>
                            <div className="modal-header-bg"></div>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ background: 'rgba(255,255,255,0.18)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                                    <Stethoscope size={32} />
                                </div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{editingId ? 'Edit Profile' : 'Enrollment'}</h2>
                                <div style={{
                                    margin: '0.75rem 0 0 0',
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    display: 'inline-block',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <p style={{ margin: 0, opacity: 0.95, fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Activity size={16} />
                                        {editingId ? 'Updating practitioner record' : 'Enter doctor credentials'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="modal-close-premium">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '2.5rem 2rem', background: '#fff' }}>
                            <div style={{ display: 'grid', gap: '2rem' }}>
                                <div className="input-group-premium">
                                    <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>Doctor's Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={22} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            required
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            className="modal-input-premium"
                                            placeholder="e.g. Dr. Jane Smith"
                                        />
                                    </div>
                                </div>

                                <div className="input-group-premium">
                                    <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>Specialization <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <Award size={22} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <select
                                            required
                                            value={form.speciality}
                                            onChange={e => setForm({ ...form, speciality: e.target.value })}
                                            className="modal-input-premium"
                                            style={{ paddingLeft: '3.5rem', appearance: 'none' }}
                                        >
                                            <option value="Pulmonary Specialist">Pulmonary Specialist</option>
                                            <option value="Pediatrics">Pediatrics</option>
                                            <option value="Vaccination Clinic">Vaccination Clinic</option>
                                            <option value="General Medicine">General Medicine</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group-premium">
                                    <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>Medical Registration Number</label>
                                    <div style={{ position: 'relative' }}>
                                        <Shield size={22} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            value={form.registration_number}
                                            onChange={e => setForm({ ...form, registration_number: e.target.value })}
                                            className="modal-input-premium"
                                            placeholder="e.g. MED-887766"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="status-selection-premium">
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                            hidden
                                        />
                                        <div className={`status-pill-custom ${form.is_active ? 'active' : 'inactive'}`}>
                                            <div className="status-indicator"></div>
                                            <div style={{ flex: 1 }}>
                                                <div className="status-title">{form.is_active ? 'Marked as Active' : 'Marked as On Leave'}</div>
                                                <div className="status-subtitle">{form.is_active ? 'Visible in booking schedule' : 'Hidden from public lists'}</div>
                                            </div>
                                            <div className={`status-toggle-switch ${form.is_active ? 'on' : 'off'}`}>
                                                <div className="toggle-handle"></div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '3.5rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel-premium">Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-submit-premium">
                                    {submitting ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <RefreshCw size={20} className="animate-spin" />
                                            Authenticating...
                                        </div>
                                    ) : editingId ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <CheckCircle2 size={20} />
                                            Update Profile
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Plus size={20} />
                                            Enroll Practitioner
                                        </div>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay-premium {
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(12px);
                    position: fixed;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    animation: fadeIn 0.3s ease-out;
                }
                .modal-content-premium {
                    animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .modal-header-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05) 0%, transparent 40%),
                                      radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 40%);
                }
                .modal-input-premium {
                    width: 100%;
                    padding: 1.15rem 1.15rem 1.15rem 3.5rem;
                    border-radius: 20px;
                    border: 2px solid #e2e8f0;
                    outline: none;
                    transition: all 0.3s;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                    background: #f8fafc;
                }
                .modal-input-premium:focus {
                    border-color: #6366f1;
                    background: #fff;
                    box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.1);
                    transform: translateY(-2px);
                }
                .modal-close-premium {
                    position: absolute;
                    top: 2rem;
                    right: 2rem;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #fff;
                    padding: 0.75rem;
                    border-radius: 18px;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }
                .modal-close-premium:hover {
                    background: #ef4444;
                    border-color: #ef4444;
                    transform: rotate(90deg) scale(1.1);
                }
                .status-selection-premium {
                    cursor: pointer;
                    display: block;
                }
                .status-pill-custom {
                    padding: 1.5rem;
                    border-radius: 24px;
                    border: 2px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    transition: all 0.3s;
                    background: #f8fafc;
                }
                .status-pill-custom.active { border-color: #10b981; background: #f0fdf4; }
                .status-pill-custom.inactive { border-color: #94a3b8; background: #f8fafc; }
                
                .status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
                .active .status-indicator { background: #10b981; box-shadow: 0 0 12px #10b981; }
                .inactive .status-indicator { background: #94a3b8; }
                
                .status-title { font-weight: 800; font-size: 1.1rem; color: #1e293b; }
                .status-subtitle { font-size: 0.85rem; color: #64748b; font-weight: 600; }
                
                .status-toggle-switch {
                    width: 54px;
                    height: 30px;
                    border-radius: 30px;
                    background: #e2e8f0;
                    position: relative;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .status-toggle-switch.on { background: #10b981; }
                .toggle-handle {
                    width: 22px;
                    height: 22px;
                    background: #fff;
                    border-radius: 50%;
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .on .toggle-handle { left: 28px; }
                
                .btn-submit-premium {
                    flex: 1.5;
                    height: 4rem;
                    border-radius: 20px;
                    font-weight: 800;
                    font-size: 1.15rem;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.4);
                }
                .btn-submit-premium:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 20px 40px -5px rgba(99, 102, 241, 0.5);
                    filter: brightness(1.1);
                }
                .btn-cancel-premium {
                    flex: 1;
                    height: 4rem;
                    border-radius: 20px;
                    font-weight: 800;
                    font-size: 1.15rem;
                    background: #f1f5f9;
                    color: #475569;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-cancel-premium:hover { background: #e2e8f0; color: #0f172a; }

                .skeleton-premium {
                    background: linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%);
                    background-size: 200% 100%;
                    animation: skeleton-shimmer 2s infinite;
                }
                @keyframes skeleton-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Doctors;
