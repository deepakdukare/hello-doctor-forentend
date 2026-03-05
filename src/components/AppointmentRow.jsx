import React from 'react';
import { CheckCircle2, Clock3, Edit2, Phone, Trash2, XCircle } from 'lucide-react';
import { removeSalutation } from '../utils/formatters';

const STATUS_CONFIG = {
    CONFIRMED: { label: 'CONFIRMED', color: '#6366f1', bg: '#eef2ff', icon: CheckCircle2 },
    COMPLETED: { label: 'CHECKED OUT', color: '#0ea5e9', bg: '#f0f9ff', icon: CheckCircle2 },
    CANCELLED: { label: 'CANCELLED', color: '#e11d48', bg: '#fff1f2', icon: XCircle },
    CANCELED: { label: 'CANCELLED', color: '#e11d48', bg: '#fff1f2', icon: XCircle },
    PENDING: { label: 'SCHEDULED', color: '#64748b', bg: '#f8fafc', icon: Clock3 },
    NO_SHOW: { label: 'NO SHOW', color: '#f59e0b', bg: '#fffbeb', icon: Clock3 },
    DEFAULT: { label: 'PENDING', color: '#64748b', bg: '#f1f5f9', icon: Clock3 }
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
        <tr className="appointment-row-premium">
            <td className="patient-cell-premium">
                <div className="patient-info-stack">
                    <div className="patient-name-bold">{removeSalutation(appt?.child_name) || 'Walk-in Patient'}</div>
                    <div className="patient-meta-pill">
                        <span className="p-id">{appt?.patient_id || '--'}</span>
                        <span className="p-separator"></span>
                        <Phone size={11} className="p-icon" />
                        <span className="p-phone">{appt?.parent_mobile || '--'}</span>
                    </div>
                </div>
            </td>

            <td className="datetime-cell-premium">
                <div className="datetime-stack">
                    <div className="date-main">{formatDateShort(appt?.appointment_date || appt?.date)}</div>
                    <div className="time-sub">{getDateTime(appt)}</div>
                </div>
            </td>

            <td className="doctor-cell-premium">
                <div className="doctor-assign-stack">
                    <div className="doc-name">{appt?.assigned_doctor_name || appt?.doctor_name || 'Dr. Indu'}</div>
                    <div className="visit-badge">{getVisitType(appt)}</div>
                </div>
            </td>

            <td className="reason-cell-premium">
                <div className="reason-text">{appt?.reason || 'General Checkup'}</div>
            </td>

            <td className="status-cell-premium">
                <span className="status-pill-premium" style={{
                    '--status-color': statusView.color,
                    '--status-bg': statusView.bg
                }}>
                    <StatusIcon size={14} className="s-icon" />
                    <span>{statusView.label}</span>
                </span>
            </td>

            <td className="management-cell-premium">
                <div className="actions-wrapper">
                    <button
                        className="action-btn edit-btn"
                        title="Reschedule / Edit"
                        onClick={() => onEdit(appt)}
                        disabled={isCancelled}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className="action-btn cancel-btn"
                        title="Cancel Appointment"
                        onClick={() => onCancel(appt?.appointment_id)}
                        disabled={isCancelled}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>

            <style>{`
                .appointment-row-premium td {
                    padding: 1.25rem 1.5rem;
                    background: #fff;
                    border-bottom: 1px solid #f1f5f9;
                    transition: all 0.2s ease;
                }

                .appointment-row-premium:hover td {
                    background: #f8faff;
                }

                .patient-name-bold {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 1rem;
                    margin-bottom: 0.25rem;
                }

                .patient-meta-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #94a3b8;
                }

                .p-icon { color: #6366f1; opacity: 0.5; }
                .p-separator { width: 4px; height: 4px; background: #cbd5e1; border-radius: 50%; }

                .date-main {
                    font-weight: 800;
                    color: #334155;
                    font-size: 0.95rem;
                }

                .time-sub {
                    font-weight: 700;
                    color: #6366f1;
                    font-size: 0.75rem;
                    margin-top: 0.15rem;
                }

                .doc-name {
                    font-weight: 800;
                    color: #4f46e5;
                    font-size: 0.9rem;
                }

                .visit-badge {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #94a3b8;
                    letter-spacing: 0.05em;
                    margin-top: 0.15rem;
                }

                .reason-text {
                    color: #64748b;
                    font-size: 0.9rem;
                    font-weight: 600;
                }

                .status-pill-premium {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 900;
                    background: var(--status-bg);
                    color: var(--status-color);
                    border: 1px solid rgba(0,0,0,0.02);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .actions-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                }

                .action-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    border: 1.5px solid #f1f5f9;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #64748b;
                    padding: 0;
                }

                .action-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .edit-btn:hover:not(:disabled) {
                    border-color: #6366f1;
                    color: #6366f1;
                    background: #eef2ff;
                }

                .cancel-btn:hover:not(:disabled) {
                    border-color: #ef4444;
                    color: #ef4444;
                    background: #fef2f2;
                }

                .action-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    background: #f8fafc;
                }
            `}</style>
        </tr>
    );
};

export default AppointmentRow;
