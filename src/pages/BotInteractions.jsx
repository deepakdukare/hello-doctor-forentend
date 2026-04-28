import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, AlertCircle, MessageSquare, Clock, ArrowRight,
    UserCheck, ShieldAlert, Check, CheckCircle2, Bot, Users,
    MessageCircle, ExternalLink, Filter, HelpCircle, Activity,
    Zap, Headphones, ShieldCheck
} from 'lucide-react';
import { getUnregisteredInteractions, getNotifications, markNotificationRead, getChatHistory } from '../api/index';
import { hasPermission } from '../utils/auth';

const BotInteractions = () => {
    const [tab, setTab] = useState('leads'); // leads, escalations, history
    const [data, setData] = useState({ leads: [], escalations: [], history: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resolving, setResolving] = useState(null);
    const [filters, setFilters] = useState({
        wa_id: '',
        child_name: '',
        start_date: '',
        end_date: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [leadsRes, notificationsRes] = await Promise.all([
                getUnregisteredInteractions(),
                getNotifications()
            ]);

            const notifications = Array.isArray(notificationsRes.data?.data) ? notificationsRes.data.data : [];
            const escalations = notifications
                .filter((item) => {
                    if (item?.is_read) return false;
                    const text = `${item?.title || ''} ${item?.message || ''} ${item?.type || ''}`.toLowerCase();
                    return text.includes('escalat') || text.includes('urgent') || text.includes('critical');
                })
                .map((item) => ({
                    id: item.id || item._id,
                    wa_id: item.wa_id || item.wa_number || item?.meta?.wa_id || item?.context?.wa_id || '',
                    reason: item.reason || item.title || item.type || 'Manual escalation',
                    failed_state: item.failed_state || item.source || item.category || '',
                    escalated_at: item.escalated_at || item.created_at || item.timestamp || item.updated_at,
                }));

            setData(prev => ({
                ...prev,
                leads: Array.isArray(leadsRes?.data?.data) ? leadsRes.data.data : [],
                escalations,
            }));
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            setData(prev => ({ ...prev, history: Array.isArray(res?.data?.data) ? res.data.data : [] }));
        } catch (e) {
            setError("Failed to fetch history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'history') {
            fetchHistory();
        } else {
            fetchData();
        }
    }, [tab, fetchData]);

    const handleResolve = async (id) => {
        if (!id) return;
        setResolving(id);
        try {
            await markNotificationRead(id);
            await fetchData();
        } catch (e) {
            setError("Failed to resolve escalation");
        } finally {
            setResolving(null);
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return '—';
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return past.toLocaleDateString();
    };

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Bot Hub</h1>
                    <p>Monitor automated interactions and escalations</p>
                </div>
                <div className="header-right-v4">
                    <button
                        onClick={tab === 'history' ? fetchHistory : fetchData}
                        className="btn-header-v4"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>Sync Data</span>
                    </button>
                    <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setTab('leads')}
                            className={`btn-header-v4 ${tab === 'leads' ? 'active' : ''}`}
                            style={{ border: 'none', background: tab === 'leads' ? '#fff' : 'transparent', boxShadow: tab === 'leads' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
                        >
                            <Zap size={14} /> <span>Insights</span>
                        </button>
                        <button
                            onClick={() => setTab('escalations')}
                            className={`btn-header-v4 ${tab === 'escalations' ? 'active' : ''}`}
                            style={{ border: 'none', background: tab === 'escalations' ? '#ef4444' : 'transparent', color: tab === 'escalations' ? '#fff' : '#64748b', boxShadow: tab === 'escalations' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 'none' }}
                        >
                            <Headphones size={14} /> <span>Escalations</span>
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            className={`btn-header-v4 ${tab === 'history' ? 'active' : ''}`}
                            style={{ border: 'none', background: tab === 'history' ? '#0f172a' : 'transparent', color: tab === 'history' ? '#fff' : '#64748b', boxShadow: tab === 'history' ? '0 2px 8px rgba(15, 23, 42, 0.2)' : 'none' }}
                        >
                            <Clock size={14} /> <span>History</span>
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '2rem', color: '#ef4444', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 600 }}>{error}</span>
                </div>
            )}

            <div className="stats-grid-v4" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                <div className="stat-card-v4">
                    <div className="stat-icon-v4" style={{ backgroundColor: `rgba(99, 102, 241, 0.1)`, color: '#0d7f6e' }}>
                        <Bot size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">Bot Captures</span>
                        <div className="stat-value-v4">{data.leads.length} <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Unregistered</small></div>
                    </div>
                </div>
                <div className="stat-card-v4">
                    <div className="stat-icon-v4" style={{ backgroundColor: `rgba(239, 68, 68, 0.1)`, color: '#ef4444' }}>
                        <ShieldAlert size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">Support Escalations</span>
                        <div className="stat-value-v4" style={{ color: '#ef4444' }}>{data.escalations.length} <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Pending</small></div>
                    </div>
                </div>
                <div className="stat-card-v4">
                    <div className="stat-icon-v4" style={{ backgroundColor: `rgba(16, 185, 129, 0.1)`, color: '#10b981' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">System Status</span>
                        <div className="stat-value-v4" style={{ color: '#10b981' }}>Healthy <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Operational</small></div>
                    </div>
                </div>
            </div>

            {/* History Filters */}
            {tab === 'history' && (
                <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mobile / WA ID</label>
                        <input
                            type="text"
                            placeholder="91XXXXXXXXXX"
                            value={filters.wa_id}
                            onChange={(e) => setFilters({ ...filters, wa_id: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Patient Name</label>
                        <input
                            type="text"
                            placeholder="Child Name"
                            value={filters.child_name}
                            onChange={(e) => setFilters({ ...filters, child_name: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>From</label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>To</label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                    </div>
                    <button
                        onClick={fetchHistory}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        <Search size={18} /> Search History
                    </button>
                </div>
            )}

            {/* Main Content Table/List */}
            <div className="card" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                        {tab === 'leads' ? 'Anonymous WhatsApp Leads' : tab === 'escalations' ? 'Human Support Queue' : 'Global Chat Logs'}
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {tab === 'leads' ? `${data.leads.length} Unknown sessions active` : tab === 'escalations' ? `${data.escalations.length} Support requests awaiting resolution` : `${data.history.length === 50 ? 'Last 50' : data.history.length} records found`}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {tab === 'leads' ? (
                        !loading && data.leads.length === 0 ? (
                            <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(99, 102, 241, 0.05)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#94a3b8' }}>
                                    <MessageCircle size={40} />
                                </div>
                                <h3 style={{ color: '#1e293b', fontWeight: 700 }}>No anonymous leads</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 0' }}>All active WhatsApp sessions are associated with registered patients.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>User / Identity</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Source & State</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Activity Timeline</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Navigation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.leads.map((it) => (
                                        <tr key={it.session_id || it.wa_id || it.wa_number} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                                        WA
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{hasPermission('view_patient_mobile') ? (it.wa_number || it.wa_id || '-') : '**********'}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{(it.session_id || 'session').toString().substring(0, 10)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>{it.session_data?.source?.toUpperCase() || 'EXTERNAL'}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#064e3b' }}>STATE: {it.current_state}</div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                                                    <Clock size={16} />
                                                    Active {getTimeAgo(it.last_activity_at)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <button
                                                    onClick={() => window.location.href = `/patients?prefill_mobile=${it.wa_number || it.wa_id}`}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    Register Patient <ArrowRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : tab === 'escalations' ? (
                        !loading && data.escalations.length === 0 ? (
                            <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#10b981' }}>
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 style={{ color: '#1e293b', fontWeight: 700 }}>All Good! Queue Empty</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 0' }}>There are no pending human support requests at this time.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>User / Source</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Reason & Failure</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Waiting Time</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Action Center</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.escalations.map((esc) => (
                                        <tr key={esc.id || `${esc.wa_id}-${esc.escalated_at}`} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                                        SOS
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{hasPermission('view_patient_mobile') ? (esc.wa_id || 'Unknown user') : '**********'}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>URGENT ASSISTANCE</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{esc.reason?.toUpperCase() || 'MANUAL ESCALATION'}</div>
                                                <div style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#475569', display: 'inline-block' }}>
                                                    Bot failed at: <span style={{ fontWeight: 700 }}>{esc.failed_state || 'ROOT'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    <Clock size={14} className="blink" />
                                                    Pending {getTimeAgo(esc.escalated_at)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1.5rem' }}>
                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                    <button
                                                        onClick={() => handleResolve(esc.id)}
                                                        disabled={!esc.id || resolving === esc.id}
                                                        className="btn btn-primary"
                                                        style={{ background: '#10b981', flex: 1, padding: '0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                                    >
                                                        {resolving === esc.id ? <RefreshCw size={16} className="animate-spin" /> : <><Check size={18} /> Resolve</>}
                                                    </button>
                                                    <a
                                                        href={(esc.wa_id && hasPermission('view_patient_mobile')) ? `https://wa.me/${esc.wa_id.replace('+', '')}` : '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-secondary"
                                                        onClick={(e) => {
                                                            if (!esc.wa_id) e.preventDefault();
                                                        }}
                                                        style={{ width: '40px', height: '40px', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <ExternalLink size={18} />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        !loading && data.history.length === 0 ? (
                            <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(15, 23, 42, 0.05)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#94a3b8' }}>
                                    <Clock size={40} />
                                </div>
                                <h3 style={{ color: '#1e293b', fontWeight: 700 }}>No history found</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 0' }}>Try adjusting your filters to find specific chat logs.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Timestamp</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Identity / Mobile</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Message Content</th>
                                        <th style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Sender</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.history.map((msg) => (
                                        <tr key={msg._id} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                                                    {new Date(msg.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1.5rem' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{msg.patient_details?.child_name || 'Anonymous'}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{hasPermission('view_patient_mobile') ? msg.wa_id : '**********'}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1.5rem', maxWidth: '400px' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#334155', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px',
                                                    background: msg.sender === 'bot' ? '#f1f5f9' : '#e0f2fe',
                                                    color: msg.sender === 'bot' ? '#475569' : '#0369a1'
                                                }}>
                                                    {msg.sender?.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>


        </div>
    );
};

export default BotInteractions;
