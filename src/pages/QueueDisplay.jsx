import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Monitor, RefreshCw, CheckCircle2, AlertCircle, ChevronRight,
    Clock, User, UserCheck, PlayCircle, Hash, SkipForward, RotateCcw, ExternalLink,
    Search, Filter, Zap, ArrowRight, Check, X, Bell
} from 'lucide-react';
import {
    getDoctors, getDailyTokens, getClinicDisplayData,
    nextToken, checkInToken, updateTokenStatus, autoReschedule, bookAppointmentWithToken,
    getTokenStatus, notifyDelay,
    toIsoDate
} from '../api/index';
import { removeSalutation } from '../utils/formatters';

const STATUS_CONFIG = {
    WAITING: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
    CHECKED_IN: { color: '#6366f1', bg: '#eef2ff', label: 'Called' },
    IN_PROGRESS: { color: '#0ea5e9', bg: '#e0f2fe', label: 'In Progress' },
    COMPLETED: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
    SKIPPED: { color: '#94a3b8', bg: '#f1f5f9', label: 'Skipped' },
    NO_SHOW: { color: '#ef4444', bg: '#fee2e2', label: 'No Show' },
};

// Context-aware actions per token status
const TOKEN_STATUS_ACTIONS = {
    WAITING: [
        { label: 'Check In',      value: 'CHECKED_IN',  icon: UserCheck,    color: '#6366f1' },
        { label: 'Mark No-Show',  value: 'NO_SHOW',     icon: AlertCircle,  color: '#ef4444' },
    ],
    CHECKED_IN: [
        { label: 'Start Session', value: 'IN_PROGRESS', icon: PlayCircle,   color: '#0ea5e9' },
        { label: 'Skip',          value: 'SKIPPED',     icon: SkipForward,  color: '#94a3b8' },
    ],
    IN_PROGRESS: [
        { label: 'Finish & Complete', value: 'COMPLETED', icon: CheckCircle2, color: '#10b981' },
    ],
    COMPLETED: [
        { label: 'Reset to Waiting', value: 'WAITING', icon: RotateCcw, color: '#f59e0b' },
    ],
    SKIPPED: [
        { label: 'Reset to Waiting', value: 'WAITING', icon: RotateCcw, color: '#f59e0b' },
    ],
    NO_SHOW: [
        { label: 'Reset to Waiting', value: 'WAITING', icon: RotateCcw, color: '#f59e0b' },
    ],
};

const StatBadge = ({ label, value, color, isActive, onClick }) => (
    <div
        onClick={onClick}
        className="stat-card-v4"
        style={{
            flex: 1,
            cursor: 'pointer',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '16px',
            border: isActive ? `2.5px solid #0f172a` : '1px solid #e2e8f0',
            boxShadow: isActive ? '0 10px 25px rgba(0,0,0,0.06)' : 'none',
            position: 'relative',
            background: isActive ? '#fff' : '#fff'
        }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: color, textAlign: 'center', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>{label}</div>
        {isActive && (
            <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '4px', background: '#0f172a', borderRadius: '4px 4px 0 0' }} />
        )}
    </div>
);

const TokenRow = ({ token, onCheckin, onStatusChange, onNext, isNext, isToday }) => {
    const cfg = STATUS_CONFIG[token.status] || STATUS_CONFIG.WAITING;

    return (
        <tr>
            <td>
                <div className={`token-id-pill ${isNext ? 'active' : ''}`}>
                    <Hash size={12} /> {token.token_display || token.token}
                </div>
            </td>
            <td>
                <div className="patient-name">{removeSalutation(token.child_name || token.patient_name) || '—'}</div>
                <div className="patient-id">{token.patient_id || ''}</div>
            </td>
            <td>
                <div className="doctor-name-pill" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
                    {token.doctor_name || '—'}
                </div>
            </td>
            <td><div className="slot-label">{token.appointment_time || token.token_display || '—'}</div></td>
            <td>
                <span className="status-pill" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                </span>
            </td>
            {/* Inline action buttons — only shown for today's date */}
            {isToday && (
                <td>
                    <div className="actions-cell" style={{ display: 'flex', gap: '6px' }}>
                        {token.status === 'WAITING' && (
                            <>
                                <button
                                    onClick={() => token.token && onCheckin(token.token, token.doctor_id)}
                                    disabled={!token.token}
                                    style={{ background: '#fff', border: '1px solid #6366f1', color: '#6366f1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <Check size={14} /> Check In
                                </button>
                                <button
                                    onClick={() => token.token && onStatusChange(token.token, 'NO_SHOW', token.doctor_id)}
                                    disabled={!token.token}
                                    style={{ background: '#fff', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <X size={14} /> No Show
                                </button>
                            </>
                        )}

                        {token.status === 'CHECKED_IN' && (
                            <>
                                <button
                                    onClick={() => onStatusChange(token.token, 'IN_PROGRESS', token.doctor_id)}
                                    style={{ background: '#008ad0', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <ChevronRight size={14} /> Start Session
                                </button>
                                <button
                                    onClick={() => onStatusChange(token.token, 'SKIPPED', token.doctor_id)}
                                    style={{ background: '#fff', border: '1px solid #94a3b8', color: '#94a3b8', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <SkipForward size={14} /> Skip
                                </button>
                            </>
                        )}

                        {token.status === 'IN_PROGRESS' && (
                            <button
                                onClick={() => onStatusChange(token.token, 'COMPLETED', token.doctor_id)}
                                style={{ background: '#10b981', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <CheckCircle2 size={14} /> Finish & Complete
                            </button>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );
};




const QueueDisplay = () => {
    const today = toIsoDate();
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [date, setDate] = useState(today);
    const [tokens, setTokens] = useState([]);
    const [displayData, setDisplayData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [searchQ, setSearchQ] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [tab, setTab] = useState('queue'); // queue | display
    const [statusSearch, setStatusSearch] = useState('');
    const [tokenStatusData, setTokenStatusData] = useState(null);
    const [checkingStatus, setCheckingStatus] = useState(false);

    const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };
    const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 5000); };

    useEffect(() => {
        getDoctors({ all: true }).then(r => {
            const list = r.data?.data || r.data?.doctors || [];
            setDoctors(list);
            // Default to empty (All Combined Doctors) instead of forcing first doctor
            setSelectedDoctor('');
        }).catch(() => { });
    }, []);

    const fetchQueue = useCallback(async () => {
        // We only require date, doctor_id can be empty for "All Combined"
        if (!date) return;
        setLoading(true);
        setError(null);
        try {
            const params = { date };
            if (selectedDoctor) params.doctor_id = selectedDoctor;

            const [tokenRes, displayRes] = await Promise.all([
                getDailyTokens(params),
                getClinicDisplayData(params)
            ]);
            setTokens(tokenRes.data?.data || []);
            const displayList = displayRes.data?.display || displayRes.data?.data || [];

            if (Array.isArray(displayList)) {
                // If we have a selected doctor, find their specific display data
                const currentDoctorDisplay = selectedDoctor
                    ? displayList.find(d => String(d.doctor_id) === String(selectedDoctor))
                    : displayList[0]; // Or some summary for "All Doctors"

                if (currentDoctorDisplay) {
                    setDisplayData({
                        ...currentDoctorDisplay,
                        current_token: currentDoctorDisplay.now_serving_token,
                        now_serving: currentDoctorDisplay.now_serving_token,
                        next_token: currentDoctorDisplay.next_token,
                        queue_length: currentDoctorDisplay.queue_length
                    });
                } else {
                    setDisplayData(null);
                }
            } else {
                setDisplayData(displayList || null);
            }
        } catch (e) {
            showError(e.response?.data?.message || 'Failed to load queue data');
        } finally {
            setLoading(false);
        }
    }, [selectedDoctor, date]);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    const handleCheckIn = async (token, tokenDocId) => {
        try {
            const docId = tokenDocId || selectedDoctor;
            await checkInToken(token, { doctor_id: docId, date });
            showSuccess(`Token ${token} checked in`);
            fetchQueue();
        } catch (e) { showError(e.response?.data?.message || 'Check-in failed'); }
    };

    const handleStatusChange = async (token, status, tokenDocId) => {
        try {
            const docId = tokenDocId || selectedDoctor;
            await updateTokenStatus(token, { status, doctor_id: docId, date });
            showSuccess(`Token ${token} marked as ${status}`);
            fetchQueue();
        } catch (e) { showError(e.response?.data?.message || 'Status update failed'); }
    };

    const handleNextToken = async (doctorId) => {
        try {
            const r = await nextToken(doctorId, { date });
            const next = r.data?.data;
            showSuccess(`Calling token ${next?.token || '—'}`);
            fetchQueue();
        } catch (e) { showError(e.response?.data?.message || 'Failed to advance queue'); }
    };

    const handleAutoReschedule = async () => {
        try {
            await autoReschedule({ doctor_id: selectedDoctor, date });
            showSuccess('Missed tokens auto-rescheduled');
            fetchQueue();
        } catch (e) { showError(e.response?.data?.message || 'Auto-reschedule failed'); }
    };

    const handleNotifyDelay = async () => {
        if (!selectedDoctor) {
            showError('Please select a doctor first to notify their waiting patients.');
            return;
        }
        const mins = window.prompt('Enter delay in minutes (e.g. 30):', '30');
        if (!mins) return;

        try {
            setLoading(true);
            await notifyDelay({ doctor_id: selectedDoctor, date, delay_minutes: mins });
            showSuccess(`Delay notification queued for doctor's patients`);
        } catch (e) {
            showError(e.response?.data?.message || 'Failed to notify delay');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckTokenStatus = async () => {
        if (!statusSearch) return;
        setCheckingStatus(true);
        setTokenStatusData(null);
        try {
            const res = await getTokenStatus(statusSearch, { doctor_id: selectedDoctor, date });
            setTokenStatusData(res.data?.data || res.data);
        } catch (e) {
            showError(e.response?.data?.message || 'Token not found');
        } finally {
            setCheckingStatus(false);
        }
    };

    const filtered = tokens.filter(t => {
        const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const q = searchQ.toLowerCase();
        const matchSearch = !q || (t.token?.toString().includes(q) || (t.child_name || '').toLowerCase().includes(q) || (t.patient_id || '').toLowerCase().includes(q));
        return matchStatus && matchSearch;
    });

    const stats = {
        total: tokens.length,
        waiting: tokens.filter(t => t.status === 'WAITING').length,
        checkedIn: tokens.filter(t => t.status === 'CHECKED_IN').length,
        completed: tokens.filter(t => t.status === 'COMPLETED').length,
        noShow: tokens.filter(t => t.status === 'NO_SHOW').length,
    };

    const nextPendingToken = filtered.find(t => t.status === 'WAITING' || t.status === 'CHECKED_IN');

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Queue Tokens</h1>
                    <p>Live monitoring and token management</p>
                </div>
                <div className="header-right-v4">
                    <a href="/clinic-display" target="_blank" rel="noopener noreferrer" className="btn-header-v4">
                        <Monitor size={16} /> <span>Display Board</span> <ExternalLink size={12} />
                    </a>
                    <button onClick={handleAutoReschedule} className="btn-header-v4" style={{ color: '#f59e0b' }}>
                        <RotateCcw size={16} /> <span>Auto-Reschedule</span>
                    </button>
                    <button onClick={handleNotifyDelay} className="btn-header-v4" style={{ color: '#ef4444' }}>
                        <Bell size={16} /> <span>Notify Delay</span>
                    </button>
                    <button onClick={fetchQueue} className="btn-header-v4">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <StatBadge label="Total" value={stats.total} color="#0f172a" isActive={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
                <StatBadge label="Waiting" value={stats.waiting} color="#f59e0b" isActive={statusFilter === 'WAITING'} onClick={() => setStatusFilter('WAITING')} />
                <StatBadge label="Checked In" value={stats.checkedIn} color="#6366f1" isActive={statusFilter === 'CHECKED_IN'} onClick={() => setStatusFilter('CHECKED_IN')} />
                <StatBadge label="Completed" value={stats.completed} color="#10b981" isActive={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')} />
                <StatBadge label="No Show" value={stats.noShow} color="#ef4444" isActive={statusFilter === 'NO_SHOW'} onClick={() => setStatusFilter('NO_SHOW')} />
            </div>

            <div className="filter-shelf-v4" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px', borderRight: '1px solid #f1f5f9' }}>
                    <Filter size={16} color="#94a3b8" />
                    <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                        <option value="">All Combined Doctors</option>
                        {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name || d.full_name}</option>)}
                    </select>
                </div>
                
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }} />

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <Search size={16} color="#94a3b8" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search token, patient..."
                        style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: '0.85rem', fontWeight: 500 }} />
                </div>

                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, background: '#fff' }}>
                    <option value="ALL">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>

                <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
                    <input
                        value={statusSearch}
                        onChange={e => setStatusSearch(e.target.value)}
                        placeholder="Token #..."
                        style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', width: '90px', outline: 'none' }}
                    />
                    <button onClick={handleCheckTokenStatus} disabled={checkingStatus}
                        style={{ padding: '6px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                        {checkingStatus ? '...' : <Zap size={14} />}
                    </button>
                </div>
            </div>

            {/* Token Status Result */}
            {tokenStatusData && (
                <div className="token-status-banner" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ background: '#6366f1', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontWeight: 900 }}>{tokenStatusData.token}</div>
                        <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{tokenStatusData.status}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Position</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>#{tokenStatusData.position_in_queue || '—'}</div>
                        </div>
                    </div>
                    <button onClick={() => setTokenStatusData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                </div>
            )}

            {/* Alerts */}
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><AlertCircle size={18} />{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} />{success}</div>}



            {/* Table */}
            <div className="queue-table-card">
                <div className="queue-table-header">
                    <h3>
                        <Hash size={16} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle', color: '#6366f1' }} />
                        Token List — {filtered.length} records
                    </h3>
                </div>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.8rem' }}>Loading queue...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        <Hash size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                        <p style={{ fontWeight: 600, fontSize: '0.8rem' }}>No tokens found</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="queue-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Patient</th>
                                    <th>Doctor</th>
                                    <th>Scheduled Time</th>
                                    <th>Status</th>
                                    {/* Only show Actions column header for today */}
                                    {date === today && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(token => (
                                    <TokenRow
                                        key={token.appointment_id || token._id || `${token.doctor_id}-${token.token}`}
                                        token={{ ...token, is_single_doctor: !!selectedDoctor }}
                                        onCheckin={handleCheckIn}
                                        onStatusChange={handleStatusChange}
                                        onNext={handleNextToken}
                                        isNext={nextPendingToken?.token === token.token}
                                        isToday={date === today}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QueueDisplay;
