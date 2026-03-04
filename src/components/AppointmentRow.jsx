import React from 'react';
import { Edit3, FileText, Phone, Trash2, Zap } from 'lucide-react';

const STATUS_CONFIG = {
    CONFIRMED: { color: '#10b981', bg: '#dcfce7' },
    COMPLETED: { color: '#6366f1', bg: '#e0e7ff' },
    CANCELLED: { color: '#ef4444', bg: '#fef2f2' },
    PENDING: { color: '#f59e0b', bg: '#fef3c7' },
    NO_SHOW: { color: '#b45309', bg: '#ffedd5' },
    DEFAULT: { color: '#475569', bg: '#e2e8f0' }
};

const getSlotDisplayLabel = (appt) => {
    if (appt?.slot_label) return appt.slot_label;
    if (appt?.appointment_time) return appt.appointment_time;
    if (appt?.start_time && appt?.end_time) return `${appt.start_time} - ${appt.end_time}`;
    return appt?.slot_id || 'Allocated Slot';
};

const getSessionDisplay = (appt) => appt?.session || 'Session TBD';

const AppointmentRow = ({ appt, onEdit, onCancel, statusIcons }) => {
    const status = appt.status || 'PENDING';
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.DEFAULT;
    const Icon = statusIcons[status] || statusIcons.DEFAULT;

    return (
        <tr className="row-hover-v3">
            <td>
                <div className="slot-id-box">
                    <div className="slot-badge-v3">
                        <div className="slot-pill-tag">{appt.slot_id}</div>
                    </div>
                    <div className="time-stack-v3">
                        <div className="slot-label-v3">{getSlotDisplayLabel(appt)}</div>
                        <div className="slot-sub-v3">{getSessionDisplay(appt)}</div>
                    </div>
                </div>
            </td>
            <td>
                <div className="patient-link-v3">
                    <div className="p-name-v3">{appt.child_name || 'Legacy Patient'}</div>
                    <div className="p-meta-v3">
                        <span className="p-id-v3">{appt.patient_id}</span>
                        <span className="dot">•</span>
                        <Zap size={10} color="#10b981" />
                        <span>{appt.parent_mobile || '-'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div className="doc-assign-v3">
                    <div className="d-name-v3">{appt.assigned_doctor_name || appt.doctor_name || 'Dr. Indu'}</div>
                    <div className="v-tag-v3">{appt.visit_type}</div>
                </div>
            </td>
            <td>
                <div className="status-chip-v3" style={{ background: config.bg, color: config.color }}>
                    {Icon}
                    <span>{status}</span>
                </div>
            </td>
            <td>
                <div className="source-link-v3">
                    {appt.booking_source === 'whatsapp' ? <Phone size={14} className="wa-icon" /> : <FileText size={14} />}
                    <span>{appt.booking_source?.toUpperCase() || 'DASHBOARD'}</span>
                </div>
            </td>
            <td>
                <div className="action-hub-v3">
                    <button className="hub-btn edit" title="Reschedule" onClick={() => onEdit(appt)} disabled={status === 'CANCELLED'}>
                        <Edit3 size={18} />
                    </button>
                    <button className="hub-btn cancel" title="Purge/Cancel" onClick={() => onCancel(appt.appointment_id)} disabled={status === 'CANCELLED'}>
                        <Trash2 size={18} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default AppointmentRow;
