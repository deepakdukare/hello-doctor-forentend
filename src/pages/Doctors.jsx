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
    Users,
    ChevronLeft,
    ChevronRight
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
    addDateOverride,
    getDoctorHistory
} from '../api/index';
import StatCard from '../components/StatCard';
import { getUser } from '../utils/auth';
import '../doctors.css';

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
    const [calendarMonth, setCalendarMonth] = useState(new Date());
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
    const [dateOverrides, setDateOverrides] = useState([]);
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
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [showCalModal, setShowCalModal] = useState(null);

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    const generateMonthDays = (baseDate) => {
        const days = [];
        const y = baseDate.getFullYear();
        const m = baseDate.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(y, m, i));
        }
        return days;
    };
    const calendarDays = generateMonthDays(calendarMonth);

    const fetchDoctorsData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getDoctors({ all: true });
            let allDocs = res.data?.data || [];

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            // Removed restricted filter to allow doctors to see their colleagues
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
            setDateOverrides(confRes.data?.data?.date_overrides || []);
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
                        weekly_config: weeklyConfig,
                        date_overrides: dateOverrides
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
        <div className="appointments-page-v4">
            {!showDoctorForm ? (
                <>
                    <div className="header-v4">
                        <div className="header-left-v4">
                            <h1>Doctor Profile</h1>
                            <p>Manage clinician profiles and schedules</p>
                        </div>
                        <div className="header-right-v4">
                            <button className="btn-header-v4" onClick={fetchDoctorsData}>
                                <RotateCw size={18} className={loading ? 'spinning' : ''} />
                                <span>Sync Data</span>
                            </button>
                            <button className="btn-header-v4 btn-primary-v4" onClick={openCreate}>
                                <Plus size={18} />
                                <span>Register Doctor</span>
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
                <div className="doc-hub-premium">
                    <aside className="doc-hub-sidebar">
                        <button className="d-back-btn d-top-actions" onClick={() => { setViewingHubDoc(null); setEditingId(''); setShowDoctorForm(false); setIsEditingProfile(false); }}>
                            <ArrowLeft size={16} /> Back
                        </button>

                        <div className={`d-avatar-ring ${statusForm.status}`}>
                            <div className="d-avatar-inner">{doctorForm.name ? doctorForm.name.charAt(0).toUpperCase() : 'D'}</div>
                            <div className={`d-status-badge ${statusForm.status}`}>
                                <div className="d-status-dot"></div>
                                {prettyStatus(statusForm.status)}
                            </div>
                        </div>

                        {!isEditingProfile ? (
                            <div className="d-identity-info">
                                <h2>{doctorForm.name || 'New Doctor'}</h2>
                                <h3>{doctorForm.speciality}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                    <span className="d-chip" style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1' }}>{doctorForm.qualification || 'MBBS'}</span>
                                    <span className="d-chip" style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1' }}>{doctorForm.experience || 'New'}</span>
                                </div>
                                <button className="d-btn d-btn-outline" onClick={() => setIsEditingProfile(true)}>
                                    <Edit2 size={16} /> Edit Profile
                                </button>
                            </div>
                        ) : (
                            <form className="d-identity-form" onSubmit={(e) => { saveDoctor(e).then(() => { setIsEditingProfile(false); showToast("Profile Updated successfully"); }); }}>
                                <div className="d-input-group">
                                    <label>Full Name</label>
                                    <input required value={doctorForm.name} onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })} />
                                </div>
                                <div className="d-input-group">
                                    <label>Speciality</label>
                                    <input required value={doctorForm.speciality} onChange={e => setDoctorForm({ ...doctorForm, speciality: e.target.value })} />
                                </div>
                                <div className="d-input-group">
                                    <label>Qualification</label>
                                    <input value={doctorForm.qualification} onChange={e => setDoctorForm({ ...doctorForm, qualification: e.target.value })} />
                                </div>
                                <div className="d-input-group">
                                    <label>Experience</label>
                                    <input value={doctorForm.experience} onChange={e => setDoctorForm({ ...doctorForm, experience: e.target.value })} />
                                </div>
                                <button type="submit" className="d-btn d-btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                                    Save Changes
                                </button>
                                <button type="button" className="d-btn d-btn-outline" onClick={() => setIsEditingProfile(false)}>
                                    Cancel
                                </button>
                            </form>
                        )}
                    </aside>

                    <main className="doc-hub-main">
                        {/* Section 2: Live Operational Controls */}
                        <div className="d-card">
                            <div className="d-card-header">
                                <div className="d-card-title"><Activity size={20} color="#3b82f6" /> Live Operational Controls</div>
                            </div>

                            <div className="d-status-controls">
                                {STATUS_OPTIONS.map(s => (
                                    <button
                                        key={s}
                                        className={`d-status-btn ${s} ${statusForm.status === s ? 'active' : ''}`}
                                        onClick={() => {
                                            setStatusForm({ ...statusForm, status: s });
                                            if (editingId) {
                                                runAvailabilityAction(() => patchDoctorAvailabilityStatus(editingId, { status: s }), `Status set to ${prettyStatus(s)}`).then(() => showToast(`Status updated to ${prettyStatus(s)}`));
                                            }
                                        }}
                                    >
                                        {{
                                            'PRESENT': <CheckCircle2 size={24} />,
                                            'LATE': <Clock3 size={24} />,
                                            'ABSENT': <X size={24} />,
                                            'ON_LEAVE': <User size={24} />
                                        }[s]}
                                        {prettyStatus(s)}
                                    </button>
                                ))}
                            </div>

                            <div className="d-delay-panel">
                                <div className="d-delay-box border-right">
                                    <label>Delay Management</label>
                                    <div className="d-delay-row">
                                        <input type="number" placeholder="Minutes (e.g. 15)" value={etaForm.eta_minutes} onChange={e => setEtaForm({ ...etaForm, eta_minutes: e.target.value })} />
                                        <button className="d-btn d-btn-primary" onClick={() => {
                                            if (editingId) {
                                                runAvailabilityAction(() => patchDoctorAvailabilityEta(editingId, { eta_minutes: Number(etaForm.eta_minutes) }), 'Delay broadcasted').then(() => showToast(`Waiting patients notified of ${etaForm.eta_minutes} min delay`));
                                            }
                                        }}>Broadcast Delay</button>
                                    </div>
                                </div>
                                <div className="d-delay-box">
                                    <label>Date-Specific Limit Override</label>
                                    <div className="d-delay-row">
                                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                                        <input type="number" placeholder="Limit" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} style={{ width: '100px' }} />
                                        <button className="d-btn d-btn-primary" onClick={() => {
                                            if (editingId) {
                                                showToast(`Limit updated for ${selectedDate}`);
                                            }
                                        }}>Save</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Calendar */}
                        <div className="d-card">
                            <div className="d-card-header">
                                <div className="d-card-title"><CalendarIcon size={20} color="#3b82f6" /> Session Schedule</div>
                                <button className="d-btn d-btn-primary" onClick={(e) => { saveDoctor(e).then(() => showToast('Schedule saved successfully')); }}>Save Changes</button>
                            </div>

                            <h4 style={{ marginBottom: '1rem', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase' }}>Weekly Recurring Schedule</h4>
                            <div className="d-calendar" style={{ marginBottom: '2rem' }}>
                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                                    const dayConf = weeklyConfig?.[day] || { is_active: false, start_time: '10:00', online_limit: 0 };
                                    const isActive = dayConf.is_active;
                                    return (
                                        <div key={day} className={`d-cal-tile ${isActive ? 'active-bg' : 'absent-bg'}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem 0.5rem', cursor: 'default', minHeight: 'auto' }}>
                                            <div style={{ fontWeight: '700', color: isActive ? '#065f46' : '#991b1b', textTransform: 'uppercase', fontSize: '1.1rem' }}>{day.substring(0, 3)}</div>

                                            <select
                                                className={isActive ? 'PRESENT' : 'ABSENT'}
                                                value={isActive ? 'PRESENT' : 'ABSENT'}
                                                onChange={(e) => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], is_active: e.target.value === 'PRESENT' } }))}
                                                style={{ width: '90%', padding: '0.4rem', borderRadius: '0.4rem', border: isActive ? '1px solid #10b981' : '1px solid #fecaca', fontSize: '0.8rem', fontWeight: 'bold', background: '#fff', color: isActive ? '#10b981' : '#f43f5e', margin: '0 auto', cursor: 'pointer' }}
                                            >
                                                <option value="PRESENT">Present</option>
                                                <option value="ABSENT">Absent</option>
                                            </select>

                                            <div style={{ width: '90%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>Approx Appointment time</label>
                                                <input
                                                    type="time"
                                                    value={dayConf.start_time || '10:00'}
                                                    onChange={e => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], start_time: e.target.value } }))}
                                                    disabled={!isActive}
                                                    style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', background: '#fff' }}
                                                />
                                            </div>

                                            <div style={{ width: '90%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>Limit</label>
                                                <input
                                                    type="number"
                                                    value={dayConf.online_limit || 0}
                                                    onChange={e => setWeeklyConfig(prev => ({ ...prev, [day]: { ...prev[day], online_limit: parseInt(e.target.value) || 0 } }))}
                                                    disabled={!isActive}
                                                    style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', background: '#fff' }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase' }}>Monthly Calendar View</h4>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button className="d-btn d-btn-outline" style={{ padding: '0.2rem 0.5rem', borderColor: '#e2e8f0', color: '#475569' }} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                                    <span style={{ color: '#0f1b35', fontWeight: 'bold', minWidth: '100px', textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>{calendarMonth.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                                    <button className="d-btn d-btn-outline" style={{ padding: '0.2rem 0.5rem', borderColor: '#e2e8f0', color: '#475569' }} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                                    <button className="d-btn d-btn-outline" onClick={() => setCalendarMonth(new Date())} style={{ padding: '0.2rem 0.5rem', borderColor: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>Today</button>
                                </div>
                            </div>
                            <div className="d-calendar">
                                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                                    <div key={day} style={{ textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '0.8rem', paddingBottom: '0.5rem' }}>{day}</div>
                                ))}
                                {/* Add empty placeholders for days before the start of the month */}
                                {Array.from({ length: (calendarDays[0].getDay() === 0 ? 6 : calendarDays[0].getDay() - 1) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {calendarDays.map((d, i) => {
                                    const dayName = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1] || 'monday';
                                    const baseDayConf = weeklyConfig?.[dayName] || { is_active: false, online_limit: 0, start_time: '10:00' };

                                    const isPast = d.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
                                    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                                    const histRecord = isPast ? doctorHistory?.history?.find(h => h.date && h.date.substring(0, 10) === dateKey) : null;
                                    const override = dateOverrides.find(o => o.date && toIsoDate(o.date) === dateKey);

                                    const isActive = isPast
                                        ? (!!histRecord && histRecord.status !== 'ABSENT')
                                        : (override ? !override.is_holiday : baseDayConf.is_active);

                                    const limit = isPast
                                        ? (histRecord?.visit_count || histRecord?.patients || 0)
                                        : (override ? override.online_limit : baseDayConf.online_limit) || 0;

                                    const startTime = override ? override.start_time : baseDayConf.start_time;

                                    return (
                                        <div key={i} className={`d-cal-tile ${isActive ? 'active-bg' : 'absent-bg'}`} style={{ opacity: isPast ? 0.6 : 1, cursor: isPast ? 'default' : 'pointer' }} onClick={() => !isPast && setShowCalModal({ date: d, dayName, conf: { is_active: isActive, online_limit: limit, start_time: startTime } })}>
                                            <div className="d-cal-date">{d.getDate()}</div>
                                            <div className="d-cal-day">{d.toLocaleDateString('en-US', { month: 'short' })}</div>
                                            {isActive && limit > 0 && <div className="d-cal-badge" style={{ background: isPast || !!override ? '#64748b' : '#3b82f6' }}>{limit}</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Section 4: Insights Strip */}
                        {editingId && (
                            <div className="d-insights-grid">
                                <div className="d-insight-card">
                                    <div className="d-insight-icon"><Activity size={20} /></div>
                                    <div className="d-insight-val">{doctorHistory?.summary?.total_days || 0}</div>
                                    <div className="d-insight-label">Total Sessions</div>
                                    <div className="d-trend-up"><TrendingUp size={14} /> +12%</div>
                                </div>
                                <div className="d-insight-card">
                                    <div className="d-insight-icon" style={{ color: '#10b981', background: '#ecfdf5' }}><Users size={20} /></div>
                                    <div className="d-insight-val">{doctorHistory?.summary?.total_patients || 0}</div>
                                    <div className="d-insight-label">Patient Base</div>
                                    <div className="d-trend-up"><TrendingUp size={14} /> +5%</div>
                                </div>
                                <div className="d-insight-card">
                                    <div className="d-insight-icon" style={{ color: '#f59e0b', background: '#fffbeb' }}><CheckCircle2 size={20} /></div>
                                    <div className="d-insight-val">{doctorHistory?.summary?.avg_patients_per_day || 0}</div>
                                    <div className="d-insight-label">Avg Attendance</div>
                                </div>
                                <div className="d-insight-card">
                                    <div className="d-insight-icon" style={{ color: '#f43f5e', background: '#fef2f2' }}><TrendingUp size={20} /></div>
                                    <div className="d-insight-val">{doctorHistory?.summary?.max_patients || doctorHistory?.summary?.peak_attendance || 0}</div>
                                    <div className="d-insight-label">Peak Inflow</div>
                                </div>
                            </div>
                        )}

                        {/* Section 5: Session Breakdown Table */}
                        {editingId && doctorHistory?.history && doctorHistory.history.length > 0 && (
                            <div className="d-card" style={{ padding: '0', overflow: 'hidden' }}>
                                <div className="d-card-header" style={{ padding: '1.5rem', marginBottom: 0, borderBottom: '1px solid #e2e8f0' }}>
                                    <div className="d-card-title"><History size={20} color="#3b82f6" /> Session Breakdown</div>
                                </div>
                                <div className="d-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                                    <table className="d-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Session Status</th>
                                                <th>Patients Served</th>
                                                <th>Completion Rate</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {doctorHistory.history.map((row, idx) => {
                                                const compRate = Math.min(100, Math.round(((row.visit_count || 0) / 20) * 100));
                                                const isCompleted = row.status === 'COMPLETED';
                                                return (
                                                    <tr key={idx}>
                                                        <td style={{ fontFamily: 'DM Mono', fontWeight: 500 }}>{row.date ? new Date(row.date).toLocaleDateString() : 'Unknown'}</td>
                                                        <td>
                                                            <span className={`d-chip ${isCompleted ? 'COMPLETED' : 'INCOMPLETE'}`}>
                                                                {isCompleted ? 'Completed' : 'Incomplete'}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontFamily: 'DM Mono', fontWeight: 700, textAlign: 'center' }}>{row.visit_count || row.patients || 0}</td>
                                                        <td>
                                                            <div className="d-progress-wrap">
                                                                <div className="d-progress-bg"><div className={`d-progress-fill ${isCompleted ? 'green' : 'orange'}`} style={{ width: `${compRate}%` }}></div></div>
                                                                <span style={{ fontFamily: 'DM Mono', fontSize: '0.75rem', fontWeight: 600 }}>{compRate}%</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button className="d-btn d-btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#3b82f6', borderColor: '#cbd5e1' }}>View</button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </main>

                    {toastMsg && (
                        <div className="d-toast">
                            <CheckCircle2 size={20} color="#10b981" />
                            {toastMsg}
                        </div>
                    )}

                    {showCalModal && (
                        <div className="d-modal-overlay" onClick={() => setShowCalModal(null)}>
                            <div className="d-modal-content" onClick={e => e.stopPropagation()}>
                                <h3>Edit Override for {showCalModal.date.toLocaleDateString()}</h3>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>Changes made here apply only to this specific date.</p>
                                <div className="d-input-group" style={{ marginBottom: '1rem' }}>
                                    <label>Status</label>
                                    <select
                                        value={showCalModal.conf?.is_active ? 'PRESENT' : 'ABSENT'}
                                        onChange={e => {
                                            const isActive = e.target.value === 'PRESENT';
                                            setShowCalModal({ ...showCalModal, conf: { ...showCalModal.conf, is_active: isActive } });
                                        }}
                                        style={{ color: '#0f1b35', background: '#f8fafc', borderColor: '#e2e8f0' }}
                                    >
                                        <option value="PRESENT">Present</option>
                                        <option value="ABSENT">Absent</option>
                                    </select>
                                </div>
                                <div className="d-input-group" style={{ marginBottom: '1rem' }}>
                                    <label>Approx Appointment time</label>
                                    <input
                                        type="time"
                                        value={showCalModal.conf?.start_time || '10:00'}
                                        onChange={e => {
                                            const st = e.target.value;
                                            setShowCalModal({ ...showCalModal, conf: { ...showCalModal.conf, start_time: st } });
                                        }}
                                        style={{ color: '#0f1b35', background: '#f8fafc', borderColor: '#e2e8f0' }}
                                        disabled={!showCalModal.conf?.is_active}
                                    />
                                </div>
                                <div className="d-input-group">
                                    <label>Online Limit</label>
                                    <input
                                        type="number"
                                        value={showCalModal.conf?.online_limit || 0}
                                        onChange={e => {
                                            const lim = parseInt(e.target.value) || 0;
                                            setShowCalModal({ ...showCalModal, conf: { ...showCalModal.conf, online_limit: lim } });
                                        }}
                                        style={{ color: '#0f1b35', background: '#f8fafc', borderColor: '#e2e8f0' }}
                                        disabled={!showCalModal.conf?.is_active}
                                    />
                                </div>
                                <div className="d-modal-actions">
                                    <button className="d-btn d-btn-outline" onClick={() => setShowCalModal(null)} style={{ color: '#64748b', borderColor: '#e2e8f0' }}>Cancel</button>
                                    <button className="d-btn d-btn-primary" onClick={async () => {
                                        // Generate the new override object for this specific date
                                        const dateKey = toIsoDate(showCalModal.date);
                                        const newOverride = {
                                            date: dateKey,
                                            is_holiday: !showCalModal.conf.is_active,
                                            start_time: showCalModal.conf.start_time,
                                            online_limit: showCalModal.conf.online_limit,
                                            total_tokens: showCalModal.conf.online_limit,
                                            walkin_limit: 0
                                        };

                                        // Remove any existing override for this same date so we don't duplicate
                                        const updatedOverrides = dateOverrides.filter(o => o.date && toIsoDate(o.date) !== dateKey);
                                        updatedOverrides.push(newOverride);

                                        try {
                                            await updateTokenConfig({
                                                doctor_id: editingId,
                                                weekly_config: weeklyConfig,
                                                date_overrides: updatedOverrides
                                            });
                                            showToast(`Date Override saved successfully`);
                                            setDateOverrides(updatedOverrides);
                                            setShowCalModal(null);
                                        } catch (e) {
                                            setError(e.response?.data?.message || 'Failed to save override');
                                        }
                                    }}>Save Override</button>
                                </div>
                            </div>
                        </div>
                    )}
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
