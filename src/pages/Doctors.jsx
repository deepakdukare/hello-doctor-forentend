import React, { useState, useEffect, useCallback } from 'react';
import {
    Stethoscope, Plus, Edit2, Trash2, RefreshCw,
    AlertCircle, Check, X, User, Briefcase, Mail
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
    const [showForm, setShowForm] = useState(false);
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
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this doctor profile?")) return;
        try {
            await deleteDoctor(id);
            setSuccess("Doctor profile removed.");
            fetchData();
        } catch (e) {
            setError("Failed to delete doctor.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (editingId) {
                await updateDoctor(editingId, form);
                setSuccess("Doctor profile updated.");
            } else {
                await createDoctor(form);
                setSuccess("New doctor added successfully.");
            }
            setShowForm(false);
            setEditingId(null);
            setForm({ name: '', registration_number: '', speciality: 'Pediatrics', is_active: true });
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
                        <h1>Doctors</h1>
                        <p>Manage clinic practitioners and specialities.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
                            {showForm ? <X size={18} /> : <Plus size={18} />}
                            {showForm ? 'Cancel' : 'Add Doctor'}
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
                        <h3>{editingId ? 'Edit Doctor Profile' : 'New Doctor Profile'}</h3>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Full Name *</label>
                            <input
                                required
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="Dr. Name"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Speciality *</label>
                            <input
                                required
                                type="text"
                                value={form.speciality}
                                onChange={e => setForm({ ...form, speciality: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="e.g. Pediatrics"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Registration No.</label>
                            <input
                                type="text"
                                value={form.registration_number}
                                onChange={e => setForm({ ...form, registration_number: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                placeholder="REG-123456"
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                                {editingId ? 'Update Doctor' : 'Save Doctor'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3>Active Practitioners ({doctors.length})</h3>
                </div>
                {loading && !doctors.length ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
                    </div>
                ) : !doctors.length ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                        <div style={{ background: '#f8fafc', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <Stethoscope size={32} color="#94a3b8" />
                        </div>
                        <h3 style={{ color: '#64748b' }}>No doctors registered</h3>
                        <p style={{ color: '#94a3b8' }}>Add your first doctor profile to start managing appointments.</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Doctor</th>
                                <th>Speciality</th>
                                <th>Reg. Number</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.map((doc) => (
                                <tr key={doc.doctor_id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{doc.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{doc.doctor_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 500 }}>{doc.speciality}</span>
                                    </td>
                                    <td>
                                        <code style={{ fontSize: '0.8rem' }}>{doc.registration_number || '—'}</code>
                                    </td>
                                    <td>
                                        <span className={`badge ${doc.is_active ? 'badge-success' : 'badge-gray'}`}>
                                            {doc.is_active ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-outline" style={{ padding: '0.4rem', height: 'auto' }} onClick={() => handleEdit(doc)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '0.4rem', height: 'auto', color: '#ef4444' }} onClick={() => handleDelete(doc.doctor_id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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

export default Doctors;
