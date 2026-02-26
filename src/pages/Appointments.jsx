import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, RefreshCw, Search, Calendar, Filter, X, Check,
    Clock, AlertCircle, MoreVertical, Calendar as CalendarIcon,
    ChevronRight, User, Users, Phone, MapPin, Trash2, Edit3,
    ArrowRight, Info, CheckCircle2, XCircle, AlertTriangle,
    FileText, Link as LinkIcon, Download, Search as SearchIcon,
    Stethoscope, Activity, UserPlus, Heart, ExternalLink, Shield, Monitor, Zap, Clipboard
} from 'lucide-react';
import api, {
    getAppointments, bookAppointment, updateAppointment,
    cancelAppointment, getAppointmentStats, getDoctors,
    searchPatients, registerPatient, getAvailableSlots
} from '../api/index';

const STATUS_CONFIG = {
    'CONFIRMED': { color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={14} /> },
    'PENDING': { color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={14} /> },
    'CANCELLED': { color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={14} /> },
    'COMPLETED': { color: '#6366f1', bg: '#e0e7ff', icon: <Check size={14} /> },
    'NO_SHOW': { color: '#6b7280', bg: '#f3f4f6', icon: <AlertTriangle size={14} /> }
};

const SALUTATIONS = ['Master', 'Miss', 'Baby of', 'Mr.', 'Mrs.'];

const StatCardMini = ({ label, value, icon: Icon, color, bg }) => (
    <div className="stat-pill-premium-v3">
        <div className="stat-pill-icon-v3" style={{ background: bg, color: color }}>
            <Icon size={20} />
        </div>
        <div className="stat-pill-content-v3">
            <span className="stat-pill-value-v3">{value}</span>
            <span className="stat-pill-label-v3">{label}</span>
        </div>
    </div>
);

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
            setAppointments(apptRes.data.data);
            setStats(statsRes.data.data);
            setDoctors(doctorRes.data.data);
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
            const res = await getAvailableSlots(form.appointment_date, form.doctor_name);
            setAvailableSlots(res.data.data || []);
        } catch (err) {
            console.error("Error fetching slots:", err);
        } finally {
            setSlotsLoading(false);
        }
    }, [form.appointment_date, form.doctor_name]);

    useEffect(() => {
        if (showModal && activeTab === 'visit') {
            fetchSlots();
        }
    }, [showModal, activeTab, fetchSlots]);

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
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Operation failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelModal.reason && !window.confirm("Continue cancellation without specific reason?")) return;
        try {
            await cancelAppointment(cancelModal.id, { cancellation_reason: cancelModal.reason });
            setCancelModal({ show: false, id: null, reason: '' });
            fetchData();
        } catch (err) {
            setError("Cancellation request rejected.");
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
        <div className="appointments-page-v3">
            <div className="header-flex-premium">
                <div className="header-titles-v3">
                    <h1 className="header-h1-v3">Appointments</h1>
                    <div className="stats-row-mini-v3">
                        <StatCardMini label="Today's Load" value={stats?.total_today || 0} icon={Users} color="#6366f1" bg="#e0e7ff" />
                        <StatCardMini label="Confirmed" value={stats?.confirmed || 0} icon={CheckCircle2} color="#10b981" bg="#dcfce7" />
                        <StatCardMini label="Cancelled" value={stats?.cancelled || 0} icon={XCircle} color="#ef4444" bg="#fef2f2" />
                    </div>
                </div>
                <div className="header-btns-v3">
                    <button className="sync-btn-v3" onClick={fetchData}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        <span>Sync</span>
                    </button>
                    <button className="book-btn-v3" onClick={() => openBookingModal()}>
                        <Plus size={22} />
                        <span>Book Appointment</span>
                    </button>
                </div>
            </div>

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
                            <option value="">Global Status</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="PENDING">Pending</option>
                        </select>
                    </div>
                </div>
                <div className="search-pill-v3">
                    <Search size={18} />
                    <input type="text" placeholder="Quick find by name or ID..." />
                </div>
            </div>

            {error && (
                <div className="alert-v3 error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

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
                            ) : appointments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="empty-state-v3">
                                        <div className="empty-box-v3">
                                            <div className="empty-icon-motion-v3">
                                                <div className="ring-pulse-v3"></div>
                                                <CalendarIcon size={48} />
                                            </div>
                                            <h3>No appointments found</h3>
                                            <p>The schedule is currently clear. You can start by booking a patient.</p>
                                            <button className="book-btn-v3" onClick={() => openBookingModal()} style={{ margin: '1.5rem auto 0', padding: '1rem 2rem' }}>
                                                <Plus size={22} />
                                                <span>Book First Appointment</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : appointments.map((appt) => (
                                <tr key={appt.appointment_id} className="row-hover-v3">
                                    <td>
                                        <div className="slot-id-box">
                                            <div className="slot-badge-v3">{appt.slot_id}</div>
                                            <div>
                                                <div className="slot-label-v3">{appt.slot_label || 'Allocated Slot'}</div>
                                                <div className="slot-sub-v3">{appt.session || 'Session'}</div>
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
                                                <span>{appt.parent_mobile}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="doc-assign-v3">
                                            <div className="d-name-v3">{appt.assigned_doctor_name || 'Dr. Indu'}</div>
                                            <div className="v-tag-v3">{appt.visit_type}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="status-chip-v3" style={{ background: STATUS_CONFIG[appt.status]?.bg, color: STATUS_CONFIG[appt.status]?.color }}>
                                            {STATUS_CONFIG[appt.status]?.icon}
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

            {/* Main Booking Modal */}
            {showModal && (
                <div className="modal-overlay-premium">
                    <div className="modal-content-lg-v3">
                        <div className="modal-header-v3">
                            <div className="modal-title-box">
                                <div className="modal-icon-wrap"><Clipboard size={28} /></div>
                                <div>
                                    <h2>{editMode ? 'Reschedule Patient' : 'Authorize Appointment'}</h2>
                                    <p>{editMode ? `Modifying record ${selectedAppointment?.appointment_id}` : 'Enroll patient into a clinical time slot'}</p>
                                </div>
                            </div>
                            <button className="modal-close-v3" onClick={() => setShowModal(false)}><X size={24} /></button>
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
                                        {!searching && patientSearch.length >= 3 && searchResults.length === 0 && (
                                            <div className="no-results-v3">
                                                <p>No matches found in repository.</p>
                                                <button onClick={() => setActiveTab('new-patient')} className="btn-save" style={{ marginTop: '1rem', height: '40px', fontSize: '0.9rem' }}>+ Register New Patient</button>
                                            </div>
                                        )}
                                        {patientSearch.length < 3 && (
                                            <div className="search-placeholder-v3">
                                                <Users size={48} />
                                                <p>Enter 3+ characters to start searching</p>
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
                                            <label>Appointment Date</label>
                                            <div className="input-wrap-v3">
                                                <CalendarIcon size={18} />
                                                <input type="date" required value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} />
                                            </div>
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
                                                            <div className="slot-time">{slot.label}</div>
                                                            <div className="slot-session">{slot.session}</div>
                                                        </button>
                                                    )) : (
                                                        <div className="no-slots-v3">No availability for selected parameters.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group-v3">
                                            <label>Consulting Doctor</label>
                                            <select value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} className="input-v3">
                                                <option value="Dr. Indu">Dr. Indu</option>
                                                {doctors.map(d => <option key={d._id} value={d.full_name}>{d.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Session Mode</label>
                                            <select value={form.appointment_mode} onChange={e => setForm({ ...form, appointment_mode: e.target.value })} className="input-v3">
                                                <option value="OFFLINE">Offline (In-Clinic)</option>
                                                <option value="ONLINE">Online (Video)</option>
                                            </select>
                                        </div>
                                        <div className="form-group-v3 full-span">
                                            <label>Clinical Notes</label>
                                            <textarea rows={2} placeholder="Symptom notes or special requests..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-v3 text-area"></textarea>
                                        </div>
                                    </div>

                                    <div className="modal-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Discard</button>
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
                </div>
            )}

            {/* Cancellation Modal */}
            {cancelModal.show && (
                <div className="modal-overlay-premium">
                    <div className="modal-content-sm-v3">
                        <div className="c-icon-wrap"><AlertTriangle size={32} /></div>
                        <h2>Purge Appointment?</h2>
                        <p>This will permanently release the clinical slot. This action is recorded in the audit logs.</p>

                        <div className="reason-box-v3">
                            <label>Cancellation Basis</label>
                            <textarea placeholder="Legal or medical reason for purge..." value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })} className="input-v3 text-area"></textarea>
                        </div>

                        <div className="c-footer-v3">
                            <button onClick={() => setCancelModal({ show: false, id: null, reason: '' })} className="btn-cancel">Abort</button>
                            <button onClick={handleCancel} className="btn-purge">Confirm Purge</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .appointments-page-v3 { padding: 2.5rem; max-width: 1600px; margin: 0 auto; animation: fadeUp 0.5s ease-out; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                .header-flex-premium { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3.5rem; }
                .header-h1-v3 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
                .stats-row-mini-v3 { display: flex; gap: 1rem; margin-top: 1rem; }
                
                .stat-pill-premium-v3 { background: #fff; padding: 0.6rem 1.25rem; border-radius: 50px; display: flex; align-items: center; gap: 0.75rem; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .stat-pill-icon-v3 { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .stat-pill-content-v3 { display: flex; flex-direction: column; }
                .stat-pill-value-v3 { font-size: 1.1rem; font-weight: 800; color: #1e293b; line-height: 1; }
                .stat-pill-label-v3 { font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }

                .header-btns-v3 { display: flex; gap: 1rem; }
                .sync-btn-v3 { padding: 0.85rem 1.75rem; border-radius: 18px; border: 2px solid #e2e8f0; background: #fff; color: #64748b; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: all 0.2s; }
                .sync-btn-v3:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
                .book-btn-v3 { padding: 0.85rem 1.75rem; border-radius: 18px; border: none; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #fff; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.2); }
                .book-btn-v3:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(99, 102, 241, 0.3); }

                .filter-shelf-premium { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 0.75rem; border-radius: 24px; border: 1px solid #f1f5f9; margin-bottom: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                .filter-group-v3 { display: flex; gap: 0.75rem; }
                .filter-item-v3 { position: relative; display: flex; align-items: center; gap: 0.75rem; padding: 0 1.25rem; background: #f8fafc; border-radius: 16px; transition: all 0.2s; }
                .f-icon { color: #6366f1; opacity: 0.6; }
                .f-input, .f-select { height: 48px; border: none; background: transparent; font-weight: 700; color: #1e293b; font-size: 0.9rem; outline: none; cursor: pointer; }
                .search-pill-v3 { display: flex; align-items: center; gap: 0.75rem; background: #f8fafc; padding: 0 1.5rem; border-radius: 50px; color: #cbd5e1; width: 300px; }
                .search-pill-v3 input { border: none; background: transparent; height: 48px; font-weight: 600; font-size: 0.9rem; width: 100%; outline: none; color: #1e293b; }

                .repository-card-v3 { background: #fff; border-radius: 32px; border: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.02); overflow: hidden; }
                .table-flow-v3 { overflow-x: auto; }
                .main-table-v3 { width: 100%; border-collapse: separate; border-spacing: 0; }
                .main-table-v3 th { padding: 1.5rem 2rem; background: #fdfdff; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; border-bottom: 1px solid #f8fafc; }
                .row-hover-v3 td { padding: 1.5rem 2rem; border-bottom: 1px solid #f8fafc; transition: all 0.2s; }
                .row-hover-v3:hover td { background: #fcfdff; }

                .slot-id-box { display: flex; align-items: center; gap: 1.25rem; }
                .slot-badge-v3 { width: 44px; height: 44px; background: #eef2ff; color: #6366f1; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; }
                .slot-label-v3 { font-weight: 800; color: #1e293b; font-size: 0.95rem; }
                .slot-sub-v3 { font-size: 0.75rem; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 0.3rem; }

                .p-name-v3 { font-weight: 800; color: #0f172a; font-size: 1rem; }
                .p-meta-v3 { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; margin-top: 0.2rem; }
                .p-id-v3 { color: #6366f1; }
                .doc-assign-v3 .d-name-v3 { font-weight: 800; color: #334155; }
                .v-tag-v3 { display: inline-block; background: #f1f5f9; color: #64748b; font-size: 0.65rem; font-weight: 900; padding: 2px 8px; border-radius: 4px; margin-top: 0.3rem; }

                .status-chip-v3 { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; border-radius: 50px; font-weight: 900; font-size: 0.7rem; letter-spacing: 0.05em; }
                .source-link-v3 { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.75rem; font-weight: 800; }
                .wa-icon { color: #10b981; }

                .action-hub-v3 { display: flex; gap: 0.6rem; justify-content: center; }
                .hub-btn { width: 40px; height: 40px; border-radius: 12px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .hub-btn.edit { background: #eef2ff; color: #6366f1; }
                .hub-btn.cancel { background: #fef2f2; color: #ef4444; }
                .hub-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(0.95); }
                .hub-btn:disabled { opacity: 0.3; cursor: not-allowed; }

                .modal-overlay-premium { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 2rem; }
                .modal-content-lg-v3 { background: #fff; width: 650px; max-width: 100%; border-radius: 32px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.4); animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }

                .modal-header-v3 { padding: 2.5rem 3rem; background: linear-gradient(135deg, #0f172a 0%, #312e81 100%); color: #fff; display: flex; justify-content: space-between; align-items: center; }
                .modal-title-box { display: flex; align-items: center; gap: 1.5rem; }
                .modal-icon-wrap { width: 64px; height: 64px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; }
                .modal-title-box h2 { font-size: 1.75rem; font-weight: 900; margin: 0; }
                .modal-title-box p { font-size: 1rem; opacity: 0.7; margin-top: 0.4rem; font-weight: 500; }
                .modal-close-v3 { background: transparent; border: none; color: #fff; opacity: 0.4; cursor: pointer; transition: 0.2s; }
                .modal-close-v3:hover { opacity: 1; transform: rotate(90deg); }

                .modal-stepper-v3 { display: flex; align-items: center; background: #f8fafc; border-bottom: 2px solid #f1f5f9; padding: 0 3rem; }
                .step-btn { flex: 1; height: 70px; border: none; background: transparent; display: flex; align-items: center; gap: 1rem; font-weight: 800; color: #94a3b8; cursor: pointer; position: relative; transition: 0.2s; }
                .step-btn.active { color: #6366f1; }
                .step-btn.active::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: #6366f1; }
                .step-num { width: 28px; height: 28px; border-radius: 50%; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
                .step-divider { width: 1px; height: 30px; background: #e2e8f0; margin: 0 2rem; }

                .modal-body-v3 { padding: 2.5rem 3rem; flex: 1; overflow-y: auto; max-height: 70vh; }
                .s-input { width: 100%; height: 60px; border-radius: 20px; border: 2px solid #f1f5f9; background: #f8fafc; padding: 0 1.5rem 0 3.5rem; font-size: 1.1rem; font-weight: 600; outline: none; transition: 0.2s; }
                .s-input:focus { border-color: #6366f1; background: #fff; }

                .patient-result-card { display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem; border-radius: 20px; border: 1px solid #f1f5f9; margin-bottom: 1rem; cursor: pointer; transition: 0.2s; }
                .patient-result-card:hover { border-color: #6366f1; background: #f5f8ff; transform: translateX(8px); }

                .input-v3 { width: 100%; height: 50px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 16px; padding: 0 1.25rem; font-weight: 700; font-size: 1rem; outline: none; margin-top: 0.5rem; }
                .text-area { height: auto; padding: 1.25rem; resize: none; margin-top: 0.5rem; }

                .slot-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; margin-top: 0.5rem; }
                .slot-pill-v3 { padding: 1rem; border-radius: 16px; border: 2px solid #f1f5f9; background: #fff; cursor: pointer; transition: 0.2s; text-align: left; }
                .slot-pill-v3.active { border-color: #6366f1; background: #f5f8ff; box-shadow: 0 10px 20px rgba(99,102,241,0.1); }

                .modal-footer-v3 { display: flex; gap: 1.5rem; margin-top: 2.5rem; }
                .btn-cancel { flex: 1; height: 56px; border-radius: 18px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; cursor: pointer; }
                .btn-save { flex: 2; height: 56px; border-radius: 18px; border: none; background: #0f172a; color: #fff; font-weight: 800; cursor: pointer; transition: 0.2s; }

                .modal-content-sm-v3 { background: #fff; width: 450px; padding: 3rem; border-radius: 32px; text-align: center; }
                .btn-purge { background: #ef4444; color: #fff; flex: 1; height: 56px; border-radius: 16px; border: none; font-weight: 800; cursor: pointer; }

                .skeleton-line-v3 { height: 80px; background: linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%); background-size: 200% 100%; animation: shim 2s infinite; border-radius: 20px; margin: 0.5rem 0; }
                @keyframes shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .flex-center-gap { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
                .empty-state-v3 { padding: 5rem 2rem; text-align: center; color: #94a3b8; }
                .empty-box-v3 h3 { color: #1e293b; margin: 1rem 0 0.5rem 0; font-weight: 800; }
                
                .empty-icon-motion-v3 {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    background: #f5f3ff;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                    margin: 0 auto;
                }

                .ring-pulse-v3 {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 2px solid #6366f1;
                    animation: ring-ripple-v3 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                }

                @keyframes ring-ripple-v3 {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(1.6); opacity: 0; }
                }

                .search-placeholder-v3 { padding: 3rem 0; text-align: center; color: #cbd5e1; }
                .search-placeholder-v3 p { margin-top: 1rem; font-weight: 700; }
                .no-results-v3 { text-align: center; padding: 2rem; color: #64748b; font-weight: 700; background: #f8fafc; border-radius: 20px; }
            `}</style>
        </div>
    );
};

export default Appointments;
