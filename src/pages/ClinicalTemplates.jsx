import React, { useState, useEffect } from 'react';
import { 
    BookOpen, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    Save, 
    X, 
    RefreshCw,
    Clipboard,
    HeartPulse,
    Sparkles,
    AlertTriangle,
    Stethoscope,
    FileText,
    Pill,
    Activity,
    Check,
    CheckCircle2,
    Zap,
    ChevronRight,
    ExternalLink
} from 'lucide-react';
import '../glass-landing.css';
import { getTemplates, upsertClinicalTemplate, deleteClinicalTemplate } from '../api';

const QUICK_COMPLAINTS = [
    'Fever', 'Cough', 'Cold / Runny nose', 'Vomiting', 'Loose stools',
    'Wheezing / Breathlessness', 'Abdominal pain', 'Ear pain', 'Skin rash / Itch',
    'Poor feeding / Appetite loss', 'Headache', 'Sore throat'
];

const QUICK_TESTS = [
    'Complete Blood Count (CBC)', 'CRP (C-Reactive Protein)', 'Serum Electrolytes',
    'Urine Routine & Microscopy', 'Chest X-Ray (AP/PA)', 'Stool Routine & Microscopy',
    'Rapid Dengue NS1 / IgM', 'Liver Function Test (LFT)', 'Renal Function Test (KFT)'
];

const QUICK_PROCEDURES = [
    'Nebulization (Salbutamol/Budecort)', 'Wound Dressing / Cleansing',
    'Suture Removal', 'IV Cannulation', 'IM Injection Administration',
    'Ear Canal Suctioning', 'Foreign Body Removal'
];

const QUICK_ADVICES = [
    'Plenty of oral fluids & rest',
    'Frequent small feeds on demand',
    'Steam inhalation & warm saline gargles',
    'Keep head end elevated during sleep',
    'Tepid sponging if temperature > 101°F',
    'ORS after every loose stool',
    'Avoid oily, spicy and cold foods'
];

const QUICK_WARNING_SIGNS = [
    'Fever > 102°F persisting beyond 3 days',
    'Fast breathing, chest in-drawing or grunting',
    'Inability to drink or retain fluids / persistent vomiting',
    'Excessive sleepiness, lethargy or seizures',
    'Blood in stools or severe abdominal pain',
    'Bluish discoloration of lips or fingernails'
];

const EMPTY_CONDITION_METADATA = {
    icon: '⚡',
    badge: 'Clinical Template',
    nkda: false,
    allergies: [],
    complaints: [],
    hpi: '',
    exam: {
        pe_pallor: 'Absent',
        pe_cyanosis: 'Absent',
        pe_icterus: 'Absent',
        pe_oedema: 'Absent',
        physical_examination: '',
        systemic_examination: ''
    },
    diagnoses: [],
    investigations: [],
    procedures: [],
    prescriptions: [],
    advice_home_care: '',
    advice_diet: '',
    advice_warning_signs: '',
    next_visit_due: '3 days'
};

const ClinicalTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('condition'); // 'condition' | 'note' | 'advice'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: '', type: 'condition', content: '' });
    const [meta, setMeta] = useState({ ...EMPTY_CONDITION_METADATA });
    const [modalSubTab, setModalSubTab] = useState('allergies'); // 'allergies' | 'complaints' | 'exam' | 'diagnoses' | 'investigations' | 'procedures' | 'prescriptions' | 'advice'

    // Draft inputs
    const [allergyDraft, setAllergyDraft] = useState({ category: 'Drug', type: '', reaction: '', intensity: '' });
    const [customComplaint, setCustomComplaint] = useState('');
    const [diagnosisDraft, setDiagnosisDraft] = useState({ diagnosis_name: '', icd_10: '', stage: 'Provisional', severity: 'Moderate' });
    const [investigationDraft, setInvestigationDraft] = useState({ name: '', priority: 'Routine', timeframe: 'Routine' });
    const [procedureDraft, setProcedureDraft] = useState({ name: '', procedure_type: 'Therapeutic' });
    const [prescriptionDraft, setPrescriptionDraft] = useState({ medicine: '', dosage_form: 'Syrup', schedule: '', days: '', route: 'ORAL', instruction: '' });

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await getTemplates();
            setTemplates(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (template = null) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name || template.title || '',
                type: template.type || 'condition',
                content: template.content || ''
            });
            setMeta(template.metadata ? { ...EMPTY_CONDITION_METADATA, ...template.metadata } : { ...EMPTY_CONDITION_METADATA });
        } else {
            setEditingTemplate(null);
            setFormData({ name: '', type: activeTab, content: '' });
            setMeta({ ...EMPTY_CONDITION_METADATA });
        }
        setModalSubTab('allergies');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
        setFormData({ name: '', type: activeTab, content: '' });
        setMeta({ ...EMPTY_CONDITION_METADATA });
    };

    // ── Allergy Handlers ──
    const handleAddAllergy = () => {
        if (!allergyDraft.type.trim()) return;
        setMeta(prev => ({
            ...prev,
            allergies: [...(prev.allergies || []), { ...allergyDraft }]
        }));
        setAllergyDraft({ category: 'Drug', type: '', reaction: '', intensity: '' });
    };

    const handleRemoveAllergy = (idx) => {
        setMeta(prev => ({
            ...prev,
            allergies: (prev.allergies || []).filter((_, i) => i !== idx)
        }));
    };

    // ── Complaint Handlers ──
    const handleToggleComplaint = (chip) => {
        setMeta(prev => {
            const list = prev.complaints || [];
            const exists = list.includes(chip);
            return {
                ...prev,
                complaints: exists ? list.filter(c => c !== chip) : [...list, chip]
            };
        });
    };

    const handleAddCustomComplaint = () => {
        if (!customComplaint.trim()) return;
        if (!(meta.complaints || []).includes(customComplaint.trim())) {
            setMeta(prev => ({
                ...prev,
                complaints: [...(prev.complaints || []), customComplaint.trim()]
            }));
        }
        setCustomComplaint('');
    };

    // ── Diagnosis Handlers ──
    const handleAddDiagnosis = () => {
        if (!diagnosisDraft.diagnosis_name.trim()) return;
        setMeta(prev => ({
            ...prev,
            diagnoses: [...(prev.diagnoses || []), { ...diagnosisDraft }]
        }));
        setDiagnosisDraft({ diagnosis_name: '', icd_10: '', stage: 'Provisional', severity: 'Moderate' });
    };

    const handleRemoveDiagnosis = (idx) => {
        setMeta(prev => ({
            ...prev,
            diagnoses: (prev.diagnoses || []).filter((_, i) => i !== idx)
        }));
    };

    // ── Investigation Handlers ──
    const handleAddInvestigation = (nameOverride = null) => {
        const testName = nameOverride || investigationDraft.name;
        if (!testName.trim()) return;
        setMeta(prev => ({
            ...prev,
            investigations: [...(prev.investigations || []), {
                name: testName.trim(),
                priority: investigationDraft.priority || 'Routine',
                timeframe: investigationDraft.timeframe || 'Routine'
            }]
        }));
        setInvestigationDraft({ name: '', priority: 'Routine', timeframe: 'Routine' });
    };

    const handleRemoveInvestigation = (idx) => {
        setMeta(prev => ({
            ...prev,
            investigations: (prev.investigations || []).filter((_, i) => i !== idx)
        }));
    };

    // ── Procedure Handlers ──
    const handleAddProcedure = (nameOverride = null) => {
        const procName = nameOverride || procedureDraft.name;
        if (!procName.trim()) return;
        setMeta(prev => ({
            ...prev,
            procedures: [...(prev.procedures || []), {
                name: procName.trim(),
                procedure_type: procedureDraft.procedure_type || 'Therapeutic'
            }]
        }));
        setProcedureDraft({ name: '', procedure_type: 'Therapeutic' });
    };

    const handleRemoveProcedure = (idx) => {
        setMeta(prev => ({
            ...prev,
            procedures: (prev.procedures || []).filter((_, i) => i !== idx)
        }));
    };

    // ── Prescription Handlers ──
    const handleAddPrescription = () => {
        if (!prescriptionDraft.medicine.trim()) return;
        setMeta(prev => ({
            ...prev,
            prescriptions: [...(prev.prescriptions || []), { ...prescriptionDraft }]
        }));
        setPrescriptionDraft({ medicine: '', dosage_form: 'Syrup', schedule: '', days: '', route: 'ORAL', instruction: '' });
    };

    const handleRemovePrescription = (idx) => {
        setMeta(prev => ({
            ...prev,
            prescriptions: (prev.prescriptions || []).filter((_, i) => i !== idx)
        }));
    };

    // ── Advice Chips Handler ──
    const handleAppendAdvice = (chip) => {
        setMeta(prev => ({
            ...prev,
            advice_home_care: prev.advice_home_care ? `${prev.advice_home_care}\n• ${chip}` : `• ${chip}`
        }));
    };

    const handleAppendWarningSign = (chip) => {
        setMeta(prev => ({
            ...prev,
            advice_warning_signs: prev.advice_warning_signs ? `${prev.advice_warning_signs}\n• ${chip}` : `• ${chip}`
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const contentToSave = formData.type === 'condition'
                ? (meta.hpi || formData.content || '1-Click Consultation Template')
                : formData.content;

            await upsertClinicalTemplate({
                id: editingTemplate?._id || editingTemplate?.id,
                name: formData.name,
                title: formData.name,
                type: formData.type,
                content: contentToSave,
                metadata: formData.type === 'condition' ? meta : null
            });
            fetchTemplates();
            handleCloseModal();
        } catch (err) {
            alert('Failed to save template: ' + (err.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return;
        try {
            await deleteClinicalTemplate(id);
            fetchTemplates();
        } catch (err) {
            alert('Failed to delete template');
        }
    };

    const filteredTemplates = templates.filter(t => 
        t.type === activeTab && 
        ((t.name || t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
         (t.content || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Clinical Templates</h1>
                    <p>Manage common clinical consultation templates, examination checklists, notes and care advice</p>
                </div>
                <div className="header-right-v4">
                    <button 
                        className="btn-header-v4 btn-primary-v4"
                        onClick={() => handleOpenModal()}
                    >
                        <Plus size={16} />
                        <span>New Template</span>
                    </button>
                </div>
            </div>

            {/* 3 Main Categories */}
            <div className="stats-grid-v4">
                <div className="stat-card-v4" onClick={() => setActiveTab('condition')} style={{ cursor: 'pointer', border: activeTab === 'condition' ? '2px solid #0f766e' : 'none', background: activeTab === 'condition' ? '#f0fdfa' : '#fff' }}>
                    <div className="stat-icon-v4" style={{ backgroundColor: '#0f766e15', color: '#0f766e' }}>
                        <Sparkles size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">1-Click Consultation Templates</span>
                        <div className="stat-value-v4">{templates.filter(t => t.type === 'condition').length}</div>
                    </div>
                </div>
                <div className="stat-card-v4" onClick={() => setActiveTab('note')} style={{ cursor: 'pointer', border: activeTab === 'note' ? '2px solid #6366f1' : 'none', background: activeTab === 'note' ? '#f5f3ff' : '#fff' }}>
                    <div className="stat-icon-v4" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                        <Clipboard size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">Clinical Notes</span>
                        <div className="stat-value-v4">{templates.filter(t => t.type === 'note').length}</div>
                    </div>
                </div>
                <div className="stat-card-v4" onClick={() => setActiveTab('advice')} style={{ cursor: 'pointer', border: activeTab === 'advice' ? '2px solid #0ea5e9' : 'none', background: activeTab === 'advice' ? '#f0f9ff' : '#fff' }}>
                    <div className="stat-icon-v4" style={{ backgroundColor: '#0ea5e915', color: '#0ea5e9' }}>
                        <HeartPulse size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">Care Advice</span>
                        <div className="stat-value-v4">{templates.filter(t => t.type === 'advice').length}</div>
                    </div>
                </div>
            </div>

            <div className="view-content-v3">
                <div className="filter-shelf-premium" style={{ marginBottom: '1.5rem' }}>
                    <div className="search-pill-v3" style={{ flex: 1 }}>
                        <Search size={18} color="#64748b" />
                        <input 
                            type="text" 
                            placeholder={`Search ${activeTab === 'condition' ? '1-click templates' : activeTab === 'note' ? 'clinical notes' : 'care advice'}...`} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', marginLeft: '8px' }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <RefreshCw className="spinning" size={32} color="#0d7f6e" />
                    </div>
                ) : (
                    <div className="template-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
                        {filteredTemplates.map(tmpl => {
                            const m = tmpl.metadata || {};
                            return (
                                <div key={tmpl._id || tmpl.id} className="repository-card-v3" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '1.3rem' }}>{m.icon || (tmpl.type === 'condition' ? '⚡' : tmpl.type === 'note' ? '📝' : '💡')}</span>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>{tmpl.name || tmpl.title}</h3>
                                                {m.badge && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#f0fdfa', color: '#0f766e', padding: '2px 7px', borderRadius: '6px', marginTop: '2px', display: 'inline-block' }}>
                                                        {m.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button 
                                                className="btn-icon" 
                                                onClick={() => handleOpenModal(tmpl)}
                                                style={{ color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}
                                                title="Edit Template"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button 
                                                className="btn-icon" 
                                                onClick={() => handleDelete(tmpl._id || tmpl.id)}
                                                style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '6px' }}
                                                title="Delete Template"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Structured Pills for Condition Template */}
                                    {tmpl.type === 'condition' && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.85rem' }}>
                                            {m.diagnoses?.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                                    🎯 {m.diagnoses[0].diagnosis_name || m.diagnoses[0].diagnosis}
                                                </span>
                                            )}
                                            {m.allergies?.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                                    🛡️ {m.allergies.length} Allergy Safety
                                                </span>
                                            )}
                                            {m.prescriptions?.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                                    💊 {m.prescriptions.length} Rx
                                                </span>
                                            )}
                                            {m.investigations?.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                                    🧪 {m.investigations.length} Labs
                                                </span>
                                            )}
                                            {m.procedures?.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', background: '#fdf2f8', color: '#db2777', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                                    🩺 {m.procedures.length} Procedures
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5', flex: 1, whiteSpace: 'pre-wrap', margin: '0 0 1rem 0' }}>
                                        {tmpl.content || m.hpi || m.advice_home_care || 'Standard clinical template'}
                                    </p>

                                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <a
                                            href="#/clinical-entry"
                                            style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <span>Use in E-prescription</span>
                                            <ExternalLink size={12} />
                                        </a>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                            {new Date(tmpl.updated_at || tmpl.createdAt || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredTemplates.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                                <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                                <h3 style={{ color: '#64748b' }}>No templates found</h3>
                                <p style={{ color: '#94a3b8' }}>Create your first {activeTab === 'condition' ? '1-click consultation template' : activeTab === 'note' ? 'clinical note' : 'care advice'} to get started.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Comprehensive Modal for Create/Edit ── */}
            {isModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)' }}>
                    <div className="modal-card-v3" style={{ maxWidth: formData.type === 'condition' ? '920px' : '620px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '20px', overflow: 'hidden', background: '#fff' }}>
                        
                        {/* Modal Header */}
                        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1e293b' }}>
                                    {editingTemplate ? `Edit "${editingTemplate.name || editingTemplate.title}"` : 'Create New Clinical Template'}
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    Configure reusable consultation components, examination findings, diagnostics & care advice
                                </p>
                            </div>
                            <button onClick={handleCloseModal} className="close-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                                
                                {/* Top Basic Info */}
                                <div style={{ display: 'grid', gridTemplateColumns: formData.type === 'condition' ? '1.5fr 1fr 1fr' : '1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>Template Name *</label>
                                        <input 
                                            className="input-premium-v4"
                                            required
                                            placeholder="e.g. Acute Bronchiolitis, Asthma Attack, URTI..."
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="f-group-premium" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>Template Type</label>
                                        <select 
                                            className="input-premium-v4" 
                                            value={formData.type} 
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="condition">⚡ 1-Click Consultation Template</option>
                                            <option value="note">📝 Clinical Note</option>
                                            <option value="advice">💡 Care Advice</option>
                                        </select>
                                    </div>
                                    {formData.type === 'condition' && (
                                        <div className="f-group-premium" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>Category Badge</label>
                                            <input 
                                                className="input-premium-v4"
                                                placeholder="e.g. Pediatric / ENT / Infant..."
                                                value={meta.badge || ''}
                                                onChange={e => setMeta({ ...meta, badge: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* IF CONDITION: Show Structured Tabs */}
                                {formData.type === 'condition' ? (
                                    <div>
                                        {/* Sub-Tabs Nav */}
                                        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '1.25rem' }}>
                                            {[
                                                { id: 'allergies', label: '🛡️ Allergies & Safety', count: meta.allergies?.length },
                                                { id: 'complaints', label: '📋 Complaints & HPI', count: meta.complaints?.length },
                                                { id: 'exam', label: '🔍 Targeted Exam' },
                                                { id: 'diagnoses', label: '🎯 Diagnoses', count: meta.diagnoses?.length },
                                                { id: 'investigations', label: '🧪 Investigations', count: meta.investigations?.length },
                                                { id: 'procedures', label: '🩺 Procedures', count: meta.procedures?.length },
                                                { id: 'prescriptions', label: '💊 Prescriptions (Rx)', count: meta.prescriptions?.length },
                                                { id: 'advice', label: '💡 Advice & Red Flags' }
                                            ].map(t => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setModalSubTab(t.id)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        border: modalSubTab === t.id ? '1px solid #0f766e' : '1px solid #e2e8f0',
                                                        background: modalSubTab === t.id ? '#0f766e' : '#f8fafc',
                                                        color: modalSubTab === t.id ? '#fff' : '#475569',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <span>{t.label}</span>
                                                    {typeof t.count === 'number' && t.count > 0 && (
                                                        <span style={{ fontSize: '0.65rem', background: modalSubTab === t.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0', padding: '1px 5px', borderRadius: '10px' }}>
                                                            {t.count}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* 1. Allergies & Drug Safety */}
                                        {modalSubTab === 'allergies' && (
                                            <div style={{ background: '#fcfdfe', border: '1.5px solid #f1f5f9', borderRadius: '18px', padding: '1.25rem 1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e05252', fontWeight: 700, fontSize: '0.98rem', marginBottom: '0.5rem' }}>
                                                    <AlertTriangle size={18} strokeWidth={2.2} /> Patient Allergies & Drug Safety
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!meta.nkda}
                                                            onChange={e => setMeta(prev => ({ ...prev, nkda: e.target.checked, allergies: e.target.checked ? [] : prev.allergies }))}
                                                            style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#059669', cursor: 'pointer' }}
                                                        />
                                                        <span>No Known Allergies (NKDA)</span>
                                                    </label>
                                                </div>

                                                {!meta.nkda && (
                                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.45rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                                        <select
                                                            className="input-premium-v4"
                                                            value={allergyDraft.category}
                                                            onChange={e => setAllergyDraft({ ...allergyDraft, category: e.target.value })}
                                                            style={{ width: '120px', height: '42px', border: '1.5px solid #0f766e', borderRadius: '10px', background: '#fff', fontWeight: 700, color: '#0f172a', margin: 0 }}
                                                        >
                                                            <option value="Drug">Drug</option>
                                                            <option value="Food">Food</option>
                                                            <option value="Environmental">Environmental</option>
                                                        </select>
                                                        <input
                                                            className="input-premium-v4"
                                                            placeholder="Allergen name (e.g. Penicillin, Peanuts..."
                                                            value={allergyDraft.type}
                                                            onChange={e => setAllergyDraft({ ...allergyDraft, type: e.target.value })}
                                                            style={{ flex: 1.2, minWidth: '170px', height: '42px', border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '10px', margin: 0 }}
                                                        />
                                                        <input
                                                            className="input-premium-v4"
                                                            placeholder="Reaction (e.g. Urticaria, Wheezing..."
                                                            value={allergyDraft.reaction}
                                                            onChange={e => setAllergyDraft({ ...allergyDraft, reaction: e.target.value })}
                                                            style={{ flex: 1.1, minWidth: '150px', height: '42px', border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '10px', margin: 0 }}
                                                        />
                                                        <select
                                                            className="input-premium-v4"
                                                            value={allergyDraft.intensity}
                                                            onChange={e => setAllergyDraft({ ...allergyDraft, intensity: e.target.value })}
                                                            style={{ width: '120px', height: '42px', border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '10px', color: '#475569', fontWeight: 600, margin: 0 }}
                                                        >
                                                            <option value="">Severity</option>
                                                            <option value="Mild">Mild</option>
                                                            <option value="Moderate">Moderate</option>
                                                            <option value="Severe">Severe</option>
                                                            <option value="Life-threatening">Life-threatening</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            style={{ height: '42px', padding: '0 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(5,150,105,0.25)', transition: 'all 0.15s ease' }}
                                                            onClick={handleAddAllergy}
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>
                                                )}

                                                {meta.nkda ? (
                                                    <div style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>
                                                        <span>✓ No Known Drug Allergies (NKDA) Flagged</span>
                                                    </div>
                                                ) : (meta.allergies?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                                        {meta.allergies.map((al, idx) => (
                                                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                ⚠️ {al.type} ({al.category}) {al.intensity && `• ${al.intensity}`} {al.reaction && `(${al.reaction})`}
                                                                <X size={14} style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={() => handleRemoveAllergy(idx)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 2. Complaints & HPI */}
                                        {modalSubTab === 'complaints' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>1-Click Common Complaints</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                                                        {QUICK_COMPLAINTS.map(chip => {
                                                            const selected = (meta.complaints || []).includes(chip);
                                                            return (
                                                                <button
                                                                    key={chip}
                                                                    type="button"
                                                                    className={`quick-action-chip ${selected ? 'active' : ''}`}
                                                                    onClick={() => handleToggleComplaint(chip)}
                                                                >
                                                                    {chip} {selected ? '✓' : '+'}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <input
                                                            className="input-premium-v4"
                                                            placeholder="Add other complaint..."
                                                            value={customComplaint}
                                                            onChange={e => setCustomComplaint(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomComplaint(); } }}
                                                        />
                                                        <button type="button" className="btn-header-v4" onClick={handleAddCustomComplaint}>Add</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>History of Present Illness (HPI) Template</label>
                                                    <textarea
                                                        className="textarea-premium-v4"
                                                        rows={4}
                                                        placeholder="Standard clinical narrative (e.g. 3-day history of fever, rhinorrhea followed by cough...)"
                                                        value={meta.hpi || ''}
                                                        onChange={e => setMeta({ ...meta, hpi: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. Targeted Physical Examination */}
                                        {modalSubTab === 'exam' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>General Survey Defaults</label>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                                        {['pe_pallor', 'pe_cyanosis', 'pe_icterus', 'pe_oedema'].map(k => {
                                                            const label = k.replace('pe_', '').toUpperCase();
                                                            const val = meta.exam?.[k] || 'Absent';
                                                            return (
                                                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px' }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{label}</span>
                                                                    <button
                                                                        type="button"
                                                                        style={{
                                                                            fontSize: '0.7rem',
                                                                            padding: '2px 8px',
                                                                            borderRadius: '6px',
                                                                            border: 'none',
                                                                            cursor: 'pointer',
                                                                            fontWeight: 800,
                                                                            background: val === 'Absent' ? '#ecfdf5' : '#fef2f2',
                                                                            color: val === 'Absent' ? '#059669' : '#dc2626'
                                                                        }}
                                                                        onClick={() => setMeta({
                                                                            ...meta,
                                                                            exam: { ...(meta.exam || {}), [k]: val === 'Absent' ? 'Present' : 'Absent' }
                                                                        })}
                                                                    >
                                                                        {val}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>Targeted Physical Examination</label>
                                                    <textarea
                                                        className="textarea-premium-v4"
                                                        rows={3}
                                                        placeholder="e.g. Active child, mild intercostal retractions. Chest: Bilateral expiratory wheezes, coarse crackles..."
                                                        value={meta.exam?.physical_examination || ''}
                                                        onChange={e => setMeta({ ...meta, exam: { ...(meta.exam || {}), physical_examination: e.target.value } })}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>Systemic Examination</label>
                                                    <textarea
                                                        className="textarea-premium-v4"
                                                        rows={2}
                                                        placeholder="e.g. CVS: S1 S2 heard, no murmurs. P/A: Soft, non-tender. CNS: Alert, oriented."
                                                        value={meta.exam?.systemic_examination || ''}
                                                        onChange={e => setMeta({ ...meta, exam: { ...(meta.exam || {}), systemic_examination: e.target.value } })}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. Provisional & Confirmed Diagnoses */}
                                        {modalSubTab === 'diagnoses' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Diagnosis name (e.g. Acute Bronchiolitis)"
                                                        value={diagnosisDraft.diagnosis_name}
                                                        onChange={e => setDiagnosisDraft({ ...diagnosisDraft, diagnosis_name: e.target.value })}
                                                        style={{ flex: 1.5, minWidth: '180px' }}
                                                    />
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="ICD-10 Code (e.g. J21.9)"
                                                        value={diagnosisDraft.icd_10}
                                                        onChange={e => setDiagnosisDraft({ ...diagnosisDraft, icd_10: e.target.value })}
                                                        style={{ width: '130px' }}
                                                    />
                                                    <select
                                                        className="input-premium-v4"
                                                        value={diagnosisDraft.stage}
                                                        onChange={e => setDiagnosisDraft({ ...diagnosisDraft, stage: e.target.value })}
                                                        style={{ width: '130px' }}
                                                    >
                                                        <option value="Provisional">Provisional</option>
                                                        <option value="Confirmed">Confirmed</option>
                                                    </select>
                                                    <select
                                                        className="input-premium-v4"
                                                        value={diagnosisDraft.severity}
                                                        onChange={e => setDiagnosisDraft({ ...diagnosisDraft, severity: e.target.value })}
                                                        style={{ width: '120px' }}
                                                    >
                                                        <option value="Mild">Mild</option>
                                                        <option value="Moderate">Moderate</option>
                                                        <option value="Severe">Severe</option>
                                                    </select>
                                                    <button type="button" className="btn-header-v4 btn-primary-v4" style={{ height: '38px', padding: '0 16px', background: '#059669', borderColor: '#059669' }} onClick={handleAddDiagnosis}>
                                                        + Add
                                                    </button>
                                                </div>
                                                {meta.diagnoses?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {meta.diagnoses.map((d, idx) => (
                                                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                🎯 {d.diagnosis_name || d.diagnosis} {d.icd_10 && `[${d.icd_10}]`} • {d.stage} ({d.severity})
                                                                <X size={14} style={{ cursor: 'pointer' }} onClick={() => handleRemoveDiagnosis(idx)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 5. Investigations & Lab Orders */}
                                        {modalSubTab === 'investigations' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>1-Click Common Investigations</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                                                        {QUICK_TESTS.map(t => (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                className="quick-action-chip"
                                                                onClick={() => handleAddInvestigation(t)}
                                                            >
                                                                + {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Custom Test Name..."
                                                        value={investigationDraft.name}
                                                        onChange={e => setInvestigationDraft({ ...investigationDraft, name: e.target.value })}
                                                        style={{ flex: 1 }}
                                                    />
                                                    <select
                                                        className="input-premium-v4"
                                                        value={investigationDraft.priority}
                                                        onChange={e => setInvestigationDraft({ ...investigationDraft, priority: e.target.value, timeframe: e.target.value })}
                                                        style={{ width: '130px' }}
                                                    >
                                                        <option value="Routine">Routine</option>
                                                        <option value="Stat">Stat (Urgent)</option>
                                                        <option value="Immediate">Immediate</option>
                                                    </select>
                                                    <button type="button" className="btn-header-v4 btn-primary-v4" style={{ height: '38px', padding: '0 16px', background: '#059669', borderColor: '#059669' }} onClick={() => handleAddInvestigation()}>
                                                        + Add
                                                    </button>
                                                </div>
                                                {meta.investigations?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {meta.investigations.map((inv, idx) => (
                                                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                🧪 {inv.name || inv.test_name} ({inv.priority || 'Routine'})
                                                                <X size={14} style={{ cursor: 'pointer' }} onClick={() => handleRemoveInvestigation(idx)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 6. Clinical Procedures Advised */}
                                        {modalSubTab === 'procedures' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>1-Click Common Procedures</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                                                        {QUICK_PROCEDURES.map(p => (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                className="quick-action-chip"
                                                                onClick={() => handleAddProcedure(p)}
                                                            >
                                                                + {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Custom Procedure name..."
                                                        value={procedureDraft.name}
                                                        onChange={e => setProcedureDraft({ ...procedureDraft, name: e.target.value })}
                                                        style={{ flex: 1 }}
                                                    />
                                                    <button type="button" className="btn-header-v4 btn-primary-v4" style={{ height: '38px', padding: '0 16px', background: '#059669', borderColor: '#059669' }} onClick={() => handleAddProcedure()}>
                                                        + Add
                                                    </button>
                                                </div>
                                                {meta.procedures?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {meta.procedures.map((proc, idx) => (
                                                            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fdf2f8', border: '1px solid #fbcfe8', color: '#be185d', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                🩺 {proc.name}
                                                                <X size={14} style={{ cursor: 'pointer' }} onClick={() => handleRemoveProcedure(idx)} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 7. Prescriptions (Rx) */}
                                        {modalSubTab === 'prescriptions' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Medicine (e.g. Paracetamol 250mg/5ml)"
                                                        value={prescriptionDraft.medicine}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, medicine: e.target.value })}
                                                    />
                                                    <select
                                                        className="input-premium-v4"
                                                        value={prescriptionDraft.dosage_form}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, dosage_form: e.target.value })}
                                                    >
                                                        <option value="Syrup">Syrup</option>
                                                        <option value="Drops">Drops</option>
                                                        <option value="Tablet">Tablet</option>
                                                        <option value="Inhalation">Inhalation</option>
                                                        <option value="Respule">Respule</option>
                                                        <option value="Sachet">Sachet</option>
                                                    </select>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Schedule (e.g. TDS)"
                                                        value={prescriptionDraft.schedule}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, schedule: e.target.value })}
                                                    />
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Days"
                                                        type="number"
                                                        value={prescriptionDraft.days}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, days: e.target.value })}
                                                    />
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="Instruction (e.g. After food)"
                                                        value={prescriptionDraft.instruction}
                                                        onChange={e => setPrescriptionDraft({ ...prescriptionDraft, instruction: e.target.value })}
                                                    />
                                                    <button type="button" className="btn-header-v4 btn-primary-v4" style={{ height: '38px', padding: '0 14px', background: '#059669', borderColor: '#059669' }} onClick={handleAddPrescription}>
                                                        + Add
                                                    </button>
                                                </div>
                                                {meta.prescriptions?.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {meta.prescriptions.map((p, idx) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '8px 12px', fontSize: '0.82rem' }}>
                                                                <div>
                                                                    <strong style={{ color: '#166534' }}>{p.medicine}</strong>
                                                                    <span style={{ color: '#15803d', marginLeft: '6px' }}>[{p.dosage_form}] • {p.schedule} • {p.days || '0'} days</span>
                                                                    {p.instruction && <span style={{ color: '#64748b', marginLeft: '6px', fontStyle: 'italic' }}>({p.instruction})</span>}
                                                                </div>
                                                                <X size={15} style={{ cursor: 'pointer', color: '#dc2626' }} onClick={() => handleRemovePrescription(idx)} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 8. Patient Advice & Red Flags */}
                                        {modalSubTab === 'advice' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>Home Care & Diet Plan Advice</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                                                        {QUICK_ADVICES.map(a => (
                                                            <button key={a} type="button" className="quick-action-chip" style={{ fontSize: '0.72rem' }} onClick={() => handleAppendAdvice(a)}>
                                                                + {a}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        className="textarea-premium-v4"
                                                        rows={3}
                                                        placeholder="Hydration, feeding, rest, tepid sponging instructions..."
                                                        value={meta.advice_home_care || ''}
                                                        onChange={e => setMeta({ ...meta, advice_home_care: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', display: 'block', marginBottom: '0.4rem' }}>Urgent Warning Signs & Red Flags</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                                                        {QUICK_WARNING_SIGNS.map(w => (
                                                            <button key={w} type="button" className="quick-action-chip" style={{ fontSize: '0.72rem', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => handleAppendWarningSign(w)}>
                                                                + {w}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        className="textarea-premium-v4"
                                                        rows={2}
                                                        placeholder="Emergency return criteria (fast breathing, chest in-drawing, seizures...)"
                                                        value={meta.advice_warning_signs || ''}
                                                        onChange={e => setMeta({ ...meta, advice_warning_signs: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>Next Follow-up Due Duration</label>
                                                    <input
                                                        className="input-premium-v4"
                                                        placeholder="e.g. 2 days, 3 days, 1 week, 1 month..."
                                                        value={meta.next_visit_due || '3 days'}
                                                        onChange={e => setMeta({ ...meta, next_visit_due: e.target.value })}
                                                        style={{ maxWidth: '240px' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* IF NOTE OR ADVICE: Standard Textarea */
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>
                                            {formData.type === 'note' ? 'Clinical Note Text' : 'Care Advice Text'}
                                        </label>
                                        <textarea 
                                            className="textarea-premium-v4"
                                            required
                                            rows={8}
                                            placeholder={`Enter ${formData.type === 'note' ? 'clinical note' : 'care advice'} content...`}
                                            value={formData.content}
                                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                                            style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn-wizard-discard" onClick={handleCloseModal}>Cancel</button>
                                <button type="submit" className="btn-wizard-finalize" disabled={submitting}>
                                    {submitting ? <RefreshCw className="spinning" size={16} /> : <Save size={16} />}
                                    <span>{editingTemplate ? 'Update Clinical Template' : 'Save Clinical Template'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalTemplates;
