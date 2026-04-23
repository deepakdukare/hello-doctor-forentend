import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users,
    Plus,
    Search,
    Phone,
    Mail,
    Stethoscope,
    TrendingUp,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Download,
    X,
    Network,
    Star
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

/* ─── palette ─────────────────────────────────────────────────────── */
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

/* ─── scoped styles injected once ────────────────────────────────── */
const CSS = `
@keyframes rd-fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes rd-modal-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
@keyframes rd-spin { to{transform:rotate(360deg)} }
@keyframes rd-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

.rd-page { padding:1.75rem 2rem; background:#f8fafc; min-height:100vh; font-family:'Inter',sans-serif; animation:rd-fadein 0.4s ease-out; }

/* header */
.rd-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px dashed #e2e8f0; }
.rd-title { font-size:1.5rem; font-weight:800; color:#0f172a; letter-spacing:-0.025em; margin:0; display:flex; align-items:center; gap:12px; }
.rd-subtitle { font-size:13px; color:#64748b; font-weight:500; margin:4px 0 0; }
.rd-title-icon { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#4f46e5); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(99,102,241,.35); flex-shrink:0; }
.rd-header-btns { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.rd-btn-primary { display:inline-flex; align-items:center; gap:7px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:10px; padding:9px 18px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,.3); transition:all .2s; }
.rd-btn-primary:hover { opacity:.88; transform:translateY(-1px); }
.rd-btn-secondary { display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid #e2e8f0; color:#334155; border-radius:10px; padding:9px 18px; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.05); transition:all .2s; }
.rd-btn-secondary:hover { background:#f8fafc; border-color:#c7d2fe; color:#6366f1; }

/* analytics row */
.rd-analytics-row { display:grid; grid-template-columns:1fr 300px; gap:1.25rem; margin-bottom:1.75rem; }
@media(max-width:1000px){ .rd-analytics-row { grid-template-columns:1fr; } }

/* chart card */
.rd-card { background:#fff; border-radius:18px; border:1px solid #e9eef5; box-shadow:0 2px 8px rgba(0,0,0,.04); overflow:hidden; }
.rd-card-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; border-bottom:1px solid #f1f5f9; }
.rd-card-title { font-size:15px; font-weight:700; color:#1e293b; margin:0; display:flex; align-items:center; gap:8px; }
.rd-card-subtitle { font-size:12px; color:#94a3b8; font-weight:500; margin:2px 0 0; }
.rd-chart-body { padding:1.25rem 1.5rem 1.5rem; }

/* network growth card */
.rd-network-card { background:linear-gradient(135deg,#6366f1 0%,#4f46e5 60%,#7c3aed 100%); border-radius:18px; padding:1.75rem; color:#fff; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden; box-shadow:0 8px 24px rgba(99,102,241,.35); }
.rd-network-card::before { content:''; position:absolute; top:-40px; right:-40px; width:160px; height:160px; border-radius:50%; background:rgba(255,255,255,.08); pointer-events:none; }
.rd-network-card::after { content:''; position:absolute; bottom:-60px; left:-30px; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.05); pointer-events:none; }
.rd-network-icon { width:48px; height:48px; border-radius:14px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; margin-bottom:1rem; }
.rd-network-title { font-size:1.1rem; font-weight:700; margin:0 0 6px; }
.rd-network-desc { font-size:12.5px; color:rgba(255,255,255,.75); margin:0; line-height:1.6; }
.rd-network-stat { margin-top:1.5rem; }
.rd-network-val { font-size:2.5rem; font-weight:850; line-height:1; letter-spacing:-0.04em; }
.rd-network-label { font-size:12px; color:rgba(255,255,255,.7); margin-top:4px; font-weight:600; }
.rd-network-divider { border:none; border-top:1px solid rgba(255,255,255,.15); margin:1rem 0; }
.rd-network-row { display:flex; justify-content:space-between; align-items:center; font-size:12.5px; }
.rd-network-row span:last-child { font-weight:700; }

/* search bar */
.rd-search-wrap { padding:1rem 1.5rem; border-bottom:1px solid #f1f5f9; }
.rd-search-box { display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid #e9eef5; border-radius:11px; padding:10px 14px; transition:border-color .2s; }
.rd-search-box:focus-within { border-color:#a5b4fc; box-shadow:0 0 0 3px rgba(99,102,241,.08); }
.rd-search-input { border:none; background:transparent; outline:none; font-size:13.5px; font-weight:500; color:#334155; width:100%; font-family:'Inter',sans-serif; }
.rd-search-input::placeholder { color:#94a3b8; }

/* table */
.rd-table-scroll { overflow-x:auto; }
.rd-table { width:100%; border-collapse:collapse; }
.rd-table th { background:#f8fafc; padding:.85rem 1.25rem; text-align:left; font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.07em; border-bottom:1px solid #e9eef5; }
.rd-table td { padding:.95rem 1.25rem; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.rd-table tbody tr { transition:background .15s; }
.rd-table tbody tr:hover td { background:#fafbff; }
.rd-table tbody tr:last-child td { border-bottom:none; }

/* doctor avatar */
.rd-avatar { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#eef2ff,#e0e7ff); color:#6366f1; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.rd-doc-name { font-size:13px; font-weight:700; color:#1e293b; }
.rd-doc-clinic { font-size:11px; color:#94a3b8; margin-top:2px; }
.rd-spec-badge { display:inline-flex; align-items:center; gap:5px; background:#f1f5f9; color:#475569; font-size:11.5px; font-weight:600; padding:4px 11px; border-radius:20px; }
.rd-contact-line { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; font-weight:500; margin-bottom:3px; }
.rd-status-active { display:inline-flex; align-items:center; gap:5px; background:#ecfdf5; color:#059669; font-size:11.5px; font-weight:700; padding:4px 12px; border-radius:20px; border:1px solid #a7f3d0; cursor:pointer; transition:all .2s; }
.rd-status-active:hover { background:#d1fae5; }
.rd-status-inactive { display:inline-flex; align-items:center; gap:5px; background:#fff1f2; color:#dc2626; font-size:11.5px; font-weight:700; padding:4px 12px; border-radius:20px; border:1px solid #fecaca; cursor:pointer; transition:all .2s; }
.rd-status-inactive:hover { background:#ffe4e6; }
.rd-action-btn { width:32px; height:32px; border-radius:9px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }
.rd-action-btn-edit:hover { background:#eef2ff; color:#6366f1; }
.rd-action-btn-del:hover { background:#fff1f2; color:#dc2626; }
.rd-actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; }

/* empty / loading */
.rd-empty { text-align:center; padding:3.5rem 1rem; }
.rd-empty-icon { width:56px; height:56px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.rd-empty-text { font-size:14px; color:#94a3b8; font-weight:600; }
.rd-shimmer-line { height:14px; border-radius:7px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:400px 100%; animation:rd-shimmer 1.4s infinite; margin-bottom:6px; }

/* modal */
.rd-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(15,23,42,.55); backdrop-filter:blur(4px); }
.rd-modal { background:#fff; border-radius:20px; width:100%; max-width:520px; box-shadow:0 24px 48px rgba(0,0,0,.18); animation:rd-modal-in .25s ease-out; overflow:hidden; }
.rd-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.35rem 1.5rem; border-bottom:1px solid #f1f5f9; background:#fafbff; }
.rd-modal-title { font-size:16px; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:9px; }
.rd-modal-close { width:34px; height:34px; border-radius:9px; border:none; background:#f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b; transition:all .2s; }
.rd-modal-close:hover { background:#fee2e2; color:#dc2626; }
.rd-modal-body { padding:1.5rem; }
.rd-form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
@media(max-width:500px){ .rd-form-grid-2 { grid-template-columns:1fr; } }
.rd-form-group { margin-bottom:1rem; }
.rd-label { display:block; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px; }
.rd-input { width:100%; padding:10px 14px; font-size:13.5px; font-family:'Inter',sans-serif; color:#1e293b; border:1.5px solid #e2e8f0; border-radius:10px; outline:none; transition:border-color .2s,box-shadow .2s; box-sizing:border-box; }
.rd-input:focus { border-color:#a5b4fc; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.rd-input::placeholder { color:#94a3b8; }
.rd-modal-footer { display:flex; gap:10px; padding:0 1.5rem 1.5rem; }
.rd-btn-cancel { flex:1; padding:10px; font-size:13px; font-weight:600; color:#64748b; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; cursor:pointer; transition:all .2s; }
.rd-btn-cancel:hover { background:#f1f5f9; border-color:#cbd5e1; }
.rd-btn-save { flex:2; padding:10px; font-size:13px; font-weight:700; color:#fff; background:linear-gradient(135deg,#6366f1,#4f46e5); border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,.3); transition:all .2s; }
.rd-btn-save:hover { opacity:.88; transform:translateY(-1px); }

/* custom tooltip */
.rd-tooltip { background:#fff; border-radius:12px; padding:10px 14px; box-shadow:0 10px 24px rgba(0,0,0,.12); border:1px solid #e9eef5; font-size:13px; }
.rd-tooltip-label { font-weight:700; color:#1e293b; margin:0 0 4px; }
.rd-tooltip-val { color:#6366f1; font-weight:700; margin:0; }
`;

/* ─── Custom Tooltip ─────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="rd-tooltip">
                <p className="rd-tooltip-label">{label}</p>
                <p className="rd-tooltip-val">{payload[0].value} referrals</p>
            </div>
        );
    }
    return null;
};

/* ─── Shimmer skeleton rows ─────────────────────────────────────── */
const ShimmerRows = () =>
    Array(5).fill(0).map((_, i) => (
        <tr key={i}>
            {[35, 20, 25, 10, 10].map((w, j) => (
                <td key={j} style={{ padding: '.95rem 1.25rem' }}>
                    <div className="rd-shimmer-line" style={{ width: `${w + Math.random() * 20}%` }} />
                </td>
            ))}
        </tr>
    ));

/* ─── Main Component ─────────────────────────────────────────────── */
const ReferringDoctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDoctor, setNewDoctor] = useState({
        name: '', speciality: '', clinic_name: '', mobile: '', email: '', address: ''
    });

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [docsRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/referring-doctors?all=true`),
                axios.get(`${API_BASE_URL}/analytics/referrers`)
            ]);
            setDoctors(docsRes.data.data);
            setStats(statsRes.data.data);
        } catch (err) {
            console.error('Error fetching referring doctors:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDoctor = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE_URL}/referring-doctors`, newDoctor);
            setShowAddModal(false);
            setNewDoctor({ name: '', specialization: '', clinic_name: '', phone: '', email: '', address: '' });
            fetchData();
        } catch (err) {
            alert('Error adding doctor: ' + (err.response?.data?.message || err.message));
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            await axios.patch(`${API_BASE_URL}/referring-doctors/${id}`, { is_active: !currentStatus });
            fetchData();
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const filteredDoctors = doctors.filter(doc =>
        doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.speciality?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.clinic_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const highVolume = stats.filter(s => s.count >= 50).length;

    return (
        <>
            <style>{CSS}</style>

            <div className="rd-page">

                {/* ── Header ───────────────────────────────────────── */}
                <div className="rd-header">
                    <div>
                        <h1 className="rd-title">
                            <div className="rd-title-icon">
                                <Network size={22} color="#fff" />
                            </div>
                            Referring Doctor Registry
                        </h1>
                        <p className="rd-subtitle">Manage and analyze external medical referrals</p>
                    </div>
                    <div className="rd-header-btns">
                        <button className="rd-btn-secondary">
                            <Download size={15} /> Export Data
                        </button>
                        <button className="rd-btn-primary" onClick={() => setShowAddModal(true)}>
                            <Plus size={16} /> Add New Referral
                        </button>
                    </div>
                </div>

                {/* ── Analytics Row ─────────────────────────────────── */}
                <div className="rd-analytics-row">

                    {/* Top Referring Doctors Chart */}
                    <div className="rd-card">
                        <div className="rd-card-header">
                            <div>
                                <h3 className="rd-card-title">
                                    <TrendingUp size={17} color="#6366f1" />
                                    Top Referring Doctors
                                </h3>
                                <p className="rd-card-subtitle">By referral volume this month</p>
                            </div>
                        </div>
                        <div className="rd-chart-body">
                            {stats.length === 0 ? (
                                <div className="rd-empty" style={{ padding: '3rem 1rem' }}>
                                    <div className="rd-empty-icon">
                                        <TrendingUp size={22} color="#94a3b8" />
                                    </div>
                                    <p className="rd-empty-text">No referral analytics data yet.</p>
                                </div>
                            ) : (
                                <div style={{ height: 280 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={130}
                                                tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
                                                {stats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Network Growth Card */}
                    <div className="rd-network-card">
                        <div>
                            <div className="rd-network-icon">
                                <Users size={24} color="#fff" />
                            </div>
                            <h3 className="rd-network-title">Network Growth</h3>
                            <p className="rd-network-desc">Your referral network has grown by <strong>12%</strong> this month. Keep expanding your partners.</p>
                        </div>
                        <div className="rd-network-stat">
                            <div className="rd-network-val">{loading ? '—' : doctors.length}</div>
                            <div className="rd-network-label">Active Partners</div>
                        </div>
                        <hr className="rd-network-divider" />
                        <div className="rd-network-row">
                            <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12.5 }}>High Volume (50+)</span>
                            <span style={{ fontSize: 13 }}>{highVolume} Doctors</span>
                        </div>
                        <div className="rd-network-row" style={{ marginTop: 8 }}>
                            <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12.5 }}>This Month</span>
                            <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Star size={12} fill="#fff" /> +12%
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Doctors Table ─────────────────────────────────── */}
                <div className="rd-card">
                    {/* Search bar */}
                    <div className="rd-search-wrap">
                        <div className="rd-search-box">
                            <Search size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                            <input
                                className="rd-search-input"
                                type="text"
                                placeholder="Search by name, specialization, or clinic…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rd-table-scroll">
                        <table className="rd-table">
                            <thead>
                                <tr>
                                    <th>Doctor Info</th>
                                    <th>Specialization</th>
                                    <th>Contact</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <ShimmerRows />
                                ) : filteredDoctors.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="rd-empty">
                                                <div className="rd-empty-icon">
                                                    <Users size={24} color="#94a3b8" />
                                                </div>
                                                <p className="rd-empty-text">
                                                    {searchQuery
                                                        ? 'No doctors found matching your search.'
                                                        : 'No referring doctors added yet. Click "Add New Referral" to get started.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDoctors.map(doc => (
                                        <tr key={doc.doctor_id}>
                                            {/* Doctor Info */}
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div className="rd-avatar">
                                                        {doc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="rd-doc-name">{doc.name}</div>
                                                        <div className="rd-doc-clinic">{doc.clinic_name || 'Private Clinic'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Specialization */}
                                            <td>
                                                <span className="rd-spec-badge">
                                                    <Stethoscope size={12} />
                                                    {doc.speciality || 'General Practitioner'}
                                                </span>
                                            </td>
                                            {/* Contact */}
                                            <td>
                                                <div className="rd-contact-line">
                                                    <Phone size={12} color="#94a3b8" />
                                                    {doc.mobile || 'N/A'}
                                                </div>
                                                <div className="rd-contact-line" style={{ marginBottom: 0 }}>
                                                    <Mail size={12} color="#94a3b8" />
                                                    {doc.email || 'N/A'}
                                                </div>
                                            </td>
                                            {/* Status */}
                                            <td>
                                                <button
                                                    onClick={() => toggleStatus(doc.doctor_id, doc.is_active)}
                                                    className={doc.is_active ? 'rd-status-active' : 'rd-status-inactive'}
                                                >
                                                    {doc.is_active
                                                        ? <><CheckCircle2 size={12} /> Active</>
                                                        : <><XCircle size={12} /> Inactive</>}
                                                </button>
                                            </td>
                                            {/* Actions */}
                                            <td>
                                                <div className="rd-actions">
                                                    <button className="rd-action-btn rd-action-btn-edit" title="Edit">
                                                        <Edit2 size={15} color="#6366f1" />
                                                    </button>
                                                    <button className="rd-action-btn rd-action-btn-del" title="Delete">
                                                        <Trash2 size={15} color="#dc2626" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Add Doctor Modal ────────────────────────────────── */}
            {showAddModal && (
                <div className="rd-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="rd-modal" onClick={e => e.stopPropagation()}>
                        <div className="rd-modal-header">
                            <h3 className="rd-modal-title">
                                <div style={{
                                    width: 32, height: 32, borderRadius: 9,
                                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Plus size={16} color="#fff" />
                                </div>
                                Add Referring Doctor
                            </h3>
                            <button className="rd-modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddDoctor}>
                            <div className="rd-modal-body">
                                {/* Full name */}
                                <div className="rd-form-group">
                                    <label className="rd-label">Doctor's Full Name *</label>
                                    <input
                                        required
                                        className="rd-input"
                                        type="text"
                                        placeholder="Dr. Rajesh Kumar"
                                        value={newDoctor.name}
                                        onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })}
                                    />
                                </div>
                                {/* Specialization + Clinic */}
                                <div className="rd-form-grid-2">
                                    <div className="rd-form-group">
                                        <label className="rd-label">Specialization</label>
                                        <input
                                            className="rd-input"
                                            type="text"
                                            placeholder="Pediatrician"
                                            value={newDoctor.speciality}
                                            onChange={e => setNewDoctor({ ...newDoctor, speciality: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-form-group">
                                        <label className="rd-label">Clinic Name</label>
                                        <input
                                            className="rd-input"
                                            type="text"
                                            placeholder="Health First Clinic"
                                            value={newDoctor.clinic_name}
                                            onChange={e => setNewDoctor({ ...newDoctor, clinic_name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                {/* Phone + Email */}
                                <div className="rd-form-grid-2">
                                    <div className="rd-form-group">
                                        <label className="rd-label">Phone Number</label>
                                        <input
                                            className="rd-input"
                                            type="tel"
                                            placeholder="+91 98765 43210"
                                            value={newDoctor.mobile}
                                            onChange={e => setNewDoctor({ ...newDoctor, mobile: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-form-group">
                                        <label className="rd-label">Email Address</label>
                                        <input
                                            className="rd-input"
                                            type="email"
                                            placeholder="rajesh@example.com"
                                            value={newDoctor.email}
                                            onChange={e => setNewDoctor({ ...newDoctor, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                {/* Address */}
                                <div className="rd-form-group" style={{ marginBottom: 0 }}>
                                    <label className="rd-label">Address</label>
                                    <textarea
                                        className="rd-input"
                                        placeholder="123, MG Road, Mumbai…"
                                        rows={2}
                                        style={{ resize: 'vertical' }}
                                        value={newDoctor.address}
                                        onChange={e => setNewDoctor({ ...newDoctor, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="rd-modal-footer">
                                <button type="button" className="rd-btn-cancel" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="rd-btn-save">
                                    Save Partner
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default ReferringDoctors;
