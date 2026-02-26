import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Printer, Lock, Paperclip, Plus, X, FileText } from 'lucide-react';
import { getMRDByPatientId, addMRDEntry, exportMRD, getPatients } from '../api/index';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_ENTRY = {
    patient_id: '', appointment_id: '', visit_date: today(),
    visit_type: 'CONSULTATION', attending_doctor: 'Dr. Indu',
    chief_complaint: '', clinical_notes: '', diagnosis: '',
    prescription: '', investigations: '', next_visit_due: '', recorded_by: 'Dr. Indu'
};

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
const avatarColor = (s = '') => PALETTE[s.charCodeAt(0) % PALETTE.length];
const initials = (p) => {
    if (!p) return '?';
    return ((p.first_name || p.child_name || '?')[0] + (p.last_name || '')[0]).toUpperCase();
};
const age = (dob) => {
    if (!dob) return '';
    const d = new Date(dob);
    if (isNaN(d)) return '';
    const totalM = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
    const y = Math.floor(totalM / 12), m = totalM % 12;
    return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ');
};
const pname = (p) => [p.salutation, p.first_name, p.last_name || p.child_name].filter(Boolean).join(' ');
const locked = (rec) => (Date.now() - new Date(rec.createdAt || rec.visit_date)) > 864e5;
const fmt = (ds, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!ds) return ''; try { return new Date(ds).toLocaleDateString('en-IN', opts); } catch { return ds; }
};

const MRD = () => {
    const [dir, setDir] = useState([]);
    const [dirLoading, setDirLoading] = useState(true);
    const [patient, setPatient] = useState(null);
    const [records, setRecords] = useState([]);
    const [recLoading, setRecLoading] = useState(false);
    const [sel, setSel] = useState(null);
    const [tab, setTab] = useState('details');
    const [ks, setKs] = useState('');
    const [ft, setFt] = useState('ALL');
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState(EMPTY_ENTRY);
    const [saving, setSaving] = useState(false);
    const [formErr, setFormErr] = useState(null);
    const [formOk, setFormOk] = useState(null);
    const [exporting, setExporting] = useState(false);

    const loadDir = useCallback(async () => {
        setDirLoading(true);
        try { const r = await getPatients({ limit: 50 }); setDir(r.data.data || []); }
        catch (e) { console.error(e); }
        finally { setDirLoading(false); }
    }, []);

    useEffect(() => { loadDir(); }, [loadDir]);

    const selectPat = async (p) => {
        if (patient?.patient_id === p.patient_id) return;
        setPatient(p); setRecords([]); setSel(null); setKs(''); setFt('ALL');
        setRecLoading(true);
        try {
            const r = await getMRDByPatientId(p.patient_id);
            const e = r.data?.data?.mrd_entries || [];
            setRecords(e); if (e.length) setSel(e[0]);
        } catch (e) { console.error(e); }
        finally { setRecLoading(false); }
    };

    const doExport = async () => {
        if (!patient) return; setExporting(true);
        try {
            const r = await exportMRD(patient.patient_id);
            const b = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
            const u = URL.createObjectURL(b), a = document.createElement('a');
            a.href = u; a.download = `MRD_${patient.patient_id}_${today()}.json`; a.click(); URL.revokeObjectURL(u);
        } catch (e) { console.error(e); } finally { setExporting(false); }
    };

    const doAdd = async (e) => {
        e.preventDefault(); setSaving(true); setFormErr(null); setFormOk(null);
        try {
            await addMRDEntry({ ...form, patient_id: form.patient_id || patient?.patient_id });
            setFormOk('✅ Entry added.'); setForm(EMPTY_ENTRY);
            if (patient) { const r = await getMRDByPatientId(patient.patient_id); setRecords(r.data?.data?.mrd_entries || []); }
        } catch (e) { setFormErr(e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const openModal = () => { setModal(true); setFormErr(null); setFormOk(null); setForm({ ...EMPTY_ENTRY, patient_id: patient?.patient_id || '' }); };

    const filtered = records.filter(r => {
        if (ft === 'CONSULTATION' && r.visit_type !== 'CONSULTATION') return false;
        if (ft === 'VACCINATION' && r.visit_type !== 'VACCINATION') return false;
        if (ks) { const k = ks.toLowerCase(); return r.diagnosis?.toLowerCase().includes(k) || r.chief_complaint?.toLowerCase().includes(k); }
        return true;
    });

    const prescLines = sel?.prescription?.split('\n').filter(Boolean) || [];

    /* ── The component breaks out of .main-content padding via negative margin ── */
    return (
        <div>
            <div className="title-section">
                <h1 title="Search a patient to view or update their longitudinal health file.">Medical Records (MRD)</h1>
            </div>

            {/* Search */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={doSearch} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                        {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                        Sync Record
                    </button>
                </div>
            </div>

            {/* ── 3-PANEL BODY ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* LEFT — Patient list */}
                <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
                    <div style={{ padding: '14px 14px 6px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Patients</div>
                    {dirLoading
                        ? <div style={{ padding: '20px', color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>Loading…</div>
                        : dir.map(p => {
                            const active = patient?.patient_id === p.patient_id;
                            const ini = initials(p);
                            return (
                                <div key={p._id}
                                    onClick={() => selectPat(p)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: active ? '#eff6ff' : 'transparent', borderLeft: `3px solid ${active ? '#3b82f6' : 'transparent'}`, transition: 'background .15s' }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: active ? avatarColor(ini) : '#9ca3af', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>{ini}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#1d4ed8' : '#111827', lineHeight: 1.3 }}>{pname(p)}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{age(p.dob)}</div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* MIDDLE — Record timeline */}
                <div style={{ width: 300, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    {!patient ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 8, padding: 24 }}>
                            <FileText size={28} style={{ opacity: 0.25 }} />
                            <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'center' }}>Select a patient to view records</span>
                        </div>
                    ) : (<>
                        {/* Patient header */}
                        <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(initials(patient)), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>{initials(patient)}</div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{pname(patient)}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{patient.dob ? `DOB: ${fmt(patient.dob, { day: 'numeric', month: 'short', year: 'numeric' })} · ` : ''}{age(patient.dob)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Search */}
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input placeholder="Search records..." value={ks} onChange={e => setKs(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#f9fafb', color: '#374151' }} />
                        </div>

                        {/* Filters */}
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 6 }}>
                            {[{ l: 'All', v: 'ALL' }, { l: 'Consult', v: 'CONSULTATION' }, { l: 'Vacc.', v: 'VACCINATION' }].map(f => (
                                <button key={f.v} onClick={() => setFt(f.v)}
                                    style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: ft === f.v ? '#3b82f6' : 'transparent', color: ft === f.v ? '#fff' : '#6b7280', transition: 'all .15s' }}>
                                    {f.l}
                                </button>
                            ))}
                        </div>

                        {/* Cards */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {recLoading
                                ? <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
                                : filtered.length === 0
                                    ? <div style={{ textAlign: 'center', padding: '40px 12px', color: '#9ca3af' }}>
                                        <div style={{ fontSize: 22, marginBottom: 8 }}>📋</div>
                                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>No records found</div>
                                        <button onClick={openModal} style={{ padding: '7px 18px', borderRadius: 24, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <Plus size={12} /> Add Entry
                                        </button>
                                    </div>
                                    : filtered.map((rec, i) => {
                                        const lk = locked(rec), active = sel === rec, isV = rec.visit_type === 'VACCINATION';
                                        return (
                                            <div key={rec._id || i} onClick={() => { setSel(rec); setTab('details'); }}
                                                style={{ padding: '12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: `1.5px solid ${active ? '#3b82f6' : '#e5e7eb'}`, background: active ? '#eff6ff' : '#fff', transition: 'all .15s' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{fmt(rec.visit_date || rec.createdAt)}</span>
                                                    {lk ? <span style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', background: '#f3f4f6', padding: '2px 7px', borderRadius: 4 }}>LOCKED</span>
                                                        : <span style={{ fontSize: 10, fontWeight: 800, color: '#d97706', background: '#fffbeb', padding: '2px 7px', borderRadius: 4 }}>EDITABLE</span>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isV ? '#10b981' : '#3b82f6', display: 'inline-block' }} />
                                                    <span style={{ fontSize: 12, color: isV ? '#10b981' : '#3b82f6', fontWeight: 700 }}>{isV ? 'Vaccination' : 'Consultation'}</span>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{rec.diagnosis || rec.chief_complaint || 'General Visit'}</div>
                                                {rec.investigations && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, color: '#9ca3af', fontSize: 11 }}><Paperclip size={10} /> 1 attachment</div>}
                                            </div>
                                        );
                                    })}
                        </div>

                        {/* Add Entry CTA */}
                        <div style={{ padding: '10px 12px', borderTop: '1px solid #f3f4f6' }}>
                            <button onClick={openModal} style={{ width: '100%', padding: '8px', borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Plus size={14} /> Add Clinical Entry
                            </button>
                        </div>
                    </>)}
                </div>

                {/* RIGHT — Record detail */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f1f5f9' }}>
                    {!patient && !sel && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 10 }}>
                            <FileText size={40} style={{ opacity: 0.15 }} />
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Select a patient to begin</div>
                        </div>
                    )}
                    {patient && !sel && !recLoading && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 10 }}>
                            <div style={{ fontSize: 28 }}>📋</div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>No records yet for {pname(patient)}</div>
                            <button onClick={openModal} style={{ marginTop: 8, padding: '9px 24px', borderRadius: 28, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Plus size={14} /> Add Clinical Entry
                            </button>
                        </div>
                    )}
                    {sel && (
                        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', maxWidth: 740 }}>
                            {/* Detail header */}
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8' }}>
                                            {sel.visit_type === 'VACCINATION' ? 'Vaccination' : 'Consultation'}
                                        </span>
                                        {locked(sel) && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}><Lock size={11} /> Locked after 24h</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer' }}><Download size={12} /> PDF</button>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer' }}><Printer size={12} /> Print</button>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 900, fontSize: 22, color: '#111827', marginBottom: 4 }}>{sel.diagnosis || sel.chief_complaint || 'General Visit'}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                                    {fmt(sel.visit_date || sel.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })} · {sel.attending_doctor}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #e5e7eb' }}>
                                {[
                                    { id: 'details', l: 'Details' },
                                    { id: 'prescriptions', l: prescLines.length ? `Prescriptions (${prescLines.length})` : 'Prescriptions' },
                                    { id: 'vaccinations', l: 'Vaccinations' },
                                    { id: 'attachments', l: 'Attachments' },
                                ].map(t => (
                                    <button key={t.id} onClick={() => setTab(t.id)}
                                        style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#3b82f6' : '#6b7280', borderBottom: `2.5px solid ${tab === t.id ? '#3b82f6' : 'transparent'}`, marginBottom: -1, whiteSpace: 'nowrap', transition: 'all .15s' }}>
                                        {t.l}
                                    </button>
                                ))}
                            </div>

                            {/* Tab body */}
                            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {tab === 'details' && (<>
                                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Clinical Notes</div>
                                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{sel.clinical_notes || <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No notes recorded.</span>}</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', borderLeft: '3px solid #f59e0b' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Follow-up Instructions</div>
                                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                                            {sel.next_visit_due ? `Review on ${fmt(sel.next_visit_due, { day: 'numeric', month: 'long', year: 'numeric' })}` : sel.chief_complaint || <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>Not specified.</span>}
                                        </div>
                                    </div>
                                </>)}
                                {tab === 'prescriptions' && (
                                    <div style={{ gridColumn: '1/-1' }}>
                                        {prescLines.length
                                            ? prescLines.map((l, i) => (
                                                <div key={i} style={{ padding: '9px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', display: 'flex', gap: 10, marginBottom: 6 }}>
                                                    <span style={{ color: '#6366f1', fontWeight: 800 }}>{i + 1}.</span> {l}
                                                </div>))
                                            : <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No prescription recorded.</div>}
                                    </div>
                                )}
                                {tab === 'vaccinations' && (
                                    <div style={{ gridColumn: '1/-1' }}>
                                        {sel.visit_type === 'VACCINATION'
                                            ? <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                                                <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>Vaccination Record</div>
                                                <div style={{ fontSize: 13, color: '#15803d' }}>{sel.investigations || sel.chief_complaint || 'Vaccine administered.'}</div>
                                            </div>
                                            : <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>Not a vaccination visit.</div>}
                                    </div>
                                )}
                                {tab === 'attachments' && (
                                    <div style={{ gridColumn: '1/-1' }}>
                                        {sel.investigations
                                            ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                                                <Paperclip size={14} color="#6366f1" />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>LabReport.pdf</span>
                                            </div>
                                            : <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No attachments.</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL ── */}
            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 18, padding: '28px', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontWeight: 800, color: '#111827', fontSize: 17 }}>Add Clinical Entry</h3>
                            <button onClick={() => { setModal(false); setFormErr(null); setFormOk(null); }} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                        </div>
                        {formErr && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{formErr}</div>}
                        {formOk && <div style={{ background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{formOk}</div>}
                        <form onSubmit={doAdd}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {[['Patient ID', 'patient_id', 'text', 'DICC-YYYY-XXXX'], ['Visit Date *', 'visit_date', 'date', '']].map(([l, k, t, ph]) => (
                                    <div key={k}>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</label>
                                        <input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                ))}
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Visit Type</label>
                                    <select value={form.visit_type} onChange={e => setForm(f => ({ ...f, visit_type: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                                        <option value="CONSULTATION">Consultation</option>
                                        <option value="VACCINATION">Vaccination</option>
                                        <option value="FOLLOW_UP">Follow-up</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attending Doctor</label>
                                    <input value={form.attending_doctor} onChange={e => setForm(f => ({ ...f, attending_doctor: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Diagnosis</label>
                                    <input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="e.g. Acute Pharyngitis"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prescription (one per line)</label>
                                    <textarea rows={3} value={form.prescription} onChange={e => setForm(f => ({ ...f, prescription: e.target.value }))} placeholder="Medicine · Dosage · Frequency"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clinical Notes</label>
                                    <textarea rows={2} value={form.clinical_notes} onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))} placeholder="Observations, findings…"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next Visit Due</label>
                                    <input type="date" value={form.next_visit_due} onChange={e => setForm(f => ({ ...f, next_visit_due: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setModal(false)} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, color: '#374151' }}>Cancel</button>
                                <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>{saving ? 'Saving…' : 'Save Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`* { box-sizing: border-box; }`}</style>
        </div>
    );
};

export default MRD;
