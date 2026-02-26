import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, RefreshCw, Search, Calendar, Filter, X, Check,
    Clock, AlertCircle, MoreVertical, Calendar as CalendarIcon,
    ChevronRight, User, Users, Phone, MapPin, Trash2, Edit3,
    ArrowRight, Info, CheckCircle2, XCircle, AlertTriangle,
    FileText, Link as LinkIcon, Download, Search as SearchIcon,
    Stethoscope, Activity, UserPlus, Heart, ExternalLink
} from 'lucide-react';
import api, {
    getAppointments, bookAppointment, updateAppointment,
    cancelAppointment, getAppointmentStats, getDoctors,
    searchPatients, registerPatient
} from '../api/index';

const STATUS_CONFIG = {
    'CONFIRMED': { color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={14} /> },
    'PENDING': { color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={14} /> },
    'CANCELLED': { color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={14} /> },
    'COMPLETED': { color: '#6366f1', bg: '#e0e7ff', icon: <Check size={14} /> },
    'NO_SHOW': { color: '#6b7280', bg: '#f3f4f6', icon: <AlertTriangle size={14} /> }
};

const SALUTATIONS = ['Master', 'Miss', 'Baby of', 'Mr.', 'Mrs.'];

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
    const [activeTab, setActiveTab] = useState('patient'); // 'patient' | 'new-patient' | 'visit'

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

    // New Patient Quick Registration State
    const [newPatient, setNewPatient] = useState({
        salutation: 'Master',
        first_name: '',
        last_name: '',
        gender: 'Male',
        dob: '',
        wa_id: '',
        registration_source: 'dashboard'
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

    const handleQuickRegister = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await registerPatient(newPatient);
            const registered = res.data.data;
            setSelectedPatient({
                child_name: `${registered.first_name} ${registered.last_name}`,
                patient_id: registered.patient_id,
                parent_mobile: registered.wa_id
            });
            setForm(prev => ({ ...prev, patient_id: registered.patient_id }));
            setActiveTab('visit');
        } catch (err) {
            alert(err.response?.data?.message || "Registration failed");
        } finally {
            setSubmitting(false);
        }
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
            setNewPatient({
                salutation: 'Master',
                first_name: '',
                last_name: '',
                gender: 'Male',
                dob: '',
                wa_id: '',
                registration_source: 'dashboard'
            });
            setSelectedPatient(null);
            setActiveTab('patient');
        }
        setShowModal(true);
    };

    return (
        <div className="appointments-container" style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #1e293b 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Clinic Appointments
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Streamline patient visits and schedule management</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchData}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '14px', background: '#fff', border: '1px solid var(--border-color)', fontWeight: 600 }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Sync Live
                    </button>
                    <button
                        onClick={() => openBookingModal()}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.75rem', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', border: 'none', color: '#fff', fontWeight: 700, boxShadow: '0 10px 20px -3px rgba(99, 102, 241, 0.4)' }}
                    >
                        <Plus size={22} />
                        New Appointment
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {[
                    { label: 'Total Today', val: stats?.total_today || 0, icon: <Users size={28} />, color: 'var(--primary)', bg: 'rgba(99, 102, 241, 0.1)' },
                    { label: 'Confirmed', val: stats?.confirmed || 0, icon: <CheckCircle2 size={28} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                    { label: 'WhatsApp Leads', val: stats?.whatsapp || 0, icon: <Phone size={28} />, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
                    { label: 'Cancelled', val: stats?.cancelled || 0, icon: <XCircle size={28} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ padding: '1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '24px' }}>
                        <div style={{ padding: '1.25rem', borderRadius: '18px', background: stat.bg, color: stat.color }}>
                            {stat.icon}
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>{stat.label}</p>
                            <h3 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', background: '#fff', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <input
                        type="date"
                        value={filters.date}
                        onChange={e => setFilters({ ...filters, date: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', flex: 1, minWidth: '250px' }}>
                    <Stethoscope size={18} color="var(--primary)" />
                    <select
                        value={filters.doctor_id}
                        onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', width: '100%', fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}
                    >
                        <option value="">All Doctors</option>
                        {doctors.map(doc => (
                            <option key={doc._id} value={doc.doctor_id}>{doc.full_name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', width: '220px' }}>
                    <Activity size={18} color="var(--primary)" />
                    <select
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                        style={{ background: 'none', border: 'none', outline: 'none', width: '100%', fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}
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
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border-color)', background: '#fff' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Time & Slot</th>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Patient Details</th>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Doctor & Visit</th>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Source</th>
                                <th style={{ padding: '1.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}><td colSpan="6" style={{ padding: '1.5rem' }}><div className="skeleton" style={{ height: '60px', width: '100%' }}></div></td></tr>
                                ))
                            ) : appointments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '8rem 2rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.03)' }}>
                                                <CalendarIcon size={48} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 800 }}>No appointments found</h3>
                                                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1rem' }}>Try adjusting your filters or date selection</p>
                                            </div>
                                            <button onClick={() => openBookingModal()} className="btn btn-outline" style={{ marginTop: '0.5rem', padding: '0.75rem 2rem', borderRadius: '12px' }}>
                                                <Plus size={18} /> Book First One Now
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                appointments.map((appt) => (
                                    <tr key={appt.appointment_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'var(--transition)' }} className="hover-row">
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(67, 56, 202, 0.1) 100%)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                                    {appt.slot_id}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{appt.slot_label || 'Allocated Slot'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem', fontWeight: 600 }}>
                                                        <Clock size={12} /> {appt.session || 'Session'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem' }}>{appt.child_name || 'Legacy Patient'}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 6px', borderRadius: '6px', fontSize: '0.7rem' }}>{appt.patient_id}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <Phone size={12} /> {appt.parent_mobile}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{appt.assigned_doctor_name || 'Dr. Indu'}</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', gap: '0.4rem' }}>
                                                <span style={{ padding: '2px 10px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.7rem' }}>{appt.visit_type}</span>
                                                <span style={{ padding: '2px 10px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.7rem', border: '1px solid #e2e8f0' }}>{appt.appointment_mode}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '24px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: STATUS_CONFIG[appt.status]?.color || '#6b7280',
                                                background: STATUS_CONFIG[appt.status]?.bg || '#f3f4f6',
                                                border: `1px solid ${STATUS_CONFIG[appt.status]?.color}20`
                                            }}>
                                                {STATUS_CONFIG[appt.status]?.icon}
                                                {appt.status}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                color: '#475569'
                                            }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: appt.booking_source === 'whatsapp' ? '#ecfdf5' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {appt.booking_source === 'whatsapp' ? <Phone size={14} color="#10b981" /> : <Monitor size={14} color="var(--primary)" />}
                                                </div>
                                                {appt.booking_source?.toUpperCase() || 'DASHBOARD'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button
                                                    onClick={() => openBookingModal(appt)}
                                                    className="icon-btn-fancy"
                                                    style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
                                                    title="Manage / Reschedule"
                                                    disabled={appt.status === 'CANCELLED'}
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => (window.location.href = `/mrd?search=${appt.patient_id}`)}
                                                    className="icon-btn-fancy"
                                                    style={{ color: '#0ea5e9', background: '#e0f2fe' }}
                                                    title="View Medical Records"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setCancelModal({ show: true, id: appt.appointment_id, reason: '' })}
                                                    className="icon-btn-fancy"
                                                    style={{ color: '#ef4444', background: '#fef2f2' }}
                                                    title="Cancel Appointment"
                                                    disabled={appt.status === 'CANCELLED'}
                                                >
                                                    <Trash2 size={18} />
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

            {/* Combined Booking / Registration Modal */}
            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
                    <div className="modal-content" style={{ width: '650px', maxWidth: '95vw', padding: 0, overflow: 'hidden', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 40px 80px rgba(0,0,0,0.15)' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', padding: '2rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 800 }}>{editMode ? 'Manage Appointment' : 'Schedule New Visit'}</h2>
                                <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9, fontSize: '0.9rem', fontWeight: 500 }}>
                                    {editMode ? `Updating ${selectedAppointment?.appointment_id}` : 'Enroll a patient and select a time slot'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer', display: 'flex' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Custom Tab Switcher */}
                        {!editMode && (
                            <div style={{ display: 'flex', padding: '0.75rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
                                {[
                                    { id: 'patient', label: '1. Existing Patient', icon: <Search size={16} /> },
                                    { id: 'new-patient', label: '2. Register New', icon: <UserPlus size={16} /> },
                                    { id: 'visit', label: '3. Visit Details', icon: <Calendar size={16} />, disabled: !selectedPatient }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                                        style={{
                                            flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none',
                                            background: activeTab === tab.id ? '#fff' : 'transparent',
                                            color: activeTab === tab.id ? 'var(--primary)' : '#64748b',
                                            fontWeight: 800, fontSize: '0.85rem', cursor: tab.disabled ? 'not-allowed' : 'pointer',
                                            boxShadow: activeTab === tab.id ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                                            transition: 'all 0.2s',
                                            opacity: tab.disabled ? 0.4 : 1
                                        }}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{ padding: '2rem', maxHeight: '75vh', overflowY: 'auto' }}>
                            {activeTab === 'patient' && !editMode && (
                                <div style={{ animation: 'fadeIn 0.4s' }}>
                                    <div className="search-box-premium" style={{ marginBottom: '1.5rem' }}>
                                        <SearchIcon size={22} className="search-icon-p" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, ID or mobile number..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                        />
                                    </div>

                                    {searching && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><RefreshCw size={32} className="animate-spin" /></div>}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {searchResults.map(p => (
                                            <div
                                                key={p.patient_id}
                                                onClick={() => selectPatient(p)}
                                                className="patient-search-card"
                                            >
                                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{p.child_name.charAt(0)}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{p.child_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {p.patient_id} • Mob: {p.parent_mobile}</div>
                                                </div>
                                                <div className="select-badge">Select Patient <ArrowRight size={14} /></div>
                                            </div>
                                        ))}
                                        {!searching && patientSearch.length >= 3 && searchResults.length === 0 && (
                                            <div style={{ padding: '3rem 2rem', textAlign: 'center', background: '#fef2f2', borderRadius: '20px', color: '#ef4444' }}>
                                                <XCircle size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                                <h3 style={{ margin: 0 }}>No records found</h3>
                                                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Check spelling or register as a new patient</p>
                                                <button onClick={() => setActiveTab('new-patient')} className="btn btn-primary" style={{ marginTop: '1.5rem', padding: '0.6rem 2rem', background: '#ef4444' }}>Register New Patient</button>
                                            </div>
                                        )}
                                        {!searching && patientSearch.length < 3 && (
                                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                                                <SearchIcon size={48} style={{ marginBottom: '1.25rem', opacity: 0.3 }} />
                                                <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Enter patient name, ID or mobile</p>
                                                <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>Type at least 3 characters to search the database</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'new-patient' && !editMode && (
                                <form onSubmit={handleQuickRegister} style={{ animation: 'fadeIn 0.4s' }}>
                                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.2rem' }}><UserPlus size={24} color="var(--primary)" /> Quick Registration</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                        <div>
                                            <label>Salutation</label>
                                            <select value={newPatient.salutation} onChange={e => setNewPatient({ ...newPatient, salutation: e.target.value })}>
                                                {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div>
                                                    <label>First Name *</label>
                                                    <input required placeholder="First name" value={newPatient.first_name} onChange={e => setNewPatient({ ...newPatient, first_name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label>Last Name *</label>
                                                    <input required placeholder="Last name" value={newPatient.last_name} onChange={e => setNewPatient({ ...newPatient, last_name: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label>Gender *</label>
                                            <select value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })}>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>Date of Birth *</label>
                                            <input type="date" required value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>WhatsApp Number *</label>
                                            <div style={{ position: 'relative' }}>
                                                <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input required style={{ paddingLeft: '3rem' }} placeholder="10-digit mobile" value={newPatient.wa_id} onChange={e => setNewPatient({ ...newPatient, wa_id: e.target.value.replace(/\D/g, '') })} />
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '56px', borderRadius: '16px' }}>
                                        {submitting ? <RefreshCw size={20} className="animate-spin" /> : 'Register Child & Proceed'}
                                    </button>
                                </form>
                            )}

                            {activeTab === 'visit' && (
                                <form onSubmit={handleFormSubmit} style={{ animation: 'fadeIn 0.4s' }}>
                                    <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', borderRadius: '20px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid var(--primary-light)' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 15px rgba(99, 102, 241, 0.2)' }}>
                                            <User size={28} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{selectedPatient?.child_name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{selectedPatient?.patient_id} • {selectedPatient?.parent_mobile}</div>
                                        </div>
                                        {!editMode && (
                                            <button type="button" onClick={() => setActiveTab('patient')} className="change-btn">Change Patient</button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label>Visit Date *</label>
                                            <input
                                                type="date"
                                                required
                                                min={editMode ? '' : new Date().toISOString().split('T')[0]}
                                                value={form.appointment_date}
                                                onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label>Visit Category *</label>
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
                                            <label style={{ marginBottom: '1rem', display: 'block' }}>Choose Available Slot *</label>
                                            {slotsLoading ? (
                                                <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw size={32} className="animate-spin" color="var(--primary)" /></div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                                                    {availableSlots.length > 0 ? availableSlots.map(slot => (
                                                        <button
                                                            key={slot.slot_id}
                                                            type="button"
                                                            onClick={() => setForm({ ...form, slot_id: slot.slot_id })}
                                                            style={{
                                                                padding: '1rem', borderRadius: '16px', border: '2px solid',
                                                                borderColor: form.slot_id === slot.slot_id ? 'var(--primary)' : '#e2e8f0',
                                                                background: form.slot_id === slot.slot_id ? 'var(--primary-light)' : '#fff',
                                                                color: form.slot_id === slot.slot_id ? 'var(--primary)' : '#1e293b',
                                                                fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s',
                                                                boxShadow: form.slot_id === slot.slot_id ? '0 8px 15px rgba(99, 102, 241, 0.1)' : 'none'
                                                            }}
                                                        >
                                                            {slot.label}
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 500 }}>{slot.session}</div>
                                                        </button>
                                                    )) : (
                                                        <div style={{ gridColumn: 'span 12', padding: '2rem', textAlign: 'center', background: '#fef2f2', borderRadius: '16px', color: '#ef4444', fontWeight: 700, border: '1px solid #fecaca' }}>
                                                            No availability for selected date/type
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>Assigned Practitioner *</label>
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
                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                {['OFFLINE', 'ONLINE'].map(mode => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, appointment_mode: mode })}
                                                        style={{
                                                            flex: 1, padding: '0.8rem', borderRadius: '12px', border: '2px solid',
                                                            background: form.appointment_mode === mode ? 'var(--primary)' : '#fff',
                                                            borderColor: form.appointment_mode === mode ? 'var(--primary)' : '#e2e8f0',
                                                            color: form.appointment_mode === mode ? '#fff' : '#475569',
                                                            fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label>Visit Notes (Optional)</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Enter symptoms, vaccination name, or special instructions..."
                                                value={form.reason}
                                                onChange={e => setForm({ ...form, reason: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '3rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="btn btn-outline"
                                            style={{ flex: 1, height: '56px', borderRadius: '16px' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            style={{ flex: 2, height: '56px', borderRadius: '16px', fontSize: '1.1rem' }}
                                            disabled={submitting}
                                        >
                                            {submitting ? <RefreshCw size={22} className="animate-spin" /> : editMode ? 'Update Appointment' : 'Confirm & Schedule Visit'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Improved Cancellation Modal */}
            {cancelModal.show && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
                    <div className="modal-content" style={{ width: '420px', padding: '2.5rem', textAlign: 'center', borderRadius: '32px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 10px 20px rgba(239, 68, 68, 0.1)' }}>
                            <XCircle size={48} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.75rem 0', color: '#1e293b' }}>Cancel Visit?</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.5 }}>Are you sure you want to cancel this appointment? The slot will be released for other patients immediately.</p>

                        <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem', display: 'block' }}>Cancellation Reason</label>
                            <textarea
                                placeholder="e.g. Patient not reachable / Rescheduled manually"
                                value={cancelModal.reason}
                                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                                rows={2}
                                style={{ width: '100%', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '1rem', outline: 'none', background: '#f8fafc' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setCancelModal({ show: false, id: null, reason: '' })} className="btn btn-outline" style={{ flex: 1, borderRadius: '14px' }}>Keep It</button>
                            <button onClick={handleCancel} className="btn btn-primary" style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: '14px' }}>Yes, Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover {
                    background: #f8fafc !important;
                }
                .icon-btn-fancy {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn-fancy:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }
                .icon-btn-fancy:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }
                .search-box-premium {
                    position: relative;
                }
                .search-icon-p {
                    position: absolute;
                    left: 1.25rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--primary);
                }
                .search-box-premium input {
                    width: 100%;
                    padding: 1rem 1rem 1rem 3.5rem;
                    border-radius: 18px;
                    border: 2px solid #e2e8f0;
                    outline: none;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
                }
                .search-box-premium input:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }
                .patient-search-card {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    padding: 1rem;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #fff;
                }
                .patient-search-card:hover {
                    border-color: var(--primary);
                    background: var(--primary-light);
                    transform: translateX(5px);
                }
                .select-badge {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--primary);
                    background: #fff;
                    padding: 6px 14px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    border: 1px solid var(--primary-light);
                }
                .change-btn {
                    background: #fff;
                    border: 1px solid var(--primary);
                    color: var(--primary);
                    padding: 5px 12px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .change-btn:hover {
                    background: var(--primary);
                    color: #fff;
                }
                input, select, textarea {
                    width: 100%;
                    padding: 0.85rem 1.1rem;
                    border-radius: 14px;
                    border: 2px solid #e2e8f0;
                    margin-top: 0.5rem;
                    outline: none;
                    font-size: 0.95rem;
                    font-weight: 600;
                    background: #fff;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                input:focus, select:focus, textarea:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }
                label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #475569;
                    display: block;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .skeleton {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: skeleton-loading 1.5s infinite;
                    border-radius: 12px;
                }
                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); } to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Appointments;
