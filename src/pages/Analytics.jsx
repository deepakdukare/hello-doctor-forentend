import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Users, Calendar, Activity, Filter, Download,
    Clock, RefreshCw, CheckCircle2, XCircle, Search, BarChart2, Loader2
} from 'lucide-react';
import {
    getPracticeInsights, getReportsDashboard, getAppointmentsReport,
    getDoctors, toIsoDate
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

    // Data States
    const [insightData, setInsightData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial Load
    useEffect(() => {
        getDoctors({ all: true })
            .then(r => setDoctors(r.data?.data || []))
            .catch(() => { });
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = { date_from: dateFrom, date_to: dateTo };
            if (doctorId) params.doctor_id = doctorId;
            if (status) params.status = status;

            const [insightRes, reportDashRes, appointmentsRes] = await Promise.all([
                getPracticeInsights(params).catch(() => ({ data: { data: {} } })),
                getReportsDashboard(params).catch(() => ({ data: { data: {} } })),
                getAppointmentsReport(params).catch(() => ({ data: { data: [] } }))
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
            docVisits: {}
        };

        appointments.forEach(a => {
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

        return {
            ...stats,
            uniquePatientsCount: stats.uniquePatients.size,
            docVisitsArray: Object.values(stats.docVisits).sort((a, b) => b.count - a.count)
        };
    }, [appointments]);

    const displayMetrics = {
        total: insightData?.metrics?.total_appointments || derived.total,
        completed: insightData?.metrics?.completed || derived.completed,
        cancelled: insightData?.metrics?.cancelled || derived.cancelled,
        no_show: insightData?.metrics?.no_show || derived.no_show,
        unique: insightData?.metrics?.unique_patients || derived.uniquePatientsCount,
        doctors: (insightData?.doctor_visits && insightData.doctor_visits.length > 0) ? insightData.doctor_visits : derived.docVisitsArray,
        categories: (insightData?.categories && Object.keys(insightData.categories).length > 0) ? insightData.categories : derived.categories
    };

    const completionRate = displayMetrics.total ? Math.round((displayMetrics.completed / displayMetrics.total) * 100) : 0;

    const exportCSV = () => {
        const headers = ['Date', 'Patient', 'Patient ID', 'Doctor', 'Token / Time', 'Status', 'Visit Type', 'Source'];
        const rows = filteredAppointments.map(a => [
            a.date || '',
            a.child_name || a.patient_name || '',
            a.patient_id || '',
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
        <div className="reports-analytics-v2">
            <div className="v2-header">
                <h1>Reports & Analytics</h1>
                <div className="v2-header-actions">
                    <button className="v2-btn-secondary" onClick={fetchData}>
                        <RefreshCw size={16} />
                        <span>Sync Data</span>
                    </button>
                    <button className="v2-btn-primary" onClick={exportCSV}>
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="v2-filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '2rem', background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div className="v2-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', border: '1px solid #eef2f6' }}>
                    <Calendar size={14} color="#6366f1" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>From</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} />
                </div>
                <div className="v2-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', border: '1px solid #eef2f6' }}>
                    <Calendar size={14} color="#6366f1" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>To</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#1e293b' }} />
                </div>
                <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="v2-select" style={{ minWidth: '160px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #eef2f6', background: '#f8fafc', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    <option value="">All Doctors</option>
                    {doctors.map(d => <option key={d.doctor_id || d._id} value={d.doctor_id || d._id}>{d.name}</option>)}
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} className="v2-select" style={{ minWidth: '140px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #eef2f6', background: '#f8fafc', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    <option value="">All Statuses</option>
                    {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="v2-update-btn" onClick={fetchData} style={{ marginLeft: 'auto', background: '#6366f1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>Update Report</button>
            </div>

            {error && <div className="v2-error-pill"><Activity size={18} />{error}</div>}

            <div className="stat-grid-v3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #6366f1' }}>
                    <div style={{ background: '#f5f3ff', color: '#6366f1', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Appointments</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : displayMetrics.total.toLocaleString()}</div>
                    </div>
                </div>

                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #10b981' }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Completed</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : displayMetrics.completed.toLocaleString()}</div>
                    </div>
                </div>

                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #ef4444' }}>
                    <div style={{ background: '#fef2f2', color: '#ef4444', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Cancelled</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : displayMetrics.cancelled.toLocaleString()}</div>
                    </div>
                </div>

                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #f59e0b' }}>
                    <div style={{ background: '#fffbeb', color: '#f59e0b', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>No Shows</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : displayMetrics.no_show.toLocaleString()}</div>
                    </div>
                </div>

                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #06b6d4' }}>
                    <div style={{ background: '#ecfeff', color: '#06b6d4', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Unique Patients</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : displayMetrics.unique.toLocaleString()}</div>
                    </div>
                </div>

                <div className="stat-card-v3" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '4px solid #8b5cf6' }}>
                    <div style={{ background: '#f5f3ff', color: '#8b5cf6', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Completion Rate</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>{loading ? '...' : `${completionRate}%`}</div>
                    </div>
                </div>
            </div>

            <div className="v2-charts-grid">
                <div className="v2-chart-card">
                    <h3>Appointment Trends</h3>
                    <div className="v2-chart-placeholder">
                        <svg viewBox="0 0 800 200" className="v2-trend-svg">
                            <path d="M 0 150 Q 150 140 300 100 T 600 80 T 800 20" fill="none" stroke="#6366f1" strokeWidth="3" />
                            <circle cx="150" cy="140" r="4" fill="#6366f1" />
                            <circle cx="300" cy="100" r="4" fill="#6366f1" />
                            <circle cx="600" cy="80" r="4" fill="#6366f1" />
                        </svg>
                    </div>
                </div>

                <div className="v2-chart-card">
                    <h3>Visit Distribution</h3>
                    <div className="v2-distribution-content">
                        <div className="v2-donut-box">
                            <svg viewBox="0 0 36 36" className="v2-donut-svg">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="60, 100" />
                            </svg>
                            <div className="v2-donut-center">
                                <span className="v2-donut-label">Total</span>
                                <span className="v2-donut-val">{displayMetrics.total}</span>
                            </div>
                        </div>
                        <div className="v2-legend-list">
                            {Object.entries(displayMetrics.categories).map(([name, count], idx) => (
                                <div key={name} className="v2-legend-item">
                                    <div className="v2-legend-info">
                                        <span className="v2-legend-dot" style={{ background: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5] }}></span>
                                        <span>{name}</span>
                                    </div>
                                    <strong>{count}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="v2-table-container">
                <div className="v2-table-header">
                    <h3>Detailed Records — {filteredAppointments.length}</h3>
                    <div className="v2-search-input">
                        <Search size={16} color="#94a3b8" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, ID, or doctor..." />
                    </div>
                </div>

                {loading ? (
                    <div className="v2-loading-box"><RefreshCw size={32} className="animate-spin" /></div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="v2-empty-box">
                        <BarChart2 size={48} />
                        <p>No record found for this period</p>
                    </div>
                ) : (
                    <div className="v2-table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    {['Date', 'Patient', 'Patient ID', 'Doctor', 'Time/Token', 'Type', 'Source', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAppointments.map((a, i) => {
                                    const s = getStatusStyle(a.status);
                                    const pName = a.child_name || a.patient_name || a.name || a.patient?.child_name || '—';
                                    return (
                                        <tr key={a.appointment_id || i}>
                                            <td style={{ fontWeight: 600, color: '#64748b' }}>{formatDateReadable(a.date || a.appointment_date)}</td>
                                            <td className="p-name" style={{ fontWeight: 800, color: '#1e293b' }}>{removeSalutation(pName)}</td>
                                            <td className="p-id" style={{ color: '#64748b', fontSize: '12px' }}>{a.patient_id || '—'}</td>
                                            <td style={{ fontWeight: 600 }}>{a.doctor_name || '—'}</td>
                                            <td style={{ fontWeight: 700, color: '#6366f1' }}>{a.token_display || a.appointment_time || '—'}</td>
                                            <td><span className="type-badge" style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{a.visit_category || 'First visit'}</span></td>
                                            <td className="source" style={{ textTransform: 'capitalize', fontSize: '12px' }}>{(a.booking_source || 'Admin')}</td>
                                            <td><span className="status-pill" style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '50px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{a.status}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="v2-doctor-section" style={{ marginTop: '3rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a', marginBottom: '1.5rem' }}>Doctor Performance Snapshot</h2>
                <div className="v2-doctor-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    {displayMetrics.doctors.map((doc, i) => (
                        <div key={i} className="v2-doctor-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', transition: 'transform 0.2s', cursor: 'default' }}>
                            <div className="doc-avatar" style={{ flexShrink: 0 }}>
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || 'Doc')}&background=EEF2FF&color=4F46E5&bold=true`} alt={doc.name} style={{ width: '56px', height: '56px', borderRadius: '16px', objectFit: 'cover' }} />
                            </div>
                            <div className="doc-info">
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{doc.name}</h3>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{doc.role || doc.speciality || 'Pediatrician'}</span>
                                <div className="doc-count" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}><strong style={{ color: '#6366f1', fontSize: '1rem' }}>{doc.count || doc.visits || 0}</strong> Bookings</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
