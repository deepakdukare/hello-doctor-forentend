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
    Search,
    Filter,
    Users,
    Activity,
    ChevronLeft,
    ChevronRight,
    Stethoscope,
    Shield,
    Clock,
    CheckCircle2,
    Settings,
    Layout
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

// Returns just the base name (no speciality) for API calls like /slots/available
const getRawDoctorName = (doc) => {
    if (!doc) return '';
    return doc.full_name || doc.name || doc.doctor_name || doc.doctor_id || '';
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

    const [editingSlot, setEditingSlot] = useState(null);
    const [editForm, setEditForm] = useState({
        slot_label: '',
        start_time: '',
        end_time: '',
        session: 'MORNING',
        sort_order: 0,
        active_days: [],
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

            const daysByDoctor = {};
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
            // Use raw doctor name (without speciality) for /slots/available
            const rawName = getRawDoctorName(selectedDoctor);
            const results = await Promise.all(
                weekDates.map((date) =>
                    getDailyStatus(rawName || selectedDoctor.doctor_id, date, {
                        doctor_id: selectedDoctor.doctor_id,
                    }).catch(() => ({ data: { data: [] } }))
                )
            );
            const grid = {};
            results.forEach((res, idx) => {
                const date = weekDates[idx];
                // The /slots/available response returns slots that ARE available on that date
                (res.data?.data || []).forEach((cell) => {
                    if (!grid[cell.slot_id]) grid[cell.slot_id] = {};
                    grid[cell.slot_id][date] = {
                        ...cell,
                        is_available: true,
                        is_booked: !!cell.is_booked,
                        blocked_by_admin: !!cell.blocked_by_admin,
                    };
                });
            });
            setDailyGrid(grid);
        } catch {
            setError('Unable to sync daily availability grid.');
        } finally {
            setSyncing(false);
        }
    }, [selectedDoctor, weekDates]);

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

    const handleEditClick = (templateName, slot) => {
        setEditingSlot({ templateName, ...slot });
        setEditForm({
            slot_label: slot.display_label || slot.slot_label,
            start_time: slot.start_time,
            end_time: slot.end_time,
            session: slot.session,
            sort_order: slot.sort_order || 0,
            active_days: slot.active_days || [],
        });
    };

    const toggleEditDay = (dayNum) => {
        setEditForm((prev) => ({
            ...prev,
            active_days: prev.active_days.includes(dayNum)
                ? prev.active_days.filter((d) => d !== dayNum)
                : [...prev.active_days, dayNum].sort((a, b) => a - b),
        }));
    };

    const handleUpdateSlot = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const updatedSlot = {
                ...editingSlot,
                label: editForm.slot_label,
                display_label: editForm.slot_label,
                slot_label: editForm.slot_label,
                start_time: editForm.start_time,
                end_time: editForm.end_time,
                session: editForm.session,
                sort_order: Number(editForm.sort_order),
                active_days: editForm.active_days,
            };

            setSlots(prev => prev.map(s => s.slot_id === updatedSlot.slot_id ? { ...s, ...updatedSlot } : s));
            setSlotTemplates(prev => prev.map(t => {
                if (t.name !== editingSlot.templateName) return t;
                return {
                    ...t,
                    slots: t.slots.map(s => s.slot_id === updatedSlot.slot_id ? updatedSlot : s)
                };
            }));

            setEditingSlot(null);
            withToast('Slot configuration updated successfully.');
        } catch (e) {
            setError('Update failed. Please try again.');
        }
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
            withToast('New master slot deployed.');
        } catch (e2) {
            setError(e2.response?.data?.message || 'Failed to create master slot.');
        }
    };

    const handleDeleteSlot = async (slotId) => {
        if (!window.confirm('Are you sure you want to delete this master slot? This will affect all future schedules.')) return;
        setError('');
        try {
            await deleteSlot(slotId);
            setSlots((prev) => prev.filter((s) => s.slot_id !== slotId));
            setSlotTemplates(prev => prev.map(t => ({
                ...t,
                slots: t.slots.filter(s => s.slot_id !== slotId),
                slot_count: t.slots.filter(s => s.slot_id !== slotId).length
            })));
            withToast('Slot purged from registry.');
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to delete slot configuration.');
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
            withToast('Clinical template synchronized.');
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save roster template.');
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
        // Cell exists in the grid = the slot is scheduled for this doctor on this day
        // /slots/available returns only slots that are available (active template days)
        if (!cell) {
            // Not in template for this doctor/day
            return { label: 'Off', cls: 'off', clickable: false };
        }
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
            // API: POST /api/slots/daily-update with slot_id, slot_date, doctor_name, custom_label
            const rawName = getRawDoctorName(selectedDoctor);
            await updateDailySlot({
                slot_id: slotId,
                date,
                action: state.action,
                doctor_id: selectedDoctor.doctor_id,
                doctor_name: rawName,
            });
            await loadDailyGrid();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to update slot status.');
        }
    };

    const renderSessionTables = (mode) => {
        if (mode === 'master' && slotTemplates.length > 0) {
            const filtered = masterFilter === 'ALL'
                ? slotTemplates
                : slotTemplates.filter((t) => t.name === masterFilter);

            return filtered.map((template) => (
                <div key={template.name} className="card-premium-v3 shadow-premium session-card-v3">
                    <div className="card-header-v3">
                        <div className="header-icon-wrap" style={{ background: template.is_doctor ? '#eef2ff' : '#f8fafc', color: template.is_doctor ? '#6366f1' : '#94a3b8' }}>
                            {template.is_doctor ? <Stethoscope size={20} /> : <Settings size={20} />}
                        </div>
                        <div>
                            <h3 className="card-title-v3">{template.name}</h3>
                            <span className="card-subtitle-v3">{template.slot_count} Clinical Slots Defined</span>
                        </div>
                    </div>
                    <div className="table-responsive-v3">
                        <table className="table-v3">
                            <thead>
                                <tr>
                                    <th>Registry ID</th>
                                    <th>Identity</th>
                                    <th>Time Range</th>
                                    <th>Active Days</th>
                                    <th style={{ textAlign: 'right' }}>Management</th>
                                </tr>
                            </thead>
                            <tbody>
                                {template.slots.map((slot) => (
                                    <tr key={`${template.name}-${slot.slot_id}`}>
                                        <td className="mono">{slot.slot_id}</td>
                                        <td className="bold">{slot.display_label || slot.slot_label}</td>
                                        <td>
                                            <div className="time-badge">
                                                <Clock size={14} />
                                                <span>{formatTime12h(slot.start_time)} - {formatTime12h(slot.end_time)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="days-list">
                                                {(slot.active_days || []).map((d) => (
                                                    <span key={d} className="tiny-day-tag">{DAY_NAMES[d]}</span>
                                                ))}
                                                {!(slot.active_days?.length) && <span className="no-days-alert">No days assigned</span>}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="actions-cluster">
                                                <button className="hub-btn-v3 edit" title="Modify Config" onClick={() => handleEditClick(template.name, slot)}>
                                                    <Pencil size={16} />
                                                </button>
                                                <button className="hub-btn-v3 delete" title="Purge Record" onClick={() => handleDeleteSlot(slot.slot_id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ));
        }

        const sections = [
            { key: 'MORNING', icon: <Clock3 size={18} />, color: '#f59e0b', title: 'Morning Roster' },
            { key: 'AFTERNOON', icon: <Activity size={18} />, color: '#0ea5e9', title: 'Mid-Day Session' },
            { key: 'EVENING', icon: <Clock size={18} />, color: '#8b5cf6', title: 'Evening Clinic' },
        ];

        return sections.map(({ key, icon, color, title }) => {
            const data = groupedSlots[key] || [];
            if (!data.length) return null;
            return (
                <div key={key} className="card-premium-v3 shadow-premium session-card-v3">
                    <div className="card-header-v3">
                        <div className="header-icon-wrap" style={{ background: `${color}10`, color: color }}>
                            {icon}
                        </div>
                        <div>
                            <h3 className="card-title-v3">{title}</h3>
                            <span className="card-subtitle-v3">{data.length} Slots Operating</span>
                        </div>
                    </div>

                    <div className="table-responsive-v3">
                        {mode === 'weekly' && (
                            <table className="table-v3 roster-table-v3">
                                <thead>
                                    <tr>
                                        <th style={{ width: '220px' }}>Slot Identity</th>
                                        <th style={{ width: '150px' }}>Time</th>
                                        {DAY_NAMES.map((d) => <th key={d} className="center-th">{d}</th>)}
                                        <th style={{ textAlign: 'right' }}>Global</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((slot) => (
                                        <tr key={slot.slot_id}>
                                            <td>
                                                <div className="slot-identity">
                                                    <span className="s-name">{slot.display_label || slot.slot_label}</span>
                                                    <span className="s-id mono">{slot.slot_id}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="time-val-v3">{formatTime12h(slot.start_time)}</span>
                                            </td>
                                            {DAY_NUMS.map((dayNum) => (
                                                <td key={`${slot.slot_id}-${dayNum}`} className="center-td">
                                                    <label className="checkbox-v3">
                                                        <input type="checkbox" checked={isDayChecked(slot, dayNum)} onChange={() => toggleWeekDay(slot.slot_id, dayNum)} />
                                                        <span className="checkmark" />
                                                    </label>
                                                </td>
                                            ))}
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="pill-btn-v3" onClick={() => toggleAllDays(slot.slot_id)}>Toggle All</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {mode === 'daily' && (
                            <table className="table-v3 availability-grid-v3">
                                <thead>
                                    <tr>
                                        <th style={{ width: '220px' }}>Slot Info</th>
                                        <th style={{ width: '150px' }}>Log Time</th>
                                        {weekDates.map((d) => {
                                            const head = formatDayHeading(d);
                                            return (
                                                <th key={d} className="center-th date-th">
                                                    <div className="date-stack">
                                                        <span className="d-dow">{head.dow}</span>
                                                        <span className="d-dm">{head.dm}</span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((slot) => (
                                        <tr key={slot.slot_id}>
                                            <td>
                                                <div className="slot-identity">
                                                    <span className="s-name">{slot.display_label || slot.slot_label}</span>
                                                    <span className="s-id mono">{slot.slot_id}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="time-val-v3">{formatTime12h(slot.start_time)}</span>
                                            </td>
                                            {weekDates.map((date) => {
                                                const state = getCellState(slot.slot_id, date);
                                                return (
                                                    <td key={`${slot.slot_id}-${date}`} className="center-td">
                                                        <button
                                                            className={`grid-cell-v3 ${state.cls}`}
                                                            onClick={() => handleDailyCellClick(slot.slot_id, date)}
                                                            disabled={!state.clickable}
                                                        >
                                                            <span>{state.label === 'Available' ? 'Free' : state.label}</span>
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
                </div>
            );
        });
    };

    if (loading) return (
        <div className="sch-page-v3">
            <div className="skeleton-container-v3">
                <RefreshCw size={48} className="animate-spin text-primary" />
                <p>Synchronizing Clinical Rosters...</p>
            </div>
        </div>
    );

    return (
        <div className="sch-page-v3">


            <header className="page-header-v3">
                <div className="header-meta-group">
                    <h1 className="header-h1-v3">Scheduling</h1>
                </div>

                <div className="header-nav-v3">
                    <button className={`nav-tab-v3 ${activeTab === TABS.MASTER ? 'active' : ''}`} onClick={() => setActiveTab(TABS.MASTER)}>
                        <Shield size={18} />
                        <span>Slot Master</span>
                    </button>
                    <button className={`nav-tab-v3 ${activeTab === TABS.WEEKLY ? 'active' : ''}`} onClick={() => setActiveTab(TABS.WEEKLY)}>
                        <Calendar size={18} />
                        <span>Weekly Template</span>
                    </button>
                    <button className={`nav-tab-v3 ${activeTab === TABS.DAILY ? 'active' : ''}`} onClick={() => setActiveTab(TABS.DAILY)}>
                        <Activity size={18} />
                        <span>Daily View</span>
                    </button>
                </div>
            </header>

            {error && (
                <div className="alert-v3 error shadow-premium">
                    <X size={20} />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="alert-v3 success shadow-premium">
                    <CheckCircle2 size={20} />
                    <span>{success}</span>
                </div>
            )}

            <div className="view-content-v3">
                {activeTab === TABS.MASTER && (
                    <>
                        <div className="filter-shelf-premium">
                            <div className="filter-group-v3">
                                <div className="filter-item-v3">
                                    <Filter size={18} className="f-icon" />
                                    <span className="f-label">Filter Registry:</span>
                                    <select value={masterFilter} onChange={(e) => setMasterFilter(e.target.value)} className="f-select">
                                        <option value="ALL">All Active Templates</option>
                                        {slotTemplates.map((t) => (
                                            <option key={t.name} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="action-hub-v3">
                                <button className="hub-btn-v3 secondary" onClick={loadBase} title="Sync Config">
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                </button>
                                <button className={`hub-btn-v3 ${showAdd ? 'danger' : 'primary'}`} onClick={() => setShowAdd(!showAdd)}>
                                    {showAdd ? <X size={20} /> : <Plus size={20} />}
                                    <span>{showAdd ? 'Cancel Registration' : 'Register New Master Slot'}</span>
                                </button>
                            </div>
                        </div>

                        {showAdd && (
                            <div className="card-premium-v3 shadow-premium registration-card-v3">
                                <div className="reg-header-v3">
                                    <Layout size={24} className="reg-icon" />
                                    <div>
                                        <h3>Register New Slot</h3>
                                        <p>Define a new time block for the clinical registry.</p>
                                    </div>
                                </div>
                                <form className="reg-form-v3" onSubmit={handleCreateSlot}>
                                    <div className="form-grid-v3">
                                        <div className="field-v3">
                                            <span>Display Label</span>
                                            <input value={addForm.slot_label} onChange={(e) => setAddForm((p) => ({ ...p, slot_label: e.target.value }))} placeholder="e.g. 10:00 - 10:30 AM" required className="input-v3" />
                                        </div>
                                        <div className="field-v3">
                                            <span>Session Mapping</span>
                                            <select value={addForm.session} onChange={(e) => setAddForm((p) => ({ ...p, session: e.target.value }))} className="select-v3">
                                                <option value="MORNING">MORNING SESSION</option>
                                                <option value="AFTERNOON">AFTERNOON SESSION</option>
                                                <option value="EVENING">EVENING SESSION</option>
                                            </select>
                                        </div>
                                        <div className="field-v3">
                                            <span>Start Time (24h)</span>
                                            <input type="time" value={addForm.start_time} onChange={(e) => setAddForm((p) => ({ ...p, start_time: e.target.value }))} required className="input-v3" />
                                        </div>
                                        <div className="field-v3">
                                            <span>End Time (24h)</span>
                                            <input type="time" value={addForm.end_time} onChange={(e) => setAddForm((p) => ({ ...p, end_time: e.target.value }))} required className="input-v3" />
                                        </div>
                                        <div className="field-v3">
                                            <span>Lexical Weight (Sort Order)</span>
                                            <input type="number" value={addForm.sort_order} onChange={(e) => setAddForm((p) => ({ ...p, sort_order: Number(e.target.value || 0) }))} className="input-v3" />
                                        </div>
                                    </div>
                                    <div className="reg-footer-v3">
                                        <button type="button" className="btn-outline-v3" onClick={() => setShowAdd(false)}>Abort Registration</button>
                                        <button type="submit" className="btn-primary-v3">Deploy to Registry</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {editingSlot && (
                            <div className="modal-overlay-v3">
                                <div className="modal-content-v3 auth-panel-premium">
                                    <div className="modal-inner-v3">
                                        <div className="m-header-v3">
                                            <div className="m-title-icon">
                                                <Pencil size={24} />
                                            </div>
                                            <div>
                                                <h3>Configuring Slot: {editingSlot.slot_id}</h3>
                                                <p>Adjusting parameters for professional schedules.</p>
                                            </div>
                                            <button className="m-close-v3" onClick={() => setEditingSlot(null)}><X size={24} /></button>
                                        </div>

                                        <form className="m-body-v3" onSubmit={handleUpdateSlot}>
                                            <div className="form-grid-v3">
                                                <div className="field-v3">
                                                    <span>Identity Label</span>
                                                    <input value={editForm.slot_label} onChange={(e) => setEditForm((p) => ({ ...p, slot_label: e.target.value }))} required className="input-v3" />
                                                </div>
                                                <div className="field-v3">
                                                    <span>Session Category</span>
                                                    <select value={editForm.session} onChange={(e) => setEditForm((p) => ({ ...p, session: e.target.value }))} className="select-v3">
                                                        <option value="MORNING">MORNING</option>
                                                        <option value="AFTERNOON">AFTERNOON</option>
                                                        <option value="EVENING">EVENING</option>
                                                    </select>
                                                </div>
                                                <div className="field-v3">
                                                    <span>Start Time</span>
                                                    <input type="time" value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} required className="input-v3" />
                                                </div>
                                                <div className="field-v3">
                                                    <span>End Time</span>
                                                    <input type="time" value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))} required className="input-v3" />
                                                </div>
                                                <div className="field-v3">
                                                    <span>Sort Order</span>
                                                    <input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((p) => ({ ...p, sort_order: Number(e.target.value || 0) }))} className="input-v3" />
                                                </div>
                                            </div>

                                            <div className="roster-template-v3">
                                                <label className="roster-label-v3">Recurring Weekly Cycle (Active Template)</label>
                                                <div className="roster-days-v3">
                                                    {DAY_NAMES.map((name, idx) => (
                                                        <div
                                                            key={name}
                                                            className={`roster-day-pill-v3 ${editForm.active_days.includes(idx) ? 'active' : ''}`}
                                                            onClick={() => toggleEditDay(idx)}
                                                        >
                                                            {name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="modal-footer-v3">
                                                <button type="button" className="btn-outline-v3" onClick={() => setEditingSlot(null)}>Discard Changes</button>
                                                <button type="submit" className="btn-primary-v3">Apply Adjustments</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="session-grid-v3">
                            {renderSessionTables('master')}
                        </div>
                    </>
                )}

                {activeTab === TABS.WEEKLY && (
                    <>
                        <div className="doctor-shelf-v3 card-premium-v3 shadow-premium">
                            <div className="d-shelf-group">
                                <Users size={20} className="d-icon" />
                                <div className="d-info">
                                    <span className="d-label">Clinical Practitioner</span>
                                    <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} className="d-select">
                                        {doctors.map((doc) => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="d-actions-v3">
                                <button className="hub-btn-v3 secondary" onClick={resetWeeklyTemplate} title="Reset Roster">
                                    <RefreshCw size={18} />
                                </button>
                                <button className={`hub-btn-v3 ${weeklyDirty ? 'primary' : 'secondary disabled'}`} onClick={saveWeeklyTemplate} disabled={!weeklyDirty}>
                                    <CheckCircle2 size={18} />
                                    <span>{weeklyDirty ? 'Commit Template' : 'Template Synchronized'}</span>
                                </button>
                            </div>
                        </div>
                        <div className="session-grid-v3">
                            {renderSessionTables('weekly')}
                        </div>
                    </>
                )}

                {activeTab === TABS.DAILY && (
                    <>
                        <div className="daily-navigation-v3 card-premium-v3 shadow-premium">
                            <div className="nav-doctor-v3">
                                <Stethoscope size={20} />
                                <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                                    {doctors.map((doc) => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                                </select>
                            </div>

                            <div className="nav-range-v3">
                                <button className="range-btn-v3" onClick={() => shiftWeek(-1)}><ChevronLeft size={20} /></button>
                                <div className="range-label-v3">
                                    <Calendar size={18} />
                                    <span>
                                        {new Date(weekDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        {' — '}
                                        {new Date(weekDates[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <button className="range-btn-v3" onClick={() => shiftWeek(1)}><ChevronRight size={20} /></button>
                            </div>

                            <button className="hub-btn-v3 secondary" onClick={loadDailyGrid} disabled={syncing}>
                                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="legend-shelf-v3">
                            <div className="legend-item-v3"><span className="dot free" /> Available</div>
                            <div className="legend-item-v3"><span className="dot blocked" /> Admin-Blocked</div>
                            <div className="legend-item-v3"><span className="dot booked" /> Patient Booked</div>
                            <div className="legend-item-v3"><span className="dot off" /> Template Off</div>
                        </div>

                        <div className="session-grid-v3">
                            {renderSessionTables('daily')}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                .sch-page-v3 { padding: 1rem 1.5rem; background: var(--bg-main, #f3f4f6); min-height: 100vh; font-family: 'Inter', sans-serif; }



                .page-header-v3 { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
                .header-h1-v3 { font-size: 2.75rem; font-weight: 900; color: #0f172a; margin-bottom: 0.4rem; letter-spacing: -0.04em; font-family: 'Outfit', sans-serif; }
                .header-sub-v3 { font-size: 1rem; color: #64748b; font-weight: 500; }

                .header-nav-v3 { display: flex; background: #fff; padding: 0.4rem; border-radius: 18px; border: 1px solid var(--border-color, #e5e7eb); box-shadow: var(--shadow-sm); }
                .nav-tab-v3 { display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.4rem; border: none; background: transparent; color: #64748b; font-weight: 700; cursor: pointer; border-radius: 12px; transition: all 0.2s; white-space: nowrap; font-size: 0.9rem; }
                .nav-tab-v3.active { background: var(--primary, #6366f1); color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
                .nav-tab-v3:hover:not(.active) { background: var(--primary-light, #e0e7ff); color: var(--primary, #6366f1); }

                .alert-v3 { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; font-weight: 700; max-width: 800px; }
                .alert-v3.error { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
                .alert-v3.success { background: #f0fdf4; color: #10b981; border: 1px solid #dcfce7; }

                .filter-shelf-premium { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color, #e5e7eb); }
                .filter-group-v3 { display: flex; gap: 1.5rem; }
                .filter-item-v3 { display: flex; align-items: center; gap: 0.75rem; background: #fff; padding: 0.5rem 1.25rem; border-radius: 14px; border: 1px solid var(--border-color, #e5e7eb); height: 48px; }
                .f-icon { color: var(--primary, #6366f1); }
                .f-label { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
                .f-select { border: none; background: transparent; font-weight: 700; color: #1e293b; padding: 0.25rem 0; cursor: pointer; min-width: 180px; outline: none; font-size: 0.9rem; }

                .action-hub-v3 { display: flex; gap: 0.75rem; }
                .hub-btn-v3 { display: flex; align-items: center; gap: 0.6rem; border: none; height: 48px; border-radius: 14px; font-weight: 800; cursor: pointer; padding: 0 1.25rem; transition: all 0.2s; font-size: 0.9rem; }
                .hub-btn-v3.primary { background: var(--primary, #6366f1); color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.3); }
                .hub-btn-v3.primary:hover { background: var(--primary-hover, #4f46e5); }
                .hub-btn-v3.secondary { background: #fff; color: #64748b; border: 1.5px solid var(--border-color, #e5e7eb); }
                .hub-btn-v3.secondary:hover { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); }
                .hub-btn-v3.danger { background: #ef4444; color: #fff; }
                .hub-btn-v3:hover:not(.disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.12); }
                .hub-btn-v3.disabled { opacity: 0.5; cursor: not-allowed; }

                .session-grid-v3 { display: grid; gap: 2rem; }
                .card-header-v3 { display: flex; align-items: center; gap: 1.25rem; padding: 1.5rem 2rem; background: #fff; border-bottom: 1px solid var(--border-color, #e5e7eb); }
                .header-icon-wrap { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .card-title-v3 { font-size: 1.1rem; font-weight: 900; color: #1e293b; margin: 0; font-family: 'Outfit', sans-serif; }
                .card-subtitle-v3 { font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }

                .table-responsive-v3 { overflow-x: auto; }
                .table-v3 { width: 100%; border-collapse: collapse; }
                .table-v3 th { text-align: left; padding: 0.85rem 1.5rem; background: #f8fafc; color: #94a3b8; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--border-color, #e5e7eb); white-space: nowrap; }
                .table-v3 td { padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #334155; vertical-align: middle; }
                .table-v3 tr:last-child td { border-bottom: none; }
                .table-v3 tr:hover td { background: #fafbff; }
                .mono { font-family: ui-monospace, 'JetBrains Mono', monospace; color: #94a3b8; font-size: 0.8rem; }
                .bold { font-weight: 800; color: #0f172a; }

                .time-badge { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--primary, #6366f1); font-weight: 700; font-size: 0.875rem; background: var(--primary-light, #e0e7ff); padding: 0.35rem 0.8rem; border-radius: 8px; }
                .days-list { display: flex; gap: 0.3rem; flex-wrap: wrap; }
                .tiny-day-tag { font-size: 0.65rem; font-weight: 900; background: #e0e7ff; color: #6366f1; padding: 0.2rem 0.5rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
                .no-days-alert { font-size: 0.75rem; color: #94a3b8; font-style: italic; }
                
                .actions-cluster { display: flex; gap: 0.5rem; justify-content: flex-end; }
                .hub-btn-v3.edit, .hub-btn-v3.delete { width: 38px; height: 38px; padding: 0; border-radius: 10px; flex-shrink: 0; }
                .hub-btn-v3.edit { background: #ede9fe; color: #6366f1; border: none; height: 38px; }
                .hub-btn-v3.delete { background: #fef2f2; color: #ef4444; border: none; height: 38px; }
                .hub-btn-v3.edit:hover { background: var(--primary, #6366f1); color: #fff; transform: none; box-shadow: none; }
                .hub-btn-v3.delete:hover { background: #ef4444; color: #fff; transform: none; box-shadow: none; }

                .registration-card-v3 { margin-bottom: 2rem; border: 2px solid var(--primary-light, #e0e7ff); background: #fafbff; }
                .reg-header-v3 { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border-color, #e5e7eb); display: flex; align-items: center; gap: 1.25rem; }
                .reg-icon { color: var(--primary, #6366f1); }
                .reg-header-v3 h3 { font-size: 1.15rem; font-weight: 900; color: #1e293b; margin: 0; font-family: 'Outfit', sans-serif; }
                .reg-header-v3 p { color: #64748b; font-size: 0.85rem; margin-top: 0.2rem; }
                .reg-form-v3 { padding: 2rem; }
                .form-grid-v3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem; }
                .reg-footer-v3 { display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--border-color, #e5e7eb); padding-top: 1.5rem; }
                .reg-footer-v3 button { flex: 1; height: 48px; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; }

                .modal-overlay-v3 { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 2rem; }
                .modal-content-v3 { background: #fff; width: 720px; max-width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.25); }
                .m-header-v3 { display: flex; align-items: center; gap: 1.25rem; padding: 2rem 2.5rem; background: #fafbff; border-bottom: 1px solid var(--border-color, #e5e7eb); position: relative; }
                .m-title-icon { width: 48px; height: 48px; background: var(--primary-light, #e0e7ff); color: var(--primary, #6366f1); border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .m-header-v3 h3 { font-size: 1.25rem; font-weight: 900; color: #1e293b; margin: 0; font-family: 'Outfit', sans-serif; }
                .m-header-v3 p { font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }
                .m-close-v3 { position: absolute; top: 1.5rem; right: 1.5rem; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .m-close-v3:hover { background: #fee2e2; color: #ef4444; }
                .m-body-v3 { padding: 2rem 2.5rem; }
                
                .roster-template-v3 { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color, #e5e7eb); }
                .roster-label-v3 { font-size: 0.72rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 1rem; }
                .roster-days-v3 { display: flex; gap: 0.6rem; flex-wrap: wrap; }
                .roster-day-pill-v3 { padding: 0.65rem 1.25rem; border-radius: 12px; border: 2px solid var(--border-color, #e5e7eb); font-weight: 800; color: #64748b; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
                .roster-day-pill-v3.active { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25); }
                .roster-day-pill-v3:hover:not(.active) { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); }

                .doctor-shelf-v3 { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; margin-bottom: 2rem; }
                .d-shelf-group { display: flex; align-items: center; gap: 1.25rem; }
                .d-icon { color: var(--primary, #6366f1); }
                .d-info { display: flex; flex-direction: column; }
                .d-label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
                .d-select { border: none; background: transparent; font-size: 1.2rem; font-weight: 900; color: #0f172a; outline: none; cursor: pointer; padding: 0.2rem 0; letter-spacing: -0.02em; font-family: 'Outfit', sans-serif; }
                .d-actions-v3 { display: flex; gap: 0.75rem; }

                .roster-table-v3 .center-th, .availability-grid-v3 .center-th { text-align: center; }
                .center-td { text-align: center; vertical-align: middle; }
                .checkbox-v3 { display: block; position: relative; width: 22px; height: 22px; cursor: pointer; margin: 0 auto; user-select: none; }
                .checkbox-v3 input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
                .checkmark { position: absolute; top: 0; left: 0; height: 22px; width: 22px; background-color: #f1f5f9; border-radius: 7px; border: 1.5px solid #e2e8f0; transition: all 0.2s; }
                .checkbox-v3:hover input ~ .checkmark { border-color: var(--primary, #6366f1); }
                .checkbox-v3 input:checked ~ .checkmark { background-color: var(--primary, #6366f1); border-color: var(--primary, #6366f1); }
                .checkmark:after { content: ""; position: absolute; display: none; left: 7px; top: 3px; width: 5px; height: 10px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
                .checkbox-v3 input:checked ~ .checkmark:after { display: block; }
                .pill-btn-v3 { background: #f8fafc; border: 1.5px solid var(--border-color, #e5e7eb); color: #64748b; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.72rem; font-weight: 800; cursor: pointer; transition: all 0.2s; text-transform: uppercase; white-space: nowrap; }
                .pill-btn-v3:hover { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); background: var(--primary-light, #e0e7ff); }

                /* Slot identity stack — CRITICAL: must be column direction */
                .slot-identity { display: flex; flex-direction: column; gap: 0.25rem; }
                .s-name { font-weight: 700; color: #1e293b; font-size: 0.875rem; white-space: nowrap; }
                .s-id { font-size: 0.72rem; color: #94a3b8; font-weight: 600; white-space: nowrap; }
                .time-val-v3 { font-weight: 700; color: #475569; font-size: 0.875rem; white-space: nowrap; }

                .daily-navigation-v3 { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2rem; margin-bottom: 1.5rem; }
                .nav-doctor-v3 { display: flex; align-items: center; gap: 0.75rem; color: var(--primary, #6366f1); }
                .nav-doctor-v3 select { border: none; font-size: 1rem; font-weight: 800; color: #1e293b; cursor: pointer; outline: none; background: transparent; font-family: 'Outfit', sans-serif; }
                .nav-range-v3 { display: flex; align-items: center; gap: 1.5rem; background: #f8fafc; padding: 0.4rem 0.75rem; border-radius: 14px; border: 1px solid var(--border-color, #e5e7eb); }
                .range-btn-v3 { background: #fff; border: 1px solid var(--border-color, #e5e7eb); color: #1e293b; width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .range-btn-v3:hover { color: var(--primary, #6366f1); border-color: var(--primary, #6366f1); }
                .range-label-v3 { display: flex; align-items: center; gap: 0.75rem; font-weight: 800; color: #1e293b; font-size: 0.95rem; min-width: 220px; justify-content: center; }
                .range-label-v3 svg { color: var(--primary, #6366f1); }

                .legend-shelf-v3 { display: flex; gap: 2rem; justify-content: center; margin-bottom: 1.5rem; padding: 0.75rem 1.5rem; background: #fff; border: 1px solid var(--border-color, #e5e7eb); border-radius: 14px; width: fit-content; margin-left: auto; margin-right: auto; }
                .legend-item-v3 { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .legend-item-v3 .dot { width: 10px; height: 10px; border-radius: 3px; }
                .dot.free { background: #10b981; }
                .dot.blocked { background: #ef4444; }
                .dot.booked { background: #f59e0b; }
                .dot.off { background: #cbd5e1; }

                /* Date header fix — stack DOW + date properly */
                .date-th { min-width: 100px; }
                .date-stack { display: flex; flex-direction: column; align-items: center; gap: 3px; }
                .d-dow { font-size: 0.72rem; font-weight: 900; letter-spacing: 0.08em; color: #64748b; }
                .d-dm { font-size: 0.65rem; font-weight: 700; color: #94a3b8; white-space: nowrap; }

                .grid-cell-v3 { min-width: 80px; height: 34px; border-radius: 8px; border: 1.5px solid; font-weight: 800; font-size: 0.72rem; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; text-transform: uppercase; letter-spacing: 0.04em; }
                .grid-cell-v3.free { background: #ecfdf5; border-color: #6ee7b7; color: #059669; }
                .grid-cell-v3.free:hover:not(:disabled) { background: #10b981; color: #fff; border-color: #10b981; }
                .grid-cell-v3.blocked { background: #fff1f2; border-color: #fca5a5; color: #ef4444; }
                .grid-cell-v3.blocked:hover:not(:disabled) { background: #ef4444; color: #fff; }
                .grid-cell-v3.booked { background: #fffbeb; border-color: #fcd34d; color: #d97706; cursor: not-allowed; opacity: 0.8; }
                .grid-cell-v3.off { background: #f8fafc; border-color: #e2e8f0; color: #cbd5e1; cursor: not-allowed; }

                .skeleton-container-v3 { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; color: #64748b; font-weight: 700; }
                
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }

                @media (max-width: 1400px) { .sch-page-v3 { padding: 1.5rem 2rem; } }
                @media (max-width: 1000px) {
                    .page-header-v3 { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
                    .header-nav-v3 { width: 100%; overflow-x: auto; }
                    .search-pill-v3 { width: 100%; }
                    .filter-shelf-premium { flex-direction: column; align-items: flex-start; gap: 1rem; }
                }
            `}</style>
        </div>
    );
};

export default Scheduling;
