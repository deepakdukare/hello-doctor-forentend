import React, { useState, useEffect, useCallback } from 'react';
import {
    Monitor, RefreshCw, CheckCircle2, AlertCircle, ChevronRight,
    Clock, User, Hash, SkipForward, RotateCcw, ExternalLink,
    Search, Filter, Zap, ArrowRight, Check, X
} from 'lucide-react';
import {
    getDoctors, getDailyTokens, getClinicDisplayData,
    nextToken, checkInToken, updateTokenStatus, autoReschedule, bookAppointmentWithToken,
    getTokenStatus
} from '../api/index';

const STATUS_CONFIG = {
    WAITING: { color: '#f59e0b', bg: '#fef3c7', label: 'Waiting' },
    CHECKED_IN: { color: '#6366f1', bg: '#eef2ff', label: 'Checked In' },
    IN_PROGRESS: { color: '#0ea5e9', bg: '#e0f2fe', label: 'In Progress' },
    COMPLETED: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
    SKIPPED: { color: '#94a3b8', bg: '#f1f5f9', label: 'Skipped' },
    NO_SHOW: { color: '#ef4444', bg: '#fee2e2', label: 'No Show' },
};

const StatBadge = ({ label, value, color }) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem 1.5rem', textAlign: 'center', minWidth: '100px' }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
);

const TokenRow = ({ token, onCheckin, onStatusChange, onNext, isNext }) => {
    const cfg = STATUS_CONFIG[token.status] || STATUS_CONFIG.WAITING;
    return (
        <tr style={{ transition: 'all 0.2s' }}>
            <td style={{ padding: '1rem 1.25rem' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: isNext ? 'linear-gradient(135deg, #6366f1, #4338ca)' : '#f8fafc',
                    color: isNext ? '#fff' : '#1e293b',
                    padding: '0.4rem 0.9rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.95rem'
                }}>
                    <Hash size={14} /> {token.token}
                </div>
            </td>
            <td style={{ padding: '1rem 1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{token.child_name || token.patient_name || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{token.patient_id || ''}</div>
            </td>
            <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>{token.slot_label || token.slot_id || '—'}</td>
            <td style={{ padding: '1rem 1.25rem' }}>
                <span style={{ background: cfg.bg, color: cfg.color, padding: '0.3rem 0.75rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {cfg.label}
                </span>
            </td>
            <td style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {token.status === 'WAITING' && (
                        <button onClick={() => onCheckin(token.token)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1.5px solid #6366f1', background: '#fff', color: '#6366f1', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                            <Check size={13} /> Check In
                        </button>
                    )}
                    {(token.status === 'CHECKED_IN' || token.status === 'WAITING') && (
                        <button onClick={() => onStatusChange(token.token, 'NO_SHOW')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                            <X size={13} /> No Show
                        </button>
                    )}
                    {token.status === 'CHECKED_IN' && (
                        <button onClick={() => onNext(token.doctor_id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                            <SkipForward size={13} /> Call Next
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
};

const QueueDisplay = () => {
    const today = new Date().toISOString().split('T')[0];
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
        getDoctors().then(r => {
            const list = r.data?.data || r.data?.doctors || [];
            setDoctors(list);
            if (list.length > 0) setSelectedDoctor(list[0].doctor_id || list[0]._id);
        }).catch(() => { });
    }, []);

    const fetchQueue = useCallback(async () => {
        if (!selectedDoctor) return;
        setLoading(true);
        setError(null);
        try {
            const [tokenRes, displayRes] = await Promise.all([
                getDailyTokens({ doctor_id: selectedDoctor, date }),
                getClinicDisplayData({ doctor_id: selectedDoctor, date })
            ]);
            setTokens(tokenRes.data?.data || []);
            const displayList = displayRes.data?.display || displayRes.data?.data || [];
            if (Array.isArray(displayList)) {
                const currentDoctorDisplay = displayList.find(d => String(d.doctor_id) === String(selectedDoctor));
                // Map API names to component expected names
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

    const handleCheckIn = async (token) => {
        try {
            await checkInToken(token, { doctor_id: selectedDoctor, date });
            showSuccess(`Token ${token} checked in`);
            fetchQueue();
        } catch (e) { showError(e.response?.data?.message || 'Check-in failed'); }
    };

    const handleStatusChange = async (token, status) => {
        try {
            await updateTokenStatus(token, { status, doctor_id: selectedDoctor, date });
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
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Token Queue</h1>
                    <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontWeight: 500 }}>Manage clinic queue tokens and patient flow</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <a href="/clinic-display" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#64748b', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                        <Monitor size={16} /> Display Board <ExternalLink size={12} />
                    </a>
                    <button onClick={handleAutoReschedule}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', background: '#fff', border: '1.5px solid #f59e0b', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        <RotateCcw size={16} /> Auto-Reschedule
                    </button>
                    <button onClick={fetchQueue}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #4338ca)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px' }}>
                    <Filter size={16} color="#94a3b8" />
                    <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}
                        style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.875rem', color: '#1e293b', background: '#fff', flex: 1 }}>
                        {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name}</option>)}
                    </select>
                </div>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.875rem', color: '#1e293b' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0 0.75rem' }}>
                    <Search size={16} color="#94a3b8" />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search token, patient..."
                        style={{ border: 'none', background: 'transparent', padding: '0.55rem 0', fontSize: '0.875rem', outline: 'none', width: '100%' }} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.875rem', color: '#1e293b', background: '#fff' }}>
                    <option value="ALL">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                    <input
                        value={statusSearch}
                        onChange={e => setStatusSearch(e.target.value)}
                        placeholder="Token #..."
                        style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '80px', outline: 'none' }}
                    />
                    <button
                        onClick={handleCheckTokenStatus}
                        disabled={checkingStatus}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                    >
                        {checkingStatus ? '...' : <Zap size={14} />}
                    </button>
                </div>
            </div>

            {/* Token Status Result */}
            {tokenStatusData && (
                <div style={{ background: '#eff6ff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #bfdbfe', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800 }}>
                            {tokenStatusData.token}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>Token Status</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e40af' }}>{tokenStatusData.status}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>Position</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e40af' }}>#{tokenStatusData.position_in_queue || '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>Estimated Wait</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e40af' }}>{tokenStatusData.estimated_wait || '0'}m</div>
                        </div>
                    </div>
                    <button onClick={() => setTokenStatusData(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>
            )}

            {/* Alerts */}
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><AlertCircle size={18} />{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} />{success}</div>}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <StatBadge label="Total" value={stats.total} color="#0f172a" />
                <StatBadge label="Waiting" value={stats.waiting} color="#f59e0b" />
                <StatBadge label="Checked In" value={stats.checkedIn} color="#6366f1" />
                <StatBadge label="Completed" value={stats.completed} color="#10b981" />
                <StatBadge label="No Show" value={stats.noShow} color="#ef4444" />
            </div>

            {/* Display board data */}
            {displayData && (
                <div style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)', borderRadius: '20px', padding: '1.25rem 1.75rem', marginBottom: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <Monitor size={28} style={{ opacity: 0.8 }} />
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Now Serving</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900 }}>
                            {displayData.current_token || displayData.now_serving || '—'}
                        </div>
                    </div>
                    {displayData.next_token && (
                        <>
                            <ArrowRight size={20} style={{ opacity: 0.5 }} />
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Up Next</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{displayData.next_token}</div>
                            </div>
                        </>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem' }}>
                        {displayData.queue_length !== undefined && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{displayData.queue_length}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.75, fontWeight: 600 }}>In Queue</div>
                            </div>
                        )}
                        {displayData.estimated_wait !== undefined && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{displayData.estimated_wait}m</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.75, fontWeight: 600 }}>Est. Wait</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        <Hash size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: '#6366f1' }} />
                        Token List — {filtered.length} records
                    </h3>
                </div>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
                        <p>Loading queue...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        <Hash size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p style={{ fontWeight: 600 }}>No tokens found for selected filters</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Token</th>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient</th>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Slot</th>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(token => (
                                    <TokenRow
                                        key={token.token || token._id}
                                        token={token}
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

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                tr:hover td { background: #f8faff !important; }
            `}</style>
        </div>
    );
};

export default QueueDisplay;
