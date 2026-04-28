import React from 'react';
import {
    User, Phone, Mail, MapPin, Calendar, Users,
    Shield, ShieldCheck, Heart, AlertCircle, RefreshCw, X,
    Zap, Briefcase, Activity, ChevronDown, Check, ClipboardList,
    ArrowLeft, UserPlus, CalendarClock, Baby, ArrowRight
} from 'lucide-react';
import '../glass-landing.css';

const SALUTATIONS = ['Baby', 'Baby of', 'Mr.', 'Mrs.', 'Ms.', 'Master', 'Miss', 'Dr.'];
const COMM_PREFERENCES = ['WhatsApp', 'SMS', 'Email'];

export const EMPTY_FORM = {
    salutation: 'Master',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'boy',
    dob: '',
    father_name: '',
    mother_name: '',
    wa_id: '',
    primary_mobile: '',
    email: '',
    doctor: '',
    remarks: '',
    enrollment_option: 'just_enroll',
    referred_by: '',
    state: 'Maharashtra',
    city: 'Mumbai',
    pincode: '',
    address: ''
};

const PatientForm = ({
    form = EMPTY_FORM,
    setForm = () => { },
    onSubmit,
    onCancel,
    onBlur,
    submitting,
    editId,
    doctors = [],
    referringDoctors = [],
    errors = {}
}) => {
    const handleFormSubmit = (e) => {
        if (onSubmit) onSubmit(e);
    };

    const safeForm = form || EMPTY_FORM;

    return (
        <form onSubmit={handleFormSubmit} className="reg-form-clean" style={{ maxWidth: '100%', background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
            <div className="reg-unified-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="modal-header-icon-container" style={{ background: 'linear-gradient(135deg, #0d7f6e, #0d7f6e)', padding: '10px', borderRadius: '12px' }}>
                        <UserPlus size={24} color="#fff" />
                    </div>
                    <div>
                        <h2 className="reg-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>{editId ? 'Edit Patient Profile' : 'New Patient Enrollment'}</h2>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, margin: 0 }}>Step-by-step registration for new children</p>
                    </div>
                </div>
                <button type="button" className="btn-back-v4" onClick={onCancel} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <X size={20} />
                    <span>Close</span>
                </button>
            </div>

            {/* ── Section 1: Child Identification ── */}
            <div className="reg-section">
                <h2 className="reg-section-title">Child Identification</h2>
                
                <div className="reg-gender-row">
                    <button
                        type="button"
                        className={`reg-gender-card ${safeForm.gender === 'boy' ? 'selected' : ''}`}
                        onClick={() => setForm({ ...safeForm, gender: 'boy', salutation: 'Baby' })}
                    >
                        <div className="reg-gender-avatar">
                            <img src="/boy_avatar.png" alt="Boy" />
                        </div>
                        <span className="reg-gender-label">Boy</span>
                    </button>
                    <button
                        type="button"
                        className={`reg-gender-card ${safeForm.gender === 'girl' ? 'selected' : ''}`}
                        onClick={() => setForm({ ...safeForm, gender: 'girl', salutation: 'Baby' })}
                    >
                        <div className="reg-gender-avatar">
                            <img src="/girl_avatar.png" alt="Girl" />
                        </div>
                        <span className="reg-gender-label">Girl</span>
                    </button>
                </div>

                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">Salutation</label>
                        <div className="reg-select-wrap">
                            <select
                                className="reg-select"
                                value={safeForm.salutation}
                                onChange={e => setForm({ ...safeForm, salutation: e.target.value })}
                            >
                                {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={16} className="reg-select-icon" />
                        </div>
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">First Name *</label>
                        <input
                            name="first_name"
                            className={`reg-input ${errors.first_name ? 'has-error' : ''}`}
                            value={safeForm.first_name}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, first_name: e.target.value })}
                        />
                        {errors.first_name && <p className="reg-err">{errors.first_name}</p>}
                    </div>
                </div>

                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">Middle Name</label>
                        <input
                            className="reg-input"
                            value={safeForm.middle_name}
                            onChange={e => setForm({ ...safeForm, middle_name: e.target.value })}
                        />
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">Last Name *</label>
                        <input
                            name="last_name"
                            className={`reg-input ${errors.last_name ? 'has-error' : ''}`}
                            value={safeForm.last_name}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, last_name: e.target.value })}
                        />
                        {errors.last_name && <p className="reg-err">{errors.last_name}</p>}
                    </div>
                </div>

                <div className="reg-field">
                    <label className="reg-label">Date of Birth *</label>
                    <input
                        name="dob"
                        type="date"
                        className={`reg-input ${errors.dob ? 'has-error' : ''}`}
                        value={safeForm.dob}
                        onBlur={onBlur}
                        onChange={e => setForm({ ...safeForm, dob: e.target.value })}
                    />
                    {errors.dob && <p className="reg-err">{errors.dob}</p>}
                </div>
            </div>

            {/* ── Section 2: Parental Details ── */}
            <div className="reg-section">
                <h2 className="reg-section-title">Parental Details</h2>
                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">Father's Name *</label>
                        <input
                            name="father_name"
                            className={`reg-input ${errors.father_name ? 'has-error' : ''}`}
                            value={safeForm.father_name}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, father_name: e.target.value })}
                        />
                        {errors.father_name && <p className="reg-err">{errors.father_name}</p>}
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">Mother's Name *</label>
                        <input
                            name="mother_name"
                            className={`reg-input ${errors.mother_name ? 'has-error' : ''}`}
                            value={safeForm.mother_name}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, mother_name: e.target.value })}
                        />
                        {errors.mother_name && <p className="reg-err">{errors.mother_name}</p>}
                    </div>
                </div>
            </div>

            {/* ── Section 3: Contact & Assignments ── */}
            <div className="reg-section">
                <h2 className="reg-section-title">Contact &amp; Assignments</h2>
                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">Mobile Number *</label>
                        <input
                            name="wa_id"
                            className={`reg-input ${errors.wa_id ? 'has-error' : ''}`}
                            value={safeForm.wa_id}
                            onBlur={onBlur}
                            onChange={e => {
                                const v = e.target.value.replace(/\D/g, '');
                                setForm({ ...safeForm, wa_id: v, primary_mobile: v });
                            }}
                            readOnly={!!editId}
                            style={editId ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                        />
                        {errors.wa_id && <p className="reg-err">{errors.wa_id}</p>}
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">Communication Pref.</label>
                        <div className="reg-select-wrap">
                            <select
                                className="reg-select"
                                value={safeForm.communication_preference || 'WhatsApp'}
                                onChange={e => setForm({ ...safeForm, communication_preference: e.target.value })}
                            >
                                {COMM_PREFERENCES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <ChevronDown size={16} className="reg-select-icon" />
                        </div>
                    </div>
                </div>

                <div className="reg-field">
                    <label className="reg-label">Email Address *</label>
                    <input
                        name="email"
                        type="email"
                        className={`reg-input ${errors.email ? 'has-error' : ''}`}
                        value={safeForm.email}
                        onBlur={onBlur}
                        onChange={e => setForm({ ...safeForm, email: e.target.value })}
                    />
                    {errors.email && <p className="reg-err">{errors.email}</p>}
                </div>

                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">Preferred Doctor</label>
                        <div className="reg-select-wrap">
                            <select
                                className="reg-select"
                                value={safeForm.doctor}
                                onChange={e => setForm({ ...safeForm, doctor: e.target.value })}
                            >
                                <option value="">— Select Doctor —</option>
                                {doctors.map((d, idx) => (
                                    <option key={d.doctor_id || idx} value={d.full_name || d.name}>{d.full_name || d.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="reg-select-icon" />
                        </div>
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">Enrollment Mode</label>
                        <div className="reg-select-wrap">
                            <select
                                className="reg-select"
                                value={safeForm.enrollment_option || 'just_enroll'}
                                onChange={e => setForm({ ...safeForm, enrollment_option: e.target.value })}
                            >
                                <option value="just_enroll">Registration Only</option>
                                <option value="book_appointment">Register & Book</option>
                            </select>
                            <ChevronDown size={16} className="reg-select-icon" />
                        </div>
                    </div>
                </div>

                <div className="reg-field">
                    <label className="reg-label">Remarks / Internal Notes</label>
                    <input
                        className="reg-input"
                        value={safeForm.remarks}
                        onChange={e => setForm({ ...safeForm, remarks: e.target.value })}
                        placeholder="Add Any vital clinical info..."
                    />
                </div>
            </div>

            {/* ── Section 4: Address ── */}
            <div className="reg-section">
                <h2 className="reg-section-title">Address Details</h2>
                <div className="reg-field">
                    <label className="reg-label">Street Address *</label>
                    <textarea
                        name="address"
                        className={`reg-input reg-textarea ${errors.address ? 'has-error' : ''}`}
                        value={safeForm.address || safeForm.residential_address}
                        onBlur={onBlur}
                        onChange={e => setForm({ ...safeForm, address: e.target.value })}
                        placeholder="Door no, Building, Street..."
                    />
                    {errors.address && <p className="reg-err">{errors.address}</p>}
                </div>
                <div className="reg-grid-2">
                    <div className="reg-field">
                        <label className="reg-label">City *</label>
                        <input
                            name="city"
                            className={`reg-input ${errors.city ? 'has-error' : ''}`}
                            value={safeForm.city}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, city: e.target.value })}
                        />
                        {errors.city && <p className="reg-err">{errors.city}</p>}
                    </div>
                    <div className="reg-field">
                        <label className="reg-label">Pincode *</label>
                        <input
                            name="pincode"
                            className={`reg-input ${errors.pincode ? 'has-error' : ''}`}
                            value={safeForm.pincode}
                            onBlur={onBlur}
                            onChange={e => setForm({ ...safeForm, pincode: e.target.value.replace(/\D/g, '') })}
                        />
                        {errors.pincode && <p className="reg-err">{errors.pincode}</p>}
                    </div>
                </div>
            </div>

            <div className="reg-submit-bar" style={{ borderRadius: '0 0 24px 24px', margin: '0 -2rem -2rem -2rem', padding: '1.5rem 2rem' }}>
                <button type="submit" className="reg-submit-btn" disabled={submitting}>
                    {submitting ? (
                        <RefreshCw size={20} className="animate-spin" />
                    ) : (
                        <>
                            <ShieldCheck size={20} />
                            <span>{editId ? 'Commit Changes' : 'Complete Registration'}</span>
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default PatientForm;

