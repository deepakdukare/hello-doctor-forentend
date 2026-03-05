import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Calendar, Phone, MapPin, FileText, CheckCircle,
    AlertCircle, Stethoscope, Baby, Users, Briefcase, Mail,
    Clock, Smartphone, MapPinned, ChevronRight, ChevronLeft,
    Check, RefreshCw, Activity, Clipboard, Edit2, Plus,
    ArrowRight, Map, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableSlots, getDoctors, getPatientByWa, getAppointmentsByWaId, updateAppointment } from '../api/index';
import { removeSalutation } from '../utils/formatters';

const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
const GENDERS = ['Male', 'Female', 'Other'];
const COMM_PREFERENCES = ['WhatsApp', 'SMS', 'Email', 'Phone Call'];
const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Just Enroll' },
    { value: 'book_appointment', label: 'Enroll & Book Now' }
];

const formatTime12h = (t) => {
    if (!t) return '--';
    const [h, m] = String(t).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getRawDoctorName = (doc) => {
    if (!doc) return '';
    return doc.full_name || doc.name || doc.doctor_name || doc.doctor_id || '';
};

const getDoctorDisplayName = (doc) => {
    if (!doc) return '';
    const name = doc.full_name || doc.name || doc.doctor_name || doc.doctor_id || '';
    const spec = doc.speciality || doc.specialization;
    return spec ? `${name} (${spec})` : name;
};

const PublicRegister = () => {
    const [step, setStep] = useState(0); // 0: Member Check, 1: Registration, 2: Booking, 3: Success
    const [isNewPatient, setIsNewPatient] = useState(null); // null | true | false
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [verifyError, setVerifyError] = useState(null); // inline error for existing patient check
    const [doctors, setDoctors] = useState([]);
    const [searchWaId, setSearchWaId] = useState('');
    const [rescheduleWaId, setRescheduleWaId] = useState('');
    const [rescheduleError, setRescheduleError] = useState(null);
    const [waIdValidation, setWaIdValidation] = useState({ loading: false, error: null });
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);

    // Step 1: Detailed Patient Data (Consolidated from Screenshot)
    const [patientForm, setPatientForm] = useState({
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

        area: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pin_code: '',
        full_address: '',
        wa_id: '',
        comm_preference: 'WhatsApp',
        email: '',
        preferred_doctor: '',
        notes: '',
        enrollment_option: 'just_enroll',
        registration_source: 'form'
    });

    // Step 2: Booking Data
    const [bookingForm, setBookingForm] = useState({
        wa_id: '',
        doctor_name: 'Dr. Indu',
        appointment_date: new Date().toISOString().split('T')[0],
        slot_id: '',
        doctor_speciality: 'Pediatrics',
        visit_type: 'CONSULTATION',
        reason: ''
    });

    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [registeredPatient, setRegisteredPatient] = useState(null);

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const res = await getDoctors();
                const docs = res.data.data || [];
                setDoctors(docs);
                if (docs.length > 0 && !patientForm.preferred_doctor) {
                    setPatientForm(prev => ({ ...prev, preferred_doctor: getDoctorDisplayName(docs[0]) }));
                    setBookingForm(prev => ({ ...prev, doctor_name: getRawDoctorName(docs[0]) }));
                }
            } catch (err) {
                console.error("Failed to fetch doctors", err);
            }
        };
        fetchDoctors();
    }, []);

    const fetchSlots = useCallback(async (doctorName, date) => {
        if (!doctorName || !date) return;
        setSlotsLoading(true);
        try {
            const res = await getAvailableSlots(doctorName, date);
            setAvailableSlots(res.data.data || []);
        } catch (err) {
            console.error("Failed to fetch slots", err);
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (step === 2 && bookingForm.appointment_date) {
            fetchSlots(bookingForm.doctor_name, bookingForm.appointment_date);
        }
    }, [step, bookingForm.appointment_date, bookingForm.doctor_name, fetchSlots]);

    const checkMember = async (e, type = 'lookup') => {
        if (e) e.preventDefault();
        const rawId = type === 'lookup' ? searchWaId : rescheduleWaId;
        const targetId = rawId.trim();
        const setErrorFn = type === 'lookup' ? setVerifyError : setRescheduleError;

        if (!targetId || targetId.length < 10) {
            setErrorFn("Please enter a valid 10-digit mobile number.");
            return;
        }
        setLoading(true);
        setErrorFn(null);
        setError(null);

        try {
            if (type === 'reschedule') {
                let patientData = null;
                let appointments = [];

                try {
                    const patientRes = await getPatientByWa(targetId);
                    patientData = patientRes.data.data;
                } catch (pErr) {
                    if (pErr.response?.status === 404) {
                        setErrorFn("No patient record found with this number. Please register first.");
                        setLoading(false);
                        return;
                    }
                    throw pErr;
                }

                if (!patientData) {
                    setErrorFn("No patient record found with this number.");
                    setLoading(false);
                    return;
                }

                try {
                    const apptsRes = await getAppointmentsByWaId(targetId);
                    appointments = apptsRes.data.data || [];
                } catch (aErr) {
                    // If no appointments found, we just show empty list step
                    if (aErr.response?.status !== 404) throw aErr;
                }

                setRegisteredPatient(patientData);
                setIsNewPatient(false);
                setPatientAppointments(appointments.filter(a => a.status === 'PENDING' || a.status === 'CONFIRMED'));
                setStep(4);
            } else {
                try {
                    const res = await getPatientByWa(targetId);
                    const patientData = res.data.data;
                    if (patientData) {
                        setRegisteredPatient(patientData);
                        setIsNewPatient(false);
                        setBookingForm(prev => ({
                            ...prev,
                            wa_id: patientData.wa_id,
                            doctor_name: patientData.preferred_doctor || prev.doctor_name
                        }));
                        setStep(2);
                    } else {
                        setErrorFn("No record found with this number.");
                    }
                } catch (pErr) {
                    if (pErr.response?.status === 404) {
                        setErrorFn("No record found with this number. Please register as a new patient.");
                    } else {
                        throw pErr;
                    }
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Lookup Error:", err);
            setErrorFn(err.response?.data?.message || "Server error. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleWaIdCheck = async (val) => {
        if (!val || val.length < 10) {
            setWaIdValidation({ loading: false, error: null });
            return;
        }
        setWaIdValidation({ loading: true, error: null });
        try {
            const res = await getPatientByWa(val);
            if (res.data.data) {
                setWaIdValidation({
                    loading: false,
                    error: "This number is already registered. If this is you, please go back and use 'Already Registered'."
                });
            } else {
                setWaIdValidation({ loading: false, error: null });
            }
        } catch (err) {
            setWaIdValidation({ loading: false, error: null });
        }
    };

    const handleRegistration = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...patientForm,
                age_years: patientForm.age_years ? parseInt(patientForm.age_years) : undefined,
                age_months: patientForm.age_months ? parseInt(patientForm.age_months) : undefined,
                birth_time_hours: patientForm.birth_time_hours ? parseInt(patientForm.birth_time_hours) : undefined,
                birth_time_minutes: patientForm.birth_time_minutes ? parseInt(patientForm.birth_time_minutes) : undefined,
            };
            const res = await registerFromForm(payload);
            const patientData = res.data.data;
            setRegisteredPatient(patientData);
            // Strip speciality from preferred_doctor display name before sending to API
            const rawDocName = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor)
                ? getRawDoctorName(doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor))
                : (patientForm.preferred_doctor?.replace(/\s*\([^)]*\)\s*$/, '').trim() || prev.doctor_name);
            setBookingForm(prev => ({
                ...prev,
                wa_id: patientData.wa_id || patientForm.wa_id || patientForm.father_mobile,
                doctor_name: rawDocName
            }));

            if (patientForm.enrollment_option === 'book_appointment') {
                setStep(2);
            } else {
                setStep(3);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            if (err.response?.data?.error_code === 'PATIENT_EXISTS') {
                setError("Patient already registered. Finding your record...");
                setTimeout(() => {
                    setSearchWaId(patientForm.wa_id || patientForm.father_mobile);
                    checkMember();
                }, 1500);
            } else {
                setError(errorMsg || "Registration failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!bookingForm.slot_id) {
            setError("Please select a time slot");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (bookingForm.reschedule_from) {
                await updateAppointment(bookingForm.reschedule_from, bookingForm);
            } else {
                await bookByForm(bookingForm);
            }
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err.response?.data?.message || "Booking failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderProgress = () => (
        <div className="stepper-v3">
            {[
                { s: 1, label: 'Identity Verification', num: 1 },
                { s: 2, label: 'Consultation Config', num: 2 }
            ].map((item, idx) => (
                <React.Fragment key={item.s}>
                    <div className={`step-item ${step >= item.s ? 'active' : ''} ${step > item.s ? 'completed' : ''}`}>
                        <div className="step-badge">
                            {step > item.s ? <Check size={16} /> : item.num}
                        </div>
                        <span className="step-label">{item.label}</span>
                    </div>
                    {idx === 0 && <div className="step-line" />}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div className="auth-container">
            {/* Right Section: Form Content */}
            <div className="auth-form-container" style={{ padding: '2rem 1.5rem', overflowY: 'auto' }}>
                <div className="main-card-v3" style={{ width: '100%', maxWidth: '800px', margin: 'auto' }}>
                    {step === 0 && (
                        <div className="member-check-v3">
                            <div className="check-header">
                                <ShieldCheck size={48} className="icon-main" />
                                <h2>Welcome to Dr. Indu Child Care</h2>
                                <p>Are you a registered patient or visiting for the first time?</p>
                            </div>

                            <div className="check-options">
                                {/* NEW PATIENT */}
                                <div className="choice-card" onClick={() => { setIsNewPatient(true); setError(null); setStep(1); }}>
                                    <div className="choice-icon new">
                                        <Plus size={24} />
                                    </div>
                                    <div className="choice-content">
                                        <h3>New Registration</h3>
                                        <p>First time visiting our clinic? Register your details and book an appointment.</p>

                                    </div>
                                    <ArrowRight size={20} className="arrow" />
                                </div>

                                {/* EXISTING PATIENT */}
                                <div className="choice-card existing" style={{ cursor: 'default' }}>
                                    <div className="choice-icon existing">
                                        <Users size={24} />
                                    </div>
                                    <div className="choice-content">
                                        <h3>Book Appointment</h3>
                                        <p>Have a patient record? Enter your registered mobile number to book instantly.</p>

                                        <div className="verify-input-wrap" onClick={e => e.stopPropagation()}>
                                            <div className="input-with-icon">
                                                <Smartphone size={16} className="input-icon" />
                                                <input
                                                    placeholder="Enter mobile number (e.g. 9876543210)"
                                                    value={searchWaId}
                                                    onChange={e => { setSearchWaId(e.target.value.replace(/\D/g, '')); setVerifyError(null); }}
                                                    onKeyDown={e => e.key === 'Enter' && checkMember(e)}
                                                />
                                            </div>
                                            <button
                                                className="btn-verify"
                                                onClick={checkMember}
                                                disabled={loading || !searchWaId}
                                            >
                                                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Book Appointment'}
                                            </button>
                                        </div>
                                        {verifyError && (
                                            <div className="inline-verify-error">
                                                <AlertCircle size={14} />
                                                <span>{verifyError}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* RESCHEDULE APPOINTMENT */}
                                <div className="choice-card reschedule" style={{ cursor: 'default' }}>
                                    <div className="choice-icon reschedule">
                                        <RefreshCw size={24} />
                                    </div>
                                    <div className="choice-content">
                                        <h3>Reschedule Appointment</h3>
                                        <p>Already have an appointment and need to change the time? Use your mobile to reschedule.</p>
                                        <div className="verify-input-wrap" onClick={e => e.stopPropagation()}>
                                            <div className="input-with-icon">
                                                <Smartphone size={16} className="input-icon" />
                                                <input
                                                    placeholder="Enter mobile number"
                                                    value={rescheduleWaId}
                                                    onChange={e => { setRescheduleWaId(e.target.value.replace(/\D/g, '')); setRescheduleError(null); }}
                                                    onKeyDown={e => e.key === 'Enter' && checkMember(e, 'reschedule')}
                                                />
                                            </div>
                                            <button
                                                className="btn-verify btn-reschedule"
                                                onClick={(e) => checkMember(e, 'reschedule')}
                                                disabled={loading || !rescheduleWaId}
                                            >
                                                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Reschedule Now'}
                                            </button>
                                        </div>
                                        {rescheduleError && (
                                            <div className="inline-verify-error">
                                                <AlertCircle size={14} />
                                                <span>{rescheduleError}</span>
                                            </div>
                                        )}
                                    </div>
                                    <ArrowRight size={20} className="arrow" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Top Back Nav (steps 1, 2, 3) ── */}
                    {step > 0 && (
                        <div className="top-back-nav">
                            <button
                                type="button"
                                className="top-back-btn"
                                onClick={() => {
                                    setError(null);
                                    if (step === 1) setStep(0);
                                    else if (step === 2) isNewPatient ? setStep(1) : setStep(0);
                                    else { setStep(0); setVerifyError(null); setSearchWaId(''); setRegisteredPatient(null); }
                                }}
                            >
                                <ArrowLeft size={18} />
                                <span>
                                    {step === 1 ? 'Back to Start'
                                        : step === 2 ? (isNewPatient ? 'Back to Registration' : 'Back to Start')
                                            : 'Start Over'}
                                </span>
                            </button>
                            {step < 3 && <span className="top-step-label">Step {step} of 2</span>}
                        </div>
                    )}

                    {step > 0 && step < 3 && renderProgress()}

                    {error && (
                        <div className="alert-v3 error">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleRegistration} className="premium-form">
                            {/* Section 1: Child Identification */}
                            <div className="form-section">
                                <div className="section-header">
                                    <div className="section-num">1</div>
                                    <h3>Child Identification</h3>
                                </div>
                                <div className="form-grid">
                                    <div className="field-group col-1">
                                        <label>Salut.</label>
                                        <select value={patientForm.salutation} onChange={e => setPatientForm({ ...patientForm, salutation: e.target.value })}>
                                            {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group col-3">
                                        <label>First Name *</label>
                                        <input required placeholder="Arjun" value={patientForm.first_name} onChange={e => setPatientForm({ ...patientForm, first_name: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Middle Name</label>
                                        <input placeholder="Rohit" value={patientForm.middle_name} onChange={e => setPatientForm({ ...patientForm, middle_name: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Last Name *</label>
                                        <input required placeholder="Sharma" value={patientForm.last_name} onChange={e => setPatientForm({ ...patientForm, last_name: e.target.value })} />
                                    </div>

                                    <div className="field-group col-2">
                                        <label>Gender *</label>
                                        <select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group col-4">
                                        <label>Date of Birth</label>
                                        <input type="date" value={patientForm.dob} onChange={e => {
                                            const dobVal = e.target.value;
                                            if (!dobVal) {
                                                setPatientForm({ ...patientForm, dob: '', age_years: '', age_months: '' });
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
                                            setPatientForm({ ...patientForm, dob: dobVal, age_years: Math.max(0, years).toString(), age_months: Math.max(0, months).toString() });
                                        }} />
                                    </div>

                                    <div className="field-group col-2">
                                        <label>Age (Years)</label>
                                        <input type="number" placeholder="3" value={patientForm.age_years} onChange={e => setPatientForm({ ...patientForm, age_years: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Age (Months)</label>
                                        <input type="number" placeholder="9" value={patientForm.age_months} onChange={e => setPatientForm({ ...patientForm, age_months: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Birth Time</label>
                                        <div className="time-input-group">
                                            <input type="number" placeholder="HH" value={patientForm.birth_time_hours} onChange={e => setPatientForm({ ...patientForm, birth_time_hours: e.target.value })} />
                                            <input type="number" placeholder="MM" value={patientForm.birth_time_minutes} onChange={e => setPatientForm({ ...patientForm, birth_time_minutes: e.target.value })} />
                                            <select value={patientForm.birth_time_ampm} onChange={e => setPatientForm({ ...patientForm, birth_time_ampm: e.target.value })}>
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Parental Hierarchy */}
                            <div className="form-section">
                                <div className="section-header">
                                    <div className="section-num">2</div>
                                    <h3>Parental Hierarchy</h3>
                                </div>
                                <div className="form-grid">
                                    <div className="field-group col-3">
                                        <label>Father's Name</label>
                                        <input placeholder="Rohit Sharma" value={patientForm.father_name} onChange={e => setPatientForm({ ...patientForm, father_name: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Father's Mobile</label>
                                        <input placeholder="9876543210" value={patientForm.father_mobile} onChange={e => setPatientForm({ ...patientForm, father_mobile: e.target.value.replace(/\D/g, '') })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Occupation</label>
                                        <input placeholder="Engineer" value={patientForm.father_occupation} onChange={e => setPatientForm({ ...patientForm, father_occupation: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Mother's Name</label>
                                        <input placeholder="Anjali Sharma" value={patientForm.mother_name} onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Mother's Mobile</label>
                                        <input placeholder="9876543211" value={patientForm.mother_mobile} onChange={e => setPatientForm({ ...patientForm, mother_mobile: e.target.value.replace(/\D/g, '') })} />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Location & Communication */}
                            <div className="form-section">
                                <div className="section-header">
                                    <div className="section-num">3</div>
                                    <h3>Location & Communication</h3>
                                </div>
                                <div className="form-grid">
                                    <div className="field-group col-2">
                                        <label>Area</label>
                                        <input placeholder="Bandra" value={patientForm.area} onChange={e => setPatientForm({ ...patientForm, area: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>City</label>
                                        <input value={patientForm.city} onChange={e => setPatientForm({ ...patientForm, city: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>State</label>
                                        <input value={patientForm.state} onChange={e => setPatientForm({ ...patientForm, state: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Pin Code</label>
                                        <input placeholder="400050" value={patientForm.pin_code} onChange={e => setPatientForm({ ...patientForm, pin_code: e.target.value })} />
                                    </div>
                                    <div className="field-group col-6">
                                        <label>Full Address</label>
                                        <textarea placeholder="Line 1, Line 2..." value={patientForm.full_address} onChange={e => setPatientForm({ ...patientForm, full_address: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>WhatsApp ID / Mobile *</label>
                                        <div className="input-icon-wrap">
                                            <Smartphone size={16} />
                                            <input
                                                required
                                                placeholder="9876543210"
                                                value={patientForm.wa_id}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setPatientForm({ ...patientForm, wa_id: val });
                                                    handleWaIdCheck(val);
                                                }}
                                            />
                                        </div>
                                        {waIdValidation.loading && <div className="field-hint" style={{ color: '#6366f1' }}>Checking registration...</div>}
                                        {waIdValidation.error && <div className="field-hint" style={{ color: '#ef4444', fontWeight: '600' }}>{waIdValidation.error}</div>}
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Comm. Preference</label>
                                        <select value={patientForm.comm_preference} onChange={e => setPatientForm({ ...patientForm, comm_preference: e.target.value })}>
                                            {COMM_PREFERENCES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Email Address</label>
                                        <div className="input-icon-wrap">
                                            <Mail size={16} />
                                            <input type="email" placeholder="parent@example.com" value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Preferred Doctor</label>
                                        <select value={patientForm.preferred_doctor} onChange={e => setPatientForm({ ...patientForm, preferred_doctor: e.target.value })}>
                                            {doctors.map(doc => <option key={doc._id} value={getDoctorDisplayName(doc)}>{getDoctorDisplayName(doc)}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Remarks / Notes</label>
                                        <input placeholder="High priority patient" value={patientForm.notes} onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Enrollment Option</label>
                                        <select value={patientForm.enrollment_option} onChange={e => setPatientForm({ ...patientForm, enrollment_option: e.target.value })}>
                                            {ENROLLMENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn-cancel" onClick={() => setStep(0)}>Go Back</button>
                                <button type="submit" disabled={loading || !!waIdValidation.error} className="btn-primary-v3">
                                    {loading ? <RefreshCw className="animate-spin" /> : <ShieldCheck size={20} />}
                                    Save
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleBooking} className="booking-form-v3">
                            <div className="selected-patient-v3">
                                <div className="p-banner">
                                    <div className="p-info">
                                        <div className="p-avatar-circle">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <div className="p-name-premium">{registeredPatient?.child_name}</div>
                                            <div className="p-id-premium">Patient ID: {registeredPatient?.patient_id}</div>
                                        </div>
                                    </div>
                                    <button type="button" className="modify-btn-v3" onClick={() => isNewPatient ? setStep(1) : setStep(0)}>
                                        <Edit2 size={14} />
                                        <span>{isNewPatient ? 'Edit Details' : 'Change Patient'}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="form-grid-v3">
                                <div className="field-v3">
                                    <span>Assign Clinician</span>
                                    <div className="input-with-icon">
                                        <Stethoscope size={18} className="input-icon" />
                                        <select
                                            value={bookingForm.doctor_name}
                                            onChange={e => setBookingForm({ ...bookingForm, doctor_name: e.target.value })}
                                            className="select-v3"
                                        >
                                            {doctors.map(doc => <option key={doc._id} value={getRawDoctorName(doc)}>{getDoctorDisplayName(doc)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="field-v3">
                                    <span>Visit Date</span>
                                    <div className="input-with-icon">
                                        <Calendar size={18} className="input-icon" />
                                        <input
                                            type="date"
                                            value={bookingForm.appointment_date}
                                            onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })}
                                            className="input-v3"
                                        />
                                    </div>
                                </div>

                                <div className="field-v3 full-span" style={{ marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <span className="label-v3">Available Time Slots</span>
                                        {slotsLoading && <RefreshCw size={14} className="animate-spin text-primary" />}
                                    </div>

                                    <div className="slot-grid-v3">
                                        {[...availableSlots]
                                            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                                            .map(slot => (
                                                <div
                                                    key={slot.slot_id}
                                                    className={`slot-pill-v3 ${bookingForm.slot_id === slot.slot_id ? 'active' : ''}`}
                                                    onClick={() => setBookingForm({ ...bookingForm, slot_id: slot.slot_id })}
                                                >
                                                    <div className="slot-time">{formatTime12h(slot.start_time)}</div>
                                                    <div className="slot-range">– {formatTime12h(slot.end_time)}</div>
                                                    <div className="slot-session">{slot.session}</div>
                                                </div>
                                            ))}
                                        {availableSlots.length === 0 && !slotsLoading && (
                                            <div className="no-slots-v3">
                                                <Clock size={18} />
                                                <span>No active slots found. Please check the date or doctor selection.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="field-v3">
                                    <span>Visit Category</span>
                                    <div className="input-with-icon">
                                        <Activity size={18} className="input-icon" />
                                        <select
                                            value={bookingForm.visit_type}
                                            onChange={e => setBookingForm({ ...bookingForm, visit_type: e.target.value })}
                                            className="select-v3"
                                        >
                                            <option value="CONSULTATION">Regular Consultation</option>
                                            <option value="FOLLOW_UP">Follow-up Visit</option>
                                            <option value="VACCINATION">Vaccination / Immunization</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="field-v3">
                                    <span>Clinical Reason</span>
                                    <div className="input-with-icon">
                                        <Clipboard size={18} className="input-icon" />
                                        <input
                                            placeholder="e.g. Fever, routine checkup..."
                                            value={bookingForm.reason}
                                            onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                                            className="input-v3"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-v3">
                                <button type="button" className="btn-outline-v3" style={{ flex: 1 }} onClick={() => isNewPatient ? setStep(1) : setStep(0)}>
                                    Back
                                </button>
                                <button type="submit" className="btn-primary-v3" style={{ flex: 2, padding: '1rem' }} disabled={loading}>
                                    {loading ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                                    <span>Save</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 4 && (
                        <div className="appointment-selection-v3">
                            <div className="selection-header">
                                <Calendar size={32} className="icon-header" />
                                <h2>Select Appointment to Reschedule</h2>
                                <p>We found {patientAppointments.length} upcoming appointments for {removeSalutation(registeredPatient?.child_name) || 'you'}.</p>
                            </div>

                            <div className="appointment-list">
                                {patientAppointments.map(appt => (
                                    <div key={appt._id} className="appt-select-card">
                                        <div className="appt-details">
                                            <div className="appt-meta">
                                                <span className="appt-date">
                                                    <Calendar size={14} /> {appt.appointment_date}
                                                </span>
                                                <span className="appt-time">
                                                    <Clock size={14} /> {formatTime12h(appt.slot_id?.start_time || appt.start_time)}
                                                </span>
                                            </div>
                                            <div className="appt-doctor">
                                                <Stethoscope size={16} />
                                                <span>{appt.doctor_name}</span>
                                            </div>
                                            {appt.reason && (
                                                <div className="appt-reason">
                                                    <FileText size={14} />
                                                    <span>{appt.reason}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className="btn-select-appt"
                                            onClick={() => {
                                                setSelectedAppointmentId(appt._id);
                                                setBookingForm(prev => ({
                                                    ...prev,
                                                    wa_id: appt.wa_id,
                                                    doctor_name: appt.doctor_name,
                                                    visit_type: appt.visit_type || 'CONSULTATION',
                                                    reason: appt.reason || '',
                                                    reschedule_from: appt._id // Carry forward the ID to let backend know it's a reschedule
                                                }));
                                                setStep(2);
                                            }}
                                        >
                                            <Edit2 size={16} />
                                            <span>Reschedule</span>
                                        </button>
                                    </div>
                                ))}

                                {patientAppointments.length === 0 && (
                                    <div className="no-appointments-found">
                                        <AlertCircle size={48} />
                                        <h3>No upcoming appointments found</h3>
                                        <p>You don't have any pending appointments to reschedule. Would you like to book a new one?</p>
                                        <button className="btn-primary-v3" onClick={() => setStep(0)}>Back to Home</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="success-view">
                            <div className="success-icon-wrap">
                                <Check size={48} />
                            </div>
                            <h2>Enrollment Complete</h2>
                            <p>Thank you. Your records have been synchronized with the clinical system. You will receive a confirmation on WhatsApp shortly.</p>
                            <div className="success-actions">
                                <button onClick={() => window.location.reload()} className="btn-primary-v3 wide">
                                    Register Another Patient
                                </button>
                                <button
                                    onClick={() => { setStep(0); setError(null); setVerifyError(null); setSearchWaId(''); setRegisteredPatient(null); setIsNewPatient(null); }}
                                    className="btn-success-back"
                                >
                                    <ArrowLeft size={16} /> Back to Home
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                * { box-sizing: border-box; }
                /* Top back nav */
                .top-back-nav {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 1.25rem; padding-bottom: 1rem;
                    border-bottom: 1.5px solid #f1f5f9;
                }
                .top-back-btn {
                    display: flex; align-items: center; gap: 0.5rem;
                    background: none; border: none; cursor: pointer;
                    color: #6366f1; font-weight: 700; font-size: 0.9rem;
                    padding: 0.5rem 0.75rem 0.5rem 0.5rem;
                    border-radius: 10px; transition: 0.2s;
                    min-height: 44px;
                }
                .top-back-btn:hover { background: #eef2ff; }
                .top-step-label {
                    font-size: 0.75rem; font-weight: 800;
                    color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase;
                }
                /* Success actions */
                .success-actions {
                    display: flex; flex-direction: column; align-items: center; gap: 0.85rem;
                }
                .btn-success-back {
                    display: flex; align-items: center; gap: 0.4rem;
                    background: none; border: none; cursor: pointer;
                    color: #64748b; font-weight: 700; font-size: 0.9rem;
                    padding: 0.5rem 1rem; border-radius: 10px; transition: 0.2s;
                }
                .btn-success-back:hover { background: #f1f5f9; color: #334155; }

                .public-reg-container {
                    min-height: 100vh;
                    background: #fdfdfe;
                    position: relative;
                    padding: 1rem 0.75rem 3rem;
                    font-family: 'Inter', sans-serif;
                }
                .gradient-bg {
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    height: 280px;
                    background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);
                    z-index: -1;
                }
                .content-wrapper { max-width: 900px; margin: 0 auto; }
                .page-header { display: flex; justify-content: center; margin-bottom: 1.25rem; }
                .logo-section { display: flex; align-items: center; gap: 0.75rem; }
                .logo-icon-wrap {
                    width: 100px; height: 100px; background: white;
                    border-radius: 24px; display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 12px 30px rgba(99,102,241,0.15); flex-shrink: 0;
                    padding: 4px; overflow: hidden;
                }
                .brand-name { font-size: 1.2rem; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; margin: 0; }
                .brand-tagline { font-size: 0.75rem; color: #64748b; font-weight: 600; margin: 0.1rem 0 0; }

                .main-card-v3 {
                    background: #fff; border-radius: 20px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 20px 60px -10px rgba(0,0,0,0.06);
                    padding: 1.25rem 1rem;
                }

                /* Step 0 */
                .member-check-v3 { text-align: center; }
                .check-header { margin-bottom: 1.75rem; }
                .check-header .icon-main { color: #6366f1; margin-bottom: 0.85rem; }
                .check-header h2 { font-size: 1.35rem; font-weight: 900; color: #0f172a; margin-bottom: 0.35rem; }
                .check-header p { color: #64748b; font-weight: 600; font-size: 0.875rem; margin: 0; }

                .check-options { display: flex; flex-direction: column; gap: 1rem; max-width: 580px; margin: 0 auto; }
                .choice-card {
                    display: flex; align-items: flex-start; gap: 0.85rem; padding: 1rem;
                    background: #f8fafc; border-radius: 16px; border: 2px solid #f1f5f9;
                    cursor: pointer; transition: 0.25s; text-align: left; position: relative;
                }
                .choice-card:hover { border-color: #6366f1; background: #fff; box-shadow: 0 10px 25px rgba(99,102,241,0.1); }
                .choice-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .choice-icon.new { background: #e0e7ff; color: #4338ca; }
                .choice-icon.existing { background: #fef2f2; color: #ef4444; }
                .choice-icon.reschedule { background: #f0fdf4; color: #10b981; }
                .choice-card.reschedule:hover { border-color: #10b981; box-shadow: 0 10px 25px rgba(16,185,129,0.1); }
                .btn-reschedule { background: #10b981 !important; }
                .btn-reschedule:hover { background: #059669 !important; }
                .choice-content { flex: 1; min-width: 0; }
                .choice-content h3 { font-size: 1rem; font-weight: 800; color: #1e293b; margin-bottom: 0.2rem; }
                .choice-content p { font-size: 0.82rem; color: #64748b; font-weight: 500; line-height: 1.45; margin: 0; }
                .choice-card .arrow { color: #cbd5e1; transition: 0.3s; flex-shrink: 0; }
                .choice-card:hover .arrow { color: #6366f1; transform: translateX(4px); }

                .verify-input-wrap { margin-top: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem; }
                .verify-input-wrap .input-with-icon { min-width: 0; }
                .verify-input-wrap .input-with-icon input { width: 100%; padding: 0.85rem 0.9rem 0.85rem 2.5rem; border-radius: 12px; font-size: 1rem; }
                .btn-verify {
                    background: #6366f1; color: #fff; border: none; border-radius: 12px;
                    padding: 0.9rem 1.5rem; font-weight: 800; font-size: 0.95rem;
                    cursor: pointer; transition: 0.2s; width: 100%; min-height: 50px;
                }
                .btn-verify:hover { background: #4f46e5; }
                .btn-verify:disabled { opacity: 0.6; cursor: not-allowed; }
                .inline-verify-error {
                    display: flex; align-items: flex-start; gap: 0.5rem;
                    margin-top: 0.6rem; padding: 0.65rem 0.9rem;
                    background: #fef2f2; border: 1px solid #fee2e2;
                    border-radius: 10px; color: #ef4444;
                    font-size: 0.8rem; font-weight: 600; line-height: 1.4; text-align: left;
                }

                /* Stepper */
                .stepper-v3 { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.75rem; }
                .step-item { display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; transition: 0.3s; }
                .step-item.active { color: #6366f1; }
                .step-item.completed { color: #10b981; }
                .step-badge { width: 28px; height: 28px; border-radius: 8px; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8rem; flex-shrink: 0; }
                .step-label { font-weight: 800; font-size: 0.72rem; }
                .step-line { width: 24px; height: 2px; background: #e2e8f0; }

                /* Alert */
                .alert-v3 { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border-radius: 14px; margin-bottom: 1.5rem; font-weight: 600; font-size: 0.875rem; }
                .alert-v3.error { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }

                /* Registration form */
                .form-section { margin-bottom: 2rem; }
                .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
                .section-num { width: 26px; height: 26px; background: #6366f1; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; flex-shrink: 0; }
                .section-header h3 { font-size: 1rem; font-weight: 800; color: #1e293b; margin: 0; }

                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem 0.7rem; }
                .field-group { display: flex; flex-direction: column; gap: 0.45rem; }
                .col-1 { grid-column: span 1; }
                .col-2, .col-3, .col-4, .col-6 { grid-column: span 2; }

                label { font-size: 0.68rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                input, select, textarea {
                    background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 12px;
                    padding: 0.8rem 0.9rem; font-size: 1rem; font-weight: 600; color: #0f172a;
                    outline: none; transition: 0.2s; width: 100%; box-sizing: border-box;
                    -webkit-appearance: none;
                }
                input:focus, select:focus, textarea:focus { border-color: #6366f1; background: #fff; }
                textarea { height: 90px; resize: none; }

                .time-input-group { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 0.4rem; }
                .input-icon-wrap { position: relative; }
                .input-icon-wrap svg { position: absolute; left: 0.9rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .input-icon-wrap input { padding-left: 2.5rem; width: 100%; }

                .form-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; }
                .btn-cancel { width: 100%; height: 52px; border-radius: 14px; border: 2px solid #f1f5f9; background: #fff; color: #64748b; font-weight: 800; font-size: 0.95rem; cursor: pointer; }
                .btn-primary-v3 {
                    width: 100%; height: 54px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff; border: none; border-radius: 16px; font-size: 1rem; font-weight: 800;
                    display: flex; align-items: center; justify-content: center; gap: 0.6rem;
                    box-shadow: 0 8px 20px rgba(99,102,241,0.3); cursor: pointer;
                }

                /* Booking step */
                .selected-patient-v3 { margin-bottom: 1.5rem; }
                .p-banner { background: #f8fafc; border-radius: 16px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; gap: 0.6rem; flex-wrap: wrap; }
                .p-info { display: flex; align-items: center; gap: 0.85rem; }
                .p-avatar-circle { width: 42px; height: 42px; background: #fff; color: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.06); flex-shrink: 0; }
                .p-name-premium { font-size: 0.95rem; font-weight: 900; color: #0f172a; }
                .p-id-premium { font-size: 0.75rem; color: #64748b; font-weight: 700; }
                .modify-btn-v3 { background: #fff; border: 1.5px solid #e2e8f0; padding: 0.45rem 0.85rem; border-radius: 9px; font-size: 0.78rem; font-weight: 800; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }

                .form-grid-v3 { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
                .field-v3 { display: flex; flex-direction: column; gap: 0.6rem; }
                .field-v3 span, .label-v3 { font-size: 0.7rem; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .input-with-icon { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6366f1; }
                .input-v3, .select-v3 { width: 100%; border: 2px solid #f1f5f9; border-radius: 14px; padding: 0.9rem 1rem 0.9rem 3.2rem; font-weight: 700; font-size: 1rem; outline: none; background: #fff; box-sizing: border-box; -webkit-appearance: none; }

                .slot-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
                .slot-pill-v3 { padding: 0.65rem 0.4rem; border-radius: 12px; border: 2px solid #e5e7eb; background: #fff; cursor: pointer; transition: 0.2s; text-align: center; min-height: 65px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .slot-pill-v3.active { border-color: #6366f1; background: #eef2ff; }
                .slot-time { font-size: 0.85rem; font-weight: 900; color: #1e293b; }
                .slot-range { font-size: 0.62rem; color: #64748b; font-weight: 600; margin-top: 0.1rem; }
                .slot-session { font-size: 0.56rem; font-weight: 900; color: #6366f1; background: #e0e7ff; padding: 0.1rem 0.35rem; border-radius: 4px; margin-top: 0.25rem; display: inline-block; }
                .no-slots-v3 { grid-column: 1 / -1; padding: 1.5rem; background: #fef2f2; color: #ef4444; border-radius: 14px; text-align: center; font-weight: 600; font-size: 0.875rem; }

                .modal-footer-v3 { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem; }
                .btn-outline-v3 { width: 100%; height: 50px; border-radius: 14px; border: 2px solid #f1f5f9; background: #fff; color: #64748b; font-weight: 800; cursor: pointer; }

                .success-view { text-align: center; padding: 1.5rem 0; }
                .success-icon-wrap { width: 64px; height: 64px; background: #f0fdf4; color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; }
                .success-view h2 { font-size: 1.35rem; font-weight: 900; color: #0f172a; margin-bottom: 0.75rem; }
                .success-view p { color: #64748b; font-size: 0.9rem; line-height: 1.65; margin-bottom: 2rem; }
                .btn-primary-v3.wide { width: 100%; max-width: 300px; margin: 0 auto; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* Tablet (600px+) */
/* Appointment Selection */
                .appointment-selection-v3 { animation: fadeIn 0.4s ease-out; }
                .selection-header { text-align: center; margin-bottom: 2rem; }
                .selection-header .icon-header { color: #6366f1; margin-bottom: 1rem; }
                .selection-header h2 { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; }
                .selection-header p { color: #64748b; font-weight: 500; }

                .appointment-list { display: flex; flex-direction: column; gap: 1rem; }
                .appt-select-card {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 1.25rem; background: #f8fafc; border: 2px solid #f1f5f9;
                    border-radius: 16px; transition: 0.2s;
                }
                .appt-select-card:hover { border-color: #6366f1; background: #fff; box-shadow: 0 10px 25px rgba(99,102,241,0.05); }
                
                .appt-details { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
                .appt-meta { display: flex; gap: 1rem; font-size: 0.85rem; font-weight: 700; color: #6366f1; }
                .appt-meta span { display: flex; align-items: center; gap: 0.35rem; }
                .appt-doctor { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: #1e293b; }
                .appt-reason { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #64748b; font-style: italic; }

                .btn-select-appt {
                    display: flex; align-items: center; gap: 0.5rem;
                    background: #6366f1; color: white; border: none;
                    padding: 0.75rem 1.25rem; border-radius: 12px;
                    font-weight: 700; font-size: 0.9rem; cursor: pointer;
                    transition: 0.2s;
                }
                .btn-select-appt:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }

                .no-appointments-found { 
                    text-align: center; padding: 3rem 1rem; background: #f8fafc; 
                    border-radius: 20px; border: 2px dashed #e2e8f0;
                }
                .no-appointments-found h3 { margin: 1.5rem 0 0.5rem; color: #1e293b; }
                .no-appointments-found p { color: #64748b; margin-bottom: 2rem; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                /* Mobile overrides for appt cards */
                @media (max-width: 600px) {
                    .appt-select-card { flex-direction: column; align-items: stretch; gap: 1.25rem; }
                    .btn-select-appt { justify-content: center; }
                }

                @media (min-width: 600px) {
                    .public-reg-container { padding: 2rem 1.25rem 3.5rem; }
                    .page-header { margin-bottom: 2.25rem; }
                    .logo-icon-wrap { width: 56px; height: 56px; border-radius: 18px; }
                    .logo-section { gap: 1rem; }
                    .brand-name { font-size: 1.65rem; }
                    .brand-tagline { font-size: 0.85rem; }
                    .main-card-v3 { padding: 2.5rem 2rem; border-radius: 28px; }
                    .check-header { margin-bottom: 2.5rem; }
                    .check-header h2 { font-size: 1.75rem; }
                    .check-header p { font-size: 1rem; }
                    .choice-card { padding: 1.5rem; gap: 1.25rem; border-radius: 20px; }
                    .choice-icon { width: 50px; height: 50px; }
                    .choice-content h3 { font-size: 1.15rem; }
                    .choice-content p { font-size: 0.9rem; }
                    .verify-input-wrap { flex-direction: row; }
                    .btn-verify { width: auto; padding: 0 1.5rem; }
                    .stepper-v3 { gap: 1rem; margin-bottom: 2.5rem; }
                    .step-label { font-size: 0.85rem; }
                    .step-line { width: 40px; }
                    .step-badge { width: 32px; height: 32px; border-radius: 10px; }
                    .form-grid { grid-template-columns: repeat(6, 1fr); gap: 1.25rem 1rem; }
                    .col-1 { grid-column: span 1; }
                    .col-2 { grid-column: span 2; }
                    .col-3 { grid-column: span 3; }
                    .col-4 { grid-column: span 4; }
                    .col-6 { grid-column: span 6; }
                    .form-actions { flex-direction: row; gap: 1.25rem; margin-top: 2.75rem; }
                    .btn-cancel { width: auto; flex: 1; height: 58px; border-radius: 16px; }
                    .btn-primary-v3 { width: auto; flex: 2; height: 58px; border-radius: 16px; font-size: 1.05rem; }
                    .form-grid-v3 { grid-template-columns: 1fr 1fr; gap: 1.75rem; }
                    .modal-footer-v3 { flex-direction: row; gap: 1.25rem; margin-top: 2.25rem; }
                    .btn-outline-v3 { width: auto; flex: 1; height: 54px; }
                    .slot-grid-v3 { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.65rem; }
                    .slot-pill-v3 { min-height: 72px; padding: 0.75rem 0.5rem; border-radius: 14px; }
                    .slot-time { font-size: 0.9rem; }
                }

                /* Desktop (900px+) */
                @media (min-width: 900px) {
                    .public-reg-container { padding: 3rem 1.5rem 4rem; }
                    .page-header { margin-bottom: 3.5rem; }
                    .logo-icon-wrap { width: 68px; height: 68px; border-radius: 22px; }
                    .logo-section { gap: 1.5rem; }
                    .brand-name { font-size: 2.1rem; }
                    .brand-tagline { font-size: 1rem; }
                    .main-card-v3 { padding: 3.5rem; border-radius: 36px; }
                    .check-header { margin-bottom: 3rem; }
                    .check-header h2 { font-size: 2rem; }
                    .check-header p { font-size: 1.1rem; }
                    .choice-card { padding: 2rem; gap: 1.5rem; border-radius: 22px; }
                    .choice-icon { width: 56px; height: 56px; }
                    .choice-content h3 { font-size: 1.25rem; }
                    .stepper-v3 { gap: 1.5rem; margin-bottom: 3.5rem; }
                    .step-label { font-size: 1rem; }
                    .step-line { width: 60px; }
                    .step-badge { width: 36px; height: 36px; border-radius: 12px; }
                    .form-section { margin-bottom: 3rem; }
                    .section-header { margin-bottom: 1.75rem; }
                    .form-grid { gap: 1.5rem 1.25rem; }
                    .form-actions { margin-top: 4rem; }
                    .btn-cancel { height: 60px; }
                    .btn-primary-v3 { height: 60px; font-size: 1.1rem; }
                    .modal-footer-v3 { margin-top: 3rem; }
                    .btn-outline-v3 { height: 56px; }
                    .slot-grid-v3 { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
                }
`}</style>
        </div>
    );
};

export default PublicRegister;
