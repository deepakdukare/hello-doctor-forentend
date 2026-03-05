import React from 'react';
import { CheckCircle2, Clock3, Edit2, Phone, Trash2, XCircle } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';

const STATUS_CONFIG = {
    CONFIRMED: { label: 'CONFIRMED', color: '#10b981', bg: '#d1fae5', icon: CheckCircle2 },
    COMPLETED: { label: 'CHECKED OUT', color: '#0891b2', bg: '#cffafe', icon: CheckCircle2 },
    CANCELLED: { label: 'CANCELLED', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
    CANCELED: { label: 'CANCELLED', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
    PENDING: { label: 'SCHEDULE', color: '#2563eb', bg: '#dbeafe', icon: Clock3 },
    NO_SHOW: { label: 'NO SHOW', color: '#f59e0b', bg: '#fef3c7', icon: Clock3 },
    DEFAULT: { label: 'PENDING', color: '#64748b', bg: '#e2e8f0', icon: Clock3 }
};

const formatTime12h = (rawTime) => {
    if (!rawTime) return '';
    const [hourRaw, minuteRaw] = String(rawTime).split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return String(rawTime);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const formatDateShort = (rawDate) => {
    if (!rawDate) return '--';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return String(rawDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const getDateTime = (appt) => {
    if (appt?.start_time && appt?.end_time) {
        return `${formatTime12h(appt.start_time)} - ${formatTime12h(appt.end_time)}`;
    }
    if (appt?.appointment_time) return String(appt.appointment_time);
    if (appt?.slot_label) return String(appt.slot_label).toUpperCase();
    return 'TIME TBD';
};

const getVisitType = (appt) => {
    if (!appt?.visit_type) return 'CONSULTATION';
    return String(appt.visit_type).replace(/_/g, ' ').toUpperCase();
};

const AppointmentRow = ({ appt, onEdit, onCancel }) => {
    const statusKey = String(appt?.status || 'PENDING').toUpperCase();
    const statusView = STATUS_CONFIG[statusKey] || STATUS_CONFIG.DEFAULT;
    const StatusIcon = statusView.icon;
    const isCancelled = statusKey === 'CANCELLED' || statusKey === 'CANCELED';

    return (
        <tr className="row-hover-v3">
            <td>
                <div className="patient-link-v3">
                    <div className="p-name-v3">{removeSalutation(appt?.child_name) || 'Walk-in Patient'}</div>
                    <div className="p-meta-v3">
                        <span>{appt?.patient_id || '--'}</span>
                        <span className="dot-v3">&bull;</span>
                        <Phone size={10} className="phone-dot-v3" />
                        <span>{appt?.parent_mobile || '--'}</span>
                    </div>
                </div>
            </td>

            <td>
                <div className="time-stack-v3">
                    <div className="slot-label-v3">{formatDateShort(appt?.appointment_date || appt?.date)}</div>
                    <div className="slot-sub-v3">{getDateTime(appt)}</div>
                </div>
            </td>

            <td>
                <div className="doc-assign-v3">
                    <div className="d-name-v3">{appt?.assigned_doctor_name || appt?.doctor_name || 'Dr.Indu'}</div>
                    <div className="v-tag-v3">{getVisitType(appt)}</div>
                </div>
            </td>

            <td>
                <span className="reason-text-v3">{appt?.reason || 'General Checkup'}</span>
            </td>

            <td>
                <span className="status-chip-v3" style={{ color: statusView.color, background: statusView.bg }}>
                    <StatusIcon size={14} />
                    <span>{statusView.label}</span>
                </span>
            </td>

            <td>
                <div className="action-hub-v3">
                    <button className="hub-btn edit" title="Reschedule" onClick={() => onEdit(appt)} disabled={isCancelled}>
                        <Edit2 size={18} />
                    </button>
                    <button className="hub-btn cancel" title="Cancel" onClick={() => onCancel(appt?.appointment_id)} disabled={isCancelled}>
                        <Trash2 size={18} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default AppointmentRow;
