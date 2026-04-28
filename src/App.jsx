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
    Menu
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


import { hasPermission, getUser, getToken } from './utils/auth';
import { removeSalutation } from './utils/formatters';
import NotificationDropdown from './components/NotificationDropdown';
import { getNotifications } from './api';

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

    const allNavSections = [
        {
            items: [
                { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
                { name: 'Appointments', path: '/appointments', icon: Calendar, permission: 'view_appointments' },
                { name: 'Queue Tokens', path: '/queue', icon: Hash, permission: 'view_queue' },
                { name: 'Patients', path: '/patients', icon: Users, permission: 'view_patients' },
                { name: 'Doctors', path: '/doctors', icon: Stethoscope, permission: 'view_doctors' },
                { name: 'Medical Records', path: '/mrd', icon: FileText, permission: 'view_mrd' },

                { name: 'Reports & Analytics', path: '/analytics', icon: TrendingUp, permission: 'view_reports' },
                { name: 'Feedback Hub', path: '/feedback', icon: MessageSquare, permission: 'view_feedback' },
                { name: 'Bot Hub', path: '/bot-interactions', icon: MessageSquare, permission: 'view_bot_hub' },
                { name: 'Notifications', path: '/notifications', icon: BellIcon, permission: 'view_notifications' },
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

            <div className="sidebar-footer-premium">
                <div className="user-profile-compact">
                    <div className="user-avatar-mini">{initial}</div>
                    <div className="user-info-mini">
                        <span className="u-name">{displayName}</span>
                        <span className="u-role">{user.role || 'Staff'}</span>
                    </div>
                    <button onClick={onLogout} className="btn-logout-minimal" title="Logout">
                        <LogOut size={16} />
                    </button>
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
        const interval = setInterval(fetchUnread, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

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
                <div className="header-left">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={20} color="#64748b" />
                    </button>
                    <div className="header-search">
                        <Search size={16} color="#9CA3AF" />
                        <input type="text" placeholder="Search" className="header-search-input" />
                    </div>
                </div>

                <div className="header-right" style={{ gap: '1rem' }}>
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
                    <div className="header-profile-trigger profile-trigger">
                        <div className="header-profile-avatar">
                            {initial}
                        </div>
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
