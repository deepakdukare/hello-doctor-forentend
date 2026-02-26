import React, { useState, useEffect, useCallback } from 'react';
import {
    Clock, Plus, Trash2, Edit2, Check, X,
    RefreshCw, AlertCircle, Lock, Unlock, Calendar as CalIcon, Grid,
    ChevronLeft, ChevronRight, ChevronDown, Filter, Settings, Shield,
    CheckCircle2, AlertTriangle, Activity, Coffee, Sun, Moon,
    Zap, LayoutGrid, Sliders, ArrowRight, User, MousePointer2, Info
} from 'lucide-react';
import {
    getSlotConfig, createSlot, deleteSlot, updateSlotConfig,
    getDailyStatus, blockSlots, unblockSlots, getDoctors
} from '../api/index';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SESSION_CONFIG = {
    MORNING: { icon: <Sun size={18} />, color: '#f59e0b', bg: '#fffbeb', label: 'Morning' },
    AFTERNOON: { icon: <Coffee size={18} />, color: '#0ea5e9', bg: '#f0f9ff', label: 'Afternoon' },
    EVENING: { icon: <Moon size={18} />, color: '#8b5cf6', bg: '#f5f3ff', label: 'Evening' }
};

const DOCTOR_CATEGORIES = [
    { id: 'PULMONARY', label: 'Pulmonary Specialist', icon: '🫁', color: '#6366f1', count: 14 },
    { id: 'NON_PULMONARY', label: 'Non-Pulmonary', icon: '🩺', color: '#0ea5e9', count: 9 },
    { id: 'VACCINATION', label: 'Vaccination Clinic', icon: '💉', color: '#10b981', count: 21 },
];

const fmt12 = (t = '') => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const Scheduling = () => {
    // ── State ────────────────────────────────────────────────────────────────
    const [slots, setSlots] = useState([]); // Master Slot Templates
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('PULMONARY');
    const [activeScreen, setActiveScreen] = useState('overview'); // 'overview' | 'template' | 'generator'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Dashboard Data
    const [kpis, setKpis] = useState({ total: 0, booked: 0, available: 0, blocked: 0 });
    const [dailyLoad, setDailyLoad] = useState([]);

    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    });

    const [dailyStatusGrid, setDailyStatusGrid] = useState({});
    const [statusLoading, setStatusLoading] = useState(false);

    // Generator State
    const [generator, setGenerator] = useState({
        start: '09:00',
        end: '12:00',
        duration: 30,
        session: 'MORNING'
    });
    const [previewSlots, setPreviewSlots] = useState([]);

    // Modals
    const [detailsModal, setDetailsModal] = useState({ show: false, details: null });
    const [showGenerator, setShowGenerator] = useState(false);
    const [manualForm, setManualForm] = useState({ slot_label: '', start_time: '', end_time: '', session: 'MORNING' });

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    // ── Data Loading ─────────────────────────────────────────────────────────
    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [slotsRes, docsRes] = await Promise.all([
                getSlotConfig(),
                getDoctors()
            ]);
            setSlots(slotsRes.data.data || []);
            const docs = docsRes.data.data || [];
            setDoctors(docs);
            if (docs.length > 0 && !selectedDoctor) {
                setSelectedDoctor(docs.find(d => d.speciality === 'Pediatrics') || docs[0]);
            }
        } catch (err) {
            setError("Failed to initialize scheduling registry.");
        } finally {
            setLoading(false);
        }
    }, [selectedDoctor]);

    const loadWeeklyStatus = useCallback(async () => {
        if (!selectedDoctor) return;
        setStatusLoading(true);
        try {
            const results = await Promise.all(
                weekDates.map(date => getDailyStatus(selectedDoctor.doctor_id, date).catch(() => ({ data: { data: [] } })))
            );
            const grid = {};
            results.forEach((res, i) => {
                const dateStr = weekDates[i];
                (res.data?.data || []).forEach(s => {
                    if (!grid[s.slot_id]) grid[s.slot_id] = {};
                    grid[s.slot_id][dateStr] = s;
                });
            });
            setDailyStatusGrid(grid);
        } catch (err) {
            setError("Live status sync failed.");
        } finally {
            setStatusLoading(false);
        }
    }, [selectedDoctor, weekStart]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        loadWeeklyStatus();
    }, [loadWeeklyStatus]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const shiftWeek = (dir) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + (dir * 7));
        setWeekStart(d.toISOString().split('T')[0]);
    };

    const handleToggleTemplateDay = async (slotId, dayIndex) => {
        const newSlots = [...slots];
        const slotIdx = newSlots.findIndex(s => s.slot_id === slotId);
        if (slotIdx === -1) return;

        const dayName = DAYS[dayIndex];
        const currentDays = newSlots[slotIdx].available_days || [];

        if (currentDays.includes(dayName)) {
            newSlots[slotIdx].available_days = currentDays.filter(d => d !== dayName);
        } else {
            newSlots[slotIdx].available_days = [...currentDays, dayName];
        }

        setSlots(newSlots);
    };

    const saveTemplate = async () => {
        setLoading(true);
        try {
            await updateSlotConfig(slots);
            setSuccess("Weekly template configuration synchronized.");
            setTimeout(() => setSuccess(null), 3000);
            loadWeeklyStatus();
        } catch (err) {
            setError("Template sync rejected by engine.");
        } finally {
            setLoading(false);
        }
    };

    const generateSlots = () => {
        const generated = [];
        let current = new Date(`2000-01-01T${generator.start}`);
        const end = new Date(`2000-01-01T${generator.end}`);

        while (current < end) {
            const startStr = current.toTimeString().slice(0, 5);
            current.setMinutes(current.getMinutes() + parseInt(generator.duration));
            const endStr = current.toTimeString().slice(0, 5);
            if (current > end) break;

            generated.push({
                slot_label: fmt12(startStr),
                start_time: startStr,
                end_time: endStr,
                session: generator.session,
                sort_order: generated.length + 1
            });
        }
        setPreviewSlots(generated);
    };

    const saveGeneratedSlots = async () => {
        setLoading(true);
        try {
            await Promise.all(previewSlots.map(s => createSlot(s)));
            setPreviewSlots([]);
            setShowGenerator(false);
            loadInitialData();
            setSuccess(`Successfully generated ${previewSlots.length} slot templates.`);
        } catch (err) {
            setError("Bulk slot generation failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleManualAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createSlot(manualForm);
            setManualForm({ slot_label: '', start_time: '', end_time: '', session: 'MORNING' });
            loadInitialData();
            setSuccess("Manual slot template added to registry.");
        } catch (err) {
            setError("Manual slot addition failed.");
        } finally {
            setLoading(false);
        }
    };

    const purgeSlot = async (id) => {
        if (!window.confirm("Purge this slot template permanently?")) return;
        try {
            await deleteSlot(id);
            setSlots(slots.filter(s => s.slot_id !== id));
            setSuccess("Slot template purged.");
        } catch (err) {
            setError("Purge request failed.");
        }
    };

    // ── Render Helpers ────────────────────────────────────────────────────────
    const getSlotStatus = (slotId, dateStr) => {
        const cell = dailyStatusGrid[slotId]?.[dateStr];
        if (!cell) return 'Available';
        if (cell.is_booked) return 'Booked';
        if (cell.blocked_by_admin) return 'Blocked';
        return 'Available';
    };

    // ── Components ───────────────────────────────────────────────────────────

    // Section 1: Weekly Booked Overview
    const WeeklyOverview = () => (
        <section className="slots-section-card">
            <div className="section-header-premium">
                <div className="header-meta">
                    <h2 className="section-title-v3">Weekly Booked Overview</h2>
                    <p className="section-subtitle-v3">Real-time clinical load and confirmed bookings</p>
                </div>
                <div className="week-nav-premium">
                    <button onClick={() => shiftWeek(-1)} className="nav-btn-v3"><ChevronLeft size={20} /></button>
                    <div className="nav-display-v3">
                        <CalIcon size={18} />
                        <span>{new Date(weekDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(weekDates[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <button onClick={() => shiftWeek(1)} className="nav-btn-v3"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="weekly-grid-container">
                <div className="weekly-grid-v3">
                    {/* Header */}
                    <div className="grid-day-header time-col"></div>
                    {DAYS_SHORT.map((day, i) => (
                        <div key={day} className="grid-day-header">
                            <div className="day-name">{day}</div>
                            <div className={`day-num ${weekDates[i] === new Date().toISOString().split('T')[0] ? 'today' : ''}`}>
                                {new Date(weekDates[i]).getDate()}
                            </div>
                        </div>
                    ))}

                    {/* Rows */}
                    {statusLoading ? (
                        <div className="loading-grid">Synchronizing clinical data...</div>
                    ) : slots.sort((a, b) => a.sort_order - b.sort_order).map(slot => (
                        <React.Fragment key={slot.slot_id}>
                            <div className="time-label-v3">
                                <strong>{fmt12(slot.start_time)}</strong>
                                <span>{slot.slot_label}</span>
                            </div>
                            {weekDates.map(date => {
                                const cell = dailyStatusGrid[slot.slot_id]?.[date];
                                const status = getSlotStatus(slot.slot_id, date);
                                return (
                                    <div key={date} className="grid-cell-v3">
                                        <div
                                            className={`slot-block-v3 sb-${status.toLowerCase()}`}
                                            onClick={() => cell?.is_booked && setDetailsModal({ show: true, details: cell })}
                                        >
                                            <div>{status.toUpperCase()}</div>
                                            {status === 'Booked' && <div className="sb-patient-v3">{cell.patient_name || 'Patient'}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="legend-row">
                <div className="legend-item"><span className="dot booked"></span> Booked</div>
                <div className="legend-item"><span className="dot available"></span> Available</div>
                <div className="legend-item"><span className="dot blocked"></span> Blocked</div>
            </div>
        </section>
    );

    // Section 2: Weekly Slot Template Editor
    const TemplateEditor = () => (
        <section className="slots-section-card">
            <div className="section-header-premium">
                <div className="header-meta">
                    <h2 className="section-title-v3">Weekly Slot Template Editor</h2>
                    <p className="section-subtitle-v3">Define recurring availability for the base clinical week</p>
                </div>
                <div className="section-actions">
                    <div className="apply-to-wrap">
                        <label>Apply To:</label>
                        <select className="apply-select">
                            <option>{selectedDoctor?.name || 'Current Doctor'}</option>
                            <option>Pulmonary Specialist</option>
                            <option>Vaccination Clinic</option>
                            <option>All Doctors</option>
                        </select>
                    </div>
                    <button onClick={saveTemplate} className="btn-save-premium">
                        <Check size={18} />
                        <span>Save Weekly Template</span>
                    </button>
                </div>
            </div>

            <div className="table-wrapper-premium">
                <table className="slots-table-v3 editor-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">Time (30m Interval)</th>
                            {DAYS_SHORT.map(day => <th key={day}>{day}</th>)}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {slots.map(slot => (
                            <tr key={slot.slot_id}>
                                <td className="sticky-col slot-range-cell">
                                    <Clock size={16} />
                                    <span>{slot.start_time} – {slot.end_time}</span>
                                </td>
                                {DAYS.map((day, idx) => (
                                    <td key={day}>
                                        <label className="checkbox-wrap-v3">
                                            <input
                                                type="checkbox"
                                                checked={slot.available_days?.includes(day)}
                                                onChange={() => handleToggleTemplateDay(slot.slot_id, idx)}
                                            />
                                            <div className="checkbox-box">
                                                <Check size={14} className="check-icon" />
                                            </div>
                                        </label>
                                    </td>
                                ))}
                                <td>
                                    <button onClick={() => purgeSlot(slot.slot_id)} className="purge-btn-v3">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );

    // Section 3: Add / Generate Time Slots
    const SlotGenerator = () => (
        <section className="slots-section-card generator-section">
            <div className="section-header-premium">
                <div className="header-meta">
                    <h2 className="section-title-v3">Add / Generate Time Slots</h2>
                    <p className="section-subtitle-v3">Rapidly expand clinical capacity with smart range tools</p>
                </div>
            </div>

            <div className="generator-grid">
                <div className="generator-controls">
                    <h4 className="control-title">Option A: Manual Slot Add</h4>
                    <form onSubmit={handleManualAdd} className="form-grid-v3" style={{ marginBottom: '2rem' }}>
                        <div className="form-group-v3">
                            <label>Slot Label</label>
                            <input type="text" placeholder="e.g. 10:00 AM" value={manualForm.slot_label} onChange={e => setManualForm({ ...manualForm, slot_label: e.target.value })} className="input-v3" required />
                        </div>
                        <div className="form-group-v3">
                            <label>Start Time</label>
                            <input type="time" value={manualForm.start_time} onChange={e => setManualForm({ ...manualForm, start_time: e.target.value })} className="input-v3" required />
                        </div>
                        <div className="form-group-v3">
                            <label>End Time</label>
                            <input type="time" value={manualForm.end_time} onChange={e => setManualForm({ ...manualForm, end_time: e.target.value })} className="input-v3" required />
                        </div>
                        <div className="form-group-v3">
                            <label>Session</label>
                            <select value={manualForm.session} onChange={e => setManualForm({ ...manualForm, session: e.target.value })} className="input-v3">
                                <option value="MORNING">Morning</option>
                                <option value="AFTERNOON">Afternoon</option>
                                <option value="EVENING">Evening</option>
                            </select>
                        </div>
                        <button type="submit" className="btn-add-manual-v3">
                            <Plus size={18} />
                            <span>Add Slot</span>
                        </button>
                    </form>

                    <h4 className="control-title">Option B: Smart Generator</h4>
                    <div className="form-grid-v3">
                        <div className="form-group-v3">
                            <label>Start Time</label>
                            <input type="time" value={generator.start} onChange={e => setGenerator({ ...generator, start: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v3">
                            <label>End Time</label>
                            <input type="time" value={generator.end} onChange={e => setGenerator({ ...generator, end: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v3">
                            <label>Step Duration</label>
                            <select value={generator.duration} onChange={e => setGenerator({ ...generator, duration: e.target.value })} className="input-v3">
                                <option value="15">15 mins</option>
                                <option value="30">30 mins</option>
                                <option value="45">45 mins</option>
                                <option value="60">60 mins</option>
                            </select>
                        </div>
                        <div className="form-group-v3">
                            <label>Session</label>
                            <select value={generator.session} onChange={e => setGenerator({ ...generator, session: e.target.value })} className="input-v3">
                                <option value="MORNING">Morning</option>
                                <option value="AFTERNOON">Afternoon</option>
                                <option value="EVENING">Evening</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={generateSlots} className="btn-generate-v3">
                        <Zap size={18} />
                        <span>Generate Slots</span>
                    </button>
                </div>

                <div className="generator-preview">
                    <div className="preview-header">
                        <h4 className="control-title">Auto Preview</h4>
                        {previewSlots.length > 0 && <span className="preview-count">{previewSlots.length} Slots</span>}
                    </div>
                    {previewSlots.length === 0 ? (
                        <div className="empty-preview">
                            <MousePointer2 size={32} />
                            <p>Configure range & click generate to preview slots</p>
                        </div>
                    ) : (
                        <div className="preview-list">
                            <div className="preview-tags">
                                {previewSlots.map((s, i) => (
                                    <div key={i} className="preview-tag">
                                        <Clock size={12} />
                                        <span>{s.start_time} – {s.end_time}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="preview-actions">
                                <button onClick={() => setPreviewSlots([])} className="btn-discard">Discard</button>
                                <button onClick={saveGeneratedSlots} className="btn-confirm">Confirm & Save</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );

    return (
        <div className="scheduling-page-v3">
            {/* Top Bar */}
            <header className="page-header-v3">
                <div className="title-group">
                    <div className="clinic-chip">
                        <Shield size={16} />
                        <span>Clinic Admin</span>
                    </div>
                    <h1 className="main-title-v3">Slot Management Dashboard</h1>
                </div>

                <div className="doctor-selector-v3">
                    <div className="category-tabs">
                        {DOCTOR_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                className={`cat-tab ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                                style={{ '--cat-color': cat.color }}
                            >
                                <span className="cat-icon">{cat.icon}</span>
                                <span className="cat-label-text">{cat.label}</span>
                                <span className="cat-count">{cat.count}</span>
                            </button>
                        ))}
                    </div>

                    <div className="vertical-divider"></div>

                    <div className="doc-dropdown-wrap">
                        <User size={18} className="dropdown-icon" />
                        <select
                            className="doc-select-v3"
                            value={selectedDoctor?.doctor_id || ''}
                            onChange={(e) => setSelectedDoctor(doctors.find(d => d.doctor_id === e.target.value))}
                        >
                            <option value="">Select Practitioner...</option>
                            <option value="indu">Dr. Indu</option>
                            <option value="rutik">Dr. Rutik</option>
                            <option value="deepak">Dr. Deepak</option>
                            <option value="krishna">Dr. Krishna</option>
                            {doctors
                                .filter(d => {
                                    if (selectedCategory === 'PULMONARY') return d.speciality?.toLowerCase().includes('pulmonary');
                                    if (selectedCategory === 'VACCINATION') return d.speciality?.toLowerCase().includes('vaccination');
                                    return !d.speciality?.toLowerCase().includes('pulmonary') && !d.speciality?.toLowerCase().includes('vaccination');
                                })
                                .map(doc => (
                                    <option key={doc.doctor_id} value={doc.doctor_id}>
                                        {doc.name} ({doc.doctor_id})
                                    </option>
                                ))
                            }
                        </select>
                        <ChevronDown size={14} className="prac-arrow" />
                    </div>
                </div>
            </header>

            {/* Screen Navigation Tabs */}
            <nav className="screen-nav-v3">
                <button
                    className={`screen-tab-v3 ${activeScreen === 'overview' ? 'active-tab' : ''}`}
                    onClick={() => setActiveScreen('overview')}
                >
                    <CalIcon size={18} />
                    <span>Weekly Booked Overview</span>
                    {activeScreen === 'overview' && <span className="tab-indicator"></span>}
                </button>
                <button
                    className={`screen-tab-v3 ${activeScreen === 'template' ? 'active-tab' : ''}`}
                    onClick={() => setActiveScreen('template')}
                >
                    <LayoutGrid size={18} />
                    <span>Weekly Slot Template Editor</span>
                    {activeScreen === 'template' && <span className="tab-indicator"></span>}
                </button>
                <button
                    className={`screen-tab-v3 ${activeScreen === 'generator' ? 'active-tab' : ''}`}
                    onClick={() => setActiveScreen('generator')}
                >
                    <Zap size={18} />
                    <span>Add / Generate Time Slots</span>
                    {activeScreen === 'generator' && <span className="tab-indicator"></span>}
                </button>
            </nav>

            {/* Active Screen */}
            <div className="screen-body-v3">
                {activeScreen === 'overview' && (
                    <div className="screen-content-v3">
                        {/* KPI Row — shown only on overview */}
                        <div className="kpi-row-v3">
                            <div className="kpi-card-v3 kpi-blue">
                                <div className="kpi-label">Total Slots (Week)</div>
                                <div className="kpi-val">{kpis.total || 44}</div>
                                <div className="kpi-sub"><span className="kpi-trend trend-up">↑ 8%</span> vs last week</div>
                            </div>
                            <div className="kpi-card-v3 kpi-green">
                                <div className="kpi-label">Confirmed Bookings</div>
                                <div className="kpi-val">{kpis.booked || 29}</div>
                                <div className="kpi-sub"><span className="kpi-trend trend-up">↑ 12%</span> utilisation rate</div>
                            </div>
                            <div className="kpi-card-v3 kpi-amber">
                                <div className="kpi-label">Available Slots</div>
                                <div className="kpi-val">{kpis.available || 11}</div>
                                <div className="kpi-sub"><span className="kpi-trend trend-down">↓ 3</span> from yesterday</div>
                            </div>
                            <div className="kpi-card-v3 kpi-red">
                                <div className="kpi-label">Blocked / Overrides</div>
                                <div className="kpi-val">{kpis.blocked || 4}</div>
                                <div className="kpi-sub">Custom daily overrides</div>
                            </div>
                        </div>

                        <WeeklyOverview />

                        <div className="bottom-row-v3">
                            <div className="panel-v3">
                                <div className="panel-header-v3">
                                    <div>
                                        <div className="panel-title-v3">Daily Load Distribution</div>
                                        <div className="panel-sub-v3">Booked vs available slots per day this week</div>
                                    </div>
                                    <div className="chart-legend-v3">
                                        <div className="legend-dot-v3"><div className="ld-v3 ld-blue-v3"></div> Booked</div>
                                        <div className="legend-dot-v3"><div className="ld-v3 ld-green-v3"></div> Today</div>
                                        <div className="legend-dot-v3"><div className="ld-v3 ld-gray-v3"></div> Available</div>
                                    </div>
                                </div>
                                <div className="bar-chart-v3">
                                    {DAYS_SHORT.map((day, idx) => (
                                        <div key={day} className={`bar-col-v3 ${weekDates[idx] === new Date().toISOString().split('T')[0] ? 'bar-today-v3' : ''}`}>
                                            <div className="bar-val-v3">{Math.floor(Math.random() * 5 + 3)}/10</div>
                                            <div className="bar-wrap-v3">
                                                <div className="bar-v3 bar-gray-v3" style={{ height: '30%' }}></div>
                                                <div className="bar-v3 bar-blue-v3" style={{ height: '70%' }}></div>
                                            </div>
                                            <div className="bar-label-v3">{day}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="panel-v3">
                                <div className="panel-title-v3">Today's Hotlist</div>
                                <div className="panel-sub-v3">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — All Sessions</div>
                                <div className="hotlist-v3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="hot-row-v3">
                                            <div className="hot-time-v3">09:00 AM</div>
                                            <div className="hot-info-v3">
                                                <div className="hot-name-v3">{i % 2 === 0 ? 'Aryan M.' : 'Open Slot'}</div>
                                                <div className="hot-detail-v3">Morning · 09:00–09:30</div>
                                            </div>
                                            <div className={`hot-badge-v3 ${i % 2 === 0 ? 'bg-booked-v3' : 'bg-avail-v3'}`}>
                                                {i % 2 === 0 ? 'Booked' : 'Available'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeScreen === 'template' && (
                    <div className="screen-content-v3">
                        <TemplateEditor />
                    </div>
                )}

                {activeScreen === 'generator' && (
                    <div className="screen-content-v3">
                        <SlotGenerator />
                    </div>
                )}
            </div>

            {/* Booked Slot Details Modal */}
            {
                detailsModal.show && (
                    <div className="modal-overlay-premium" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="modal-content-premium" style={{ width: '450px', borderRadius: '32px' }}>
                            <div className="modal-header-v3" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)', padding: '2.5rem', color: '#fff', borderRadius: '32px 32px 0 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '16px' }}>
                                        <Info size={28} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Booking Details</h3>
                                        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Entry ID: {detailsModal.details?._id?.slice(-8)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setDetailsModal({ show: false, details: null })} style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.5, cursor: 'pointer' }}><X size={24} /></button>
                            </div>
                            <div style={{ padding: '2.5rem', background: '#fff', borderRadius: '0 0 32px 32px' }}>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <label>Patient ID</label>
                                        <strong>{detailsModal.details?.status?.patient_id || 'REGISTERED'}</strong>
                                    </div>
                                    <div className="detail-item">
                                        <label>Status</label>
                                        <div className="status-pill active">CONFIRMED</div>
                                    </div>
                                    <div className="detail-item">
                                        <label>Session</label>
                                        <strong>{detailsModal.details?.session || 'MORNING'}</strong>
                                    </div>
                                    <div className="detail-item">
                                        <label>Registry Lock</label>
                                        <strong>{detailsModal.details?.locked_for_booking ? 'LOCKED' : 'OPEN'}</strong>
                                    </div>
                                </div>
                                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => setDetailsModal({ show: false, details: null })} className="btn-modal-close">Close Details</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
                .scheduling-page-v3 { padding: 3rem; max-width: 1400px; margin: 0 auto; min-height: 100vh; background: #f8fafc; }
                
                .page-header-v3 { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4rem; }
                .clinic-chip { display: flex; align-items: center; gap: 0.6rem; background: #fff; padding: 0.4rem 1rem; border-radius: 50px; border: 1px solid #e2e8f0; width: fit-content; margin-bottom: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .clinic-chip span { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .main-title-v3 { font-size: 2.8rem; font-weight: 900; letter-spacing: -0.04em; color: #0f172a; margin: 0; }
                
                .doctor-selector-v3 { background: #fff; padding: 0.5rem 1rem; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.03); display: flex; align-items: center; gap: 1.5rem; }
                .category-tabs { display: flex; gap: 0.5rem; }
                .cat-tab { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1.25rem; border-radius: 14px; border: none; background: transparent; color: #94a3b8; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; white-space: nowrap; }
                .cat-tab.active { background: var(--cat-color); color: #fff; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
                .cat-icon { font-size: 1.2rem; }
                .cat-count { background: rgba(0,0,0,0.1); padding: 0.1rem 0.5rem; border-radius: 8px; font-size: 0.75rem; }
                .cat-tab.active .cat-count { background: rgba(255,255,255,0.2); }
                
                .vertical-divider { width: 1px; height: 30px; background: #e2e8f0; }
                .doc-dropdown-wrap { position: relative; display: flex; align-items: center; gap: 0.75rem; min-width: 250px; }
                .dropdown-icon { color: #64748b; }
                .doc-select-v3 { border: none; background: transparent; font-weight: 800; color: #1e293b; font-size: 0.95rem; outline: none; cursor: pointer; width: 100%; -webkit-appearance: none; padding-right: 2rem; }
                .prac-arrow { position: absolute; right: 0; color: #94a3b8; pointer-events: none; }

                /* KPI Row */
                .kpi-row-v3 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                .kpi-card-v3 { background: #fff; padding: 1.5rem; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                .kpi-label { font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.75rem; }
                .kpi-val { font-size: 2.2rem; font-weight: 900; color: #0f172a; margin-bottom: 0.5rem; }
                .kpi-sub { font-size: 0.85rem; font-weight: 600; color: #94a3b8; }
                .kpi-trend { font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 6px; }
                .trend-up { color: #10b981; background: #f0fdf4; }
                .trend-down { color: #ef4444; background: #fef2f2; }
                .kpi-blue { border-left: 5px solid #3b82f6; }
                .kpi-green { border-left: 5px solid #10b981; }
                .kpi-amber { border-left: 5px solid #f59e0b; }
                .kpi-red { border-left: 5px solid #ef4444; }

                .dashboard-grid-v3 { display: grid; gap: 2.5rem; }
                .bottom-row-v3 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2.5rem; }
                .panel-v3 { background: #fff; padding: 2rem; border-radius: 32px; border: 1px solid #e2e8f0; }
                .panel-header-v3 { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .panel-title-v3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
                .panel-sub-v3 { font-size: 0.9rem; color: #64748b; font-weight: 500; margin-top: 0.25rem; }
                
                .chart-legend-v3 { display: flex; gap: 1rem; }
                .legend-dot-v3 { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; font-weight: 700; color: #64748b; }
                .ld-v3 { width: 10px; height: 10px; border-radius: 3px; }
                .ld-blue-v3 { background: #3b82f6; }
                .ld-green-v3 { background: #10b981; }
                .ld-gray-v3 { background: #e2e8f0; }

                .bar-chart-v3 { display: flex; justify-content: space-between; align-items: flex-end; height: 180px; padding-top: 1rem; }
                .bar-col-v3 { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; flex: 1; }
                .bar-val-v3 { font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
                .bar-wrap-v3 { width: 40px; height: 120px; background: #f8fafc; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column-reverse; }
                .bar-v3 { width: 100%; transition: 0.5s ease-out; }
                .bar-blue-v3 { background: #3b82f6; border-top: 1px solid rgba(255,255,255,0.2); }
                .bar-gray-v3 { background: #e2e8f0; }
                .bar-label-v3 { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
                .bar-today-v3 .bar-wrap-v3 { border: 2px solid #10b981; box-shadow: 0 0 15px rgba(16,185,129,0.1); }

                .hotlist-v3 { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
                .hot-row-v3 { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9; }
                .hot-time-v3 { font-weight: 800; color: #4338ca; font-size: 0.85rem; width: 70px; }
                .hot-info-v3 { flex: 1; }
                .hot-name-v3 { font-weight: 800; color: #0f172a; font-size: 0.95rem; }
                .hot-detail-v3 { font-size: 0.75rem; color: #64748b; font-weight: 600; margin-top: 0.1rem; }
                .hot-badge-v3 { padding: 0.4rem 0.75rem; border-radius: 10px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .bg-booked-v3 { background: #fee2e2; color: #ef4444; }
                .bg-avail-v3 { background: #f0fdf4; color: #16a34a; }

                .sections-stack-v3 { display: grid; gap: 3.5rem; margin-top: 3.5rem; }
                .slots-section-card { background: #fff; border-radius: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 30px rgba(0,0,0,0.03); overflow: hidden; }
                
                .weekly-grid-container { padding: 2rem; overflow-x: auto; }
                .weekly-grid-v3 { display: grid; grid-template-columns: 100px repeat(7, 1fr); gap: 0.5rem; min-width: 900px; }
                .grid-day-header { text-align: center; padding-bottom: 1.5rem; border-bottom: 2px solid #f8fafc; }
                .day-name { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .day-num { font-size: 1.4rem; font-weight: 900; color: #1e293b; margin-top: 0.25rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin: 0.25rem auto 0; }
                .day-num.today { background: #6366f1; color: #fff; border-radius: 12px; box-shadow: 0 8px 16px rgba(99,102,241,0.25); }
                
                .time-label-v3 { display: flex; align-items: center; justify-content: flex-end; padding-right: 1.5rem; font-weight: 800; color: #64748b; font-size: 0.85rem; border-right: 2px solid #f8fafc; }
                .grid-cell-v3 { padding: 0.25rem; }
                .slot-block-v3 { height: 50px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
                .sb-booked { background: #fee2e2; color: #ef4444; border: 1.5px solid #fecaca; }
                .sb-available { background: #f0fdf4; color: #16a34a; border: 1.5px solid #dcfce7; }
                .sb-blocked { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }
                .sb-patient-v3 { font-size: 0.65rem; opacity: 0.8; margin-top: 0.1rem; }
                .slot-block-v3:hover { transform: scale(1.02); filter: brightness(0.98); }

                .week-range-v3 { display: flex; align-items: center; gap: 1.5rem; background: #f8fafc; padding: 0.5rem 1rem; border-radius: 16px; border: 1px solid #e2e8f0; }
                .week-nav-v3 { border: none; background: transparent; color: #64748b; cursor: pointer; display: flex; align-items: center; }
                .week-label-v3 { font-weight: 800; color: #0f172a; font-size: 0.95rem; }
                
                .section-header-premium { padding: 2.5rem 3rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .section-title-v3 { font-size: 1.6rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
                .section-subtitle-v3 { font-size: 0.95rem; color: #94a3b8; margin: 0.4rem 0 0 0; font-weight: 500; }

                .week-nav-premium { display: flex; align-items: center; background: #f8fafc; padding: 0.5rem; border-radius: 18px; gap: 0.5rem; border: 1px solid #e2e8f0; }
                .nav-btn-v3 { width: 40px; height: 40px; border-radius: 12px; border: none; background: #fff; display: flex; align-items: center; justify-content: center; color: #6366f1; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .nav-btn-v3:hover { transform: scale(1.1); background: #6366f1; color: #fff; }
                .nav-display-v3 { padding: 0 1.5rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; }

                .btn-save-premium { background: #0f172a; color: #fff; padding: 0.85rem 1.75rem; border-radius: 16px; border: none; font-weight: 800; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                .btn-save-premium:hover { transform: translateY(-2px); filter: brightness(1.2); }

                .table-wrapper-premium { padding: 0; overflow-x: auto; }
                .slots-table-v3 { width: 100%; border-collapse: separate; border-spacing: 0; }
                .slots-table-v3 th { padding: 1.5rem; background: #fdfdff; border-bottom: 1px solid #f1f5f9; text-align: center; }
                .slots-table-v3 th.sticky-col { position: sticky; left: 0; z-index: 5; background: #fdfdff; text-align: left; border-right: 1px solid #f1f5f9; }
                .day-label { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                .date-label { font-size: 1.4rem; font-weight: 900; color: #0f172a; margin-top: 0.25rem; }
                .is-today { background: #f5f8ff !important; position: relative; }
                .is-today::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #6366f1; border-radius: 0 0 4px 4px; }

                .slots-table-v3 td { padding: 1.25rem; border-bottom: 1px solid #f8fafc; text-align: center; }
                .slots-table-v3 td.sticky-col { position: sticky; left: 0; z-index: 5; background: #fff; border-right: 1px solid #f1f5f9; text-align: left; }
                
                .slot-time-cell strong { display: block; font-size: 1.1rem; font-weight: 900; color: #0f172a; }
                .slot-time-cell span { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }

                .status-chip-v3 { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border-radius: 12px; font-weight: 900; font-size: 0.7rem; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: 0.2s; }
                .status-chip-v3.booked { background: #fef2f2; color: #ef4444; border: 1.5px solid #fee2e2; }
                .status-chip-v3.available { background: #f0fdf4; color: #10b981; border: 1.5px solid #dcfce7; }
                .status-chip-v3.blocked { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }

                .legend-row { padding: 1.5rem 3rem; display: flex; gap: 2.5rem; background: #fdfdff; }
                .legend-item { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; font-weight: 700; color: #64748b; }
                .dot { width: 10px; height: 10px; border-radius: 3px; }
                .dot.booked { background: #ef4444; }
                .dot.available { background: #10b981; }
                .dot.blocked { background: #64748b; }
                .dot.modified { background: #f59e0b; }

                /* Editor Checkbox Styles */
                .checkbox-wrap-v3 { cursor: pointer; display: flex; justify-content: center; align-items: center; }
                .checkbox-wrap-v3 input { display: none; }
                .checkbox-box { width: 28px; height: 28px; border-radius: 8px; border: 2.5px solid #e2e8f0; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: transparent; }
                .checkbox-wrap-v3 input:checked + .checkbox-box { background: #6366f1; border-color: #6366f1; color: #fff; transform: scale(1.1); box-shadow: 0 4px 10px rgba(99,102,241,0.3); }

                /* Generator Section */
                .generator-grid { display: grid; grid-template-columns: 450px 1fr; gap: 3rem; padding: 3rem; }
                .control-title { font-size: 1.1rem; font-weight: 900; color: #0f172a; margin: 0 0 1.5rem 0; text-transform: uppercase; letter-spacing: 0.05em; border-left: 4px solid #6366f1; padding-left: 1rem; }
                .input-v3 { width: 100%; height: 52px; border-radius: 14px; border: 2px solid #f1f5f9; background: #f8fafc; padding: 0 1.25rem; font-weight: 700; font-size: 0.95rem; outline: none; transition: 0.2s; }
                .input-v3:focus { border-color: #6366f1; background: #fff; }
                .btn-generate-v3 { width: 100%; margin-top: 1rem; height: 56px; border-radius: 16px; border: none; background: #6366f1; color: #fff; font-weight: 800; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 20px rgba(99,102,241,0.2); }
                .btn-add-manual-v3 { width: 100%; grid-column: span 2; margin-top: 1rem; height: 52px; border-radius: 14px; border: 2px solid #e2e8f0; background: #fff; color: #0f172a; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; transition: 0.2s; }
                .btn-add-manual-v3:hover { background: #f8fafc; border-color: #6366f1; }
                
                .apply-to-wrap { display: flex; align-items: center; gap: 1rem; background: #f1f5f9; padding: 0.5rem 1.25rem; border-radius: 16px; margin-right: 1.5rem; }
                .apply-to-wrap label { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
                .apply-select { border: none; background: transparent; font-weight: 800; color: #0f172a; outline: none; cursor: pointer; }

                .empty-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #cbd5e1; border: 2px dashed #f1f5f9; border-radius: 20px; text-align: center; padding: 2rem; }
                .empty-preview p { font-weight: 700; font-size: 0.9rem; margin-top: 1rem; }
                
                .preview-list { display: flex; flex-direction: column; gap: 2rem; }
                .preview-tags { display: flex; flex-wrap: wrap; gap: 0.75rem; }
                .preview-tag { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem; background: #f5f8ff; border: 1px solid #dbeafe; border-radius: 12px; font-weight: 800; font-size: 0.85rem; color: #2563eb; }
                .preview-actions { display: flex; gap: 1rem; margin-top: auto; }
                .btn-discard { flex: 1; height: 50px; border-radius: 12px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; cursor: pointer; }
                .btn-confirm { flex: 2; height: 50px; border-radius: 12px; border: none; background: #0f172a; color: #fff; font-weight: 800; cursor: pointer; }

                .purge-btn-v3 { width: 40px; height: 40px; border-radius: 10px; border: none; background: #fef2f2; color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
                .purge-btn-v3:hover { background: #ef4444; color: #fff; transform: scale(1.1); }

                .alert-banner { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 2rem; border-radius: 20px; font-weight: 700; margin-bottom: 2.5rem; position: relative; box-shadow: 0 10px 20px rgba(0,0,0,0.03); }
                .alert-banner.error { background: #fef2f2; color: #b91c1c; border-left: 6px solid #ef4444; }
                .alert-banner.success { background: #f0fdf4; color: #166534; border-left: 6px solid #22c55e; }
                .alert-banner button { margin-left: auto; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.5; }

                .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                .detail-item label { display: block; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5rem; }
                .detail-item strong { font-size: 1.1rem; font-weight: 900; color: #0f172a; }
                .btn-modal-close { width: 100%; height: 56px; border-radius: 16px; border: none; background: #f1f5f9; color: #64748b; font-weight: 800; font-size: 1rem; cursor: pointer; }

                @media (max-width: 1200px) {
                    .generator-grid { grid-template-columns: 1fr; }
                    .page-header-v3 { flex-direction: column; align-items: flex-start; gap: 2rem; }
                    .doctor-selector-v3 { width: 100%; }
                }
            `}</style>
        </div >
    );
};

export default Scheduling;
