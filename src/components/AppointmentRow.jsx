import React from 'react';
import { CheckCircle2, Clock3, Edit2, Phone, Trash2, XCircle } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';
import { hasPermission } from '../utils/auth';

const STATUS_CONFIG = {
    CONFIRMED: { label: 'Confirmed', color: '#10ac84' },
    COMPLETED: { label: 'Checked Out', color: '#0ebadb' },
    CANCELLED: { label: 'Cancelled', color: '#ee5253' },
    CANCELED: { label: 'Cancelled', color: '#ee5253' },
    PENDING: { label: 'Schedule', color: '#54a0ff' },
    NO_SHOW: { label: 'No Show', color: '#feca57' },
    DEFAULT: { label: 'Pending', color: '#64748b' }
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

const getDateTime = (appt) => {
    if (appt?.start_time && appt?.end_time) {
        return `${formatTime12h(appt.start_time)} - ${formatTime12h(appt.end_time)}`;
    }
    if (appt?.appointment_time) return String(appt.appointment_time);
    return '10:00 AM - 10:30 AM';
};

const formatCompactDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const AppointmentRow = ({ appt, onEdit, onCancel, showDate }) => {
    const statusKey = String(appt?.status || 'PENDING').toUpperCase();
    const statusView = STATUS_CONFIG[statusKey] || STATUS_CONFIG.DEFAULT;

    const ptId = appt?.patient_id || '9022';
    const docName = appt?.assigned_doctor_name || appt?.doctor_name || 'Dr. Indu';

    return (
        <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}>
            {showDate && (
                <td style={{ padding: '16px 20px', background: '#f4fdfa', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0d7f6e', background: '#f4fdfa', borderRadius: '6px', padding: '3px 8px', display: 'inline-block' }}>
                        {formatCompactDate(appt?.appointment_date || appt?.formatted_date)}
                    </span>
                </td>
            )}
            {/* 1. Doctor */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        {docName}
                    </span>
                </div>
            </td>

            {/* 2. Token */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0d7f6e' }}>
                    {appt?.token_display || appt?.token_number || 'T-XX'}
                </span>
            </td>

            {/* 3. Patient ID */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 800 }}>
                    {appt?.patient_id || '9022'}
                </span>
            </td>

            {/* 4. Patient */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        {removeSalutation(appt?.child_name) || 'Walk-in Patient'}
                    </span>
                </div>
            </td>

            {/* 5. Gender */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'capitalize' }}>
                    {appt?.gender || 'Boy'}
                </span>
            </td>

            {/* 5. Time */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                {formatTime12h(appt?.appointment_time || appt?.start_time)}
            </td>

            {/* 6. Visit Category */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                    {appt?.visit_category || 'First visit'}
                </span>
            </td>

            {/* 7. Status */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: '50px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    border: `1px solid ${statusView.color}`,
                    color: statusView.color,
                    backgroundColor: '#fff'
                }}>
                    {statusView.label}
                </span>
            </td>

            {/* 8. Token Status */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: (appt?.token_status || 'waiting').toLowerCase() === 'called' ? '#f59e0b' : '#3b82f6',
                    textTransform: 'uppercase'
                }}>
                    {appt?.token_status || 'WAITING'}
                </span>
            </td>

            {/* 9. Edit */}
            <td style={{ padding: '16px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(appt); }}
                    style={{
                        padding: '6px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: '#fff',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Edit2 size={14} />
                </button>
            </td>
        </tr>
    );
};

export default AppointmentRow;
