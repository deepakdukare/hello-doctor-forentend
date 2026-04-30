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
    HeartPulse
} from 'lucide-react';
import '../glass-landing.css';
import { getTemplates, upsertClinicalTemplate, deleteClinicalTemplate } from '../api';

const ClinicalTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('note'); // 'note' | 'advice'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [formData, setFormData] = useState({ name: '', type: 'note', content: '' });
    const [submitting, setSubmitting] = useState(false);

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
            setFormData({ name: template.name, type: template.type, content: template.content });
        } else {
            setEditingTemplate(null);
            setFormData({ name: '', type: activeTab, content: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
        setFormData({ name: '', type: activeTab, content: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await upsertClinicalTemplate(formData);
            fetchTemplates();
            handleCloseModal();
        } catch (err) {
            alert('Failed to save template');
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
        (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
         t.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Clinical Templates</h1>
                    <p>Manage common clinical notes and care advice</p>
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

            <div className="stats-grid-v4">
                <div className="stat-card-v4" onClick={() => setActiveTab('note')} style={{ cursor: 'pointer', border: activeTab === 'note' ? '2px solid #0d7f6e' : 'none' }}>
                    <div className="stat-icon-v4" style={{ backgroundColor: '#0d7f6e15', color: '#0d7f6e' }}>
                        <Clipboard size={24} />
                    </div>
                    <div className="stat-info-v4">
                        <span className="stat-label-v4">Clinical Notes</span>
                        <div className="stat-value-v4">{templates.filter(t => t.type === 'note').length}</div>
                    </div>
                </div>
                <div className="stat-card-v4" onClick={() => setActiveTab('advice')} style={{ cursor: 'pointer', border: activeTab === 'advice' ? '2px solid #0ea5e9' : 'none' }}>
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
                            placeholder="Search templates by name or content..." 
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
                    <div className="template-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {filteredTemplates.map(tmpl => (
                            <div key={tmpl._id} className="repository-card-v3" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{tmpl.name}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            className="btn-icon" 
                                            onClick={() => handleOpenModal(tmpl)}
                                            style={{ color: '#64748b' }}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            className="btn-icon" 
                                            onClick={() => handleDelete(tmpl._id)}
                                            style={{ color: '#ef4444' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', flex: 1, whiteSpace: 'pre-wrap' }}>
                                    {tmpl.content}
                                </p>
                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                                        {tmpl.type === 'note' ? 'Clinical Note' : 'Care Advice'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                        {new Date(tmpl.updated_at || tmpl.createdAt || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {filteredTemplates.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                                <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                                <h3 style={{ color: '#64748b' }}>No templates found</h3>
                                <p style={{ color: '#94a3b8' }}>Create your first {activeTab === 'note' ? 'clinical note' : 'care advice'} template to get started.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay-premium">
                    <div className="modal-card-v4" style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="modal-header-v4">
                            <h2>{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
                            <button onClick={handleCloseModal} className="btn-close-v4"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>Template Name</label>
                                <input 
                                    className="input-v3"
                                    required
                                    placeholder="e.g. Fever Follow-up"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>Template Type</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="type" 
                                            value="note" 
                                            checked={formData.type === 'note'} 
                                            onChange={() => setFormData({ ...formData, type: 'note' })}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Clinical Note</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="type" 
                                            value="advice" 
                                            checked={formData.type === 'advice'} 
                                            onChange={() => setFormData({ ...formData, type: 'advice' })}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Care Advice</span>
                                    </label>
                                </div>
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>Template Content</label>
                                <textarea 
                                    className="textarea-premium-v4"
                                    required
                                    rows={8}
                                    placeholder="Enter the template text here..."
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" className="btn-cancel" onClick={handleCloseModal} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="btn-save" style={{ flex: 1 }} disabled={submitting}>
                                    {submitting ? <RefreshCw className="spinning" size={18} /> : <Save size={18} />}
                                    <span>{editingTemplate ? 'Update Template' : 'Save Template'}</span>
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
