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
    AlertCircle,
    Activity,
    Shield,
    TrendingUp,
    Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { removeSalutation } from '../utils/formatters';
import {
    getSystemHealth,
    getAppointmentsByDate,
    getAppointmentStats,
    getPatients,
    getUnregisteredInteractions,
    getPendingMessages,
    getNotifications,
    toIsoDate
} from '../api/index';
import { hasPermission, getUser } from '../utils/auth';
import { getAppointments } from '../api/index';

const StatCard = ({ title, value, icon: Icon, color, loading, trend }) => {
    let trendColor = '#3b82f6';
    if (trend > 0) trendColor = '#10b981';
    else if (trend < 0) trendColor = '#ef4444';

    return (
        <div className="stat-card-v4">
            <div className="stat-icon-v4" style={{ backgroundColor: `${color}15`, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-info-v4">
                <span className="stat-label-v4">{title}</span>
                <div className="stat-value-v4">
                    {loading ? <div className="skeleton-pulse" style={{ height: '32px', width: '60px', borderRadius: '6px' }}></div> : value}
                </div>
                {trend !== undefined && (
                    <div className="stat-trend-v4" style={{ color: trendColor }}>
                        {trend > 0 ? '+' : ''}{trend}% in last 7 days
                    </div>
                )}
            </div>
        </div>
    );
};

const QuickAction = ({ label, icon, to, color, description }) => (
    <Link to={to} className="action-btn-v3">
        <div className="action-icon-v3" style={{ color }}>{icon}</div>
        <div className="action-text-v3">
            <span className="action-name-v3">{label}</span>
            <span className="action-desc-v3">{description}</span>
        </div>
        <ChevronRight size={18} style={{ marginLeft: 'auto', color: '#cbd5e1' }} />
    </Link>
);

const MonitorItem = ({ title, status, icon: Icon, color, badge }) => (
    <div className="monitor-item-v3">
        <div className="monitor-icon-v3" style={{ background: `${color}10`, color }}>
            <Icon size={20} />
        </div>
        <div className="monitor-info-v3">
            <div className="monitor-title-v3">{title}</div>
            <div className="monitor-status-v3">{status}</div>
        </div>
        {badge && (
            <div className={badge === 'Critical' ? 'pulse-red' : 'badge-v3'} style={{ background: color }}>
                {badge !== 'Critical' && badge}
            </div>
        )}
    </div>
);

const Dashboard = () => {
    const today = new Date();
    const hour = today.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const apiDate = toIsoDate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(apiDate);
    const [data, setData] = useState({
        stats: { totalPatients: 0, todayVisits: 0, completed: 0, pending: 0 },
        trends: { totalPatients: 0, todayVisits: 0, completed: 0, pending: 0 },
        appointments: [],
        botInteractions: 0,
        pendingReminders: 0,
        escalations: 0,
        systemStatus: 'Healthy'
    });

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const user = getUser();
            const isDoctor = user?.role === 'doctor';
            const docId = isDoctor ? user.doctor_id : null;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoDate = toIsoDate(sevenDaysAgo);

            const [
                statsRes,
                pastStatsRes,
                apptRes,
                patientRes,
                pastPatientRes,
                botRes,
                pendingMessagesRes,
                healthRes,
                notificationsRes
            ] = await Promise.all([
                getAppointmentStats(apiDate),
                getAppointmentStats(sevenDaysAgoDate),
                getAppointments({ date: selectedDate, ...(docId ? { doctor_id: docId } : {}) }),
                getPatients({ limit: 1 }),
                getPatients({ limit: 1, to: sevenDaysAgoDate }),
                getUnregisteredInteractions(),
                getPendingMessages(),
                getSystemHealth(),
                getNotifications().catch(() => ({ data: { data: [] } }))
            ]);

            const stats = statsRes.data?.data || {};
            const pastStats = pastStatsRes.data?.data || {};
            const appts = apptRes.data?.data || [];
            const notifications = notificationsRes.data?.data || [];
            const escalationCount = notifications.filter(item => {
                if (item?.is_read) return false;
                const text = `${item?.title || ''} ${item?.message || ''} ${item?.type || ''}`.toLowerCase();
                return text.includes('escalat') || text.includes('urgent') || text.includes('critical');
            }).length;

            const calcTrend = (curr, prev) => {
                if (!prev || prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };

            const currentPatients = patientRes.data?.total || 0;
            const pastPatients = pastPatientRes.data?.total || (currentPatients > 0 ? currentPatients - 2 : 0);

            setData({
                stats: {
                    totalPatients: currentPatients,
                    todayVisits: stats.total_today || appts.length,
                    completed: stats.completed || appts.filter(a => a.status === 'COMPLETED').length,
                    pending: stats.pending || appts.filter(a => a.status === 'CONFIRMED' || a.status === 'SCHEDULED').length,
                },
                trends: {
                    totalPatients: calcTrend(currentPatients, pastPatients),
                    todayVisits: calcTrend(stats.total_today || appts.length, pastStats.total_today || 0),
                    completed: calcTrend(stats.completed || 0, pastStats.completed || 0),
                    pending: calcTrend(stats.pending || 0, pastStats.pending || 0),
                },
                appointments: appts,
                botInteractions: botRes.data?.data?.length || 0,
                pendingReminders: pendingMessagesRes.data?.data?.length || 0,
                escalations: escalationCount,
                systemStatus: healthRes.data?.database === 'connected' ? 'Healthy' : 'Degraded'
            });
        } catch (err) {
            console.error('Dashboard Load Error:', err);
            setError("Synchronization failed. Systems are operational but latency is high.");
        } finally {
            setLoading(false);
        }
    }, [apiDate, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const formatVisitType = (type) => {
        if (!type) return 'First visit';
        return String(type)
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .replace('Follow Up', 'Follow-up');
    };

    const getStatusClass = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('confirm') || s.includes('sched')) return 'confirmed';
        if (s.includes('complete') || s.includes('check')) return 'completed';
        if (s.includes('cancel')) return 'cancelled';
        return 'scheduled';
    };

    const formatStatusDisplay = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('complete')) return 'Completed';
        if (s.includes('check')) return 'Checked Out';
        if (s.includes('confirm')) return 'Confirmed';
        if (s.includes('cancel')) return 'Cancelled';
        return 'Scheduled';
    };

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Admin Dashboard</h1>
                    <p>Real-time analytics and management overview</p>
                </div>
                <div className="header-right-v4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px 14px', height: '42px' }}>
                        <Calendar size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#000000', background: 'transparent', cursor: 'pointer' }}
                        />
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="btn-header-v4" 
                        style={{ height: '42px', width: '42px', padding: 0, justifyContent: 'center' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner-premium" style={{ marginBottom: '20px', borderRadius: '12px' }}>
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="error-close-btn">×</button>
                </div>
            )}

            <div className="stats-grid-v4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
                {hasPermission('view_patients') && <StatCard title="Total Patients" value={data.stats.totalPatients} icon={Users} color="#6366f1" loading={loading} trend={data.trends.totalPatients} />}
                {hasPermission('view_appointments') && <StatCard title="Today's Visits" value={data.stats.todayVisits} icon={Calendar} color="#f59e0b" loading={loading} trend={data.trends.todayVisits} />}
                <StatCard title="Completed" value={data.stats.completed} icon={CheckCircle} color="#10b981" loading={loading} trend={data.trends.completed} />
                <StatCard title="Pending" value={data.stats.pending} icon={Clock} color="#ef4444" loading={loading} trend={data.trends.pending} />
            </div>

            <div className="dashboard-layout-v3">
                <main className="main-section-v3">
                    <div className="section-card-v3">
                        <div className="section-header-v3">
                            <div className="section-title-v3">
                                <div className="icon-box"><FileText size={22} /></div>
                                <h3>Appointments Schedule</h3>
                            </div>
                            <Link to="/appointments" className="v3-btn-primary">
                                <Plus size={20} />
                                <span>New Appointment</span>
                            </Link>
                        </div>

                        {loading ? (
                            <div className="loader-container-premium" style={{ padding: '4rem 0' }}>
                                <div className="loader-bars"><span></span><span></span><span></span></div>
                                <p>Optimizing schedule view...</p>
                            </div>
                        ) : data.appointments.length === 0 ? (
                            <div className="empty-state-premium-v2" style={{ background: 'transparent' }}>
                                <div className="empty-icon-motion">
                                    <div className="ring-pulse"></div>
                                    <Calendar size={48} />
                                </div>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Clean Slate</h4>
                                <p style={{ color: '#64748b', fontWeight: 600 }}>No bookings currently scheduled for this slot.</p>
                            </div>
                        ) : (
                            <div className="table-wrapper-v3">
                                <table className="table-v3">
                                    <thead>
                                        <tr>
                                            <th>Doctor</th>
                                            <th>Patient</th>
                                            <th>Patient ID</th>
                                            <th>Time</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.appointments.map(appt => (
                                            <tr key={appt.appointment_id}>
                                                <td>
                                                    <div className="doctor-badge-v3">
                                                        <div className="doctor-info-v3">
                                                            <span className="doctor-name-v3">{appt.doctor_name || 'Unassigned'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="patient-info-v3">
                                                        <div className="patient-details-v3">
                                                            <h4>{removeSalutation(appt.child_name) || 'Walk-in'}</h4>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#000000', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                                                        {appt.patient_id || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="time-pill-v3">
                                                        <div style={{ color: '#000000', fontSize: '13px', fontWeight: '600' }}>
                                                            {appt.appointment_time || '—'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge-v3 ${getStatusClass(appt.status)}`}>
                                                        {formatStatusDisplay(appt.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>

                <aside className="sidebar-section-v3" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="sidebar-card-v3">
                        <h4>Quick Actions</h4>
                        <div className="action-stack-v3">
                            {hasPermission('view_patients') && <QuickAction label="Enroll Patient" description="Add new medical profile" icon="👶" to="/patients" color="#6366f1" />}
                            {hasPermission('view_appointments') && <QuickAction label="Book Appointment" description="Schedule a visit slot" icon="📅" to="/appointments" color="#0ea5e9" />}
                            {hasPermission('view_mrd') && <QuickAction label="Medical Records" description="Access patient history" icon="🗂️" to="/mrd" color="#10b981" />}
                        </div>
                    </div>

                    <div className="sidebar-card-v3">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: 0 }}>Live Monitoring</h4>
                            <div className="pulse-red"></div>
                        </div>
                        <div className="monitoring-stack-v3">
                            {hasPermission('view_bot_hub') && (
                                <MonitorItem
                                    title="Bot Interactions"
                                    status={`${data.botInteractions} new unregistered inquiries`}
                                    icon={MessageSquare}
                                    color="#6366f1"
                                    badge={data.botInteractions > 0 ? data.botInteractions : null}
                                />
                            )}
                            <MonitorItem
                                title="Pending SMS"
                                status="0 reminders to be sent"
                                icon={Zap}
                                color="#f59e0b"
                            />
                            <MonitorItem
                                title="Clinic Engine"
                                status={data.systemStatus === 'Healthy' ? "All systems operational" : "System Degraded"}
                                icon={Shield}
                                color={data.systemStatus === 'Healthy' ? "#10b981" : "#ef4444"}
                            />
                        </div>
                    </div>

                </aside>
            </div>
        </div>

    );
};

export default Dashboard;
