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
            setShowModal(true);
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
            setForm(EMPTY_ENTRY);
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
                    <button className="btn-header-v4 btn-primary-v4" onClick={openEntryModal}>
                        <Plus size={16} />
                        <span>New Entry</span>
                    </button>
                </div>
            </div>

            <div className="mrd-workspace-v3">
                {/* 1. Directory Panel */}
                <aside className="mrd-panel-v3 sidebar-panel">
                    {pendingCompletions.length > 0 && (
                        <div className="worklist-section">
                            <div className="panel-label" style={{ color: '#0d7f6e', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Pending clinical records</span>
                                <span className="badge">{pendingCompletions.length}</span>
                            </div>
                            <div className="worklist-container">
                                {pendingCompletions.map(a => (
                                    <div key={a.appointment_id} className="worklist-item" onClick={async () => {
                                        let p = patients.find(pat => pat.patient_id === a.patient_id);
                                        if (!p) {
                                            const res = await getPatientById(a.patient_id);
                                            p = res.data?.data;
                                        }
                                        if (p) selectPatientRecord(p, a);
                                    }}>
                                        <div className="dot"></div>
                                        <div className="wi-content">
                                            <div className="wi-name">{removeSalutation(a.child_name) || 'Unknown Patient'}</div>
                                            <div className="wi-meta">{fmt(a.appointment_date)} • {a.appointment_id}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="directory-search-container">
                        <div className="panel-label">Patient Directory</div>
                        <div className="search-bar-v3 sidebar-search">
                            <Search size={14} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                            />
                            {dirLoading && <RefreshCw size={12} className="spinning" />}
                        </div>
                    </div>
                    <div className="patient-list-v3">
                        {dirLoading && patients.length === 0 ? (
                            <div className="loading-state">
                                <RefreshCw size={24} className="spinning" />
                                <span>Loading Records...</span>
                            </div>
                        ) : patients.map(p => {
                            const isSelected = selectedPatient?.patient_id === p.patient_id;
                            const ini = initials(p);
                            return (
                                <div
                                    key={p.patient_id}
                                    className={`patient-item-v3 ${isSelected ? 'selected' : ''}`}
                                    onClick={() => selectPatientRecord(p)}
                                >
                                    <div className="avatar" style={{ background: isSelected ? avatarColor(ini) : '#f1f5f9', color: isSelected ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={14} />
                                    </div>
                                    <div className="info">
                                        <div className="p-name">{pname(p)}</div>
                                        <div className="p-meta">{p.patient_id} • {age(p.dob) || 'No Age'}</div>
                                    </div>
                                    {isSelected && <ArrowRight size={14} className="selected-indicator" />}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* 2. Timeline Panel */}
                <aside className="mrd-panel-v3 timeline-panel">
                    {!selectedPatient ? (
                        <div className="empty-selection">
                            <FileText size={48} />
                            <h3>Choose a Patient</h3>
                            <p>Select a profile from the directory to view their health journey.</p>
                        </div>
                    ) : (
                        <>
                            <div className="panel-header-v3">
                                <div className="selected-patient-meta">
                                    <h3>{pname(selectedPatient)}</h3>
                                    <p>{selectedPatient.patient_id}</p>
                                </div>
                                <button className="btn-add-mini" onClick={openEntryModal}>
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="timeline-filters">
                                <div className="keyword-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Filter records..."
                                        value={keywordSearch}
                                        onChange={(e) => setKeywordSearch(e.target.value)}
                                    />
                                </div>
                                <div className="type-pills">
                                    {['ALL', 'CONSULTATION', 'VACCINATION'].map(type => (
                                        <button
                                            key={type}
                                            className={filterType === type ? 'active' : ''}
                                            onClick={() => setFilterType(type)}
                                        >
                                            {type === 'ALL' ? 'Total' : type === 'CONSULTATION' ? 'Clinic' : 'Immune'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="records-timeline-v3">
                                {recLoading ? (
                                    <div className="loading-state">
                                        <RefreshCw size={24} className="spinning" />
                                    </div>
                                ) : filteredRecords.length === 0 ? (
                                    <div className="no-records">
                                        <FileText size={40} style={{ opacity: 0.2 }} />
                                        <p>No records identified.</p>
                                    </div>
                                ) : filteredRecords.map((rec, i) => (
                                    <div
                                        key={rec._id || rec.appointment_id || i}
                                        className={`record-card-v3 ${selectedRecord === rec ? 'selected' : ''} ${rec.is_pending_record ? 'pending-state' : ''}`}
                                        onClick={() => { setSelectedRecord(rec); setTab('details'); }}
                                    >
                                        <div className="record-header">
                                            <span className="record-date">{fmt(rec.visit_date || rec.createdAt)}</span>
                                            <span className={`type-tag ${rec.visit_type?.toLowerCase()}`}>{rec.visit_type}</span>
                                        </div>
                                        <div className="record-diagnosis">
                                            {rec.is_pending_record && <Clock size={14} className="pending-icon" />}
                                            {rec.diagnosis || rec.vaccine_given || rec.chief_complaint || 'General Checkup'}
                                        </div>
                                        <div className="record-footer">
                                            <div className="doctor-pill"><Activity size={10} /> {rec.attending_doctor}</div>
                                            {rec.prescription && <div className="attachment-pill"><Paperclip size={10} /> Rx</div>}
                                            {rec.attachments?.length > 0 && <div className="attachment-pill" style={{ background: '#ecfdf5', color: '#059669' }}><Paperclip size={10} /> {rec.attachments.length} Img</div>}
                                            {rec.is_pending_record && (
                                                <button className="btn-record-now" onClick={(e) => { e.stopPropagation(); selectPatientRecord(selectedPatient, rec); }}>
                                                    Complete Now <Plus size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </aside>

                {/* 3. Detailed View Panel */}
                <main className="mrd-main-v3">
                    {!selectedRecord ? (
                        <div className="empty-selection">
                            <Shield size={64} style={{ opacity: 0.1 }} />
                            <h3>Clinical Intelligence</h3>
                            <p>Detailed longitudinal analysis will appear here.</p>
                        </div>
                    ) : (
                        <div className="record-detail-v3">
                            <div className="detail-header-v3">
                                <div className="primary-info">
                                    <div className="visit-badge">{selectedRecord.visit_type}</div>
                                    <h2>{selectedRecord.diagnosis || selectedRecord.chief_complaint || 'Clinical Examination'}</h2>
                                    <div className="meta">
                                        <span><Calendar size={14} /> {fmt(selectedRecord.visit_date || selectedRecord.createdAt)}</span>
                                        <span><User size={14} /> {selectedRecord.attending_doctor}</span>
                                    </div>
                                </div>
                                <div className="detail-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={async () => {
                                            if (!selectedRecord?._id) return;
                                            try {
                                                const res = await sendPrescriptionViaWhatsApp(selectedRecord._id);
                                                alert(res.data.message || "Prescription sent via WhatsApp");
                                            } catch (e) {
                                                alert(e.response?.data?.message || "Failed to send via WhatsApp");
                                            }
                                        }}
                                        title="Send via WhatsApp"
                                        style={{ color: '#25d366' }}
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                    <button className="btn-icon" title="Print Record"><Printer size={18} /></button>
                                    <button className="btn-icon" onClick={handleExport} disabled={exporting} title="Export Data">
                                        {exporting ? <RefreshCw size={18} className="spinning" /> : <Download size={18} />}
                                    </button>
                                </div>
                            </div>

                            <nav className="detail-tabs-v3">
                                {[
                                    { id: 'details', label: 'Clinical Summary' },
                                    { id: 'prescription', label: `Rx Plan (${prescriptionLines.length})` },
                                    { id: 'attachments', label: `Files & Images (${selectedRecord.attachments?.length || 0})` },
                                    { id: 'followup', label: 'Prognosis & Follow-up' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        className={tab === t.id ? 'active' : ''}
                                        onClick={() => setTab(t.id)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </nav>

                            <div className="tab-content-v3">
                                {tab === 'details' && (
                                    <div className="clinical-grid-v3">
                                        {(selectedRecord.weight || selectedRecord.temperature || selectedRecord.spo2 || selectedRecord.pulse || selectedRecord.head_circumference) && (
                                            <article className="info-block-v3 vitals-display">
                                                <label>Vitals Check</label>
                                                <div className="vitals-grid">
                                                    {selectedRecord.weight && <div className="vital-item"><span>Weight:</span> <strong>{selectedRecord.weight}</strong></div>}
                                                    {selectedRecord.temperature && <div className="vital-item"><span>Temp:</span> <strong>{selectedRecord.temperature}</strong></div>}
                                                    {selectedRecord.spo2 && <div className="vital-item"><span>SPO2:</span> <strong>{selectedRecord.spo2}</strong></div>}
                                                    {selectedRecord.pulse && <div className="vital-item"><span>Pulse:</span> <strong>{selectedRecord.pulse}</strong></div>}
                                                    {selectedRecord.head_circumference && <div className="vital-item"><span>Head Cir:</span> <strong>{selectedRecord.head_circumference}</strong></div>}
                                                </div>
                                            </article>
                                        )}
                                        {selectedRecord.symptoms && (Array.isArray(selectedRecord.symptoms) ? selectedRecord.symptoms.length > 0 : String(selectedRecord.symptoms).length > 0) && (
                                            <article className="info-block-v3">
                                                <label>Reporting Symptoms</label>
                                                <div className="symptoms-chips">
                                                    {(Array.isArray(selectedRecord.symptoms) ? selectedRecord.symptoms : [selectedRecord.symptoms]).map((s, i) => (
                                                        <span key={i} className="sym-chip">{s}</span>
                                                    ))}
                                                </div>
                                            </article>
                                        )}
                                        <article className="info-block-v3">
                                            <label>Chief Complaint</label>
                                            <p>{selectedRecord.chief_complaint || 'No complaint recorded.'}</p>
                                        </article>
                                        <article className="info-block-v3">
                                            <label>Clinical Observations</label>
                                            <p>{selectedRecord.clinical_notes || 'No observations recorded.'}</p>
                                        </article>
                                        {selectedRecord.advice && (
                                            <article className="info-block-v3">
                                                <label>Advice & Instructions</label>
                                                <p className="advice-text">{selectedRecord.advice}</p>
                                            </article>
                                        )}
                                        {selectedRecord.visit_type === 'VACCINATION' && (
                                            <article className="info-block-v3 vaccination">
                                                <label>Immunization Track</label>
                                                <div className="vaccine-box">
                                                    <Shield size={16} />
                                                    <span>{selectedRecord.diagnosis || selectedRecord.vaccine_given || "Regular Immunization"}</span>
                                                </div>
                                                {selectedRecord.vaccine_batch && (
                                                    <div className="vaccine-batch" style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                                                        <strong>Batch/Brand:</strong> {selectedRecord.vaccine_batch}
                                                    </div>
                                                )}
                                            </article>
                                        )}
                                    </div>
                                )}

                                {tab === 'attachments' && (
                                    <div className="attachments-view-v3">
                                        {selectedRecord.attachments?.length > 0 ? (
                                            <div className="image-grid-v3">
                                                {selectedRecord.attachments.map((att, idx) => {
                                                    const isPdf = att.file_type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                                                    return (
                                                        <div key={idx} className="img-card-v3">
                                                            {isPdf ? (
                                                                <div className="pdf-placeholder-v3">
                                                                    <FileText size={48} />
                                                                    <span>{att.name}</span>
                                                                </div>
                                                            ) : (
                                                                <img src={att.url} alt={att.name} />
                                                            )}
                                                            <div className="img-overlay">
                                                                <span className="img-name">{att.name}</span>
                                                                <div className="img-actions">
                                                                    <button className="img-btn" onClick={() => window.open(att.url, '_blank')}><Eye size={16} /></button>
                                                                    <a href={att.url} download={att.name} className="img-btn"><Download size={14} /></a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="empty-state-mini">
                                                <Paperclip size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                                <p>No medical screenshots or scans have been uploaded for this visit.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {tab === 'prescription' && (
                                    <div className="prescription-view-v3">
                                        {prescriptionLines.length > 0 ? (
                                            prescriptionLines.map((line, idx) => (
                                                <div key={idx} className="rx-line-v3">
                                                    <div className="rx-num">{idx + 1}</div>
                                                    <div className="rx-text">{line}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state">No pharmacological plan recorded.</div>
                                        )}
                                    </div>
                                )}

                                {tab === 'followup' && (
                                    <div className="followup-view-v3">
                                        <div className="info-block-v3">
                                            <label>Next Recommended Visit</label>
                                            <div className="next-due-card">
                                                <Calendar size={24} />
                                                <div className="val">
                                                    {selectedRecord.next_visit_due ? fmt(selectedRecord.next_visit_due) : 'PRN (As required)'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

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
