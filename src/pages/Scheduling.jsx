import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Clock, Plus, Trash2, Edit2, Check, X,
    RefreshCw, AlertCircle, Calendar as CalIcon,
    ChevronLeft, ChevronRight, Settings, Shield,
    CheckCircle2, AlertTriangle, Sun, Moon, Coffee,
    LayoutGrid, ListChecks, Calendar, Database,
    User, Stethoscope, Building2, Save,
    Activity, ArrowRight, Zap, Info, Sliders,
    ToggleLeft, ToggleRight
} from 'lucide-react';
import {
    getSlotConfig, createSlot, deleteSlot, updateSlotConfig,
    getDailyStatus, updateDailySlot, getDoctors
} from '../api/index';

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CLINIC_TYPES = [
    { id: 'PULMONARY', label: 'Pulmonary Specialist', color: '#6366f1', icon: <Stethoscope size={18} /> },
    { id: 'NON_PULMONARY', label: 'Non-Pulmonary', color: '#0ea5e9', icon: <Building2 size={18} /> },
    { id: 'VACCINATION', label: 'Vaccination Clinic', color: '#10b981', icon: <Shield size={18} /> }
];

const SESSION_MAP = {
    MORNING: { icon: <Sun size={16} />, color: '#f59e0b', bg: '#fffbeb' },
    AFTERNOON: { icon: <Coffee size={16} />, color: '#0ea5e9', bg: '#f0f9ff' },
    EVENING: { icon: <Moon size={16} />, color: '#8b5cf6', bg: '#f5f3ff' }
};

const fmt12 = (t = '') => {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const Scheduling = () => {
    const [view, setView] = useState('weekly'); // 'weekly' | 'config' | 'daily'
    const [masterSlots, setMasterSlots] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Weekly View State
    const [selectedClinic, setSelectedClinic] = useState('VACCINATION');

    // Daily Override State
    const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoc, setSelectedDoc] = useState('');
    const [dailyGrid, setDailyGrid] = useState([]);
    const [dailyLoading, setDailyLoading] = useState(false);

    // Config State
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [slotForm, setSlotForm] = useState({
        slot_id: '', slot_label: '', start_time: '', end_time: '',
        session: 'MORNING', sort_order: 1, is_active: true
    });

    const loadPrimaryData = useCallback(async () => {
        setLoading(true);
        try {
            const [slotsRes, docsRes] = await Promise.all([
                getSlotConfig(),
                getDoctors()
            ]);
            setMasterSlots(slotsRes.data.data || []);
            const docs = docsRes.data.data || [];
            setDoctors(docs);
            if (docs.length > 0 && !selectedDoc) setSelectedDoc(docs[0].name);
        } catch (err) {
            setError("Synchronization failure with Slot Engine.");
        } finally {
            setLoading(false);
        }
    }, [selectedDoc]);

    const loadDailyData = useCallback(async () => {
        if (!selectedDoc || view !== 'daily') return;
        setDailyLoading(true);
        try {
            const res = await getDailyStatus(selectedDoc, dailyDate);
            setDailyGrid(res.data.data || []);
        } catch (err) {
            setError("Failed to fetch daily override registry.");
        } finally {
            setDailyLoading(false);
        }
    }, [selectedDoc, dailyDate, view]);

    useEffect(() => { loadPrimaryData(); }, [loadPrimaryData]);
    useEffect(() => { loadDailyData(); }, [loadDailyData]);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. WEEKLY VIEW LOGIC
    // ──────────────────────────────────────────────────────────────────────────
    const toggleWeeklyDay = async (slotId, dayIdx) => {
        try {
            const updatedSlots = masterSlots.map(slot => {
                if (slot.slot_id !== slotId) return slot;

                const currentDays = slot.days_by_doctor?.[selectedClinic] || [];
                const nextDays = currentDays.includes(dayIdx)
                    ? currentDays.filter(d => d !== dayIdx)
                    : [...currentDays, dayIdx];

                return {
                    ...slot,
                    days_by_doctor: {
                        ...(slot.days_by_doctor || {}),
                        [selectedClinic]: nextDays
                    }
                };
            });

            setMasterSlots(updatedSlots);
            await updateSlotConfig(updatedSlots);
            setSuccess("Weekly pattern synchronized.");
            setTimeout(() => setSuccess(null), 1500);
        } catch (err) {
            setError("Recurring update failed.");
            loadPrimaryData();
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SLOT CONFIG LOGIC
    // ──────────────────────────────────────────────────────────────────────────
    const handleSaveSlot = async (e) => {
        e.preventDefault();
        try {
            if (editingSlot) {
                const updated = masterSlots.map(s => s.slot_id === editingSlot.slot_id ? slotForm : s);
                await updateSlotConfig(updated);
            } else {
                await createSlot(slotForm);
            }
            setShowSlotModal(false);
            setEditingSlot(null);
            loadPrimaryData();
            setSuccess("Chrono-Template committed.");
        } catch (err) { setError("Validation error."); }
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm("Purge template?")) return;
        try {
            await deleteSlot(id);
            loadPrimaryData();
            setSuccess("Purged.");
        } catch (err) { setError("Locked template."); }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 3. DAILY OVERRIDE LOGIC
    // ──────────────────────────────────────────────────────────────────────────
    const handleDailyToggle = async (slotId, currentBlocked) => {
        try {
            await updateDailySlot({
                doctor_name: selectedDoc,
                slot_date: dailyDate,
                slot_id: slotId,
                blocked_by_admin: !currentBlocked
            });
            loadDailyData();
            setSuccess("Precision override committed.");
        } catch (err) { setError("Override rejected."); }
    };

    return (
        <div className="sched-container">
            {/* Navigational Sidebar */}
            <aside className="sched-sidebar">
                <div className="sched-brand">
                    <Sliders size={28} />
                    <span>Control Hub</span>
                </div>

                <nav className="sched-nav">
                    <button onClick={() => setView('weekly')} className={view === 'weekly' ? 'active' : ''}>
                        <Calendar size={20} />
                        <div>
                            <strong>Weekly View</strong>
                            <small>Recurring availability</small>
                        </div>
                    </button>

                    <button onClick={() => setView('config')} className={view === 'config' ? 'active' : ''}>
                        <Database size={20} />
                        <div>
                            <strong>Slot Config</strong>
                            <small>Template management</small>
                        </div>
                    </button>

                    <button onClick={() => setView('daily')} className={view === 'daily' ? 'active' : ''}>
                        <Activity size={20} />
                        <div>
                            <strong>Daily Overrides</strong>
                            <small>Date-specific control</small>
                        </div>
                    </button>
                </nav>

                <div className="sched-meta">
                    <div className="engine-status">
                        <div className="pulse"></div>
                        <span>Clinical Index Active</span>
                    </div>
                </div>
            </aside>

            {/* Content Core */}
            <main className="sched-main">
                {/* Global Toast */}
                {(error || success) && (
                    <div className={`sched-toast ${error ? 'error' : 'success'}`}>
                        {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                        <span>{error || success}</span>
                    </div>
                )}

                {/* 1. WEEKLY VIEW PANEL */}
                {view === 'weekly' && (
                    <section className="view-panel fadeIn">
                        <header className="panel-header">
                            <div>
                                <h1>Recurring Weekly Logic</h1>
                                <p>Define standard bandwidth patterns for departments</p>
                            </div>
                            <div className="clinic-filter">
                                {CLINIC_TYPES.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedClinic(c.id)}
                                        className={selectedClinic === c.id ? 'active' : ''}
                                        style={{ '--accent': c.color }}
                                    >
                                        {c.icon} {c.label}
                                    </button>
                                ))}
                            </div>
                        </header>

                        <div className="sched-card">
                            <table className="weekly-matrix">
                                <thead>
                                    <tr>
                                        <th style={{ width: '250px', textAlign: 'left' }}>Chrono Index</th>
                                        {DAYS_ABBR.map(d => <th key={d}>{d}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterSlots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(slot => (
                                        <tr key={slot.slot_id}>
                                            <td className="slot-id-cell">
                                                <div className="slot-l">{slot.slot_label}</div>
                                                <div className="slot-t">{fmt12(slot.start_time)} – {fmt12(slot.end_time)}</div>
                                            </td>
                                            {DAYS_ABBR.map((_, idx) => {
                                                const isActive = (slot.days_by_doctor?.[selectedClinic] || []).includes(idx);
                                                return (
                                                    <td key={idx} className="matrix-cell">
                                                        <button
                                                            onClick={() => toggleWeeklyDay(slot.slot_id, idx)}
                                                            className={`weekly-toggle ${isActive ? 'enabled' : 'disabled'}`}
                                                        >
                                                            {isActive ? <Check size={18} /> : <X size={18} />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* 2. CONFIG PANEL */}
                {view === 'config' && (
                    <section className="view-panel fadeIn">
                        <header className="panel-header">
                            <div>
                                <h1>Slot Architecture</h1>
                                <p>Master registry for clinical timing templates</p>
                            </div>
                            <button onClick={() => {
                                setEditingSlot(null);
                                setSlotForm({ slot_id: '', slot_label: '', start_time: '', end_time: '', session: 'MORNING', sort_order: 1, is_active: true });
                                setShowSlotModal(true);
                            }} className="btn-primary-lux"><Plus size={18} /> New Definition</button>
                        </header>

                        <div className="sched-card">
                            <table className="config-table">
                                <thead>
                                    <tr>
                                        <th>Sort</th>
                                        <th>Label</th>
                                        <th>Time Interval</th>
                                        <th>Session</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterSlots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(s => (
                                        <tr key={s.slot_id}>
                                            <td className="sort-box">{s.sort_order}</td>
                                            <td className="label-col">
                                                <strong>{s.slot_label}</strong>
                                                <code>{s.slot_id}</code>
                                            </td>
                                            <td>{fmt12(s.start_time)} — {fmt12(s.end_time)}</td>
                                            <td>
                                                <span className="session-pill" style={{ '--color': SESSION_MAP[s.session]?.color, '--bg': SESSION_MAP[s.session]?.bg }}>
                                                    {SESSION_MAP[s.session]?.icon} {s.session}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={`status-tag ${s.is_active ? 'active' : 'inactive'}`}>
                                                    {s.is_active ? 'ENABLED' : 'DISABLED'}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="action-stack">
                                                    <button onClick={() => {
                                                        setEditingSlot(s);
                                                        setSlotForm(s);
                                                        setShowSlotModal(true);
                                                    }} className="btn-i-edit"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteSlot(s.slot_id)} className="btn-i-trash"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* 3. DAILY OVERRIDE PANEL */}
                {view === 'daily' && (
                    <section className="view-panel fadeIn">
                        <header className="panel-header">
                            <div>
                                <h1>Precision Control Panel</h1>
                                <p>Block slots or modify schedules for specific dates</p>
                            </div>
                            <div className="daily-context">
                                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="date-input-lux" />
                                <div className="doc-pills">
                                    {doctors.map(d => (
                                        <button
                                            key={d.doctor_id}
                                            onClick={() => setSelectedDoc(d.name)}
                                            className={selectedDoc === d.name ? 'active' : ''}
                                        >
                                            <User size={16} /> {d.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </header>

                        <div className="sched-card">
                            <table className="daily-control-table">
                                <thead>
                                    <tr>
                                        <th>Time Segment</th>
                                        <th>Current Status</th>
                                        <th style={{ textAlign: 'right' }}>Precision Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyLoading ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '5rem' }}><RefreshCw className="spinning" size={32} /></td></tr>
                                    ) : (
                                        dailyGrid.map(s => (
                                            <tr key={s.slot_id}>
                                                <td className="seg-cell">
                                                    <div className="seg-l">{s.slot_label}</div>
                                                    <div className="seg-t">{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                                                </td>
                                                <td>
                                                    {s.is_booked ? (
                                                        <span className="st-booked"><CheckCircle2 size={14} /> RESERVED</span>
                                                    ) : s.blocked_by_admin ? (
                                                        <span className="st-blocked"><Shield size={14} /> BLOCKED</span>
                                                    ) : (
                                                        <span className="st-avl"><Zap size={14} /> AVAILABLE</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => handleDailyToggle(s.slot_id, s.blocked_by_admin)}
                                                        className={`btn-override ${s.blocked_by_admin ? 'unblock' : 'block'}`}
                                                        disabled={s.is_booked}
                                                    >
                                                        {s.blocked_by_admin ? 'Restore Slot' : 'Block Slot'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>

            {/* Config Modal */}
            {showSlotModal && (
                <div className="modal-overlay">
                    <div className="modal-frame">
                        <header className="modal-h">
                            <h2>{editingSlot ? 'Refine Chrono-Template' : 'Define Master Segment'}</h2>
                            <button onClick={() => setShowSlotModal(false)}><X size={24} /></button>
                        </header>
                        <form onSubmit={handleSaveSlot} className="modal-b">
                            <div className="form-g-2">
                                <div className="field-group">
                                    <label>Visual Identifier</label>
                                    <input required value={slotForm.slot_label} onChange={e => setFormState(e, 'slot_label')} placeholder="e.g. 09:00 AM" />
                                </div>
                                <div className="field-group">
                                    <label>Registry ID</label>
                                    <input required disabled={!!editingSlot} value={slotForm.slot_id} onChange={e => setFormState(e, 'slot_id')} placeholder="SLOT_0900" />
                                </div>
                                <div className="field-group">
                                    <label>Start Time</label>
                                    <input type="time" required value={slotForm.start_time} onChange={e => setFormState(e, 'start_time')} />
                                </div>
                                <div className="field-group">
                                    <label>End Time</label>
                                    <input type="time" required value={slotForm.end_time} onChange={e => setFormState(e, 'end_time')} />
                                </div>
                                <div className="field-group">
                                    <label>Clinical Session</label>
                                    <select value={slotForm.session} onChange={e => setFormState(e, 'session')}>
                                        <option value="MORNING">Morning</option>
                                        <option value="AFTERNOON">Afternoon</option>
                                        <option value="EVENING">Evening</option>
                                    </select>
                                </div>
                                <div className="field-group">
                                    <label>Sort Priority</label>
                                    <input type="number" required value={slotForm.sort_order} onChange={e => setFormState(e, 'sort_order', true)} />
                                </div>
                            </div>
                            <div className="modal-f">
                                <button type="button" onClick={() => setShowSlotModal(false)} className="btn-cancel">Abort</button>
                                <button type="submit" className="btn-save">Commit Metadata</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .sched-container { display: flex; min-height: 100vh; background: #f1f5f9; color: #1e293b; font-family: 'Inter', sans-serif; }
                
                /* Sidebar Architecture */
                .sched-sidebar { width: 320px; background: #ffffff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 2.5rem 1.5rem; position: sticky; top: 0; height: 100vh; }
                .sched-brand { display: flex; align-items: center; gap: 1rem; color: var(--primary); font-weight: 950; font-size: 1.5rem; margin-bottom: 4rem; padding-left: 1rem; }
                .sched-nav { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
                .sched-nav button {
                    display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem 1.5rem; border: none; border-radius: 20px;
                    background: transparent; color: #64748b; text-align: left; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .sched-nav button:hover { background: #f8fafc; color: #1e293b; }
                .sched-nav button.active { background: #eff6ff; color: var(--primary); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08); }
                .sched-nav button strong { display: block; font-size: 1.05rem; font-weight: 800; }
                .sched-nav button small { font-size: 0.75rem; font-weight: 600; opacity: 0.7; }
                
                .sched-meta { padding-top: 2rem; border-top: 1px solid #f1f5f9; }
                .engine-status { display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1px; }
                .pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }

                /* Main Scroll Body */
                .sched-main { flex: 1; padding: 4rem; overflow-y: auto; height: 100vh; position: relative; }
                .view-panel { max-width: 1400px; margin: 0 auto; }
                .panel-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3.5rem; }
                .panel-header h1 { font-size: 2.75rem; font-weight: 950; margin: 0; letter-spacing: -2px; color: #0f172a; }
                .panel-header p { margin: 0.6rem 0 0 0; color: #64748b; font-weight: 600; font-size: 1.2rem; }

                /* Cards & Tables */
                .sched-card { background: #ffffff; border-radius: 40px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f8fafc; padding: 1.75rem 1.5rem; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; font-weight: 850; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; }
                td { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; }

                /* 1. Weekly specific */
                .weekly-matrix th { border-left: 1px solid #f1f5f9; }
                .slot-id-cell { padding-left: 2.5rem; text-align: left; }
                .slot-l { font-weight: 900; font-size: 1.1rem; color: #0f172a; }
                .slot-t { font-size: 0.8rem; font-weight: 700; color: #64748b; margin-top: 0.2rem; }
                .weekly-toggle {
                    width: 48px; height: 48px; border-radius: 16px; border: 2.5px solid transparent;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s;
                }
                .weekly-toggle.enabled { background: #f0fdf4; color: #10b981; }
                .weekly-toggle.disabled { background: #fef2f2; color: #ef4444; border-style: dashed; border-color: #fee2e2; }
                .weekly-toggle:hover { transform: scale(1.1); }
                .clinic-filter { display: flex; gap: 0.8rem; }
                .clinic-filter button {
                    padding: 0.8rem 1.75rem; border-radius: 18px; border: 2px solid transparent;
                    background: #fff; color: #64748b; font-weight: 850; cursor: pointer; transition: 0.3s;
                    display: flex; align-items: center; gap: 0.6rem; font-size: 0.95rem;
                }
                .clinic-filter button.active { border-color: var(--accent); color: var(--accent); background: #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.04); }

                /* 2. Config specific */
                .sort-box { width: 60px; text-align: center; font-weight: 950; color: var(--primary); font-size: 1.25rem; }
                .label-col strong { display: block; font-size: 1.1rem; }
                .label-col code { font-size: 0.7rem; color: #94a3b8; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
                .session-pill { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; border-radius: 30px; background: var(--bg); color: var(--color); font-weight: 900; font-size: 0.8rem; border: 1.5px solid var(--color); }
                .status-tag { display: inline-block; font-size: 0.65rem; font-weight: 950; padding: 4px 8px; border-radius: 6px; }
                .status-tag.active { background: #dcfce7; color: #166534; }
                .status-tag.inactive { background: #fee2e2; color: #991b1b; }
                .action-stack { display: flex; gap: 0.5rem; justify-content: flex-end; }
                .btn-i-edit { padding: 0.6rem; border-radius: 12px; border: none; background: #eff6ff; color: #2563eb; cursor: pointer; }
                .btn-i-trash { padding: 0.6rem; border-radius: 12px; border: none; background: #fff1f2; color: #ef4444; cursor: pointer; }
                .btn-primary-lux { padding: 1rem 2.5rem; border-radius: 20px; border: none; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 0.8rem; box-shadow: 0 12px 24px rgba(99, 102, 241, 0.3); transition: 0.3s; }

                /* 3. Daily specific */
                .daily-context { display: flex; gap: 2rem; align-items: center; }
                .date-input-lux { padding: 1rem 1.5rem; border-radius: 18px; border: 2px solid #e2e8f0; font-weight: 800; font-family: inherit; }
                .doc-pills { display: flex; gap: 0.6rem; }
                .doc-pills button { padding: 0.8rem 1.5rem; border-radius: 18px; border: 2px solid transparent; background: #fff; color: #64748b; font-weight: 850; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; }
                .doc-pills button.active { background: #eff6ff; color: var(--primary); border-color: var(--primary); }
                .btn-override { padding: 0.6rem 1.5rem; border-radius: 14px; border: none; font-weight: 900; font-size: 0.85rem; cursor: pointer; transition: 0.3s; }
                .btn-override.block { background: #fff1f2; color: #ef4444; }
                .btn-override.unblock { background: #dcfce7; color: #15803d; }
                .st-booked { color: #2563eb; font-weight: 900; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; }
                .st-blocked { color: #ef4444; font-weight: 900; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; }
                .st-avl { color: #10b981; font-weight: 900; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; }

                /* Modal & Toast */
                .sched-toast { position: fixed; top: 2.5rem; left: 50%; transform: translateX(-50%); z-index: 10000; padding: 1.25rem 2.5rem; border-radius: 25px; display: flex; align-items: center; gap: 1rem; box-shadow: 0 30px 60px rgba(0,0,0,0.15); font-weight: 900; backdrop-filter: blur(20px); }
                .sched-toast.success { background: rgba(16, 185, 129, 0.95); color: #fff; }
                .sched-toast.error { background: rgba(239, 68, 68, 0.95); color: #fff; }

                .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.8); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 2rem; }
                .modal-frame { background: #fff; width: 100%; max-width: 800px; border-radius: 50px; overflow: hidden; box-shadow: 0 50px 100px rgba(0,0,0,0.4); }
                .modal-h { padding: 3rem 4rem; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; }
                .modal-h h2 { margin: 0; font-weight: 950; font-size: 2rem; letter-spacing: -1px; }
                .modal-b { padding: 4rem; }
                .form-g-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
                .field-group label { display: block; font-size: 0.75rem; font-weight: 950; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 1px; }
                .field-group input, .field-group select { width: 100%; padding: 1.25rem 2rem; border-radius: 20px; border: 3px solid #f1f5f9; background: #fbfbfc; font-weight: 850; outline: none; transition: 0.3s; }
                .field-group input:focus { border-color: var(--primary); background: #fff; box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.05); }
                .modal-f { display: flex; gap: 2rem; margin-top: 4rem; }
                .btn-save { flex: 2; padding: 1.5rem; border: none; border-radius: 20px; background: var(--primary); color: #fff; font-weight: 950; font-size: 1.3rem; cursor: pointer; }
                .btn-cancel { flex: 1; padding: 1.5rem; border: 3px solid #f1f5f9; border-radius: 20px; background: #fff; color: #64748b; font-weight: 850; cursor: pointer; }

                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
                .fadeIn { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );

    function setFormState(e, key, isNum = false) {
        setSlotForm({ ...slotForm, [key]: isNum ? parseInt(e.target.value) : e.target.value });
    }
};

export default Scheduling;
