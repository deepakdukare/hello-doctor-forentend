import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw,
    RotateCw,
    Plus,
    Edit2,
    Trash2,
    X,
    User,
    Activity,
    Clock3,
    History,
    CheckCircle2,
    AlertCircle,
    Calendar as CalendarIcon,
    Shield,
    Sliders,
    Settings2
} from 'lucide-react';
import {
    getDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorAvailability,
    updateDoctorAvailability,
    patchDoctorAvailabilityStatus,
    patchDoctorAvailabilityEta,
    logDoctorLateCheckin,
    getDoctorLateCheckins,
    getDoctorAvailabilityDashboard,
    toIsoDate
} from '../api/index';

const STATUS_OPTIONS = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];
const todayISO = () => toIsoDate();
const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
};
const prettyStatus = (v) => (v || 'N/A').replace(/_/g, ' ');

const Doctors = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [showDoctorForm, setShowDoctorForm] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [doctorForm, setDoctorForm] = useState({
        name: '',
        speciality: 'Pediatrics',
        qualification: '',
        experience: '',
        is_active: true,
        available_slots_json: ''
    });

    const [showAvailability, setShowAvailability] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [availability, setAvailability] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [history, setHistory] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    const [statusForm, setStatusForm] = useState({ status: 'PRESENT', notes: '' });
    const [etaForm, setEtaForm] = useState({ eta_minutes: '', eta_time: '', reason: '' });
    const [lateForm, setLateForm] = useState({ eta_minutes: '', reason: '' });
    const [fullForm, setFullForm] = useState({ status: 'PRESENT', eta_minutes: '', eta_time: '', notes: '', date: todayISO() });

    const fetchDoctorsData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getDoctors();
            let allDocs = res.data?.data || [];

            // Filter if character is a doctor
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'doctor') {
                allDocs = allDocs.filter(d =>
                    d.doctor_id === user.doctor_id ||
                    d.name === user.full_name ||
                    d.name === user.username
                );
            }

            setDoctors(allDocs);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDoctorsData();
    }, [fetchDoctorsData]);

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const fetchAvailabilityData = useCallback(async (doctorId, date) => {
        setAvailabilityLoading(true);
        setError('');
        try {
            const [avRes, dashRes, histRes] = await Promise.all([
                getDoctorAvailability(doctorId, { date }),
                getDoctorAvailabilityDashboard(doctorId),
                getDoctorLateCheckins(doctorId)
            ]);
            const av = avRes.data?.data || null;
            setAvailability(av);
            setDashboard(dashRes.data?.data || null);
            setHistory(histRes.data?.data || []);
            setStatusForm({ status: av?.status || 'PRESENT', notes: av?.notes || '' });
            setFullForm({
                status: av?.status || 'PRESENT',
                eta_minutes: av?.eta_minutes ?? '',
                eta_time: av?.eta_time || '',
                notes: av?.notes || '',
                date
            });
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load availability');
        } finally {
            setAvailabilityLoading(false);
        }
    }, []);

    const openCreate = () => {
        clearMessages();
        setEditingId('');
        setDoctorForm({
            name: '',
            speciality: 'Pediatrics',
            qualification: '',
            experience: '',
            is_active: true,
            available_slots_json: ''
        });
        setShowDoctorForm(true);
    };

    const openEdit = async (doc) => {
        clearMessages();
        try {
            const res = await getDoctorById(doc.doctor_id);
            const profile = res.data?.data || doc;
            setEditingId(profile.doctor_id);
            setDoctorForm({
                name: profile.name || '',
                speciality: profile.speciality || 'Pediatrics',
                qualification: profile.qualification || '',
                experience: profile.experience || '',
                is_active: !!profile.is_active,
                available_slots_json: profile.available_slots ? JSON.stringify(profile.available_slots, null, 2) : ''
            });
            setShowDoctorForm(true);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load doctor details');
        }
    };

    const saveDoctor = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const payload = {
                name: doctorForm.name.trim(),
                speciality: doctorForm.speciality.trim(),
                qualification: doctorForm.qualification.trim() || undefined,
                experience: doctorForm.experience.trim() || undefined,
                is_active: !!doctorForm.is_active
            };
            if (doctorForm.available_slots_json.trim()) payload.available_slots = JSON.parse(doctorForm.available_slots_json);
            if (editingId) await updateDoctor(editingId, payload);
            else await createDoctor(payload);
            setShowDoctorForm(false);
            setSuccess(editingId ? 'Doctor profile updated.' : 'Doctor profile created.');
            fetchDoctorsData();
        } catch (e2) {
            setError(e2.response?.data?.message || e2.message || 'Failed to save doctor');
        }
    };

    const removeDoctor = async (doctorId) => {
        clearMessages();
        if (!window.confirm('Delete this doctor profile?')) return;
        try {
            await deleteDoctor(doctorId);
            setSuccess('Doctor profile deleted.');
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to delete doctor');
        }
    };

    const toggleActive = async (doc) => {
        clearMessages();
        try {
            await updateDoctor(doc.doctor_id, { is_active: !doc.is_active });
            setSuccess('Doctor active status updated.');
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to update status');
        }
    };

    const openAvailabilityModal = async (doc) => {
        clearMessages();
        const date = todayISO();
        setSelectedDoctor(doc);
        setSelectedDate(date);
        setShowAvailability(true);
        await fetchAvailabilityData(doc.doctor_id, date);
    };

    const reloadAvailability = async () => {
        if (!selectedDoctor) return;
        await fetchAvailabilityData(selectedDoctor.doctor_id, selectedDate);
    };

    const runAvailabilityAction = async (runner, okMessage) => {
        clearMessages();
        try {
            await runner();
            setSuccess(okMessage);
            await reloadAvailability();
        } catch (e) {
            setError(e.response?.data?.message || 'Availability update failed');
        }
    };

    return (
        <div className="doc-page">
            <div className="doc-head">
                <div>
                    <h1>Doctors</h1>
                </div>
                <div className="doc-head-actions">
                    <button className="btn btn-outline" onClick={fetchDoctorsData}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={16} />
                        Add Doctor
                    </button>
                </div>
            </div>

            {!!error && (
                <div className="doc-alert doc-alert-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}
            {!!success && (
                <div className="doc-alert doc-alert-success">
                    <CheckCircle2 size={16} />
                    <span>{success}</span>
                    <button onClick={() => setSuccess('')}><X size={14} /></button>
                </div>
            )}

            {loading ? (
                <div className="card">Loading doctors...</div>
            ) : doctors.length === 0 ? (
                <div className="card doc-empty">No doctors found. Add your first doctor profile.</div>
            ) : (
                <div className="doc-grid">
                    {doctors.map((doc) => (
                        <div key={doc.doctor_id} className="card doc-card">
                            <div className="doc-card-head">
                                <div className="doc-avatar"><User size={20} /></div>
                                <div className="doc-core">
                                    <h3>{doc.name}</h3>
                                    <p>{doc.speciality || 'Not specified'}</p>
                                    <span>{doc.doctor_id}</span>
                                </div>
                                <div className="doc-card-head-actions">
                                    <button onClick={() => openEdit(doc)}><Edit2 size={15} /></button>
                                    <button onClick={() => removeDoctor(doc.doctor_id)}><Trash2 size={15} /></button>
                                </div>
                            </div>

                            <div className="doc-meta">
                                <div><strong>Qualification:</strong> {doc.qualification || 'N/A'}</div>
                                <div><strong>Experience:</strong> {doc.experience || 'N/A'}</div>
                                <div><strong>Slots:</strong> {doc.available_slots ? Object.keys(doc.available_slots).length : 0} day(s)</div>
                            </div>

                            <div className="doc-actions-row">
                                <button className="btn btn-outline" onClick={() => openAvailabilityModal(doc)}>
                                    <Activity size={14} />
                                    Availability
                                </button>
                                <button className={`btn ${doc.is_active ? 'btn-outline' : 'btn-primary'}`} onClick={() => toggleActive(doc)}>
                                    <Clock3 size={14} />
                                    {doc.is_active ? 'Set On Leave' : 'Set Active'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showDoctorForm && (
                <div className="doc-modal-wrap">
                    <form className="doc-edit-modal" onSubmit={saveDoctor}>
                        {/* Premium Header */}
                        <div className="doc-edit-header">
                            <div className="doc-edit-header-left">
                                <div className="doc-edit-icon-wrap">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 className="doc-edit-title">{editingId ? 'Edit Doctor Profile' : 'Create Doctor Profile'}</h2>
                                    <p className="doc-edit-subtitle">{editingId ? `Updating profile for ${doctorForm.name || 'doctor'}` : 'Register a new clinical practitioner'}</p>
                                </div>
                            </div>
                            <button type="button" className="doc-edit-close" onClick={() => setShowDoctorForm(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="doc-edit-body">
                            <div className="doc-edit-section-label">Basic Information</div>
                            <div className="doc-edit-grid">
                                <div className="doc-edit-field">
                                    <label>Full Name <span className="required">*</span></label>
                                    <div className="doc-field-input-wrap">
                                        <User size={16} className="doc-field-icon" />
                                        <input
                                            required
                                            placeholder="e.g. Dr. Indu Sharma"
                                            value={doctorForm.name}
                                            onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                                            className="doc-field-input"
                                        />
                                    </div>
                                </div>
                                <div className="doc-edit-field">
                                    <label>Speciality <span className="required">*</span></label>
                                    <div className="doc-field-input-wrap">
                                        <Activity size={16} className="doc-field-icon" />
                                        <input
                                            required
                                            placeholder="e.g. Pediatrics"
                                            value={doctorForm.speciality}
                                            onChange={(e) => setDoctorForm({ ...doctorForm, speciality: e.target.value })}
                                            className="doc-field-input"
                                        />
                                    </div>
                                </div>
                                <div className="doc-edit-field">
                                    <label>Qualification</label>
                                    <div className="doc-field-input-wrap">
                                        <Shield size={16} className="doc-field-icon" />
                                        <input
                                            placeholder="e.g. MBBS, MD"
                                            value={doctorForm.qualification}
                                            onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                                            className="doc-field-input"
                                        />
                                    </div>
                                </div>
                                <div className="doc-edit-field">
                                    <label>Experience</label>
                                    <div className="doc-field-input-wrap">
                                        <History size={16} className="doc-field-icon" />
                                        <input
                                            placeholder="e.g. 10+ Years"
                                            value={doctorForm.experience}
                                            onChange={(e) => setDoctorForm({ ...doctorForm, experience: e.target.value })}
                                            className="doc-field-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="doc-edit-section-label" style={{ marginTop: '1.5rem' }}>Slot Configuration</div>
                            <div className="doc-slots-btn-card">
                                <div className="doc-slots-btn-info">
                                    <div className="doc-slots-icon-box">
                                        <Sliders size={20} />
                                    </div>
                                    <div>
                                        <span className="doc-slots-title">Doctor Availability Slots</span>
                                        <span className="doc-slots-sub">Configure which time slots this doctor is available on each day of the week</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="doc-slots-nav-btn"
                                    onClick={() => { setShowDoctorForm(false); navigate('/scheduling'); }}
                                >
                                    <Settings2 size={16} />
                                    Manage Slots
                                </button>
                            </div>

                            <div className="doc-edit-toggle-row">
                                <div className="doc-edit-toggle-info">
                                    <CheckCircle2 size={18} style={{ color: doctorForm.is_active ? '#10b981' : '#cbd5e1' }} />
                                    <div>
                                        <span className="doc-toggle-label">Active Doctor</span>
                                        <span className="doc-toggle-sub">Inactive doctors won't appear in appointment booking</span>
                                    </div>
                                </div>
                                <label className="doc-toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={doctorForm.is_active}
                                        onChange={(e) => setDoctorForm({ ...doctorForm, is_active: e.target.checked })}
                                    />
                                    <span className="doc-toggle-track"></span>
                                </label>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="doc-edit-footer">
                            <button type="button" className="doc-edit-cancel" onClick={() => setShowDoctorForm(false)}>
                                Discard Changes
                            </button>
                            <button type="submit" className="doc-edit-save">
                                <CheckCircle2 size={18} />
                                {editingId ? 'Save Changes' : 'Create Doctor'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showAvailability && selectedDoctor && (
                <div className="doc-modal-wrap">
                    <div className="doc-modal card doc-availability-modal">
                        <div className="doc-modal-head">
                            <div className="modal-header-core">
                                <div className="avatar-mini"><User size={18} /></div>
                                <div>
                                    <h3>{selectedDoctor.name}</h3>
                                    <span>{selectedDoctor.doctor_id} • {selectedDoctor.speciality}</span>
                                </div>
                            </div>
                            <button type="button" className="btn-close-modal" onClick={() => setShowAvailability(false)}><X size={18} /></button>
                        </div>

                        <div className="doc-availability-controls">
                            <div className="doc-date-wrap">
                                <label>Target Working Date</label>
                                <div className="date-input-group">
                                    <CalendarIcon size={16} />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={async (e) => {
                                            const d = e.target.value;
                                            setSelectedDate(d);
                                            setFullForm((prev) => ({ ...prev, date: d }));
                                            await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="doc-date-shortcuts">
                                <button
                                    type="button"
                                    className={`btn btn-pill ${selectedDate === todayISO() ? 'active' : ''}`}
                                    onClick={async () => {
                                        const d = todayISO();
                                        setSelectedDate(d);
                                        setFullForm((prev) => ({ ...prev, date: d }));
                                        await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                    }}
                                >
                                    <CalendarIcon size={13} />
                                    Today
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-pill ${selectedDate === tomorrowISO() ? 'active' : ''}`}
                                    onClick={async () => {
                                        const d = tomorrowISO();
                                        setSelectedDate(d);
                                        setFullForm((prev) => ({ ...prev, date: d }));
                                        await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                    }}
                                >
                                    <CalendarIcon size={13} />
                                    Tomorrow
                                </button>
                                <button
                                    className="btn btn-pill"
                                    onClick={reloadAvailability}
                                    title="Reload Data"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <RefreshCw size={13} className={availabilityLoading ? 'spinning' : ''} />
                                    Sync
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-indigo-flat"
                                    onClick={() => navigate('/scheduling')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Settings2 size={14} />
                                    Manage Slots
                                </button>
                            </div>
                        </div>

                        {availabilityLoading ? (
                            <div className="modal-loading">
                                <RefreshCw size={32} className="spinning" />
                                <p>Syncing Doctor Cloud...</p>
                            </div>
                        ) : (
                            <div className="availability-scroll-box custom-scrollbar">
                                <div className="dashboard-hero">
                                    <div className="hero-data">
                                        <h4>Real-time Status, ETA & Workflows</h4>
                                        <p>Live health monitoring for {selectedDoctor.name}'s current session.</p>
                                    </div>
                                    <div className="hero-badge">
                                        <Shield size={14} />
                                        <span>Secure Admin Control</span>
                                    </div>
                                </div>

                                <div className="live-status-board">
                                    <div className="status-stat-card">
                                        <div className="icon-box status"><Activity size={20} /></div>
                                        <div className="stat-info">
                                            <label>Status</label>
                                            <strong className={availability?.status}>{prettyStatus(availability?.status || dashboard?.availability?.status)}</strong>
                                        </div>
                                    </div>
                                    <div className="status-stat-card">
                                        <div className="icon-box eta"><Clock3 size={20} /></div>
                                        <div className="stat-info">
                                            <label>Current ETA</label>
                                            <strong>{availability?.eta_minutes ?? 'N/A'} {availability?.eta_time ? `(${availability.eta_time})` : ''}</strong>
                                        </div>
                                    </div>
                                    <div className="status-stat-card">
                                        <div className="icon-box queue"><History size={20} /></div>
                                        <div className="stat-info">
                                            <label>Live Queue</label>
                                            <strong>{availability?.queue?.total ?? dashboard?.queue_summary?.total ?? 0} Patients</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="doc-guide-v2">
                                    <Shield size={16} />
                                    <span>Updates here trigger real-time patient alerts & board refreshments.</span>
                                </div>

                                <div className="doc-api-grid-v2">
                                    <form className="action-card" onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => patchDoctorAvailabilityStatus(selectedDoctor.doctor_id, statusForm),
                                            'Status updated.'
                                        );
                                    }}>
                                        <div className="card-head">
                                            <h4>1. Quick Status</h4>
                                            <div className="dot"></div>
                                        </div>
                                        <p>Toggle presence & leave status.</p>
                                        <div className="form-group">
                                            <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                                                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <input placeholder="Add internal note..." value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} />
                                        </div>
                                        <button className="btn btn-action" type="submit">Update Status</button>
                                    </form>

                                    <form className="action-card" onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => patchDoctorAvailabilityEta(selectedDoctor.doctor_id, {
                                                eta_minutes: Number(etaForm.eta_minutes) || 0,
                                                eta_time: etaForm.eta_time || null,
                                                reason: etaForm.reason || null
                                            }),
                                            'ETA updated.'
                                        );
                                    }}>
                                        <div className="card-head">
                                            <h4>2. Quick ETA</h4>
                                            <div className="dot eta"></div>
                                        </div>
                                        <p>Update delay minutes & time.</p>
                                        <div className="form-row-compact">
                                            <input type="number" min="0" placeholder="Min" value={etaForm.eta_minutes} onChange={(e) => setEtaForm({ ...etaForm, eta_minutes: e.target.value })} required />
                                            <input placeholder="10:45 AM" value={etaForm.eta_time} onChange={(e) => setEtaForm({ ...etaForm, eta_time: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <input placeholder="Reason for delay..." value={etaForm.reason} onChange={(e) => setEtaForm({ ...etaForm, reason: e.target.value })} />
                                        </div>
                                        <button className="btn btn-action" type="submit">Update ETA</button>
                                    </form>

                                    <form className="action-card" onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => logDoctorLateCheckin({
                                                doctor_id: selectedDoctor.doctor_id,
                                                eta_minutes: Number(lateForm.eta_minutes) || 0,
                                                reason: lateForm.reason
                                            }),
                                            'Late check-in logged.'
                                        );
                                    }}>
                                        <div className="card-head">
                                            <h4>3. Late Log</h4>
                                            <div className="dot late"></div>
                                        </div>
                                        <p>Record incident in audit logs.</p>
                                        <div className="form-group">
                                            <input type="number" min="0" placeholder="Arrival delay (mins)" value={lateForm.eta_minutes} onChange={(e) => setLateForm({ ...lateForm, eta_minutes: e.target.value })} required />
                                        </div>
                                        <div className="form-group">
                                            <input placeholder="Delay explanation..." value={lateForm.reason} onChange={(e) => setLateForm({ ...lateForm, reason: e.target.value })} required />
                                        </div>
                                        <button className="btn btn-action" type="submit">Log Delay</button>
                                    </form>

                                    <form className="action-card full-span" onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => updateDoctorAvailability({
                                                doctor_id: selectedDoctor.doctor_id,
                                                status: fullForm.status,
                                                eta_minutes: fullForm.eta_minutes === '' ? null : Number(fullForm.eta_minutes),
                                                eta_time: fullForm.eta_time || null,
                                                notes: fullForm.notes || null,
                                                date: fullForm.date
                                            }),
                                            'Availability updated.'
                                        );
                                    }}>
                                        <div className="card-head">
                                            <h4>4. Comprehensive Daily Update</h4>
                                            <div className="dot full"></div>
                                        </div>
                                        <div className="full-update-grid">
                                            <div className="form-group">
                                                <label>Status</label>
                                                <select value={fullForm.status} onChange={(e) => setFullForm({ ...fullForm, status: e.target.value })}>
                                                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>ETA Mins</label>
                                                <input type="number" min="0" value={fullForm.eta_minutes} onChange={(e) => setFullForm({ ...fullForm, eta_minutes: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label>ETA Time</label>
                                                <input placeholder="11:30 AM" value={fullForm.eta_time} onChange={(e) => setFullForm({ ...fullForm, eta_time: e.target.value })} />
                                            </div>
                                            <div className="form-group textarea-span">
                                                <label>Shift Notes</label>
                                                <input placeholder="Public notes for patients..." value={fullForm.notes} onChange={(e) => setFullForm({ ...fullForm, notes: e.target.value })} />
                                            </div>
                                        </div>
                                        <button className="btn btn-action-primary" type="submit">Submit Full Update</button>
                                    </form>
                                </div>

                                <div className="audit-history-box">
                                    <div className="history-head">
                                        <h4><History size={14} /> System Audit: Delay History</h4>
                                        <span>Last {history.length} records</span>
                                    </div>
                                    {!history.length ? (
                                        <p className="empty">No recent incident logs found.</p>
                                    ) : (
                                        <div className="audit-list">
                                            {history.slice(0, 5).map((h) => (
                                                <div key={h._id} className="audit-item">
                                                    <div className="audit-date">{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                                    <div className="audit-status" data-status={h.status}>{prettyStatus(h.status)}</div>
                                                    <div className="audit-meta">
                                                        <span>{h.late_checkins?.length || 0} Events</span>
                                                        {h.eta_time && <span>Goal: {h.eta_time}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            <style>{`
                .doc-page { width: 100%; font-family: 'Inter', sans-serif; }
                .doc-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
                .doc-head h1 { font-size: 2rem; font-weight: 900; letter-spacing: -0.03em; margin: 0; background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .doc-head-actions { display: flex; gap: 0.75rem; }

                /* ── Premium Edit/Create Modal ── */
                .doc-edit-modal { background: #fff; border-radius: 28px; width: min(680px, 96vw); max-height: 92vh; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; animation: modalIn 0.25s ease-out; }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(10px); } to { opacity: 1; transform: none; } }
                .doc-edit-header { display: flex; justify-content: space-between; align-items: center; padding: 1.75rem 2rem; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); flex-shrink: 0; }
                .doc-edit-header-left { display: flex; align-items: center; gap: 1rem; }
                .doc-edit-icon-wrap { width: 52px; height: 52px; border-radius: 16px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
                .doc-edit-title { margin: 0; font-size: 1.3rem; font-weight: 900; color: #fff; letter-spacing: -0.02em; }
                .doc-edit-subtitle { margin: 0.2rem 0 0; font-size: 0.82rem; color: rgba(255,255,255,0.7); font-weight: 500; }
                .doc-edit-close { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
                .doc-edit-close:hover { background: rgba(255,255,255,0.25); }
                .doc-edit-body { flex: 1; overflow-y: auto; padding: 1.75rem 2rem; }
                .doc-edit-section-label { font-size: 0.72rem; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
                .doc-edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem 1.25rem; }
                .doc-edit-field { display: flex; flex-direction: column; gap: 0.4rem; }
                .doc-edit-field label { font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
                .required { color: #ef4444; margin-left: 2px; }
                .doc-field-input-wrap { position: relative; display: flex; align-items: center; }
                .doc-field-icon { position: absolute; left: 1rem; color: #6366f1; opacity: 0.5; pointer-events: none; z-index: 1; flex-shrink: 0; }
                .doc-field-input { width: 100%; height: 52px; border-radius: 14px; border: 2px solid #f1f5f9; background: #f8fafc; padding: 0 1rem 0 2.75rem; font-size: 0.95rem; font-weight: 600; color: #0f172a; outline: none; transition: 0.2s; }
                .doc-field-input:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,0.08); }
                .doc-field-input::placeholder { color: #cbd5e1; }
                .doc-full-field { grid-column: 1 / -1; }
                .doc-json-wrap { position: relative; }
                .doc-slots-btn-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem; background: #f8faff; border: 2px solid #eef2ff; border-radius: 16px; }
                .doc-slots-btn-info { display: flex; align-items: center; gap: 0.85rem; }
                .doc-slots-icon-box { width: 44px; height: 44px; border-radius: 12px; background: #eef2ff; color: #6366f1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .doc-slots-title { display: block; font-size: 0.9rem; font-weight: 800; color: #0f172a; }
                .doc-slots-sub { display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-top: 0.15rem; }
                .doc-slots-nav-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; border-radius: 12px; border: none; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #fff; font-weight: 800; font-size: 0.82rem; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 10px rgba(99,102,241,0.25); transition: 0.2s; flex-shrink: 0; }
                .doc-slots-nav-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.35); }
                .doc-edit-toggle-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1.1rem 1.25rem; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 16px; }
                .doc-edit-toggle-info { display: flex; align-items: center; gap: 0.85rem; }
                .doc-toggle-label { display: block; font-size: 0.9rem; font-weight: 800; color: #0f172a; }
                .doc-toggle-sub { display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-top: 0.1rem; }
                .doc-toggle-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
                .doc-toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
                .doc-toggle-track { display: block; width: 48px; height: 26px; border-radius: 50px; background: #e2e8f0; transition: background 0.2s; position: relative; }
                .doc-toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: transform 0.2s; }
                .doc-toggle-switch input:checked + .doc-toggle-track { background: #6366f1; }
                .doc-toggle-switch input:checked + .doc-toggle-track::after { transform: translateX(22px); }
                .doc-edit-footer { display: flex; gap: 1rem; padding: 1.25rem 2rem; border-top: 1px solid #f1f5f9; background: #fafbfc; flex-shrink: 0; }
                .doc-edit-cancel { flex: 1; height: 52px; border-radius: 14px; border: 2px solid #e2e8f0; background: #fff; color: #64748b; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s; }
                .doc-edit-cancel:hover { border-color: #94a3b8; color: #334155; }
                .doc-edit-save { flex: 2; height: 52px; border-radius: 14px; border: none; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #fff; font-weight: 900; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: 0.2s; }
                .doc-edit-save:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(99,102,241,0.35); }
                @media (max-width: 580px) { .doc-edit-grid { grid-template-columns: 1fr; } .doc-edit-modal { border-radius: 20px; } }
                
                .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
                .doc-card { border-radius: 20px; padding: 1.25rem; border: 1px solid #e2e8f0; background: #fff; transition: 0.3s; }
                .doc-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.1); border-color: #6366f133; }
                
                .doc-card-head { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.25rem; }
                .doc-avatar { width: 44px; height: 44px; border-radius: 12px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; }
                .doc-core h3 { font-size: 1.1rem; font-weight: 800; margin: 0; color: #0f172a; }
                .doc-core p { margin: 0.1rem 0; color: #6366f1; font-weight: 700; font-size: 0.8rem; }
                .doc-core span { color: #94a3b8; font-size: 0.75rem; font-weight: 600; }
                
                .doc-card-head-actions { margin-left: auto; display: flex; gap: 0.4rem; }
                .doc-card-head-actions button { border: 1.5px solid #f1f5f9; background: #fff; border-radius: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #94a3b8; transition: 0.2s; }
                .doc-card-head-actions button:hover { border-color: #6366f1; color: #6366f1; background: #fdfdff; }
                
                .doc-meta { display: grid; gap: 0.5rem; padding: 1rem; background: #f8fafc; border-radius: 14px; font-size: 0.8rem; border: 1px solid #f1f5f9; }
                .doc-meta strong { color: #64748b; font-weight: 700; width: 100px; display: inline-block; }
                
                .doc-actions-row { margin-top: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .btn-outline { border: 1.5px solid #e2e8f0; background: #fff; color: #475569; font-weight: 800; border-radius: 12px; padding: 0.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.8rem; transition: 0.2s; }
                .btn-outline:hover { border-color: #6366f1; color: #6366f1; background: #fdfdff; }
                .btn-primary { background: #6366f1; color: #fff; border: none; font-weight: 800; border-radius: 12px; padding: 0.6rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); font-size: 0.8rem; }
                .btn-primary:hover { background: #4f46e5; transform: translateY(-1px); }

                /* Modal & Availability Styling */
                .doc-modal-wrap { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 999; padding: 1rem; }
                .doc-modal { background: #fff; border-radius: 28px; width: min(920px, 96vw); max-height: 94vh; box-shadow: 0 50px 100px -20px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column; }
                .doc-availability-modal { width: min(1080px, 96vw); }
                
                .doc-modal-head { padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fff; }
                .modal-header-core { display: flex; gap: 1rem; align-items: center; }
                .avatar-mini { width: 44px; height: 44px; border-radius: 14px; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; }
                .modal-header-core h3 { margin: 0; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; }
                .modal-header-core span { font-size: 0.8rem; color: #94a3b8; font-weight: 700; }
                .btn-close-modal { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #f1f5f9; background: #fff; color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
                .btn-close-modal:hover { background: #fef2f2; color: #ef4444; border-color: #fee2e2; }

                .doc-availability-controls { padding: 1.25rem 2rem; background: #fafbfc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; flex-wrap: wrap; }
                .doc-date-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
                .doc-date-wrap label { font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .date-input-group { position: relative; display: flex; align-items: center; }
                .date-input-group svg { position: absolute; left: 1rem; color: #6366f1; pointer-events: none; }
                .date-input-group input { padding: 0.65rem 1rem 0.65rem 2.8rem; border-radius: 12px; border: 1.8px solid #e2e8f0; font-size: 0.85rem; font-weight: 800; color: #0f172a; outline: none; transition: 0.2s; width: 220px; }
                .date-input-group input:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08); }

                .doc-date-shortcuts { display: flex; gap: 0.5rem; align-items: center; }
                .btn-pill { padding: 0.6rem 1.25rem; border-radius: 50px; border: 1.8px solid #e2e8f0; background: #fff; font-size: 0.75rem; font-weight: 850; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 0.5rem; }
                .btn-pill:hover { border-color: #6366f1; color: #6366f1; }
                .btn-pill.active { background: #6366f1; border-color: #6366f1; color: #fff; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2); }
                .btn-icon-round { width: 38px; height: 38px; border-radius: 50%; border: 1.8px solid #e2e8f0; background: #fff; display: flex; align-items: center; justify-content: center; color: #475569; cursor: pointer; transition: 0.2s; }
                .btn-icon-round:hover { border-color: #6366f1; color: #6366f1; background: #fdfdff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1); }
                .btn-indigo-flat { padding: 0.65rem 1.25rem; border-radius: 12px; background: #6366f115; border: none; font-size: 0.75rem; font-weight: 900; color: #6366f1; cursor: pointer; transition: 0.2s; }
                .btn-indigo-flat:hover { background: #6366f125; }

                .availability-scroll-box { flex: 1; padding: 1.5rem 2rem; overflow-y: auto; background: #fff; }
                .dashboard-hero { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #f8faff 0%, #ffffff 100%); border: 1px solid #eef2ff; border-radius: 20px; }
                .hero-data h4 { margin: 0; font-size: 1.35rem; font-weight: 900; color: #1e1b4b; letter-spacing: -0.02em; }
                .hero-data p { margin: 0.25rem 0 0; font-size: 0.85rem; color: #6366f1; font-weight: 600; }
                .hero-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.85rem; background: #6366f110; color: #6366f1; border-radius: 100px; font-size: 0.7rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #6366f120; }
                
                .live-status-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2rem; }
                .status-stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 1.25rem; display: flex; gap: 1rem; align-items: center; transition: 0.2s; }
                .status-stat-card:hover { border-color: #6366f144; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .icon-box { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .icon-box.status { background: #eff6ff; color: #2563eb; }
                .icon-box.eta { background: #fff7ed; color: #ea580c; }
                .icon-box.queue { background: #f0fdf4; color: #16a34a; }
                .stat-info label { display: block; font-size: 0.65rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.25rem; }
                .stat-info strong { font-size: 1.1rem; font-weight: 950; color: #0f172a; letter-spacing: -0.01em; }
                .stat-info strong.PRESENT { color: #10b981; }
                .stat-info strong.LATE { color: #f59e0b; }
                .stat-info strong.ABSENT { color: #ef4444; }

                .doc-guide-v2 { padding: 0.75rem 1rem; background: #fafbfc; border: 1px dashed #e2e8f0; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem; color: #64748b; font-size: 0.75rem; font-weight: 700; margin-bottom: 1.5rem; }
                .doc-guide-v2 svg { color: #6366f1; }

                .doc-api-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2rem; }
                .action-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 1.5rem; display: flex; flex-direction: column; transition: 0.3s; }
                .action-card:hover { border-color: #6366f1; box-shadow: 0 15px 30px -10px rgba(99, 102, 241, 0.1); }
                .action-card .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
                .action-card h4 { margin: 0; font-size: 0.95rem; font-weight: 900; color: #1e293b; }
                .action-card .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
                .action-card .dot.eta { background: #f59e0b; }
                .action-card .dot.late { background: #ef4444; }
                .action-card .dot.full { background: #6366f1; }
                .action-card p { font-size: 0.7rem; color: #94a3b8; font-weight: 600; margin: 0 0 1.25rem 0; }
                
                .form-group { margin-bottom: 0.85rem; }
                .form-group label { display: block; font-size: 0.6rem; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 0.35rem; margin-left: 0.25rem; }
                .form-row-compact { display: grid; grid-template-columns: 80px 1fr; gap: 0.6rem; margin-bottom: 0.85rem; }
                
                .action-card input, .action-card select { width: 100%; padding: 0.6rem 0.8rem; border-radius: 12px; border: 1.8px solid #f1f5f9; background: #f8fafc; font-size: 0.8rem; font-weight: 800; color: #0f172a; outline: none; transition: 0.2s; }
                .action-card input:focus, .action-card select:focus { border-color: #6366f133; background: #fff; }
                
                .btn-action { margin-top: auto; padding: 0.7rem; border-radius: 12px; border: none; background: #f1f5f9; color: #475569; font-weight: 900; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
                .btn-action:hover { background: #6366f1; color: #fff; }
                
                .full-span { grid-column: 1 / -1; }
                .full-update-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
                .textarea-span { grid-column: 1 / -1; }
                .btn-action-primary { padding: 0.8rem; border-radius: 12px; border: none; background: #6366f1; color: #fff; font-weight: 950; font-size: 0.8rem; cursor: pointer; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.15); transition: 0.2s; text-transform: uppercase; letter-spacing: 0.02em; }
                .btn-action-primary:hover { background: #4f46e5; transform: scale(1.01); box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2); }

                .audit-history-box { background: #fafbfc; border: 1px solid #f1f5f9; border-radius: 20px; padding: 1.25rem; }
                .history-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .history-head h4 { margin: 0; font-size: 0.85rem; font-weight: 900; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; }
                .history-head span { font-size: 0.65rem; font-weight: 850; color: #94a3b8; text-transform: uppercase; }
                .audit-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .audit-item { background: #fff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 1.5rem; transition: 0.2s; }
                .audit-item:hover { border-color: #6366f122; transform: translateX(4px); }
                .audit-date { font-size: 0.75rem; font-weight: 900; color: #0f172a; width: 60px; }
                .audit-status { font-size: 0.65rem; font-weight: 950; text-transform: uppercase; padding: 0.25rem 0.6rem; border-radius: 6px; background: #f1f5f9; color: #64748b; }
                .audit-status[data-status='PRESENT'] { background: #f0fdf4; color: #16a34a; }
                .audit-status[data-status='LATE'] { background: #fff7ed; color: #ea580c; }
                .audit-meta { margin-left: auto; display: flex; gap: 1.25rem; font-size: 0.7rem; font-weight: 750; color: #94a3b8; }
                
                .modal-loading { height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #64748b; }
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f155; }

                @media (max-width: 1000px) {
                    .doc-api-grid-v2 { grid-template-columns: 1fr 1fr; }
                    .live-status-board { grid-template-columns: 1fr 1fr; }
                }
                @media (max-width: 700px) {
                    .doc-api-grid-v2 { grid-template-columns: 1fr; }
                    .live-status-board { grid-template-columns: 1fr; }
                    .full-update-grid { grid-template-columns: 1fr 1fr; }
                    .doc-head { flex-direction: column; align-items: flex-start; }
                }
                @media (max-width: 900px) {
                    .doc-head { flex-direction: column; align-items: flex-start; }
                    .doc-form-grid { grid-template-columns: 1fr; }
                    .doc-date-wrap input { min-width: 170px; width: 100%; }
                }
            `}</style>
        </div >
    );
};

export default Doctors;
