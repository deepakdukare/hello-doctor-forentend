import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    Check,
    Clock3,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';
import {
    createSlot,
    deleteSlot,
    getDailyStatus,
    getDoctors,
    getSlotConfig,
    updateDailySlot,
    updateDoctor,
} from '../api/index';

const TABS = { MASTER: 'master', WEEKLY: 'weekly', DAILY: 'daily' };
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NUMS = [0, 1, 2, 3, 4, 5, 6];
const SESSION_ORDER = { MORNING: 1, AFTERNOON: 2, EVENING: 3 };

const toIsoDate = (date) => date.toISOString().split('T')[0];
const getSunday = (seed = new Date()) => {
    const d = new Date(seed);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
};

const getDoctorDisplayName = (doc) => {
    if (!doc) return '';
    const name = doc.full_name || doc.name || doc.doctor_name || doc.doctor_id || '';
    const spec = doc.speciality || doc.specialization;
    return spec ? `${name} (${spec})` : name;
};

const formatTime12h = (time) => {
    if (!time) return '--:--';
    const [h, m] = String(time).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const formatDayHeading = (dateStr) => {
    const date = new Date(dateStr);
    return {
        dow: DAY_NAMES[date.getDay()],
        dm: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
};

const slotSorter = (a, b) => {
    const sa = SESSION_ORDER[a.session] || 99;
    const sb = SESSION_ORDER[b.session] || 99;
    if (sa !== sb) return sa - sb;
    const oa = Number(a.sort_order || 0);
    const ob = Number(b.sort_order || 0);
    if (oa !== ob) return oa - ob;
    return String(a.start_time || '').localeCompare(String(b.start_time || ''));
};

const parseRange = (timeRange = '') => {
    const [start = '', end = ''] = String(timeRange).split('-').map((t) => t.trim());
    return { start_time: start, end_time: end };
};

const normalizeSlotConfigResponse = (raw = []) => {
    if (!Array.isArray(raw) || raw.length === 0) return { templates: [], uniqueSlots: [] };

    const groupedShape = Array.isArray(raw[0]?.slots);
    if (!groupedShape) return { templates: [], uniqueSlots: raw };

    const templates = raw.map((group) => ({
        name: group.name || 'Unknown',
        is_doctor: !!group.is_doctor,
        slot_count: Number(group.slot_count || (group.slots || []).length),
        slots: (group.slots || []).map((s, idx) => {
            const parsed = parseRange(s.time);
            return {
                slot_id: s.slot_id,
                slot_label: s.label,
                display_label: s.label,
                session: s.session,
                start_time: parsed.start_time,
                end_time: parsed.end_time,
                sort_order: idx + 1,
                is_active: true,
                active_days: s.active_days || [],
            };
        }),
    }));

    const slotMap = new Map();
    templates.forEach((t) => {
        t.slots.forEach((s) => {
            if (!slotMap.has(s.slot_id)) {
                slotMap.set(s.slot_id, {
                    slot_id: s.slot_id,
                    slot_label: s.slot_label,
                    display_label: s.display_label,
                    session: s.session,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    sort_order: s.sort_order,
                    is_active: true,
                    days_of_week: s.active_days,
                    days_by_doctor: {},
                });
            }
        });
    });

    return { templates, uniqueSlots: [...slotMap.values()] };
};

const Scheduling = () => {
    const [activeTab, setActiveTab] = useState(TABS.MASTER);
    const [slots, setSlots] = useState([]);
    const [slotTemplates, setSlotTemplates] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [masterFilter, setMasterFilter] = useState('ALL');
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({
        slot_label: '',
        start_time: '',
        end_time: '',
        session: 'MORNING',
        sort_order: 0,
    });

    const [weekStart, setWeekStart] = useState(() => toIsoDate(getSunday(new Date())));
    const [dailyGrid, setDailyGrid] = useState({});
    const [weeklyDirty, setWeeklyDirty] = useState(false);

    const selectedDoctor = useMemo(
        () => doctors.find((d) => d.doctor_id === selectedDoctorId) || null,
        [doctors, selectedDoctorId]
    );
    const selectedDoctorName = getDoctorDisplayName(selectedDoctor);

    const weekDates = useMemo(() => {
        const base = new Date(weekStart);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            return toIsoDate(d);
        });
    }, [weekStart]);

    const groupedSlots = useMemo(() => {
        const sorted = [...slots].sort(slotSorter);
        return {
            MORNING: sorted.filter((s) => s.session === 'MORNING'),
            AFTERNOON: sorted.filter((s) => s.session === 'AFTERNOON'),
            EVENING: sorted.filter((s) => s.session === 'EVENING'),
        };
    }, [slots]);

    const loadBase = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [slotRes, docRes] = await Promise.all([getSlotConfig(), getDoctors()]);
            const rawSlotData = slotRes.data?.data || [];
            const normalized = normalizeSlotConfigResponse(rawSlotData);
            let docData = docRes.data?.data || [];

            // Build days_by_doctor from each doctor's available_slots profile.
            // available_slots format: { "0": ["S1","S2"], "1": ["S1"] } (day index → slot IDs)
            const daysByDoctor = {}; // { slotId: { doctorName: [dayNums] } }
            docData.forEach((doc) => {
                const docName = getDoctorDisplayName(doc);
                const avail = doc.available_slots || {};
                Object.entries(avail).forEach(([dayStr, slotIds]) => {
                    const dayNum = Number(dayStr);
                    (slotIds || []).forEach((slotId) => {
                        if (!daysByDoctor[slotId]) daysByDoctor[slotId] = {};
                        if (!daysByDoctor[slotId][docName]) daysByDoctor[slotId][docName] = [];
                        if (!daysByDoctor[slotId][docName].includes(dayNum)) {
                            daysByDoctor[slotId][docName].push(dayNum);
                        }
                    });
                });
            });

            const slotData = (normalized.uniqueSlots || []).sort(slotSorter).map((slot) => ({
                ...slot,
                days_by_doctor: daysByDoctor[slot.slot_id] || slot.days_by_doctor || {},
            }));

            docData = (docData || []).sort((a, b) => {
                const nameA = (a.name || a.full_name || '').toLowerCase();
                const nameB = (b.name || b.full_name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            setSlots(slotData);
            setSlotTemplates(normalized.templates || []);
            setDoctors(docData);
            if (!selectedDoctorId && docData.length) setSelectedDoctorId(docData[0].doctor_id);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load scheduling data.');
        } finally {
            setLoading(false);
        }
    }, [selectedDoctorId]);

    const loadDailyGrid = useCallback(async () => {
        if (!selectedDoctor) return;
        setSyncing(true);
        setError('');
        try {
            const results = await Promise.all(
                weekDates.map((date) =>
                    getDailyStatus(selectedDoctorName || selectedDoctor.doctor_id, date, {
                        doctor_id: selectedDoctor.doctor_id,
                    }).catch(() => ({ data: { data: [] } }))
                )
            );
            const grid = {};
            results.forEach((res, idx) => {
                const date = weekDates[idx];
                (res.data?.data || []).forEach((cell) => {
                    if (!grid[cell.slot_id]) grid[cell.slot_id] = {};
                    grid[cell.slot_id][date] = cell;
                });
            });
            setDailyGrid(grid);
        } catch {
            setError('Unable to sync daily availability grid.');
        } finally {
            setSyncing(false);
        }
    }, [selectedDoctor, selectedDoctorName, weekDates]);

    useEffect(() => {
        loadBase();
    }, [loadBase]);

    useEffect(() => {
        if (activeTab === TABS.DAILY && selectedDoctor) loadDailyGrid();
    }, [activeTab, selectedDoctor, weekStart, loadDailyGrid]);

    const withToast = (msg) => {
        setSuccess(msg);
        window.setTimeout(() => setSuccess(''), 2200);
    };

    const handleCreateSlot = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await createSlot({
                slot_label: addForm.slot_label,
                start_time: addForm.start_time,
                end_time: addForm.end_time,
                session: addForm.session,
                sort_order: Number(addForm.sort_order || 0),
            });
            setAddForm({ slot_label: '', start_time: '', end_time: '', session: 'MORNING', sort_order: 0 });
            setShowAdd(false);
            await loadBase();
            withToast('Slot added successfully.');
        } catch (e2) {
            setError(e2.response?.data?.message || 'Failed to create slot.');
        }
    };

    const handleDeleteSlot = async (slotId) => {
        if (!window.confirm('Delete this slot template?')) return;
        setError('');
        try {
            await deleteSlot(slotId);
            setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
            withToast('Slot deleted.');
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to delete slot.');
        }
    };

    const isDayChecked = (slot, dayNum) => {
        const byDoctor = slot.days_by_doctor || {};
        const doctorDays = selectedDoctorName ? byDoctor[selectedDoctorName] : null;
        const fallback = slot.days_of_week || [];
        const arr = Array.isArray(doctorDays) ? doctorDays : fallback;
        return arr.includes(dayNum);
    };

    const toggleWeekDay = (slotId, dayNum) => {
        setSlots((prev) =>
            prev.map((slot) => {
                if (slot.slot_id !== slotId) return slot;
                const byDoctor = { ...(slot.days_by_doctor || {}) };
                const current = Array.isArray(byDoctor[selectedDoctorName])
                    ? [...byDoctor[selectedDoctorName]]
                    : [...(slot.days_of_week || [])];
                const next = current.includes(dayNum)
                    ? current.filter((d) => d !== dayNum)
                    : [...current, dayNum].sort((a, b) => a - b);
                byDoctor[selectedDoctorName] = next;
                return { ...slot, days_by_doctor: byDoctor };
            })
        );
        setWeeklyDirty(true);
    };

    const toggleAllDays = (slotId) => {
        const slot = slots.find((s) => s.slot_id === slotId);
        if (!slot) return;
        const allOn = DAY_NUMS.every((d) => isDayChecked(slot, d));
        setSlots((prev) =>
            prev.map((s) => {
                if (s.slot_id !== slotId) return s;
                const byDoctor = { ...(s.days_by_doctor || {}) };
                byDoctor[selectedDoctorName] = allOn ? [] : [...DAY_NUMS];
                return { ...s, days_by_doctor: byDoctor };
            })
        );
        setWeeklyDirty(true);
    };

    const saveWeeklyTemplate = async () => {
        if (!selectedDoctor) return;
        setError('');
        try {
            // Build available_slots: { "dayNum": ["S1", "S2", ...] } for the selected doctor
            const availableSlots = {};
            slots.forEach((slot) => {
                const byDoctor = slot.days_by_doctor || {};
                const days = Array.isArray(byDoctor[selectedDoctorName])
                    ? byDoctor[selectedDoctorName]
                    : (slot.days_of_week || []);
                days.forEach((dayNum) => {
                    const key = String(dayNum);
                    if (!availableSlots[key]) availableSlots[key] = [];
                    availableSlots[key].push(slot.slot_id);
                });
            });
            await updateDoctor(selectedDoctor.doctor_id, { available_slots: availableSlots });
            setWeeklyDirty(false);
            withToast('Weekly template updated.');
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save weekly template.');
        }
    };

    const resetWeeklyTemplate = async () => {
        await loadBase();
        setWeeklyDirty(false);
    };

    const shiftWeek = (delta) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + delta * 7);
        setWeekStart(toIsoDate(getSunday(d)));
    };

    const getCellState = (slotId, date) => {
        const cell = dailyGrid[slotId]?.[date];
        if (!cell) return { label: '--', cls: 'off', clickable: false };
        if (cell.is_booked) return { label: 'Booked', cls: 'booked', clickable: false };
        if (cell.blocked_by_admin) return { label: 'Blocked', cls: 'blocked', clickable: true, action: 'unblock' };
        return { label: 'Free', cls: 'free', clickable: true, action: 'block' };
    };

    const handleDailyCellClick = async (slotId, date) => {
        if (!selectedDoctor) return;
        const state = getCellState(slotId, date);
        if (!state.clickable) return;
        setError('');
        try {
            await updateDailySlot({
                slot_id: slotId,
                date,
                action: state.action,
                doctor_id: selectedDoctor.doctor_id,
                doctor_name: selectedDoctorName,
            });
            await loadDailyGrid();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to update daily slot status.');
        }
    };

    const renderSessionTables = (mode) => {
        if (mode === 'master' && slotTemplates.length > 0) {
            const filtered = masterFilter === 'ALL'
                ? slotTemplates
                : slotTemplates.filter((t) => t.name === masterFilter);

            return filtered.map((template) => (
                <div key={template.name} className="sch-card">
                    <div className="sch-section-title" style={{ color: template.is_doctor ? '#4f46e5' : '#64748b' }}>
                        <span className="sch-dot" style={{ background: template.is_doctor ? '#4f46e5' : '#94a3b8' }} />
                        {template.name} - {template.slot_count} SLOTS
                    </div>
                    <table className="sch-table">
                        <thead>
                            <tr>
                                <th>SLOT ID</th>
                                <th>LABEL</th>
                                <th>TIME</th>
                                <th>SESSION</th>
                                <th>ACTIVE DAYS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {template.slots.map((slot) => (
                                <tr key={`${template.name}-${slot.slot_id}`}>
                                    <td className="mono">{slot.slot_id}</td>
                                    <td>{slot.display_label || slot.slot_label}</td>
                                    <td>{formatTime12h(slot.start_time)} - {formatTime12h(slot.end_time)}</td>
                                    <td>{slot.session || 'N/A'}</td>
                                    <td>{(slot.active_days || []).map((d) => DAY_NAMES[d] || d).join(', ') || '-'}</td>
                                    <td>
                                        <div className="actions">
                                            <button className="icon-btn" title="Edit (coming soon)">
                                                <Pencil size={14} />
                                            </button>
                                            <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteSlot(slot.slot_id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ));
        }

        const sections = [
            { key: 'MORNING', dot: '#f59e0b', title: 'MORNING' },
            { key: 'AFTERNOON', dot: '#0ea5e9', title: 'AFTERNOON' },
            { key: 'EVENING', dot: '#8b5cf6', title: 'EVENING' },
        ];

        return sections.map(({ key, dot, title }) => {
            const data = groupedSlots[key] || [];
            if (!data.length) return null;
            return (
                <div key={key} className="sch-card">
                    <div className="sch-section-title" style={{ color: dot }}>
                        <span className="sch-dot" style={{ background: dot }} />
                        {title} - {data.length} SLOTS
                    </div>

                    {mode === 'master' && (
                        <table className="sch-table">
                            <thead>
                                <tr>
                                    <th>SLOT ID</th>
                                    <th>LABEL</th>
                                    <th>START</th>
                                    <th>END</th>
                                    <th>ORDER</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((slot) => (
                                    <tr key={slot.slot_id}>
                                        <td className="mono">{slot.slot_id}</td>
                                        <td>{slot.display_label || slot.slot_label}</td>
                                        <td>{formatTime12h(slot.start_time)}</td>
                                        <td>{formatTime12h(slot.end_time)}</td>
                                        <td>{slot.sort_order ?? 0}</td>
                                        <td>
                                            <span className={`badge ${slot.is_active ? 'ok' : 'bad'}`}>
                                                {slot.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="actions">
                                                <button className="icon-btn" title="Edit (coming soon)">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteSlot(slot.slot_id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {mode === 'weekly' && (
                        <table className="sch-table">
                            <thead>
                                <tr>
                                    <th>SLOT</th>
                                    <th>TIME</th>
                                    {DAY_NAMES.map((d) => <th key={d}>{d}</th>)}
                                    <th>ALL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((slot) => (
                                    <tr key={slot.slot_id}>
                                        <td>
                                            <div>{slot.display_label || slot.slot_label}</div>
                                            <div className="mono sub">{slot.slot_id}</div>
                                        </td>
                                        <td>{formatTime12h(slot.start_time)}</td>
                                        {DAY_NUMS.map((dayNum) => (
                                            <td key={`${slot.slot_id}-${dayNum}`}>
                                                <input type="checkbox" checked={isDayChecked(slot, dayNum)} onChange={() => toggleWeekDay(slot.slot_id, dayNum)} />
                                            </td>
                                        ))}
                                        <td>
                                            <button className="all-btn" onClick={() => toggleAllDays(slot.slot_id)}>All</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {mode === 'daily' && (
                        <table className="sch-table">
                            <thead>
                                <tr>
                                    <th>SLOT</th>
                                    <th>TIME</th>
                                    {weekDates.map((d) => {
                                        const head = formatDayHeading(d);
                                        return (
                                            <th key={d}>
                                                <div>{head.dow}</div>
                                                <div className="sub">{head.dm}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((slot) => (
                                    <tr key={slot.slot_id}>
                                        <td>
                                            <div>{slot.display_label || slot.slot_label}</div>
                                            <div className="mono sub">{slot.slot_id}</div>
                                        </td>
                                        <td>{formatTime12h(slot.start_time)}</td>
                                        {weekDates.map((date) => {
                                            const state = getCellState(slot.slot_id, date);
                                            return (
                                                <td key={`${slot.slot_id}-${date}`}>
                                                    <button
                                                        className={`cell ${state.cls}`}
                                                        onClick={() => handleDailyCellClick(slot.slot_id, date)}
                                                        disabled={!state.clickable}
                                                    >
                                                        {state.label}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            );
        });
    };

    if (loading) return <div className="sch-page"><div className="sch-card">Loading scheduling...</div></div>;

    return (
        <div className="sch-page">
            <div className="sch-top-search"><input type="text" placeholder="Quick search patients..." readOnly /></div>

            <div className="sch-header-row">
                <div>
                    <h1>Scheduling</h1>
                    <p>Manage clinic time slots and daily availability.</p>
                    <small>{slotTemplates.length ? `${slotTemplates.length} template groups defined` : `${slots.length} slot templates defined`}</small>
                </div>
                <div className="tab-wrap">
                    <button className={activeTab === TABS.MASTER ? 'tab active' : 'tab'} onClick={() => setActiveTab(TABS.MASTER)}><Clock3 size={14} /> Slot Master</button>
                    <button className={activeTab === TABS.WEEKLY ? 'tab active' : 'tab'} onClick={() => setActiveTab(TABS.WEEKLY)}><Calendar size={14} /> Weekly Template</button>
                    <button className={activeTab === TABS.DAILY ? 'tab active' : 'tab'} onClick={() => setActiveTab(TABS.DAILY)}><Calendar size={14} /> Daily View</button>
                </div>
            </div>

            {error ? <div className="alert error">{error}</div> : null}
            {success ? <div className="alert success">{success}</div> : null}

            {activeTab === TABS.MASTER && (
                <>
                    <div className="action-row">
                        <div className="master-filter">
                            <label>Show Template:</label>
                            <select value={masterFilter} onChange={(e) => setMasterFilter(e.target.value)}>
                                <option value="ALL">All Templates</option>
                                {slotTemplates.map((t) => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="master-btns">
                            <button className="btn light" onClick={loadBase}><RefreshCw size={14} /> Refresh</button>
                            {showAdd
                                ? <button className="btn primary" onClick={() => setShowAdd(false)}><X size={14} /> Cancel</button>
                                : <button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Slot</button>}
                        </div>
                    </div>

                    {showAdd && (
                        <form className="sch-card add-card" onSubmit={handleCreateSlot}>
                            <h3>Add New Slot</h3>
                            <div className="form-grid">
                                <div><label>Label *</label><input value={addForm.slot_label} onChange={(e) => setAddForm((p) => ({ ...p, slot_label: e.target.value }))} placeholder="e.g. 10:00 - 10:30 AM" required /></div>
                                <div><label>Start *</label><input type="time" value={addForm.start_time} onChange={(e) => setAddForm((p) => ({ ...p, start_time: e.target.value }))} required /></div>
                                <div><label>End *</label><input type="time" value={addForm.end_time} onChange={(e) => setAddForm((p) => ({ ...p, end_time: e.target.value }))} required /></div>
                                <div>
                                    <label>Session *</label>
                                    <select value={addForm.session} onChange={(e) => setAddForm((p) => ({ ...p, session: e.target.value }))}>
                                        <option value="MORNING">MORNING</option>
                                        <option value="AFTERNOON">AFTERNOON</option>
                                        <option value="EVENING">EVENING</option>
                                    </select>
                                </div>
                                <div><label>Order</label><input type="number" value={addForm.sort_order} onChange={(e) => setAddForm((p) => ({ ...p, sort_order: Number(e.target.value || 0) }))} /></div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn light" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn primary"><Plus size={14} /> Add Slot</button>
                            </div>
                        </form>
                    )}
                    {renderSessionTables('master')}
                </>
            )}

            {activeTab === TABS.WEEKLY && (
                <>
                    <div className="sch-card weekly-head">
                        <div>
                            <label>DOCTOR</label>
                            <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                                {doctors.map((doc) => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                            </select>
                        </div>
                        <div className="weekly-actions">
                            <button className="btn light" onClick={resetWeeklyTemplate}><RefreshCw size={14} /> Reset</button>
                            <button className={weeklyDirty ? 'btn primary' : 'btn light'} onClick={saveWeeklyTemplate}><Check size={14} /> {weeklyDirty ? 'Save Changes' : 'No Changes'}</button>
                        </div>
                    </div>
                    {renderSessionTables('weekly')}
                </>
            )}

            {activeTab === TABS.DAILY && (
                <>
                    <div className="sch-card daily-head">
                        <div className="daily-left">
                            <label>Doctor</label>
                            <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                                {doctors.map((doc) => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                            </select>
                        </div>
                        <div className="daily-right">
                            <button className="btn light" onClick={() => shiftWeek(-1)}>Prev</button>
                            <div className="week-label">
                                {new Date(weekDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' - '}
                                {new Date(weekDates[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <button className="btn light" onClick={() => shiftWeek(1)}>Next</button>
                            <button className="btn light" onClick={loadDailyGrid} disabled={syncing}>
                                <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                            </button>
                        </div>
                    </div>
                    <div className="legend">
                        <span><i className="lg free" /> Available</span>
                        <span><i className="lg blocked" /> Blocked</span>
                        <span><i className="lg booked" /> Booked</span>
                        <span><i className="lg off" /> Off (template)</span>
                    </div>
                    {renderSessionTables('daily')}
                </>
            )}

            <style>{`
                .sch-page { padding: 1.5rem 2rem 2rem; background: #f6f7fb; min-height: 100vh; }
                .sch-top-search input { width: 360px; max-width: 100%; height: 42px; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; padding: 0 1rem; font-weight: 600; color: #64748b; }
                .sch-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-top: 1rem; margin-bottom: 1rem; }
                .sch-header-row h1 { font-size: 3rem; line-height: 1; margin: 0; font-family: Outfit, sans-serif; color: #0f172a; }
                .sch-header-row p { margin: 0.5rem 0 0; color: #64748b; font-weight: 600; }
                .sch-header-row small { color: #94a3b8; font-weight: 600; }

                .tab-wrap { display: flex; gap: 0.5rem; }
                .tab { height: 44px; border: 1px solid #e2e8f0; background: #fff; color: #475569; padding: 0 1rem; border-radius: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
                .tab.active { background: linear-gradient(135deg, #5b5ce2, #3f46d7); color: #fff; border-color: transparent; box-shadow: 0 8px 18px -12px rgba(67, 70, 217, 0.9); }

                .alert { border-radius: 12px; padding: 0.65rem 0.9rem; font-weight: 700; margin: 0.6rem 0 1rem; }
                .alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
                .alert.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }

                .action-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; gap: 1rem; }
                .master-filter { display: flex; flex-direction: column; gap: 4px; }
                .master-filter label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                .master-filter select { height: 42px; padding: 0 1rem; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; font-weight: 600; color: #475569; min-width: 200px; }
                .master-btns { display: flex; gap: 0.75rem; }
                .btn { border: none; border-radius: 14px; height: 42px; padding: 0 1rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                .btn.light { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
                .btn.primary { background: linear-gradient(135deg, #5b5ce2, #3f46d7); color: #fff; }

                .sch-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; margin-bottom: 1rem; overflow: hidden; }
                .add-card { padding: 1rem; }
                .add-card h3 { margin: 0 0 1rem; color: #3f46d7; font-family: Outfit, sans-serif; }
                .form-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr; gap: 0.8rem; }
                .form-grid label { font-size: 0.8rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.35rem; }
                .form-grid input, .form-grid select { width: 100%; height: 40px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 0.7rem; font-weight: 600; }
                .form-actions { margin-top: 0.9rem; display: flex; justify-content: flex-end; gap: 0.5rem; }

                .sch-section-title { padding: 0.9rem 1rem; font-weight: 900; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .sch-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

                .sch-table { width: 100%; border-collapse: collapse; }
                .sch-table th { text-align: left; font-size: 0.78rem; letter-spacing: 0.06em; color: #64748b; padding: 0.75rem 1rem; border-top: 1px solid #eef2f7; border-bottom: 1px solid #eef2f7; }
                .sch-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
                .sch-table tr:last-child td { border-bottom: none; }
                .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #64748b; }
                .sub { font-size: 0.72rem; color: #94a3b8; font-weight: 700; }

                .badge { padding: 0.22rem 0.55rem; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
                .badge.ok { background: #dcfce7; color: #15803d; }
                .badge.bad { background: #fee2e2; color: #b91c1c; }
                .actions { display: flex; gap: 0.35rem; }
                .icon-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #6366f1; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
                .icon-btn.danger { color: #ef4444; }

                .weekly-head, .daily-head { padding: 0.9rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                .weekly-head label, .daily-head label { font-size: 0.75rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.25rem; }
                .weekly-head select, .daily-head select { height: 38px; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0 0.6rem; font-weight: 700; min-width: 220px; }
                .weekly-actions, .daily-right { display: flex; align-items: center; gap: 0.5rem; }
                .week-label { font-weight: 800; color: #334155; min-width: 200px; text-align: center; }
                .all-btn { height: 30px; padding: 0 0.65rem; border-radius: 8px; border: 1px solid #c7d2fe; color: #4f46e5; background: #eef2ff; font-weight: 800; cursor: pointer; }

                .legend { margin: 0.4rem 0 0.8rem; display: flex; gap: 1rem; color: #64748b; font-size: 0.8rem; font-weight: 700; }
                .legend .lg { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.35rem; }
                .lg.free { background: #dcfce7; }
                .lg.blocked { background: #fee2e2; }
                .lg.booked { background: #fef3c7; }
                .lg.off { background: #e2e8f0; }

                .cell { min-width: 74px; height: 28px; border-radius: 8px; border: 1px solid; font-weight: 800; font-size: 0.75rem; cursor: pointer; }
                .cell.free { background: #ecfdf3; border-color: #bbf7d0; color: #15803d; }
                .cell.blocked { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
                .cell.booked { background: #fffbeb; border-color: #fde68a; color: #a16207; cursor: not-allowed; }
                .cell.off { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @media (max-width: 1100px) {
                    .sch-header-row { flex-direction: column; }
                    .form-grid { grid-template-columns: 1fr 1fr; }
                    .sch-card { overflow-x: auto; }
                    .sch-table { min-width: 900px; }
                }
            `}</style>
        </div>
    );
};

export default Scheduling;
