import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import './compact-theme.css';
import {
    LayoutDashboard,
    Calendar,
    Users,
    FileText,
    Settings as SettingsIcon,
    Clock,
    Bell,
    Search,
    LogOut,
    MessageSquare,
    Stethoscope,
    Shield,
    Hash,
    BarChart2,
    TrendingUp,
    Bell as BellIcon,
    Link as LinkIcon,
    Copy,
    Check,
    X,
    Loader2,
    Menu,
    Clipboard as ClipboardIcon
} from 'lucide-react';

// Lazy load page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Patients = lazy(() => import('./pages/Patients'));
const MRD = lazy(() => import('./pages/MRD'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const PublicRegister = lazy(() => import('./pages/PublicRegister'));
const BotInteractions = lazy(() => import('./pages/BotInteractions'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Admins = lazy(() => import('./pages/Admins'));
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ClinicDisplay = lazy(() => import('./pages/ClinicDisplay'));
const Feedback = lazy(() => import('./pages/Feedback'));
const FeedbackReports = lazy(() => import('./pages/FeedbackReports'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ClinicalEntry = lazy(() => import('./pages/ClinicalEntry'));


import { hasPermission, getUser, getToken } from './utils/auth';
import { removeSalutation } from './utils/formatters';
import NotificationDropdown from './components/NotificationDropdown';
import { getNotifications, scheduleReminder, getDoctors, searchPatients } from './api';

const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Appointment', path: '/appointments', icon: Calendar, permission: 'view_appointments' },
        { name: 'Patients', path: '/patients', icon: Users, permission: 'view_patients' },
        { name: 'Settings', path: '/settings', icon: SettingsIcon, permission: 'view_settings' },
    ].filter(item => hasPermission(item.permission));

    return (
        <div className="mobile-bottom-nav">
            {navItems.map((item) => (
                <Link
                    key={item.name}
                    to={item.path}
                    className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                    <item.icon size={22} />
                    <span>{item.name}</span>
                </Link>
            ))}
        </div>
    );
};


const Sidebar = ({ onLogout, isCollapsed, isMobileMenuOpen, onMobileClose }) => {
    const location = useLocation();
    const user = getUser();
    const displayName = removeSalutation(user.full_name || user.username || 'Admin');
    const initial = displayName.charAt(0).toUpperCase();
    const [showLogout, setShowLogout] = useState(false);

    const allNavSections = [
        {
            items: [
                { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
                { name: 'Appointments', path: '/appointments', icon: Calendar, permission: 'view_appointments' },
                { name: 'Queue Tokens', path: '/queue', icon: Hash, permission: 'view_queue' },
                { name: 'Patients', path: '/patients', icon: Users, permission: 'view_patients' },
                { name: 'Doctors', path: '/doctors', icon: Stethoscope, permission: 'view_doctors' },
                { name: 'Medical Records', path: '/mrd', icon: FileText, permission: 'view_mrd' },
                { name: 'New Clinical Entry', path: '/clinical-entry', icon: ClipboardIcon, permission: 'view_mrd' },

                { name: 'Reports & Analytics', path: '/analytics', icon: TrendingUp, permission: 'view_reports' },
                { name: 'Bot & Feedback Hub', path: '/bot-interactions', icon: MessageSquare, permission: 'view_bot_hub' },
                { name: 'Settings', path: '/settings', icon: SettingsIcon, permission: 'view_settings' },
            ]
        }
    ];

    const filteredSections = allNavSections.map(section => ({
        ...section,
        items: section.items.filter(item => hasPermission(item.permission))
    })).filter(section => section.items.length > 0);

    useEffect(() => {
        if (isMobileMenuOpen && onMobileClose) {
            onMobileClose();
        }
    }, [location.pathname]);

    return (
        <>
            {isMobileMenuOpen && <div className="mobile-sidebar-overlay" onClick={onMobileClose}></div>}
            <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header-premium">
                <Link to="/" className="brand-link-modern">
                    <div className="brand-info-modern">
                        <span className="brand-name-mini">PediPulse</span>
                        <span className="brand-desc-mini">Pediatric Care Portal</span>
                    </div>
                </Link>
            </div>

            <div className="sidebar-scroll-area">
                {filteredSections.map((section, idx) => (
                    <div key={idx} className="nav-section-modern">
                        <ul className="nav-links-modern">
                            {section.items.map((item) => {
                                const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
                                return (
                                    <li key={item.name}>
                                        <Link
                                            to={item.path}
                                            className={`nav-item-modern ${isActive ? 'active' : ''}`}
                                            title={item.name}
                                        >
                                            <item.icon size={18} className="nav-icon-v4" />
                                            <span>{item.name}</span>
                                            {isActive && <div className="active-indicator-v4" />}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="sidebar-footer-premium" style={{ padding: '8px' }}>
                <div className="user-profile-compact" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, background: 'transparent' }}>
                    <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => setShowLogout(!showLogout)}
                    >
                        <div className="user-avatar-mini" style={{ width: '28px', height: '28px', fontSize: '12px', background: 'linear-gradient(135deg, #0d7f6e 0%, #10b981 100%)', borderRadius: '50%' }}>{initial}</div>
                        <div className="user-info-mini" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span className="u-name" style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                            <span className="u-role" style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{user.role || 'Staff'}</span>
                        </div>
                    </div>
                    {showLogout && (
                        <button 
                            onClick={onLogout} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '6px', 
                                width: '100%', 
                                padding: '6px 10px', 
                                borderRadius: '6px', 
                                border: '1px solid #fee2e2', 
                                background: '#fff5f5', 
                                color: '#ef4444', 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
                            title="Logout"
                        >
                            <LogOut size={12} />
                            <span>Logout</span>
                        </button>
                    )}
                </div>
            </div>

        </div>
        </>
    );
};

const Header = ({ onMenuClick }) => {
    const user = getUser();
    const displayName = user.full_name || user.username || 'Admin';
    const displayRole = user.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'Admin';
    const initial = displayName.charAt(0).toUpperCase();
    const [showFormModal, setShowFormModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [reminder, setReminder] = useState({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
    const [doctors, setDoctors] = useState([]);
    const [savingReminder, setSavingReminder] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatients, setSelectedPatients] = useState([]);
    const [patientsList, setPatientsList] = useState([]);
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [copied, setCopied] = useState(false);
    const [feedbackCopied, setFeedbackCopied] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const publicFormUrl = `${window.location.origin}/register-form`;
    const feedbackFormUrl = `${window.location.origin}/feedback-form`;

    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const res = await getNotifications({ status: 'UNREAD' });
                setUnreadCount(res.data?.data?.length || 0);
            } catch (err) { }
        };
        fetchUnread();
        getDoctors({ all: true }).then(r => setDoctors(r.data?.data || [])).catch(() => { });
        const interval = setInterval(fetchUnread, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const handleScheduleReminder = async (e) => {
        e.preventDefault();
        if (selectedPatients.length === 0 && !reminder.patient_id) {
            alert('Please select or search at least one patient.');
            return;
        }
        setSavingReminder(true);
        try {
            const pIds = [...selectedPatients.map(p => p.patient_id)];
            if (reminder.patient_id && !pIds.includes(reminder.patient_id)) {
                // If the user typed an ID directly instead of using search
                pIds.push(reminder.patient_id);
            }

            await Promise.all(pIds.map(pId => 
                scheduleReminder({ ...reminder, patient_id: pId })
            ));

            setShowReminderModal(false);
            setReminder({ patient_id: '', doctor_id: '', message: '', scheduled_at: '' });
            setPatientSearch('');
            setSelectedPatients([]);
        } catch (err) {
            console.error('Failed to schedule reminders', err);
        } finally {
            setSavingReminder(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(publicFormUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleFeedbackCopy = () => {
        navigator.clipboard.writeText(feedbackFormUrl).then(() => {
            setFeedbackCopied(true);
            setTimeout(() => setFeedbackCopied(false), 2000);
        });
    };

    return (
        <>
            <header className="header" style={{ height: '48px', padding: '0 1.5rem' }}>
                <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={20} color="#64748b" />
                    </button>
                    <div className="header-welcome-msg" style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                        Welcome back, <span style={{ color: '#0d7f6e', fontWeight: 700 }}>{displayName}</span>
                    </div>
                    <div className="header-date" style={{ fontSize: '0.875rem', color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                </div>

                <div className="header-right" style={{ gap: '0.75rem' }}>
                    {/* Scheduled Reminder Button */}
                    <button
                        onClick={() => setShowReminderModal(true)}
                        className="mobile-hide header-btn-feedback"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff', gap: '6px' }}
                    >
                        <Clock size={16} />
                        Reminder
                    </button>

                    {/* Public Form Button */}
                    <button
                        onClick={() => setShowFormModal(true)}
                        className="mobile-hide header-btn-public"
                    >
                        <LinkIcon size={16} />
                        Public Form
                    </button>

                    {/* Feedback Form Button */}
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="mobile-hide header-btn-feedback"
                    >
                        <MessageSquare size={16} />
                        Feedback Form
                    </button>

                    <div className="mobile-hide header-bell-container" onClick={() => setIsNotifOpen(!isNotifOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
                        <Bell size={22} color={isNotifOpen ? "#0d7f6e" : "#64748b"} />
                        {unreadCount > 0 && <span className="header-bell-dot">{unreadCount}</span>}
                        <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
                    </div>
                </div>
            </header>

            {/* Public Form Link Modal */}
            {showFormModal && (
                <div
                    onClick={() => setShowFormModal(false)}
                    className="modal-overlay"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="modal-card"
                    >
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="modal-header-icon-container">
                                    <LinkIcon size={20} color="#fff" />
                                </div>
                                <div>
                                    <h3 className="modal-header-title">Public Registration Form</h3>
                                    <p className="modal-header-subtitle">Share this link with patients to register</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFormModal(false)}
                                className="modal-header-close"
                            >
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        <div className="modal-copy-container">
                            <span className="modal-copy-text">
                                {publicFormUrl}
                            </span>
                            <button
                                onClick={handleCopy}
                                className={`modal-copy-btn ${copied ? 'copied' : 'default'}`}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        <div className="modal-footer">
                            <a
                                href={publicFormUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="modal-footer-btn-open"
                            >
                                <LinkIcon size={15} /> Open Form
                            </a>
                            <button
                                onClick={() => setShowFormModal(false)}
                                className="modal-footer-btn-close"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Form Link Modal */}
            {showFeedbackModal && (
                <div
                    onClick={() => setShowFeedbackModal(false)}
                    className="modal-overlay"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="modal-card"
                    >
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="modal-header-icon-container" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                    <MessageSquare size={20} color="#fff" />
                                </div>
                                <div>
                                    <h3 className="modal-header-title">Patient Feedback Form</h3>
                                    <p className="modal-header-subtitle">Share this link with patients after their visit</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFeedbackModal(false)}
                                className="modal-header-close"
                            >
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        <div className="modal-copy-container">
                            <span className="modal-copy-text">
                                {feedbackFormUrl}
                            </span>
                            <button
                                onClick={handleFeedbackCopy}
                                className={`modal-copy-btn ${feedbackCopied ? 'copied' : 'default'}`}
                            >
                                {feedbackCopied ? <Check size={14} /> : <Copy size={14} />}
                                {feedbackCopied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        <div className="modal-footer">
                            <a
                                href={feedbackFormUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="modal-footer-btn-open"
                            >
                                <LinkIcon size={15} /> Open Form
                            </a>
                            <button
                                onClick={() => setShowFeedbackModal(false)}
                                className="modal-footer-btn-close"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Schedule Reminder Modal */}
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
                            borderRadius: '12px',
                            padding: '16px',
                            width: '100%',
                            maxWidth: '360px',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                            margin: '20px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={16} color="#f59e0b" /> Schedule Reminder
                            </h3>
                            <button
                                onClick={() => setShowReminderModal(false)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                            >
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        <form onSubmit={handleScheduleReminder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Patient (ID / Name / Mobile)</label>
                                <input
                                    type="text"
                                    required={selectedPatients.length === 0}
                                    placeholder="e.g. 26-AA1 or Search Patient"
                                    value={patientSearch}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPatientSearch(val);
                                        setReminder(prev => ({ ...prev, patient_id: val }));
                                        
                                        if (val.trim().length >= 2) {
                                            setLoadingPatients(true);
                                            searchPatients(val)
                                                .then(res => {
                                                    setPatientsList(res.data?.data || []);
                                                })
                                                .catch(() => {})
                                                .finally(() => setLoadingPatients(false));
                                        } else {
                                            setPatientsList([]);
                                        }
                                    }}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
                                />
                                {loadingPatients && (
                                    <div style={{ position: 'absolute', right: '12px', top: '28px' }}>
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                    </div>
                                )}
                                {patientsList.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10050, maxHeight: '160px', overflowY: 'auto', marginTop: '2px' }}>
                                        {patientsList.map(p => (
                                            <div
                                                key={p.patient_id}
                                                onClick={() => {
                                                    if (!selectedPatients.some(sp => sp.patient_id === p.patient_id)) {
                                                        setSelectedPatients([...selectedPatients, p]);
                                                    }
                                                    setPatientSearch('');
                                                    setReminder(prev => ({ ...prev, patient_id: '' }));
                                                    setPatientsList([]);
                                                }}
                                                style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', fontSize: '12px', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{p.child_name || p.patient_name}</div>
                                                <div style={{ fontSize: '10px', color: '#64748b' }}>ID: {p.patient_id} | Mobile: {p.patient_mobile}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Patients Chips */}
                            {selectedPatients.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                    {selectedPatients.map(p => (
                                        <div 
                                            key={p.patient_id} 
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, color: '#1e293b' }}
                                        >
                                            <span>{p.child_name || p.patient_name || p.patient_id}</span>
                                            <button 
                                                type="button"
                                                onClick={() => setSelectedPatients(selectedPatients.filter(sp => sp.patient_id !== p.patient_id))}
                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 0 }}
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Attending Clinician</label>
                                <select
                                    value={reminder.doctor_id}
                                    onChange={e => setReminder(p => ({ ...p, doctor_id: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', background: '#fff', outline: 'none' }}
                                >
                                    <option value="">Select Doctor (Optional)</option>
                                    {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Reminder Message</label>
                                <textarea
                                    required
                                    rows={2}
                                    placeholder="Type instructions here..."
                                    value={reminder.message}
                                    onChange={e => setReminder(p => ({ ...p, message: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', resize: 'none', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Schedule Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={reminder.scheduled_at}
                                    onChange={e => setReminder(p => ({ ...p, scheduled_at: e.target.value }))}
                                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button
                                    type="submit"
                                    disabled={savingReminder}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'linear-gradient(135deg, #0d7f6e, #0d7f6e)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
                                >
                                    {savingReminder ? '...' : 'Schedule Now'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReminderModal(false)}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
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

const ProtectedRoute = ({ children, permission }) => {
    const location = useLocation();
    if (!hasPermission(permission)) {
        if (location.pathname === '/') {
            return (
                <div className="not-authorized-container">
                    <Shield size={64} className="not-authorized-icon" />
                    <h2 className="not-authorized-title">Access Restricted</h2>
                    <p className="not-authorized-text">
                        Your role does not have the required permissions to view the Dashboard hub. Please contact your system administrator.
                    </p>
                    <Link to="/login" onClick={() => localStorage.clear()} className="btn btn-primary not-authorized-btn">Sign in as different user</Link>
                </div>
            )
        }
        return <Navigate to="/" replace />;
    }
    return children;
};

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogin = (token) => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setIsAuthenticated(false);
    };

    const PageLoader = () => (
        <div className="flex items-center justify-center min-h-screen w-full flex-col gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="text-slate-500 font-medium animate-pulse">Loading experience...</p>
        </div>
    );

    if (!isAuthenticated) {
        return (
            <Router>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login onLogin={handleLogin} />} />
                        <Route path="/register-form" element={<PublicRegister />} />
                        <Route path="/feedback-form" element={<Feedback />} />
                        <Route path="/clinic-display" element={<ClinicDisplay />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            </Router>
        );
    }

    return (
        <Router>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* Standalone Public Routes (No Sidebar/Header) */}
                    <Route path="/register-form" element={<PublicRegister />} />
                    <Route path="/feedback-form" element={<Feedback />} />
                    <Route path="/clinic-display" element={<ClinicDisplay />} />

                    {/* Admin Layout Routes */}
                    <Route path="/*" element={
                        <div className="app-container">
                            <Sidebar onLogout={handleLogout} isCollapsed={false} isMobileMenuOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
                            <main className="main-content">
                                <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
                                <Routes>
                                    <Route path="/" element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
                                    <Route path="/appointments" element={<ProtectedRoute permission="view_appointments"><Appointments /></ProtectedRoute>} />

                                    <Route path="/patients" element={<ProtectedRoute permission="view_patients"><Patients /></ProtectedRoute>} />
                                    <Route path="/bot-interactions" element={<ProtectedRoute permission="view_bot_hub"><BotInteractions /></ProtectedRoute>} />
                                    <Route path="/doctors" element={<ProtectedRoute permission="view_doctors"><Doctors /></ProtectedRoute>} />
                                    <Route path="/admins" element={<ProtectedRoute permission="view_admins"><Admins /></ProtectedRoute>} />
                                    <Route path="/mrd" element={<ProtectedRoute permission="view_mrd"><MRD /></ProtectedRoute>} />
                                    <Route path="/clinical-entry" element={<ProtectedRoute permission="view_mrd"><ClinicalEntry /></ProtectedRoute>} />

                                    <Route path="/queue" element={<ProtectedRoute permission="view_queue"><QueueDisplay /></ProtectedRoute>} />
                                    <Route path="/reports" element={<Navigate to="/analytics" replace />} />
                                    <Route path="/analytics" element={<ProtectedRoute permission="view_reports"><Analytics /></ProtectedRoute>} />
                                    <Route path="/notifications" element={<ProtectedRoute permission="view_notifications"><Notifications /></ProtectedRoute>} />
                                    <Route path="/feedback" element={<ProtectedRoute permission="view_feedback"><FeedbackReports /></ProtectedRoute>} />
                                    <Route path="/settings" element={<ProtectedRoute permission="view_settings"><Settings /></ProtectedRoute>} />
                                    <Route path="/login" element={<Navigate to="/" replace />} />
                                </Routes>
                            </main>
                        </div>
                    } />
                </Routes>
            </Suspense>
        </Router>
    );
};

export default App;
