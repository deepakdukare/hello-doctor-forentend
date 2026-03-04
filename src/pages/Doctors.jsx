import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw,
    Plus,
    Edit2,
    Trash2,
    X,
    User,
    Activity,
    Clock3,
    History,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import {
    getDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorAvailability,
    updateDoctorAvailability,
    patchDoctorAvailabilityStatus,
    patchDoctorAvailabilityEta,
    logDoctorLateCheckin,
    getDoctorLateCheckins,
    getDoctorAvailabilityDashboard
} from '../api/index';

const STATUS_OPTIONS = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];
const todayISO = () => new Date().toISOString().split('T')[0];
const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};
const prettyStatus = (v) => (v || 'N/A').replace(/_/g, ' ');

const Doctors = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [showDoctorForm, setShowDoctorForm] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [doctorForm, setDoctorForm] = useState({
        name: '',
        speciality: 'Pediatrics',
        qualification: '',
        experience: '',
        is_active: true,
        available_slots_json: ''
    });

    const [showAvailability, setShowAvailability] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [availability, setAvailability] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [history, setHistory] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    const [statusForm, setStatusForm] = useState({ status: 'PRESENT', notes: '' });
    const [etaForm, setEtaForm] = useState({ eta_minutes: '', eta_time: '', reason: '' });
    const [lateForm, setLateForm] = useState({ eta_minutes: '', reason: '' });
    const [fullForm, setFullForm] = useState({ status: 'PRESENT', eta_minutes: '', eta_time: '', notes: '', date: todayISO() });

    const fetchDoctorsData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getDoctors();
            let allDocs = res.data?.data || [];

            // Filter if character is a doctor
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'doctor') {
                allDocs = allDocs.filter(d =>
                    d.doctor_id === user.doctor_id ||
                    d.name === user.full_name ||
                    d.name === user.username
                );
            }

            setDoctors(allDocs);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDoctorsData();
    }, [fetchDoctorsData]);

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const fetchAvailabilityData = useCallback(async (doctorId, date) => {
        setAvailabilityLoading(true);
        setError('');
        try {
            const [avRes, dashRes, histRes] = await Promise.all([
                getDoctorAvailability(doctorId, { date }),
                getDoctorAvailabilityDashboard(doctorId),
                getDoctorLateCheckins(doctorId)
            ]);
            const av = avRes.data?.data || null;
            setAvailability(av);
            setDashboard(dashRes.data?.data || null);
            setHistory(histRes.data?.data || []);
            setStatusForm({ status: av?.status || 'PRESENT', notes: av?.notes || '' });
            setFullForm({
                status: av?.status || 'PRESENT',
                eta_minutes: av?.eta_minutes ?? '',
                eta_time: av?.eta_time || '',
                notes: av?.notes || '',
                date
            });
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load availability');
        } finally {
            setAvailabilityLoading(false);
        }
    }, []);

    const openCreate = () => {
        clearMessages();
        setEditingId('');
        setDoctorForm({
            name: '',
            speciality: 'Pediatrics',
            qualification: '',
            experience: '',
            is_active: true,
            available_slots_json: ''
        });
        setShowDoctorForm(true);
    };

    const openEdit = async (doc) => {
        clearMessages();
        try {
            const res = await getDoctorById(doc.doctor_id);
            const profile = res.data?.data || doc;
            setEditingId(profile.doctor_id);
            setDoctorForm({
                name: profile.name || '',
                speciality: profile.speciality || 'Pediatrics',
                qualification: profile.qualification || '',
                experience: profile.experience || '',
                is_active: !!profile.is_active,
                available_slots_json: profile.available_slots ? JSON.stringify(profile.available_slots, null, 2) : ''
            });
            setShowDoctorForm(true);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load doctor details');
        }
    };

    const saveDoctor = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const payload = {
                name: doctorForm.name.trim(),
                speciality: doctorForm.speciality.trim(),
                qualification: doctorForm.qualification.trim() || undefined,
                experience: doctorForm.experience.trim() || undefined,
                is_active: !!doctorForm.is_active
            };
            if (doctorForm.available_slots_json.trim()) payload.available_slots = JSON.parse(doctorForm.available_slots_json);
            if (editingId) await updateDoctor(editingId, payload);
            else await createDoctor(payload);
            setShowDoctorForm(false);
            setSuccess(editingId ? 'Doctor profile updated.' : 'Doctor profile created.');
            fetchDoctorsData();
        } catch (e2) {
            setError(e2.response?.data?.message || e2.message || 'Failed to save doctor');
        }
    };

    const removeDoctor = async (doctorId) => {
        clearMessages();
        if (!window.confirm('Delete this doctor profile?')) return;
        try {
            await deleteDoctor(doctorId);
            setSuccess('Doctor profile deleted.');
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to delete doctor');
        }
    };

    const toggleActive = async (doc) => {
        clearMessages();
        try {
            await updateDoctor(doc.doctor_id, { is_active: !doc.is_active });
            setSuccess('Doctor active status updated.');
            fetchDoctorsData();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to update status');
        }
    };

    const openAvailabilityModal = async (doc) => {
        clearMessages();
        const date = todayISO();
        setSelectedDoctor(doc);
        setSelectedDate(date);
        setShowAvailability(true);
        await fetchAvailabilityData(doc.doctor_id, date);
    };

    const reloadAvailability = async () => {
        if (!selectedDoctor) return;
        await fetchAvailabilityData(selectedDoctor.doctor_id, selectedDate);
    };

    const runAvailabilityAction = async (runner, okMessage) => {
        clearMessages();
        try {
            await runner();
            setSuccess(okMessage);
            await reloadAvailability();
        } catch (e) {
            setError(e.response?.data?.message || 'Availability update failed');
        }
    };

    return (
        <div className="doc-page">
            <div className="doc-head">
                <div>
                    <h1>Doctors</h1>
                    <p>Doctor profile management and real-time availability workflows</p>
                </div>
                <div className="doc-head-actions">
                    <button className="btn btn-outline" onClick={fetchDoctorsData}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={16} />
                        Add Doctor
                    </button>
                </div>
            </div>

            {!!error && (
                <div className="doc-alert doc-alert-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}
            {!!success && (
                <div className="doc-alert doc-alert-success">
                    <CheckCircle2 size={16} />
                    <span>{success}</span>
                    <button onClick={() => setSuccess('')}><X size={14} /></button>
                </div>
            )}

            {loading ? (
                <div className="card">Loading doctors...</div>
            ) : doctors.length === 0 ? (
                <div className="card doc-empty">No doctors found. Add your first doctor profile.</div>
            ) : (
                <div className="doc-grid">
                    {doctors.map((doc) => (
                        <div key={doc.doctor_id} className="card doc-card">
                            <div className="doc-card-head">
                                <div className="doc-avatar"><User size={20} /></div>
                                <div className="doc-core">
                                    <h3>{doc.name}</h3>
                                    <p>{doc.speciality || 'Not specified'}</p>
                                    <span>{doc.doctor_id}</span>
                                </div>
                                <div className="doc-card-head-actions">
                                    <button onClick={() => openEdit(doc)}><Edit2 size={15} /></button>
                                    <button onClick={() => removeDoctor(doc.doctor_id)}><Trash2 size={15} /></button>
                                </div>
                            </div>

                            <div className="doc-meta">
                                <div><strong>Qualification:</strong> {doc.qualification || 'N/A'}</div>
                                <div><strong>Experience:</strong> {doc.experience || 'N/A'}</div>
                                <div><strong>Slots:</strong> {doc.available_slots ? Object.keys(doc.available_slots).length : 0} day(s)</div>
                            </div>

                            <div className="doc-actions-row">
                                <button className="btn btn-outline" onClick={() => openAvailabilityModal(doc)}>
                                    <Activity size={14} />
                                    Availability
                                </button>
                                <button className={`btn ${doc.is_active ? 'btn-outline' : 'btn-primary'}`} onClick={() => toggleActive(doc)}>
                                    <Clock3 size={14} />
                                    {doc.is_active ? 'Set On Leave' : 'Set Active'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showDoctorForm && (
                <div className="doc-modal-wrap">
                    <form className="doc-modal card" onSubmit={saveDoctor}>
                        <div className="doc-modal-head">
                            <h3>{editingId ? 'Edit Doctor' : 'Create Doctor'}</h3>
                            <button type="button" onClick={() => setShowDoctorForm(false)}><X size={16} /></button>
                        </div>

                        <div className="doc-form-grid">
                            <label>
                                Name *
                                <input required value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} />
                            </label>
                            <label>
                                Speciality *
                                <input required value={doctorForm.speciality} onChange={(e) => setDoctorForm({ ...doctorForm, speciality: e.target.value })} />
                            </label>
                            <label>
                                Qualification
                                <input value={doctorForm.qualification} onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })} />
                            </label>
                            <label>
                                Experience
                                <input value={doctorForm.experience} onChange={(e) => setDoctorForm({ ...doctorForm, experience: e.target.value })} />
                            </label>
                            <label className="doc-json-field">
                                Available Slots JSON
                                <textarea
                                    rows={5}
                                    placeholder='{"1":["S1","S2"],"2":["S1"]}'
                                    value={doctorForm.available_slots_json}
                                    onChange={(e) => setDoctorForm({ ...doctorForm, available_slots_json: e.target.value })}
                                />
                            </label>
                            <label className="doc-check">
                                <input type="checkbox" checked={doctorForm.is_active} onChange={(e) => setDoctorForm({ ...doctorForm, is_active: e.target.checked })} />
                                Active doctor
                            </label>
                        </div>

                        <div className="doc-modal-foot">
                            <button className="btn btn-outline" type="button" onClick={() => setShowDoctorForm(false)}>Cancel</button>
                            <button className="btn btn-primary" type="submit">{editingId ? 'Update Doctor' : 'Create Doctor'}</button>
                        </div>
                    </form>
                </div>
            )}

            {showAvailability && selectedDoctor && (
                <div className="doc-modal-wrap">
                    <div className="doc-modal card doc-availability-modal">
                        <div className="doc-modal-head">
                            <h3>{selectedDoctor.name} ({selectedDoctor.doctor_id})</h3>
                            <button type="button" onClick={() => setShowAvailability(false)}><X size={16} /></button>
                        </div>

                        <div className="doc-availability-controls">
                            <div className="doc-date-wrap">
                                <label htmlFor="availability-date">Working Date</label>
                                <input
                                    id="availability-date"
                                    type="date"
                                    value={selectedDate}
                                    onChange={async (e) => {
                                        const d = e.target.value;
                                        setSelectedDate(d);
                                        setFullForm((prev) => ({ ...prev, date: d }));
                                        await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                    }}
                                />
                            </div>
                            <div className="doc-date-shortcuts">
                                <button
                                    type="button"
                                    className={`btn btn-outline ${selectedDate === todayISO() ? 'doc-quick-date-active' : ''}`}
                                    onClick={async () => {
                                        const d = todayISO();
                                        setSelectedDate(d);
                                        setFullForm((prev) => ({ ...prev, date: d }));
                                        await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                    }}
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-outline ${selectedDate === tomorrowISO() ? 'doc-quick-date-active' : ''}`}
                                    onClick={async () => {
                                        const d = tomorrowISO();
                                        setSelectedDate(d);
                                        setFullForm((prev) => ({ ...prev, date: d }));
                                        await fetchAvailabilityData(selectedDoctor.doctor_id, d);
                                    }}
                                >
                                    Tomorrow
                                </button>
                                <button className="btn btn-outline" onClick={reloadAvailability}>
                                    <RefreshCw size={14} />
                                    Reload
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => navigate('/scheduling')}
                                >
                                    Manage Slots
                                </button>
                            </div>
                        </div>

                        {availabilityLoading ? (
                            <div>Loading availability...</div>
                        ) : (
                            <>
                                <div className="doc-guide">
                                    <h4>How to update quickly</h4>
                                    <div className="doc-guide-grid">
                                        <div><strong>1. Quick Status</strong><span>Use for present, absent, late, or on leave updates.</span></div>
                                        <div><strong>2. Quick ETA</strong><span>Use when running late and share expected arrival time.</span></div>
                                        <div><strong>3. Late Check-in</strong><span>Log delay incidents with reason for audit/history.</span></div>
                                        <div><strong>4. Full Update</strong><span>Use when you need to update date, status, ETA and notes together.</span></div>
                                    </div>
                                </div>

                                <div className="doc-status-row">
                                    <div><strong>Status:</strong> {prettyStatus(availability?.status || dashboard?.availability?.status)}</div>
                                    <div><strong>ETA:</strong> {availability?.eta_minutes ?? 'N/A'} {availability?.eta_time ? `(${availability.eta_time})` : ''}</div>
                                    <div><strong>Queue:</strong> {availability?.queue?.total ?? dashboard?.queue_summary?.total ?? 0}</div>
                                </div>

                                <div className="doc-api-grid">
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => patchDoctorAvailabilityStatus(selectedDoctor.doctor_id, statusForm),
                                            'Status updated.'
                                        );
                                    }}>
                                        <h4>Quick Status</h4>
                                        <p className="doc-form-help">Update doctor presence and a short note.</p>
                                        <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                                            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                                        </select>
                                        <input placeholder="Notes" value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} />
                                        <button className="btn doc-action-btn" type="submit">Update Status</button>
                                    </form>

                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => patchDoctorAvailabilityEta(selectedDoctor.doctor_id, {
                                                eta_minutes: Number(etaForm.eta_minutes) || 0,
                                                eta_time: etaForm.eta_time || null,
                                                reason: etaForm.reason || null
                                            }),
                                            'ETA updated.'
                                        );
                                    }}>
                                        <h4>Quick ETA</h4>
                                        <p className="doc-form-help">Set delay duration and expected arrival.</p>
                                        <input type="number" min="0" placeholder="ETA minutes" value={etaForm.eta_minutes} onChange={(e) => setEtaForm({ ...etaForm, eta_minutes: e.target.value })} required />
                                        <input placeholder="ETA time (e.g. 10:45 AM)" value={etaForm.eta_time} onChange={(e) => setEtaForm({ ...etaForm, eta_time: e.target.value })} />
                                        <input placeholder="Reason" value={etaForm.reason} onChange={(e) => setEtaForm({ ...etaForm, reason: e.target.value })} />
                                        <button className="btn doc-action-btn" type="submit">Update ETA</button>
                                    </form>

                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => logDoctorLateCheckin({
                                                doctor_id: selectedDoctor.doctor_id,
                                                eta_minutes: Number(lateForm.eta_minutes) || 0,
                                                reason: lateForm.reason
                                            }),
                                            'Late check-in logged.'
                                        );
                                    }}>
                                        <h4>Late Check-in</h4>
                                        <p className="doc-form-help">Create late entry to keep delay history accurate.</p>
                                        <input type="number" min="0" placeholder="ETA minutes" value={lateForm.eta_minutes} onChange={(e) => setLateForm({ ...lateForm, eta_minutes: e.target.value })} required />
                                        <input placeholder="Reason" value={lateForm.reason} onChange={(e) => setLateForm({ ...lateForm, reason: e.target.value })} required />
                                        <button className="btn doc-action-btn" type="submit">Log Delay</button>
                                    </form>

                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        runAvailabilityAction(
                                            () => updateDoctorAvailability({
                                                doctor_id: selectedDoctor.doctor_id,
                                                status: fullForm.status,
                                                eta_minutes: fullForm.eta_minutes === '' ? null : Number(fullForm.eta_minutes),
                                                eta_time: fullForm.eta_time || null,
                                                notes: fullForm.notes || null,
                                                date: fullForm.date
                                            }),
                                            'Availability updated.'
                                        );
                                    }}>
                                        <h4>Full Update</h4>
                                        <p className="doc-form-help">Set complete daily status in one action.</p>
                                        <input type="date" value={fullForm.date} onChange={(e) => setFullForm({ ...fullForm, date: e.target.value })} required />
                                        <select value={fullForm.status} onChange={(e) => setFullForm({ ...fullForm, status: e.target.value })}>
                                            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                                        </select>
                                        <input type="number" min="0" placeholder="ETA minutes" value={fullForm.eta_minutes} onChange={(e) => setFullForm({ ...fullForm, eta_minutes: e.target.value })} />
                                        <input placeholder="ETA time" value={fullForm.eta_time} onChange={(e) => setFullForm({ ...fullForm, eta_time: e.target.value })} />
                                        <input placeholder="Notes" value={fullForm.notes} onChange={(e) => setFullForm({ ...fullForm, notes: e.target.value })} />
                                        <button className="btn doc-action-btn" type="submit">Submit Full Update</button>
                                    </form>
                                </div>

                                <div className="doc-history">
                                    <h4><History size={14} /> Late check-in history ({history.length})</h4>
                                    {!history.length ? (
                                        <p>No records.</p>
                                    ) : (
                                        <div className="doc-history-list">
                                            {history.slice(0, 6).map((h) => (
                                                <div key={h._id}>
                                                    {new Date(h.date).toLocaleDateString()} | {prettyStatus(h.status)} | events: {h.late_checkins?.length || 0}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .doc-page { width: 100%; }
                .doc-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
                .doc-head h1 { font-size: 2rem; margin: 0; }
                .doc-head p { color: #64748b; margin-top: 0.25rem; }
                .doc-head-actions { display: flex; gap: 0.75rem; }
                .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 1rem; }
                .doc-card { border-radius: 18px; padding: 1rem; }
                .doc-card-head { display: flex; gap: 0.75rem; align-items: flex-start; }
                .doc-avatar { width: 40px; height: 40px; border-radius: 12px; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; }
                .doc-core h3 { font-size: 1.1rem; margin: 0 0 0.15rem; }
                .doc-core p { margin: 0; color: #64748b; font-size: 0.9rem; }
                .doc-core span { color: #475569; font-size: 0.8rem; font-weight: 600; }
                .doc-card-head-actions { margin-left: auto; display: flex; gap: 0.4rem; }
                .doc-card-head-actions button { border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 0.35rem; cursor: pointer; }
                .doc-meta { margin-top: 0.8rem; color: #334155; display: grid; gap: 0.2rem; font-size: 0.88rem; }
                .doc-actions-row { margin-top: 0.9rem; display: flex; gap: 0.6rem; flex-wrap: wrap; }
                .doc-alert { display: flex; gap: 0.5rem; align-items: center; padding: 0.75rem 0.9rem; border-radius: 12px; margin-bottom: 0.75rem; border: 1px solid; }
                .doc-alert span { flex: 1; font-size: 0.9rem; font-weight: 600; }
                .doc-alert button { border: none; background: transparent; cursor: pointer; color: inherit; display: flex; }
                .doc-alert-error { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
                .doc-alert-success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
                .doc-empty { text-align: center; color: #64748b; }
                .doc-modal-wrap { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; justify-content: center; align-items: center; z-index: 999; padding: 1rem; }
                .doc-modal { width: min(920px, 96vw); max-height: 92vh; overflow: auto; border-radius: 20px; padding: 1rem; }
                .doc-availability-modal { width: min(1080px, 96vw); }
                .doc-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .doc-modal-head h3 { margin: 0; }
                .doc-modal-head button { border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 0.35rem; cursor: pointer; }
                .doc-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .doc-form-grid label { display: grid; gap: 0.3rem; font-size: 0.85rem; color: #334155; font-weight: 600; }
                .doc-form-grid input, .doc-form-grid textarea, .doc-form-grid select { border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.6rem 0.7rem; background: #fff; }
                .doc-json-field { grid-column: 1 / -1; }
                .doc-check { grid-column: 1 / -1; display: flex !important; align-items: center; gap: 0.5rem; }
                .doc-modal-foot { margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.6rem; }
                .doc-availability-controls { display: flex; justify-content: space-between; gap: 0.9rem; align-items: flex-end; margin-bottom: 0.9rem; flex-wrap: wrap; }
                .doc-date-wrap { display: grid; gap: 0.35rem; }
                .doc-date-wrap label { font-size: 0.78rem; color: #475569; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
                .doc-date-wrap input { min-width: 210px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.52rem 0.7rem; background: #fff; font-weight: 600; }
                .doc-date-shortcuts { display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap; }
                .doc-quick-date-active { border-color: #6366f1 !important; color: #4f46e5 !important; background: #eef2ff !important; }
                .doc-guide { border: 1px solid #dbeafe; border-radius: 12px; padding: 0.8rem; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%); margin-bottom: 0.85rem; }
                .doc-guide h4 { margin: 0 0 0.55rem; font-size: 0.95rem; color: #1e3a8a; }
                .doc-guide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.55rem; }
                .doc-guide-grid > div { border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; padding: 0.55rem; display: grid; gap: 0.2rem; }
                .doc-guide-grid strong { font-size: 0.83rem; color: #0f172a; }
                .doc-guide-grid span { font-size: 0.78rem; color: #64748b; line-height: 1.35; }
                .doc-status-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.6rem; margin-bottom: 0.8rem; color: #334155; }
                .doc-status-row > div { border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.55rem 0.65rem; background: #f8fafc; }
                .doc-api-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 0.7rem; }
                .doc-api-grid form { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.7rem; display: grid; gap: 0.45rem; background: #fff; }
                .doc-api-grid h4 { margin: 0 0 0.2rem; font-size: 0.95rem; }
                .doc-api-grid input, .doc-api-grid select { border: 1px solid #cbd5e1; border-radius: 9px; padding: 0.52rem 0.6rem; }
                .doc-form-help { margin: 0; font-size: 0.78rem; color: #64748b; line-height: 1.3; }
                .doc-action-btn { width: 100%; justify-content: center; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #fff; border: none; font-weight: 700; }
                .doc-action-btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
                .doc-history { margin-top: 0.9rem; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; background: #f8fafc; }
                .doc-history h4 { display: flex; gap: 0.45rem; align-items: center; margin: 0 0 0.45rem; font-size: 0.95rem; }
                .doc-history p { margin: 0; color: #64748b; }
                .doc-history-list { display: grid; gap: 0.35rem; color: #334155; font-size: 0.87rem; }
                @media (max-width: 900px) {
                    .doc-head { flex-direction: column; align-items: flex-start; }
                    .doc-form-grid { grid-template-columns: 1fr; }
                    .doc-date-wrap input { min-width: 170px; width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default Doctors;
