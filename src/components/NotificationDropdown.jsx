import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, RefreshCw, AlertCircle, CheckCircle2, Check,
    Clock, Zap, Filter, Calendar, Plus, X, Trash2
} from 'lucide-react';
import { getNotifications, markNotificationRead, scheduleReminder, getDoctors } from '../api';

const SEVERITY_COLOR = {
    high: { bg: '#fee2e2', color: '#ef4444', dot: '#ef4444' },
    medium: { bg: '#fef3c7', color: '#d97706', dot: '#f59e0b' },
    low: { bg: '#e0f2fe', color: '#0284c7', dot: '#0ea5e9' },
    info: { bg: '#f4fdfa', color: '#0d7f6e', dot: '#0d7f6e' },
};

const NotificationItem = ({ notif, onMarkRead }) => {
    const sev = SEVERITY_COLOR[notif.severity] || SEVERITY_COLOR.info;
    return (
        <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f1f5f9',
            background: notif.is_read ? 'transparent' : '#f8faff',
            display: 'flex',
            gap: '12px',
            transition: 'all 0.2s',
            cursor: 'default'
        }}>
            <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: sev.dot,
                marginTop: '6px',
                flexShrink: 0
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {notif.title || notif.type}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                        {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {notif.message}
                </p>
                {!notif.is_read && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notif._id || notif.id);
                        }}
                        style={{
                            marginTop: '8px',
                            background: 'transparent',
                            border: 'none',
                            color: '#0d7f6e',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <Check size={12} /> Mark read
                    </button>
                )}
            </div>
        </div>
    );
};

const NotificationDropdown = ({ isOpen, onClose }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('ALL');
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [reminder, setReminder] = useState({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
    const [saving, setSaving] = useState(false);
    const dropdownRef = React.useRef(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filter === 'UNREAD') params.status = 'UNREAD';
            if (filter === 'HIGH') params.severity = 'high';
            const res = await getNotifications(params);
            setNotifications(res.data?.data || []);
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
            getDoctors({ all: true }).then(r => setDoctors(r.data?.data || [])).catch(() => { });
        }
    }, [isOpen, fetchNotifications]);

    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => (n._id === id || n.id === id) ? { ...n, is_read: true } : n));
        } catch (e) {
            console.error('Failed to mark read', e);
        }
    };

    const handleScheduleReminder = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await scheduleReminder(reminder);
            setShowReminderModal(false);
            setReminder({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
            fetchNotifications();
        } catch (e) {
            console.error('Failed to schedule reminder', e);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        width: '360px',
                        background: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                        zIndex: 1000,
                        marginTop: '12px',
                        border: '1px solid #f1f5f9',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '480px'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Notifications</h3>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 500 }}>System alerts & reminders</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setShowReminderModal(true)}
                            title="Schedule Reminder"
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #f4fdfa', background: '#f4fdfa', color: '#0d7f6e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <Calendar size={16} />
                        </button>
                        <button
                            onClick={fetchNotifications}
                            title="Refresh"
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                    {['ALL', 'UNREAD', 'HIGH'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: filter === f ? '#0d7f6e' : 'transparent',
                                color: filter === f ? '#fff' : '#64748b',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            {f === 'ALL' ? 'All' : f === 'UNREAD' ? 'Unread' : 'High Priority'}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', minHeight: '100px' }}>
                    {loading && notifications.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '8px' }} />
                            <p style={{ margin: 0, fontSize: '12px' }}>Loading alerts...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#94a3b8' }}>
                            <Bell size={40} style={{ opacity: 0.15, marginBottom: '12px' }} />
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No record found</p>
                        </div>
                    ) : (
                        notifications.map((n, i) => (
                            <NotificationItem key={n._id || n.id || i} notif={n} onMarkRead={handleMarkRead} />
                        ))
                    )}
                </div>

                <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <a href="/notifications" style={{ fontSize: '12px', fontWeight: 800, color: '#0d7f6e', textDecoration: 'none' }}>
                        View All Notifications
                    </a>
                </div>
            </div>

            {showReminderModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.6)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={() => setShowReminderModal(false)}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: '20px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '440px',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                            margin: '20px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={20} color="#f59e0b" /> Schedule Reminder
                            </h3>
                            <button
                                onClick={() => setShowReminderModal(false)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                            >
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        <form onSubmit={handleScheduleReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Patient ID</label>
                                <input
                                    required
                                    placeholder="e.g. 26-AA1"
                                    value={reminder.patient_id}
                                    onChange={e => setReminder(p => ({ ...p, patient_id: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Attending Clinician</label>
                                <select
                                    value={reminder.doctor_id}
                                    onChange={e => setReminder(p => ({ ...p, doctor_id: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', background: '#fff', outline: 'none' }}
                                >
                                    <option value="">Select Doctor (Optional)</option>
                                    {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Reminder Message</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Type instructions here..."
                                    value={reminder.message}
                                    onChange={e => setReminder(p => ({ ...p, message: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', resize: 'none', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Schedule Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={reminder.scheduled_at}
                                    onChange={e => setReminder(p => ({ ...p, scheduled_at: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #0d7f6e, #0d7f6e)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
                                >
                                    {saving ? 'Processing...' : 'Schedule Now'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReminderModal(false)}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Discard
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationDropdown;
