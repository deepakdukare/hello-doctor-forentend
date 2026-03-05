import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
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
    Bell as BellIcon,
    Link as LinkIcon,
    Copy,
    Check,
    X
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import MRD from './pages/MRD';
import Login from './pages/Login';
import Settings from './pages/Settings';

import PublicRegister from './pages/PublicRegister';
import BotInteractions from './pages/BotInteractions';
import Doctors from './pages/Doctors';
import Admins from './pages/Admins';
import Scheduling from './pages/Scheduling';
import QueueDisplay from './pages/QueueDisplay';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import ClinicDisplay from './pages/ClinicDisplay';
import { hasPermission } from './utils/auth';
import { removeSalutation } from './utils/formatters';

const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Appointment', path: '/appointments', icon: Calendar, permission: 'view_appointments' },
        { name: 'Scheduling', path: '/scheduling', icon: Clock, permission: 'view_scheduling' },
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


const Sidebar = ({ onLogout, isCollapsed }) => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const displayName = removeSalutation(user.full_name || user.username || 'Admin');
    const initial = displayName.charAt(0).toUpperCase();

    const allNavItems = [
        { name: 'Appointment', path: '/appointments', icon: Calendar, permission: 'view_appointments' },
        { name: 'Scheduling', path: '/scheduling', icon: Clock, permission: 'view_scheduling' },
        { name: 'Queue Tokens', path: '/queue', icon: Hash, permission: 'view_queue' },
        { name: 'Patients', path: '/patients', icon: Users, permission: 'view_patients' },
        { name: 'Bot Hub', path: '/bot-interactions', icon: MessageSquare, permission: 'view_bot_hub' },
        { name: 'Doctors', path: '/doctors', icon: Stethoscope, permission: 'view_doctors' },
        { name: 'Medical Documentation', path: '/mrd', icon: FileText, permission: 'view_mrd' },
        { name: 'Reports & Analytics', path: '/reports', icon: BarChart2, permission: 'view_reports' },
        { name: 'Notifications', path: '/notifications', icon: BellIcon, permission: 'view_notifications' },
        { name: 'Settings', path: '/settings', icon: SettingsIcon, permission: 'view_settings' },
    ];

    const navItems = allNavItems.filter(item => hasPermission(item.permission));

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <Link to="/" className="logo" style={{ textDecoration: 'none', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0', paddingLeft: 0, marginBottom: '0.75rem', justifyContent: 'center' }}>
                <img src="/logo.jpg" alt="Logo" style={{ width: '100px', height: '100px', borderRadius: '20px', objectFit: 'cover', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.12)' }} />
                <span style={{
                    fontSize: '1.6rem',
                    textAlign: 'center',
                    width: '100%',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-0.02em'
                }}>Dashboard</span>
            </Link>
            <ul className="nav-links">
                {navItems.map((item) => (
                    <li key={item.name}>
                        <Link
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            title={
                                item.name === 'Appointment'
                                    ? "Manage clinic schedule and upcoming visits."
                                    : item.name === 'Scheduling'
                                        ? "Configure session timings and clinical capacity matrix."
                                        : item.name === 'Patients'
                                            ? "Manage patient records and registrations."
                                            : item.name === 'Bot Hub'
                                                ? "Track interactions from people who haven't registered as patients yet."
                                                : item.name === 'Doctors'
                                                    ? "Manage clinic practitioners and specialities."
                                                    : item.name === 'Medical Documentation'
                                                        ? "Search a patient to view or update their longitudinal health file."
                                                        : ""
                            }
                        >
                            <item.icon size={20} />
                            <span>{item.name}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            {/* Removed user avatar button as requested */}
            <div style={{ marginTop: '0.5rem', padding: '0.5rem' }}>
                <button
                    onClick={onLogout}
                    className="nav-item"
                    style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        justifyContent: 'flex-start'
                    }}
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </div >
    );
};

const Header = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const displayName = user.full_name || user.username || 'Admin';
    const displayRole = user.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'Admin';
    const initial = displayName.charAt(0).toUpperCase();
    const [showFormModal, setShowFormModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const publicFormUrl = `${window.location.origin}/register-form`;

    const handleCopy = () => {
        navigator.clipboard.writeText(publicFormUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <>
            <header className="header" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {/* Public Form Button */}
                    <button
                        onClick={() => setShowFormModal(true)}
                        className="mobile-hide"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        <LinkIcon size={16} />
                        Public Form
                    </button>

                    <div style={{ position: 'relative', cursor: 'pointer', display: 'flex' }} className="mobile-hide">
                        <Bell size={22} color="#64748b" />
                        <span style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#ef4444',
                            borderRadius: '50%',
                            border: '2px solid #fff'
                        }}></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.4rem', borderRadius: '14px', transition: 'var(--transition)' }} className="profile-trigger">
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}>
                            {initial}
                        </div>
                    </div>
                </div>
            </header>

            {/* Public Form Link Modal */}
            {showFormModal && (
                <div
                    onClick={() => setShowFormModal(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(15,23,42,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: '20px',
                            padding: '2rem',
                            width: '100%',
                            maxWidth: '520px',
                            margin: '1rem',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.2)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <LinkIcon size={20} color="#fff" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Public Registration Form</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Share this link with patients to register</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFormModal(false)}
                                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            background: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '0.75rem 1rem'
                        }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: '#334155', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {publicFormUrl}
                            </span>
                            <button
                                onClick={handleCopy}
                                style={{
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 0.9rem',
                                    borderRadius: '8px',
                                    background: copied ? '#dcfce7' : 'linear-gradient(135deg, #6366f1, #4338ca)',
                                    color: copied ? '#16a34a' : '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                            <a
                                href={publicFormUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.7rem',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}
                            >
                                <LinkIcon size={15} /> Open Form
                            </a>
                            <button
                                onClick={() => setShowFormModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.7rem',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
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
                <div className="not-authorized-container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                    <Shield size={64} style={{ color: '#6366f1', marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b' }}>Access Restricted</h2>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '400px', margin: '1rem auto 2.5rem' }}>
                        Your role does not have the required permissions to view the Dashboard hub. Please contact your system administrator.
                    </p>
                    <Link to="/login" onClick={() => localStorage.clear()} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Sign in as different user</Link>
                </div>
            )
        }
        return <Navigate to="/" replace />;
    }
    return children;
};

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

    const handleLogin = (token) => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return (
            <Router>
                <Routes>
                    <Route path="/login" element={<Login onLogin={handleLogin} />} />
                    <Route path="/register-form" element={<PublicRegister />} />
                    <Route path="/clinic-display" element={<ClinicDisplay />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        );
    }

    return (
        <Router>
            <Routes>
                {/* Standalone Public Route (No Sidebar/Header) */}
                <Route path="/register-form" element={<PublicRegister />} />

                {/* Admin Layout Routes */}
                <Route path="/*" element={
                    <div className="app-container">
                        <Sidebar onLogout={handleLogout} isCollapsed={false} />
                        <main className="main-content">
                            <Header />
                            <Routes>
                                <Route path="/" element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
                                <Route path="/appointments" element={<ProtectedRoute permission="view_appointments"><Appointments /></ProtectedRoute>} />

                                <Route path="/patients" element={<ProtectedRoute permission="view_patients"><Patients /></ProtectedRoute>} />
                                <Route path="/bot-interactions" element={<ProtectedRoute permission="view_bot_hub"><BotInteractions /></ProtectedRoute>} />
                                <Route path="/doctors" element={<ProtectedRoute permission="view_doctors"><Doctors /></ProtectedRoute>} />
                                <Route path="/admins" element={<ProtectedRoute permission="view_admins"><Admins /></ProtectedRoute>} />
                                <Route path="/mrd" element={<ProtectedRoute permission="view_mrd"><MRD /></ProtectedRoute>} />
                                <Route path="/scheduling" element={<ProtectedRoute permission="view_scheduling"><Scheduling /></ProtectedRoute>} />
                                <Route path="/queue" element={<ProtectedRoute permission="view_queue"><QueueDisplay /></ProtectedRoute>} />
                                <Route path="/reports" element={<ProtectedRoute permission="view_reports"><Reports /></ProtectedRoute>} />
                                <Route path="/notifications" element={<ProtectedRoute permission="view_notifications"><Notifications /></ProtectedRoute>} />
                                <Route path="/clinic-display" element={<ClinicDisplay />} />
                                <Route path="/settings" element={<ProtectedRoute permission="view_settings"><Settings /></ProtectedRoute>} />
                                <Route path="/login" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>
                        <MobileNav />
                    </div>
                } />
            </Routes>
        </Router>
    );
};

export default App;
