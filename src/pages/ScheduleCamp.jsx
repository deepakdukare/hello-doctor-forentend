import React, { useState, useEffect, useCallback } from 'react';
import {
    CalendarDays, Plus, Search, RefreshCw, Tent, MapPin, Clock, Users,
    Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, Activity, Filter,
    ChevronDown, X, Save, Tag, Stethoscope, BarChart2, Eye
} from 'lucide-react';
import { getCamps, getCampStats, createCamp, updateCamp, updateCampStatus, deleteCamp } from '../api/index';

const CAMP_TYPES = [
    { value: 'vaccination', label: 'Vaccination', color: '#10b981', bg: '#d1fae5' },
    { value: 'health_checkup', label: 'Health Checkup', color: '#6366f1', bg: '#ede9fe' },
    { value: 'awareness', label: 'Awareness', color: '#f59e0b', bg: '#fef3c7' },
    { value: 'nutrition', label: 'Nutrition', color: '#0ea5e9', bg: '#e0f2fe' },
    { value: 'dental', label: 'Dental', color: '#ec4899', bg: '#fce7f3' },
    { value: 'eye_care', label: 'Eye Care', color: '#8b5cf6', bg: '#ede9fe' },
    { value: 'other', label: 'Other', color: '#64748b', bg: '#f1f5f9' },
];

const STATUS_CONFIG = {
    scheduled: { label: 'Scheduled', color: '#6366f1', bg: '#ede9fe', icon: CalendarDays },
    ongoing:   { label: 'Ongoing',   color: '#f59e0b', bg: '#fef3c7', icon: Activity },
    completed: { label: 'Completed', color: '#10b981', bg: '#d1fae5', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
    postponed: { label: 'Postponed', color: '#f59e0b', bg: '#fff7ed', icon: AlertCircle },
};

const getCampTypeInfo = (v) => CAMP_TYPES.find(t => t.value === v) || CAMP_TYPES[CAMP_TYPES.length - 1];

const DEFAULT_FORM = {
    camp_name: '', camp_type: 'health_checkup', description: '',
    location: { venue: '', address: '', city: 'Mumbai', state: 'Maharashtra', pincode: '' },
    scheduled_date: '', end_date: '', start_time: '', end_time: '',
    organizer: 'Dr. Indu', doctors_assigned: '', target_beneficiaries: '',
    expected_attendance: '', registration_required: false, registration_link: '',
    status: 'scheduled', notes: '', tags: ''
};

const ScheduleCamp = () => {
    const [camps, setCamps] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editCamp, setEditCamp] = useState(null);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [viewCamp, setViewCamp] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchCamps = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 12 };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.camp_type = typeFilter;
            const res = await getCamps(params);
            setCamps(res.data?.data || []);
            setPagination(res.data?.pagination || { total: 0, pages: 1 });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [page, search, statusFilter, typeFilter]);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await getCampStats();
            setStats(res.data?.data || null);
        } catch (e) { console.error(e); }
        finally { setStatsLoading(false); }
    }, []);

    useEffect(() => { fetchCamps(); fetchStats(); }, [fetchCamps, fetchStats]);

    const openCreate = () => {
        setEditCamp(null);
        setForm(DEFAULT_FORM);
        setError('');
        setShowModal(true);
    };

    const openEdit = (camp) => {
        setEditCamp(camp);
        setForm({
            camp_name: camp.camp_name || '',
            camp_type: camp.camp_type || 'health_checkup',
            description: camp.description || '',
            location: { venue: camp.location?.venue || '', address: camp.location?.address || '', city: camp.location?.city || 'Mumbai', state: camp.location?.state || 'Maharashtra', pincode: camp.location?.pincode || '' },
            scheduled_date: camp.scheduled_date ? camp.scheduled_date.slice(0, 10) : '',
            end_date: camp.end_date ? camp.end_date.slice(0, 10) : '',
            start_time: camp.start_time || '',
            end_time: camp.end_time || '',
            organizer: camp.organizer || 'Dr. Indu',
            doctors_assigned: (camp.doctors_assigned || []).join(', '),
            target_beneficiaries: camp.target_beneficiaries || '',
            expected_attendance: camp.expected_attendance || '',
            registration_required: camp.registration_required || false,
            registration_link: camp.registration_link || '',
            status: camp.status || 'scheduled',
            notes: camp.notes || '',
            tags: (camp.tags || []).join(', ')
        });
        setError('');
        setShowModal(true);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('location.')) {
            const key = name.replace('location.', '');
            setForm(f => ({ ...f, location: { ...f.location, [key]: value } }));
        } else {
            setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleSave = async () => {
        if (!form.camp_name.trim()) return setError('Camp name is required.');
        if (!form.location.venue.trim()) return setError('Venue is required.');
        if (!form.scheduled_date) return setError('Scheduled date is required.');
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                doctors_assigned: form.doctors_assigned ? form.doctors_assigned.split(',').map(s => s.trim()).filter(Boolean) : [],
                tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
                expected_attendance: form.expected_attendance ? parseInt(form.expected_attendance) : 0,
            };
            if (editCamp) {
                await updateCamp(editCamp._id, payload);
            } else {
                await createCamp(payload);
            }
            setShowModal(false);
            fetchCamps();
            fetchStats();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save camp. Please try again.');
        } finally { setSaving(false); }
    };

    const handleStatusChange = async (camp, newStatus) => {
        try {
            await updateCampStatus(camp._id, newStatus);
            fetchCamps();
            fetchStats();
        } catch (e) { alert('Failed to update status'); }
    };

    const handleDelete = async (camp) => {
        try {
            await deleteCamp(camp._id);
            setDeleteConfirm(null);
            fetchCamps();
            fetchStats();
        } catch (e) { alert('Failed to delete camp'); }
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const statCards = [
        { label: 'Total Camps', value: stats?.total ?? '—', icon: Tent, color: '#6366f1', bg: '#ede9fe' },
        { label: 'Upcoming', value: stats?.upcoming ?? '—', icon: CalendarDays, color: '#0ea5e9', bg: '#e0f2fe' },
        { label: 'Ongoing', value: stats?.ongoing ?? '—', icon: Activity, color: '#f59e0b', bg: '#fef3c7' },
        { label: 'Completed', value: stats?.completed ?? '—', icon: CheckCircle2, color: '#10b981', bg: '#d1fae5' },
    ];

    return (
        <div style={{ padding: '1.5rem', background: '#f8fafc', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tent size={22} color="#fff" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.03em' }}>Schedule Camp</h1>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>Plan & manage medical outreach camps</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
                >
                    <Plus size={18} /> Schedule New Camp
                </button>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {statCards.map((s) => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: '14px', padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <s.icon size={20} color={s.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', lineHeight: 1.1 }}>{statsLoading ? '…' : s.value}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>
                    <Search size={15} color="#94a3b8" />
                    <input
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search camps, venue, city…"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#1e293b', width: '100%' }}
                    />
                    {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={14} color="#94a3b8" /></button>}
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, background: '#f8fafc', color: '#475569', cursor: 'pointer', outline: 'none' }}>
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, background: '#f8fafc', color: '#475569', cursor: 'pointer', outline: 'none' }}>
                    <option value="">All Types</option>
                    {CAMP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => { fetchCamps(); fetchStats(); }} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Camp Cards Grid */}
            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                    <RefreshCw size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600 }}>Loading camps…</p>
                </div>
            ) : camps.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0', padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Tent size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>No camps found</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>Click "Schedule New Camp" to get started.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {camps.map(camp => {
                        const typeInfo = getCampTypeInfo(camp.camp_type);
                        const statusInfo = STATUS_CONFIG[camp.status] || STATUS_CONFIG.scheduled;
                        const StatusIcon = statusInfo.icon;
                        return (
                            <div key={camp._id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
                            >
                                {/* Card Header Strip */}
                                <div style={{ height: '5px', background: `linear-gradient(90deg, ${typeInfo.color}, ${typeInfo.color}88)` }} />

                                <div style={{ padding: '1.1rem 1.25rem', flex: 1 }}>
                                    {/* Top row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div style={{ flex: 1, marginRight: '0.5rem' }}>
                                            <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#1e293b', lineHeight: 1.3 }}>{camp.camp_name}</div>
                                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, background: typeInfo.bg, color: typeInfo.color, borderRadius: '6px', padding: '2px 8px' }}>{typeInfo.label}</span>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, background: statusInfo.bg, color: statusInfo.color, borderRadius: '6px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <StatusIcon size={10} />{statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                            <CalendarDays size={13} color="#6366f1" />
                                            <span style={{ fontWeight: 700 }}>{formatDate(camp.scheduled_date)}</span>
                                            {camp.start_time && <span style={{ color: '#94a3b8' }}>• {camp.start_time}{camp.end_time ? ` - ${camp.end_time}` : ''}</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                            <MapPin size={13} color="#ec4899" style={{ marginTop: '2px', flexShrink: 0 }} />
                                            <span>{camp.location?.venue}{camp.location?.city ? `, ${camp.location.city}` : ''}</span>
                                        </div>
                                        {camp.organizer && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                                <Stethoscope size={13} color="#0ea5e9" />
                                                <span>{camp.organizer}</span>
                                            </div>
                                        )}
                                        {camp.expected_attendance > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                                <Users size={13} color="#10b981" />
                                                <span>Expected: <strong>{camp.expected_attendance}</strong></span>
                                            </div>
                                        )}
                                        {camp.target_beneficiaries && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                <Tag size={12} />
                                                <span style={{ fontStyle: 'italic' }}>{camp.target_beneficiaries}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Actions */}
                                <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.65rem 1.1rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button onClick={() => setViewCamp(camp)} title="View Details" style={{ border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 9px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#6366f1' }}>
                                            <Eye size={13} /> View
                                        </button>
                                        <button onClick={() => openEdit(camp)} title="Edit" style={{ border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 9px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                                            <Edit2 size={13} /> Edit
                                        </button>
                                        <button onClick={() => setDeleteConfirm(camp)} title="Delete" style={{ border: '1px solid #fee2e2', borderRadius: '7px', padding: '5px 9px', background: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    {/* Quick Status Change */}
                                    <select
                                        value={camp.status}
                                        onChange={e => handleStatusChange(camp, e.target.value)}
                                        style={{ border: '1px solid #e2e8f0', borderRadius: '7px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 800, background: statusInfo.bg, color: statusInfo.color, cursor: 'pointer', outline: 'none' }}
                                    >
                                        {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 1rem', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontSize: '0.82rem', fontWeight: 700 }}>← Prev</button>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#64748b', padding: '0 0.5rem' }}>Page {page} of {pagination.pages}</span>
                    <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 1rem', background: '#fff', cursor: page === pagination.pages ? 'not-allowed' : 'pointer', opacity: page === pagination.pages ? 0.5 : 1, fontSize: '0.82rem', fontWeight: 700 }}>Next →</button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
                        {/* Modal Header */}
                        <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '1.5rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Tent size={22} color="#fff" />
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>{editCamp ? 'Edit Camp' : 'Schedule New Camp'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>{editCamp ? 'Update camp details' : 'Plan a new outreach camp'}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} color="#fff" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>{error}</div>}

                            <Section title="Basic Information">
                                <FieldRow>
                                    <Field label="Camp Name *">
                                        <input name="camp_name" value={form.camp_name} onChange={handleFormChange} placeholder="e.g. Annual Vaccination Drive" style={inputStyle} />
                                    </Field>
                                    <Field label="Camp Type">
                                        <select name="camp_type" value={form.camp_type} onChange={handleFormChange} style={inputStyle}>
                                            {CAMP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </Field>
                                </FieldRow>
                                <Field label="Description">
                                    <textarea name="description" value={form.description} onChange={handleFormChange} rows={2} placeholder="Brief description of the camp…" style={{ ...inputStyle, resize: 'vertical' }} />
                                </Field>
                                <FieldRow>
                                    <Field label="Target Beneficiaries">
                                        <input name="target_beneficiaries" value={form.target_beneficiaries} onChange={handleFormChange} placeholder="e.g. Children 0–5 years" style={inputStyle} />
                                    </Field>
                                    <Field label="Expected Attendance">
                                        <input type="number" name="expected_attendance" value={form.expected_attendance} onChange={handleFormChange} placeholder="0" min="0" style={inputStyle} />
                                    </Field>
                                </FieldRow>
                            </Section>

                            <Section title="Schedule">
                                <FieldRow>
                                    <Field label="Date *">
                                        <input type="date" name="scheduled_date" value={form.scheduled_date} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                    <Field label="End Date">
                                        <input type="date" name="end_date" value={form.end_date} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                </FieldRow>
                                <FieldRow>
                                    <Field label="Start Time">
                                        <input type="time" name="start_time" value={form.start_time} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                    <Field label="End Time">
                                        <input type="time" name="end_time" value={form.end_time} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                </FieldRow>
                            </Section>

                            <Section title="Location">
                                <Field label="Venue *">
                                    <input name="location.venue" value={form.location.venue} onChange={handleFormChange} placeholder="Hall / Building name" style={inputStyle} />
                                </Field>
                                <Field label="Address">
                                    <input name="location.address" value={form.location.address} onChange={handleFormChange} placeholder="Street address" style={inputStyle} />
                                </Field>
                                <FieldRow>
                                    <Field label="City">
                                        <input name="location.city" value={form.location.city} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                    <Field label="State">
                                        <input name="location.state" value={form.location.state} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                    <Field label="Pincode">
                                        <input name="location.pincode" value={form.location.pincode} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                </FieldRow>
                            </Section>

                            <Section title="Medical Team">
                                <FieldRow>
                                    <Field label="Organizer">
                                        <input name="organizer" value={form.organizer} onChange={handleFormChange} style={inputStyle} />
                                    </Field>
                                    <Field label="Doctors Assigned (comma-separated)">
                                        <input name="doctors_assigned" value={form.doctors_assigned} onChange={handleFormChange} placeholder="Dr. X, Dr. Y" style={inputStyle} />
                                    </Field>
                                </FieldRow>
                            </Section>

                            <Section title="Additional">
                                <Field label="Tags (comma-separated)">
                                    <input name="tags" value={form.tags} onChange={handleFormChange} placeholder="free, ngo, government" style={inputStyle} />
                                </Field>
                                <FieldRow>
                                    <Field label="Status">
                                        <select name="status" value={form.status} onChange={handleFormChange} style={inputStyle}>
                                            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Registration Required">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                                            <input type="checkbox" name="registration_required" checked={form.registration_required} onChange={handleFormChange} style={{ width: '16px', height: '16px', accentColor: '#6366f1' }} />
                                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Yes, registration needed</span>
                                        </label>
                                    </Field>
                                </FieldRow>
                                {form.registration_required && (
                                    <Field label="Registration Link">
                                        <input name="registration_link" value={form.registration_link} onChange={handleFormChange} placeholder="https://…" style={inputStyle} />
                                    </Field>
                                )}
                                <Field label="Notes">
                                    <textarea name="notes" value={form.notes} onChange={handleFormChange} rows={2} placeholder="Any additional notes…" style={{ ...inputStyle, resize: 'vertical' }} />
                                </Field>
                            </Section>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button onClick={() => setShowModal(false)} style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '0.55rem 1.2rem', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Cancel</button>
                            <button onClick={handleSave} disabled={saving} style={{ border: 'none', borderRadius: '9px', padding: '0.55rem 1.4rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: saving ? 0.7 : 1 }}>
                                {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                                {saving ? 'Saving…' : editCamp ? 'Update Camp' : 'Schedule Camp'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewCamp && (
                <div onClick={() => setViewCamp(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
                        <div style={{ background: `linear-gradient(135deg, ${getCampTypeInfo(viewCamp.camp_type).color}, ${getCampTypeInfo(viewCamp.camp_type).color}bb)`, padding: '1.5rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{viewCamp.camp_name}</div>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{getCampTypeInfo(viewCamp.camp_type).label}</div>
                            </div>
                            <button onClick={() => setViewCamp(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={18} color="#fff" /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {viewCamp.description && <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>{viewCamp.description}</p>}
                            <DetailRow icon={CalendarDays} label="Date" value={`${formatDate(viewCamp.scheduled_date)}${viewCamp.end_date ? ` → ${formatDate(viewCamp.end_date)}` : ''}${viewCamp.start_time ? ` | ${viewCamp.start_time}${viewCamp.end_time ? ` - ${viewCamp.end_time}` : ''}` : ''}`} />
                            <DetailRow icon={MapPin} label="Venue" value={`${viewCamp.location?.venue || ''}${viewCamp.location?.address ? ', ' + viewCamp.location.address : ''}${viewCamp.location?.city ? ', ' + viewCamp.location.city : ''}`} />
                            <DetailRow icon={Stethoscope} label="Organizer" value={viewCamp.organizer} />
                            {viewCamp.doctors_assigned?.length > 0 && <DetailRow icon={Stethoscope} label="Doctors" value={viewCamp.doctors_assigned.join(', ')} />}
                            {viewCamp.target_beneficiaries && <DetailRow icon={Users} label="Target" value={viewCamp.target_beneficiaries} />}
                            {viewCamp.expected_attendance > 0 && <DetailRow icon={Users} label="Expected" value={`${viewCamp.expected_attendance} attendees`} />}
                            {viewCamp.tags?.length > 0 && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{viewCamp.tags.map(t => <span key={t} style={{ background: '#f1f5f9', color: '#475569', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>#{t}</span>)}</div>}
                            {viewCamp.notes && <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', fontSize: '0.82rem', color: '#475569', borderLeft: '3px solid #6366f1' }}>{viewCamp.notes}</div>}
                            {viewCamp.registration_required && viewCamp.registration_link && (
                                <a href={viewCamp.registration_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 800, textDecoration: 'none' }}>Register Link →</a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '2rem', maxWidth: '380px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}><Trash2 size={24} color="#ef4444" /></div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>Delete Camp?</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>This will cancel and remove <strong>"{deleteConfirm.camp_name}"</strong>. This action cannot be undone.</div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button onClick={() => setDeleteConfirm(null)} style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '0.5rem 1.2rem', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} style={{ border: 'none', borderRadius: '9px', padding: '0.5rem 1.4rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Helper Sub-components ────────────────────────────────────────────────────
const inputStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.7rem', fontSize: '0.84rem', outline: 'none', color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box' };

const Section = ({ title, children }) => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' }}>{title}</div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
    </div>
);

const FieldRow = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`, gap: '0.75rem' }}>{children}</div>
);

const Field = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
        {children}
    </div>
);

const DetailRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} color="#6366f1" />
        </div>
        <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginTop: '1px' }}>{value || '—'}</div>
        </div>
    </div>
);

export default ScheduleCamp;
