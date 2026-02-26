import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, AlertCircle, UserPlus, X, Edit2,
    User, Phone, Mail, MapPin, Calendar as CalendarIcon,
    FileText, Share2, Shield, Heart, MoreVertical,
    ChevronRight, Info, Filter, CheckCircle2, Camera
} from 'lucide-react';
import { getPatients, registerPatient, updatePatient, getDoctors } from '../api/index';

const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
const GENDERS = ['Male', 'Female', 'Other'];
const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Just Enroll' },
    { value: 'book_appointment', label: 'Enroll & Book' }
];

const EMPTY_FORM = {
    salutation: 'Master',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'Male',
    dob: '',
    dob_unknown: false,
    age_years: '',
    age_months: '',
    age_days: '',
    birth_time_hours: '',
    birth_time_minutes: '',
    birth_time_ampm: 'AM',
    father_name: '',
    father_mobile: '',
    father_occupation: '',
    mother_name: '',
    mother_mobile: '',
    mother_occupation: '',
    wa_id: '',
    email: '',
    area: '',
    city: '',
    pin_code: '',
    doctor: '',
    enrollment_option: 'just_enroll'
};

const Patients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selected, setSelected] = useState(null);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        source: '',
        status: '',
        gender: '',
        doctor: '',
        city: ''
    });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Modal & Form
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [editId, setEditId] = useState(null); // This will be the DICC-xxxx ID

    // Metadata
    const [doctors, setDoctors] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getPatients({
                page,
                limit: 20,
                search: search.trim() || undefined,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            });
            setPatients(res.data.data || []);
            setPagination({
                total: res.data.total || 0,
                pages: res.data.pagination?.pages || 1,
                page: res.data.pagination?.page || 1
            });
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, filters]);

    useEffect(() => {
        const t = setTimeout(fetchData, 500);
        return () => clearTimeout(t);
    }, [fetchData]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const res = await getDoctors();
                setDoctors(res.data.data || []);
            } catch (e) {
                console.error("Failed to load doctors", e);
            }
        };
        loadMetadata();
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            // Numeric conversion for API compatibility
            const numericPayload = {
                ...form,
                age_years: form.age_years ? parseInt(form.age_years) : undefined,
                age_months: form.age_months ? parseInt(form.age_months) : undefined,
                age_days: form.age_days ? parseInt(form.age_days) : undefined,
                birth_time_hours: form.birth_time_hours ? parseInt(form.birth_time_hours) : undefined,
                birth_time_minutes: form.birth_time_minutes ? parseInt(form.birth_time_minutes) : undefined,
            };

            if (editId) {
                await updatePatient(editId, numericPayload);
                setSuccess("Patient profile updated successfully.");
            } else {
                const res = await registerPatient(numericPayload);
                setSuccess(`Patient registered successfully: ${res.data.data.patient_id}`);
            }
            setShowModal(false);
            setEditId(null);
            setForm(EMPTY_FORM);
            fetchData();
            setTimeout(() => setSuccess(null), 4000);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (p) => {
        setEditId(p.patient_id);
        setForm({
            salutation: p.salutation || 'Master',
            first_name: p.first_name || '',
            middle_name: p.middle_name || '',
            last_name: p.last_name || '',
            gender: p.gender || 'Male',
            dob: p.dob ? new Date(p.dob).toISOString().split('T')[0] : '',
            dob_unknown: p.dob_unknown || false,
            age_years: p.age_years || '',
            age_months: p.age_months || '',
            age_days: p.age_days || '',
            birth_time_hours: p.birth_time_hours || '',
            birth_time_minutes: p.birth_time_minutes || '',
            birth_time_ampm: p.birth_time_ampm || 'AM',
            father_name: p.father_name || '',
            father_mobile: p.father_mobile || '',
            father_occupation: p.father_occupation || '',
            mother_name: p.mother_name || '',
            mother_mobile: p.mother_mobile || '',
            mother_occupation: p.mother_occupation || '',
            wa_id: p.wa_id || '',
            email: p.email || '',
            area: p.area || '',
            city: p.city || '',
            pin_code: p.pin_code || '',
            doctor: p.doctor || '',
            enrollment_option: p.enrollment_option || 'just_enroll'
        });
        setShowModal(true);
        setSelected(null);
    };

    const calculateAge = (dob) => {
        if (!dob) return '—';
        const birthDate = new Date(dob);
        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months = 12 + months;
        }
        return `${years}y ${months}m`;
    };

    const copyFormLink = () => {
        const link = window.location.origin + '/register-form';
        navigator.clipboard.writeText(link);
        setSuccess('Form link copied to clipboard!');
        setTimeout(() => setSuccess(null), 3000);
    };

    return (
        <div className="patients-page" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="title-section" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                                <Heart size={24} />
                            </div>
                            <h1>Patient Repository</h1>
                        </div>
                        <p>Manage medical records, registrations, and child health profiles.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-outline" onClick={copyFormLink}>
                            <Share2 size={18} />
                            <span className="mobile-hide">Share Reg. Form</span>
                        </button>
                        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }}>
                            <UserPlus size={18} />
                            <span>Register New Patient</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: '2 1 300px' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, DICC ID, or mobile number..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
                        <select
                            className="btn-outline"
                            style={{ padding: '0.75rem', borderRadius: '12px', flex: 1, minWidth: '130px' }}
                            value={filters.source}
                            onChange={e => setFilters({ ...filters, source: e.target.value })}
                        >
                            <option value="">All Sources</option>
                            <option value="dashboard">Dashboard</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="form">Form</option>
                        </select>
                        <select
                            className="btn-outline"
                            style={{ padding: '0.75rem', borderRadius: '12px', flex: 1, minWidth: '130px' }}
                            value={filters.status}
                            onChange={e => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="">All Status</option>
                            <option value="COMPLETE">Complete</option>
                            <option value="PENDING">Pending</option>
                        </select>
                        <button className="btn btn-outline" style={{ padding: '0.75rem' }} onClick={fetchData}>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert-item" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', marginBottom: '1.5rem', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                </div>
            )}

            {success && (
                <div className="alert-item" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', marginBottom: '1.5rem', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CheckCircle2 size={20} />
                    <span style={{ fontWeight: 600 }}>{success}</span>
                </div>
            )}

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem' }}>Child Information</th>
                                <th className="mobile-hide">Parent Details</th>
                                <th>Contact Information</th>
                                <th className="mobile-hide">Registration</th>
                                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !patients.length ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '5rem', textAlign: 'center' }}>
                                        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
                                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching patient records...</p>
                                    </td>
                                </tr>
                            ) : patients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '5rem', textAlign: 'center' }}>
                                        <Info size={32} color="#94a3b8" />
                                        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>No patients found matching your search.</p>
                                    </td>
                                </tr>
                            ) : patients.map(p => (
                                <React.Fragment key={p._id}>
                                    <tr
                                        className={`user-row ${selected?._id === p._id ? 'selected-row' : ''}`}
                                        style={{ background: selected?._id === p._id ? '#f8faff' : 'transparent' }}
                                    >
                                        <td style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: '14px',
                                                    background: p.gender === 'Female' ? 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)' : 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                                                }}>
                                                    {p.first_name?.charAt(0) || 'P'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{p.full_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.patient_id}</span>
                                                        <span>•</span>
                                                        <span>{p.gender}, {calculateAge(p.dob)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="mobile-hide">
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                {p.father_name || p.parent_name || 'Not Recorded'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.mother_name ? `M: ${p.mother_name}` : 'Parent profile'}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                                                <Phone size={14} color="#10b981" />
                                                {p.wa_id || p.father_mobile || p.parent_mobile}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                                <MapPin size={12} />
                                                {p.city ? `${p.city}${p.area ? `, ${p.area}` : ''}` : 'Location unknown'}
                                            </div>
                                        </td>
                                        <td className="mobile-hide">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                <span className={`badge ${p.registration_status === 'COMPLETE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', alignSelf: 'flex-start' }}>
                                                    {p.registration_status}
                                                </span>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                    Via: {p.registration_source?.toUpperCase() || 'DASHBOARD'}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    className="btn-action"
                                                    onClick={() => setSelected(selected?._id === p._id ? null : p)}
                                                    style={{ background: '#f1f5f9', color: '#475569', width: '36px', height: '36px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {selected?._id === p._id ? <X size={16} /> : <Info size={16} />}
                                                </button>
                                                <button
                                                    className="btn-action"
                                                    onClick={() => startEdit(p)}
                                                    style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '36px', height: '36px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {selected?._id === p._id && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '0', background: 'linear-gradient(to bottom, #f8faff, #fff)' }}>
                                                <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div>
                                                        <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontSize: '0.9rem' }}>Comprehensive Identity</h4>
                                                        <div style={{ display: 'grid', gap: '1rem' }}>
                                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                                <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1' }}>
                                                                    <Camera size={24} color="#94a3b8" />
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{p.salutation} {p.first_name} {p.last_name}</div>
                                                                    <div style={{ color: 'var(--text-muted)' }}>Born: {p.dob ? new Date(p.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, marginTop: '0.25rem' }}>{p.patient_id}</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                                <div className="meta-item">
                                                                    <span>Gender</span>
                                                                    <strong>{p.gender}</strong>
                                                                </div>
                                                                <div className="meta-item">
                                                                    <span>Enrollment</span>
                                                                    <strong>{p.enrollment_option?.replace('_', ' ')}</strong>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontSize: '0.9rem' }}>Parental Information</h4>
                                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                            <div className="meta-item" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                <span>Father</span>
                                                                <strong>{p.father_name || '—'}</strong>
                                                            </div>
                                                            <div className="meta-item" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                <span>Mother</span>
                                                                <strong>{p.mother_name || '—'}</strong>
                                                            </div>
                                                            <div className="meta-item" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                <span>WhatsApp/WA ID</span>
                                                                <strong>{p.wa_id || '—'}</strong>
                                                            </div>
                                                            {p.email && (
                                                                <div className="meta-item" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                    <span>Email</span>
                                                                    <strong>{p.email}</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontSize: '0.9rem' }}>Contact & Location</h4>
                                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                            <div className="meta-item">
                                                                <span>Residential Area</span>
                                                                <strong>{p.area || '—'}</strong>
                                                            </div>
                                                            <div className="meta-item">
                                                                <span>City & Pin</span>
                                                                <strong>{p.city}{p.pin_code ? ` - ${p.pin_code}` : ''}</strong>
                                                            </div>
                                                            <div className="meta-item">
                                                                <span>Assigned Doctor</span>
                                                                <strong>{p.doctor || 'General Visit'}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination.pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            className="btn btn-outline"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            style={{ height: '40px' }}
                        >
                            Previous
                        </button>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            Page <span style={{ color: 'var(--primary)' }}>{page}</span> of {pagination.pages}
                        </div>
                        <button
                            className="btn btn-outline"
                            disabled={page === pagination.pages}
                            onClick={() => setPage(page + 1)}
                            style={{ height: '40px' }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content card" style={{ width: '800px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '0' }}>
                        <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem' }}>{editId ? `Edit Patient: ${editId}` : 'Register New Patient'}</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Comprehensive child and parent health profile registration.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '0.5rem', cursor: 'pointer' }}>
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit} style={{ padding: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                {/* Section 1: Child Identity */}
                                <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                        <Info size={16} /> Child Identity Information
                                    </h4>
                                </div>
                                <div>
                                    <label>Salutation</label>
                                    <select value={form.salutation} onChange={e => setForm({ ...form, salutation: e.target.value })}>
                                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Full Name (First, Middle, Last) *</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input required placeholder="First" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                                        <input placeholder="Middle" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} />
                                        <input required placeholder="Last" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label>Gender *</label>
                                    <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Date of Birth *</label>
                                    <input type="date" required={!form.dob_unknown} value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} disabled={form.dob_unknown} />
                                    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="checkbox"
                                            id="dob_unknown"
                                            checked={form.dob_unknown}
                                            onChange={e => setForm({ ...form, dob_unknown: e.target.checked, dob: e.target.checked ? '' : form.dob })}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <label htmlFor="dob_unknown" style={{ marginBottom: 0, fontSize: '0.75rem', cursor: 'pointer' }}>DOB Unknown (Enter Age Instead)</label>
                                    </div>
                                </div>
                                {form.dob_unknown && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label>Years</label>
                                            <input type="number" placeholder="Y" value={form.age_years} onChange={e => setForm({ ...form, age_years: e.target.value })} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label>Months</label>
                                            <input type="number" placeholder="M" value={form.age_months} onChange={e => setForm({ ...form, age_months: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label>Doctor Assigned</label>
                                    <select value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })}>
                                        <option value="">Select Doctor</option>
                                        {doctors.map(d => <option key={d._id} value={d.full_name}>{d.full_name}</option>)}
                                    </select>
                                </div>

                                {/* Section 2: Parents */}
                                <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                        <Shield size={16} /> Parental & Contact Details
                                    </h4>
                                </div>
                                <div>
                                    <label>Father's Full Name</label>
                                    <input placeholder="Father Name" value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Mother's Full Name</label>
                                    <input placeholder="Mother Name" value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Primary WhatsApp (WA ID) *</label>
                                    <input required placeholder="10-digit number" value={form.wa_id} onChange={e => setForm({ ...form, wa_id: e.target.value })} />
                                </div>
                                <div>
                                    <label>Email Address</label>
                                    <input type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                </div>

                                {/* Section 3: Location */}
                                <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                        <MapPin size={16} /> Location & Address
                                    </h4>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Residential Area / Landmark</label>
                                    <input placeholder="e.g. Near Market, Bandra West" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
                                </div>
                                <div>
                                    <label>City</label>
                                    <input placeholder="Mumbai" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                                </div>
                                <div>
                                    <label>Pin Code</label>
                                    <input placeholder="400050" value={form.pin_code} onChange={e => setForm({ ...form, pin_code: e.target.value })} />
                                </div>
                                <div>
                                    <label>Enrollment Preference</label>
                                    <select value={form.enrollment_option} onChange={e => setForm({ ...form, enrollment_option: e.target.value })}>
                                        {ENROLLMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ minWidth: '160px' }} disabled={submitting}>
                                    {submitting ? <RefreshCw className="animate-spin" size={18} /> : (editId ? 'Update Information' : 'Grant Activation')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .user-row { transition: all 0.2s; cursor: pointer; }
                .user-row:hover { background-color: #f8fafc !important; }
                .selected-row { background-color: #f0f7ff !important; }
                .meta-item { display: flex; flex-direction: column; gap: 0.2rem; background: #fff; padding: 0.75rem; borderRadius: 10px; border: 1px solid #f1f5f9; }
                .meta-item span { font-size: 0.65rem; color: #94a3b8; font-weight: 700; textTransform: uppercase; letter-spacing: 0.04em; }
                .meta-item strong { font-size: 0.85rem; color: #334155; }
                
                label { display: block; fontSize: 0.8rem; fontWeight: 700; color: #475569; marginBottom: 0.4rem; }
                input, select { width: 100%; padding: 0.75rem 1rem; borderRadius: 12px; border: 1px solid #e2e8f0; outline: none; fontSize: 0.95rem; transition: all 0.2s; }
                input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                
                @media (max-width: 768px) {
                    .meta-item { padding: 0.5rem; }
                }
            `}</style>
        </div>
    );
};

export default Patients;

