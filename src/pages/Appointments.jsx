import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, RefreshCw, Search, Calendar, Filter, X, Check,
    Clock, AlertCircle, MoreVertical, Calendar as CalendarIcon,
    ChevronRight, User, Users, Phone, MapPin, Trash2, Edit3,
    ArrowRight, Info, CheckCircle2, XCircle, AlertTriangle,
    FileText, Link as LinkIcon, Download, Search as SearchIcon,
    Stethoscope, Activity
} from 'lucide-react';
import api, {
    getAppointments, bookAppointment, updateAppointment,
    cancelAppointment, getAppointmentStats, getDoctors,
    searchPatients
} from '../api/index';

const STATUS_CONFIG = {
    'CONFIRMED': { color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={14} /> },
    'PENDING': { color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={14} /> },
    'CANCELLED': { color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={14} /> },
    'COMPLETED': { color: '#6366f1', bg: '#e0e7ff', icon: <Check size={14} /> },
    'NO_SHOW': { color: '#6b7280', bg: '#f3f4f6', icon: <AlertTriangle size={14} /> }
};

const MODE_CONFIG = {
    'OFFLINE': { bg: '#e0f2fe', color: '#0369a1', label: 'In-Clinic' },
    'ONLINE': { bg: '#fef2f2', color: '#b91c1c', label: 'Consultation' }
};

const Appointments = () => {
    // List States
    const [appointments, setAppointments] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [doctors, setDoctors] = useState([]);

    // Filter States
    const [filters, setFilters] = useState({
        date: new Date().toISOString().split('T')[0],
        doctor_id: '',
        status: ''
    });

    // Modal & Form States
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState('patient'); // 'patient' | 'visit'
    const [form, setForm] = useState({
        patient_id: '',
        doctor_name: 'Dr. Indu',
        appointment_date: new Date().toISOString().split('T')[0],
        slot_id: '',
        doctor_speciality: 'Pediatrics',
        visit_type: 'CONSULTATION',
        appointment_mode: 'OFFLINE',
        reason: ''
    });
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Patient Search State inside Modal
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Slot States
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);

    // Cancellation Modal
    const [cancelModal, setCancelModal] = useState({ show: false, id: null, reason: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [apptRes, statsRes, doctorRes] = await Promise.all([
                getAppointments(filters),
                getAppointmentStats(filters.date),
                getDoctors()
            ]);
            setAppointments(apptRes.data.data || []);
            setStats(statsRes.data.data);
            setDoctors(doctorRes.data.data || []);
        } catch (err) {
            setError("Failed to fetch appointments. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch slots when date or visit type changes
    useEffect(() => {
        const fetchSlots = async () => {
            if (!form.appointment_date) return;
            setSlotsLoading(true);
            try {
                // Map visit type to doctor_type for slots API
                const docType = form.visit_type === 'VACCINATION' ? 'VACCINATION' : 'PULMONARY';
                const res = await api.get('/slots/available', {
                    params: { doctor_type: docType, date: form.appointment_date }
                });
                setAvailableSlots(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch slots", err);
            } finally {
                setSlotsLoading(false);
            }
        };

        if (showModal && activeTab === 'visit') {
            fetchSlots();
        }
    }, [form.appointment_date, form.visit_type, showModal, activeTab]);

    const handlePatientSearch = async (val) => {
        setPatientSearch(val);
        if (val.length < 3) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await searchPatients(val);
            setSearchResults(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setForm(prev => ({ ...prev, patient_id: patient.patient_id }));
        setSearchResults([]);
        setPatientSearch('');
        setActiveTab('visit');
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.slot_id) {
            alert("Please select a time slot");
            return;
        }
        setSubmitting(true);
        try {
            if (editMode) {
                await updateAppointment(selectedAppointment.appointment_id, form);
            } else {
                await bookAppointment(form);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Operation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelModal.reason && !window.confirm("Cancel without reason?")) return;
        try {
            await cancelAppointment(cancelModal.id, { cancellation_reason: cancelModal.reason });
            setCancelModal({ show: false, id: null, reason: '' });
            fetchData();
        } catch (err) {
            alert("Failed to cancel appointment");
        }
    };

    const openBookingModal = (appt = null) => {
        if (appt) {
            setEditMode(true);
            setSelectedAppointment(appt);
            setForm({
                patient_id: appt.patient_id,
                doctor_name: appt.assigned_doctor_name || 'Dr. Indu',
                appointment_date: appt.appointment_date.split('T')[0],
                slot_id: appt.slot_id,
                doctor_speciality: appt.doctor_speciality || 'Pediatrics',
                visit_type: appt.visit_type,
                appointment_mode: appt.appointment_mode,
                reason: appt.reason || ''
            });
            setSelectedPatient({
                child_name: appt.child_name,
                patient_id: appt.patient_id,
                parent_mobile: appt.parent_mobile
            });
            setActiveTab('visit');
        } else {
            setEditMode(false);
            setForm({
                patient_id: '',
                doctor_name: 'Dr. Indu',
                appointment_date: filters.date || new Date().toISOString().split('T')[0],
                slot_id: '',
                doctor_speciality: 'Pediatrics',
                visit_type: 'CONSULTATION',
                appointment_mode: 'OFFLINE',
                reason: ''
            });
            setSelectedPatient(null);
            setActiveTab('patient');
        }
        setShowModal(true);
    };

    return (
        <div className="appointments-container" style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #1e293b 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Clinic Appointments
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Streamline patient visits and schedule management</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchData}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '12px', background: '#fff', border: '1px solid var(--border-color)', fontWeight: 600 }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Sync
                    </button>
                    <button
                        onClick={() => openBookingModal()}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', border: 'none', color: '#fff', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' }}
                    >
                        <Plus size={20} />
                        Book Appointment
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {[
                    { label: 'Total Today', val: stats?.total_today || 0, icon: <Users size={24} />, color: 'var(--primary)', bg: 'rgba(99, 102, 241, 0.1)' },
                    { label: 'Confirmed', val: stats?.confirmed || 0, icon: <CheckCircle2 size={24} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                    { label: 'WhatsApp Leads', val: stats?.whatsapp || 0, icon: <Phone size={24} />, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
                    { label: 'Cancelled', val: stats?.cancelled || 0, icon: <XCircle size={24} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
                        <div style={{ padding: '1rem', borderRadius: '14px', background: stat.bg, color: stat.color }}>
                            {stat.icon}
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{stat.label}</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <input
                        type="date"
                        value={filters.date}
                        onChange={e => setFilters({ ...filters, date: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1, minWidth: '200px' }}>
                    <Stethoscope size={18} color="var(--primary)" />
                    <select
                        value={filters.doctor_id}
                        onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', width: '100%', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}
                    >
                        <option value="">All Doctors</option>
                        {doctors.map(doc => (
                            <option key={doc._id} value={doc.doctor_id}>{doc.full_name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: '180px' }}>
                    <Activity size={18} color="var(--primary)" />
                    <select
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', width: '100%', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}
                    >
                        <option value="">All Status</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>
            </div>

            {/* List Table */}
            <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Time & Slot</th>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient Details</th>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Doctor & Visit</th>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Source</th>
                                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}><td colSpan="6" style={{ padding: '1.5rem' }}><div className="skeleton" style={{ height: '40px', width: '100%' }}></div></td></tr>
                                ))
                            ) : appointments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                <CalendarIcon size={40} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, color: '#1e293b' }}>No appointments found</h3>
                                                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Try adjusting your filters or date selection</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                appointments.map((appt) => (
                                    <tr key={appt.appointment_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'var(--transition)' }} className="hover-row">
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                                    {appt.slot_id}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{appt.slot_label || 'Allocated Slot'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Clock size={12} /> {appt.session || 'Session'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{appt.child_name || 'Legacy Patient'}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontWeight: 600, color: '#4338ca' }}>{appt.patient_id}</span>
                                                <span>•</span>
                                                <Phone size={12} /> {appt.parent_mobile}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{appt.assigned_doctor_name || 'Dr. Indu'}</div>
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{appt.visit_type}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: STATUS_CONFIG[appt.status]?.color || '#6b7280',
                                                background: STATUS_CONFIG[appt.status]?.bg || '#f3f4f6'
                                            }}>
                                                {STATUS_CONFIG[appt.status]?.icon}
                                                {appt.status}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                color: '#475569'
                                            }}>
                                                {appt.booking_source === 'whatsapp' ? <Phone size={14} color="#10b981" /> : <FileText size={14} color="var(--primary)" />}
                                                {appt.booking_source?.toUpperCase() || 'DASHBOARD'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => openBookingModal(appt)}
                                                    className="icon-btn"
                                                    style={{ color: '#475569', background: '#f8fafc' }}
                                                    title="Reschedule / Edit"
                                                    disabled={appt.status === 'CANCELLED'}
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setCancelModal({ show: true, id: appt.appointment_id, reason: '' })}
                                                    className="icon-btn"
                                                    style={{ color: '#ef4444', background: '#fef2f2' }}
                                                    title="Cancel Appointment"
                                                    disabled={appt.status === 'CANCELLED'}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Booking / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ width: '600px', maxWidth: '95vw', padding: 0, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', padding: '1.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>{editMode ? 'Reschedule Appointment' : 'New Appointment'}</h2>
                                <p style={{ margin: '0.25rem 0 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                                    {editMode ? `Updating ${selectedAppointment?.appointment_id}` : 'Enroll a patient and select a slot'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setActiveTab('patient')}
                                style={{ flex: 1, padding: '1rem', background: activeTab === 'patient' ? '#fff' : '#f8fafc', border: 'none', borderBottom: activeTab === 'patient' ? '2px solid var(--primary)' : 'none', fontWeight: 600, color: activeTab === 'patient' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                disabled={editMode}
                            >
                                1. Select Patient
                            </button>
                            <button
                                onClick={() => selectedPatient && setActiveTab('visit')}
                                style={{ flex: 1, padding: '1rem', background: activeTab === 'visit' ? '#fff' : '#f8fafc', border: 'none', borderBottom: activeTab === 'visit' ? '2px solid var(--primary)' : 'none', fontWeight: 600, color: activeTab === 'visit' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                disabled={!selectedPatient}
                            >
                                2. Visit Details
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {activeTab === 'patient' ? (
                                <div>
                                    <div className="search-box" style={{ marginBottom: '1rem' }}>
                                        <Search size={20} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, ID or mobile..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                            style={{ paddingLeft: '3rem' }}
                                        />
                                    </div>

                                    {searching && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Searching clinical database...</div>}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {searchResults.map(p => (
                                            <div
                                                key={p.patient_id}
                                                onClick={() => selectPatient(p)}
                                                style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'var(--transition)' }}
                                                className="hover-card"
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{p.child_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.patient_id} • {p.parent_mobile}</div>
                                                </div>
                                                <ChevronRight size={18} color="var(--primary)" />
                                            </div>
                                        ))}
                                        {!searching && patientSearch.length >= 3 && searchResults.length === 0 && (
                                            <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                                No patients found matching "{patientSearch}"
                                            </div>
                                        )}
                                        {!searching && patientSearch.length < 3 && (
                                            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                <User size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                                <p>Type at least 3 characters to find an existing patient</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleFormSubmit}>
                                    <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid var(--primary-light)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedPatient?.child_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedPatient?.patient_id}</div>
                                        </div>
                                        {!editMode && (
                                            <button type="button" onClick={() => setActiveTab('patient')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Change</button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label>Appointment Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={form.appointment_date}
                                                onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label>Visit Type *</label>
                                            <select
                                                value={form.visit_type}
                                                onChange={e => setForm({ ...form, visit_type: e.target.value })}
                                            >
                                                <option value="CONSULTATION">Consultation</option>
                                                <option value="VACCINATION">Vaccination</option>
                                                <option value="FOLLOWUP">Follow-up</option>
                                                <option value="PULMONARY">Pulmonary Assessment</option>
                                            </select>
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>Available Slots *</label>
                                            {slotsLoading ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading slots...</div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    {availableSlots.length > 0 ? availableSlots.map(slot => (
                                                        <button
                                                            key={slot.slot_id}
                                                            type="button"
                                                            onClick={() => setForm({ ...form, slot_id: slot.slot_id })}
                                                            style={{
                                                                padding: '0.75rem',
                                                                borderRadius: '10px',
                                                                border: '1.5px solid',
                                                                borderColor: form.slot_id === slot.slot_id ? 'var(--primary)' : '#e2e8f0',
                                                                background: form.slot_id === slot.slot_id ? 'rgba(99, 102, 241, 0.1)' : '#fff',
                                                                color: form.slot_id === slot.slot_id ? 'var(--primary)' : '#1e293b',
                                                                fontWeight: 600,
                                                                fontSize: '0.85rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {slot.label}
                                                            <div style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: 400 }}>{slot.session}</div>
                                                        </button>
                                                    )) : (
                                                        <div style={{ gridColumn: 'span 12', padding: '1rem', textAlign: 'center', background: '#fef2f2', borderRadius: '10px', color: '#ef4444', fontSize: '0.85rem' }}>
                                                            No slots available for this date/doctor type
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>Assigned Doctor *</label>
                                            <select
                                                value={form.doctor_name}
                                                onChange={e => setForm({ ...form, doctor_name: e.target.value })}
                                            >
                                                <option value="Dr. Indu">Dr. Indu</option>
                                                {doctors.map(d => <option key={d._id} value={d.full_name}>{d.full_name}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label>Consultation Mode</label>
                                            <select
                                                value={form.appointment_mode}
                                                onChange={e => setForm({ ...form, appointment_mode: e.target.value })}
                                            >
                                                <option value="OFFLINE">Offline (In-Clinic)</option>
                                                <option value="ONLINE">Online (Video)</option>
                                            </select>
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>Notes / Reason</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Additional notes for the doctor..."
                                                value={form.reason}
                                                onChange={e => setForm({ ...form, reason: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="btn btn-secondary"
                                            style={{ flex: 1 }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            style={{ flex: 2 }}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Processing...' : editMode ? 'Reschedule Visit' : 'Confirm Appointment'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cancellation Modal */}
            {cancelModal.show && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div className="modal-content" style={{ width: '400px', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#1e293b' }}>Cancel Appointment?</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This will release the slot for other patients. This action cannot be undone.</p>

                        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Cancellation Reason</label>
                            <textarea
                                placeholder="e.g. Patient changed mind / Emergency"
                                value={cancelModal.reason}
                                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                                rows={2}
                                style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setCancelModal({ show: false, id: null, reason: '' })} className="btn btn-secondary" style={{ flex: 1 }}>Close</button>
                            <button onClick={handleCancel} className="btn btn-primary" style={{ flex: 1, background: '#ef4444' }}>Yes, Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover {
                    background: #f8fafc !important;
                }
                .icon-btn {
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: var(--transition);
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .icon-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    filter: brightness(0.95);
                }
                .icon-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .hover-card:hover {
                    border-color: var(--primary) !important;
                    background: rgba(99, 102, 241, 0.05) !important;
                    transform: translateX(4px);
                }
                .skeleton {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: skeleton-loading 1.5s infinite;
                    border-radius: 8px;
                }
                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
};

export default Appointments;
