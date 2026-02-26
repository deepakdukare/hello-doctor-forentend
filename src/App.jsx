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
    Shield
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

const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Home', path: '/', icon: LayoutDashboard },
        { name: 'Appts', path: '/appointments', icon: Calendar },
        { name: 'Slots', path: '/scheduling', icon: Clock },
        { name: 'Patients', path: '/patients', icon: Users },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
    ];

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

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Appointments', path: '/appointments', icon: Calendar },
        { name: 'Scheduling', path: '/scheduling', icon: Clock },

        { name: 'Patients', path: '/patients', icon: Users },
        { name: 'Bot Hub', path: '/bot-interactions', icon: MessageSquare },
        { name: 'Doctors', path: '/doctors', icon: Stethoscope },
        { name: 'Admin Users', path: '/admins', icon: Shield },
        { name: 'MRD', path: '/mrd', icon: FileText },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
    ];

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="logo">
                <div style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 4px 6px rgba(99, 102, 241, 0.2))' }}>🩺</div>
                <span>Dr. Indu Child Care</span>
            </div>
            <ul className="nav-links">
                {navItems.map((item) => (
                    <li key={item.name}>
                        <Link
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            title={
                                item.name === 'Appointments'
                                    ? "Manage clinic schedule and upcoming visits."
                                    : item.name === 'Scheduling'
                                        ? "Configure session timings and clinical capacity matrix."
                                        : item.name === 'Patients'
                                            ? "Manage patient records and registrations."
                                            : item.name === 'Bot Hub'
                                                ? "Track interactions from people who Haven't registered as patients yet."
                                                : item.name === 'Doctors'
                                                    ? "Manage clinic practitioners and specialities."
                                                    : item.name === 'Admin Users'
                                                        ? "Manage dashboard access for clinic staff."
                                                        : item.name === 'MRD'
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
            <div style={{ marginTop: 'auto', padding: '0.5rem' }}>
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

    return (
        <header className="header" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
    );
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
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/appointments" element={<Appointments />} />

                                <Route path="/patients" element={<Patients />} />
                                <Route path="/bot-interactions" element={<BotInteractions />} />
                                <Route path="/doctors" element={<Doctors />} />
                                <Route path="/admins" element={<Admins />} />
                                <Route path="/mrd" element={<MRD />} />
                                <Route path="/scheduling" element={<Scheduling />} />
                                <Route path="/settings" element={<Settings />} />
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
