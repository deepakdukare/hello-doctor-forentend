import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Printer, Lock, Paperclip, Plus, X, FileText, RefreshCw, Activity, User, Calendar, Shield, ArrowRight } from 'lucide-react';
import { getMRDByPatientId, addMRDEntry, exportMRD, getPatients, getEntryByAppointment } from '../api/index';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_ENTRY = {
    patient_id: '', appointment_id: '', visit_date: today(),
    visit_type: 'CONSULTATION', attending_doctor: 'Dr. Indu',
    chief_complaint: '', clinical_notes: '', diagnosis: '',
    prescription: '', investigations: '', next_visit_due: '', recorded_by: 'Dr. Indu'
};

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
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
    return [p.salutation, p.first_name || p.name, p.last_name].filter(Boolean).join(' ');
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

    const loadDirectory = useCallback(async (q = '') => {
        setDirLoading(true);
        try {
            const r = await getPatients({ limit: 50, search: q });
            setPatients(r.data.data || []);
        }
        catch (e) { console.error(e); }
        finally { setDirLoading(false); }
    }, []);

    useEffect(() => { loadDirectory(); }, [loadDirectory]);

    const selectPatientRecord = async (p) => {
        if (selectedPatient?.patient_id === p.patient_id) return;
        setSelectedPatient(p);
        setRecords([]);
        setSelectedRecord(null);
        setKeywordSearch('');
        setFilterType('ALL');
        setRecLoading(true);
        try {
            const r = await getMRDByPatientId(p.patient_id);
            const e = r.data?.data?.entries || [];
            setRecords(e);
            if (e.length) setSelectedRecord(e[0]);
        } catch (e) { console.error(e); }
        finally { setRecLoading(false); }
    };

    const handleAppointmentLookup = async () => {
        if (!appointmentSearch.trim()) return;
        setRecLoading(true);
        try {
            const r = await getEntryByAppointment(appointmentSearch.trim());
            const entry = r.data?.data;
            if (entry) {
                // If found, we might need to load the patient too
                if (!selectedPatient || selectedPatient.patient_id !== entry.patient_id) {
                    const pRes = await getPatients({ search: entry.patient_id });
                    if (pRes.data?.data?.length > 0) {
                        setSelectedPatient(pRes.data.data[0]);
                    }
                }
                setRecords([entry]);
                setSelectedRecord(entry);
                setTab('details');
            } else {
                alert("No MRD entry found for this appointment ID");
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
            a.download = `MRD_${selectedPatient.patient_id}_${today()}.json`;
            a.click();
            URL.revokeObjectURL(u);
        } catch (e) { console.error(e); } finally { setExporting(false); }
    };

    const handleAddEntry = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormStatus({ error: null, success: null });
        try {
            await addMRDEntry({ ...form, patient_id: form.patient_id || selectedPatient?.patient_id });
            setFormStatus({ error: null, success: 'Entry added successfully.' });
            setForm(EMPTY_ENTRY);
            if (selectedPatient) {
                const r = await getMRDByPatientId(selectedPatient.patient_id);
                setRecords(r.data?.data?.entries || []);
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setFormStatus({ error: "Conflict: This Patient ID already has an existing MRD record. Multiple records for the same ID are not allowed.", success: null });
            } else {
                setFormStatus({ error: errorMsg, success: null });
            }
        }
        finally { setSaving(false); }
    };

    const openEntryModal = () => {
        setShowModal(true);
        setFormStatus({ error: null, success: null });
        setForm({ ...EMPTY_ENTRY, patient_id: selectedPatient?.patient_id || '' });
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
        <div className="mrd-page-v3">
            <header className="mrd-header-v3">
                <div className="title-section">
                    <h1 title="Medical Records Department">MRD</h1>
                    <p className="subtitle">Longitudinal Health Registry & Clinical Records</p>
                </div>
                <div className="header-actions">
                    <div className="search-bar-v3">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search Patients..."
                            value={patientSearch}
                            onChange={(e) => {
                                setPatientSearch(e.target.value);
                                if (e.target.value.length > 2) loadDirectory(e.target.value);
                                else if (e.target.value.length === 0) loadDirectory();
                            }}
                        />
                        {dirLoading && <RefreshCw size={16} className="spinning" />}
                    </div>
                    <div className="search-bar-v3">
                        <Paperclip size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Lookup Appointment ID..."
                            value={appointmentSearch}
                            onChange={(e) => setAppointmentSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAppointmentLookup()}
                        />
                        <button className="btn-mini-search" onClick={handleAppointmentLookup}>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                    <button className="btn-sync-v3" onClick={() => loadDirectory()}>
                        <RefreshCw size={16} />
                        <span>Sync Directory</span>
                    </button>
                </div>
            </header>

            <div className="mrd-workspace-v3">
                {/* 1. Directory Panel */}
                <aside className="mrd-panel-v3 sidebar-panel">
                    <div className="panel-label">Patient Directory</div>
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
                                    <div className="avatar" style={{ background: isSelected ? avatarColor(ini) : '#f1f5f9', color: isSelected ? '#fff' : '#64748b' }}>
                                        {ini}
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
                                        key={rec._id || i}
                                        className={`record-card-v3 ${selectedRecord === rec ? 'selected' : ''}`}
                                        onClick={() => { setSelectedRecord(rec); setTab('details'); }}
                                    >
                                        <div className="record-header">
                                            <span className="record-date">{fmt(rec.visit_date || rec.createdAt)}</span>
                                            <span className={`type-tag ${rec.visit_type.toLowerCase()}`}>{rec.visit_type}</span>
                                        </div>
                                        <div className="record-diagnosis">{rec.diagnosis || rec.chief_complaint || 'General Checkup'}</div>
                                        <div className="record-footer">
                                            <div className="doctor-pill"><Activity size={10} /> {rec.attending_doctor}</div>
                                            {rec.prescription && <div className="attachment-pill"><Paperclip size={10} /> Rx</div>}
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
                                        <article className="info-block-v3">
                                            <label>Chief Complaint</label>
                                            <p>{selectedRecord.chief_complaint || 'No complaint recorded.'}</p>
                                        </article>
                                        <article className="info-block-v3">
                                            <label>Physical Examination & Findings</label>
                                            <p>{selectedRecord.clinical_notes || 'No notes available.'}</p>
                                        </article>
                                        {selectedRecord.visit_type === 'VACCINATION' && (
                                            <article className="info-block-v3 vaccination">
                                                <label>Immunization Track</label>
                                                <div className="vaccine-box">
                                                    <Shield size={16} />
                                                    <span>{selectedRecord.diagnosis || "Regular Immunization"}</span>
                                                </div>
                                            </article>
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
                            <h3>New Clinical Entry</h3>
                            <button onClick={() => setShowModal(false)}><X size={20} /></button>
                        </header>

                        <form onSubmit={handleAddEntry} className="entry-form-v3">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Patient ID</label>
                                    <input disabled value={form.patient_id} />
                                </div>
                                <div className="form-group">
                                    <label>Visit Date</label>
                                    <input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} required />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Visit Type</label>
                                    <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })}>
                                        <option value="CONSULTATION">Consultation</option>
                                        <option value="VACCINATION">Vaccination</option>
                                        <option value="FOLLOW_UP">Follow-up</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Attending Doctor</label>
                                    <input value={form.attending_doctor} onChange={e => setForm({ ...form, attending_doctor: e.target.value })} required />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Diagnosis / Purpose</label>
                                <input placeholder="Enter diagnosis..." value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label>Prescription (Each medicine on new line)</label>
                                <textarea rows={4} placeholder="Medicine Name - Dosage - Frequency" value={form.prescription} onChange={e => setForm({ ...form, prescription: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label>Clinical Notes</label>
                                <textarea rows={3} placeholder="Record symptoms and observations..." value={form.clinical_notes} onChange={e => setForm({ ...form, clinical_notes: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label>Next Review Due</label>
                                <input type="date" value={form.next_visit_due} onChange={e => setForm({ ...form, next_visit_due: e.target.value })} />
                            </div>

                            {formStatus.error && <p className="error-msg">{formStatus.error}</p>}
                            {formStatus.success && <p className="success-msg">{formStatus.success}</p>}

                            <div className="form-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-submit" disabled={saving}>
                                    {saving ? 'Processing...' : 'Save Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .mrd-page-v3 { height: calc(100vh - 80px); display: flex; flex-direction: column; background: #f8fafc; overflow: hidden; }
                
                .mrd-header-v3 { padding: 1.5rem 2rem; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .mrd-header-v3 h1 { font-size: 1.75rem; font-weight: 900; color: #0f172a; margin: 0; }
                .mrd-header-v3 .subtitle { font-size: 0.85rem; color: #64748b; margin: 0; font-weight: 600; }
                
                .header-actions { display: flex; gap: 1rem; align-items: center; }
                .search-bar-v3 { position: relative; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; padding: 0 1rem; width: 260px; }
                .search-bar-v3 input { background: transparent; border: none; padding: 0.75rem; width: 100%; outline: none; font-weight: 600; font-size: 0.85rem; }
                .search-bar-v3 .search-icon { color: #94a3b8; }
                .btn-mini-search { background: #6366f1; color: #fff; border: none; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 0.5rem; transition: 0.2s; }
                .btn-mini-search:hover { background: #4338ca; }
                
                .btn-sync-v3 { background: #fff; border: 1px solid #e2e8f0; padding: 0.75rem 1.25rem; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem; font-weight: 700; cursor: pointer; color: #1e293b; transition: 0.2s; }
                .btn-sync-v3:hover { background: #f8fafc; border-color: #6366f1; color: #6366f1; }
                
                .mrd-workspace-v3 { flex: 1; display: flex; overflow: hidden; }
                
                .mrd-panel-v3 { background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
                .sidebar-panel { width: 280px; flex-shrink: 0; }
                .timeline-panel { width: 360px; flex-shrink: 0; background: #fcfdfe; }
                
                .panel-label { padding: 1rem 1.5rem 0.5rem; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .patient-list-v3 { flex: 1; overflow-y: auto; padding: 0.5rem; }
                .patient-item-v3 { padding: 0.85rem 1rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; cursor: pointer; position: relative; transition: 0.2s; }
                .patient-item-v3:hover { background: #f8fafc; }
                .patient-item-v3.selected { background: #eff6ff; }
                .patient-item-v3 .avatar { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; }
                .patient-item-v3 .info { flex: 1; overflow: hidden; }
                .patient-item-v3 .p-name { font-weight: 700; font-size: 0.95rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .patient-item-v3 .p-meta { font-size: 0.75rem; color: #64748b; font-weight: 600; margin-top: 0.1rem; }
                .selected-indicator { color: #6366f1; }
                
                .panel-header-v3 { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .selected-patient-meta h3 { margin: 0; font-size: 1.15rem; font-weight: 900; color: #0f172a; }
                .selected-patient-meta p { margin: 0.2rem 0 0 0; font-size: 0.8rem; font-weight: 700; color: #94a3b8; }
                .btn-add-mini { width: 36px; height: 36px; border-radius: 10px; border: none; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(99,102,241,0.2); }
                
                .timeline-filters { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; border-bottom: 1px solid #f1f5f9; }
                .keyword-search { position: relative; display: flex; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 0.75rem; }
                .keyword-search input { width: 100%; border: none; padding: 0.6rem; font-size: 0.85rem; outline: none; font-weight: 600; }
                .keyword-search svg { color: #94a3b8; }
                
                .type-pills { display: flex; gap: 0.4rem; }
                .type-pills button { flex: 1; border: none; background: #f1f5f9; padding: 0.5rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; }
                .type-pills button.active { background: #1e293b; color: #fff; }
                
                .records-timeline-v3 { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .record-card-v3 { padding: 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: 0.2s; }
                .record-card-v3:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                .record-card-v3.selected { border-color: #6366f1; background: #fdfdff; box-shadow: 0 4px 12px rgba(99,102,241,0.06); }
                
                .record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
                .record-date { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                .type-tag { padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.04em; }
                .type-tag.consultation { background: #eff6ff; color: #2563eb; }
                .type-tag.vaccination { background: #ecfdf5; color: #059669; }
                
                .record-diagnosis { font-weight: 800; color: #1e293b; font-size: 0.95rem; margin-bottom: 1rem; }
                .record-footer { display: flex; gap: 0.6rem; }
                .doctor-pill, .attachment-pill { display: flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.6rem; background: #f8fafc; border-radius: 6px; font-size: 0.7rem; font-weight: 700; color: #64748b; }
                
                .mrd-main-v3 { flex: 1; overflow-y: auto; background: #f8fafc; padding: 2rem; }
                .empty-selection { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #94a3b8; }
                .empty-selection h3 { margin: 1.5rem 0 0.5rem; color: #475569; }
                
                .record-detail-v3 { background: #fff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 10px 40px rgba(0,0,0,0.03); overflow: hidden; max-width: 800px; margin: 0 auto; }
                .detail-header-v3 { padding: 2rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
                .visit-badge { display: inline-block; padding: 0.3rem 0.75rem; background: #f1f5f9; border-radius: 6px; font-size: 0.75rem; font-weight: 800; color: #475569; margin-bottom: 1rem; }
                .primary-info h2 { margin: 0 0 0.75rem 0; font-size: 1.75rem; font-weight: 950; color: #0f172a; letter-spacing: -0.03em; }
                .primary-info .meta { display: flex; gap: 1.5rem; color: #64748b; font-size: 0.85rem; font-weight: 600; }
                .primary-info .meta span { display: flex; align-items: center; gap: 0.5rem; }
                
                .detail-actions { display: flex; gap: 0.5rem; }
                .btn-icon { width: 44px; height: 44px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; color: #1e293b; }
                .btn-icon:hover { border-color: #6366f1; color: #6366f1; background: #fdfdff; }
                
                .detail-tabs-v3 { display: flex; padding: 0 1rem; border-bottom: 1px solid #f1f5f9; background: #fafbfc; }
                .detail-tabs-v3 button { padding: 1rem 1.25rem; border: none; background: transparent; font-weight: 800; font-size: 0.85rem; color: #94a3b8; cursor: pointer; position: relative; }
                .detail-tabs-v3 button.active { color: #6366f1; }
                .detail-tabs-v3 button.active::after { content: ''; position: absolute; bottom: 0; left: 1rem; right: 1rem; height: 3px; background: #6366f1; border-radius: 3px 3px 0 0; }
                
                .tab-content-v3 { padding: 1.5rem 2rem; }
                .clinical-grid-v3 { display: grid; gap: 1.5rem; }
                .info-block-v3 label { display: block; font-size: 0.75rem; font-weight: 850; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.75rem; }
                .info-block-v3 p { margin: 0; font-size: 0.95rem; line-height: 1.6; color: #1e293b; font-weight: 500; }
                
                .vaccine-box { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: #ecfdf5; border-radius: 12px; color: #059669; font-weight: 800; border: 1px solid #d1fae5; }
                
                .prescription-view-v3 { display: flex; flex-direction: column; gap: 0.75rem; }
                .rx-line-v3 { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
                .rx-num { width: 28px; height: 28px; background: #6366f1; color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; }
                .rx-text { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
                
                .next-due-card { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; background: #fffbe6; border-radius: 16px; border: 1px solid #ffec3d; color: #856404; max-width: 300px; }
                .next-due-card .val { font-size: 1.1rem; font-weight: 900; }
                
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .modal-overlay-v3 { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 2rem; }
                .modal-content-v3 { background: #fff; width: 100%; max-width: 600px; border-radius: 24px; box-shadow: 0 40px 100px rgba(0,0,0,0.1); overflow: hidden; }
                .modal-header-v3 { padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .modal-header-v3 h3 { margin: 0; font-weight: 900; }
                
                .entry-form-v3 { padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem; max-height: 70vh; overflow-y: auto; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
                .form-group label { display: block; font-size: 0.8rem; font-weight: 800; color: #475569; margin-bottom: 0.5rem; }
                .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.75rem; border-radius: 10px; border: 1.5px solid #e2e8f0; font-weight: 600; font-size: 0.9rem; }
                .form-group input:disabled { background: #f8fafc; color: #94a3b8; }
                
                .form-actions { display: flex; gap: 1rem; margin-top: 1rem; }
                .btn-cancel { flex: 1; padding: 0.85rem; border: none; background: #f1f5f9; border-radius: 12px; font-weight: 800; cursor: pointer; }
                .btn-submit { flex: 2; padding: 0.85rem; border: none; background: #0f172a; color: #fff; border-radius: 12px; font-weight: 800; cursor: pointer; }
                .error-msg { color: #dc2626; font-size: 0.85rem; font-weight: 700; background: #fef2f2; padding: 0.75rem; border-radius: 8px; border-left: 4px solid #ef4444; }
                .success-msg { color: #059669; font-size: 0.85rem; font-weight: 700; background: #f0fdf4; padding: 0.75rem; border-radius: 8px; border-left: 4px solid #10b981; }
            `}</style>
        </div>
    );
};

export default MRD;
