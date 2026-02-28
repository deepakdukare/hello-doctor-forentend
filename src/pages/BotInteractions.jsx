import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, AlertCircle, MessageSquare, Clock, ArrowRight,
    UserCheck, ShieldAlert, Check, CheckCircle2, Bot, Users,
    MessageCircle, ExternalLink, Filter, HelpCircle, Activity,
    Zap, Headphones, ShieldCheck
} from 'lucide-react';
import { getUnregisteredInteractions, getNotifications, markNotificationRead } from '../api/index';

const BotInteractions = () => {
    const [tab, setTab] = useState('leads'); // leads, escalations
    const [data, setData] = useState({ leads: [], escalations: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resolving, setResolving] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [leadsRes, notificationsRes] = await Promise.all([
                getUnregisteredInteractions(),
                getNotifications()
            ]);

            const notifications = notificationsRes.data?.data || [];
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

            setData({
                leads: leadsRes.data.data || [],
                escalations,
            });
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #1e293b 0%, #4338ca 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Bot Hub
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Monitor WhatsApp automation, lead captures, and assistance requests</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchData}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '14px', background: '#fff', border: '1px solid var(--border-color)', fontWeight: 600 }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Sync Bot Data
                    </button>
                    <div style={{ display: 'flex', background: '#f8fafc', padding: '0.4rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setTab('leads')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', borderRadius: '10px',
                                border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                background: tab === 'leads' ? 'var(--primary)' : 'transparent',
                                color: tab === 'leads' ? '#fff' : '#64748b',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Zap size={16} /> Insights
                        </button>
                        <button
                            onClick={() => setTab('escalations')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.25rem', borderRadius: '10px',
                                border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                background: tab === 'escalations' ? '#ef4444' : 'transparent',
                                color: tab === 'escalations' ? '#fff' : '#64748b',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Headphones size={16} /> Escalations
                            {data.escalations.length > 0 && <span style={{ background: tab === 'escalations' ? '#fff' : '#ef4444', color: tab === 'escalations' ? '#ef4444' : '#fff', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem' }}>{data.escalations.length}</span>}
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

            {/* Quick Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(20px)', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                        <Bot size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bot Captures</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{data.leads.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>Unregistered</span></div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(20px)', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Help Needed</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{data.escalations.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Pending Support</span></div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(20px)', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bot Health</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>Optimal <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>No Errors</span></div>
                    </div>
                </div>
            </div>

            {/* Main Content Table/List */}
            <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                        {tab === 'leads' ? 'Anonymous WhatsApp Leads' : 'Human Support Queue'}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {tab === 'leads' ? `${data.leads.length} Unknown sessions active` : `${data.escalations.length} Support requests awaiting resolution`}
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
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>User / Identity</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Source & State</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Activity Timeline</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Navigation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.leads.map((it) => (
                                        <tr key={it.session_id || it.wa_id || it.wa_number} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                                        WA
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{it.wa_number || it.wa_id || '-'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{(it.session_id || 'session').toString().substring(0, 12)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>{it.session_data?.source?.toUpperCase() || 'EXTERNAL'}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4338ca' }}>STATE: {it.current_state}</div>
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
                    ) : (
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
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>User / Source</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Reason & Failure</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Waiting Time</th>
                                        <th style={{ padding: '1.25rem 2rem', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Action Center</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.escalations.map((esc) => (
                                        <tr key={esc.id || `${esc.wa_id}-${esc.escalated_at}`} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                                        SOS
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{esc.wa_id || 'Unknown user'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>URGENT ASSISTANCE</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{esc.reason?.toUpperCase() || 'MANUAL ESCALATION'}</div>
                                                <div style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569', display: 'inline-block' }}>
                                                    Bot failed at: <span style={{ fontWeight: 700 }}>{esc.failed_state || 'ROOT'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                                                    <Clock size={16} className="blink" />
                                                    Pending {getTimeAgo(esc.escalated_at)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem' }}>
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
                                                        href={esc.wa_id ? `https://wa.me/${esc.wa_id.replace('+', '')}` : '#'}
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
                    )}
                </div>
            </div>

            <style>{`
                .hover-row:hover {
                    background: #f8fafc !important;
                }
                .blink {
                    animation: blink-animation 1s steps(5, start) infinite;
                }
                @keyframes blink-animation {
                    to { visibility: hidden; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default BotInteractions;
