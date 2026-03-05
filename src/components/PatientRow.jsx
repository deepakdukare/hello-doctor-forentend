import React from 'react';
import { Camera, Clipboard, Edit2, MapPin, X, Zap } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';
import PatientExpansion from './PatientExpansion';

const PatientRow = ({
    patient: p,
    selected,
    onSelect,
    onEdit,
    onPhotoUpload,
    calculateAge
}) => {
    const isSelected = selected?._id === p._id;

    return (
        <React.Fragment>
            <tr className={`patient-row-v2 ${isSelected ? 'is-active' : ''}`}>
                <td>
                    <div className="patient-meta-box">
                        <div className={`avatar-premium ${p.gender === 'Female' ? 'pink' : 'blue'}`}>
                            {p.first_name?.charAt(0) || 'P'}
                        </div>
                        <div className="patient-name-stack">
                            <div className="name-bold-v2">{removeSalutation(p.full_name)}</div>
                            <div className="id-tag-premium">
                                <span className="id-label">{p.patient_id}</span>
                                <span className="dot">•</span>
                                <span className="age-label">{p.gender}, {calculateAge(p.dob)}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div className="parent-inline">
                        <div className="parent-main">{p.father_name || p.parent_name || 'Anonymous'}</div>
                        <div className="parent-sub">{p.mother_name ? `Mother: ${p.mother_name}` : 'Parent profile'}</div>
                    </div>
                </td>
                <td>
                    <div className="contact-inline">
                        <div className="wa-box-mini">
                            <Zap size={14} className="wa-icon-glow" />
                            {p.wa_id || p.father_mobile || p.parent_mobile}
                        </div>
                        <div className="loc-box-mini">
                            <MapPin size={12} />
                            {p.city || 'Remote'}
                        </div>
                    </div>
                </td>
                <td>
                    <div className="status-badge-stack">
                        <span className={`status-chip-v3 ${p.registration_status === 'COMPLETE' ? 'complete' : 'pending'}`}>
                            {p.registration_status}
                        </span>
                        <span className="source-meta">Via {p.enrollment_source || p.registration_source || 'Dashboard'}</span>
                        {p.balance > 0 && <span className="source-meta" style={{ color: '#ef4444' }}>Bal: ₹{p.balance}</span>}
                    </div>
                </td>
                <td>
                    <div className="action-hub-premium">
                        <label className="hub-btn-info" style={{ cursor: 'pointer' }}>
                            <Camera size={18} />
                            <input type="file" hidden accept="image/*" onChange={(e) => onPhotoUpload(p.patient_id, e)} />
                        </label>
                        <button className={`hub-btn-info ${isSelected ? 'active' : ''}`} onClick={() => onSelect(isSelected ? null : p)}>
                            {isSelected ? <X size={18} /> : <Clipboard size={18} />}
                        </button>
                        <button className="hub-btn-edit" onClick={() => onEdit(p)}>
                            <Edit2 size={18} />
                        </button>
                    </div>
                </td>
            </tr>
            {isSelected && (
                <PatientExpansion patient={p} onPhotoUpload={onPhotoUpload} />
            )}
        </React.Fragment>
    );
};

export default PatientRow;
