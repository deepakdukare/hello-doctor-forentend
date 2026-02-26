import React, { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw, AlertCircle, Calendar as CalIcon,
    ChevronLeft, ChevronRight, ChevronDown, Filter, Settings, Shield,
    CheckCircle2, AlertTriangle, Activity, Coffee, Sun, Moon,
    Zap, LayoutGrid, Sliders, ArrowRight, User, MousePointer2, Info,
    Plus, Clock, Trash2, Check, X
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
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const Scheduling = () => {
    const [slots, setSlots] = useState([]); // Master Slot Templates
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('PULMONARY');
    const [activeScreen, setActiveScreen] = useState('overview'); // 'overview' | 'template' | 'generator'

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [kpis, setKpis] = useState({ total: 0, booked: 0, available: 0, blocked: 0 });

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
    const [manualForm, setManualForm] = useState({ slot_label: '', start_time: '', end_time: '', session: 'MORNING' });

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [slotsRes, docsRes] = await Promise.all([
                getSlotConfig(),
                getDoctors()
            ]);
            const masterSlots = (slotsRes.data.data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            setSlots(masterSlots);
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
            let tBooked = 0, tBlocked = 0, tTotal = 0;

            results.forEach((res, i) => {
                const dateStr = weekDates[i];
                (res.data?.data || []).forEach(s => {
                    if (!grid[s.slot_id]) grid[s.slot_id] = {};
                    grid[s.slot_id][dateStr] = s;
                    tTotal++;
                    if (s.is_booked) tBooked++;
                    if (s.blocked_by_admin) tBlocked++;
                });
            });
            setDailyStatusGrid(grid);
            setKpis({
                total: tTotal,
                booked: tBooked,
                blocked: tBlocked,
                available: tTotal - tBooked - tBlocked
            });
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
                sort_order: generated.length + 1,
                available_days: DAYS
            });
        }
        setPreviewSlots(generated);
    };

    const saveGeneratedSlots = async () => {
        setLoading(true);
        try {
            await Promise.all(previewSlots.map(s => createSlot(s)));
            setPreviewSlots([]);
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
            await createSlot({ ...manualForm, available_days: DAYS });
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

    const getSlotStatus = (slotId, dateStr) => {
        const cell = dailyStatusGrid[slotId]?.[dateStr];
        if (!cell) return 'Available';
        if (cell.is_booked) return 'Booked';
        if (cell.blocked_by_admin) return 'Blocked';
        return 'Available';
    };

    // Components
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
                    <div className="grid-day-header time-col"></div>
                    {DAYS_SHORT.map((day, i) => (
                        <div key={day} className="grid-day-header">
                            <div className="day-name">{day}</div>
                            <div className={`day-num ${weekDates[i] === new Date().toISOString().split('T')[0] ? 'today' : ''}`}>
                                {new Date(weekDates[i]).getDate()}
                            </div>
                        </div>
                    ))}

                    {statusLoading ? (
                        <div className="loading-grid">Synchronizing clinical data...</div>
                    ) : slots.map(slot => (
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

    const TemplateEditor = () => (
        <section className="slots-section-card">
            <div className="section-header-premium">
                <div className="header-meta">
                    <h2 className="section-title-v3">Weekly Slot Template Editor</h2>
                    <p className="section-subtitle-v3">Define recurring availability for the base clinical week</p>
                </div>
                <div className="section-actions">
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
            <header className="page-header-v3">
                <div className="title-group">
                    <div className="clinic-chip">
                        <Shield size={16} />
                        <span>Clinic Admin</span>
                    </div>
                    <h1 className="main-title-v3">Scheduling</h1>
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

            <nav className="screen-nav-v3">
                <button className={`screen-tab-v3 ${activeScreen === 'overview' ? 'active-tab' : ''}`} onClick={() => setActiveScreen('overview')}>
                    <CalIcon size={18} />
                    <span>Clinical Matrix</span>
                </button>
                <button className={`screen-tab-v3 ${activeScreen === 'template' ? 'active-tab' : ''}`} onClick={() => setActiveScreen('template')}>
                    <LayoutGrid size={18} />
                    <span>Slot Architecture</span>
                </button>
                <button className={`screen-tab-v3 ${activeScreen === 'generator' ? 'active-tab' : ''}`} onClick={() => setActiveScreen('generator')}>
                    <Zap size={18} />
                    <span>Provisioning</span>
                </button>
            </nav>

            <div className="screen-body-v3">
                {(error || success) && (
                    <div className={`alert-banner ${error ? 'error' : 'success'}`}>
                        {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                        <span>{error || success}</span>
                        <button onClick={() => { setError(null); setSuccess(null); }}>×</button>
                    </div>
                )}

                {activeScreen === 'overview' && (
                    <div className="screen-content-v3">
                        <div className="kpis-v3">
                            <div className="kpi-card-v3 kpi-blue">
                                <span className="kpi-label">Weekly Capacity</span>
                                <strong className="kpi-val">{kpis.total}</strong>
                            </div>
                            <div className="kpi-card-v3 kpi-green">
                                <span className="kpi-label">Active Bookings</span>
                                <strong className="kpi-val">{kpis.booked}</strong>
                            </div>
                            <div className="kpi-card-v3 kpi-amber">
                                <span className="kpi-label">Available Slots</span>
                                <strong className="kpi-val">{kpis.available}</strong>
                            </div>
                            <div className="kpi-card-v3 kpi-red">
                                <span className="kpi-label">Blocked/Overrides</span>
                                <strong className="kpi-val">{kpis.blocked}</strong>
                            </div>
                        </div>
                        <WeeklyOverview />
                    </div>
                )}

                {activeScreen === 'template' && <TemplateEditor />}
                {activeScreen === 'generator' && <SlotGenerator />}
            </div>

            {detailsModal.show && (
                <div className="modal-overlay-v3">
                    <div className="modal-content-v3">
                        <div className="modal-header-v3">
                            <h3>Slot Interaction Details</h3>
                            <button onClick={() => setDetailsModal({ show: false, details: null })}><X size={20} /></button>
                        </div>
                        <div className="modal-body-v3">
                            <div className="detail-row">
                                <label>Patient Name:</label>
                                <span>{detailsModal.details?.child_name || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Patient ID:</label>
                                <span>{detailsModal.details?.patient_id || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Booking Time:</label>
                                <span>{new Date(detailsModal.details?.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .scheduling-page-v3 { padding: 3rem; max-width: 1400px; margin: 0 auto; min-height: 100vh; background: #f8fafc; font-family: 'Inter', sans-serif; }
                .page-header-v3 { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .clinic-chip { display: flex; align-items: center; gap: 0.6rem; background: #fff; padding: 0.4rem 1rem; border-radius: 50px; border: 1px solid #e2e8f0; width: fit-content; margin-bottom: 1rem; }
                .clinic-chip span { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .main-title-v3 { font-size: 2.8rem; font-weight: 900; letter-spacing: -0.04em; color: #0f172a; margin: 0; }
                .screen-nav-v3 { display: flex; gap: 0.5rem; background: #fff; padding: 0.6rem; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 2.5rem; width: fit-content; }
                .screen-tab-v3 { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.75rem; border-radius: 14px; border: none; background: transparent; color: #64748b; font-weight: 700; cursor: pointer; transition: 0.2s; }
                .screen-tab-v3:hover { background: #f8fafc; color: #0f172a; }
                .screen-tab-v3.active-tab { background: #0f172a; color: #fff; }
                .screen-body-v3 { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

                .doctor-selector-v3 { background: #fff; padding: 0.5rem 1rem; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 1.5rem; }
                .cat-tab { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1.25rem; border-radius: 14px; border: none; background: transparent; color: #94a3b8; font-weight: 800; cursor: pointer; }
                .cat-tab.active { background: var(--cat-color); color: #fff; }
                .vertical-divider { width: 1px; height: 30px; background: #e2e8f0; }
                .doc-dropdown-wrap { position: relative; display: flex; align-items: center; gap: 0.75rem; min-width: 250px; }
                .doc-select-v3 { border: none; background: transparent; font-weight: 800; color: #1e293b; font-size: 0.95rem; outline: none; cursor: pointer; width: 100%; -webkit-appearance: none; }
                
                .kpis-v3 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                .kpi-card-v3 { background: #fff; padding: 1.5rem; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem; }
                .kpi-label { font-size: 0.8rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
                .kpi-val { font-size: 2.2rem; font-weight: 900; color: #0f172a; }
                .kpi-blue { border-left: 5px solid #3b82f6; }
                .kpi-green { border-left: 5px solid #10b981; }
                .kpi-amber { border-left: 5px solid #f59e0b; }
                .kpi-red { border-left: 5px solid #ef4444; }

                .slots-section-card { background: #fff; border-radius: 32px; border: 1px solid #e2e8f0; overflow: hidden; }
                .section-header-premium { padding: 2.5rem 3rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .section-title-v3 { font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0; }
                .section-subtitle-v3 { font-size: 0.9rem; color: #94a3b8; margin-top: 0.25rem; }
                
                .weekly-grid-container { padding: 2rem; overflow-x: auto; }
                .weekly-grid-v3 { display: grid; grid-template-columns: 120px repeat(7, 1fr); gap: 0.5rem; min-width: 1000px; }
                .grid-day-header { text-align: center; padding-bottom: 1rem; font-weight: 800; color: #64748b; }
                .day-num { font-size: 1.2rem; color: #1e293b; margin-top: 0.25rem; }
                .day-num.today { color: #6366f1; font-weight: 900; }
                .time-label-v3 { text-align: right; padding-right: 1.5rem; padding-top: 0.5rem; }
                .time-label-v3 strong { display: block; color: #0f172a; }
                .time-label-v3 span { font-size: 0.7rem; color: #94a3b8; }
                .slot-block-v3 { height: 50px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
                .sb-booked { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
                .sb-available { background: #f0fdf4; color: #16a34a; border-color: #dcfce7; }
                .sb-blocked { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }

                .editor-table { width: 100%; border-collapse: collapse; }
                .editor-table th, .editor-table td { padding: 1.25rem; border-bottom: 1px solid #f1f5f9; text-align: center; }
                .sticky-col { position: sticky; left: 0; background: #fff; z-index: 2; border-right: 1px solid #f1f5f9; text-align: left !important; }
                .slot-range-cell { display: flex; align-items: center; gap: 0.75rem; font-weight: 800; color: #0f172a; }
                
                .checkbox-wrap-v3 { cursor: pointer; }
                .checkbox-wrap-v3 input { display: none; }
                .checkbox-box { width: 24px; height: 24px; border: 2px solid #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: transparent; }
                .checkbox-wrap-v3 input:checked + .checkbox-box { background: #6366f1; border-color: #6366f1; color: #fff; }

                .generator-grid { display: grid; grid-template-columns: 400px 1fr; gap: 3rem; padding: 3rem; }
                .input-v3 { width: 100%; height: 48px; border-radius: 12px; border: 1px solid #e2e8f0; padding: 0 1rem; margin-top: 0.5rem; outline: none; }
                .btn-generate-v3 { width: 100%; height: 50px; background: #6366f1; color: #fff; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; margin-top: 1.5rem; }
                .preview-tags { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.5rem 0; }
                .preview-tag { background: #f1f5f9; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: #475569; }
                .preview-actions { display: flex; gap: 1rem; }
                .btn-discard { flex: 1; height: 44px; background: #f1f5f9; border: none; border-radius: 8px; cursor: pointer; }
                .btn-confirm { flex: 2; height: 44px; background: #0f172a; color: #fff; border: none; border-radius: 8px; cursor: pointer; }

                .alert-banner { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; border-radius: 16px; margin-bottom: 2rem; }
                .alert-banner.error { background: #fef2f2; color: #b91c1c; }
                .alert-banner.success { background: #f0fdf4; color: #166534; }
                .alert-banner button { margin-left: auto; background: transparent; border: none; cursor: pointer; }
            `}</style>
        </div>
    );
};

export default Scheduling;
