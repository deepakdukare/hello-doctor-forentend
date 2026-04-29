import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Printer, Lock, Paperclip, Plus, X, FileText, RefreshCw, Activity, User, Calendar, Shield, ArrowRight, Clock, Eye, MessageCircle, Clipboard, Zap, Stethoscope } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';
import { getMRDByPatientId, addMRDEntry, exportMRD, getPatients, getDoctors, getEntryByAppointment, toIsoDate, sendPrescriptionViaWhatsApp, getAppointments, getPatientById, lookupAppointments } from '../api/index';

const EMPTY_ENTRY = {
    patient_id: '', appointment_id: '', visit_date: toIsoDate(),
    visit_type: 'CONSULTATION', attending_doctor: 'Dr. Indu',
    chief_complaint: '', clinical_notes: '', diagnosis: '',
    prescription: '', investigations: '', next_visit_due: '', recorded_by: 'Dr. Indu',
    weight: '', temperature: '', spo2: '', pulse: '', head_circumference: '',
    symptoms: '', advice: '', attachments: []
};

const PALETTE = ['#0d7f6e', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
const avatarColor = (s = '') => PALETTE[s.charCodeAt(0) % PALETTE.length];
const initials = (p) => {
    if (!p) return '?';
    const name = p.first_name || p.child_name || p.name || '?';
    return (name[0] + (p.last_name || '')[0]).toUpperCase();
};
const age = (dob) => {
    if (!dob) return '';
    const d = new Date(dob);
    if (isNaN(d)) return '';
    const totalM = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
    const y = Math.floor(totalM / 12), m = totalM % 12;
    return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ');
};

const pname = (p) => {
    if (!p) return '';
    return [p.first_name || p.name, p.last_name].filter(Boolean).join(' ');
};

const fmt = (ds, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!ds) return ''; try { return new Date(ds).toLocaleDateString('en-IN', opts); } catch { return ds; }
};

const MRD = () => {
    const [patients, setPatients] = useState([]);
    const [dirLoading, setDirLoading] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [records, setRecords] = useState([]);
    const [recLoading, setRecLoading] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [tab, setTab] = useState('details');
    const [keywordSearch, setKeywordSearch] = useState('');
    const [patientSearch, setPatientSearch] = useState('');
    const [appointmentSearch, setAppointmentSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_ENTRY);
    const [saving, setSaving] = useState(false);
    const [formStatus, setFormStatus] = useState({ error: null, success: null });
    const [exporting, setExporting] = useState(false);

    const [pendingCompletions, setPendingCompletions] = useState([]);
    const [pendingLoading, setPendingLoading] = useState(false);
    const [doctorsList, setDoctorsList] = useState([]);

    const loadDirectory = useCallback(async (q = '') => {
        setDirLoading(true);
        try {
            const r = await getPatients({ limit: 50, search: q });
            setPatients(r.data.data || []);
        }
        catch (e) { console.error(e); }
        finally { setDirLoading(false); }
    }, []);

    const loadWorklist = useCallback(async () => {
        setPendingLoading(true);
        try {
            // Fetch completed appointments for last 7 days to keep it reasonable
            const d = new Date();
            d.setDate(d.getDate() - 7);
            const r = await getAppointments({
                status: 'COMPLETED',
                limit: 100
            });
            // Filter ones that don't have mrd entry yet
            const list = (r.data?.data || []).filter(a => !a.has_mrd_entry);
            setPendingCompletions(list);
        } catch (e) {
            console.error('Worklist fetch failed', e);
        } finally {
            setPendingLoading(false);
        }
    }, []);

    const loadDoctors = useCallback(async () => {
        try {
            const r = await getDoctors({ all: true });
            setDoctorsList(r.data?.data || []);
        } catch (e) {
            console.error('Failed to fetch doctors', e);
        }
    }, []);

    useEffect(() => { loadWorklist(); loadDoctors(); }, [loadWorklist, loadDoctors]);

    // Debounced directory search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadDirectory(patientSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [patientSearch, loadDirectory]);
    const selectPatientRecord = async (p, prefFromAppt = null) => {
        if (selectedPatient?.patient_id !== p.patient_id) {
            setSelectedPatient(p);
            setRecords([]);
            setSelectedRecord(null);
            setKeywordSearch('');
            setFilterType('ALL');
            setRecLoading(true);
            try {
                const r = await getMRDByPatientId(p.patient_id);
                // The backend returns a unified timeline and an appointments array
                const entries = r.data?.data?.entries || [];
                const appointments = r.data?.data?.appointments || [];

                // We want to show entries, but also "ghost" entries for completed appointments that have no record yet
                const combined = [...entries];

                appointments.forEach(appt => {
                    if (appt.status === 'COMPLETED' && !entries.find(e => e.appointment_id === appt.appointment_id)) {
                        combined.push({
                            is_pending_record: true,
                            appointment_id: appt.appointment_id,
                            visit_date: appt.appointment_date,
                            visit_category: appt.visit_category,
                            attending_doctor: appt.doctor_name,
                            diagnosis: 'Pending Documentation',
                            reason: appt.reason,
                            weight: appt.weight,
                            temperature: appt.temperature,
                            spo2: appt.spo2,
                            pulse: appt.pulse,
                            head_circumference: appt.head_circumference,
                            symptoms: appt.symptoms
                        });
                    }
                });

                combined.sort((a, b) => new Date(b.visit_date || b.createdAt) - new Date(a.visit_date || a.createdAt));
                setRecords(combined);
                if (combined.length) setSelectedRecord(combined[0]);
            } catch (e) {
                if (e.response?.status === 404) {
                    setRecords([]);
                    setSelectedRecord(null);
                } else {
                    console.error(e);
                }
            }
            finally { setRecLoading(false); }
        }

        if (prefFromAppt) {
            setTab('add_record');
            setForm({
                ...EMPTY_ENTRY,
                patient_id: p.patient_id,
                appointment_id: prefFromAppt.appointment_id,
                visit_date: prefFromAppt.appointment_date ? prefFromAppt.appointment_date.split('T')[0] : toIsoDate(),
                visit_type: prefFromAppt.visit_category === 'Vaccination' ? 'VACCINATION' : 'CONSULTATION',
                attending_doctor: prefFromAppt.attending_doctor || prefFromAppt.doctor_name || 'Dr. Indu',
                chief_complaint: prefFromAppt.reason || '',
                weight: prefFromAppt.weight || '',
                temperature: prefFromAppt.temperature || '',
                spo2: prefFromAppt.spo2 || '',
                pulse: prefFromAppt.pulse || '',
                head_circumference: prefFromAppt.head_circumference || '',
                symptoms: Array.isArray(prefFromAppt.symptoms) ? prefFromAppt.symptoms.join(', ') : (prefFromAppt.symptoms || '')
            });
        }
    };

    const handleAppointmentLookup = async () => {
        const query = appointmentSearch.trim();
        if (!query) return;
        setRecLoading(true);
        try {
            // Use unified lookup
            const res = await lookupAppointments(query);
            if (res.data.type === 'single') {
                const appt = res.data.data;
                // Fetch patient and select record
                const pRes = await getPatients({ search: appt.patient_id });
                if (pRes.data?.data?.length > 0) {
                    await selectPatientRecord(pRes.data.data[0]);
                    setAppointmentSearch(''); // Clear search
                }
            } else {
                alert("Please enter a specific Appointment ID (APT-...) for direct lookup.");
            }
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || "Failed to lookup appointment");
        } finally {
            setRecLoading(false);
        }
    };

    const handleExport = async () => {
        if (!selectedPatient) return;
        setExporting(true);
        try {
            const r = await exportMRD(selectedPatient.patient_id);
            const b = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
            const u = URL.createObjectURL(b), a = document.createElement('a');
            a.href = u;
            a.download = `Medical_Docs_${selectedPatient.patient_id}_${toIsoDate()}.json`;
            a.click();
            URL.revokeObjectURL(u);
        } catch (e) { console.error(e); } finally { setExporting(false); }
    };

    const handleAddEntry = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormStatus({ error: null, success: null });
        try {
            const sym = typeof form.symptoms === 'string'
                ? form.symptoms.split(',').map(s => s.trim()).filter(Boolean)
                : form.symptoms;

            await addMRDEntry({
                ...form,
                symptoms: sym,
                patient_id: form.patient_id || selectedPatient?.patient_id
            });
            setFormStatus({ error: null, success: 'Entry added successfully.' });
            setForm({ ...EMPTY_ENTRY, patient_id: selectedPatient?.patient_id || form.patient_id });
            // Refresh worklist since an entry was added
            loadWorklist();
            if (selectedPatient) {
                const r = await getMRDByPatientId(selectedPatient.patient_id);
                setRecords(r.data?.data?.entries || []);
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setFormStatus({ error: "Conflict: This Patient ID already has an existing Medical Documentation record. Multiple records for the same ID are not allowed.", success: null });
            } else {
                setFormStatus({ error: errorMsg, success: null });
            }
        }
        finally { setSaving(false); }
    };

    const openEntryModal = () => {
        setShowModal(true);
        setFormStatus({ error: null, success: null });
        setForm({ ...EMPTY_ENTRY, patient_id: selectedPatient?.patient_id || '', attachments: [] });
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        const newAttachments = [...(form.attachments || [])];

        for (const file of files) {
            const isPdf = file.type === 'application/pdf';
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newAttachments.push({
                url: base64,
                name: file.name,
                file_type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
                preview: isPdf ? null : base64 // Local preview only for images
            });
        }
        setForm({ ...form, attachments: newAttachments });
    };

    const removeAttachment = (index) => {
        const updated = [...form.attachments];
        updated.splice(index, 1);
        setForm({ ...form, attachments: updated });
    };

    const filteredRecords = records.filter(r => {
        if (filterType === 'CONSULTATION' && r.visit_type !== 'CONSULTATION') return false;
        if (filterType === 'VACCINATION' && r.visit_type !== 'VACCINATION') return false;
        if (keywordSearch) {
            const k = keywordSearch.toLowerCase();
            return r.diagnosis?.toLowerCase().includes(k) || r.chief_complaint?.toLowerCase().includes(k);
        }
        return true;
    });

    const prescriptionLines = selectedRecord?.prescription?.split('\n').filter(Boolean) || [];

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Medical Documentation</h1>
                    <p>Longitudinal health records and clinical history</p>
                </div>
                <div className="header-right-v4">
                    <button className="btn-header-v4" onClick={() => loadDirectory()}>
                        <RefreshCw size={16} className={dirLoading ? 'spinning' : ''} />
                        <span>Sync Directory</span>
                    </button>
                    {selectedPatient && (
                        <button className="btn-header-v4 btn-primary-v4" onClick={openEntryModal}>
                            <Plus size={16} />
                            <span>New Entry</span>
                        </button>
                    )}
                </div>
            </div>

            {!selectedPatient ? (
                <div style={{ padding: '1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                    {pendingCompletions.length > 0 && (
                        <div style={{ background: '#fff', border: '1.5px dashed #0d7f6e', borderRadius: '12px', padding: '16px', marginBottom: '24px', background: '#fdfdff' }}>
                            <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: '#0d7f6e', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Pending Clinical Records (Complete Visit)</span>
                                <span style={{ background: '#0d7f6e', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{pendingCompletions.length}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                                {pendingCompletions.map(a => (
                                    <div 
                                        key={a.appointment_id} 
                                        onClick={async () => {
                                            let p = patients.find(pat => pat.patient_id === a.patient_id);
                                            if (!p) {
                                                const res = await getPatientById(a.patient_id);
                                                p = res.data?.data;
                                            }
                                            if (p) selectPatientRecord(p, a);
                                        }}
                                        style={{ minWidth: '240px', padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#0d7f6e'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    >
                                        <div style={{ fontWeight: 900, fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>{removeSalutation(a.child_name) || 'Unknown Patient'}</div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{fmt(a.appointment_date)} • {a.appointment_id}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 20px rgba(15,23,42,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 850, color: '#1e293b', margin: 0 }}>Patient Directory</h2>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Select a patient profile to review or construct longitudinal health charts</p>
                            </div>
                            <div style={{ position: 'relative', width: '320px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Search by name, ID or mobile..."
                                    value={patientSearch}
                                    onChange={(e) => setPatientSearch(e.target.value)}
                                    style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1.5px solid #e2e8f0', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                                />
                                {dirLoading && <RefreshCw size={14} className="spinning" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />}
                            </div>
                        </div>

                        {dirLoading && patients.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 12px', color: '#0d7f6e' }} />
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>Syncing Patient Database...</div>
                            </div>
                        ) : patients.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                <User size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>No profiles identified in this repository.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {patients.map(p => {
                                    const ini = initials(p);
                                    return (
                                        <div
                                            key={p.patient_id}
                                            onClick={() => selectPatientRecord(p)}
                                            style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0d7f6e'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eef2f6'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarColor(ini), color: '#fff', fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {ini}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', flex: 1, alignItems: 'center' }}>
                                                    <div style={{ fontSize: '15px', fontWeight: 850, color: '#1e293b' }}>{pname(p)}</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>ID: {p.patient_id}</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0d7f6e' }}>{age(p.dob) || '—'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); selectPatientRecord(p); }}
                                                    style={{ background: '#0d7f6e10', color: '#0d7f6e', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                                                >
                                                    Select
                                                </button>
                                                <ArrowRight size={18} color="#cbd5e1" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ padding: '1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Patient Profile Summary Card */}
                    <div style={{ background: '#fff', border: '1px solid #eef2f6', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: avatarColor(initials(selectedPatient)), color: '#fff', fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {initials(selectedPatient)}
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 850, color: '#1e293b', margin: 0 }}>{pname(selectedPatient)}</h2>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '12px' }}>
                                    <span><strong>Age:</strong> {age(selectedPatient.dob) || '—'}</span>
                                    <span><strong>ID:</strong> {selectedPatient.patient_id}</span>
                                    <span><strong>Mobile:</strong> {selectedPatient.patient_mobile || '—'}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedPatient(null)} 
                            style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#475569' }}
                        >
                            Change Patient
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
                        {/* Left Workspace: Tabs + Form/Timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', borderBottom: '2px solid #f1f5f9' }}>
                                {['add_record', 'patient_history', 'attachments'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setTab(t)}
                                        style={{ 
                                            padding: '10px 20px', 
                                            border: 'none', 
                                            background: 'none', 
                                            fontSize: '14px', 
                                            fontWeight: tab === t || (tab === 'details' && t === 'add_record') ? 850 : 600, 
                                            color: tab === t || (tab === 'details' && t === 'add_record') ? '#0d7f6e' : '#64748b', 
                                            borderBottom: tab === t || (tab === 'details' && t === 'add_record') ? '2px solid #0d7f6e' : '2px solid transparent',
                                            cursor: 'pointer',
                                            marginBottom: '-2px'
                                        }}
                                    >
                                        {t === 'add_record' ? 'E-prescription' : t === 'patient_history' ? 'Patient History' : 'View & Upload Documents'}
                                    </button>
                                ))}
                            </div>

                            {/* Tab 1: E-Prescription Form Workspace */}
                            {(tab === 'add_record' || tab === 'details') && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                                     <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                          {/* Vitals Grid */}
                                          <div>
                                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vitals</div>
                                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                                                  {[{ label: 'Weight', key: 'weight', unit: 'kg' }, { label: 'Temp', key: 'temperature', unit: '°F' }, { label: 'SPO2', key: 'spo2', unit: '%' }, { label: 'Pulse', key: 'pulse', unit: 'bpm' }, { label: 'Head Cir.', key: 'head_circumference', unit: 'cm' }].map(v => (
                                                      <div key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{v.label}</label>
                                                          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                                              <input 
                                                                  type="text" 
                                                                  placeholder={v.unit}
                                                                  value={form[v.key]} 
                                                                  onChange={e => setForm({ ...form, [v.key]: e.target.value })} 
                                                                  style={{ width: '100%', border: 'none', padding: '6px 10px', fontSize: '12px', outline: 'none' }} 
                                                              />
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>

                                          {/* Clinical & Diagnosis */}
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Primary Diagnosis / Purpose</label>
                                                  <input 
                                                      type="text" 
                                                      placeholder="Enter primary diagnosis..." 
                                                      value={form.diagnosis} 
                                                      onChange={e => setForm({ ...form, diagnosis: e.target.value })} 
                                                      style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none' }} 
                                                  />
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Chief Complaint</label>
                                                  <input 
                                                      type="text" 
                                                      placeholder="Enter chief complaint..." 
                                                      value={form.chief_complaint} 
                                                      onChange={e => setForm({ ...form, chief_complaint: e.target.value })} 
                                                      style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none' }} 
                                                  />
                                              </div>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Medications & Prescription</label>
                                              <textarea 
                                                  rows={4} 
                                                  placeholder="Medicine Name - Dosage - Frequency - Duration" 
                                                  value={form.prescription} 
                                                  onChange={e => setForm({ ...form, prescription: e.target.value })} 
                                                  style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'none' }} 
                                              />
                                          </div>

                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Clinical Notes & Observations</label>
                                                  <textarea 
                                                      rows={3} 
                                                      placeholder="Detailed clinical findings..." 
                                                      value={form.clinical_notes} 
                                                      onChange={e => setForm({ ...form, clinical_notes: e.target.value })} 
                                                      style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'none' }} 
                                                  />
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Patient Advice</label>
                                                  <textarea 
                                                      rows={3} 
                                                      placeholder="Dietary rules, instructions..." 
                                                      value={form.advice} 
                                                      onChange={e => setForm({ ...form, advice: e.target.value })} 
                                                      style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'none' }} 
                                                  />
                                              </div>
                                          </div>

                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                               <button 
                                                   type="submit" 
                                                   disabled={saving} 
                                                   style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                                               >
                                                   {saving ? 'Processing...' : 'Save E-prescription'}
                                               </button>
                                          </div>
                                          {formStatus.error && <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{formStatus.error}</p>}
                                          {formStatus.success && <p style={{ color: '#10b981', fontSize: '12px', margin: 0 }}>{formStatus.success}</p>}
                                     </form>
                                </div>
                            )}

                            {/* Tab 2: Patient History */}
                            {tab === 'patient_history' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filteredRecords.length === 0 ? (
                                        <div style={{ padding: '40px', background: '#fff', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                            No historical records available.
                                        </div>
                                    ) : filteredRecords.map((rec, i) => (
                                        <div 
                                            key={rec._id || i} 
                                            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 12px rgba(15,23,42,0.02)' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0d7f6e' }}>{fmt(rec.visit_date || rec.createdAt)}</span>
                                                <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '12px', fontWeight: 800 }}>{rec.visit_type}</span>
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{rec.diagnosis || 'General Clinical Review'}</div>
                                            {rec.prescription && (
                                                <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '8px', borderRadius: '6px', marginTop: '8px' }}>
                                                    <strong>Rx:</strong> {rec.prescription}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab 3: Attachments */}
                            {tab === 'attachments' && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', textTransform: 'uppercase' }}>Upload Scans & Reports</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                                        {form.attachments?.map((att, idx) => (
                                            <div key={idx} style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                <img src={att.preview || att.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button type="button" onClick={() => removeAttachment(idx)} style={{ position: 'absolute', top: '4px', right: '4px', padding: '2px', borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
                                            </div>
                                        ))}
                                        <label style={{ width: '120px', height: '120px', borderRadius: '8px', border: '1.5px dashed #0d7f6e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0d7f6e' }}>
                                            <Plus size={24} />
                                            <span style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>Add File</span>
                                            <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar: Quick Selection & Direct Search */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: '#fff', border: '1px solid #eef2f6', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Search Patient</div>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Lookup patient..." 
                                        value={patientSearch}
                                        onChange={(e) => setPatientSearch(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none' }} 
                                    />
                                </div>
                            </div>

                            <div style={{ background: '#fff', border: '1px solid #eef2f6', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Previous Records</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {filteredRecords.map((r, i) => (
                                        <div 
                                            key={r._id || i}
                                            style={{ padding: '8px 12px', border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                                            onClick={() => { setSelectedRecord(r); setTab('patient_history'); }}
                                        >
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{fmt(r.visit_date || r.createdAt)}</div>
                                            <div style={{ color: '#64748b', marginTop: '2px' }}>{r.diagnosis || 'Checkup'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay-v3">
                    <div className="modal-content-v3">
                        <header className="modal-header-v3">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Clipboard size={24} color="#0d7f6e" />
                                <h3>New Clinical Entry</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="btn-header-v4"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                    onClick={() => setForm({
                                        ...EMPTY_ENTRY,
                                        patient_id: '26-HA6',
                                        visit_date: '2026-04-08',
                                        visit_type: 'CONSULTATION',
                                        attending_doctor: 'Dr. Indu',
                                        diagnosis: 'Acute Upper Respiratory Infection',
                                        chief_complaint: 'Fever and Cough since 2 days',
                                        symptoms: 'Fever, Dry Cough, Nasal Congestion',
                                        weight: '12.5',
                                        temperature: '101',
                                        spo2: '98',
                                        pulse: '110',
                                        head_circumference: '48',
                                        prescription: 'Syp. Paracetamol 5ml - TDS - 3 days\nSyp. Ascoril LS 2.5ml - BD - 5 days',
                                        advice: 'Warm fluids, No cold water, Saline nasal drops PRN',
                                        clinical_notes: 'Throat congested, Chest clear on auscultation. No distress.'
                                    })}
                                >
                                    <Zap size={14} />
                                    <span>Load Sample (Hafsa)</span>
                                </button>
                                <button onClick={() => setShowModal(false)} className="close-btn"><X size={20} /></button>
                            </div>
                        </header>

                        <form onSubmit={handleAddEntry} className="entry-form-v3 custom-scrollbar">
                            <div className="form-grid-premium">
                                {/* Left Column: Meta & Observation */}
                                <div className="col-span-8">
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem' }}>
                                        <div className="section-label-premium"><User size={16} /> Patient & Visit Details</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                            <div className="f-group-premium">
                                                <label>Patient ID</label>
                                                <input className="input-premium-v4" disabled value={form.patient_id} />
                                            </div>
                                            <div className="f-group-premium">
                                                <label>Visit Date</label>
                                                <input className="input-premium-v4" type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} required />
                                            </div>
                                            <div className="f-group-premium">
                                                <label>Visit Type</label>
                                                <select className="input-premium-v4" value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })}>
                                                    <option value="CONSULTATION">Consultation</option>
                                                    <option value="VACCINATION">Vaccination</option>
                                                    <option value="FOLLOW_UP">Follow-up</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="f-group-premium" style={{ marginTop: '0.5rem' }}>
                                            <label>Attending Doctor</label>
                                            <select className="input-premium-v4" value={form.attending_doctor} onChange={e => setForm({ ...form, attending_doctor: e.target.value })} required>
                                                <option value="">Select Doctor</option>
                                                {doctorsList.map(doc => <option key={doc._id} value={doc.name}>{doc.name}</option>)}
                                                {form.attending_doctor && !doctorsList.find(d => d.name === form.attending_doctor) && (
                                                    <option value={form.attending_doctor}>{form.attending_doctor}</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem' }}>
                                        <div className="section-label-premium"><Stethoscope size={16} /> Diagnosis & Symptoms</div>
                                        <div className="f-group-premium">
                                            <label>Primary Diagnosis / Purpose</label>
                                            <input className="input-premium-v4" placeholder="Enter primary diagnosis..." value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} />
                                        </div>
                                        <div className="f-group-premium">
                                            <label>Clinical Notes / Findings</label>
                                            <textarea className="textarea-premium-v4" rows={3} placeholder="Detailed observations..." value={form.clinical_notes} onChange={e => setForm({ ...form, clinical_notes: e.target.value })} />
                                        </div>
                                        <div className="f-group-premium">
                                            <label>Systemic Review / Symptoms (Comma separated)</label>
                                            <input className="input-premium-v4" placeholder="Fever, Cough, etc." value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-card-premium">
                                        <div className="section-label-premium"><Clipboard size={16} /> Prescription & Advice</div>
                                        <div className="f-group-premium">
                                            <label>Medications & Dosage</label>
                                            <textarea className="textarea-premium-v4" style={{ minHeight: '150px', background: '#fff' }} placeholder="Medicine Name - Dosage - Frequency - Duration" value={form.prescription} onChange={e => setForm({ ...form, prescription: e.target.value })} />
                                        </div>
                                        <div className="f-group-premium">
                                            <label>Patient Advice</label>
                                            <textarea className="textarea-premium-v4" rows={2} placeholder="Dietary restrictions, activity limits, etc." value={form.advice} onChange={e => setForm({ ...form, advice: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Vitals & Attachments */}
                                <div className="col-span-4">
                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem' }}>
                                        <div className="section-label-premium"><Activity size={16} /> Vitals</div>
                                        <div className="vitals-grid-v4">
                                            <div className="vital-input-v4"><label>Weight</label><input placeholder="kg" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
                                            <div className="vital-input-v4"><label>Temp</label><input placeholder="°F" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} /></div>
                                            <div className="vital-input-v4"><label>SPO2</label><input placeholder="%" value={form.spo2} onChange={e => setForm({ ...form, spo2: e.target.value })} /></div>
                                            <div className="vital-input-v4"><label>Pulse</label><input placeholder="bpm" value={form.pulse} onChange={e => setForm({ ...form, pulse: e.target.value })} /></div>
                                            <div className="vital-input-v4"><label>Head Cir.</label><input placeholder="cm" value={form.head_circumference} onChange={e => setForm({ ...form, head_circumference: e.target.value })} /></div>
                                        </div>
                                    </div>

                                    <div className="form-card-premium" style={{ marginBottom: '1.5rem' }}>
                                        <div className="section-label-premium"><Paperclip size={16} /> Attachments</div>
                                        <div className="attachment-grid-premium">
                                            {form.attachments?.map((att, idx) => (
                                                <div key={idx} className="att-preview-premium">
                                                    <img src={att.preview} alt="preview" />
                                                    <button type="button" onClick={() => removeAttachment(idx)} className="rem-btn-premium"><X size={10} /></button>
                                                </div>
                                            ))}
                                            <label className="att-upload-btn-premium">
                                                <Plus size={20} />
                                                <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-card-premium">
                                        <div className="section-label-premium"><Clock size={16} /> Follow-up</div>
                                        <div className="f-group-premium">
                                            <label>Next Visit Due</label>
                                            <input className="input-premium-v4" type="date" value={form.next_visit_due} onChange={e => setForm({ ...form, next_visit_due: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formStatus.error && <p className="error-msg" style={{ marginTop: '1rem' }}>{formStatus.error}</p>}
                            {formStatus.success && <p className="success-msg" style={{ marginTop: '1rem' }}>{formStatus.success}</p>}
                        </form>

                        <footer className="form-actions-premium">
                            <button type="button" className="btn-premium-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="button" className="btn-premium-submit" disabled={saving} onClick={handleAddEntry}>
                                {saving ? 'Processing...' : 'Securely Save Clinical Entry'}
                            </button>
                        </footer>

                    </div>
                </div>
            )}

        </div>
    );
};

export default MRD;
