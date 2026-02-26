import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, AlertCircle, Clock, Check } from 'lucide-react';
import {
    getSlotConfig, updateSlotConfig, getConfig, updateConfig, getAuditLogs
} from '../api/index';

const Settings = () => {
    const [tab, setTab] = useState('slots'); // slots, config, logs
    const [slots, setSlots] = useState([]);
    const [config, setConfig] = useState({ clinic_name: '', city: '', timezone: '' });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [slotsRes, configRes, logsRes] = await Promise.all([
                getSlotConfig(),
                getConfig(),
                getAuditLogs({ limit: 50 })
            ]);
            setSlots(slotsRes.data?.data || []);
            setConfig(configRes.data?.data || { clinic_name: 'Dr. Indu Child Care', city: 'Pune', timezone: 'Asia/Kolkata' });
            setLogs(logsRes.data?.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleUpdateActive = (slot_id, is_active) => {
        setSlots(prev => prev.map(s => s.slot_id === slot_id ? { ...s, is_active } : s));
    };

    const handleSaveSlots = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateSlotConfig(slots);
            setSuccess('Clinic slot configuration updated.');
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateConfig(config);
            setSuccess('Clinic information updated.');
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="title-section">
                <h1>Settings</h1>
                <p>Manage clinic-wide configurations and slot timings.</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button className={`btn ${tab === 'slots' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('slots')}>
                    <Clock size={18} /> Slot Master
                </button>
                <button className={`btn ${tab === 'config' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('config')}>
                    <SettingsIcon size={18} /> Clinic Config
                </button>
                <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('logs')}>
                    <RefreshCw size={18} /> Audit Logs
                </button>
            </div>

            {error && (
                <div className="alert-item" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {success && (
                <div className="alert-item" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Check size={20} /> {success}
                </div>
            )}

            {tab === 'slots' && (
                <div className="card">
                    <div className="card-header">
                        <h3>Slot Template Definition</h3>
                        <button className="btn btn-primary" onClick={handleSaveSlots} disabled={saving || loading}>
                            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                    {loading ? <p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p> : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Slot ID</th>
                                        <th>Label</th>
                                        <th>Session</th>
                                        <th>Timings</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.map((s) => (
                                        <tr key={s.slot_id}>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.slot_id}</td>
                                            <td>{s.slot_label || s.display_label}</td>
                                            <td><span className={`badge ${s.session === 'MORNING' ? 'badge-primary' : 'badge-warning'}`}>{s.session}</span></td>
                                            <td style={{ fontSize: '0.85rem' }}>{s.start_time} – {s.end_time}</td>
                                            <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-gray'}`}>{s.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                                            <td>
                                                <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto' }} onClick={() => handleUpdateActive(s.slot_id, !s.is_active)}>
                                                    {s.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {tab === 'config' && (
                <div className="card">
                    <div className="card-header">
                        <h3>Clinic Global Information</h3>
                        <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                            <Save size={14} /> Update Config
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Clinic Display Name</label>
                            <input
                                type="text"
                                value={config.clinic_name}
                                onChange={e => setConfig({ ...config, clinic_name: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Branch / City</label>
                            <input
                                type="text"
                                value={config.city}
                                onChange={e => setConfig({ ...config, city: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Timezone</label>
                            <input
                                disabled
                                type="text"
                                value={config.timezone}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {tab === 'logs' && (
                <div className="card">
                    <div className="card-header">
                        <h3>Recent Audit Logs</h3>
                        <button className="btn btn-outline" onClick={loadData}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Event</th>
                                    <th>Actor</th>
                                    <th>Entity</th>
                                    <th>Value/Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log._id}>
                                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                        <td><span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{log.event_type}</span></td>
                                        <td style={{ fontWeight: 600 }}>{log.actor}</td>
                                        <td><code style={{ fontSize: '0.7rem' }}>{log.entity_type}</code></td>
                                        <td style={{ fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {JSON.stringify(log.new_value || log.metadata || {})}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
