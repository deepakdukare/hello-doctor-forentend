import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    Plus,
    AlertTriangle,
    Monitor,
    Zap,
    Stethoscope,
    Activity,
    User,
    Phone,
    ArrowRight,
    Clipboard,
    Clock
} from 'lucide-react';
import StatCard from '../components/StatCard';
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
    bookAppointmentWithToken
} from '../api/index';

const STATUS_ICONS = {
    CONFIRMED: <CheckCircle2 size={16} />,
    COMPLETED: <CheckCircle2 size={16} />,
    CANCELLED: <XCircle size={16} />,
    PENDING: <Clock size={16} />,
    NO_SHOW: <AlertTriangle size={16} />,
    DEFAULT: <Clock size={16} />
};

const SALUTATIONS = ['Master', 'Baby', 'Mr.', 'Mrs.', 'Ms.'];

const getDoctorDisplayName = (doctor) => doctor?.full_name || doctor?.name || doctor?.doctor_name || doctor?.doctor_id || 'Unknown Doctor';

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
                const isTodayStr = new Date().toISOString().split('T')[0];
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
                appointment_date: filters.date || new Date().toISOString().split('T')[0],
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

    return (
        <div className="appointments-page-v3">
            <header className="page-header-v3">
                <div className="header-meta-group">
                    <h1 className="header-h1-v3">Appointments</h1>
                    <div className="stats-row-mini-v3">
                        <StatCard label="Today" value={stats?.total_today || 0} icon={Users} color="#6366f1" className="stat-pill-premium-v3" />
                        <StatCard label="Confirmed" value={stats?.confirmed || 0} icon={CheckCircle2} color="#10b981" className="stat-pill-premium-v3" />
                        <StatCard label="Cancelled" value={stats?.cancelled || 0} icon={XCircle} color="#ef4444" className="stat-pill-premium-v3" />
                    </div>
                </div>

                <div className="header-nav-v3">
                    <button className={`nav-tab-v3 ${activeView === 'queue' ? 'active' : ''}`} onClick={() => setActiveView('queue')}>
                        <Monitor size={18} />
                        <span>Live Queue</span>
                    </button>
                    <button className={`nav-tab-v3 ${activeView === 'authorizer' ? 'active' : ''}`} onClick={() => setActiveView('authorizer')}>
                        <Zap size={18} />
                        <span>Book Arrival</span>
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
                                    <option value="">All Status</option>
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
                                placeholder="Patient Search..."
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
                                                    <h3>No matches found</h3>
                                                    <p>Clear filters to view all records.</p>
                                                    <button className="book-btn-premium-v3" onClick={() => setActiveView('authorizer')} style={{ margin: '1.5rem auto 0', padding: '1rem 2rem' }}>
                                                        <Plus size={22} />
                                                        <span>New Booking</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAppointments.map((appt) => (
                                        <AppointmentRow
                                            key={appt.appointment_id}
                                            appt={appt}
                                            onEdit={openBookingModal}
                                            onCancel={(id) => setCancelModal({ show: true, id, reason: '' })}
                                            statusIcons={STATUS_ICONS}
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
                            <div className="modal-title-box">
                                <div className="modal-icon-wrap"><Plus size={28} /></div>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{editMode ? 'Reschedule' : 'Authorize Appointment'}</h2>
                                    <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Configure parameters for clinical visit</p>
                                </div>
                            </div>
                        </div>

                        <div className="modal-stepper-v3">
                            <button className={`step-btn ${activeTab === 'patient' || activeTab === 'new-patient' ? 'active' : ''}`} onClick={() => !editMode && setActiveTab('patient')}>
                                <span className="step-num">1</span>
                                <span>Identity Verification</span>
                            </button>
                            <div className="step-divider"></div>
                            <button className={`step-btn ${activeTab === 'visit' ? 'active' : ''}`} onClick={() => selectedPatient && setActiveTab('visit')}>
                                <span className="step-num">2</span>
                                <span>Consultation Config</span>
                            </button>
                        </div>

                        <div className="modal-body-v3">
                            {error && (
                                <div className="alert-v3 error">
                                    <AlertTriangle size={20} />
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)}>×</button>
                                </div>
                            )}

                            {activeTab === 'patient' ? (
                                <div className="patient-selector-v3">
                                    <div className="search-wrap-v3">
                                        <Search size={22} className="s-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search clinical registry..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                            className="s-input"
                                        />
                                    </div>

                                    {searching && <div className="search-loader">Scanning Records...</div>}

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
                                                <p>Identity not found in repository.</p>
                                                <button onClick={() => setActiveTab('new-patient')} className="btn-save" style={{ marginTop: '1rem', height: '40px', fontSize: '0.9rem' }}>+ Create New Profile</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'new-patient' ? (
                                <form onSubmit={handleQuickRegister} className="booking-form-v3">
                                    <div className="form-grid-v3">
                                        <div className="form-group-v3"><label>First Name</label><input required placeholder="First name" value={newPatient.first_name} onChange={e => setNewPatient({ ...newPatient, first_name: e.target.value })} className="input-v3" /></div>
                                        <div className="form-group-v3"><label>Last Name</label><input required placeholder="Last name" value={newPatient.last_name} onChange={e => setNewPatient({ ...newPatient, last_name: e.target.value })} className="input-v3" /></div>
                                        <div className="form-group-v3">
                                            <label>Gender</label>
                                            <select value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })} className="input-v3">
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div className="form-group-v3"><label>Date of Birth</label><input type="date" required value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} className="input-v3" /></div>
                                        <div className="form-group-v3"><label>WhatsApp</label><input required placeholder="10-digit mobile" value={newPatient.wa_id} onChange={e => setNewPatient({ ...newPatient, wa_id: e.target.value.replace(/\D/g, '') })} className="input-v3" /></div>
                                    </div>
                                    <div className="modal-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setActiveTab('patient')}>Back to Search</button>
                                        <button type="submit" className="btn-save" disabled={submitting}>Enroll & Proceed</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="booking-form-v3">
                                    <div className="selected-patient-v3">
                                        <div className="p-banner">
                                            <div className="p-info"><User size={20} /><strong>{selectedPatient?.child_name}</strong><span>({selectedPatient?.patient_id})</span></div>
                                            {!editMode && <button type="button" onClick={() => setActiveTab('patient')}>Modify</button>}
                                        </div>
                                    </div>

                                    <div className="form-grid-v3">
                                        <div className="form-group-v3">
                                            <label>Assign Doctor</label>
                                            <select value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} className="input-v3">
                                                {doctors.map(doc => <option key={doc._id} value={getDoctorDisplayName(doc)}>{getDoctorDisplayName(doc)}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Visit Date</label>
                                            <input type="date" value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} className="input-v3" />
                                        </div>
                                        <div className="form-group-v3 full-span">
                                            <label>Slot Selection {slotsLoading && <RefreshCw size={14} className="animate-spin" />}</label>
                                            <div className="slot-grid-v3">
                                                {availableSlots.map(slot => (
                                                    <div key={slot.slot_id} className={`slot-pill-v3 ${form.slot_id === slot.slot_id ? 'active' : ''}`} onClick={() => setForm({ ...form, slot_id: slot.slot_id })}>
                                                        <div className="slot-time">{slot.time}</div>
                                                        <div className="slot-session">{slot.session}</div>
                                                    </div>
                                                ))}
                                                {availableSlots.length === 0 && !slotsLoading && <div className="no-slots-v3">No active slots for this itinerary.</div>}
                                            </div>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Visit Category</label>
                                            <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })} className="input-v3">
                                                <option value="CONSULTATION">Consultation</option>
                                                <option value="FOLLOW_UP">Follow-up</option>
                                                <option value="VACCINATION">Vaccination</option>
                                            </select>
                                        </div>
                                        <div className="form-group-v3">
                                            <label>Clinical Reason</label>
                                            <input placeholder="Chief complaint..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-v3" />
                                        </div>
                                    </div>
                                    <div className="modal-footer-v3">
                                        <button type="button" className="btn-cancel" onClick={() => setActiveView('queue')}>Abort</button>
                                        <button type="submit" className="btn-save" disabled={submitting}>{editMode ? 'Update Appointment' : 'Confirm Authorization'}</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {cancelModal.show && (
                <div className="modal-overlay-v3">
                    <div className="modal-content-sm-v3">
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Purge Record</h2>
                        <p style={{ color: '#64748b', marginBottom: '2rem' }}>Are you sure you want to cancel appointment {cancelModal.id}?</p>
                        <input placeholder="Reason for cancellation..." className="input-v3" style={{ marginBottom: '2rem' }} value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })} />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-cancel" onClick={() => setCancelModal({ show: false, id: null, reason: '' })}>Keep Record</button>
                            <button className="btn-purge" onClick={handleCancel}>Confirm Cancellation</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .appointments-page-v3 { padding: 2.5rem; max-width: 1400px; margin: 0 auto; animation: fade 0.5s ease-out; }
                @keyframes fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .page-header-v3 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3.5rem; }
                .header-h1-v3 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1.25rem; }
                .stats-row-mini-v3 { display: flex; gap: 1rem; }
                .header-nav-v3 { display: flex; align-items: center; gap: 1rem; background: #f1f5f9; padding: 0.4rem; border-radius: 20px; border: 1px solid #e2e8f0; }
                .nav-tab-v3 { padding: 0.75rem 1.5rem; border-radius: 16px; border: none; background: transparent; color: #64748b; font-weight: 800; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
                .nav-tab-v3.active { background: #fff; color: #6366f1; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12); }
                .sync-btn-v3 { width: 44px; height: 44px; border-radius: 14px; border: none; background: #fff; display: flex; align-items: center; justify-content: center; color: #64748b; cursor: pointer; }
                .filter-shelf-premium { display: flex; justify-content: space-between; gap: 2rem; margin-bottom: 2.5rem; }
                .filter-group-v3 { display: flex; gap: 1rem; }
                .filter-item-v3 { display: flex; align-items: center; background: #fff; border: 2px solid #f1f5f9; border-radius: 20px; padding: 0 1.25rem; height: 60px; transition: 0.2s; }
                .f-icon { color: #6366f1; opacity: 0.5; margin-right: 0.75rem; }
                .f-input, .f-select { border: none; background: transparent; outline: none; font-weight: 700; color: #1e293b; font-size: 0.9rem; }
                .search-pill-v3 { display: flex; align-items: center; background: #fff; border: 2px solid #f1f5f9; border-radius: 24px; padding: 0 1.5rem; flex: 1; max-width: 400px; height: 60px; gap: 0.75rem; color: #6366f1; }
                .search-pill-v3 input { border: none; background: transparent; outline: none; flex: 1; font-weight: 600; color: #1e293b; font-size: 1rem; }
                .repository-card-v3 { background: #fff; border-radius: 36px; border: 1px solid #f1f5f9; box-shadow: 0 10px 40px rgba(0,0,0,0.03); overflow: hidden; }
                .main-table-v3 { width: 100%; border-collapse: collapse; }
                .main-table-v3 th { padding: 1.5rem 2rem; font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; border-bottom: 2px solid #f8fafc; background: #fcfdfe; }
                .row-hover-v3 td { padding: 1.75rem 2rem; border-bottom: 2px solid #f8fafc; transition: 0.2s; }
                .row-hover-v3:hover td { background: #fdfdff; }
                .slot-id-box { display: flex; align-items: center; gap: 1rem; }
                .slot-pill-tag { background: #6366f1; color: #fff; font-size: 0.65rem; font-weight: 900; padding: 0.2rem 0.5rem; border-radius: 6px; }
                .time-stack-v3 { display: flex; flex-direction: column; gap: 0.1rem; }
                .slot-label-v3 { font-size: 1rem; font-weight: 900; color: #0f172a; }
                .slot-sub-v3 { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
                .patient-link-v3 { display: flex; flex-direction: column; gap: 0.25rem; }
                .p-name-v3 { font-weight: 800; color: #0f172a; font-size: 1.05rem; }
                .p-meta-v3 { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.85rem; font-weight: 600; }
                .doc-assign-v3 { display: flex; flex-direction: column; gap: 0.4rem; }
                .d-name-v3 { font-weight: 800; color: #1e293b; font-size: 0.95rem; }
                .v-tag-v3 { font-size: 0.6rem; font-weight: 900; color: #6366f1; background: #f5f3ff; padding: 0.2rem 0.6rem; border-radius: 6px; width: fit-content; text-transform: uppercase; }
                .status-chip-v3 { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1rem; border-radius: 50px; font-size: 0.7rem; font-weight: 800; width: fit-content; text-transform: uppercase; }
                .source-link-v3 { display: flex; align-items: center; gap: 0.5rem; color: #cbd5e1; font-size: 0.7rem; font-weight: 800; }
                .wa-icon { color: #25d366; }
                .action-hub-v3 { display: flex; gap: 0.75rem; justify-content: flex-end; }
                .hub-btn { width: 44px; height: 44px; border-radius: 14px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; color: #64748b; background: #f8fafc; }
                .hub-btn:hover { transform: scale(1.1); }
                .hub-btn.edit:hover { background: #eef2ff; color: #6366f1; }
                .hub-btn.cancel:hover { background: #fef2f2; color: #ef4444; }
                .authorizer-panel-premium { background: #fff; border-radius: 36px; border: 1px solid #f1f5f9; box-shadow: 0 10px 40px rgba(0,0,0,0.04); overflow: hidden; max-width: 1000px; margin: 0 auto; }
                .authorizer-header-v3 { padding: 3rem; border-bottom: 1px solid #f8fafc; }
                .modal-title-box { display: flex; align-items: center; gap: 1.5rem; }
                .modal-icon-wrap { width: 64px; height: 64px; background: #f5f3ff; color: #6366f1; border-radius: 20px; display: flex; align-items: center; justify-content: center; }
                .modal-stepper-v3 { background: #f8fafc; padding: 1.5rem 3rem; display: flex; align-items: center; gap: 1.5rem; }
                .step-btn { display: flex; align-items: center; gap: 0.75rem; border: none; background: transparent; cursor: pointer; color: #94a3b8; font-weight: 800; font-size: 0.95rem; }
                .step-btn.active { color: #6366f1; }
                .step-num { width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
                .step-divider { flex: 1; height: 2px; background: #e2e8f0; max-width: 80px; }
                .modal-body-v3 { padding: 3rem; }
                .s-input { width: 100%; height: 72px; border-radius: 24px; border: 2px solid #f1f5f9; padding: 0 4rem; font-size: 1.2rem; font-weight: 600; outline: none; transition: 0.2s; }
                .s-input:focus { border-color: #6366f1; box-shadow: 0 0 0 6px rgba(99,102,241,0.08); }
                .patient-result-card { display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem; border-radius: 24px; background: #f8fafc; margin-bottom: 1rem; cursor: pointer; border: 2px solid transparent; transition: 0.2s; }
                .patient-result-card:hover { border-color: #6366f1; background: #fff; transform: translateX(10px); }
                .p-avatar-mini { width: 56px; height: 56px; background: #e0e7ff; color: #6366f1; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.4rem; }
                .p-name-bold { font-weight: 800; color: #1e293b; font-size: 1.2rem; }
                .p-id-sub { font-size: 0.95rem; color: #64748b; font-weight: 600; }
                .form-grid-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                .full-span { grid-column: 1 / -1; }
                .form-group-v3 { display: flex; flex-direction: column; gap: 0.75rem; }
                .form-group-v3 label { font-size: 0.8rem; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .slot-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; }
                .slot-pill-v3 { padding: 1.25rem; border-radius: 18px; border: 2px solid #f1f5f9; background: #fff; cursor: pointer; transition: 0.2s; }
                .slot-pill-v3.active { border-color: #6366f1; background: #f5f8ff; box-shadow: 0 8px 16px rgba(99,102,241,0.1); }
                .slot-time { font-size: 1.1rem; font-weight: 900; color: #1e293b; }
                .slot-session { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-top: 0.25rem; }
                .modal-footer-v3 { display: flex; gap: 1.5rem; margin-top: 3.5rem; }
                .btn-cancel { flex: 1; height: 60px; border-radius: 20px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; cursor: pointer; transition: 0.2s; }
                .btn-save { flex: 2; height: 60px; border-radius: 20px; border: none; background: #0f172a; color: #fff; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 1.1rem; }
                .modal-overlay-v3 { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content-sm-v3 { background: #fff; width: 480px; padding: 3.5rem; border-radius: 40px; text-align: center; }
                .btn-purge { background: #ef4444; color: #fff; flex: 1; height: 60px; border-radius: 20px; border: none; font-weight: 800; cursor: pointer; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Appointments;
