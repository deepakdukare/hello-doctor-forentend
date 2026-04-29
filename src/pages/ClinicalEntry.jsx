import React, { useState, useEffect } from 'react';
import { 
    Clipboard, Heart, AlertCircle, Sparkles, User, FileText, Activity, 
    Stethoscope, Pill, CheckSquare, Plus, Save, Trash, Calendar, ArrowLeft, Search, 
    ChevronRight, Printer, CheckCircle, PlusCircle, Bell, X, Clock
} from 'lucide-react';
import { getPatients, addMRDEntry, getDoctors, getMRDByPatientId, getPatientById } from '../api';

const INITIAL_FORM = {
    patient_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_type: 'CONSULTATION',
    doctor_name: '',
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
    blood_pressure: '',
    respiration: '',
    
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
    const [activeTab, setActiveTab] = useState('vitals');
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [pastRecords, setPastRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    
    // Temporary states for builders
    const [tempAllergy, setTempAllergy] = useState({ type: 'Drug', name: '', reaction: '', intensity: 'Mild' });
    const [tempDiag, setTempDiag] = useState({ diagnosis: '', stage: 'Provisional', type: 'Primary' });
    const [tempMed, setTempMed] = useState({ brand: '', generic: '', dose: '', route: '', schedule: '', days: '', instruction: '' });
    const [selectedPastRecord, setSelectedPastRecord] = useState(null);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [pRes, dRes] = await Promise.all([getPatients({ limit: 100 }), getDoctors()]);
                setPatients(pRes.data?.data || []);
                const drs = dRes.data?.data || dRes.data || [];
                setDoctors(drs);
                if (drs.length > 0) setForm(prev => ({ ...prev, doctor_name: drs[0].name }));
            } catch (err) { console.error(err); }
        };
        fetchMeta();
    }, []);

    const selectPatient = async (p) => {
        setLoadingRecords(true);
        try {
            const patientRes = await getPatientById(p._id || p.patient_id);
            const fullPatient = patientRes.data?.data || p;
            
            setSelectedPatient(fullPatient);
            setForm({ ...INITIAL_FORM, patient_id: fullPatient.patient_id, doctor_name: doctors[0]?.name || '' });
            
            const mrdRes = await getMRDByPatientId(fullPatient.patient_id);
            setPastRecords(mrdRes.data.data || []);
        } catch (err) {
            console.error("Failed to fetch full patient profile or records", err);
            setSelectedPatient(p);
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.patient_id) return;
        
        setLoading(true);
        try {
            const payload = {
                ...form,
                prescription: form.prescription || form.advanced.medications_list.map(m => `${m.brand} (${m.generic}) - ${m.dose} - ${m.schedule}`).join('\n'),
                diagnosis: form.diagnosis || form.advanced.diagnoses.map(d => `${d.diagnosis} [${d.stage}]`).join(', '),
                advanced_clinical_entry: form.advanced
            };
            
            await addMRDEntry(payload);
            setMessage({ type: 'success', text: 'Clinical Record Saved Successfully.' });
            
            // Refresh history
            const historyRes = await getMRDByPatientId(selectedPatient.patient_id);
            setPastRecords(historyRes.data.data || []);
            
            // Optional: Reset form or show success view
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        } finally {
            setLoading(false);
        }
    };

    const addAllergy = () => {
        if (!tempAllergy.name) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, allergies: [...f.advanced.allergies, tempAllergy] } }));
        setTempAllergy({ type: 'Drug', name: '', reaction: '', intensity: 'Mild' });
    };

    const addDiagnosis = () => {
        if (!tempDiag.diagnosis) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, diagnoses: [...f.advanced.diagnoses, tempDiag] } }));
        setTempDiag({ diagnosis: '', stage: 'Provisional', type: 'Primary' });
    };

    const addMedication = () => {
        if (!tempMed.brand) return;
        setForm(f => ({ ...f, advanced: { ...f.advanced, medications_list: [...f.advanced.medications_list, tempMed] } }));
        setTempMed({ brand: '', generic: '', dose: '', route: '', schedule: '', days: '', instruction: '' });
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: '"Inter", sans-serif' }}>
            {message.text && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, padding: '16px 24px', background: message.type === 'error' ? '#ef4444' : '#0d7f6e', color: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {message.text}
                </div>
            )}

            {!selectedPatient ? (
                /* Patient Selection View */
                <div style={{ maxWidth: '1200px', margin: '40px auto', background: '#fff', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '30px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #0d7f6e 0%, #065f46 100%)', color: '#fff' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Select Patient to Begin</h2>
                        <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '6px' }}>Search and select a patient to start clinical documentation</p>
                        
                        <div style={{ position: 'relative', maxWidth: '400px', marginTop: '24px' }}>
                            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#0d7f6e' }} size={18} />
                            <input 
                                type="text" 
                                placeholder="Search by name or ID..." 
                                style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: 600, outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                value={patientSearch}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Patient ID</th>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Patient Name</th>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Gender</th>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Age</th>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Father Name</th>
                                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Mobile</th>
                                    <th style={{ padding: '20px 24px', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.filter(p => 
                                    (p.name || p.child_name || '').toLowerCase().includes(patientSearch.toLowerCase()) ||
                                    (p.patient_id || '').toLowerCase().includes(patientSearch.toLowerCase())
                                ).map(p => (
                                    <tr 
                                        key={p.patient_id}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onClick={() => selectPatient(p)}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ background: '#f1f5f9', color: '#1e293b', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px' }}>{p.patient_id}</span>
                                        </td>
                                        <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{p.child_name || p.name}</td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontWeight: 600, fontSize: '12px' }}>{p.gender || '—'}</td>
                                        <td style={{ padding: '14px 20px', fontWeight: 800, color: '#1e293b', fontSize: '13px' }}>{p.age || p.age_text || '—'}</td>
                                        <td style={{ padding: '14px 20px', color: '#64748b', fontWeight: 600, fontSize: '12px' }}>{p.father_name || p.parent_name || '—'}</td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, fontSize: '11px' }}>{p.patient_mobile || p.mobile || p.phone || '—'}</span>
                                        </td>
                                        <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                                            <button style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>SELECT</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Premium Clinical Documentation View */
                <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Floating Patient Header */}
                    <div style={{ background: '#fff', padding: '20px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', position: 'sticky', top: '20px', zIndex: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <button onClick={() => setSelectedPatient(null)} style={{ border: 'none', background: '#f1f5f9', color: '#1e293b', padding: '12px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '13px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                                <ArrowLeft size={20} /> BACK
                            </button>
                            <div style={{ height: '48px', width: '2px', background: '#f1f5f9' }}></div>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.5px' }}>{selectedPatient.child_name || selectedPatient.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{selectedPatient.age || selectedPatient.age_text || '—'} / {selectedPatient.gender}</span>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', color: '#1e293b' }}>ID: {selectedPatient.patient_id}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Father Name</div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{selectedPatient.father_name || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0d7f6e' }}>{selectedPatient.patient_mobile || selectedPatient.mobile || '—'}</div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px 20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8' }}>WT</div>
                                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#0d7f6e' }}>{form.weight || '—'}<span style={{ fontSize: '9px', marginLeft: '1px' }}>kg</span></div>
                                </div>
                                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8' }}>TEMP</div>
                                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#ef4444' }}>{form.temperature || '—'}<span style={{ fontSize: '9px', marginLeft: '1px' }}>°F</span></div>
                                </div>
                                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8' }}>BP</div>
                                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#3b82f6' }}>{form.blood_pressure || '—'}</div>
                                </div>
                            </div>

                            <button onClick={handleSave} style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(13, 127, 110, 0.2)' }}>
                                <Printer size={16} /> SAVE & PRINT
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
                        {/* Sidebar Clinical Navigation */}
                        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', position: 'sticky', top: '120px' }}>
                            <div style={{ padding: '24px 24px 12px 24px', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Flow</div>
                            <SidebarButton icon={<Activity size={20} />} label="Vitals & Summary" active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} />
                            <SidebarButton icon={<AlertCircle size={20} />} label="Allergy Records" active={activeTab === 'allergy'} onClick={() => setActiveTab('allergy')} />
                            <SidebarButton icon={<Clipboard size={20} />} label="History of Illness" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                            <SidebarButton icon={<Stethoscope size={20} />} label="Physical Exams" active={activeTab === 'exam'} onClick={() => setActiveTab('exam')} />
                            <SidebarButton icon={<FileText size={20} />} label="Diagnosis (Dx)" active={activeTab === 'diagnosis'} onClick={() => setActiveTab('diagnosis')} />
                            <SidebarButton icon={<PlusCircle size={20} />} label="Prescription (Rx)" active={activeTab === 'meds'} onClick={() => setActiveTab('meds')} />
                            <div style={{ padding: '24px 24px 12px 24px', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Medical History</div>
                            <SidebarButton icon={<Clock size={20} />} label="Past Records" active={activeTab === 'past'} onClick={() => setActiveTab('past')} />
                        </div>

                        {/* Main Interactive Workspace */}
                        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '40px', minHeight: '700px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' }}>
                            {activeTab === 'vitals' && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Vitals & Parameters</h3>
                                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Capture baseline physiological data for this encounter</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div style={{ background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                <label style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>VISIT TYPE</label>
                                                <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })} style={{ background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 800, color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                                                    <option>CONSULTATION</option><option>REVISIT</option><option>EMERGENCY</option>
                                                </select>
                                            </div>
                                            <div style={{ background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                <label style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>ATTENDING DOCTOR</label>
                                                <select value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} style={{ background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 800, color: '#1e293b', outline: 'none', cursor: 'pointer' }}>
                                                    {doctors.map(d => <option key={d.doctor_id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
                                        <VitalsInput label="Weight" unit="kg" value={form.weight} onChange={v => setForm({ ...form, weight: v })} icon="⚖️" />
                                        <VitalsInput label="Height" unit="cm" value={form.height} onChange={v => setForm({ ...form, height: v })} icon="📏" />
                                        <VitalsInput label="Head Cir" unit="cm" value={form.head_circumference} onChange={v => setForm({ ...form, head_circumference: v })} icon="🧢" />
                                        <VitalsInput label="Pulse" unit="bpm" value={form.pulse} onChange={v => setForm({ ...form, pulse: v })} icon="❤️" />
                                        <VitalsInput label="SPO2" unit="%" value={form.spo2} onChange={v => setForm({ ...form, spo2: v })} icon="🫁" />
                                        <VitalsInput label="Temp" unit="°F" value={form.temperature} onChange={v => setForm({ ...form, temperature: v })} icon="🌡️" />
                                        <VitalsInput label="BP" unit="mmHg" value={form.blood_pressure} onChange={v => setForm({ ...form, blood_pressure: v })} icon="🩺" />
                                        <VitalsInput label="Respiration" unit="" value={form.respiration} onChange={v => setForm({ ...form, respiration: v })} icon="🌬️" />
                                    </div>

                                    <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                            <FileText size={20} color="#0d7f6e" />
                                            <label style={{ fontSize: '15px', fontWeight: 900, color: '#1e293b' }}>Clinical Summary & Impression</label>
                                        </div>
                                        <textarea 
                                            rows={8} 
                                            value={form.clinical_notes} 
                                            onChange={e => setForm({ ...form, clinical_notes: e.target.value })}
                                            placeholder="Document your overall clinical assessment here..." 
                                            style={{ width: '100%', padding: '20px', border: '1.5px solid #e2e8f0', borderRadius: '16px', fontSize: '15px', lineHeight: '1.7', outline: 'none', transition: 'all 0.2s', background: '#fff' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'allergy' && (
                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Allergy Records</h3>
                                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Maintain a persistent record of patient sensitivities</p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: '16px', background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '32px', alignItems: 'end' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>TYPE</label>
                                            <select value={tempAllergy.type} onChange={e => setTempAllergy({ ...tempAllergy, type: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 700 }}>
                                                <option>Drug</option><option>Food</option><option>Environment</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>ALLERGEN NAME</label>
                                            <input type="text" placeholder="e.g. Penicillin" value={tempAllergy.name} onChange={e => setTempAllergy({ ...tempAllergy, name: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>REACTION</label>
                                            <input type="text" placeholder="e.g. Skin Rash" value={tempAllergy.reaction} onChange={e => setTempAllergy({ ...tempAllergy, reaction: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <button type="button" onClick={addAllergy} style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>ADD</button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                        {form.advanced.allergies.map((al, i) => (
                                            <div key={i} style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2', padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 800, opacity: 0.6 }}>{al.type.toUpperCase()}</div>
                                                    <div style={{ fontSize: '15px', fontWeight: 800 }}>{al.name}</div>
                                                    <div style={{ fontSize: '13px' }}>{al.reaction}</div>
                                                </div>
                                                <X size={18} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, allergies: f.advanced.allergies.filter((_, idx) => idx !== i) } }))} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Clinical History</h3>
                                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Document chief complaints and anamnesis</p>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <HistoryCard label="Chief Complaints" value={form.chief_complaint} onChange={v => setForm({ ...form, chief_complaint: v })} icon={<Activity size={18} />} />
                                        <HistoryCard label="History of Present Illness (HPI)" value={form.advanced.history.hpi} onChange={v => setForm({ ...form, advanced: { ...form.advanced, history: { ...form.advanced.history, hpi: v } } })} icon={<Clipboard size={18} />} />
                                        <HistoryCard label="Past & Socioeconomic History" value={form.advanced.history.past} onChange={v => setForm({ ...form, advanced: { ...form.advanced, history: { ...form.advanced.history, past: v } } })} icon={<Clock size={18} />} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'exam' && (
                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Physical Examinations</h3>
                                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>General and Systemic evaluation</p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                        {['pallor', 'icterus', 'oedema', 'lymphadenopathy', 'cyanosis', 'clubbing'].map(exam => (
                                            <label key={exam} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '14px', fontWeight: 800, color: '#1e293b', textTransform: 'capitalize' }}>
                                                <input type="checkbox" checked={form.advanced.physical_exam[exam]} onChange={e => setForm({ ...form, advanced: { ...form.advanced, physical_exam: { ...form.advanced.physical_exam, [exam]: e.target.checked } } })} style={{ width: '18px', height: '18px', accentColor: '#0d7f6e' }} />
                                                {exam}
                                            </label>
                                        ))}
                                    </div>
                                    <HistoryCard label="Systemic Examination Notes" value={form.advanced.physical_exam.systemic} onChange={v => setForm({ ...form, advanced: { ...form.advanced, physical_exam: { ...form.advanced.physical_exam, systemic: v } } })} icon={<Stethoscope size={18} />} />
                                </div>
                            )}

                            {activeTab === 'diagnosis' && (
                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Clinical Assessment</h3>
                                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Provisional and Final Diagnostic entries</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '16px', background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '32px', alignItems: 'end' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>DIAGNOSIS (Dx)</label>
                                            <input type="text" placeholder="Diagnosis code or description..." value={tempDiag.diagnosis} onChange={e => setTempDiag({ ...tempDiag, diagnosis: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>STAGE</label>
                                            <select value={tempDiag.stage} onChange={e => setTempDiag({ ...tempDiag, stage: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 700 }}>
                                                <option>Provisional</option><option>Final</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>TYPE</label>
                                            <select value={tempDiag.type} onChange={e => setTempDiag({ ...tempDiag, type: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 700 }}>
                                                <option>Primary</option><option>Secondary</option>
                                            </select>
                                        </div>
                                        <button type="button" onClick={addDiagnosis} style={{ background: '#0d7f6e', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>ADD</button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {form.advanced.diagnoses.map((dg, i) => (
                                            <div key={i} style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #e0f2fe', padding: '18px 24px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <span style={{ fontSize: '11px', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>{dg.stage} / {dg.type}</span>
                                                    <div style={{ fontSize: '16px', fontWeight: 900 }}>{dg.diagnosis}</div>
                                                </div>
                                                <Trash size={20} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, diagnoses: f.advanced.diagnoses.filter((_, idx) => idx !== i) } }))} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'meds' && (
                                <div>
                                    <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Medication Plan (Rx)</h3>
                                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Prescribe medications and dosage schedules</p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '32px' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>BRAND NAME</label>
                                            <input type="text" placeholder="e.g. Augmentin" value={tempMed.brand} onChange={e => setTempMed({ ...tempMed, brand: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>GENERIC</label>
                                            <input type="text" placeholder="Amoxicillin" value={tempMed.generic} onChange={e => setTempMed({ ...tempMed, generic: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>DOSE</label>
                                            <input type="text" placeholder="5ml / 500mg" value={tempMed.dose} onChange={e => setTempMed({ ...tempMed, dose: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>SCHEDULE</label>
                                            <input type="text" placeholder="1-0-1 / Daily" value={tempMed.schedule} onChange={e => setTempMed({ ...tempMed, schedule: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>DAYS</label>
                                            <input type="text" placeholder="5 Days" value={tempMed.days} onChange={e => setTempMed({ ...tempMed, days: e.target.value })} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px' }} />
                                        </div>
                                        <button type="button" onClick={addMedication} style={{ gridColumn: 'span 3', background: '#0d7f6e', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', marginTop: '8px' }}>ADD MEDICATION TO LIST</button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                        {form.advanced.medications_list.map((m, i) => (
                                            <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '20px 24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                                <div>
                                                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b' }}>{m.brand} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>({m.generic})</span></div>
                                                    <div style={{ fontSize: '13px', color: '#0d7f6e', fontWeight: 700, marginTop: '4px' }}>{m.dose} • {m.schedule} • {m.days} Days</div>
                                                </div>
                                                <Trash size={22} style={{ cursor: 'pointer', color: '#ef4444', opacity: 0.8 }} onClick={() => setForm(f => ({ ...f, advanced: { ...f.advanced, medications_list: f.advanced.medications_list.filter((_, idx) => idx !== i) } }))} />
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ background: '#fffbeb', padding: '32px', borderRadius: '20px', border: '1px solid #fef3c7' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                            <Bell size={20} color="#92400e" />
                                            <label style={{ fontSize: '15px', fontWeight: 900, color: '#92400e' }}>Special Advice & Follow-up Instructions</label>
                                        </div>
                                        <textarea 
                                            rows={5} 
                                            value={form.advice} 
                                            onChange={e => setForm({ ...form, advice: e.target.value })}
                                            placeholder="Type follow-up rules, diet advice, etc..." 
                                            style={{ width: '100%', padding: '20px', border: '1.5px solid #fde68a', borderRadius: '16px', fontSize: '15px', lineHeight: '1.7', outline: 'none', background: 'transparent' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {(activeTab === 'past') && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', margin: 0 }}>
                                                {selectedPastRecord ? 'Full Visit Summary' : 'Clinical Command Center (360°)'}
                                            </h3>
                                            {!selectedPastRecord && <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Longitudinal view of patient medical journey</p>}
                                        </div>
                                        {selectedPastRecord && (
                                            <button onClick={() => setSelectedPastRecord(null)} style={{ background: '#f1f5f9', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>CLOSE VIEW</button>
                                        )}
                                    </div>

                                    {selectedPastRecord ? (
                                        /* Detailed Record View */
                                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', marginBottom: '40px', borderBottom: '1px solid #f1f5f9', paddingBottom: '30px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Visit Date</div>
                                                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{new Date(selectedPastRecord.visit_date || selectedPastRecord.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Attending Doctor</div>
                                                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{selectedPastRecord.doctor_name || 'Medical Officer'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Visit Type</div>
                                                    <div style={{ display: 'inline-block', background: '#ecfdf5', color: '#0d7f6e', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 900 }}>{selectedPastRecord.visit_type || 'CONSULTATION'}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                                                <div>
                                                    <h5 style={{ fontSize: '14px', fontWeight: 900, color: '#0d7f6e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Activity size={18} /> Clinical Parameters</h5>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>WEIGHT</div>
                                                            <div style={{ fontSize: '17px', fontWeight: 900 }}>{selectedPastRecord.weight || '—'} <span style={{ fontSize: '11px' }}>kg</span></div>
                                                        </div>
                                                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>TEMP</div>
                                                            <div style={{ fontSize: '17px', fontWeight: 900 }}>{selectedPastRecord.temperature || '—'} <span style={{ fontSize: '11px' }}>°F</span></div>
                                                        </div>
                                                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>BP</div>
                                                            <div style={{ fontSize: '17px', fontWeight: 900 }}>{selectedPastRecord.blood_pressure || '—'}</div>
                                                        </div>
                                                    </div>

                                                    <h5 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>Diagnosis & Notes</h5>
                                                    <div style={{ padding: '20px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '16px', color: '#166534', fontWeight: 800, fontSize: '16px', marginBottom: '24px' }}>
                                                        {selectedPastRecord.diagnosis || 'Observation Only'}
                                                    </div>
                                                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.7', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                        {selectedPastRecord.clinical_notes || 'No detailed notes recorded for this visit.'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <h5 style={{ fontSize: '14px', fontWeight: 900, color: '#0d7f6e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Clipboard size={18} /> Prescription (Rx)</h5>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                                        {selectedPastRecord.medications?.length > 0 ? (
                                                            selectedPastRecord.medications.map((m, idx) => (
                                                                <div key={idx} style={{ padding: '16px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                                                                    <div style={{ fontWeight: 900, fontSize: '15px', color: '#1e293b' }}>{m.brand} <span style={{ fontWeight: 500, fontSize: '13px', color: '#64748b' }}>({m.generic})</span></div>
                                                                    <div style={{ fontSize: '13px', color: '#0d7f6e', fontWeight: 700, marginTop: '4px' }}>{m.dose} • {m.schedule} • {m.days} Days</div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div style={{ fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', padding: '20px', background: '#f8fafc', borderRadius: '16px', textAlign: 'center' }}>No medications prescribed.</div>
                                                        )}
                                                    </div>

                                                    <h5 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>Doctor's Advice</h5>
                                                    <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', color: '#92400e', fontSize: '14px', lineHeight: '1.7' }}>
                                                        {selectedPastRecord.advice || 'Follow standard protocol.'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* History Dashboard */
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '12px', color: '#0d7f6e' }}><Calendar size={20} /></div>
                                                    <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Visit Logs</h4>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    {loadingRecords ? <div style={{ fontSize: '14px', color: '#94a3b8' }}>Syncing history...</div> : pastRecords.length === 0 ? (
                                                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '40px' }}>No previous encounters found</div>
                                                    ) : (
                                                        pastRecords.map((rec, i) => (
                                                            <div key={i} onClick={() => setSelectedPastRecord(rec)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#0d7f6e'} onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                                                                <div>
                                                                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{new Date(rec.visit_date || rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{rec.doctor_name || 'Medical Officer'}</div>
                                                                </div>
                                                                <div style={{ background: '#ecfdf5', color: '#0d7f6e', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 }}>{rec.visit_type || 'REVISIT'}</div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div style={{ background: '#0f172a', borderRadius: '24px', padding: '32px', color: '#fff' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <Activity size={20} color="#10b981" />
                                                    <h4 style={{ fontSize: '16px', fontWeight: 900, margin: 0 }}>Vitals Trend Analysis</h4>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Weight Progress</div>
                                                        <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '8px', color: '#10b981' }}>Normal</div>
                                                        <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>Stable tracking</div>
                                                    </div>
                                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Visits</div>
                                                        <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '8px' }}>{pastRecords.length}</div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Since registration</div>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                    Clinical analytics sync enabled for this profile.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Premium UI Components ---

const SidebarButton = ({ icon, label, active, onClick }) => (
    <button 
        type="button"
        onClick={onClick}
        style={{ 
            width: '100%', 
            padding: '12px 20px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            border: 'none', 
            background: active ? '#f0fdf4' : 'transparent', 
            color: active ? '#0d7f6e' : '#64748b', 
            cursor: 'pointer', 
            textAlign: 'left', 
            fontSize: '12px', 
            fontWeight: active ? 800 : 600, 
            borderLeft: active ? '4px solid #0d7f6e' : '4px solid transparent',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
    >
        {React.cloneElement(icon, { size: 16 })}
        {label}
    </button>
);

const VitalsInput = ({ label, unit, value, onChange, icon }) => (
    <div style={{ background: '#fff', border: '2px solid #f1f5f9', padding: '12px', borderRadius: '16px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>{icon}</span>
            <label style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <input 
                type="text" 
                value={value} 
                onChange={e => onChange(e.target.value)} 
                placeholder="—" 
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '16px', fontWeight: 900, color: '#1e293b', outline: 'none' }} 
            />
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#cbd5e1' }}>{unit}</span>
        </div>
    </div>
);

const HistoryCard = ({ label, value, onChange, icon }) => (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ background: '#f8fafc', padding: '10px 20px', borderBottom: '1.5px solid #e2e8f0', fontSize: '12px', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {React.cloneElement(icon, { size: 16 })}
            {label}
        </div>
        <textarea 
            rows={4} 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            placeholder={`Type ${label.toLowerCase()}...`}
            style={{ width: '100%', padding: '16px 20px', border: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.6', resize: 'none', color: '#475569' }} 
        />
    </div>
);
