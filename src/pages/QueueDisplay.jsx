import React, { useState, useEffect, useCallback } from 'react';
import {
    Monitor, RefreshCw, CheckCircle2, AlertCircle, ChevronRight,
    Clock, User, Hash, SkipForward, RotateCcw, ExternalLink,
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

const StatBadge = ({ label, value, color, isActive, onClick }) => (
    <div
        onClick={onClick}
        className="stat-badge-custom"
        style={{
            border: isActive ? `2px solid ${color}` : '1.5px solid #e2e8f0',
            transform: isActive ? 'translateY(-2px)' : 'none',
            boxShadow: isActive ? `0 4px 12px ${color}20` : 'none',
        }}>
        <div className="stat-badge-value" style={{ color }}>{value}</div>
        <div className="stat-badge-label" style={{ color: isActive ? color : '#94a3b8' }}>{label}</div>
        {isActive && (
            <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: '3px', background: color, borderRadius: '3px 3px 0 0' }} />
        )}
    </div>
);

const TokenRow = ({ token, onCheckin, onStatusChange, onNext, isNext }) => {
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
            <td>
                <div className="actions-cell">
                    {token.status === 'WAITING' && (
                        <>
                            <button
                                onClick={() => token.token && onCheckin(token.token, token.doctor_id)}
                                disabled={!token.token}
                                className="btn-token-check"
                                style={{ opacity: !token.token ? 0.5 : 1 }}>
                                <Check size={11} /> Check In
                            </button>
                            <button
                                onClick={() => token.token && onStatusChange(token.token, 'NO_SHOW', token.doctor_id)}
                                disabled={!token.token}
                                className="btn-token-no-show"
                                style={{ opacity: !token.token ? 0.5 : 1 }}>
                                <X size={11} /> No Show
                            </button>
                        </>
                    )}

                    {token.status === 'CHECKED_IN' && (
                        <>
                            <button
                                onClick={() => onStatusChange(token.token, 'IN_PROGRESS', token.doctor_id)}
                                className="btn-token-start">
                                <ChevronRight size={11} /> Start Session
                            </button>
                            <button
                                onClick={() => onStatusChange(token.token, 'SKIPPED', token.doctor_id)}
                                className="btn-token-skip">
                                <SkipForward size={11} /> Skip
                            </button>
                        </>
                    )}

                    {token.status === 'IN_PROGRESS' && (
                        <button
                            onClick={() => onStatusChange(token.token, 'COMPLETED', token.doctor_id)}
                            className="btn-token-finish">
                            <CheckCircle2 size={11} /> Finish & Complete
                        </button>
                    )}

                    {(token.status === 'COMPLETED' || token.status === 'SKIPPED' || token.status === 'NO_SHOW') && (
                        <button
                            onClick={() => onStatusChange(token.token, 'WAITING', token.doctor_id)}
                            className="btn-token-reset">
                            <RotateCcw size={11} /> Reset to Waiting
                        </button>
                    )}
                </div>
            </td>
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
        <div className="queue-container">
            <div className="queue-header">
                <div>
                    <h1>Queue Tokens</h1>
                </div>
                <div className="queue-header-actions">
                    <a href="/clinic-display" target="_blank" rel="noopener noreferrer"
                        className="btn-queue-action">
                        <Monitor size={14} /> Display Board <ExternalLink size={10} />
                    </a>
                    <button onClick={handleAutoReschedule}
                        className="btn-queue-action btn-reschedule">
                        <RotateCcw size={14} /> Auto-Reschedule
                    </button>
                    <button onClick={handleNotifyDelay}
                        className="btn-queue-action btn-notify">
                        <Bell size={14} /> Notify Delay
                    </button>
                    <button onClick={fetchQueue}
                        className="btn-queue-action btn-refresh">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="queue-filters">
                <div className="filter-group">
                    <Filter size={14} color="#94a3b8" />
                    <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
                        className="filter-select">
                        <option value="" key="all-doc-combined">All Combined Doctors</option>
                        {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name || d.full_name}</option>)}
                    </select>
                </div>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="filter-date" />
                <div className="filter-search-wrap">
                    <Search size={14} color="#94a3b8" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search token, patient..."
                        className="filter-search-input" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="filter-select">
                    <option value="ALL">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                    <input
                        value={statusSearch}
                        onChange={e => setStatusSearch(e.target.value)}
                        placeholder="Token #..."
                        style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: '70px', outline: 'none' }}
                    />
                    <button
                        onClick={handleCheckTokenStatus}
                        disabled={checkingStatus}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                    >
                        {checkingStatus ? '...' : <Zap size={12} />}
                    </button>
                </div>
            </div>

            {/* Token Status Result */}
            {tokenStatusData && (
                <div className="token-status-banner">
                    <div className="token-status-info">
                        <div className="token-status-badge">
                            {tokenStatusData.token}
                        </div>
                        <div>
                            <div className="token-status-label">Token Status</div>
                            <div className="token-status-value">{tokenStatusData.status}</div>
                        </div>
                        <div>
                            <div className="token-status-label">Position</div>
                            <div className="token-status-value">#{tokenStatusData.position_in_queue || '—'}</div>
                        </div>
                        <div>
                            <div className="token-status-label">Estimated Wait</div>
                            <div className="token-status-value">{tokenStatusData.estimated_wait || '0'}m</div>
                        </div>
                    </div>
                    <button onClick={() => setTokenStatusData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>
            )}

            {/* Alerts */}
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><AlertCircle size={18} />{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} />{success}</div>}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <StatBadge label="Total" value={stats.total} color="#0f172a" isActive={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
                <StatBadge label="Waiting" value={stats.waiting} color="#f59e0b" isActive={statusFilter === 'WAITING'} onClick={() => setStatusFilter('WAITING')} />
                <StatBadge label="Checked In" value={stats.checkedIn} color="#6366f1" isActive={statusFilter === 'CHECKED_IN'} onClick={() => setStatusFilter('CHECKED_IN')} />
                <StatBadge label="Completed" value={stats.completed} color="#10b981" isActive={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')} />
                <StatBadge label="No Show" value={stats.noShow} color="#ef4444" isActive={statusFilter === 'NO_SHOW'} onClick={() => setStatusFilter('NO_SHOW')} />
            </div>


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
                                    <th>Actions</th>
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
