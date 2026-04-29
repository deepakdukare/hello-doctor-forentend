import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, RefreshCw, AlertCircle, CheckCircle2, Check,
    Clock, Zap, Filter, Calendar, Plus, X
} from 'lucide-react';
import { getNotifications, markNotificationRead, scheduleReminder, getDoctors } from '../api/index';

const SEVERITY_COLOR = {
    high: { bg: '#fee2e2', color: '#ef4444', dot: '#ef4444' },
    medium: { bg: '#fef3c7', color: '#d97706', dot: '#f59e0b' },
    low: { bg: '#e0f2fe', color: '#0284c7', dot: '#0ea5e9' },
    info: { bg: '#f4fdfa', color: '#0d7f6e', dot: '#0d7f6e' },
};

const NotifCard = ({ notif, onMarkRead }) => {
    const sev = SEVERITY_COLOR[notif.severity] || SEVERITY_COLOR.info;
    return (
        <div style={{ background: notif.is_read ? '#f8fafc' : '#fff', border: `1.5px solid ${notif.is_read ? '#f1f5f9' : '#e0e7ff'}`, borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', transition: 'all 0.2s', opacity: notif.is_read ? 0.7 : 1 }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: sev.dot, marginTop: '0.35rem', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{notif.title || notif.type || 'Notification'}</span>
                    <span style={{ background: sev.bg, color: sev.color, padding: '0.15rem 0.6rem', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{notif.severity || 'info'}</span>
                    {notif.is_read && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.15rem 0.6rem', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 700 }}>Read</span>}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>{notif.message || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>{notif.created_at ? new Date(notif.created_at).toLocaleString('en-IN') : ''}</div>
            </div>
            {!notif.is_read && (
                <button onClick={() => onMarkRead(notif._id || notif.id)}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: '8px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#16a34a', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                    <Check size={13} /> Mark Read
                </button>
            )}
        </div>
    );
};

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [filter, setFilter] = useState('ALL'); // ALL | UNREAD | HIGH
    const [showReminder, setShowReminder] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [reminder, setReminder] = useState({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
    const [savingReminder, setSavingReminder] = useState(false);

    const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };
    const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 5000); };

    useEffect(() => {
        getDoctors({ all: true }).then(r => setDoctors(r.data?.data || [])).catch(() => { });
    }, []);

    const fetchNotifications = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = {};
            if (filter === 'UNREAD') params.status = 'UNREAD';
            if (filter === 'HIGH') params.severity = 'high';
            const r = await getNotifications(params);
            setNotifications(r.data?.data || []);
        } catch (e) {
            showError(e.response?.data?.message || 'Failed to load notifications');
        } finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => (n._id === id || n.id === id) ? { ...n, is_read: true } : n));
            showSuccess('Notification marked as read');
        } catch (e) { showError(e.response?.data?.message || 'Failed to mark read'); }
    };

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.is_read);
        for (const n of unread) {
            try { await markNotificationRead(n._id || n.id); } catch { }
        }
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        showSuccess('All notifications marked as read');
    };

    const handleScheduleReminder = async (e) => {
        e.preventDefault();
        setSavingReminder(true);
        try {
            await scheduleReminder(reminder);
            showSuccess('Reminder scheduled successfully');
            setShowReminder(false);
            setReminder({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
        } catch (er) {
            showError(er.response?.data?.message || 'Failed to schedule reminder');
        } finally { setSavingReminder(false); }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="appointments-page-v4" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Notifications
                        {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 800 }}>{unreadCount}</span>}
                    </h1>
                    <p>System alerts and scheduled reminders</p>
                </div>
                <div className="header-right-v4">
                    {unreadCount > 0 && (
                        <button className="btn-header-v4" onClick={handleMarkAllRead}>
                            <CheckCircle2 size={16} />
                            <span>Mark All Read</span>
                        </button>
                    )}
                    <button className="btn-header-v4 btn-primary-v4" onClick={fetchNotifications}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.4rem', width: 'fit-content' }}>
                {['ALL', 'UNREAD', 'HIGH'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: 'none', background: filter === f ? '#0d7f6e' : 'transparent', color: filter === f ? '#fff' : '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s' }}>
                        {f === 'HIGH' ? 'High Priority' : f === 'UNREAD' ? 'Unread' : 'All'}
                    </button>
                ))}
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#dc2626', display: 'flex', gap: '0.75rem', alignItems: 'center' }}><AlertCircle size={18} />{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#16a34a', display: 'flex', gap: '0.75rem', alignItems: 'center' }}><CheckCircle2 size={18} />{success}</div>}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}><RefreshCw size={28} style={{ marginBottom: '0.75rem' }} /><p>Loading notifications...</p></div>
            ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                    <Bell size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p style={{ fontWeight: 600 }}>No notifications found</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {notifications.map((n, i) => <NotifCard key={n._id || n.id || i} notif={n} onMarkRead={handleMarkRead} />)}
                </div>
            )}

            {/* Schedule Reminder Modal */}
            {showReminder && (
                <div onClick={() => setShowReminder(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '480px', margin: '1rem', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Zap size={20} color="#f59e0b" /> Schedule Reminder</h3>
                            <button onClick={() => setShowReminder(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', display: 'flex' }}><X size={18} color="#64748b" /></button>
                        </div>
                        <form onSubmit={handleScheduleReminder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Patient ID</label>
                                <input value={reminder.patient_id} onChange={e => setReminder(p => ({ ...p, patient_id: e.target.value }))} required placeholder="26-AA1" style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Doctor</label>
                                <select value={reminder.doctor_id} onChange={e => setReminder(p => ({ ...p, doctor_id: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.875rem', background: '#fff' }}>
                                    <option value="">Select doctor (optional)</option>
                                    {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Message</label>
                                <textarea value={reminder.message} onChange={e => setReminder(p => ({ ...p, message: e.target.value }))} required rows={3} placeholder="Reminder message..." style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Scheduled At</label>
                                <input type="datetime-local" value={reminder.scheduled_at} onChange={e => setReminder(p => ({ ...p, scheduled_at: e.target.value }))} required style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="submit" disabled={savingReminder} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'linear-gradient(135deg, #0d7f6e, #064e3b)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                                    {savingReminder ? 'Scheduling...' : 'Schedule'}
                                </button>
                                <button type="button" onClick={() => setShowReminder(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
