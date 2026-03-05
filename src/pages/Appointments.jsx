import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    Plus,
    AlertTriangle,
    ChevronDown,
    Stethoscope,
    Activity,
    User,
    ArrowRight,
    Clipboard,
    Clock,
    Edit2,
    Calendar,
    UserPlus,
    Trash2
} from 'lucide-react';
import AppointmentRow from '../components/AppointmentRow';
import {
    getAppointments,
    getAppointmentStats,
    getDoctors,
    bookAppointment,
    updateAppointment,
    cancelAppointment,
    getAvailableSlots,
    searchPatients,
    registerPatient,
    bookAppointmentWithToken,
    toIsoDate
} from '../api/index';
import { removeSalutation } from '../utils/formatters';

const getDoctorDisplayName = (doctor) => doctor?.full_name || doctor?.name || doctor?.doctor_name || doctor?.doctor_id || 'Unknown Doctor';

const formatTime12h = (t) => {
    if (!t) return '--';
    const [h, m] = String(t).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getApiErrorMessage = (err, fallback = 'Operation failed.') => {
    const message = err?.response?.data?.message;
    if (!message) return fallback;
    if (message.toLowerCase().includes('slot not found')) {
        return 'Selected slot is no longer available. Refresh slots and choose an active slot.';
    }
    return message;
};

const formatCompactDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

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
        date: toIsoDate(),
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
    const dateInputRef = useRef(null);

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
                const isTodayStr = toIsoDate();
                const isToday = form.appointment_date === isTodayStr;
                if (isToday) {
                    await bookAppointmentWithToken(form);
                } else {
                    await bookAppointment(form);
                }
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
                appointment_date: filters.date || toIsoDate(),
                slot_id: '',
                doctor_id: doctors.find(d => getDoctorDisplayName(d) === 'Dr. Indu')?.doctor_id || '',
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

    const openDatePicker = () => {
        const input = dateInputRef.current;
        if (!input) return;
        input.focus();
        if (typeof input.showPicker === 'function') {
            input.showPicker();
        } else {
            input.click();
        }
    };

    return (
        <div className="appointments-page-v3">
            <div className="header-section-premium">
                <div className="header-content-premium">
                    <h1 className="header-title-premium">Appointments</h1>
                    <div className="live-pill-premium">
                        <span className="live-dot"></span>
                        <span className="live-text">{stats?.total_today || 0} Total Today</span>
                    </div>
                </div>

                <div className="header-actions-premium">
                    <button
                        className={`btn-action-premium ${activeView === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveView('queue')}
                    >
                        <Calendar size={18} />
                        <span>Schedule Queue</span>
                    </button>

                    <button
                        className={`btn-action-premium ${activeView === 'authorizer' ? 'active' : ''}`}
                        onClick={() => openBookingModal()}
                    >
                        <UserPlus size={18} />
                        <span>Book Visit</span>
                    </button>

                    <button className="sync-btn-premium" onClick={fetchData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {activeView === 'queue' ? (
                <div className="view-content-v3">
                    <div className="filter-shelf-premium">
                        <div className="search-pill-v3">
                            <Search size={22} className="s-icon" />
                            <input
                                type="text"
                                placeholder="Patient Search..."
                                value={queueSearch}
                                onChange={(e) => setQueueSearch(e.target.value)}
                            />
                        </div>

                        <div className="filter-group-v3">
                            <div className="filter-item-v3 date-pill-v3" onClick={openDatePicker}>
                                <CalendarIcon size={18} className="f-icon" />
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={filters.date}
                                    onChange={e => setFilters({ ...filters, date: e.target.value })}
                                    className="date-input-v3"
                                />
                                <span className="f-label">{formatCompactDate(filters.date)}</span>
                                <ChevronDown size={14} className="drop-icon" />
                            </div>

                            <div className="filter-item-v3 select-pill-v3">
                                <Stethoscope size={18} className="f-icon" />
                                <select
                                    className="f-select"
                                    value={filters.doctor_id}
                                    onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                                >
                                    <option value="">All Combined Doctors</option>
                                    {doctors.map((doc, idx) => (
                                        <option key={doc.doctor_id || idx} value={doc.doctor_id}>
                                            {getDoctorDisplayName(doc)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="drop-icon" />
                            </div>

                            <div className="filter-item-v3 select-pill-v3">
                                <Activity size={18} className="f-icon" />
                                <select
                                    className="f-select"
                                    value={filters.status}
                                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                                >
                                    <option value="">All Status</option>
                                    <option value="CONFIRMED">Confirmed</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="NO_SHOW">No Show</option>
                                </select>
                                <ChevronDown size={14} className="drop-icon" />
                            </div>
                        </div>
                    </div>

                    <div className="repository-card-v3">
                        <div className="table-flow-v3">
                            <table className="main-table-v3">
                                <thead>
                                    <tr>
                                        <th>Patient / Mobile</th>
                                        <th>Schedule / Date</th>
                                        <th>Assigned Provider</th>
                                        <th>Condition / Reason</th>
                                        <th>Registration Status</th>
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
                                            <td colSpan={6} className="empty-state-card">
                                                <div className="empty-content">
                                                    <div className="empty-icon-wrap">
                                                        <CalendarIcon size={48} />
                                                    </div>
                                                    <h3>No Appointments Found</h3>
                                                    <p>We couldn't find any visits matching your current filters.</p>
                                                    <button className="btn-save" onClick={() => openBookingModal()} style={{ marginTop: '1.5rem' }}>
                                                        <Plus size={20} />
                                                        <span>New Booking</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAppointments.map((appt, idx) => (
                                        <AppointmentRow
                                            key={appt.appointment_id || idx}
                                            appt={appt}
                                            onEdit={openBookingModal}
                                            onCancel={(id) => setCancelModal({ show: true, id, reason: '' })}
                                        />
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
                            <div className="header-flex">
                                <div className="modal-icon-wrap"><Plus size={24} /></div>
                                <div className="header-text">
                                    <h2>{editMode ? 'Modify Reservation' : 'Schedule New Visit'}</h2>
                                    <p>Configure parameters for clinical patient encounter</p>
                                </div>
                                <button className="close-btn-v3" onClick={() => setActiveView('queue')}><XCircle size={24} /></button>
                            </div>
                        </div>

                        <div className="modal-stepper-v3">
                            <button className={`step-btn ${activeTab === 'patient' || activeTab === 'new-patient' ? 'active' : ''}`} onClick={() => !editMode && setActiveTab('patient')}>
                                <span className="step-num">1</span>
                                <span>Identity Verification</span>
                            </button>
                            <div className="step-line"></div>
                            <button className={`step-btn ${activeTab === 'visit' ? 'active' : ''}`} onClick={() => selectedPatient && setActiveTab('visit')}>
                                <span className="step-num">2</span>
                                <span>Visit Parameters</span>
                            </button>
                        </div>

                        <div className="modal-body-v3">
                            {error && (
                                <div className="alert-v3-premium error">
                                    <AlertTriangle size={20} />
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)}>×</button>
                                </div>
                            )}

                            {activeTab === 'patient' ? (
                                <div className="patient-selector-premium">
                                    <div className="search-wrap-premium">
                                        <Search size={22} className="s-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search clinical registry by name, ID or mobile..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                            className="search-input-premium"
                                        />
                                    </div>

                                    {searching && <div className="scanner-line">Scanning Identity Registry...</div>}

                                    <div className="search-results-premium">
                                        {searchResults.map(p => (
                                            <div key={p.patient_id} className="patient-result-item" onClick={() => selectPatient(p)}>
                                                <div className="p-avatar-v2">{p.child_name?.charAt(0)}</div>
                                                <div className="p-info-v2">
                                                    <div className="p-name">{removeSalutation(p.child_name)}</div>
                                                    <div className="p-meta">{p.patient_id} • {p.parent_mobile}</div>
                                                </div>
                                                <div className="p-action"><ArrowRight size={20} /></div>
                                            </div>
                                        ))}
                                        {!searching && searchResults.length === 0 && (
                                            <div className="no-identity-state">
                                                <p>Identity not found in repository.</p>
                                                <button onClick={() => setActiveTab('new-patient')} className="btn-save">+ Create New Profile</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'new-patient' ? (
                                <form onSubmit={handleQuickRegister} className="wizard-form-v3">
                                    <div className="form-grid-v2">
                                        <div className="f-group"><label>First Name</label><input required placeholder="First name" value={newPatient.first_name} onChange={e => setNewPatient({ ...newPatient, first_name: e.target.value })} className="input-v3" /></div>
                                        <div className="f-group"><label>Last Name</label><input required placeholder="Last name" value={newPatient.last_name} onChange={e => setNewPatient({ ...newPatient, last_name: e.target.value })} className="input-v3" /></div>
                                        <div className="f-group">
                                            <label>Gender</label>
                                            <select value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })} className="select-v3">
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div className="f-group"><label>Date of Birth</label><input type="date" required value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} className="input-v3" /></div>
                                        <div className="f-group"><label>WhatsApp Mobile</label><input required placeholder="10-digit mobile" value={newPatient.wa_id} onChange={e => setNewPatient({ ...newPatient, wa_id: e.target.value.replace(/\D/g, '') })} className="input-v3" /></div>
                                    </div>
                                    <div className="wizard-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setActiveTab('patient')}>Back to Search</button>
                                        <button type="submit" className="btn-save" disabled={submitting}>Enroll & Proceed</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="wizard-form-v3">
                                    <div className="selected-patient-v3">
                                        <div className="p-banner">
                                            <div className="p-info">
                                                <div className="p-avatar-circle">
                                                    <User size={24} />
                                                </div>
                                                <div className="p-text">
                                                    <div className="p-name-premium">{removeSalutation(selectedPatient?.child_name)}</div>
                                                    <div className="p-id-premium">Patient ID: {selectedPatient?.patient_id}</div>
                                                </div>
                                            </div>
                                            {!editMode && (
                                                <button type="button" className="btn-modify" onClick={() => setActiveTab('patient')}>
                                                    <Edit2 size={14} />
                                                    <span>Change</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-grid-v2">
                                        <div className="f-group">
                                            <label>Assign Clinician</label>
                                            <div className="input-with-icon">
                                                <Stethoscope size={18} className="i-icon" />
                                                <select
                                                    value={form.doctor_name}
                                                    onChange={e => setForm({ ...form, doctor_name: e.target.value })}
                                                    className="select-v3-iconic"
                                                >
                                                    {doctors.map(doc => <option key={doc._id} value={getDoctorDisplayName(doc)}>{getDoctorDisplayName(doc)}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="f-group">
                                            <label>Visit Date</label>
                                            <div className="input-with-icon">
                                                <CalendarIcon size={18} className="i-icon" />
                                                <input
                                                    type="date"
                                                    value={form.appointment_date}
                                                    onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                                                    className="input-v3-iconic"
                                                />
                                            </div>
                                        </div>

                                        <div className="f-group full-span">
                                            <div className="slot-header">
                                                <label>Available Time Slots</label>
                                                {slotsLoading && <RefreshCw size={14} className="animate-spin text-primary" />}
                                            </div>

                                            <div className="slot-grid-v3">
                                                {[...availableSlots]
                                                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                                                    .map(slot => (
                                                        <div
                                                            key={slot.slot_id}
                                                            className={`slot-pill-v3 ${form.slot_id === slot.slot_id ? 'active' : ''}`}
                                                            onClick={() => setForm({ ...form, slot_id: slot.slot_id })}
                                                        >
                                                            <div className="slot-time">{formatTime12h(slot.start_time)}</div>
                                                            <div className="slot-range">{formatTime12h(slot.end_time)}</div>
                                                            <div className="slot-session">{slot.session}</div>
                                                        </div>
                                                    ))}
                                                {availableSlots.length === 0 && !slotsLoading && (
                                                    <div className="no-slots-alert">
                                                        <Clock size={18} />
                                                        <span>No active slots found for selected date.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="f-group">
                                            <label>Visit Category</label>
                                            <div className="input-with-icon">
                                                <Activity size={18} className="i-icon" />
                                                <select
                                                    value={form.visit_type}
                                                    onChange={e => setForm({ ...form, visit_type: e.target.value })}
                                                    className="select-v3-iconic"
                                                >
                                                    <option value="CONSULTATION">Regular Consultation</option>
                                                    <option value="FOLLOW_UP">Follow-up Visit</option>
                                                    <option value="VACCINATION">Vaccination / Immunization</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="f-group">
                                            <label>Clinical Reason</label>
                                            <div className="input-with-icon">
                                                <Clipboard size={18} className="i-icon" />
                                                <input
                                                    placeholder="e.g. Fever, routine checkup..."
                                                    value={form.reason}
                                                    onChange={e => setForm({ ...form, reason: e.target.value })}
                                                    className="input-v3-iconic"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="wizard-footer-large">
                                        <button type="button" className="btn-cancel-large" onClick={() => setActiveView('queue')}>
                                            Discard Changes
                                        </button>
                                        <button type="submit" className="btn-save-large" disabled={submitting}>
                                            {submitting ? <RefreshCw size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
                                            <span>{editMode ? 'Update Record' : 'Confirm Authorization'}</span>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {cancelModal.show && (
                <div className="modal-overlay-premium">
                    <div className="modal-alert-card">
                        <div className="alert-icon-wrap"><Trash2 size={32} /></div>
                        <h2>Purge Reservation</h2>
                        <p>Are you sure you want to cancel appointment <strong>{cancelModal.id}</strong>? This action will immediately release the time slot back to the clinic inventory.</p>

                        <div className="cancel-reason-input">
                            <label>Cancellation Reason</label>
                            <input
                                placeholder="Patient request, emergency, etc."
                                value={cancelModal.reason}
                                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                                className="input-v3"
                            />
                        </div>

                        <div className="alert-actions">
                            <button className="btn-cancel" onClick={() => setCancelModal({ show: false, id: null, reason: '' })}>Keep Booking</button>
                            <button className="btn-danger-v3" onClick={handleCancel}>Confirm Cancellation</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Appointments;
