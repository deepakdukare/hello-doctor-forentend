import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, AlertCircle, MessageSquare, Clock, ArrowRight, UserCheck, ShieldAlert, Check } from 'lucide-react';
import { getUnregisteredInteractions, getEscalations, resolveEscalation } from '../api/index';

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
            const [leadsRes, escRes] = await Promise.all([
                getUnregisteredInteractions(),
                getEscalations()
            ]);
            setData({
                leads: leadsRes.data.data || [],
                escalations: escRes.data.data || []
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
        setResolving(id);
        try {
            await resolveEscalation(id);
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
        <div>
            <div className="title-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 title="Track interactions and human assistance requests.">Bot Hub</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>WhatsApp automation and support requests</p>
                    </div>
                    <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Sync Data
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#dc2626', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setTab('leads')}
                    className={`btn ${tab === 'leads' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                >
                    <UserCheck size={18} /> Unknown Leads ({data.leads.length})
                </button>
                <button
                    onClick={() => setTab('escalations')}
                    className={`btn ${tab === 'escalations' ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        borderColor: tab === 'escalations' ? '#ef4444' : '#e2e8f0',
                        background: tab === 'escalations' ? '#ef4444' : 'transparent',
                        color: tab === 'escalations' ? '#fff' : '#ef4444'
                    }}
                >
                    <ShieldAlert size={18} /> Support Requests ({data.escalations.length})
                </button>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>{tab === 'leads' ? 'Anonymous Bot Interactions' : 'Pending Support Escalations'}</h3>
                </div>

                {tab === 'leads' ? (
                    !loading && data.leads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{ background: '#f8fafc', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#94a3b8' }}>
                                <MessageSquare size={32} />
                            </div>
                            <h3 style={{ color: '#64748b', marginBottom: '0.5rem' }}>No anonymous interactions</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>When someone sends a message to the bot but hasn't registered, they will appear here.</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>WhatsApp ID</th>
                                    <th>Source</th>
                                    <th>Current Bot State</th>
                                    <th>Last Activity</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.leads.map((it) => (
                                    <tr key={it.session_id}>
                                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{it.wa_number || it.wa_id}</td>
                                        <td>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                                {it.session_data?.source || 'WATI'}
                                            </span>
                                        </td>
                                        <td>
                                            <code style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                {it.current_state}
                                            </code>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem' }}>
                                                <Clock size={14} />
                                                {getTimeAgo(it.last_activity_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto' }}
                                                onClick={() => window.location.href = `/patients?prefill_mobile=${it.wa_number || it.wa_id}`}
                                            >
                                                Register <ArrowRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    !loading && data.escalations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{ background: '#ecfdf5', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#10b981' }}>
                                <Check size={32} />
                            </div>
                            <h3 style={{ color: '#64748b', marginBottom: '0.5rem' }}>No pending escalations</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>All human support requests have been resolved. Good job!</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Reason</th>
                                    <th>Failed State</th>
                                    <th>Escalated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.escalations.map((esc) => (
                                    <tr key={esc._id}>
                                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{esc.wa_id}</td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 500 }}>{esc.reason || 'Manual Request'}</div>
                                        </td>
                                        <td>
                                            <code style={{ fontSize: '0.75rem' }}>{esc.failed_state || 'N/A'}</code>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem' }}>
                                                <Clock size={14} />
                                                {getTimeAgo(esc.escalated_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', background: '#10b981' }}
                                                onClick={() => handleResolve(esc._id)}
                                                disabled={resolving === esc._id}
                                            >
                                                {resolving === esc._id ? '...' : <><Check size={14} /> Mark Resolved</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default BotInteractions;
