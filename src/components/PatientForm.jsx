import React from 'react';
import {
    RefreshCw,
    Shield,
    User,
    Users,
    MapPin,
    Zap,
    Mail,
    Clock,
    Briefcase,
    Calendar,
    ChevronDown,
    Activity,
    ClipboardList,
    X
} from 'lucide-react';

export const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Just Enroll' },
    { value: 'book_appointment', label: 'Enroll & Book Visit' }
];

export const EMPTY_FORM = {
    salutation: 'Master',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'Male',
    dob: '',
    age_years: '',
    age_months: '',
    birth_time_hours: '',
    birth_time_minutes: '',
    birth_time_ampm: 'AM',
    father_name: '',
    father_mobile: '',
    father_occupation: '',
    mother_name: '',
    mother_mobile: '',
    parent_mobile: '',
    address: '',
    area: '',
    city: 'Pune',
    state: 'Maharashtra',
    pin_code: '',
    wa_id: '',
    email: '',
    doctor: '',
    communication_preference: 'whatsapp',
    remark: '',
    enrollment_source: 'dashboard',
    enrollment_option: 'just_enroll'
};

const PatientForm = ({
    form,
    setForm,
    onSubmit,
    onCancel,
    submitting,
    editId,
    doctors = []
}) => {
    return (
        <form onSubmit={onSubmit} className="premium-enrollment-form">
            <div className="enrollment-body-v4">
                {/* Section 1: Child Identification */}
                <div className="enrollment-section-v4">
                    <div className="section-header-v4">
                        <div className="section-icon-v4"><User size={22} /></div>
                        <div className="section-title-box">
                            <span className="step-tag">Step 01</span>
                            <h3>Child Identification</h3>
                        </div>
                    </div>

                    <div className="grid-layout-v4">
                        {/* Row 1 */}
                        <div className="f-group-v4">
                            <label>Salut.</label>
                            <div className="input-wrap-v4">
                                <select
                                    value={form.salutation}
                                    onChange={e => setForm({ ...form, salutation: e.target.value })}
                                    className="select-v4"
                                >
                                    {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDown size={18} className="drop-arrow-v4" />
                            </div>
                        </div>

                        <div className="f-group-v4">
                            <label>First Name *</label>
                            <input
                                required
                                placeholder="Arjun"
                                value={form.first_name || ''}
                                onChange={e => setForm({ ...form, first_name: e.target.value })}
                                className="input-v4"
                            />
                        </div>

                        <div className="f-group-v4">
                            <label>Middle Name</label>
                            <input
                                placeholder="Rohit"
                                value={form.middle_name || ''}
                                onChange={e => setForm({ ...form, middle_name: e.target.value })}
                                className="input-v4"
                            />
                        </div>

                        <div className="f-group-v4">
                            <label>Last Name</label>
                            <input
                                placeholder="Sharma"
                                value={form.last_name || ''}
                                onChange={e => setForm({ ...form, last_name: e.target.value })}
                                className="input-v4"
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="f-group-v4">
                            <label>Gender *</label>
                            <div className="input-wrap-v4">
                                <select
                                    value={form.gender || 'Male'}
                                    onChange={e => setForm({ ...form, gender: e.target.value })}
                                    className="select-v4"
                                >
                                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <ChevronDown size={18} className="drop-arrow-v4" />
                            </div>
                        </div>

                        <div className="f-group-v4 col-span-2">
                            <label>Date of Birth</label>
                            <div className="input-wrap-v4">
                                <Calendar size={18} className="input-icon-v4" />
                                <input
                                    type="date"
                                    value={form.dob || ''}
                                    onChange={e => {
                                        const dobVal = e.target.value;
                                        if (!dobVal) {
                                            setForm({ ...form, dob: dobVal, age_years: '', age_months: '' });
                                            return;
                                        }
                                        const birthDate = new Date(dobVal);
                                        const today = new Date();
                                        let years = today.getFullYear() - birthDate.getFullYear();
                                        let months = today.getMonth() - birthDate.getMonth();
                                        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
                                            years--;
                                            months = 12 + months;
                                        }
                                        if (today.getDate() < birthDate.getDate() && months > 0) {
                                            months--;
                                        }
                                        setForm({
                                            ...form,
                                            dob: dobVal,
                                            age_years: Math.max(0, years).toString(),
                                            age_months: Math.max(0, months).toString()
                                        });
                                    }}
                                    className="input-v4 has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Parental Hierarchy */}
                <div className="enrollment-section-v4">
                    <div className="section-header-v4">
                        <div className="section-icon-v4 s-blue"><Users size={22} /></div>
                        <div className="section-title-box">
                            <span className="step-tag s-blue">Step 02</span>
                            <h3>Parental Hierarchy</h3>
                        </div>
                    </div>

                    <div className="grid-layout-v4">
                        <div className="f-group-v4 col-span-2">
                            <label>Father's Name</label>
                            <input placeholder="Rohit Sharma" value={form.father_name || ''} onChange={e => setForm({ ...form, father_name: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>Father's Mobile</label>
                            <input placeholder="9876543210" value={form.father_mobile || ''} onChange={e => setForm({ ...form, father_mobile: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>Occupation</label>
                            <div className="input-wrap-v4">
                                <Briefcase size={18} className="input-icon-v4" />
                                <input placeholder="Engineer" value={form.father_occupation || ''} onChange={e => setForm({ ...form, father_occupation: e.target.value })} className="input-v4 has-icon" />
                            </div>
                        </div>
                        <div className="f-group-v4 col-span-2">
                            <label>Mother's Name</label>
                            <input placeholder="Anjali Sharma" value={form.mother_name || ''} onChange={e => setForm({ ...form, mother_name: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>Mother's Mobile</label>
                            <input placeholder="9876543211" value={form.mother_mobile || ''} onChange={e => setForm({ ...form, mother_mobile: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4 blank-item" />
                    </div>
                </div>

                {/* Section 3: Location & Communication */}
                <div className="enrollment-section-v4">
                    <div className="section-header-v4">
                        <div className="section-icon-v4 s-orange"><MapPin size={22} /></div>
                        <div className="section-title-box">
                            <span className="step-tag s-orange">Step 03</span>
                            <h3>Location & Communication</h3>
                        </div>
                    </div>

                    <div className="grid-layout-v4">
                        <div className="f-group-v4">
                            <label>Area</label>
                            <input placeholder="Bandra" value={form.area || ''} onChange={e => setForm({ ...form, area: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>City</label>
                            <input placeholder="Mumbai" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>State</label>
                            <input placeholder="Maharashtra" value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} className="input-v4" />
                        </div>
                        <div className="f-group-v4">
                            <label>Pin Code</label>
                            <input placeholder="400050" value={form.pin_code || ''} onChange={e => setForm({ ...form, pin_code: e.target.value })} className="input-v4" />
                        </div>

                        <div className="f-group-v4 col-span-full">
                            <label>Full Address</label>
                            <textarea
                                placeholder="Kothrud, Pune"
                                value={form.address || ''}
                                onChange={e => setForm({ ...form, address: e.target.value })}
                                className="textarea-v4"
                            />
                        </div>

                        <div className="f-group-v4">
                            <label>WhatsApp ID / Mobile *</label>
                            <div className="input-wrap-v4">
                                <Zap size={18} className="input-icon-v4 w-accent" />
                                <input required placeholder="9876543210" value={form.wa_id || ''} onChange={e => setForm({ ...form, wa_id: e.target.value, parent_mobile: e.target.value })} className="input-v4 has-icon" />
                            </div>
                        </div>
                        <div className="f-group-v4">
                            <label>Comm. Preference</label>
                            <div className="input-wrap-v4">
                                <select value={form.communication_preference || 'whatsapp'} onChange={e => setForm({ ...form, communication_preference: e.target.value })} className="select-v4">
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="sms">SMS</option>
                                    <option value="email">Email</option>
                                </select>
                                <ChevronDown size={18} className="drop-arrow-v4" />
                            </div>
                        </div>
                        <div className="f-group-v4 col-span-2">
                            <label>Email Address</label>
                            <div className="input-wrap-v4">
                                <Mail size={18} className="input-icon-v4" />
                                <input type="email" placeholder="parent@example.com" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="input-v4 has-icon" />
                            </div>
                        </div>

                        <div className="f-group-v4 col-span-2">
                            <label>Preferred Doctor</label>
                            <div className="input-wrap-v4">
                                <Activity size={18} className="input-icon-v4" />
                                <select
                                    value={form.doctor || ''}
                                    onChange={e => setForm({ ...form, doctor: e.target.value })}
                                    className="select-v4 has-icon"
                                >
                                    <option value="">— Select Doctor —</option>
                                    {doctors && doctors.length > 0 ? (
                                        doctors.map(d => {
                                            const docName = d.full_name || d.name || d.doctor_name || d.doctor_id || 'Generic Doctor';
                                            return (
                                                <option key={d._id || d.doctor_id || Math.random()} value={docName}>
                                                    {docName}
                                                </option>
                                            );
                                        })
                                    ) : (
                                        <option disabled>No doctors available</option>
                                    )}
                                </select>
                                <ChevronDown size={18} className="drop-arrow-v4" />
                            </div>
                        </div>
                        <div className="f-group-v4">
                            <label>Remarks / Notes</label>
                            <div className="input-wrap-v4">
                                <ClipboardList size={18} className="input-icon-v4" />
                                <input placeholder="High priority patient" value={form.remark || ''} onChange={e => setForm({ ...form, remark: e.target.value })} className="input-v4 has-icon" />
                            </div>
                        </div>
                        <div className="f-group-v4">
                            <label>Enrollment Option</label>
                            <div className="input-wrap-v4">
                                <select value={form.enrollment_option || 'just_enroll'} onChange={e => setForm({ ...form, enrollment_option: e.target.value })} className="select-v4">
                                    {ENROLLMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <ChevronDown size={18} className="drop-arrow-v4" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="enrollment-footer-v4">
                <button type="button" onClick={onCancel} className="btn-cancel-v4">
                    <X size={18} />
                    <span>Discard Enrollment</span>
                </button>
                <button type="submit" className="btn-save-v4" disabled={submitting}>
                    {submitting ? (
                        <RefreshCw size={24} className="animate-spin" />
                    ) : (
                        <div className="btn-content-v4">
                            <Shield size={22} />
                            <span>{editId ? 'Sync Updates' : 'Save Patient'}</span>
                        </div>
                    )}
                </button>
            </div>

            <style>{`
                .premium-enrollment-form {
                    background: #fff;
                    border-radius: 40px;
                    overflow: hidden;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 40px 100px rgba(15, 23, 42, 0.08);
                }

                .enrollment-body-v4 {
                    padding: 3.5rem;
                    background: #fff;
                }

                .enrollment-section-v4 {
                    margin-bottom: 3.5rem;
                    position: relative;
                }

                .enrollment-section-v4:last-child {
                    margin-bottom: 0;
                }

                .section-header-v4 {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    margin-bottom: 2.5rem;
                    border-bottom: 1.5px solid #f8fafc;
                    padding-bottom: 1.25rem;
                }

                .section-icon-v4 {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 6px 12px rgba(99, 102, 241, 0.15);
                }

                .section-icon-v4.s-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
                .section-icon-v4.s-orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }

                .step-tag {
                    display: block;
                    font-size: 0.7rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: #6366f1;
                    letter-spacing: 0.12em;
                    margin-bottom: 0.2rem;
                }

                .step-tag.s-blue { color: #3b82f6; }
                .step-tag.s-orange { color: #f59e0b; }

                .section-title-box h3 {
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .grid-layout-v4 {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1.25rem 1.5rem;
                }

                .f-group-v4 {
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }

                .col-span-2 { grid-column: span 2; }
                .col-span-full { grid-column: span 4; }

                .f-group-v4 label {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: #64748b;
                    margin-left: 0.15rem;
                }

                .input-wrap-v4 {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-v4, .select-v4, .textarea-v4 {
                    width: 100%;
                    height: 52px;
                    background: #fdfdfe;
                    border: 2px solid #eef2f6;
                    border-radius: 14px;
                    padding: 0 1rem;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #1e293b;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                }

                .input-v4.has-icon, .select-v4.has-icon {
                    padding-left: 3rem;
                }

                .input-v4:focus, .select-v4:focus, .textarea-v4:focus {
                    border-color: #6366f1;
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.06);
                }

                .textarea-v4 {
                    height: 80px;
                    padding: 0.85rem 1rem;
                    resize: none;
                }

                .input-icon-v4 {
                    position: absolute;
                    left: 1rem;
                    color: #94a3b8;
                    pointer-events: none;
                }

                .w-accent { color: #6366f1; }

                .drop-arrow-v4 {
                    position: absolute;
                    right: 1rem;
                    color: #94a3b8;
                    pointer-events: none;
                }

                .select-v4 { appearance: none; }

                .mini-fields {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }
                .mini-item { display: flex; flex-direction: column; gap: 0.65rem; }

                .time-group-v4 {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    height: 52px;
                    background: #fdfdfe;
                    border: 2px solid #eef2f6;
                    border-radius: 14px;
                    padding: 0 0.75rem;
                }

                .t-icon { color: #94a3b8; margin-right: 0.25rem; }
                .t-input {
                    width: 32px;
                    background: transparent;
                    border: none;
                    text-align: center;
                    font-weight: 800;
                    color: #1e293b;
                    outline: none;
                    font-size: 0.95rem;
                    padding: 0;
                }
                .t-input::placeholder { color: #cbd5e1; }
                .t-sep { font-weight: 900; color: #cbd5e1; }
                .t-select {
                    background: transparent;
                    border: none;
                    font-weight: 900;
                    color: #6366f1;
                    outline: none;
                    cursor: pointer;
                    font-size: 0.85rem;
                    margin-left: auto;
                }

                .enrollment-footer-v4 {
                    padding: 2.5rem 3.5rem;
                    background: #fcfdfe;
                    border-top: 1.5px solid #f1f5f9;
                    display: flex;
                    justify-content: flex-end;
                    gap: 1.5rem;
                }

                .btn-cancel-v4 {
                    height: 58px;
                    padding: 0 1.75rem;
                    border-radius: 16px;
                    background: #fff;
                    border: 1.5px solid #e2e8f0;
                    color: #64748b;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    transition: 0.2s;
                }

                .btn-cancel-v4:hover {
                    background: #fff1f2;
                    color: #e11d48;
                    border-color: #fecaca;
                }

                .btn-save-v4 {
                    height: 58px;
                    padding: 0 2.5rem;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    border: none;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.25);
                    transition: all 0.2s;
                }

                .btn-save-v4:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 28px rgba(99, 102, 241, 0.35);
                }

                .btn-content-v4 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                @media (max-width: 1200px) {
                    .grid-layout-v4 { grid-template-columns: repeat(2, 1fr); }
                    .col-span-full { grid-column: span 2; }
                }

                @media (max-width: 768px) {
                    .enrollment-body-v4 { padding: 1.25rem; }
                    .grid-layout-v4 { grid-template-columns: 1fr; }
                    .col-span-2, .col-span-full { grid-column: span 1; }
                    .enrollment-footer-v4 { flex-direction: column-reverse; padding: 1.5rem; gap: 1rem; }
                    .btn-cancel-v4, .btn-save-v4 { width: 100%; justify-content: center; height: 50px; }
                    .section-header-v4 { margin-bottom: 1.5rem; }
                    .section-title-box h3 { font-size: 1.15rem; }
                }

                @media (max-width: 480px) {
                    .enrollment-body-v4 { padding: 1rem; }
                    .enrollment-section-v4 { padding: 1.25rem; border-radius: 16px; margin-bottom: 1.5rem; }
                    .f-group-v4 label { font-size: 0.8rem; }
                    .input-v4, .select-v4 { height: 46px; font-size: 0.9rem; }
                    .btn-save-v4 { font-size: 0.95rem; }
                }
            `}</style>
        </form>
    );
};

export default PatientForm;
