import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Users, Calendar, Activity, Filter, Download,
    Clock, RefreshCw, CheckCircle2, XCircle, Search, BarChart2, Loader2,
    FileText, Hash
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    getPracticeInsights, getReportsDashboard, getAppointmentsReport,
    getDoctors, toIsoDate, getAppointments
} from '../api/index';
import { removeSalutation } from '../utils/formatters';

const Analytics = () => {
    // Basic Setup
    const today = toIsoDate();
    const firstOfMonth = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return toIsoDate(d);
    })();

    // Shared Filters State
    const [dateFrom, setDateFrom] = useState(firstOfMonth);
    const [dateTo, setDateTo] = useState(today);
    const [doctorId, setDoctorId] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [timeframe, setTimeframe] = useState('7D');

    // Data States
    const [insightData, setInsightData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial Load & Filters Change
    useEffect(() => {
        getDoctors({ all: true })
            .then(r => setDoctors(r.data?.data || []))
            .catch(() => { });
    }, []);

    useEffect(() => {
        const dTo = new Date();
        const dFrom = new Date();
        
        switch(timeframe) {
            case '1D': dFrom.setDate(dTo.getDate()); break;
            case '7D': dFrom.setDate(dTo.getDate() - 7); break;
            case '1M': dFrom.setMonth(dTo.getMonth() - 1); break;
            case '6M': dFrom.setMonth(dTo.getMonth() - 6); break;
            case 'YTD': dFrom.setMonth(0, 1); break;
            default: break;
        }

        setDateFrom(toIsoDate(dFrom));
        setDateTo(toIsoDate(dTo));
    }, [timeframe]);

    useEffect(() => {
        fetchData();
    }, [dateFrom, dateTo, doctorId, status]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const unifiedParams = { 
                from: dateFrom, to: dateTo, 
                date_from: dateFrom, date_to: dateTo 
            };
            if (doctorId) unifiedParams.doctor_id = doctorId;
            if (status) unifiedParams.status = status;

            const [insightRes, reportDashRes, appointmentsRes] = await Promise.all([
                getPracticeInsights(unifiedParams).catch(() => ({ data: { data: {} } })),
                getReportsDashboard(unifiedParams).catch(() => ({ data: { data: {} } })),
                getAppointmentsReport(unifiedParams).catch(async () => {
                    // FALLBACK: If report API fails (500), use the standard appointments API
                    console.warn('Report API failed, falling back to standard appointments API');
                    return getAppointments({ 
                        date_from: dateFrom, 
                        date_to: dateTo,
                        doctor_id: doctorId,
                        all: true 
                    });
                })
            ]);

            const insights = insightRes.data?.data || {};
            const summary = reportDashRes.data?.data || {};

            setInsightData({
                ...insights,
                metrics: {
                    ...insights.metrics,
                    ...summary
                }
            });
            setAppointments(appointmentsRes.data?.data || []);
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setError('Failed to load practice data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const derived = useMemo(() => {
        const stats = {
            total: appointments.length,
            completed: 0,
            cancelled: 0,
            no_show: 0,
            uniquePatients: new Set(),
            categories: {},
            docVisits: {},
            dateMap: {}
        };

        appointments.forEach(a => {
            // Robust date extraction
            let dateStr = null;
            if (a.appointment_date) {
                dateStr = a.appointment_date.split('T')[0];
            } else if (a.date) {
                dateStr = a.date.split('T')[0];
            }
            
            if (dateStr) {
                stats.dateMap[dateStr] = (stats.dateMap[dateStr] || 0) + 1;
            }
            const s = (a.status || '').toUpperCase();
            if (s === 'COMPLETED') stats.completed++;
            if (s === 'CANCELLED') stats.cancelled++;
            if (s === 'NO_SHOW') stats.no_show++;

            if (a.patient_id) stats.uniquePatients.add(a.patient_id);

            const cat = a.visit_category || 'General';
            stats.categories[cat] = (stats.categories[cat] || 0) + 1;

            const dName = a.doctor_name || 'Unassigned';
            if (!stats.docVisits[dName]) {
                stats.docVisits[dName] = { name: dName, count: 0, role: 'Medical Professional' };
            }
            stats.docVisits[dName].count++;
        });

        // Fill missing days with 0 for a perfect timeline
        const trendsArray = [];
        let curr = new Date(dateFrom);
        const last = new Date(dateTo);
        
        while (curr <= last) {
            const key = curr.toISOString().split('T')[0];
            trendsArray.push({
                name: curr.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                value: stats.dateMap[key] || 0,
                fullDate: curr.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            });
            curr.setDate(curr.getDate() + 1);
        }

        return {
            ...stats,
            uniquePatientsCount: stats.uniquePatients.size,
            docVisitsArray: Object.values(stats.docVisits).sort((a, b) => b.count - a.count),
            trendsArray
        };
    }, [appointments]);

    const displayMetrics = {
        total: insightData?.metrics?.total_appointments || derived.total,
        completed: insightData?.metrics?.completed || derived.completed,
        cancelled: insightData?.metrics?.cancelled || derived.cancelled,
        no_show: insightData?.metrics?.no_show || derived.no_show,
        unique: insightData?.metrics?.unique_patients || derived.uniquePatientsCount,
        doctors: (insightData?.metrics?.doctor_visits && insightData.metrics.doctor_visits.length > 0) ? insightData.metrics.doctor_visits : derived.docVisitsArray,
        categories: (insightData?.metrics?.categories && Object.keys(insightData.metrics.categories).length > 0) ? insightData.metrics.categories : derived.categories,
        trends: derived.trendsArray
    };

    const completionRate = displayMetrics.total ? Math.round((displayMetrics.completed / displayMetrics.total) * 100) : 0;

    const exportCSV = () => {
        const headers = ['Date', 'Patient', 'Patient ID', 'Mobile', 'Doctor', 'Token / Time', 'Status', 'Visit Type', 'Source'];
        const rows = filteredAppointments.map(a => [
            a.date || '',
            a.child_name || a.patient_name || '',
            a.patient_id || '',
            a.patient_mobile || '***',
            a.doctor_name || '',
            a.token_display || a.appointment_time || '—',
            a.status || '',
            a.visit_category || '',
            a.booking_source || ''
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `practice_report_${dateFrom}_to_${dateTo}.csv`;
        a.click();
    };

    const formatDateReadable = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const filteredAppointments = appointments.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (a.child_name || '').toLowerCase().includes(q) ||
            (a.patient_name || '').toLowerCase().includes(q) ||
            (a.patient_id || '').toLowerCase().includes(q) ||
            (a.doctor_name || '').toLowerCase().includes(q)
        );
    });

    const getStatusStyle = (s) => {
        const status = (s || '').toUpperCase();
        if (status === 'COMPLETED') return { bg: '#d1fae5', color: '#16a34a' };
        if (status === 'CANCELLED') return { bg: '#fee2e2', color: '#ef4444' };
        if (status === 'NO_SHOW') return { bg: '#fef3c7', color: '#d97706' };
        return { bg: '#eff6ff', color: '#3b82f6' };
    };

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Reports & Analytics</h1>
                    <p>Advanced practice insights and financial trends</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={fetchData} style={{ gap: '8px' }}>
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                    <button className="btn-header-v4 btn-primary-v4" onClick={exportCSV} style={{ gap: '8px' }}>
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="stats-grid-v4" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                {[
                    { label: 'Total Appointments', value: displayMetrics.total, icon: Calendar, color: '#4f46e5' },
                    { label: 'Completed', value: displayMetrics.completed, icon: Users, color: '#10b981' },
                    { label: 'Cancelled', value: displayMetrics.cancelled, icon: Users, color: '#ef4444' },
                    { label: 'No Shows', value: displayMetrics.no_show, icon: FileText, color: '#f59e0b' },
                    { label: 'Unique Patients', value: displayMetrics.unique, icon: Hash, color: '#06b6d4' },
                    { label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: '#8b5cf6' }
                ].map((stat, i) => (
                    <div key={i} className="stat-card-v4">
                        <div className="stat-icon-v4" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                            <stat.icon size={24} />
                        </div>
                        <div className="stat-info-v4">
                            <span className="stat-label-v4">{stat.label}</span>
                            <div className="stat-value-v4">{loading ? '...' : stat.value.toLocaleString()}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="analytics-main-grid">
                <div className="analytics-card-white" style={{ background: '#fff', border: '1px solid #eef2f6', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ color: '#1e293b', fontSize: '1rem', fontWeight: 850, margin: 0 }}>Appointment Trends</h3>
                        <div className="timeframe-selector-v4" style={{ display: 'flex', gap: '8px' }}>
                            {['1D', '7D', '1M', '6M', 'YTD'].map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    style={{
                                        background: timeframe === tf ? '#1e293b' : '#f8fafc',
                                        border: 'none',
                                        color: timeframe === tf ? '#fff' : '#64748b',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        padding: '6px 14px',
                                        cursor: 'pointer',
                                        borderRadius: '10px',
                                        transition: 'all 0.2s',
                                        boxShadow: timeframe === tf ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '300px', width: '100%', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={displayMetrics.trends.length > 0 ? displayMetrics.trends : [{ name: 'No Data', value: 0 }]}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                    dy={10}
                                    interval={timeframe === '6M' || timeframe === 'Max' ? 30 : 'auto'}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                    domain={[0, 'auto']}
                                    allowDecimals={false}
                                    tickFormatter={(val) => val.toLocaleString()}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 700 }}
                                    labelStyle={{ color: '#cbd5e1', fontSize: '10px', marginBottom: '4px' }}
                                    formatter={(val) => [val, 'Appointments']}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#f43f5e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="analytics-card-white">
                    <div className="card-title-v4">Visit Type Distribution</div>
                    <div style={{ position: 'relative', width: '180px', height: '180px', margin: '2rem auto' }}>
                        <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                            {(() => {
                                const total = Math.max(Object.values(displayMetrics.categories).reduce((a, b) => a + b, 0), 1);
                                let currentOffset = 0;
                                const colors = ['#60a5fa', '#a855f7', '#6366f1', '#f43f5e', '#10b981', '#f59e0b'];
                                return Object.entries(displayMetrics.categories).map(([name, count], idx) => {
                                    const percent = (count / total) * 100;
                                    const c = (
                                        <circle
                                            key={idx} cx="18" cy="18" r="15.5" fill="none"
                                            stroke={colors[idx % colors.length]} strokeWidth="4"
                                            strokeDasharray={`${percent}, 100`}
                                            strokeDashoffset={`-${currentOffset}`}
                                        />
                                    );
                                    currentOffset += percent;
                                    return c;
                                });
                            })()}
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Total Visits</span>
                            <span style={{ fontSize: '20px', fontWeight: 850, color: '#1e293b' }}>{displayMetrics.total}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                        {Object.entries(displayMetrics.categories).map(([name, count], idx) => {
                            const colors = ['#60a5fa', '#a855f7', '#6366f1', '#f43f5e', '#10b981', '#f59e0b'];
                            return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', fontSize: '13px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[idx % colors.length] }}></div>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>{count}</span>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>{name}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="analytics-card-white">
                <div className="card-title-v4">Visits per Doctor</div>
                <div className="doc-snapshot-grid">
                    {displayMetrics.doctors.slice(0, 4).map((doc, i) => (
                        <div key={i} className="doc-mini-card">
                            <div className="doc-mini-avatar">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || 'Doc')}&background=EEF2FF&color=4F46E5&bold=true`} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div className="doc-mini-info">
                                <h4>{doc.name}</h4>
                                <p>{doc.role || doc.speciality || 'Pediatrician'}</p>
                                <div className="doc-mini-count"><strong>{doc.count || doc.visits || 0}</strong> Bookings</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
