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
import { getUser } from '../utils/auth';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_WEEKLY_CONFIG = {
    monday: { total_tokens: 40, online_limit: 40, start_time: '17:00', is_active: true },
    tuesday: { total_tokens: 40, online_limit: 40, start_time: '16:00', is_active: true },
    wednesday: { total_tokens: 40, online_limit: 40, start_time: '11:00', is_active: true },
    thursday: { total_tokens: 40, online_limit: 40, start_time: '10:00', is_active: true },
    friday: { total_tokens: 40, online_limit: 40, start_time: '10:00', is_active: true },
    saturday: { total_tokens: 40, online_limit: 40, start_time: '10:00', is_active: true },
    sunday: { total_tokens: 40, online_limit: 40, start_time: '18:00', is_active: true }
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
    const currentUser = getUser();
    const isSuperAdmin = currentUser?.role?.toLowerCase() === 'super_admin' || currentUser?.role?.toLowerCase() === 'superadmin';
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
    const [dailyLimit, setDailyLimit] = useState('');

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
            setError(e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to load doctors');
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
            setDailyLimit(avRes.data?.data?.online_limit || '');

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

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess('');
                setError('');
            }, 4500);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

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
            setDailyLimit(av?.online_limit || '');
        } catch (e) {
            setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load availability');
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
        setViewingHubDoc({ name: 'New Doctor', doctor_id: 'NEW-REGISTER' });
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

            // setShowDoctorForm(false); // Keep hub open after update
            setSuccess(editingId ? 'Doctor profile updated.' : 'Doctor profile created.');
            fetchDoctorsData();
        } catch (e2) {
            setError(e2.response?.data?.message || e2.response?.data?.error || e2.message || 'Failed to save doctor');
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
            setError(e.response?.data?.message || e.response?.data?.error || 'Failed to delete doctor');
        }
    };

    const toggleActive = async (doc) => {
        clearMessages();
        try {
            await updateDoctor(doc.doctor_id, { is_active: !doc.is_active });
            setSuccess('Doctor active status updated.');
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || e.response?.data?.error || 'Failed to update status');
        }
    };

    const quickUpdateStatus = async (doc, newStatus) => {
        clearMessages();
        try {
            await patchDoctorAvailabilityStatus(doc.doctor_id, { status: newStatus });
            setSuccess(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || e.response?.data?.error || 'Failed to update status');
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
            setError(e.response?.data?.message || e.response?.data?.error || 'Availability update failed');
        }
    };

    return (
        <div className="doc-page">
            {!showDoctorForm ? (
                <>
                    <div className="doc-head">
                        <div>
                            <h1>Doctors</h1>
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
                                                <p>{doc.speciality || 'General Doctor'}</p>
                                                <span>{doc.doctor_id}</span>
                                            </div>
                                            <div className="doc-card-head-actions" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openEdit(doc)} title="Edit Profile"><Edit2 size={15} /></button>
                                                {isSuperAdmin && (
                                                    <button onClick={() => removeDoctor(doc.doctor_id)} title="Delete Profile"><Trash2 size={15} /></button>
                                                )}
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
                                <span>Return to Doctors Profile</span>
                            </button>
                        </div>

                        <div className="doc-edit-header-inline">
                            <div className="doc-edit-header-left">
                                <div className="doc-edit-icon-wrap">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 className="doc-edit-title">
                                        Doctor Hub
                                    </h2>
                                    <p className="doc-edit-subtitle">
                                        Managing {viewingHubDoc?.name} • ID: {viewingHubDoc?.doctor_id}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div className="hub-header-date-selector">
                                    <CalendarIcon size={16} />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            const d = e.target.value;
                                            setSelectedDate(d);
                                            fetchAvailabilityData(editingId, d);
                                        }}
                                    />
                                </div>
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
                                    <button type="button" className="doc-edit-cancel" onClick={() => { setViewingHubDoc(null); setEditingId(''); setShowDoctorForm(false); }}>
                                        <X size={18} />
                                        Close Hub
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="doc-edit-body-inline">
                            <div className="hub-grid-layout">
                                <div className="hub-left-col">
                                    {/* LIVE OPERATIONAL STATUS */}
                                    {editingId && (
                                        <div className="hub-card">
                                            <div className="hub-card-header">
                                                <div className="hub-card-title">
                                                    <Activity size={20} color="#3b82f6" />
                                                    <h3>Live Operational Status</h3>
                                                </div>
                                                <button className="hub-update-btn" onClick={() => runAvailabilityAction(() => patchDoctorAvailabilityStatus(viewingHubDoc.doctor_id, statusForm), 'Status updated')}>
                                                    Update Presence
                                                </button>
                                            </div>
                                            <div className="hub-card-body">
                                                <div className="status-radio-grid">
                                                    {['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'].map(s => {
                                                        const isActive = statusForm.status === s;
                                                        return (
                                                            <div
                                                                key={s}
                                                                className={`status-radio-card ${isActive ? 'active' : ''}`}
                                                                onClick={() => setStatusForm({ ...statusForm, status: s })}
                                                            >
                                                                <div className={`status-radio-icon ${isActive ? 'active' : ''}`}>
                                                                    {s === 'PRESENT' && <CheckCircle2 size={20} />}
                                                                    {s === 'LATE' && <Clock3 size={20} />}
                                                                    {s === 'ABSENT' && <X size={20} />}
                                                                    {s === 'ON_LEAVE' && <Activity size={20} />}
                                                                </div>
                                                                <span>{prettyStatus(s)}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="delay-management-box">
                                                    <div className="delay-header">
                                                        <div>
                                                            <h4>Delay Management</h4>
                                                            <p>Notify waiting patients about expected delays</p>
                                                        </div>
                                                        <div className="toggle-label-wrap">
                                                            <label className="toggle-switch">
                                                                <input type="checkbox" checked={!!etaForm.eta_minutes} onChange={(e) => {
                                                                    if (!e.target.checked) setEtaForm({ ...etaForm, eta_minutes: '' });
                                                                }} />
                                                                <span className="slider round"></span>
                                                            </label>
                                                            <span className="toggle-label-text">Broadcast Delay</span>
                                                        </div>
                                                    </div>
                                                    <div className="delay-input-row">
                                                        <div className="delay-input-wrap">
                                                            <label>Delay Minutes</label>
                                                            <input type="number" placeholder="e.g. 15" value={etaForm.eta_minutes} onChange={(e) => setEtaForm({ ...etaForm, eta_minutes: e.target.value })} />
                                                        </div>
                                                        <button
                                                            className="apply-btn"
                                                            onClick={() => runAvailabilityAction(() => patchDoctorAvailabilityEta(viewingHubDoc.doctor_id, {
                                                                eta_minutes: Number(etaForm.eta_minutes) || 0,
                                                                eta_time: etaForm.eta_time || null
                                                            }), 'ETA synchronized')}
                                                        >Apply</button>
                                                    </div>
                                                </div>

                                                <div className="delay-management-box mt-3" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                                    <div className="delay-header">
                                                        <div>
                                                            <h4>Date-Specific Limit</h4>
                                                            <p>Override online limit for <strong>{selectedDate}</strong></p>
                                                        </div>
                                                    </div>
                                                    <div className="delay-input-row">
                                                        <div className="delay-input-wrap">
                                                            <label>Limit for {selectedDate}</label>
                                                            <input
                                                                type="number"
                                                                placeholder="e.g. 40"
                                                                value={dailyLimit}
                                                                onChange={(e) => setDailyLimit(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            className="apply-btn"
                                                            style={{ background: '#3b82f6' }}
                                                            onClick={() => runAvailabilityAction(() => addDateOverride({
                                                                doctor_id: editingId,
                                                                date: selectedDate,
                                                                online_limit: parseInt(dailyLimit) || 0,
                                                                status: statusForm.status
                                                            }), 'Limit overridden for ' + selectedDate)}
                                                        >Save Limit</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SESSION SCHEDULE & LIMITS */}
                                    <div className="hub-card">
                                        <div className="hub-card-header">
                                            <div className="hub-card-title">
                                                <CalendarIcon size={20} color="#3b82f6" />
                                                <h3>Session Schedule & Limits</h3>
                                            </div>
                                            <button className="hub-update-btn" onClick={saveDoctor}>
                                                Update Schedule
                                            </button>
                                        </div>
                                        <div className="hub-card-body p-0">
                                            {configLoading ? (
                                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                                    <RefreshCw size={32} className="spinning" color="#6366f1" />
                                                </div>
                                            ) : (
                                                <div className="schedule-table-wrap">
                                                    <table className="schedule-table">
                                                        <thead>
                                                            <tr>
                                                                <th>WORKING DAY</th>
                                                                <th className="text-center">STATUS</th>
                                                                <th>START TIME</th>
                                                                <th>ONLINE LIMIT</th>

                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {DAY_NAMES.map(day => {
                                                                const dayConf = weeklyConfig?.[day] || { is_active: false, start_time: '10:00', online_limit: 0 };
                                                                return (
                                                                    <tr key={day} className={dayConf.is_active ? '' : 'disabled-row'}>
                                                                        <td className="day-name">
                                                                            <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <label className="toggle-switch">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={dayConf.is_active}
                                                                                    onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], is_active: e.target.checked } }))}
                                                                                />
                                                                                <span className="slider round"></span>
                                                                            </label>
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="time"
                                                                                value={dayConf.start_time || '10:00'}
                                                                                onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], start_time: e.target.value } }))}
                                                                                className="invisible-input"
                                                                                disabled={!dayConf.is_active}
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                value={dayConf.online_limit || 0}
                                                                                onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], online_limit: parseInt(e.target.value) || 0 } }))}
                                                                                min="0"
                                                                                className="invisible-input w-50"
                                                                                disabled={!dayConf.is_active}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    <div className="p-3 bg-slate-50 border-top text-slate-500 text-[10px] fw-600 uppercase tracking-wider">
                                                        Note: These settings define your recurring weekly pattern. Use "Date-Specific Limit" above for exceptions.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="hub-right-col">
                                    {/* DOCTOR IDENTITY */}
                                    <div className="hub-card">
                                        <div className="hub-card-header">
                                            <div className="hub-card-title">
                                                <User size={20} color="#3b82f6" />
                                                <h3>Doctor Identity</h3>
                                            </div>
                                            <button className="hub-update-btn" onClick={saveDoctor}>
                                                Update Profile
                                            </button>
                                        </div>
                                        <div className="hub-card-body pt-1">
                                            <div className="identity-form">
                                                <div className="form-group-clean">
                                                    <label>FULL NAME</label>
                                                    <input required placeholder="Dr. Full Name" value={doctorForm.name} onChange={(e) => setDoctorForm(f => ({ ...f, name: e.target.value }))} />
                                                </div>
                                                <div className="form-group-clean">
                                                    <label>SPECIALITY</label>
                                                    <input required placeholder="e.g. Pediatrics" value={doctorForm.speciality} onChange={(e) => setDoctorForm(f => ({ ...f, speciality: e.target.value }))} />
                                                </div>
                                                <div className="form-group-clean">
                                                    <label>QUALIFICATION</label>
                                                    <input placeholder="MBBS, MD" value={doctorForm.qualification} onChange={(e) => setDoctorForm(f => ({ ...f, qualification: e.target.value }))} />
                                                </div>
                                                <div className="form-group-clean">
                                                    <label>EXPERIENCE</label>
                                                    <input placeholder="10+ Years" value={doctorForm.experience} onChange={(e) => setDoctorForm(f => ({ ...f, experience: e.target.value }))} />
                                                </div>

                                            </div>
                                        </div>
                                    </div>

                                    {/* INSIGHTS */}
                                    {editingId && (
                                        <div className="hub-card insights-card">
                                            <div className="hub-card-header">
                                                <div className="hub-card-title">
                                                    <TrendingUp size={20} color="#3b82f6" />
                                                    <h3>Insights (60D)</h3>
                                                </div>
                                            </div>
                                            <div className="hub-card-body pt-1">
                                                {historyLoading ? (
                                                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                                                        <RefreshCw size={24} className="spinning" color="#fff" />
                                                    </div>
                                                ) : doctorHistory ? (
                                                    <div className="insights-grid">
                                                        <div className="insight-box">
                                                            <span>TOTAL SESSIONS</span>
                                                            <strong>{doctorHistory.summary?.total_days || 0}</strong>
                                                        </div>
                                                        <div className="insight-box">
                                                            <span>PATIENT BASE</span>
                                                            <strong>{doctorHistory.summary?.total_patients || 0}</strong>
                                                        </div>
                                                        <div className="insight-box">
                                                            <span>AVG ATTENDANCE</span>
                                                            <strong>{doctorHistory.summary?.avg_patients_per_day || 0}</strong>
                                                        </div>
                                                        <div className="insight-box">
                                                            <span>PEAK INFLOW</span>
                                                            <strong>{doctorHistory.summary?.max_patients || doctorHistory.summary?.peak_attendance || 0}</strong>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="insights-empty">No data</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="hub-bottom-col">
                                    {/* SESSION BREAKDOWN */}
                                    {editingId && (
                                        <div className="hub-card">
                                            <div className="hub-card-header border-bottom">
                                                <div className="hub-card-title">
                                                    <BarChart2 size={20} color="#3b82f6" />
                                                    <h3>Session Breakdown</h3>
                                                </div>
                                                <div className="filter-dropdown">
                                                    <span>Showing last 30 days</span>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                </div>
                                            </div>
                                            <div className="hub-card-body p-0">
                                                {doctorHistory?.history && doctorHistory.history.length > 0 ? (
                                                    <div className="breakdown-table-wrap">
                                                        <table className="breakdown-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>DATE</th>
                                                                    <th>SESSION STATUS</th>
                                                                    <th>PATIENTS SERVED</th>
                                                                    <th>COMPLETION RATE</th>
                                                                    <th>ACTION</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {doctorHistory.history.map((row, idx) => {
                                                                    const compRate = Math.min(100, Math.round(((row.visit_count || 0) / 20) * 100));
                                                                    const isCompleted = row.status === 'COMPLETED';
                                                                    return (
                                                                        <tr key={idx}>
                                                                            <td className="fw-700">{row.date ? new Date(row.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}</td>
                                                                            <td>
                                                                                <div className="session-status-inline">
                                                                                    <span className={`status-dot ${isCompleted ? 'green' : 'orange'}`}></span>
                                                                                    {isCompleted ? 'Completed' : 'Incomplete'}
                                                                                </div>
                                                                            </td>
                                                                            <td className="fw-800 text-center">{row.visit_count || row.patients || 0}</td>
                                                                            <td>
                                                                                <div className="progress-cell">
                                                                                    <div className="progress-bar-bg">
                                                                                        <div className={`progress-bar-fill ${isCompleted ? 'green' : 'orange'}`} style={{ width: `${compRate}%` }}></div>
                                                                                    </div>
                                                                                    <span className="progress-text">{compRate}%</span>
                                                                                </div>
                                                                            </td>
                                                                            <td><button className="view-btn">View</button></td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-center text-slate">No individual session data recorded.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {!!error && (
                <div className="doc-alert doc-alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}
            {!!success && (
                <div className="doc-alert doc-alert-success">
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                    <button onClick={() => setSuccess('')}><X size={14} /></button>
                </div>
            )}
        </div>
    );
};

export default Doctors;
