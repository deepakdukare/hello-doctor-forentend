import React, { useState, useEffect, useCallback } from 'react';
import { 
    Plus, 
    Search, 
    Trash2, 
    Edit2, 
    Check, 
    X, 
    Loader2, 
    Stethoscope, 
    Activity, 
    Beaker, 
    AlertCircle,
    Save,
    RefreshCw,
    ClipboardList
} from 'lucide-react';
import { getMasterData, upsertMasterData, deleteMasterData } from '../api';

const CATEGORIES = [
    { id: 'medicine', name: 'Medicines', icon: Stethoscope, color: '#6366f1' },
    { id: 'investigation', name: 'Investigations', icon: Beaker, color: '#10b981' },
    { id: 'procedure', name: 'Procedures', icon: Activity, color: '#f59e0b' },
    { id: 'diagnosis', name: 'Diagnosis (ICD-10)', icon: ClipboardList, color: '#8b5cf6' },
    { id: 'complaint', name: 'Chief Complaints', icon: AlertCircle, color: '#ef4444' },
    { id: 'allergy', name: 'Allergies', icon: AlertCircle, color: '#ec4899' }
];

const ClinicalMasterManagement = () => {
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', code: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMasterData({ category: selectedCategory });
            setData(res.data?.data || []);
        } catch (err) {
            console.error('Failed to load master data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!newItem.name) return;
        setSaving(true);
        try {
            const metadata = {};
            if (newItem.code) metadata.code = newItem.code;
            if (newItem.notes) metadata.notes = newItem.notes;

            await upsertMasterData({
                category: selectedCategory,
                name: newItem.name,
                metadata
            });
            setStatus({ type: 'success', message: 'Item saved successfully' });
            setNewItem({ name: '', code: '', notes: '' });
            setIsAdding(false);
            loadData();
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await deleteMasterData(id);
            setData(data.filter(item => item._id !== id));
        } catch (err) {
            alert('Failed to delete item');
        }
    };

    const filteredData = data.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.metadata?.code && item.metadata.code.toLowerCase().includes(search.toLowerCase()))
    );

    const activeCat = CATEGORIES.find(c => c.id === selectedCategory);

    return (
        <div className="master-data-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="header-v4" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>Clinical Master Data</h1>
                    <p style={{ color: '#64748b' }}>Manage global lists for prescriptions, investigations, and more</p>
                </div>
                <button 
                    className="btn-header-v4 btn-primary-v4" 
                    onClick={() => setIsAdding(true)}
                    style={{ background: activeCat.color }}
                >
                    <Plus size={18} />
                    <span>Add {activeCat.name.slice(0, -1)}</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
                {/* Categories Sidebar */}
                <aside className="mrd-panel-v3" style={{ background: '#fff', borderRadius: '12px', padding: '16px', height: 'fit-content', border: '1.5px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', paddingLeft: '8px' }}>Categories</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: selectedCategory === cat.id ? `${cat.color}10` : 'transparent',
                                    color: selectedCategory === cat.id ? cat.color : '#475569',
                                    fontWeight: selectedCategory === cat.id ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                            >
                                <cat.icon size={18} />
                                <span>{cat.name}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main>
                    <div className="mrd-panel-v3" style={{ background: '#fff', borderRadius: '12px', border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeCat.name.toLowerCase()}...`}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' }}
                                />
                            </div>
                            <button onClick={loadData} style={{ padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                                <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                            </button>
                        </div>

                        <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                            {loading && (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                    <Loader2 size={32} className="spinning" style={{ margin: '0 auto 12px' }} />
                                    <p>Loading {activeCat.name}...</p>
                                </div>
                            )}

                            {!loading && filteredData.length === 0 && (
                                <div style={{ padding: '60px 40px', textAlign: 'center', color: '#94a3b8' }}>
                                    <activeCat.icon size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                                    <p>No {activeCat.name.toLowerCase()} found</p>
                                    <button onClick={() => setIsAdding(true)} style={{ marginTop: '16px', color: activeCat.color, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>+ Add New</button>
                                </div>
                            )}

                            {!loading && filteredData.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Name</th>
                                            {selectedCategory === 'diagnosis' && <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ICD-10 Code</th>}
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Notes</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map(item => (
                                            <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1e293b' }}>{item.name}</td>
                                                {selectedCategory === 'diagnosis' && <td style={{ padding: '16px 20px', color: '#64748b' }}><span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>{item.metadata?.code || '-'}</span></td>}
                                                <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '13px' }}>{item.metadata?.notes || '-'}</td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                    <button 
                                                        onClick={() => handleDelete(item._id)}
                                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Add Modal */}
            {isAdding && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Add New {activeCat.name.slice(0, -1)}</h2>
                            <button onClick={() => setIsAdding(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Item Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder={`e.g. ${selectedCategory === 'medicine' ? 'Amoxicillin 250mg' : activeCat.name.slice(0, -1)}`}
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' }}
                                />
                            </div>

                            {selectedCategory === 'diagnosis' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ICD-10 Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. J00"
                                        value={newItem.code}
                                        onChange={e => setNewItem({ ...newItem, code: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Notes (Optional)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Any additional details..."
                                    value={newItem.notes}
                                    onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{ flex: 2, padding: '12px', borderRadius: '8px', background: activeCat.color, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {saving ? <Loader2 size={18} className="spinning" /> : <Save size={18} />}
                                    Save Item
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Status Toast */}
            {status.message && (
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 24px', borderRadius: '8px', background: status.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', fontWeight: 600, boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 10000 }}>
                    {status.message}
                </div>
            )}

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ClinicalMasterManagement;
