import React, { useState, useEffect } from 'react';
import { 
    Clipboard, Heart, AlertCircle, Sparkles, User, FileText, Activity, 
    Stethoscope, Pill, CheckSquare, Plus, Save, Trash, Calendar, ArrowLeft
} from 'lucide-react';
import { getPatients, addMRDEntry, getDoctors } from '../services/api';

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

    const selectPatient = (p) => {
        setSelectedPatient(p);
        setForm(prev => ({ ...prev, patient_id: p.patient_id }));
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
                        <Clipboard size={28} color="#0d7f6e" /> New Clinical Entry
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
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '16px' }}>Select Patient to Begin</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {patients.map(p => (
                            <div 
                                key={p.patient_id}
                                onClick={() => selectPatient(p)}
                                style={{ padding: '16px', border: '1.5px solid #f1f5f9', background: '#f8fafc', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d7f6e'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>{p.child_name || p.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>ID: {p.patient_id} • Mob: {p.patient_mobile || 'N/A'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' }}>
                    
                    {/* Left Panel: Summary & Tab Nav */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '24px' }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <button 
                                type="button" 
                                onClick={() => setSelectedPatient(null)} 
                                style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '16px' }}
                            >
                                <ArrowLeft size={14} /> Back to Search
                            </button>
                            <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', margin: '0 0 12px' }}>{selectedPatient.child_name || selectedPatient.name}</h3>
                            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span><strong>ID:</strong> {selectedPatient.patient_id}</span>
                                <span><strong>Gender:</strong> {selectedPatient.gender || '—'}</span>
                                <span><strong>Mobile:</strong> {selectedPatient.patient_mobile || '—'}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            {[
                                { id: 'overview', label: 'Vitals & Summary', icon: Heart },
                                { id: 'allergies', label: 'Allergy Records', icon: AlertCircle },
                                { id: 'history', label: 'History of Illness', icon: FileText },
                                { id: 'exam', label: 'Physical Exams', icon: Stethoscope },
                                { id: 'diagnosis', label: 'Provisional Diagnosis', icon: Activity },
                                { id: 'meds', label: 'Medications & Advice', icon: Pill }
                            ].map(t => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setActiveTab(t.id)}
                                        style={{
                                            padding: '14px 20px',
                                            border: 'none',
                                            borderBottom: '1px solid #f1f5f9',
                                            background: activeTab === t.id ? '#0d7f6e10' : 'none',
                                            color: activeTab === t.id ? '#0d7f6e' : '#475569',
                                            fontSize: '14px',
                                            fontWeight: activeTab === t.id ? 800 : 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            textAlign: 'left',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Icon size={18} color={activeTab === t.id ? '#0d7f6e' : '#64748b'} />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(13,127,110,0.2)' }}
                        >
                            <Save size={18} /> {loading ? 'Processing...' : 'Save Patient Record'}
                        </button>
                    </aside>

                    {/* Right Panel: Content Grid */}
                    <main style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        
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

                    </main>
                </form>
            )}
        </div>
    );
}
