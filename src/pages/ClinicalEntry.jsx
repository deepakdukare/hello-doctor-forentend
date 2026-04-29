import React, { useState, useEffect } from 'react';
import { 
    Clipboard, Heart, AlertCircle, Sparkles, User, FileText, Activity, 
    Stethoscope, Pill, CheckSquare, Plus, Save, Trash, Calendar, ArrowLeft, Search, ChevronRight
} from 'lucide-react';
import { getPatients, addMRDEntry, getDoctors, getMRDByPatientId } from '../api';

const VISIT_TYPES = ['CONSULTATION', 'VACCINATION', 'PULMONARY', 'FOLLOWUP'];

const INITIAL_FORM = {
    patient_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_type: 'CONSULTATION',
    attending_doctor: '',
    chief_complaint: '',
    clinical_notes: '',
    diagnosis: '',
    prescription: '',
    investigations: '',
    advice: '',
    weight: '',
    height: '',
    temperature: '',
    spo2: '',
    pulse: '',
    head_circumference: '',
    
    // Advanced EHR Payload
    advanced: {
        vitals: { BP: '', respiration: '', random_sugar: '', pain_score: '', fall_risk: '' },
        allergies: [],
        history: { hpi: '', past: '', socioeconomic: '', family: [] },
        physical_exam: { pallor: false, icterus: false, oedema: false, lymphadenopathy: false, cyanosis: false, clubbing: false, general: '', systemic: '' },
        diagnoses: [],
        investigations_list: [],
        procedures_list: [],
        medications_list: [],
        followup: { admission: 'Not-Required', next_date: '', advice: '' },
        referral: { location: '', speciality: '', doctor: '', intent: '' }
    }
};

export default function ClinicalEntry() {
    const [activeTab, setActiveTab] = useState('overview');
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [pastRecords, setPastRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    
    // Temporary states for array builders
    const [tempAllergy, setTempAllergy] = useState({ type: 'Drugs', name: '', reaction: '', intensity: 'Mild', duration: '' });
    const [tempFamily, setTempFamily] = useState({ disease: '', relationship: '' });
    const [tempDiag, setTempDiag] = useState({ diagnosis: '', stage: 'Provisional', type: 'Primary' });
    const [tempInv, setTempInv] = useState({ investigation: '', priority: 'Routine' });
    const [tempMed, setTempMed] = useState({ brand: '', generic: '', dose: '', route: '', schedule: '', days: '', instruction: '' });

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [pRes, dRes] = await Promise.all([getPatients({ limit: 100 }), getDoctors()]);
                setPatients(pRes.data?.data || []);
                setDoctors(dRes.data?.data || dRes.data || []);
            } catch (err) { console.error(err); }
        };
        fetchMeta();
    }, []);

    const selectPatient = async (p) => {
        setSelectedPatient(p);
        setForm(prev => ({ ...prev, patient_id: p.patient_id }));
        setLoadingRecords(true);
        try {
            const r = await getMRDByPatientId(p.patient_id);
            setPastRecords(r.data?.data?.entries || []);
        } catch (e) {
            setPastRecords([]);
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.patient_id) {
            setMessage({ type: 'error', text: 'Please select a valid patient.' });
            return;
        }
        setLoading(true);
        try {
            // Reconcile multi-lists into base strings for legacy compatibility if possible
            const payload = {
                ...form,
                prescription: form.prescription || form.advanced.medications_list.map(m => `${m.brand} (${m.generic}) - ${m.dose} - ${m.schedule}`).join('\n'),
                investigations: form.investigations || form.advanced.investigations_list.map(i => `${i.investigation} (${i.priority})`).join(', '),
                diagnosis: form.diagnosis || form.advanced.diagnoses.map(d => `${d.diagnosis} [${d.stage}]`).join(', '),
                advanced_clinical_entry: form.advanced
            };
            
            await addMRDEntry(payload);
            setMessage({ type: 'success', text: 'Advanced Clinical Documentation Saved Successfully.' });
            setForm(INITIAL_FORM);
            setSelectedPatient(null);
            setActiveTab('overview');
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        } finally {
            setLoading(false);
        }
    };

    // Array Builders Logic
    const addAllergy = () => {
        if (!tempAllergy.name) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, allergies: [...f.advanced.allergies, tempAllergy] } }));
        setTempAllergy({ type: 'Drugs', name: '', reaction: '', intensity: 'Mild', duration: '' });
    };

    const addFamily = () => {
        if (!tempFamily.disease) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, history: { ...f.advanced.history, family: [...f.advanced.history.family, tempFamily] } } }));
        setTempFamily({ disease: '', relationship: '' });
    };

    const addDiagnosis = () => {
        if (!tempDiag.diagnosis) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, diagnoses: [...f.advanced.diagnoses, tempDiag] } }));
        setTempDiag({ diagnosis: '', stage: 'Provisional', type: 'Primary' });
    };

    const addInvestigation = () => {
        if (!tempInv.investigation) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, investigations_list: [...f.advanced.investigations_list, tempInv] } }));
        setTempInv({ investigation: '', priority: 'Routine' });
    };

    const addMedication = () => {
        if (!tempMed.brand) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, medications_list: [...f.advanced.medications_list, tempMed] } }));
        setTempMed({ brand: '', generic: '', dose: '', route: '', schedule: '', days: '', instruction: '' });
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clipboard size={28} color="#0d7f6e" /> E-prescription
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Document comprehensive patient visits with advanced medical protocols</p>
                </div>
            </div>

            {message.text && (
                <div style={{ padding: '12px 16px', background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#991b1b' : '#166534', borderRadius: '8px', marginBottom: '24px', fontWeight: 600, fontSize: '14px', border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
                    {message.text}
                </div>
            )}

            {!selectedPatient ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Select Patient to Begin</h2>
                        <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                type="text" 
                                placeholder="Search by name or ID..." 
                                value={patientSearch}
                                onChange={e => setPatientSearch(e.target.value)}
                                style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
                                onFocus={e => e.target.style.borderColor = '#0d7f6e'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                        {patients.filter(p => {
                            const q = patientSearch.toLowerCase();
                            return (p.child_name || p.name || '').toLowerCase().includes(q) || (p.patient_id || '').toLowerCase().includes(q);
                        }).map(p => (
                            <div 
                                key={p.patient_id}
                                onClick={() => selectPatient(p)}
                                style={{ padding: '20px', border: '1.5px solid #f1f5f9', background: '#fff', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d7f6e'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                                    {(p.child_name || p.name || 'P')[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{p.child_name || p.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                                        <span style={{ color: '#0d7f6e' }}>ID: {p.patient_id}</span> • Mob: {p.patient_mobile || 'N/A'}
                                    </div>
                                </div>
                                <div style={{ color: '#cbd5e1' }}><ChevronRight size={20} /></div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Top Patient Header Area (Max Healthcare Style) */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '24px', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f8fafc', overflow: 'hidden', border: '2px solid #0d7f6e' }}>
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Doctor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <button type="button" onClick={() => setSelectedPatient(null)} style={{ background: '#f1f5f9', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>CHANGE</button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
                            <span style={{ color: '#64748b' }}>Name</span><span style={{ fontWeight: 800 }}>: {selectedPatient.child_name || selectedPatient.name}</span>
                            <span style={{ color: '#64748b' }}>Age</span><span style={{ fontWeight: 800 }}>: {selectedPatient.age || '—'}</span>
                            <span style={{ color: '#64748b' }}>Gender</span><span style={{ fontWeight: 800 }}>: {selectedPatient.gender || '—'}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
                            <span style={{ color: '#64748b' }}>Patient ID</span><span style={{ fontWeight: 800 }}>: {selectedPatient.patient_id}</span>
                            <span style={{ color: '#64748b' }}>Mobile</span><span style={{ fontWeight: 800 }}>: {selectedPatient.patient_mobile || '—'}</span>
                            <span style={{ color: '#64748b' }}>Visit Type</span><span style={{ fontWeight: 800 }}>: {form.visit_type}</span>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px', border: '1px solid #f1f5f9' }}>
                            <span style={{ color: '#64748b' }}>Weight</span><span style={{ fontWeight: 800 }}>: {form.weight || '—'} kg</span>
                            <span style={{ color: '#64748b' }}>Temp</span><span style={{ fontWeight: 800 }}>: {form.temperature || '—'} °F</span>
                            <span style={{ color: '#64748b' }}>BP</span><span style={{ fontWeight: 800 }}>: {form.advanced.vitals.BP || '—'}</span>
                        </div>
                    </div>

                    {/* Main Content Area: Sidebar + Form + Right Side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: '20px', alignItems: 'start' }}>
                        
                        {/* Left Sidebar: Section Buttons */}
                        <aside style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { id: 'overview', label: 'Vitals & Summary', icon: Heart },
                                { id: 'allergies', label: 'Allergy Records', icon: AlertCircle },
                                { id: 'history', label: 'History of Illness', icon: FileText },
                                { id: 'exam', label: 'Physical Exams', icon: Stethoscope },
                                { id: 'diagnosis', label: 'Provisional Diagnosis', icon: Activity },
                                { id: 'meds', label: 'Medications & Advice', icon: Pill },
                                { id: 'past_records', label: 'Past Records', icon: Calendar }
                            ].map(t => {
                                const Icon = t.icon;
                                const isActive = activeTab === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setActiveTab(t.id)}
                                        style={{
                                            padding: '12px 16px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            background: isActive ? '#0d7f6e' : '#fff',
                                            color: isActive ? '#fff' : '#64748b',
                                            fontSize: '14px',
                                            fontWeight: isActive ? 800 : 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: isActive ? '0 4px 12px rgba(13,127,110,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                                            border: isActive ? 'none' : '1px solid #f1f5f9'
                                        }}
                                    >
                                        <Icon size={18} color={isActive ? '#fff' : '#94a3b8'} />
                                        {t.label}
                                    </button>
                                );
                            })}
                            
                            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button type="submit" disabled={loading} style={{ width: '100%', background: '#0d7f6e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Save size={18} /> {loading ? 'Saving...' : 'Save & Print'}
                                </button>
                                <button type="button" onClick={() => setForm(INITIAL_FORM)} style={{ width: '100%', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                                    Clear Form
                                </button>
                            </div>
                        </aside>

                        {/* Middle Content: The Form Section */}
                        <main style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', minHeight: '600px' }}>
                        
                        {/* Tab 1: Vitals */}
                        {activeTab === 'overview' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Patient Vitals</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Visit Type</label>
                                        <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })} style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }}>
                                            {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Visit Date</label>
                                        <input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} style={{ width: '100%', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Attending Doctor</label>
                                        <input type="text" value={form.attending_doctor} onChange={e => setForm({ ...form, attending_doctor: e.target.value })} placeholder="e.g. Dr. Indu" style={{ width: '100%', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} />
                                    </div>
                                </div>

                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0d7f6e', marginBottom: '12px' }}>Growth & Clinical Parameters</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                    {[{ label: 'Weight (kg)', key: 'weight' }, { label: 'Height (cm)', key: 'height' }, { label: 'Head Cir (cm)', key: 'head_circumference' }, { label: 'Pulse (bpm)', key: 'pulse' }, { label: 'SPO2 (%)', key: 'spo2' }, { label: 'Temp (°F)', key: 'temperature' }].map(v => (
                                        <div key={v.key}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>{v.label}</label>
                                            <input type="text" value={form[v.key]} onChange={e => setForm({ ...form, [v.key]: e.target.value })} style={{ width: '100%', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                    ))}
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>BP (mmHg)</label>
                                        <input type="text" value={form.advanced.vitals.BP} onChange={e => setForm({ ...form, advanced: { ...form.advanced, vitals: { ...form.advanced.vitals, BP: e.target.value } } })} style={{ width: '100%', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Respiration</label>
                                        <input type="text" value={form.advanced.vitals.respiration} onChange={e => setForm({ ...form, advanced: { ...form.advanced, vitals: { ...form.advanced.vitals, respiration: e.target.value } } })} style={{ width: '100%', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Allergies */}
                        {activeTab === 'allergies' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Allergy Records</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', alignItems: 'end', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Type</label>
                                        <select value={tempAllergy.type} onChange={e => setTempAllergy({ ...tempAllergy, type: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                                            <option>Drugs</option><option>Food</option><option>Others</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Name</label>
                                        <input type="text" value={tempAllergy.name} onChange={e => setTempAllergy({ ...tempAllergy, name: e.target.value })} style={{ width: '100%', padding: '6px' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Reaction</label>
                                        <input type="text" value={tempAllergy.reaction} onChange={e => setTempAllergy({ ...tempAllergy, reaction: e.target.value })} style={{ width: '100%', padding: '6px' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Intensity</label>
                                        <select value={tempAllergy.intensity} onChange={e => setTempAllergy({ ...tempAllergy, intensity: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                                            <option>Mild</option><option>Moderate</option><option>Severe</option>
                                        </select>
                                    </div>
                                    <button type="button" onClick={addAllergy} style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}>Add</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {form.advanced.allergies.map((al, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{al.type} ({al.name}):</strong> {al.reaction} - {al.intensity}</span>
                                            <Trash size={14} style={{ cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, allergies: f.advanced.allergies.filter((_, idx) => idx !== i) } }))} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab 3: History */}
                        {activeTab === 'history' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Clinical History</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Chief Complaints</label>
                                        <textarea rows={3} value={form.chief_complaint} onChange={e => setForm({ ...form, chief_complaint: e.target.value })} placeholder="Type chief complaints..." style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', resize: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>History of Present Illness (HPI)</label>
                                        <textarea rows={3} value={form.advanced.history.hpi} onChange={e => setForm({ ...form, advanced: { ...form.advanced, history: { ...form.advanced.history, hpi: e.target.value } } })} style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', resize: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Past & Socioeconomic History</label>
                                        <textarea rows={3} value={form.advanced.history.past} onChange={e => setForm({ ...form, advanced: { ...form.advanced, history: { ...form.advanced.history, past: e.target.value } } })} style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', resize: 'none' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 4: Physical Exam */}
                        {activeTab === 'exam' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Physical & Systemic Examinations</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                    {['pallor', 'icterus', 'oedema', 'lymphadenopathy', 'cyanosis', 'clubbing'].map(exam => (
                                        <label key={exam} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, textTransform: 'capitalize' }}>
                                            <input type="checkbox" checked={form.advanced.physical_exam[exam]} onChange={e => setForm({ ...form, advanced: { ...form.advanced, physical_exam: { ...form.advanced.physical_exam, [exam]: e.target.checked } } })} />
                                            {exam}
                                        </label>
                                    ))}
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Systemic Examination Observations</label>
                                    <textarea rows={3} value={form.advanced.physical_exam.systemic} onChange={e => setForm({ ...form, advanced: { ...form.advanced, physical_exam: { ...form.advanced.physical_exam, systemic: e.target.value } } })} style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', resize: 'none' }} />
                                </div>
                            </div>
                        )}

                        {/* Tab 5: Diagnosis */}
                        {activeTab === 'diagnosis' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Clinical Assessment & Diagnosis</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Provisional Diagnosis</label>
                                        <input type="text" value={tempDiag.diagnosis} onChange={e => setTempDiag({ ...tempDiag, diagnosis: e.target.value })} placeholder="Diagnosis code..." style={{ width: '100%', padding: '6px' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Stage</label>
                                        <select value={tempDiag.stage} onChange={e => setTempDiag({ ...tempDiag, stage: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                                            <option>Provisional</option><option>Final</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700 }}>Type</label>
                                        <select value={tempDiag.type} onChange={e => setTempDiag({ ...tempDiag, type: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                                            <option>Primary</option><option>Secondary</option>
                                        </select>
                                    </div>
                                    <button type="button" onClick={addDiagnosis} style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}>Add</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {form.advanced.diagnoses.map((dg, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{dg.diagnosis}</strong> [{dg.stage} / {dg.type}]</span>
                                            <Trash size={14} style={{ cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, diagnoses: f.advanced.diagnoses.filter((_, idx) => idx !== i) } }))} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab 6: Medications */}
                        {activeTab === 'meds' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Medication Plans & Prescription</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                                    <input type="text" placeholder="Brand Name" value={tempMed.brand} onChange={e => setTempMed({ ...tempMed, brand: e.target.value })} style={{ padding: '6px' }} />
                                    <input type="text" placeholder="Generic Name" value={tempMed.generic} onChange={e => setTempMed({ ...tempMed, generic: e.target.value })} style={{ padding: '6px' }} />
                                    <input type="text" placeholder="Dose (e.g., 5ml)" value={tempMed.dose} onChange={e => setTempMed({ ...tempMed, dose: e.target.value })} style={{ padding: '6px' }} />
                                    <input type="text" placeholder="Route" value={tempMed.route} onChange={e => setTempMed({ ...tempMed, route: e.target.value })} style={{ padding: '6px' }} />
                                    <input type="text" placeholder="Schedule" value={tempMed.schedule} onChange={e => setTempMed({ ...tempMed, schedule: e.target.value })} style={{ padding: '6px' }} />
                                    <button type="button" onClick={addMedication} style={{ background: '#0d7f6e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}>Add Medication</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                                    {form.advanced.medications_list.map((m, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: '#f0fdf4', color: '#166534', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{m.brand} ({m.generic}):</strong> {m.dose} | {m.schedule}</span>
                                            <Trash size={14} style={{ cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, medications_list: f.advanced.medications_list.filter((_, idx) => idx !== i) } }))} />
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Additional Advice & Instructions</label>
                                    <textarea rows={3} value={form.advice} onChange={e => setForm({ ...form, advice: e.target.value })} placeholder="Type follow-up rules..." style={{ width: '100%', padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '6px', resize: 'none' }} />
                                </div>
                            </div>
                        )}

                        {/* Tab 7: Past Records */}
                        {activeTab === 'past_records' && (
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>Patient Medical History</h3>
                                {loadingRecords ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading records...</div>
                                ) : pastRecords.length === 0 ? (
                                    <div style={{ padding: '40px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                                        No historical records available.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {pastRecords.map((rec, i) => (
                                            <div key={rec._id || i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ fontWeight: 800, color: '#0d7f6e' }}>{new Date(rec.visit_date || rec.createdAt).toLocaleDateString('en-IN')}</span>
                                                    <span style={{ fontSize: '10px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{rec.visit_type}</span>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{rec.diagnosis || 'Clinical Review'}</div>
                                                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Chief Complaint: {rec.chief_complaint || 'N/A'}</div>
                                                {rec.prescription && (
                                                    <div style={{ fontSize: '12px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        <strong>Rx:</strong> {rec.prescription}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </main>
                </form>
            )}
        </div>
    );
}
