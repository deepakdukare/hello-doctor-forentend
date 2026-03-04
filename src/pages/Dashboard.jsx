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
import {
    getSystemHealth,
    getAppointmentsByDate,
    getAppointmentStats,
    getPatients,
    getUnregisteredInteractions,
    getPendingMessages,
    getNotifications
} from '../api/index';
import { hasPermission } from '../utils/auth';

const StatCard = ({ title, value, subtitle, icon: Icon, color, loading, trend }) => (
    <div className="stat-card-premium">
        <div className="stat-card-inner">
            <div className="stat-icon-premium" style={{
                background: `linear-gradient(135deg, ${color}15 0%, ${color}30 100%)`,
                color: color
            }}>
                <Icon size={24} />
            </div>
            <div className="stat-content">
                <div className="stat-value-premium">
                    {loading ? <div className="skeleton-pulse" style={{ width: '60px', height: '32px', borderRadius: '8px' }}></div> : value}
                </div>
                <div className="stat-label-premium">{title}</div>
            </div>
            {trend && (
                <div className="stat-trend" style={{ color: trend > 0 ? '#10b981' : '#64748b' }}>
                    <TrendingUp size={14} />
                    <span>{trend}%</span>
                </div>
            )}
        </div>
        {!loading && <div className="stat-subtitle-premium">{subtitle}</div>}
    </div>
);

const QuickAction = ({ label, icon, to, color, description }) => (
    <Link to={to} className="action-card-premium">
        <div className="action-icon-premium" style={{ color }}>{icon}</div>
        <div className="action-info-premium">
            <span className="action-label-premium">{label}</span>
            <span className="action-desc-premium">{description}</span>
        </div>
        <ChevronRight size={18} className="action-arrow" />
    </Link>
);

const AlertItem = ({ title, desc, icon: Icon, color, badge }) => (
    <div className="alert-item-premium">
        <div className="alert-icon-wrap-premium" style={{ background: `${color}10`, color }}>
            <Icon size={20} />
        </div>
        <div className="alert-content-premium">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="alert-title-premium">{title}</span>
                {badge && <span className="alert-badge-premium" style={{ background: color === '#e11d48' ? 'rgba(225, 29, 72, 0.1)' : 'rgba(99, 102, 241, 0.1)', color }}>{badge}</span>}
            </div>
            <div className="alert-desc-premium">{desc}</div>
        </div>
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
                pendingMessagesRes,
                healthRes,
                notificationsRes
            ] = await Promise.all([
                getAppointmentStats(apiDate),
                getAppointmentsByDate(apiDate),
                getPatients({ limit: 1 }),
                getUnregisteredInteractions(),
                getPendingMessages(),
                getSystemHealth(),
                getNotifications().catch(() => ({ data: { data: [] } }))
            ]);

            const stats = statsRes.data?.data || {};
            const appts = apptRes.data?.data || [];

            const notifications = notificationsRes.data?.data || [];
            const escalationCount = notifications.filter((item) => {
                if (item?.is_read) return false;
                const text = `${item?.title || ''} ${item?.message || ''} ${item?.type || ''}`.toLowerCase();
                return text.includes('escalat') || text.includes('urgent') || text.includes('critical');
            }).length;

            setData({
                stats: {
                    totalPatients: patientRes.data?.total || 0,
                    todayVisits: stats.total_today || appts.length,
                    completed: stats.completed || appts.filter(a => a.status === 'COMPLETED').length,
                    pending: stats.pending || appts.filter(a => a.status === 'CONFIRMED').length,
                },
                appointments: appts,
                botInteractions: botRes.data?.data?.length || 0,
                pendingReminders: pendingMessagesRes.data?.data?.length || 0,
                escalations: escalationCount,
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
        <div className="dashboard-page-v2">
            <div className="header-section-premium">
                <div className="header-content-premium">
                    <h1 className="header-title-premium">Dashboard</h1>
                    <div className="live-pill-premium">
                        <span className="live-dot"></span>
                        <span className="live-text">Live • {dateStr}</span>
                    </div>
                </div>
                <div className="header-actions-premium">
                    <button onClick={fetchData} className="refresh-btn-premium" title="Refresh Data">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner-premium">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="error-close-btn">×</button>
                </div>
            )}

            <div className="dashboard-grid-v2">
                <div className="main-content-v2">
                    <div className="stats-grid-v2">
                        {hasPermission('view_patients') && <StatCard title="Total Patients" value={data.stats.totalPatients} subtitle="Active registry profiles" icon={Users} color="#6366f1" loading={loading} />}
                        {hasPermission('view_appointments') && <StatCard title="Today's Visits" value={data.stats.todayVisits} subtitle="Checked-in today" icon={Calendar} color="#0ea5e9" loading={loading} />}
                        <StatCard title="Completed" value={data.stats.completed} subtitle="Sessions concluded" icon={CheckCircle} color="#10b981" loading={loading} />
                        <StatCard title="Pending" value={data.stats.pending} subtitle="Awaiting consultation" icon={Clock} color="#f59e0b" loading={loading} />
                    </div>

                    <div className="card-premium-v2 appointments-card">
                        <div className="card-header-premium">
                            <div className="card-title-group">
                                <h3 className="card-title-premium">
                                    <FileText size={20} />
                                    <span>Appointments Schedule</span>
                                </h3>
                                <p className="card-subtitle-premium">Live schedule queue for {dateStr}</p>
                            </div>
                            <Link to="/appointments" className="add-btn-premium">
                                <Plus size={18} />
                                <span>Book Visit</span>
                            </Link>
                        </div>

                        {loading ? (
                            <div className="loader-container-premium">
                                <div className="loader-bars">
                                    <span></span><span></span><span></span>
                                </div>
                                <p>Syncing schedule...</p>
                            </div>
                        ) : data.appointments.length === 0 ? (
                            <div className="empty-state-premium-v2">
                                <div className="empty-icon-motion">
                                    <div className="ring-pulse"></div>
                                    <Calendar size={48} />
                                </div>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>No appointments today</h4>
                                <p style={{ color: '#64748b', maxWidth: '300px', margin: '0 auto 2rem', fontWeight: 500, lineHeight: 1.5 }}>
                                    The schedule is currently open. New bookings will appear here instantly.
                                </p>
                                <Link to="/appointments" className="book-first-btn-premium">
                                    <Plus size={20} />
                                    <span>Book First Patient</span>
                                </Link>
                            </div>
                        ) : (
                            <div className="table-wrapper-premium">
                                <table className="table-premium-v2">
                                    <thead>
                                        <tr>
                                            <th>Time Slot</th>
                                            <th>Patient Name</th>
                                            <th>Doctor</th>
                                            <th>Category</th>
                                            <th>Source</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.appointments.map(appt => (
                                            <tr key={appt.appointment_id} className="row-hover-premium">
                                                <td className="slot-cell-premium">
                                                    <div className="time-pill">{appt.slot_label || 'TBD'}</div>
                                                </td>
                                                <td>
                                                    <div className="patient-name-premium">{appt.child_name || 'Walk-in'}</div>
                                                    <div className="patient-id-premium">{appt.patient_id || 'TEMP-ID'}</div>
                                                </td>
                                                <td>
                                                    <div className="doctor-name-premium">{appt.doctor_name || 'Not Assigned'}</div>
                                                </td>
                                                <td>
                                                    <span className="category-pill-premium">{appt.visit_type}</span>
                                                </td>
                                                <td className="source-cell-premium">
                                                    <span className="source-tag">{appt.booking_source}</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill-v2 ${appt.status.toLowerCase()}`}>
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

                <div className="sidebar-content-v2">
                    <div className="sidebar-section-premium">
                        <h4 className="sidebar-title-premium">Quick Actions</h4>
                        <div className="actions-stack-premium">
                            {hasPermission('view_patients') && <QuickAction label="Enroll Patient" description="Add new medical profile" icon="👶" to="/patients" color="#6366f1" />}
                            {hasPermission('view_appointments') && <QuickAction label="Book Appointment" description="Schedule a visit slot" icon="📅" to="/appointments" color="#0ea5e9" />}
                            {hasPermission('view_mrd') && <QuickAction label="Medical Records" description="Access patient history" icon="🗂️" to="/mrd" color="#10b981" />}
                        </div>
                    </div>

                    <div className="sidebar-section-premium">
                        <div className="sidebar-header-row">
                            <h4 className="sidebar-title-premium">Live Monitoring</h4>
                            <div className="pulse-indicator"></div>
                        </div>
                        <div className="alerts-stack-premium">
                            {hasPermission('view_bot_hub') && (
                                <AlertItem
                                    title="Bot Interactions"
                                    desc={`${data.botInteractions} new unregistered inquiries`}
                                    icon={MessageSquare}
                                    color="#6366f1"
                                    badge={data.botInteractions > 0 ? "New" : null}
                                />
                            )}
                            {data.escalations > 0 && (
                                <AlertItem
                                    title="Urgent Escalations"
                                    desc={`${data.escalations} human support requests`}
                                    icon={AlertCircle}
                                    color="#e11d48"
                                    badge="Critical"
                                />
                            )}
                            <AlertItem
                                title="Pending SMS"
                                desc={`${data.pendingReminders} reminders to be sent`}
                                icon={Zap}
                                color="#f59e0b"
                            />
                            <AlertItem
                                title="Clinic Engine"
                                desc={data.systemStatus === 'Healthy' ? "All systems operational" : "Connection sluggish"}
                                icon={Shield}
                                color={data.systemStatus === 'Healthy' ? "#10b981" : "#e11d48"}
                            />
                        </div>
                    </div>

                    <div className="system-health-premium">
                        <div className="health-stats-premium">
                            <div className="health-stat-premium">
                                <span>API Latency</span>
                                <strong>124ms</strong>
                            </div>
                            <div className="health-divider"></div>
                            <div className="health-stat-premium">
                                <span>Uptime</span>
                                <strong>99.9%</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .dashboard-page-v2 {
                    padding: 1.5rem;
                    max-width: 1600px;
                    margin: 0 auto;
                    animation: pageFadeIn 0.6s ease-out;
                }

                @keyframes pageFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .header-section-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .header-title-premium {
                    font-size: 2.5rem;
                    font-weight: 900;
                    letter-spacing: -0.03em;
                    background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .live-pill-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    background: #fff;
                    padding: 0.4rem 1rem;
                    border-radius: 50px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                    border: 1px solid #f1f5f9;
                    margin-top: 0.75rem;
                    width: fit-content;
                }

                .live-dot {
                    width: 8px;
                    height: 8px;
                    background: #10b981;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #10b981;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .live-text {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #64748b;
                }

                .header-actions-premium {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .filter-group-premium {
                    background: #fff;
                    padding: 0.4rem;
                    border-radius: 16px;
                    display: flex;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                    border: 1px solid #f1f5f9;
                }

                .filter-tab-premium {
                    padding: 0.5rem 1.25rem;
                    border-radius: 12px;
                    border: none;
                    background: transparent;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .filter-tab-premium.active {
                    background: #6366f1;
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
                }

                .refresh-btn-premium {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }

                .refresh-btn-premium:hover {
                    border-color: #6366f1;
                    color: #6366f1;
                    transform: rotate(30deg);
                }

                .dashboard-grid-v2 {
                    display: grid;
                    grid-template-columns: 1fr 380px;
                    gap: 1.5rem;
                }

                .stats-grid-v2 {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card-premium {
                    background: #fff;
                    padding: 1.25rem;
                    border-radius: 28px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.02);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .stat-card-premium:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.06);
                    border-color: #e0e7ff;
                }

                .stat-card-inner {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    margin-bottom: 1rem;
                }

                .stat-icon-premium {
                    width: 52px;
                    height: 52px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-value-premium {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 0.15rem;
                    font-family: 'Outfit', sans-serif;
                }

                .stat-label-premium {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .stat-trend {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    font-size: 0.75rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 0.2rem;
                    background: #f0fdf4;
                    padding: 0.25rem 0.6rem;
                    border-radius: 50px;
                }

                .stat-subtitle-premium {
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .card-premium-v2 {
                    background: #fff;
                    border-radius: 32px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.02);
                    overflow: hidden;
                }

                .card-header-premium {
                    padding: 2rem 2.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    background: linear-gradient(to bottom, #fcfdff, #fff);
                    border-bottom: 1px solid #f8fafc;
                }

                .card-title-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                }

                .card-subtitle-premium {
                    font-size: 0.95rem;
                    color: #94a3b8;
                    font-weight: 500;
                    margin-top: 0.4rem;
                }

                .add-btn-premium {
                    background: #6366f1;
                    color: #fff;
                    text-decoration: none;
                    padding: 0.75rem 1.75rem;
                    border-radius: 16px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    transition: all 0.2s;
                    box-shadow: 0 8px 16px rgba(99, 102, 241, 0.2);
                }

                .add-btn-premium:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 20px rgba(99, 102, 241, 0.3);
                    filter: brightness(1.1);
                }

                .table-wrapper-premium {
                    padding: 0 1.5rem 1.5rem;
                }

                .table-premium-v2 {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0 0.75rem;
                }

                .table-premium-v2 th {
                    padding: 1rem 1.5rem;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    text-align: left;
                }

                .row-hover-premium {
                    transition: all 0.2s;
                }

                .row-hover-premium td {
                    padding: 1.25rem 1.5rem;
                    background: #fff;
                    transition: all 0.2s;
                }

                .row-hover-premium:hover td {
                    background: #f8faff;
                }

                .row-hover-premium td:first-child { border-radius: 18px 0 0 18px; border-left: 1px solid #f1f5f9; }
                .row-hover-premium td:last-child { border-radius: 0 18px 18px 0; border-right: 1px solid #f1f5f9; }
                .row-hover-premium td { border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }

                .time-pill {
                    background: #eff6ff;
                    color: #2563eb;
                    padding: 0.4rem 0.8rem;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: 0.85rem;
                    width: fit-content;
                }

                .patient-name-premium {
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 1rem;
                }

                .patient-id-premium {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    font-weight: 600;
                    margin-top: 0.15rem;
                }

                .category-pill-premium {
                    background: #f8fafc;
                    padding: 0.35rem 0.75rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #64748b;
                    border: 1px solid #f1f5f9;
                }

                .source-tag {
                    font-size: 0.75rem;
                    text-transform: capitalize;
                    font-weight: 600;
                    color: #64748b;
                }

                .status-pill-v2 {
                    padding: 0.4rem 1rem;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .status-pill-v2.confirmed { background: #eff6ff; color: #2563eb; }
                .status-pill-v2.completed { background: #f0fdf4; color: #16a34a; }
                .status-pill-v2.cancelled { background: #fef2f2; color: #ef4444; }

                /* Sidebar Styles */
                .sidebar-section-premium {
                    background: #fff;
                    border-radius: 28px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.02);
                }

                .sidebar-title-premium {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 1.5rem;
                    letter-spacing: -0.01em;
                }

                .actions-stack-premium {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .action-card-premium {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    padding: 1.25rem;
                    border-radius: 20px;
                    background: #fcfdff;
                    text-decoration: none;
                    border: 1.5px solid #f8fafc;
                    transition: all 0.2s;
                }

                .action-card-premium:hover {
                    border-color: #6366f1;
                    background: #fff;
                    transform: translateX(5px);
                    box-shadow: 0 8px 16px rgba(99, 102, 241, 0.08);
                }

                .action-icon-premium {
                    font-size: 1.5rem;
                    width: 48px;
                    height: 48px;
                    background: #fff;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
                }

                .action-info-premium {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .action-label-premium {
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 0.95rem;
                }

                .action-desc-premium {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 0.1rem;
                }

                .action-arrow {
                    color: #cbd5e1;
                    transition: all 0.2s;
                }

                .action-card-premium:hover .action-arrow {
                    color: #6366f1;
                    transform: translateX(3px);
                }

                .alerts-stack-premium {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .alert-item-premium {
                    display: flex;
                    gap: 1rem;
                    padding: 1.25rem;
                    border-radius: 20px;
                    background: #fff;
                    border: 1px solid #f8fafc;
                    transition: all 0.2s;
                }

                .alert-icon-wrap-premium {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .alert-title-premium {
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                .alert-badge-premium {
                    font-size: 0.65rem;
                    font-weight: 800;
                    padding: 0.2rem 0.5rem;
                    border-radius: 6px;
                    text-transform: uppercase;
                }

                .alert-desc-premium {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin-top: 0.25rem;
                    line-height: 1.4;
                }

                .system-health-premium {
                    background: linear-gradient(135deg, #4338ca 0%, #1e1b4b 100%);
                    border-radius: 28px;
                    padding: 1.75rem;
                    color: #fff;
                }

                .health-stats-premium {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                }

                .health-stat-premium {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .health-stat-premium span {
                    font-size: 0.75rem;
                    color: rgba(255,255,255,0.6);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .health-stat-premium strong {
                    font-size: 1.1rem;
                    font-weight: 800;
                }

                .health-divider {
                    width: 1px;
                    height: 30px;
                    background: rgba(255,255,255,0.1);
                }

                .skeleton-pulse {
                    background: #f1f5f9;
                    animation: skeleton-pulse 1.5s infinite ease-in-out;
                }

                @keyframes skeleton-pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }

                @media (max-width: 1400px) {
                    .dashboard-grid-v2 {
                        grid-template-columns: 1fr;
                    }
                    .sidebar-content-v2 {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 1.5rem;
                    }
                    .system-health-premium {
                        grid-column: span 2;
                    }
                }

                @media (max-width: 1024px) {
                    .stats-grid-v2 {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .header-section-premium { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
                    .sidebar-content-v2 { grid-template-columns: 1fr; }
                    .system-health-premium { grid-column: span 1; }
                    .stats-grid-v2 { grid-template-columns: 1fr; }
                }

                .empty-state-premium-v2 {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 5rem 2rem;
                    text-align: center;
                    background: #fff;
                    border-radius: 24px;
                }

                .empty-icon-motion {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    background: #f5f3ff;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                    margin-bottom: 2rem;
                }

                .ring-pulse {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 2px solid #6366f1;
                    animation: ring-ripple 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                }

                @keyframes ring-ripple {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(1.6); opacity: 0; }
                }

                .book-first-btn-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    padding: 0.85rem 2rem;
                    border-radius: 16px;
                    font-weight: 800;
                    text-decoration: none;
                    transition: all 0.3s;
                    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2);
                }

                .book-first-btn-premium:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 15px 30px rgba(99, 102, 241, 0.3);
                    filter: brightness(1.1);
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
