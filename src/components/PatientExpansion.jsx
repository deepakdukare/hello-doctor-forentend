import { Activity, Camera, Info, MapPin, User, Users } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';

const PatientExpansion = ({ patient: p, onPhotoUpload }) => {
    return (
        <tr className="expansion-row">
            <td colSpan={5}>
                <div className="expansion-content-premium">
                    <div className="expansion-grid">
                        <div className="expansion-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                            <div className="avatar-preview-box">
                                <div className="large-avatar-premium" style={{ width: '100px', height: '100px', borderRadius: '24px', background: '#f8fafc', overflow: 'hidden', border: '2px solid #f4fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {p.patient_photo ? (
                                        <img src={p.patient_photo} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <User size={48} color="#cbd5e1" />
                                    )}
                                </div>
                                <label className="btn-upload-avatar" style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', borderRadius: '10px', background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                    <Camera size={14} />
                                    <span>Upload</span>
                                    <input type="file" hidden accept="image/*" onChange={(e) => onPhotoUpload(p.patient_id, e)} />
                                </label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="exp-card-header"><Activity size={18} /> <span>Medical Profile</span></div>
                                <div className="exp-info-list" style={{ display: 'grid', gap: '0.4rem' }}>
                                    <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Full Name</span><strong>{removeSalutation(p.full_name)}</strong></div>
                                    <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status</span><strong>{p.is_active ? 'Active' : 'Inactive'}</strong></div>
                                    <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Birth Date</span><strong>{p.dob ? new Date(p.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}</strong></div>
                                    <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Patient ID</span><strong>{p.patient_id}</strong></div>
                                </div>
                            </div>
                        </div>
                        <div className="expansion-card">
                            <div className="exp-card-header"><Users size={18} /> <span>Family Details</span></div>
                            <div className="exp-info-list" style={{ display: 'grid', gap: '0.4rem' }}>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Father</span><strong>{p.father_name || '—'}</strong></div>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mother</span><strong>{p.mother_name || '—'}</strong></div>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>WhatsApp</span><strong>{p.wa_id || '—'}</strong></div>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Email</span><strong>{p.email || '—'}</strong></div>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Preferences</span><strong>{p.communication_preference || 'WhatsApp'}</strong></div>
                            </div>
                        </div>
                        <div className="expansion-card">
                            <div className="exp-card-header"><MapPin size={18} /> <span>Clinic Assignments</span></div>
                            <div className="exp-info-list" style={{ gap: '0.5rem', display: 'grid' }}>
                                <div className="exp-info-item" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Preferred Doctor</span><strong>{p.doctor || 'Clinic'}</strong></div>
                            </div>
                        </div>
                    </div>
                    {p.remarks && (
                        <div key="remarks" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <FileText size={18} color="#0d7f6e" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Clinical Note / Remarks</div>
                                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#475569', fontWeight: 600, lineHeight: 1.5 }}>{p.remarks}</p>
                            </div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
};

export default PatientExpansion;
