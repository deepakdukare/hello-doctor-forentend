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
    ArrowLeft,
    BarChart2,
    TrendingUp,
    Users
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
    getDoctorLateCheckins,
    getDoctorAvailabilityDashboard,
    notifyDelay,
    toIsoDate,
    getTokenConfig,
    updateTokenConfig,
    getDoctorHistory
} from '../api/index';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_WEEKLY_CONFIG = {
    monday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    tuesday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    wednesday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    thursday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    friday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    saturday: { total_tokens: 40, online_limit: 20, walkin_limit: 20, start_time: '10:00', is_active: true },
    sunday: { total_tokens: 0, online_limit: 0, walkin_limit: 0, start_time: '10:00', is_active: false }
};

const STATUS_OPTIONS = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];
const todayISO = () => toIsoDate();
const prettyStatus = (v) => (v || 'N/A').replace(/_/g, ' ');
const getStatusColor = (status) => {
    switch (status) {
        case 'PRESENT': return { color: '#059669', bg: '#ecfdf5' };
        case 'LATE': return { color: '#d97706', bg: '#fffbeb' };
        case 'ABSENT': return { color: '#dc2626', bg: '#fef2f2' };
        case 'ON_LEAVE': return { color: '#4f46e5', bg: '#f5f3ff' };
        default: return { color: '#475569', bg: '#f1f5f9' };
    }
};

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
    const [delayNotifyForm, setDelayNotifyForm] = useState({ delay_minutes: '30' });
    const [cardAvailability, setCardAvailability] = useState({});

    // Token Config State
    const [weeklyConfig, setWeeklyConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);

    // Doctor History State
    const [doctorHistory, setDoctorHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Expandable Card & Hub State
    const [expandedId, setExpandedId] = useState(null);
    const [viewingHubDoc, setViewingHubDoc] = useState(null);
    const [cardHistory, setCardHistory] = useState({});
    const [cardHistoryLoading, setCardHistoryLoading] = useState({});
    const [hubActiveSection, setHubActiveSection] = useState('IDENTITY'); // IDENTITY, MONITOR, SCHEDULE, HISTORY

    const fetchDoctorsData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getDoctors({ all: true });
            let allDocs = res.data?.data || [];

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'doctor') {
                allDocs = allDocs.filter(d =>
                    d.doctor_id === user.doctor_id ||
                    d.name === user.full_name ||
                    d.name === user.username
                );
            }

            const availMap = {};
            const enrichedDocs = [...allDocs];
            await Promise.allSettled(
                allDocs.map(async (doc, idx) => {
                    try {
                        const [profileRes, dashRes, avRes] = await Promise.all([
                            getDoctorById(doc.doctor_id),
                            getDoctorAvailabilityDashboard(doc.doctor_id),
                            getDoctorAvailability(doc.doctor_id, { date: todayISO() })
                        ]);
                        const profile = profileRes.data?.data || {};
                        enrichedDocs[idx] = { ...doc, ...profile };
                        availMap[doc.doctor_id] = {
                            dash: dashRes.data?.data || null,
                            av: avRes.data?.data || null
                        };
                    } catch {
                        availMap[doc.doctor_id] = null;
                    }
                })
            );

            setDoctors(enrichedDocs);
            setCardAvailability(availMap);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    }, []);

    const openHub = async (doc) => {
        setViewingHubDoc(doc);
        setEditingId(doc.doctor_id);
        setShowDoctorForm(true);

        // Initialize forms with doc data
        setDoctorForm({
            name: doc.name,
            speciality: doc.speciality,
            qualification: doc.qualification || '',
            experience: doc.experience || '',
            is_active: doc.is_active,
            available_slots_json: doc.available_slots_json || ''
        });

        // Fetch everything needed for the Hub
        setHistoryLoading(true);
        setConfigLoading(true);
        setAvailabilityLoading(true);

        try {
            const [histRes, confRes, avRes, dashRes] = await Promise.all([
                getDoctorHistory(doc.doctor_id),
                getTokenConfig(doc.doctor_id),
                getDoctorAvailability(doc.doctor_id, { date: selectedDate }),
                getDoctorAvailabilityDashboard(doc.doctor_id)
            ]);

            setDoctorHistory(histRes.data);
            setWeeklyConfig(confRes.data?.data?.weekly_config || DEFAULT_WEEKLY_CONFIG);
            setAvailability(avRes.data?.data || null);
            setDashboard(dashRes.data?.data || null);

            // Sync forms
            setStatusForm({
                status: avRes.data?.data?.status || dashRes.data?.data?.availability?.status || 'PRESENT',
                notes: avRes.data?.data?.notes || ''
            });
            setEtaForm({
                eta_minutes: avRes.data?.data?.eta_minutes || '',
                eta_time: avRes.data?.data?.eta_time || '',
                reason: avRes.data?.data?.reason || ''
            });

        } catch (err) {
            console.error("Hub data fetch failed:", err);
            setError("Failed to load full doctor details");
        } finally {
            setHistoryLoading(false);
            setConfigLoading(false);
            setAvailabilityLoading(false);
        }
    };

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
        setWeeklyConfig(DEFAULT_WEEKLY_CONFIG);
        setViewingHubDoc({ name: 'New Practitioner', doctor_id: 'NEW-REGISTER' });
        setHubActiveSection('IDENTITY');
        setShowDoctorForm(true);
    };

    const openEdit = async (doc) => {
        openHub(doc);
    };

    const toggleHubSection = (section) => {
        setHubActiveSection(prev => prev === section ? null : section);
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

            let finalDocId = editingId;
            if (editingId) {
                await updateDoctor(editingId, payload);
            } else {
                const newDocRes = await createDoctor(payload);
                finalDocId = newDocRes.data?.data?.doctor_id;
            }

            if (finalDocId && weeklyConfig) {
                try {
                    await updateTokenConfig({
                        doctor_id: finalDocId,
                        weekly_config: weeklyConfig
                    });
                } catch (err) {
                    console.error("Failed to save token config:", err);
                }
            }

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

    const quickUpdateStatus = async (doc, newStatus) => {
        clearMessages();
        try {
            await patchDoctorAvailabilityStatus(doc.doctor_id, { status: newStatus });
            setSuccess(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
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
            {!showDoctorForm ? (
                <>
                    <div className="doc-head">
                        <div>
                            <h1>Clinical Practitioners</h1>
                        </div>
                        <div className="doc-head-actions">
                            <button className="btn-doc-action secondary" onClick={fetchDoctorsData}>
                                <RotateCw size={18} className={loading ? 'spinning' : ''} />
                                Sync Data
                            </button>
                            <button className="btn-doc-action primary" onClick={openCreate}>
                                <Plus size={18} />
                                Register Doctor
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
                        <div className="modal-loading" style={{ height: '400px' }}>
                            <RefreshCw size={32} className="spinning" />
                            <p>Fetching Clinician Cloud...</p>
                        </div>
                    ) : doctors.length === 0 ? (
                        <div className="card doc-empty">
                            <User size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>No doctors found. Add your first doctor profile.</p>
                        </div>
                    ) : (
                        <div className="doc-grid">
                            {doctors.map((doc) => {
                                const ca = cardAvailability[doc.doctor_id];
                                const status = ca?.av?.status || ca?.dash?.availability?.status || null;
                                const queue = ca?.av?.queue?.total ?? ca?.dash?.queue_summary?.total ?? null;
                                const eta = ca?.av?.eta_minutes;
                                const statusColor = getStatusColor(status);

                                return (
                                    <div
                                        key={doc.doctor_id}
                                        className="doc-card"
                                        onClick={() => openHub(doc)}
                                    >
                                        <div className="doc-card-head">
                                            <div className="doc-avatar">
                                                <User size={24} />
                                            </div>
                                            <div className="doc-core">
                                                <h3>{doc.name}</h3>
                                                <p>{doc.speciality || 'General Practitioner'}</p>
                                                <span>{doc.doctor_id}</span>
                                            </div>
                                            <div className="doc-card-head-actions" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openEdit(doc)} title="Edit Profile"><Edit2 size={15} /></button>
                                                <button onClick={() => removeDoctor(doc.doctor_id)} title="Delete Profile"><Trash2 size={15} /></button>
                                            </div>
                                        </div>

                                        <div className="doc-realtime-strip">
                                            <div className="doc-status-pill" style={{
                                                background: statusColor.bg,
                                                color: statusColor.color,
                                            }}>
                                                <span className="doc-status-dot" style={{ background: statusColor.color }}></span>
                                                {status ? prettyStatus(status) : (ca === undefined ? 'Syncing...' : 'Offline')}
                                            </div>
                                            <div className="doc-rt-stats">
                                                <div className="doc-rt-stat">
                                                    <Activity size={13} />
                                                    <span>{queue !== null ? `${queue} Waiting` : 'Queue Empty'}</span>
                                                </div>
                                                <div className="doc-rt-stat">
                                                    <Clock3 size={13} />
                                                    <span>{eta !== undefined && eta !== null ? `ETA: ${eta}m` : 'No Delay'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : viewingHubDoc ? (
                <div className="doc-edit-container-main">
                    <div className="doc-edit-form-full">
                        <div className="doc-form-breadcrumb">
                            <button type="button" onClick={() => { setViewingHubDoc(null); setEditingId(''); setShowDoctorForm(false); }} className="breadcrumb-back">
                                <ArrowLeft size={18} />
                                <span>Return to Practitioners</span>
                            </button>
                        </div>

                        <div className="doc-edit-header-inline">
                            <div className="doc-edit-header-left">
                                <div className="doc-edit-icon-wrap">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h2 className="doc-edit-title">
                                        Practitioner Hub
                                    </h2>
                                    <p className="doc-edit-subtitle">
                                        Managing {viewingHubDoc?.name} • ID: {viewingHubDoc?.doctor_id}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div className="doc-status-pill large" style={{
                                    background: getStatusColor(statusForm.status).bg,
                                    color: getStatusColor(statusForm.status).color,
                                    border: `1.5px solid ${getStatusColor(statusForm.status).color}30`
                                }}>
                                    <span className="doc-status-dot" style={{
                                        background: getStatusColor(statusForm.status).color,
                                        boxShadow: `0 0 10px ${getStatusColor(statusForm.status).color}`
                                    }}></span>
                                    {prettyStatus(statusForm.status)}
                                </div>
                                <div className="doc-edit-header-actions">
                                    <button type="button" className="doc-edit-cancel" onClick={() => { setViewingHubDoc(null); setEditingId(''); setShowDoctorForm(false); }}>Close Hub</button>
                                    <button type="button" className="doc-edit-save" onClick={saveDoctor}>
                                        <CheckCircle2 size={20} />
                                        Sync Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="doc-edit-body-inline">
                            <div className="doc-hub-accordion">
                                {/* Section: LIVE MONITORING */}
                                {editingId && (
                                    <div className={`doc-hub-section ${hubActiveSection === 'MONITOR' ? 'expanded' : ''}`}>
                                        <div className="doc-hub-section-header" onClick={() => toggleHubSection('MONITOR')}>
                                            <div className="header-left">
                                                <div className="icon-circle-v2">
                                                    <Activity size={20} />
                                                </div>
                                                <span>Live Operational Status</span>
                                            </div>
                                            <Plus size={20} className={`toggle-icon ${hubActiveSection === 'MONITOR' ? 'rotate' : ''}`} />
                                        </div>

                                        {hubActiveSection === 'MONITOR' && (
                                            <div className="doc-hub-section-content">
                                                <div className="doc-api-grid-v2">
                                                    <div className="action-card">
                                                        <div className="card-head"><h4>Current Presence</h4><div className="dot"></div></div>
                                                        <div className="doc-status-options">
                                                            {STATUS_OPTIONS.map(s => {
                                                                const sc = getStatusColor(s);
                                                                const isActive = statusForm.status === s;
                                                                return (
                                                                    <button
                                                                        key={s}
                                                                        onClick={() => setStatusForm({ ...statusForm, status: s })}
                                                                        className={`status-btn-mini ${isActive ? 'active' : ''}`}
                                                                        style={{ '--btn-color': sc.color, '--btn-bg': sc.bg }}
                                                                    >
                                                                        {prettyStatus(s)}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                        <button
                                                            className="btn-action-primary"
                                                            onClick={() => runAvailabilityAction(() => patchDoctorAvailabilityStatus(viewingHubDoc.doctor_id, statusForm), 'Status updated')}
                                                        >
                                                            Update Presence
                                                        </button>
                                                    </div>

                                                    <div className="action-card">
                                                        <div className="card-head"><h4>Delay Management</h4><div className="dot eta"></div></div>
                                                        <div className="form-row-compact">
                                                            <div className="doc-edit-field" style={{ flex: 1 }}>
                                                                <input type="number" placeholder="Mins Late" value={etaForm.eta_minutes} onChange={(e) => setEtaForm({ ...etaForm, eta_minutes: e.target.value })} className="doc-field-input" />
                                                            </div>
                                                            <div className="doc-edit-field" style={{ flex: 2 }}>
                                                                <input placeholder="ETA Time (e.g. 11:30 AM)" value={etaForm.eta_time} onChange={(e) => setEtaForm({ ...etaForm, eta_time: e.target.value })} className="doc-field-input" />
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn-action-primary"
                                                            onClick={() => runAvailabilityAction(() => patchDoctorAvailabilityEta(viewingHubDoc.doctor_id, {
                                                                eta_minutes: Number(etaForm.eta_minutes) || 0,
                                                                eta_time: etaForm.eta_time || null
                                                            }), 'ETA synchronized')}
                                                        >
                                                            Broadcast Delay
                                                        </button>
                                                    </div>

                                                    <div className="action-card full-span" style={{ background: '#f5f3ff', border: '1.5px dashed #c7d2fe' }}>
                                                        <div className="card-head"><h4>Patient Notifications (WhatsApp)</h4><div className="dot indigo"></div></div>
                                                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase' }}>Delay Minutes</label>
                                                                <input type="number" value={delayNotifyForm.delay_minutes} onChange={(e) => setDelayNotifyForm({ ...delayNotifyForm, delay_minutes: e.target.value })} className="doc-field-input" style={{ marginTop: '0.4rem' }} />
                                                            </div>
                                                            <button
                                                                className="btn-action-primary"
                                                                style={{ marginTop: '1.2rem', background: '#4338ca', flex: 2 }}
                                                                onClick={() => runAvailabilityAction(() => notifyDelay({
                                                                    doctor_id: viewingHubDoc.doctor_id,
                                                                    date: selectedDate,
                                                                    delay_minutes: Number(delayNotifyForm.delay_minutes)
                                                                }), 'Alerts Sent')}
                                                            >
                                                                Alert {availability?.queue?.total || dashboard?.queue_summary?.total || 0} Waiting Patients
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Section: IDENTITY DETAILS */}
                                <div className={`doc-hub-section ${hubActiveSection === 'IDENTITY' ? 'expanded' : ''}`}>
                                    <div className="doc-hub-section-header" onClick={() => toggleHubSection('IDENTITY')}>
                                        <div className="header-left">
                                            <div className="icon-circle-v2">
                                                <User size={20} />
                                            </div>
                                            <span>Practitioner Identity</span>
                                        </div>
                                        <Plus size={20} className={`toggle-icon ${hubActiveSection === 'IDENTITY' ? 'rotate' : ''}`} />
                                    </div>

                                    {hubActiveSection === 'IDENTITY' && (
                                        <div className="doc-hub-section-content">
                                            <div className="doc-edit-grid">
                                                <div className="doc-edit-field">
                                                    <label>Full Name <span className="required">*</span></label>
                                                    <div className="doc-field-input-wrap">
                                                        <User size={16} className="doc-field-icon" />
                                                        <input required placeholder="Dr. Full Name" value={doctorForm.name} onChange={(e) => setDoctorForm(f => ({ ...f, name: e.target.value }))} className="doc-field-input" />
                                                    </div>
                                                </div>
                                                <div className="doc-edit-field">
                                                    <label>Speciality <span className="required">*</span></label>
                                                    <div className="doc-field-input-wrap">
                                                        <Activity size={16} className="doc-field-icon" />
                                                        <input required placeholder="e.g. Pediatrics" value={doctorForm.speciality} onChange={(e) => setDoctorForm(f => ({ ...f, speciality: e.target.value }))} className="doc-field-input" />
                                                    </div>
                                                </div>
                                                <div className="doc-edit-field">
                                                    <label>Qualification</label>
                                                    <div className="doc-field-input-wrap">
                                                        <Shield size={16} className="doc-field-icon" />
                                                        <input placeholder="MBBS, MD" value={doctorForm.qualification} onChange={(e) => setDoctorForm(f => ({ ...f, qualification: e.target.value }))} className="doc-field-input" />
                                                    </div>
                                                </div>
                                                <div className="doc-edit-field">
                                                    <label>Experience</label>
                                                    <div className="doc-field-input-wrap">
                                                        <History size={16} className="doc-field-icon" />
                                                        <input placeholder="10+ Years" value={doctorForm.experience} onChange={(e) => setDoctorForm(f => ({ ...f, experience: e.target.value }))} className="doc-field-input" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section: SCHEDULING */}
                                <div className={`doc-hub-section ${hubActiveSection === 'SCHEDULE' ? 'expanded' : ''}`}>
                                    <div className="doc-hub-section-header" onClick={() => toggleHubSection('SCHEDULE')}>
                                        <div className="header-left">
                                            <div className="icon-circle-v2">
                                                <Clock3 size={20} />
                                            </div>
                                            <span>Session Schedule & Limits</span>
                                        </div>
                                        <Plus size={20} className={`toggle-icon ${hubActiveSection === 'SCHEDULE' ? 'rotate' : ''}`} />
                                    </div>

                                    {hubActiveSection === 'SCHEDULE' && (
                                        <div className="doc-hub-section-content">
                                            {configLoading ? (
                                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                                    <RefreshCw size={32} className="spinning" color="#6366f1" />
                                                </div>
                                            ) : (
                                                <div className="doc-token-config-table-wrap">
                                                    <table className="doc-token-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Working Day</th>
                                                                <th>Status</th>
                                                                <th>Start Time</th>
                                                                <th>Online Limit</th>
                                                                <th>Walk-in</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {DAY_NAMES.map(day => {
                                                                const dayConf = weeklyConfig?.[day] || { is_active: false, start_time: '10:00', online_limit: 0 };
                                                                return (
                                                                    <tr key={day} className={dayConf.is_active ? '' : 'row-disabled'}>
                                                                        <td className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</td>
                                                                        <td>
                                                                            <button
                                                                                type="button"
                                                                                className={`status-toggle-mini ${dayConf.is_active ? 'active' : ''}`}
                                                                                onClick={() => {
                                                                                    setWeeklyConfig(prev => ({
                                                                                        ...prev,
                                                                                        [day]: { ...prev[day], is_active: !prev[day]?.is_active }
                                                                                    }));
                                                                                }}
                                                                            >
                                                                                {dayConf.is_active ? 'ENABLED' : 'DISABLED'}
                                                                            </button>
                                                                        </td>
                                                                        <td>
                                                                            <input type="time" value={dayConf.start_time || '10:00'} onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], start_time: e.target.value } }))} disabled={!dayConf.is_active} className="doc-field-input" style={{ height: '36px', padding: '0 0.5rem' }} />
                                                                        </td>
                                                                        <td>
                                                                            <input type="number" value={dayConf.online_limit || 0} onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], online_limit: parseInt(e.target.value) || 0 } }))} disabled={!dayConf.is_active} min="0" className="doc-field-input" style={{ height: '36px', width: '80px', padding: '0 0.5rem' }} />
                                                                        </td>
                                                                        <td><span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.75rem' }}>UNLIMITED</span></td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Section: PERFORMANCE */}
                                {editingId && (
                                    <div className={`doc-hub-section ${hubActiveSection === 'HISTORY' ? 'expanded' : ''}`}>
                                        <div className="doc-hub-section-header" onClick={() => toggleHubSection('HISTORY')}>
                                            <div className="header-left">
                                                <div className="icon-circle-v2">
                                                    <BarChart2 size={20} />
                                                </div>
                                                <span>Performance & Insights (60D)</span>
                                            </div>
                                            <Plus size={20} className={`toggle-icon ${hubActiveSection === 'HISTORY' ? 'rotate' : ''}`} />
                                        </div>

                                        {hubActiveSection === 'HISTORY' && (
                                            <div className="doc-hub-section-content">
                                                {historyLoading ? (
                                                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                                                        <RefreshCw size={32} className="spinning" color="#6366f1" />
                                                    </div>
                                                ) : doctorHistory ? (
                                                    <>
                                                        <div className="doc-history-summary">
                                                            <div className="history-stat-pill indigo">
                                                                <span className="history-stat-label">Total Sessions</span>
                                                                <span className="history-stat-value">{doctorHistory.summary?.total_days || 0}</span>
                                                            </div>
                                                            <div className="history-stat-pill emerald">
                                                                <span className="history-stat-label">Total Patient Base</span>
                                                                <span className="history-stat-value">{doctorHistory.summary?.total_patients || 0}</span>
                                                            </div>
                                                            <div className="history-stat-pill amber">
                                                                <span className="history-stat-label">Avg Attendance</span>
                                                                <span className="history-stat-value">{doctorHistory.summary?.avg_patients_per_day || 0}</span>
                                                            </div>
                                                            <div className="history-stat-pill slate">
                                                                <span className="history-stat-label">Peak Inflow</span>
                                                                <span className="history-stat-value">{doctorHistory.summary?.max_patients || doctorHistory.summary?.peak_attendance || 0}</span>
                                                            </div>
                                                        </div>

                                                        {/* Session Breakdown Section */}
                                                        <div style={{ marginTop: '3rem' }}>
                                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: '1.25rem', letterSpacing: '0.05em' }}>
                                                                Session breakdown
                                                            </h4>
                                                            {doctorHistory.history && doctorHistory.history.length > 0 ? (
                                                                <div className="doc-history-table-wrap">
                                                                    <table className="doc-history-table">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Session Date</th>
                                                                                <th>Status</th>
                                                                                <th>Patients Served</th>
                                                                                <th>Completion Rate</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {doctorHistory.history.map((row, idx) => (
                                                                                <tr key={idx}>
                                                                                    <td style={{ fontWeight: 700 }}>{row.date ? new Date(row.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}</td>
                                                                                    <td><span className={`p-pill ${row.status === 'COMPLETED' ? 'success' : ''}`}>{row.status || 'N/A'}</span></td>
                                                                                    <td style={{ fontWeight: 900, color: '#6366f1' }}>{row.visit_count || row.patients || 0}</td>
                                                                                    <td>{Math.min(100, Math.round(((row.visit_count || 0) / 20) * 100))}%</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                                    No individual session data recorded for this period.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                                        <p>No historical data available for this practitioner yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Doctors;
