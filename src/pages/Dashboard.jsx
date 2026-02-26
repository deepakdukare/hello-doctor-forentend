import React, { useState, useEffect } from 'react';
import {
    Users,
    Calendar,
    CheckCircle,
    Clock,
    Search,
    Plus,
    FileText,
    MessageSquare,
    Bell,
    ChevronRight,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    getSystemHealth,
    getAppointmentsByDate,
    getAppointmentStats,
    getPatients,
    getUnregisteredInteractions,
    getPendingReminders
} from '../api/index';

const StatCard = ({ title, value, subtitle, icon: Icon, color, loading }) => (
    <div className="stat-card">
        <div className="stat-icon" style={{ backgroundColor: `${color}15`, color }}>
            <Icon size={22} />
        </div>
        <div className="stat-value">
            {loading ? <span className="loading-dots">...</span> : value}
        </div>
        <div className="stat-label">{title}</div>
        {subtitle && <div className="stat-desc" style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>{subtitle}</div>}
    </div>
);

const QuickAction = ({ label, icon, to, color }) => (
    <Link to={to} className="action-card">
        <div className="action-icon" style={{ color }}>{icon}</div>
        <span className="action-label">{label}</span>
    </Link>
);

const AlertItem = ({ title, desc, icon: Icon, color, badge }) => (
    <div className="alert-item">
        <div className="alert-icon-wrap" style={{ backgroundColor: `${color}15`, color }}>
            <Icon size={18} />
        </div>
        <div className="alert-content">
            <div className="alert-title">{title}</div>
            <div className="alert-desc">{desc}</div>
        </div>
        {badge && <div className="section-badge" style={{ background: color }}>{badge}</div>}
    </div>
);

const Dashboard = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const apiDate = today.toISOString().split('T')[0];

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeTab, setActiveTab] = useState('Today');

    const [data, setData] = useState({
        stats: { totalPatients: 0, todayVisits: 0, completed: 0, pending: 0 },
        appointments: [],
        botInteractions: 0,
        pendingReminders: 0,
        escalations: 0,
        systemStatus: 'Healthy'
    });

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [
                statsRes,
                apptRes,
                patientRes,
                botRes,
                reminderRes,
                healthRes,
                escalationRes
            ] = await Promise.all([
                getAppointmentStats(apiDate),
                getAppointmentsByDate(apiDate),
                getPatients({ limit: 1 }),
                getUnregisteredInteractions(),
                getPendingReminders(),
                getSystemHealth(),
                getEscalations().catch(() => ({ data: { data: [] } }))
            ]);

            const stats = statsRes.data?.data || {};
            const appts = apptRes.data?.data || [];

            setData({
                stats: {
                    totalPatients: patientRes.data?.total || 0,
                    todayVisits: stats.total_today || appts.length,
                    completed: stats.completed || appts.filter(a => a.status === 'COMPLETED').length,
                    pending: stats.pending || appts.filter(a => a.status === 'CONFIRMED').length,
                },
                appointments: appts,
                botInteractions: botRes.data?.data?.length || 0,
                pendingReminders: reminderRes.data?.data?.length || 0,
                escalations: escalationRes.data?.data?.filter(e => e.status === 'PENDING').length || 0,
                systemStatus: healthRes.data?.database === 'connected' ? 'Healthy' : 'Degraded'
            });
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error('Dashboard Load Error:', err);
            setError("Failed to sync live data. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="dashboard-page">
            <div className="title-section" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.4rem' }}>Today's Overview</h1>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }}></span>
                        Live data for {dateStr}
                    </p>
                </div>
                <div className="filter-tabs">
                    {['Today', 'This Week', 'This Month'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div style={{ background: '#fff1f2', color: '#e11d48', padding: '1rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #fecdd3', fontSize: '0.9rem', fontWeight: 500 }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            <div className="dashboard-grid">
                {/* Left Column */}
                <div className="dashboard-main">
                    <div className="stats-grid">
                        <StatCard title="Total Patients" value={data.stats.totalPatients} subtitle="All registered patients" icon={Users} color="#6366f1" loading={loading} />
                        <StatCard title="Today's Visits" value={data.stats.todayVisits} subtitle="Checked-in today" icon={Calendar} color="#0ea5e9" loading={loading} />
                        <StatCard title="Completed Today" value={data.stats.completed} subtitle="Consultations done" icon={CheckCircle} color="#10b981" loading={loading} />
                        <StatCard title="Pending Appointments" value={data.stats.pending} subtitle="Awaiting confirmation" icon={Clock} color="#f59e0b" loading={loading} />
                    </div>

                    <div className="card" style={{ minHeight: '400px' }}>
                        <div className="card-header">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📋 Today's Appointments
                                </h3>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                                    Last updated {lastUpdated || '...'} • {dateStr}
                                </span>
                            </div>
                            <Link to="/appointments" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                                <Plus size={16} /> Book
                            </Link>
                        </div>

                        {loading ? (
                            <div className="empty-state">
                                <RefreshCw className="spin" size={32} color="#6366f1" />
                                <p style={{ marginTop: '1rem', color: '#64748b' }}>Syncing with clinic schedule...</p>
                            </div>
                        ) : data.appointments.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🗓️</div>
                                <div className="empty-title">No appointments booked today yet</div>
                                <p className="empty-text">Book a new appointment or wait for WhatsApp bot bookings to appear here.</p>
                                <Link to="/appointments" className="btn btn-outline" style={{ borderStyle: 'dashed' }}>
                                    <Calendar size={18} /> 📅 Book First Appointment
                                </Link>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Patient</th>
                                            <th>Visit Type</th>
                                            <th>Source</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.appointments.map(appt => (
                                            <tr key={appt.appointment_id}>
                                                <td style={{ fontWeight: 700, color: '#6366f1' }}>{appt.slot_label || '—'}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{appt.child_name || 'Walk-in'}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{appt.patient_id || 'unregistered'}</div>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{appt.visit_type}</span>
                                                </td>
                                                <td style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>{appt.booking_source}</td>
                                                <td>
                                                    <span className={`badge ${appt.status === 'COMPLETED' ? 'badge-success' : 'badge-primary'}`}>
                                                        {appt.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="dashboard-sidebar">
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div className="section-header">
                            <div className="section-title">⚡ Quick Actions</div>
                        </div>
                        <div className="quick-actions-grid">
                            <QuickAction label="New Patient" icon="👶" to="/patients" color="#6366f1" />
                            <QuickAction label="Book Appointment" icon="📅" to="/appointments" color="#0ea5e9" />
                            <QuickAction label="View MRD" icon="🗂️" to="/mrd" color="#10b981" />
                        </div>
                    </div>

                    <div>
                        <div className="section-header">
                            <div className="section-title">🔔 Alerts & Reminders</div>
                            <span style={{ fontSize: '0.75rem', color: '#22c55e', fontStyle: 'italic' }}>Live updates</span>
                        </div>
                        <div className="alerts-section">
                            <AlertItem
                                title={`${data.botInteractions} Bot Interactions`}
                                desc="Unregistered users messaged the WhatsApp bot"
                                icon={MessageSquare}
                                color="#6366f1"
                                badge={data.botInteractions > 0 ? `${data.botInteractions} New` : null}
                            />
                            {data.escalations > 0 && (
                                <AlertItem
                                    title={`${data.escalations} Support Escalations`}
                                    desc="Users requested human assistance"
                                    icon={AlertCircle}
                                    color="#e11d48"
                                    badge="URGENT"
                                />
                            )}
                            <AlertItem
                                title="24h Reminders Pending"
                                desc="Check tomorrow's appointments for reminders"
                                icon={Clock}
                                color="#f59e0b"
                                badge={data.pendingReminders > 0 ? `${data.pendingReminders}` : null}
                            />
                            <AlertItem
                                title={data.systemStatus === 'Healthy' ? "System Healthy" : "System Issues"}
                                desc={data.systemStatus === 'Healthy' ? "All APIs running normally" : "Database connection issues detected"}
                                icon={data.systemStatus === 'Healthy' ? CheckCircle : AlertCircle}
                                color={data.systemStatus === 'Healthy' ? "#10b981" : "#e11d48"}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

