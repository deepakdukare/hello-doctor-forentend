import React, { useState, useEffect, useCallback } from 'react';
import {
    Clock, Plus, Trash2, Edit2, Check, X,
    RefreshCw, AlertCircle, Lock, Unlock, Calendar as CalIcon, Grid,
    ChevronLeft, ChevronRight, Filter, Settings, Shield,
    CheckCircle2, AlertTriangle, Activity, Coffee, Sun, Moon
} from 'lucide-react';
import {
    getSlotConfig, createSlot, deleteSlot, updateSlotConfig,
    getDailyStatus, blockSlots, unblockSlots
} from '../api/index';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SESSION_CONFIG = {
    MORNING: { icon: <Sun size={18} />, color: '#f59e0b', bg: '#fffbeb', label: 'Morning Session' },
    AFTERNOON: { icon: <Coffee size={18} />, color: '#0ea5e9', bg: '#f0f9ff', label: 'Afternoon Session' },
    EVENING: { icon: <Moon size={18} />, color: '#8b5cf6', bg: '#f5f3ff', label: 'Evening Session' }
};

const DOCTOR_TYPES = [
    { value: 'PULMONARY', label: 'Pulmonary Specialist', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { value: 'NON_PULMONARY', label: 'Non-Pulmonary', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
    { value: 'VACCINATION', label: 'Vaccination clinic', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
];

const fmt12 = (t = '') => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const Scheduling = () => {
    const [tab, setTab] = useState('daily'); // Start with Daily View as it's most useful
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Filter / View States
    const [docType, setDocType] = useState('PULMONARY');
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
        return d.toISOString().split('T')[0];
    });

    const [weekGrid, setWeekGrid] = useState({});
    const [dailyLoading, setDailyLoading] = useState(false);

    // Master Slot Management
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({ slot_label: '', start_time: '', end_time: '', session: 'MORNING', sort_order: 99 });
    const [saving, setSaving] = useState(false);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const loadMasterData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getSlotConfig();
            setSlots(res.data.data || []);
        } catch (err) {
            setError("Failed to load slot configurations");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDailyGrid = useCallback(async () => {
        setDailyLoading(true);
        try {
            const results = await Promise.all(
                weekDates.map(d => getDailyStatus(docType, d).catch(() => ({ data: { data: [] } })))
            );
            const grid = {};
            results.forEach((res, i) => {
                const dateStr = weekDates[i];
                (res.data?.data || []).forEach(s => {
                    if (!grid[s.slot_id]) grid[s.slot_id] = {};
                    grid[s.slot_id][dateStr] = s;
                });
            });
            setWeekGrid(grid);
        } catch (err) {
            setError("Failed to load daily status grid");
        } finally {
            setDailyLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docType, weekStart]);

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    useEffect(() => {
        if (tab === 'daily') loadDailyGrid();
    }, [tab, loadDailyGrid]);

    const handleToggleBlock = async (slot_id, dateStr, isBlocked) => {
        try {
            if (isBlocked) {
                await unblockSlots({ slots: [slot_id], slot_date: dateStr, doctor_type: docType });
            } else {
                await blockSlots({ slots: [slot_id], slot_date: dateStr, doctor_type: docType });
            }
            loadDailyGrid();
            setSuccess(`Slot ${isBlocked ? 'unblocked' : 'blocked'} successfully`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError("Failed to update slot status");
        }
    };

    const handleAddSlot = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createSlot(form);
            setShowAddModal(false);
            setForm({ slot_label: '', start_time: '', end_time: '', session: 'MORNING', sort_order: 99 });
            loadMasterData();
            setSuccess("New slot template created");
        } catch (err) {
            setError("Failed to create slot");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm(`Delete slot ${id}? This cannot be undone.`)) return;
        try {
            await deleteSlot(id);
            loadMasterData();
            setSuccess("Slot deleted successfully");
        } catch (err) {
            setError("Could not delete slot");
        }
    };

    const shiftWeek = (dir) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + (dir * 7));
        setWeekStart(d.toISOString().split('T')[0]);
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #1e293b 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Clinic Scheduling
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Management of time slots, doctor availability, and overrides</p>
                </div>
                <div style={{ display: 'flex', background: '#fff', padding: '0.4rem', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    {[
                        { id: 'daily', label: 'Availability Grid', icon: <Grid size={16} /> },
                        { id: 'master', label: 'Slot Templates', icon: <Settings size={16} /> }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', borderRadius: '10px',
                                border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                                background: tab === t.id ? 'var(--primary)' : 'transparent',
                                color: tab === t.id ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', color: '#ef4444', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <AlertTriangle size={20} /> {error}
                    <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={18} /></button>
                </div>
            )}

            {success && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', color: '#16a34a', display: 'flex', gap: '0.75rem', alignItems: 'center', animation: 'fadeInUp 0.3s ease-out' }}>
                    <CheckCircle2 size={20} /> {success}
                </div>
            )}

            {/* Daily View Tab */}
            {tab === 'daily' && (
                <div className="daily-view-container">
                    {/* Controls Bar */}
                    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {DOCTOR_TYPES.map(dt => (
                                <button
                                    key={dt.value}
                                    onClick={() => setDocType(dt.value)}
                                    style={{
                                        padding: '0.6rem 1.25rem', borderRadius: '12px', border: '2px solid',
                                        borderColor: docType === dt.value ? dt.color : '#f1f5f9',
                                        background: docType === dt.value ? dt.bg : '#fff',
                                        color: docType === dt.value ? dt.color : '#64748b',
                                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {dt.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <button onClick={() => shiftWeek(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><ChevronLeft size={20} /></button>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: '220px', textAlign: 'center', color: '#1e293b' }}>
                                {new Date(weekDates[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                {' — '}
                                {new Date(weekDates[6]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => shiftWeek(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><ChevronRight size={20} /></button>
                        </div>

                        <button onClick={loadDailyGrid} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', borderRadius: '12px' }}>
                            <RefreshCw size={18} className={dailyLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Matrix Grid */}
                    <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1.25rem 1.5rem', width: '240px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Available Slots</th>
                                        {weekDates.map((dateStr, i) => {
                                            const isToday = dateStr === new Date().toISOString().split('T')[0];
                                            return (
                                                <th key={dateStr} style={{ padding: '1.25rem 0.5rem', textAlign: 'center', minWidth: '100px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: isToday ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800 }}>{DAYS_SHORT[i].toUpperCase()}</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isToday ? 'var(--primary)' : '#1e293b', marginTop: '0.25rem' }}>
                                                        {new Date(dateStr).getDate()}
                                                    </div>
                                                    {isToday && <div style={{ height: '3px', width: '20px', background: 'var(--primary)', margin: '4px auto 0', borderRadius: '2px' }} />}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.length === 0 ? (
                                        <tr><td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No slots defined in Master Template</td></tr>
                                    ) : (
                                        slots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(slot => (
                                            <tr key={slot.slot_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: SESSION_CONFIG[slot.session]?.bg || '#f1f5f9', color: SESSION_CONFIG[slot.session]?.color || '#64748b' }}>
                                                            {SESSION_CONFIG[slot.session]?.icon}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 750, color: '#1e293b', fontSize: '0.9rem' }}>{slot.slot_label}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{fmt12(slot.start_time)} – {fmt12(slot.end_time)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {weekDates.map(dateStr => {
                                                    const cell = weekGrid[slot.slot_id]?.[dateStr];
                                                    const isBooked = cell?.is_booked || cell?.status?.is_booked;
                                                    const isBlocked = cell?.blocked_by_admin || cell?.status?.blocked_by_admin;

                                                    return (
                                                        <td key={dateStr} style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                            {isBooked ? (
                                                                <div style={{ padding: '0.6rem', borderRadius: '10px', background: '#e0e7ff', color: '#4338ca', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                                                    <Activity size={12} /> BOOKED
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleToggleBlock(slot.slot_id, dateStr, isBlocked)}
                                                                    style={{
                                                                        width: '100%', padding: '0.6rem', borderRadius: '10px',
                                                                        border: '1.5px solid', cursor: 'pointer',
                                                                        background: isBlocked ? '#fef2f2' : '#f0fdf4',
                                                                        borderColor: isBlocked ? '#fee2e2' : '#dcfce7',
                                                                        color: isBlocked ? '#ef4444' : '#10b981',
                                                                        fontSize: '0.7rem', fontWeight: 800,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    className="grid-btn"
                                                                >
                                                                    {isBlocked ? <Lock size={12} /> : <Unlock size={12} />}
                                                                    {isBlocked ? 'BLOCKED' : 'AVAILABLE'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Master Template Tab */}
            {tab === 'master' && (
                <div className="master-view">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Slot Master Templates</h3>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderRadius: '12px' }}>
                            <Plus size={18} /> Define New Slot
                        </button>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>ID & ORDER</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>LABEL</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>TIME RANGE</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>SESSION</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(s => (
                                    <tr key={s.slot_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>{s.slot_id}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>Ord: {s.sort_order}</span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#1e293b' }}>{s.slot_label}</td>
                                        <td style={{ padding: '1.25rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '20px', background: SESSION_CONFIG[s.session]?.bg, color: SESSION_CONFIG[s.session]?.color, fontSize: '0.75rem', fontWeight: 700 }}>
                                                {SESSION_CONFIG[s.session]?.icon} {s.session}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                            <button onClick={() => handleDeleteSlot(s.slot_id)} style={{ padding: '0.5rem', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }} title="Delete Template">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Slot Modal */}
            {showAddModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ width: '450px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', padding: '1.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>New Slot Template</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddSlot} style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                <div>
                                    <label>Slot Label *</label>
                                    <input required placeholder="e.g. 09:00 AM Slot" value={form.slot_label} onChange={e => setForm({ ...form, slot_label: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label>Start Time *</label>
                                        <input type="time" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                                    </div>
                                    <div>
                                        <label>End Time *</label>
                                        <input type="time" required value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label>Session *</label>
                                        <select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })}>
                                            <option value="MORNING">Morning</option>
                                            <option value="AFTERNOON">Afternoon</option>
                                            <option value="EVENING">Evening</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Sort Order</label>
                                        <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Creating...' : 'Create Template'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .grid-btn:hover {
                    filter: brightness(0.95);
                    transform: scale(1.02);
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default Scheduling;
