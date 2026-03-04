import React from 'react';
import { RefreshCw, Shield, Zap, Mail } from 'lucide-react';

export const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Just Enroll' },
    { value: 'book_appointment', label: 'Enroll & Book' }
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
    city: '',
    state: '',
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
        <form onSubmit={onSubmit} className="modal-form-premium" style={{ background: '#fff', borderRadius: '24px', padding: '2rem', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
            <div className="form-scroll-area" style={{ maxHeight: 'none', overflow: 'visible' }}>
                <div className="form-grid-v2">
                    <div className="form-section-header">
                        <div className="section-number">1</div>
                        <span>Child Identification</span>
                    </div>
                    <div className="form-row-multi">
                        <div className="form-group-v2" style={{ flex: '0 0 100px' }}>
                            <label>Salut.</label>
                            <select value={form.salutation} onChange={e => setForm({ ...form, salutation: e.target.value })} className="input-v3">
                                {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group-v2">
                            <label>First Name *</label>
                            <input required placeholder="Arjun" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Middle Name</label>
                            <input placeholder="Rohit" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Last Name</label>
                            <input placeholder="Sharma" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="input-v3" />
                        </div>
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Gender *</label>
                            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="input-v3">
                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="form-group-v2" style={{ flex: 2 }}>
                            <label>Date of Birth</label>
                            <input
                                type="date"
                                value={form.dob}
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
                                className="input-v3"
                            />
                        </div>
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Age (Years)</label>
                            <input type="number" placeholder="3" value={form.age_years} onChange={e => setForm({ ...form, age_years: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Age (Months)</label>
                            <input type="number" placeholder="9" value={form.age_months} onChange={e => setForm({ ...form, age_months: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Birth Time</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="number" placeholder="10" style={{ width: '60px' }} value={form.birth_time_hours} onChange={e => setForm({ ...form, birth_time_hours: e.target.value })} className="input-v3" />
                                <input type="number" placeholder="30" style={{ width: '60px' }} value={form.birth_time_minutes} onChange={e => setForm({ ...form, birth_time_minutes: e.target.value })} className="input-v3" />
                                <select value={form.birth_time_ampm} onChange={e => setForm({ ...form, birth_time_ampm: e.target.value })} className="input-v3">
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section-header">
                        <div className="section-number">2</div>
                        <span>Parental Hierarchy</span>
                    </div>
                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Father's Name</label>
                            <input placeholder="Rohit Sharma" value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Father's Mobile</label>
                            <input placeholder="9876543210" value={form.father_mobile} onChange={e => setForm({ ...form, father_mobile: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Occupation</label>
                            <input placeholder="Engineer" value={form.father_occupation} onChange={e => setForm({ ...form, father_occupation: e.target.value })} className="input-v3" />
                        </div>
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Mother's Name</label>
                            <input placeholder="Anjali Sharma" value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Mother's Mobile</label>
                            <input placeholder="9876543211" value={form.mother_mobile} onChange={e => setForm({ ...form, mother_mobile: e.target.value })} className="input-v3" />
                        </div>
                    </div>

                    <div className="form-section-header">
                        <div className="section-number">3</div>
                        <span>Location & Communication</span>
                    </div>
                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Area</label>
                            <input placeholder="Bandra" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>City</label>
                            <input placeholder="Mumbai" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>State</label>
                            <input placeholder="Maharashtra" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Pin Code</label>
                            <input placeholder="400050" value={form.pin_code} onChange={e => setForm({ ...form, pin_code: e.target.value })} className="input-v3" />
                        </div>
                    </div>

                    <div className="form-group-v2">
                        <label>Full Address</label>
                        <textarea
                            placeholder="Kothrud, Pune"
                            value={form.address}
                            onChange={e => setForm({ ...form, address: e.target.value })}
                            className="input-v3"
                            style={{ height: '80px', paddingTop: '1rem', resize: 'none' }}
                        />
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>WhatsApp ID / Mobile *</label>
                            <div className="input-with-icon-v3">
                                <Zap size={16} />
                                <input required placeholder="9876543210" value={form.wa_id} onChange={e => setForm({ ...form, wa_id: e.target.value, parent_mobile: e.target.value })} className="input-v3-icon" />
                            </div>
                        </div>
                        <div className="form-group-v2">
                            <label>Comm. Preference</label>
                            <select value={form.communication_preference} onChange={e => setForm({ ...form, communication_preference: e.target.value })} className="input-v3">
                                <option value="whatsapp">WhatsApp</option>
                                <option value="sms">SMS</option>
                                <option value="email">Email</option>
                                <option value="call">Voice Call</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2" style={{ flex: 2 }}>
                            <label>Email Address</label>
                            <div className="input-with-icon-v3">
                                <Mail size={16} />
                                <input type="email" placeholder="parent@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-v3-icon" />
                            </div>
                        </div>
                        <div className="form-group-v2">
                            <label>Preferred Doctor</label>
                            <select
                                value={form.doctor}
                                onChange={e => setForm({ ...form, doctor: e.target.value })}
                                className="input-v3"
                            >
                                <option value="">— Select Doctor —</option>
                                {doctors.length > 0
                                    ? doctors.map(d => (
                                        <option key={d._id} value={d.full_name}>{d.full_name}</option>
                                    ))
                                    : <option value="Dr. Indu">Dr. Indu</option>
                                }
                            </select>
                        </div>
                    </div>

                    <div className="form-row-multi">
                        <div className="form-group-v2">
                            <label>Remarks / Notes</label>
                            <input placeholder="High priority patient" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="input-v3" />
                        </div>
                        <div className="form-group-v2">
                            <label>Enrollment Option</label>
                            <select value={form.enrollment_option} onChange={e => setForm({ ...form, enrollment_option: e.target.value })} className="input-v3">
                                {ENROLLMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="modal-footer-premium" style={{ marginTop: '2rem' }}>
                <button type="button" onClick={onCancel} className="btn-cancel-v3">Cancel</button>
                <button type="submit" className="btn-save-v3" disabled={submitting}>
                    {submitting ? (
                        <RefreshCw size={20} className="animate-spin" />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Shield size={20} />
                            <span>{editId ? 'Sync Profile' : 'Authorize Activation'}</span>
                        </div>
                    )}
                </button>
            </div>
        </form>
    );
};

export default PatientForm;
