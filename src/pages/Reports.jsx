import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart2, RefreshCw, AlertCircle, TrendingUp, Users,
    Calendar, CheckCircle2, XCircle, Clock, Download, Filter, Search
} from 'lucide-react';
import { getReportsDashboard, getAppointmentsReport, getDoctors, toIsoDate } from '../api/index';
import { removeSalutation } from '../utils/formatters';

const StatCard = ({ title, value, icon: Icon, color, loading }) => (
    <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={24} />
        </div>
        <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? <div style={{ width: '60px', height: '28px', background: '#f1f5f9', borderRadius: '8px' }} /> : value}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        </div>
    </div>
);

const Reports = () => {
    const today = toIsoDate();
    const firstOfMonth = (() => {
        const d = new Date();
        d.setDate(1);
        return toIsoDate(d);
    })();
    const [dateFrom, setDateFrom] = useState(firstOfMonth);
    const [dateTo, setDateTo] = useState(today);
    const [doctorId, setDoctorId] = useState('');
    const [status, setStatus] = useState('');
    const [doctors, setDoctors] = useState([]);
    const [overview, setOverview] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getDoctors({ all: true }).then(r => setDoctors(r.data?.data || [])).catch(() => { });
    }, []);

    const fetchReports = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = { date_from: dateFrom, date_to: dateTo };
            if (doctorId) params.doctor_id = doctorId;
            if (status) params.status = status;
            const [dashRes, apptRes] = await Promise.all([
                getReportsDashboard(params).catch(() => ({ data: { data: {} } })),
                getAppointmentsReport(params).catch(() => ({ data: { data: [] } }))
            ]);
            setOverview(dashRes.data?.data || {});
            setAppointments(apptRes.data?.data || []);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load reports');
        } finally { setLoading(false); }
    }, [dateFrom, dateTo, doctorId, status]);

    useEffect(() => { fetchReports(); }, []);

    const filtered = appointments.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (a.child_name || '').toLowerCase().includes(q) || (a.patient_id || '').toLowerCase().includes(q);
    });

    const exportCSV = () => {
        const headers = ['Date', 'Patient', 'Patient ID', 'Mobile', 'Doctor', 'Token / Time', 'Status', 'Visit Type', 'Source'];
        const rows = filtered.map(a => [
            a.date || '',
            a.child_name || '',
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
        const a = document.createElement('a'); a.href = url; a.download = `appointments_${dateFrom}_${dateTo}.csv`; a.click();
    };

    const sc = (s) => {
        if (s === 'COMPLETED') return { bg: '#d1fae5', color: '#16a34a' };
        if (s === 'CANCELLED') return { bg: '#fee2e2', color: '#ef4444' };
        if (s === 'NO_SHOW') return { bg: '#fef3c7', color: '#d97706' };
        return { bg: '#e0f2fe', color: '#0284c7' };
    };

    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Reports & Analytics</h1>
                    <p>Summary of clinical and administrative performance</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={exportCSV}>
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                    <button className="btn-header-v4 btn-primary-v4" onClick={fetchReports}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Filter size={16} color="#94a3b8" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>From</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>To</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <select value={doctorId} onChange={e => setDoctorId(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#1e293b' }}>
                    <option value="">All Doctors</option>
                    {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name}</option>)}
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#1e293b' }}>
                    <option value="">All Statuses</option>
                    {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={fetchReports} style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: '#0d7f6e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Apply</button>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#dc2626', display: 'flex', gap: '0.75rem', alignItems: 'center' }}><AlertCircle size={18} />{error}</div>}

            <div className="stats-grid-v4 grid-6" style={{ marginBottom: '24px' }}>
                {[
                    { title: "Total Appointments", value: overview?.total_appointments ?? total, icon: Calendar, color: "#0d7f6e" },
                    { title: "Completed", value: overview?.completed ?? completed, icon: CheckCircle2, color: "#10b981" },
                    { title: "Cancelled", value: overview?.cancelled ?? appointments.filter(a => a.status === 'CANCELLED').length, icon: XCircle, color: "#ef4444" },
                    { title: "No Shows", value: overview?.no_show ?? appointments.filter(a => a.status === 'NO_SHOW').length, icon: Clock, color: "#f59e0b" },
                    { title: "Unique Patients", value: overview?.unique_patients ?? new Set(appointments.map(a => a.patient_id)).size, icon: Users, color: "#0ea5e9" },
                    { title: "Completion Rate", value: total ? `${Math.round((completed / total) * 100)}%` : '—', icon: TrendingUp, color: "#8b5cf6" }
                ].map((stat, i) => (
                    <div key={i} className="stat-card-v4 compact-v4">
                        <div className="stat-icon-v4" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                            <stat.icon size={20} />
                        </div>
                        <div className="stat-info-v4">
                            <span className="stat-label-v4">{stat.title}</span>
                            <div className="stat-value-v4">{loading ? '...' : stat.value.toLocaleString()}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Appointment Report — {filtered.length} records</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0 0.75rem' }}>
                        <Search size={15} color="#94a3b8" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', outline: 'none', fontSize: '0.875rem', width: '180px' }} />
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}><RefreshCw size={28} style={{ marginBottom: '0.75rem' }} /><p>Loading report...</p></div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}><BarChart2 size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} /><p style={{ fontWeight: 600 }}>No appointments for the selected period</p></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['Date', 'Patient', 'Patient ID', 'Mobile', 'Doctor', 'Token / Time', 'Visit Type', 'Source', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a, i) => {
                                    const s = sc(a.status);
                                    const mobileDisplay = a.patient_mobile || '***';

                                    return (
                                        <tr key={a.appointment_id || i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>{a.date || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: '#1e293b' }}>{removeSalutation(a.child_name) || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>{a.patient_id || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: '#1e293b' }}>{mobileDisplay}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>{a.doctor_name || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>{a.token_display || a.appointment_time || '—'}</td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}><span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>{a.visit_category || '—'}</span></td>
                                            <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'capitalize' }}>{(a.booking_source || '').toLowerCase()}</td>
                                            <td style={{ padding: '0.9rem 1.25rem' }}><span style={{ background: s.bg, color: s.color, padding: '0.25rem 0.7rem', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700 }}>{a.status}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
