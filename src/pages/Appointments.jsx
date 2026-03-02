import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    Plus,
    Edit3,
    Trash2,
    AlertTriangle,
    Monitor,
    Zap,
    Stethoscope,
    Activity,
    User,
    Shield,
    Phone,
    FileText,
    ArrowRight,
    Clipboard,
    X,
    Clock
} from 'lucide-react';
import {
    getAppointments,
    getAppointmentStats,
    getDoctors,
    bookAppointment,
    updateAppointment,
    cancelAppointment,
    getAvailableSlots,
    searchPatients,
    registerPatient
} from '../api';

const STATUS_CONFIG = {
    CONFIRMED: { icon: <CheckCircle2 size={16} />, color: '#10b981', bg: '#dcfce7' },
    COMPLETED: { icon: <CheckCircle2 size={16} />, color: '#6366f1', bg: '#e0e7ff' },
    CANCELLED: { icon: <XCircle size={16} />, color: '#ef4444', bg: '#fef2f2' },
    PENDING: { icon: <Clock size={16} />, color: '#f59e0b', bg: '#fef3c7' },
    NO_SHOW: { icon: <AlertTriangle size={16} />, color: '#b45309', bg: '#ffedd5' },
    DEFAULT: { icon: <Clock size={16} />, color: '#475569', bg: '#e2e8f0' }
};

const SALUTATIONS = ['Master', 'Baby', 'Mr.', 'Mrs.', 'Ms.'];

const getDoctorDisplayName = (doctor) => doctor?.full_name || doctor?.name || doctor?.doctor_name || doctor?.doctor_id || 'Unknown Doctor';

const getSlotDisplayLabel = (appt) => {
    if (appt?.slot_label) return appt.slot_label;
    if (appt?.appointment_time) return appt.appointment_time;
    if (appt?.start_time && appt?.end_time) return `${appt.start_time} - ${appt.end_time}`;
    return appt?.slot_id || 'Allocated Slot';
};

const getSessionDisplay = (appt) => appt?.session || 'Session TBD';

const getApiErrorMessage = (err, fallback = 'Operation failed.') => {
    const message = err?.response?.data?.message;
    if (!message) return fallback;
    if (message.toLowerCase().includes('slot not found')) {
        return 'Selected slot is no longer available. Refresh slots and choose an active slot.';
    }
    if (message.toLowerCase().includes('already has appointment')) {
        return message;
    }
    return message;
};

const StatCardMini = ({ label, value, icon: Icon, color, bg }) => (
    <div className="stat-pill-premium-v3">
        <div className="stat-pill-icon-v3" style={{ background: bg, color: color }}>
            <Icon size={18} />
        </div>
        <div className="stat-pill-content-v3">
            <span className="stat-pill-value-v3">{value}</span>
            <span className="stat-pill-label-v3">{label}</span>
        </div>
    </div>
);

const Appointments = () => {
    // Shared State
    const [appointments, setAppointments] = useState([]);
    const [stats, setStats] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [queueSearch, setQueueSearch] = useState('');

    // Queue Filters
    const [filters, setFilters] = useState({
        date: new Date().toISOString().split('T')[0],
        doctor_id: '',
        status: ''
    });

    // View State
    const [activeView, setActiveView] = useState('queue'); // 'queue' | 'authorizer'
    const [activeTab, setActiveTab] = useState('patient'); // 'patient' | 'new-patient' | 'visit'

    // Booking Wizard State
    const [searching, setSearching] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const [form, setForm] = useState({
        patient_id: '',
        doctor_name: 'Dr. Indu',
        appointment_date: filters.date,
        slot_id: '',
        doctor_speciality: 'Pediatrics',
        visit_type: 'CONSULTATION',
        appointment_mode: 'OFFLINE',
        reason: ''
    });

    const [newPatient, setNewPatient] = useState({
        salutation: 'Master',
        first_name: '',
        last_name: '',
        gender: 'Male',
        dob: '',
        wa_id: '',
        registration_source: 'dashboard'
    });

    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [cancelModal, setCancelModal] = useState({ show: false, id: null, reason: '' });

    const filteredAppointments = appointments.filter((appt) => {
        const q = queueSearch.trim().toLowerCase();
        if (!q) return true;
        return [
            appt.appointment_id,
            appt.patient_id,
            appt.child_name,
            appt.parent_mobile,
            appt.parent_name,
            appt.doctor_name,
        ].some((value) => String(value || '').toLowerCase().includes(q));
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [apptRes, statsRes, doctorRes] = await Promise.all([
                getAppointments(filters),
                getAppointmentStats(filters.date),
                getDoctors()
            ]);
            setAppointments(apptRes.data.data || []);
            setStats(statsRes.data.data || {});
            setDoctors(doctorRes.data.data || []);
        } catch (err) {
            setError("Failed to fetch clinic data. Please check connection.");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchSlots = useCallback(async () => {
        if (!form.appointment_date) return;
        setSlotsLoading(true);
        try {
            const res = await getAvailableSlots(form.doctor_name, form.appointment_date);
            setAvailableSlots(res.data.data || []);
        } catch (err) {
            setError(getApiErrorMessage(err, "Unable to load slots for the selected date."));
        } finally {
            setSlotsLoading(false);
        }
    }, [form.appointment_date, form.doctor_name]);

    const handlePatientSearch = useCallback(async (val) => {
        setPatientSearch(val);
        setSearching(true);
        try {
            const res = await searchPatients(val);
            setSearchResults(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (activeView === 'authorizer') {
            if (activeTab === 'visit') {
                fetchSlots();
            } else if (activeTab === 'patient') {
                handlePatientSearch(patientSearch);
            }
        }
    }, [activeView, activeTab, fetchSlots, handlePatientSearch]);

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setForm(prev => ({ ...prev, patient_id: patient.patient_id }));
        setActiveTab('visit');
    };

    const handleQuickRegister = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await registerPatient(newPatient);
            selectPatient(res.data.data);
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.slot_id) {
            setError("Validation Error: Please select an available time slot.");
            return;
        }
        setSubmitting(true);
        try {
            if (editMode) {
                await updateAppointment(selectedAppointment.appointment_id, form);
            } else {
                await bookAppointment(form);
            }
            setError(null);
            setActiveView('queue');
            fetchData();
        } catch (err) {
            console.error(err);
            setError(getApiErrorMessage(err, "Operation failed."));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        try {
            await cancelAppointment(cancelModal.id, { cancellation_reason: cancelModal.reason });
            setCancelModal({ show: false, id: null, reason: '' });
            setError(null);
            fetchData();
        } catch (err) {
            setError(getApiErrorMessage(err, "Cancellation request rejected."));
        }
    };

    const openBookingModal = (appt = null) => {
        if (appt) {
            setEditMode(true);
            setSelectedAppointment(appt);
            setForm({
                patient_id: appt.patient_id,
                doctor_name: appt.assigned_doctor_name || appt.doctor_name || 'Dr. Indu',
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
        setActiveView('authorizer');
    };

    return (
        <div className="appointments-page-v3">
            <header className="page-header-v3">
                <div className="header-meta-group">
                    <h1 className="header-h1-v3">Appointments</h1>
                    <div className="stats-row-mini-v3">
                        <StatCardMini label="Today's Load" value={stats?.total_today || 0} icon={Users} color="#6366f1" bg="#e0e7ff" />
                        <StatCardMini label="Confirmed" value={stats?.confirmed || 0} icon={CheckCircle2} color="#10b981" bg="#dcfce7" />
                        <StatCardMini label="Cancelled" value={stats?.cancelled || 0} icon={XCircle} color="#ef4444" bg="#fef2f2" />
                    </div>
                </div>

                <div className="header-nav-v3">
                    <button className={`nav-tab-v3 ${activeView === 'queue' ? 'active' : ''}`} onClick={() => setActiveView('queue')}>
                        <Monitor size={18} />
                        <span>Live Queue</span>
                    </button>
                    <button className={`nav-tab-v3 ${activeView === 'authorizer' ? 'active' : ''}`} onClick={() => setActiveView('authorizer')}>
                        <Zap size={18} />
                        <span>Book Appointment</span>
                    </button>
                    <button className="sync-btn-v3" onClick={fetchData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {activeView === 'queue' ? (
                <div className="view-content-v3">
                    <div className="filter-shelf-premium">
                        <div className="filter-group-v3">
                            <div className="filter-item-v3">
                                <CalendarIcon size={18} className="f-icon" />
                                <input
                                    type="date"
                                    value={filters.date}
                                    onChange={e => setFilters({ ...filters, date: e.target.value })}
                                    className="f-input"
                                />
                            </div>
                            <div className="filter-item-v3">
                                <Stethoscope size={18} className="f-icon" />
                                <select
                                    value={filters.doctor_id}
                                    onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                                    className="f-select"
                                >
                                    <option value="">All Doctors</option>
                                    {doctors.map(doc => (
                                        <option key={doc._id} value={doc.doctor_id}>{doc.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-item-v3">
                                <Activity size={18} className="f-icon" />
                                <select
                                    value={filters.status}
                                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                                    className="f-select"
                                >
                                    <option value="">Status Filter</option>
                                    <option value="CONFIRMED">Confirmed</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="NO_SHOW">No Show</option>
                                </select>
                            </div>
                        </div>
                        <div className="search-pill-v3">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Patient name, patient ID, parent phone..."
                                value={queueSearch}
                                onChange={(e) => setQueueSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="repository-card-v3">
                        <div className="table-flow-v3">
                            <table className="main-table-v3">
                                <thead>
                                    <tr>
                                        <th>Schedule & Slot</th>
                                        <th>Patient File</th>
                                        <th>Medical Assignment</th>
                                        <th>Real-time Status</th>
                                        <th>Ingress</th>
                                        <th style={{ textAlign: 'center' }}>Management</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && !appointments.length ? (
                                        Array(6).fill(0).map((_, i) => (
                                            <tr key={i}><td colSpan={6}><div className="skeleton-line-v3"></div></td></tr>
                                        ))
                                    ) : filteredAppointments.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="empty-state-v3">
                                                <div className="empty-box-v3">
                                                    <div className="empty-icon-motion-v3">
                                                        <div className="ring-pulse-v3"></div>
                                                        <CalendarIcon size={48} />
                                                    </div>
                                                    <h3>No matching appointments</h3>
                                                    <p>Try clearing search text or changing date/status filters.</p>
                                                    <button className="book-btn-premium-v3" onClick={() => setActiveView('authorizer')} style={{ margin: '1.5rem auto 0', padding: '1rem 2rem' }}>
                                                        <Plus size={22} />
                                                        <span>Book First Patient</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAppointments.map((appt) => (
                                        <tr key={appt.appointment_id} className="row-hover-v3">
                                            <td>
                                                <div className="slot-id-box">
                                                    <div className="slot-badge-v3">
                                                        <div className="slot-pill-tag">{appt.slot_id}</div>
                                                    </div>
                                                    <div className="time-stack-v3">
                                                        <div className="slot-label-v3">{getSlotDisplayLabel(appt)}</div>
                                                        <div className="slot-sub-v3">{getSessionDisplay(appt)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="patient-link-v3">
                                                    <div className="p-name-v3">{appt.child_name || 'Legacy Patient'}</div>
                                                    <div className="p-meta-v3">
                                                        <span className="p-id-v3">{appt.patient_id}</span>
                                                        <span className="dot">•</span>
                                                        <Zap size={10} color="#10b981" />
                                                        <span>{appt.parent_mobile || patient?.parent_mobile || '-'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="doc-assign-v3">
                                                    <div className="d-name-v3">{appt.assigned_doctor_name || appt.doctor_name || 'Dr. Indu'}</div>
                                                    <div className="v-tag-v3">{appt.visit_type}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="status-chip-v3" style={{ background: (STATUS_CONFIG[appt.status] || STATUS_CONFIG.DEFAULT).bg, color: (STATUS_CONFIG[appt.status] || STATUS_CONFIG.DEFAULT).color }}>
                                                    {(STATUS_CONFIG[appt.status] || STATUS_CONFIG.DEFAULT).icon}
                                                    <span>{appt.status}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="source-link-v3">
                                                    {appt.booking_source === 'whatsapp' ? <Phone size={14} className="wa-icon" /> : <FileText size={14} />}
                                                    <span>{appt.booking_source?.toUpperCase() || 'DASHBOARD'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-hub-v3">
                                                    <button className="hub-btn edit" title="Reschedule" onClick={() => openBookingModal(appt)} disabled={appt.status === 'CANCELLED'}>
                                                        <Edit3 size={18} />
                                                    </button>
                                                    <button className="hub-btn cancel" title="Purge/Cancel" onClick={() => setCancelModal({ show: true, id: appt.appointment_id, reason: '' })} disabled={appt.status === 'CANCELLED'}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="view-content-v3">
                    <div className="authorizer-panel-premium">
                        <div className="authorizer-header-v3">
                            <div className="modal-title-box">
                                <div className="modal-icon-wrap"><Clipboard size={28} /></div>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{editMode ? 'Reschedule Patient' : 'Authorize Appointment'}</h2>
                                    <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>{editMode ? `Modifying record ${selectedAppointment?.appointment_id}` : 'Enroll patient into a clinical time slot'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="modal-stepper-v3">
                            <button className={`step-btn ${activeTab === 'patient' || activeTab === 'new-patient' ? 'active' : ''}`} onClick={() => !editMode && setActiveTab('patient')}>
                                <span className="step-num">1</span>
                                <span>Patient Selection</span>
                            </button>
                            <div className="step-divider"></div>
                            <button className={`step-btn ${activeTab === 'visit' ? 'active' : ''}`} onClick={() => selectedPatient && setActiveTab('visit')}>
                                <span className="step-num">2</span>
                                <span>Clinical Parameters</span>
                            </button>
                        </div>

                        <div className="modal-body-v3">
                            {activeTab === 'patient' ? (
                                <div className="patient-selector-v3">
                                    <div className="search-wrap-v3">
                                        <Search size={22} className="s-icon" />
                                        <input
                                            type="text"
                                            placeholder="Registry Search (Name, ID, Mobile)..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                            className="s-input"
                                        />
                                    </div>

                                    {searching && <div className="search-loader">Scanning Clinical Database...</div>}

                                    <div className="search-results-v3">
                                        {searchResults.map(p => (
                                            <div key={p.patient_id} className="patient-result-card" onClick={() => selectPatient(p)}>
                                                <div className="p-avatar-mini">{p.child_name?.charAt(0)}</div>
                                                <div className="p-details-mini">
                                                    <div className="p-name-bold">{p.child_name}</div>
                                                    <div className="p-id-sub">{p.patient_id} • {p.parent_mobile}</div>
                                                </div>
                                                <ArrowRight size={18} className="p-arrow" />
                                            </div>
                                        ))}
                                        {!searching && searchResults.length === 0 && (
                                            <div className="no-results-v3">
                                                <p>No matches found in repository.</p>
                                                <button onClick={() => setActiveTab('new-patient')} className="btn-save" style={{ marginTop: '1rem', height: '40px', fontSize: '0.9rem' }}>+ Register New Patient</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'new-patient' ? (
                                <form onSubmit={handleQuickRegister} className="booking-form-v3">
                                    <div className="form-grid-v3">
                                        <div className="form-group-v3">
                                            <label>Salutation</label>
                                            <select value={newPatient.salutation} onChange={e => setNewPatient({ ...newPatient, salutation: e.target.value })} className="input-v3">
                                                {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>First Name</label>
                                            <input required placeholder="First name" value={newPatient.first_name} onChange={e => setNewPatient({ ...newPatient, first_name: e.target.value })} className="input-v3" />
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Last Name</label>
                                            <input required placeholder="Last name" value={newPatient.last_name} onChange={e => setNewPatient({ ...newPatient, last_name: e.target.value })} className="input-v3" />
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Gender</label>
                                            <select value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })} className="input-v3">
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Date of Birth</label>
                                            <input type="date" required value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} className="input-v3" />
                                        </div>
                                        <div className="form-group-v3">
                                            <label>WhatsApp Number</label>
                                            <input required placeholder="10-digit mobile" value={newPatient.wa_id} onChange={e => setNewPatient({ ...newPatient, wa_id: e.target.value.replace(/\D/g, '') })} className="input-v3" />
                                        </div>
                                    </div>
                                    <div className="modal-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setActiveTab('patient')}>Back to Search</button>
                                        <button type="submit" className="btn-save" disabled={submitting}>
                                            {submitting ? <RefreshCw size={20} className="animate-spin" /> : 'Register & Proceed'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="booking-form-v3">
                                    <div className="selected-patient-v3">
                                        <div className="p-banner">
                                            <div className="p-info">
                                                <User size={20} />
                                                <strong>{selectedPatient?.child_name}</strong>
                                                <span>({selectedPatient?.patient_id})</span>
                                            </div>
                                            {!editMode && <button type="button" onClick={() => setActiveTab('patient')}>Change</button>}
                                        </div>
                                    </div>

                                    <div className="form-grid-v3">
                                        <div className="form-group-v3">
                                            <label>Consulting Doctor</label>
                                            <select value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} className="input-v3">
                                                <option value="Dr. Indu">Dr. Indu</option>
                                                {doctors.map((d) => {
                                                    const doctorName = getDoctorDisplayName(d);
                                                    return (
                                                        <option key={d.doctor_id || d._id || doctorName} value={doctorName}>
                                                            {doctorName}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Visit Category</label>
                                            <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })} className="input-v3">
                                                <option value="CONSULTATION">Consultation</option>
                                                <option value="VACCINATION">Vaccination</option>
                                                <option value="FOLLOWUP">Follow-up</option>
                                                <option value="PULMONARY">Pulmonary Assessment</option>
                                            </select>
                                        </div>

                                        <div className="form-group-v3">
                                            <label>Appointment Date</label>
                                            <div className="input-wrap-v3">
                                                <CalendarIcon size={18} />
                                                <input type="date" required value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="form-group-v3">
                                            <label>Session Mode</label>
                                            <select value={form.appointment_mode} onChange={e => setForm({ ...form, appointment_mode: e.target.value })} className="input-v3">
                                                <option value="OFFLINE">Offline (In-Clinic)</option>
                                                <option value="ONLINE">Online (Video)</option>
                                            </select>
                                        </div>

                                        <div className="form-group-v3 full-span">
                                            <label>Available Registry Slots</label>
                                            {slotsLoading ? (
                                                <div className="slot-loader-v3">Syncing availability...</div>
                                            ) : (
                                                <div className="slot-grid-v3">
                                                    {availableSlots.length > 0 ? availableSlots.map(slot => (
                                                        <button
                                                            key={slot.slot_id}
                                                            type="button"
                                                            className={`slot-pill-v3 ${form.slot_id === slot.slot_id ? 'active' : ''}`}
                                                            onClick={() => setForm({ ...form, slot_id: slot.slot_id })}
                                                        >
                                                            <div className="slot-time">{slot.label || `${slot.start_time || '--'} - ${slot.end_time || '--'}`}</div>
                                                            <div className="slot-session">{slot.session || 'Session TBD'}</div>
                                                        </button>
                                                    )) : (
                                                        <div className="no-slots-v3">No availability for selected date.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group-v3 full-span">
                                            <label>Clinical Notes</label>
                                            <textarea rows={2} placeholder="Symptom notes or special requests..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-v3 text-area"></textarea>
                                        </div>
                                    </div>

                                    <div className="modal-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setActiveView('queue')}>Discard</button>
                                        <button type="submit" className="btn-save" disabled={submitting}>
                                            {submitting ? <RefreshCw size={20} className="animate-spin" /> : (
                                                <div className="flex-center-gap">
                                                    <Shield size={20} />
                                                    <span>{editMode ? 'Confirm Reschedule' : 'Authorize Appointment'}</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="alert-v3 error" style={{ marginTop: '1.5rem' }}>
                            <AlertTriangle size={20} />
                            <span>{error}</span>
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}
                </div>
            )}

            {cancelModal.show && (
                <div className="modal-overlay-v3">
                    <div className="modal-content-sm-v3">
                        <div className="empty-icon-motion-v3" style={{ background: '#fef2f2', color: '#ef4444' }}>
                            <Trash2 size={40} />
                        </div>
                        <h2 style={{ marginTop: '1.5rem', fontWeight: 900 }}>Revoke Appointment?</h2>
                        <p style={{ color: '#64748b', fontWeight: 600, marginTop: '0.5rem' }}>This will immediately release the slot back into the clinical registry.</p>
                        <div className="form-group-v3" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                            <label>Cancellation Reason</label>
                            <input
                                className="input-v3"
                                placeholder="Patient request, doctor unavailable, etc."
                                value={cancelModal.reason}
                                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                            />
                        </div>
                        <div className="modal-footer-v3">
                            <button onClick={() => setCancelModal({ show: false, id: null, reason: '' })} className="btn-cancel">Dismiss</button>
                            <button onClick={handleCancel} className="btn-purge">Confirm Purge</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .appointments-page-v3 { padding: 2.5rem; max-width: 1600px; margin: 0 auto; animation: fadeUp 0.5s ease-out; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                .page-header-v3 { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; }
                .header-h1-v3 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
                .stats-row-mini-v3 { display: flex; gap: 1rem; margin-top: 1rem; }
                
                .header-nav-v3 { display: flex; gap: 0.5rem; background: #fff; padding: 0.5rem; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.03); align-items: center; }
                .nav-tab-v3 { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.5rem; border-radius: 14px; border: none; background: transparent; color: #64748b; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                .nav-tab-v3.active { background: #0f172a; color: #fff; }
                .sync-btn-v3 { width: 44px; height: 44px; border-radius: 12px; border: none; background: #f8fafc; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; margin-left: 0.5rem; }
                .sync-btn-v3:hover { background: #e2e8f0; color: #0f172a; }

                .stat-pill-premium-v3 { background: #fff; padding: 0.6rem 1.25rem; border-radius: 50px; display: flex; align-items: center; gap: 0.75rem; border: 1px solid #f1f5f9; }
                .stat-pill-icon-v3 { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .stat-pill-content-v3 { display: flex; flex-direction: column; }
                .stat-pill-value-v3 { font-size: 1.1rem; font-weight: 800; color: #1e293b; line-height: 1; }
                .stat-pill-label-v3 { font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }

                .filter-shelf-premium { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 0.75rem; border-radius: 24px; border: 1px solid #f1f5f9; margin-bottom: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                .filter-group-v3 { display: flex; gap: 0.75rem; }
                .filter-item-v3 { 
                    position: relative; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    padding: 0 1.25rem; 
                    background: #f8fafc; 
                    border-radius: 16px; 
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .filter-item-v3:hover { background: #fff; border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .f-icon { color: #6366f1; opacity: 0.6; }
                .f-input, .f-select { 
                    height: 48px; 
                    border: none; 
                    background: transparent; 
                    font-weight: 700; 
                    color: #000000; 
                    font-size: 0.9rem; 
                    outline: none; 
                    cursor: pointer; 
                }
                .f-select {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 0 center;
                    background-size: 1rem;
                    padding-right: 2rem;
                    min-width: 120px;
                }
                .f-select option { background: #fff; color: #000; }
                .search-pill-v3 { display: flex; align-items: center; gap: 0.75rem; background: #f8fafc; padding: 0 1.5rem; border-radius: 50px; color: #cbd5e1; width: 300px; border: 1px solid transparent; transition: all 0.2s; }
                .search-pill-v3:focus-within { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }
                .search-pill-v3 input { border: none; background: transparent; height: 48px; font-weight: 600; font-size: 0.9rem; width: 100%; outline: none; color: #1e293b; }

                .repository-card-v3 { background: #fff; border-radius: 32px; border: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.02); overflow: hidden; }
                .table-flow-v3 { overflow-x: auto; }
                .main-table-v3 { width: 100%; border-collapse: separate; border-spacing: 0; }
                .main-table-v3 th { padding: 1.5rem 2rem; background: #fdfdff; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; border-bottom: 1px solid #f8fafc; }
                .row-hover-v3 td { padding: 1.5rem 2rem; border-bottom: 1px solid #f8fafc; }
                .row-hover-v3:hover td { background: #fcfdff; }

                .slot-id-box { display: flex; align-items: center; gap: 1.5rem; }
                .slot-badge-v3 { 
                    min-width: 50px; 
                    height: 50px; 
                    background: #f1f5f9; 
                    border-radius: 14px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    padding: 0 0.75rem;
                }
                .slot-pill-tag {
                    background: #6366f1;
                    color: #fff;
                    font-size: 0.65rem;
                    font-weight: 900;
                    padding: 0.2rem 0.5rem;
                    border-radius: 6px;
                    letter-spacing: 0.05em;
                }
                .time-stack-v3 { display: flex; flex-direction: column; gap: 0.1rem; }
                .slot-label-v3 { font-size: 1rem; font-weight: 900; color: #0f172a; }
                .slot-sub-v3 { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

                .patient-link-v3 { display: flex; flex-direction: column; gap: 0.25rem; }
                .p-name-v3 { font-weight: 800; color: #0f172a; font-size: 1.05rem; }
                .p-meta-v3 { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.85rem; font-weight: 600; }
                .dot { opacity: 0.3; }

                .doc-assign-v3 { display: flex; flex-direction: column; gap: 0.4rem; }
                .d-name-v3 { font-weight: 800; color: #1e293b; font-size: 0.95rem; }
                .v-tag-v3 { font-size: 0.6rem; font-weight: 900; color: #6366f1; background: #f5f3ff; padding: 0.2rem 0.6rem; border-radius: 6px; width: fit-content; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid rgba(99,102,241,0.1); }

                .status-chip-v3 { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; border-radius: 50px; font-size: 0.7rem; font-weight: 800; width: fit-content; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid rgba(0,0,0,0.05); }
                .source-link-v3 { display: flex; align-items: center; gap: 0.5rem; color: #cbd5e1; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .wa-icon { color: #25d366; }

                .action-hub-v3 { display: flex; gap: 0.75rem; justify-content: flex-end; }
                .hub-btn { width: 40px; height: 40px; border-radius: 12px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; color: #64748b; background: #f8fafc; }
                .hub-btn:hover { transform: scale(1.1); }
                .hub-btn.edit:hover { background: #eef2ff; color: #6366f1; }
                .hub-btn.cancel:hover { background: #fef2f2; color: #ef4444; }

                .authorizer-panel-premium { background: #fff; border-radius: 32px; border: 1px solid #f1f5f9; box-shadow: 0 10px 40px rgba(0,0,0,0.04); overflow: hidden; max-width: 1000px; margin: 0 auto; }
                .authorizer-header-v3 { padding: 2.5rem 3rem; border-bottom: 1px solid #f8fafc; }
                .modal-title-box { display: flex; align-items: center; gap: 1.5rem; }
                .modal-icon-wrap { width: 56px; height: 56px; background: #f5f3ff; color: #6366f1; border-radius: 18px; display: flex; align-items: center; justify-content: center; }
                
                .modal-stepper-v3 { background: #f8fafc; padding: 1.5rem 3rem; display: flex; align-items: center; gap: 1.5rem; }
                .step-btn { display: flex; align-items: center; gap: 0.75rem; border: none; background: transparent; cursor: pointer; color: #94a3b8; font-weight: 700; font-size: 0.9rem; }
                .step-btn.active { color: #6366f1; }
                .step-num { width: 28px; height: 28px; border-radius: 50%; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
                .step-divider { flex: 1; height: 2px; background: #e2e8f0; max-width: 60px; }

                .modal-body-v3 { padding: 3rem; }
                .patient-selector-v3 { min-height: 400px; }
                .search-wrap-v3 { position: relative; margin-bottom: 2rem; }
                .s-icon { position: absolute; left: 1.5rem; top: 50%; transform: translateY(-50%); color: #cbd5e1; }
                .s-input { width: 100%; height: 64px; border-radius: 20px; border: 2px solid #f1f5f9; padding: 0 4rem; font-size: 1.1rem; font-weight: 600; outline: none; transition: 0.2s; }
                .s-input:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }

                .patient-result-card { display: flex; align-items: center; gap: 1.5rem; padding: 1.25rem; border-radius: 20px; background: #f8fafc; margin-bottom: 1rem; cursor: pointer; border: 2px solid transparent; transition: 0.2s; }
                .patient-result-card:hover { border-color: #6366f1; background: #fff; transform: translateX(8px); }
                .p-avatar-mini { width: 44px; height: 44px; background: #e0e7ff; color: #6366f1; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; }
                .p-name-bold { font-weight: 800; color: #1e293b; font-size: 1.05rem; }
                .p-id-sub { font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.1rem; }
                .p-arrow { margin-left: auto; color: #6366f1; opacity: 0; transition: 0.2s; }
                .patient-result-card:hover .p-arrow { opacity: 1; transform: translateX(4px); }

                .form-grid-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                .full-span { grid-column: 1 / -1; }
                .form-group-v3 { display: flex; flex-direction: column; gap: 0.6rem; }
                .form-group-v3 label { font-size: 0.85rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .input-v3 { 
                    height: 56px; 
                    border-radius: 16px; 
                    border: 2px solid #f1f5f9; 
                    padding: 0 1.25rem; 
                    font-size: 0.95rem; 
                    font-weight: 600; 
                    outline: none; 
                    transition: 0.2s; 
                    background: #fff;
                    color: #000000;
                }
                .input-v3:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }
                
                select.input-v3 {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 1.25rem center;
                    background-size: 1.25rem;
                    padding-right: 3rem;
                }
                select.input-v3 option { background: #fff; color: #000; }

                .text-area { height: auto; padding: 1.25rem; resize: none; }
                
                .input-wrap-v3 { 
                    position: relative; 
                    display: flex; 
                    align-items: center; 
                    background: #fff; 
                    border: 2px solid #f1f5f9; 
                    border-radius: 16px; 
                    height: 56px; 
                    padding: 0 1.25rem;
                    transition: all 0.2s;
                }
                .input-wrap-v3:focus-within { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }
                .input-wrap-v3 svg { color: #6366f1; margin: 0 0.75rem 0 0; flex-shrink: 0; }
                .input-wrap-v3 input { 
                    border: none; 
                    outline: none; 
                    flex: 1; 
                    font-size: 0.95rem; 
                    font-weight: 600; 
                    color: #1e293b; 
                    background: transparent;
                    height: 100%;
                    width: 100%;
                    padding: 0;
                    font-family: inherit;
                }
                .input-wrap-v3 input::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    opacity: 0.5;
                    filter: invert(36%) sepia(87%) saturate(2250%) hue-rotate(222deg) brightness(96%) contrast(92%); /* Color matching #6366f1 */
                    margin-left: 0.5rem;
                }
                
                .selected-patient-v3 { margin-bottom: 2.5rem; }
                .p-banner { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2rem; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 20px; }
                .p-info { display: flex; align-items: center; gap: 1rem; color: #166534; font-size: 1.1rem; }
                .p-banner button { background: #fff; border: 1px solid #dcfce7; padding: 0.5rem 1rem; border-radius: 10px; color: #166534; font-weight: 700; cursor: pointer; font-size: 0.8rem; }

                .slot-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
                .slot-pill-v3 { padding: 1.25rem; border-radius: 18px; border: 2px solid #f1f5f9; background: #fff; cursor: pointer; text-align: left; transition: all 0.2s; }
                .slot-pill-v3:hover { border-color: #cbd5e1; }
                .slot-pill-v3.active { border-color: #6366f1; background: #f5f8ff; box-shadow: 0 8px 20px rgba(99,102,241,0.1); }
                .slot-time { font-size: 1.05rem; font-weight: 900; color: #1e293b; }
                .slot-session { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-top: 0.25rem; }
                .no-slots-v3 { 
                    grid-column: 1 / -1; 
                    padding: 2.5rem; 
                    background: #f8fafc; 
                    border: 2px dashed #e2e8f0; 
                    border-radius: 20px; 
                    text-align: center; 
                    color: #64748b; 
                    font-weight: 700;
                    font-size: 0.95rem;
                }

                .modal-footer-v3 { display: flex; gap: 1.5rem; margin-top: 3rem; }
                .btn-cancel { flex: 1; height: 60px; border-radius: 20px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; cursor: pointer; transition: 0.2s; }
                .btn-save { flex: 2; height: 60px; border-radius: 20px; border: none; background: #0f172a; color: #fff; font-weight: 800; cursor: pointer; transition: 0.2s; }
                .btn-save:hover { background: #1e293b; transform: translateY(-2px); }

                .modal-overlay-v3 { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content-sm-v3 { background: #fff; width: 480px; padding: 3rem; border-radius: 36px; text-align: center; }
                .btn-purge { background: #ef4444; color: #fff; flex: 1; height: 60px; border-radius: 20px; border: none; font-weight: 800; cursor: pointer; transition: 0.2s; }
                
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .empty-state-v3 { padding: 5rem 2rem; text-align: center; }
                .empty-box-v3 h3 { color: #1e293b; margin: 1.5rem 0 0.5rem; font-size: 1.5rem; font-weight: 900; }
                .empty-box-v3 p { color: #64748b; font-weight: 600; }
                .empty-icon-motion-v3 { width: 100px; height: 100px; background: #f5f3ff; color: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; position: relative; }
                .ring-pulse-v3 { position: absolute; inset: 0; border: 2px solid #6366f1; border-radius: 50%; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.6); opacity: 0; } }

                .alert-v3 { padding: 1.25rem 2rem; border-radius: 20px; display: flex; align-items: center; gap: 1rem; font-weight: 700; margin-bottom: 2rem; }
                .alert-v3.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
                .alert-v3 button { margin-left: auto; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: inherit; }

                .book-btn-premium-v3 { display: flex; align-items: center; gap: 0.75rem; background: #0f172a; color: #fff; border: none; border-radius: 16px; font-weight: 800; transition: 0.2s; cursor: pointer; }
                .book-btn-premium-v3:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(15,23,42,0.15); }

                .skeleton-line-v3 { height: 80px; background: linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%); background-size: 200% 100%; animation: shim 2s infinite; border-radius: 20px; }
                @keyframes shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `}</style>
        </div>
    );
};

export default Appointments;
