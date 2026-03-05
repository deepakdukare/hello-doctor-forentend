import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Calendar, Phone, MapPin, FileText, CheckCircle,
    AlertCircle, Stethoscope, Baby, Users, Briefcase, Mail,
    Clock, Smartphone, MapPinned, ChevronRight, ChevronLeft,
    Check, RefreshCw, Activity, Clipboard, Edit2, Plus,
    ArrowRight, Map, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableSlots, getDoctors, getPatientByWa, getAppointmentsByWaId, updateAppointment } from '../api/index';

const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
const GENDERS = ['Male', 'Female', 'Other'];
const COMM_PREFERENCES = ['WhatsApp', 'SMS', 'Email', 'Phone Call'];
const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Enroll & Book Now' }
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
    const [regSubmitted, setRegSubmitted] = useState(false);

    // Step 1: Detailed Patient Data (Consolidated from Screenshot)
    const [patientForm, setPatientForm] = useState({
        salutation: 'Master',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'Male',
        dob: '',
        mother_name: '',
        father_name: '',
        father_mobile: '',
        mother_mobile: '',
        wa_id: '',
        email: '',
        address: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pin_code: '',
        comm_preference: 'WhatsApp',
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
    const todayStr = new Date().toISOString().split('T')[0];

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
        setRegSubmitted(true);
        if (!e.currentTarget.checkValidity()) {
            e.currentTarget.reportValidity();
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const matchedDoc = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor);
            const rawDocName = matchedDoc
                ? getRawDoctorName(matchedDoc)
                : (patientForm.preferred_doctor?.replace(/\s*\([^)]*\)\s*$/, '').trim() || patientForm.preferred_doctor);

            const backendSalutations = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Master', 'Miss'];
            const normalizedSalutation = backendSalutations.includes(patientForm.salutation)
                ? patientForm.salutation
                : (patientForm.salutation === 'Miss' || patientForm.salutation === 'Baby' && patientForm.gender === 'Female' ? 'Miss' : 'Master');

            const payload = {
                salutation: normalizedSalutation,
                first_name: patientForm.first_name,
                middle_name: patientForm.middle_name || null,
                last_name: patientForm.last_name,
                gender: patientForm.gender,
                dob: patientForm.dob,
                mother_name: patientForm.mother_name || null,
                father_name: patientForm.father_name || null,
                father_mobile: patientForm.father_mobile || null,
                mother_mobile: patientForm.mother_mobile || null,
                parent_mobile: patientForm.wa_id || patientForm.father_mobile || null,
                wa_id: patientForm.wa_id,
                email: patientForm.email || null,
                address: patientForm.address,
                city: patientForm.city,
                state: patientForm.state,
                pin_code: patientForm.pin_code,
                communication_preference: (patientForm.comm_preference || 'WhatsApp').toLowerCase(),
                doctor: rawDocName,
                remarks: patientForm.notes || null,
                registration_source: patientForm.registration_source,
                enrollment_option: patientForm.enrollment_option,
            };
            const res = await registerFromForm(payload);
            const patientData = res.data?.data;
            if (res.data?.is_already_registered && patientData) {
                setRegisteredPatient(patientData);
                const matchedDoc = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor);
                const rawDocName = matchedDoc
                    ? getRawDoctorName(matchedDoc)
                    : (patientForm.preferred_doctor?.replace(/\s*\([^)]*\)\s*$/, '').trim() || bookingForm.doctor_name);
                setBookingForm(prev => ({
                    ...prev,
                    wa_id: patientData.wa_id || patientForm.wa_id || patientForm.father_mobile,
                    doctor_name: rawDocName
                }));
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            if (patientData) {
                setRegisteredPatient(patientData);
                const matchedDoc = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor);
                const rawDocName = matchedDoc
                    ? getRawDoctorName(matchedDoc)
                    : (patientForm.preferred_doctor?.replace(/\s*\([^)]*\)\s*$/, '').trim() || bookingForm.doctor_name);
                setBookingForm(prev => ({
                    ...prev,
                    wa_id: patientData.wa_id || patientForm.wa_id || patientForm.father_mobile,
                    doctor_name: rawDocName
                }));
                setStep(2);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            if (err.response?.data?.is_already_registered && err.response?.data?.data) {
                const patientData = err.response.data.data;
                setRegisteredPatient(patientData);
                const matchedDoc = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor);
                const rawDocName = matchedDoc
                    ? getRawDoctorName(matchedDoc)
                    : (patientForm.preferred_doctor?.replace(/\s*\([^)]*\)\s*$/, '').trim() || bookingForm.doctor_name);
                setBookingForm(prev => ({
                    ...prev,
                    wa_id: patientData.wa_id || patientForm.wa_id || patientForm.father_mobile,
                    doctor_name: rawDocName
                }));
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (err.response?.data?.error_code === 'PATIENT_EXISTS' || String(errorMsg || '').toLowerCase().includes('already registered')) {
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
                { s: 1, label: 'Registration', num: 1 },
                { s: 2, label: 'Booking', num: 2 }
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
                        <form onSubmit={handleRegistration} className={`premium-form ${regSubmitted ? 'submitted' : ''}`}>
                            {/* Section 1: Child Identification */}
                            <div className="form-section">
                                <div className="section-header">
                                    <div className="section-num">1</div>
                                    <h3>Child Details</h3>
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
                                        <select required value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div className="field-group col-4">
                                        <label>Date of Birth</label>
                                        <input required type="date" max={todayStr} value={patientForm.dob} onChange={e => {
                                            const dobVal = e.target.value;
                                            if (!dobVal) {
                                                setPatientForm({ ...patientForm, dob: '' });
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
                                            setPatientForm({ ...patientForm, dob: dobVal });
                                        }} />
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
                                        <input placeholder="9876543210" pattern="[0-9]{10}" inputMode="numeric" maxLength={10} value={patientForm.father_mobile} onChange={e => setPatientForm({ ...patientForm, father_mobile: e.target.value.replace(/\D/g, '') })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Mother's Name</label>
                                        <input placeholder="Anjali Sharma" value={patientForm.mother_name} onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>Mother's Mobile</label>
                                        <input placeholder="9876543211" pattern="[0-9]{10}" inputMode="numeric" maxLength={10} value={patientForm.mother_mobile} onChange={e => setPatientForm({ ...patientForm, mother_mobile: e.target.value.replace(/\D/g, '') })} />
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
                                        <label>City</label>
                                        <input required value={patientForm.city} onChange={e => setPatientForm({ ...patientForm, city: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>State</label>
                                        <input required value={patientForm.state} onChange={e => setPatientForm({ ...patientForm, state: e.target.value })} />
                                    </div>
                                    <div className="field-group col-2">
                                        <label>Pin Code</label>
                                        <input
                                            required
                                            placeholder="400050"
                                            pattern="[0-9]{6}"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={patientForm.pin_code}
                                            onChange={e => setPatientForm({ ...patientForm, pin_code: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                    <div className="field-group col-6">
                                        <label>Address</label>
                                        <textarea required placeholder="Line 1, Line 2..." value={patientForm.address} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })} />
                                    </div>
                                    <div className="field-group col-3">
                                        <label>WhatsApp ID / Mobile *</label>
                                        <div className="input-icon-wrap">
                                            <Smartphone size={16} />
                                            <input
                                                required
                                                pattern="[0-9]{10}"
                                                inputMode="numeric"
                                                maxLength={10}
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
                                        <select required value={patientForm.preferred_doctor} onChange={e => setPatientForm({ ...patientForm, preferred_doctor: e.target.value })}>
                                            {doctors.map((doc, idx) => (
                                                <option key={doc._id || doc.doctor_id || doc.name || doc.full_name || idx} value={getDoctorDisplayName(doc)}>
                                                    {getDoctorDisplayName(doc)}
                                                </option>
                                            ))}
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
                                            {doctors.map((doc, idx) => (
                                                <option key={doc._id || doc.doctor_id || doc.name || doc.full_name || idx} value={getRawDoctorName(doc)}>
                                                    {getDoctorDisplayName(doc)}
                                                </option>
                                            ))}
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
                                            .map((slot, idx) => (
                                                <div
                                                    key={slot.slot_id || `${slot.start_time}-${slot.end_time}-${slot.session}-${idx}`}
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
                                <p>We found {patientAppointments.length} upcoming appointments for {registeredPatient?.child_name || 'you'}.</p>
                            </div>

                            <div className="appointment-list">
                                {patientAppointments.map((appt, idx) => (
                                    <div key={appt._id || appt.appointment_id || `${appt.wa_id}-${appt.appointment_date}-${idx}`} className="appt-select-card">
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
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                
                :root {
                    --primary: #6366f1;
                    --primary-dark: #4f46e5;
                    --primary-light: #eef2ff;
                    --secondary: #64748b;
                    --success: #10b981;
                    --warning: #f59e0b;
                    --danger: #ef4444;
                    --bg-page: #f8fafc;
                    --card-bg: #ffffff;
                    --text-main: #0f172a;
                    --text-muted: #64748b;
                    --border-color: #e2e8f0;
                    --radius-lg: 24px;
                    --radius-md: 16px;
                    --radius-sm: 12px;
                    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                }

                * { box-sizing: border-box; font-family: 'Outfit', 'Inter', sans-serif; }
                
                body { margin: 0; background-color: var(--bg-page); color: var(--text-main); }

                .auth-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center; justify-content: center;
                    background: radial-gradient(circle at top right, #eef2ff 0%, #f8fafc 100%);
                    padding: 1.5rem;
                }

                .auth-form-container {
                    width: 100%;
                    max-width: 850px;
                    margin: 0 auto;
                }

                .main-card-v3 {
                    background: var(--card-bg);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                    box-shadow: var(--shadow-xl);
                    padding: 2.5rem;
                    position: relative;
                    overflow: hidden;
                    animation: slideUp 0.5s ease-out;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Header & Logo */
                .check-header { text-align: center; margin-bottom: 2.5rem; }
                .icon-main { color: var(--primary); margin-bottom: 1rem; filter: drop-shadow(0 4px 6px rgba(99,102,241,0.2)); }
                .check-header h2 { font-size: 2rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem; letter-spacing: -0.02em; }
                .check-header p { font-size: 1.1rem; color: var(--text-muted); font-weight: 500; }

                /* Stepper */
                .stepper-v3 { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 3rem; }
                .step-item { display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); transition: 0.3s; }
                .step-item.active { color: var(--primary); }
                .step-item.completed { color: var(--success); }
                .step-badge { 
                    width: 36px; height: 36px; border-radius: 12px; 
                    border: 2px solid currentColor; display: flex; 
                    align-items: center; justify-content: center; 
                    font-weight: 800; font-size: 0.9rem; flex-shrink: 0;
                    background: var(--card-bg);
                }
                .step-label { font-weight: 700; font-size: 0.95rem; }
                .step-line { width: 50px; height: 2px; background: var(--border-color); border-radius: 2px; }

                /* Choice Cards */
                .check-options { display: flex; flex-direction: column; gap: 1.25rem; }
                .choice-card {
                    display: flex; align-items: flex-start; gap: 1.5rem; padding: 1.75rem;
                    background: var(--bg-page); border-radius: var(--radius-md); 
                    border: 2px solid transparent; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: left;
                }
                .choice-card:hover { 
                    border-color: var(--primary); background: var(--card-bg); 
                    transform: translateY(-4px); box-shadow: var(--shadow-lg); 
                }
                .choice-icon { 
                    width: 56px; height: 56px; border-radius: var(--radius-sm); 
                    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                    transition: 0.3s;
                }
                .choice-icon.new { background: #e0e7ff; color: var(--primary); }
                .choice-icon.existing { background: #fef2f2; color: var(--danger); }
                .choice-icon.reschedule { background: #f0fdf4; color: var(--success); }
                .choice-content h3 { font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.35rem; }
                .choice-content p { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; line-height: 1.5; margin: 0; }
                .choice-card .arrow { color: #cbd5e1; margin-left: auto; transition: 0.3s; }
                .choice-card:hover .arrow { color: var(--primary); transform: translateX(6px); }

                /* Forms */
                .form-section { margin-bottom: 2.5rem; background: #fff; border-radius: var(--radius-md); }
                .section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border-color); }
                .section-num { 
                    width: 32px; height: 32px; background: var(--primary); color: #fff; 
                    border-radius: 10px; display: flex; align-items: center; 
                    justify-content: center; font-size: 1rem; font-weight: 800;
                    box-shadow: 0 4px 10px rgba(99,102,241,0.3);
                }
                .section-header h3 { font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0; }

                .form-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.5rem 1.25rem; }
                .field-group { display: flex; flex-direction: column; gap: 0.6rem; }
                .col-1 { grid-column: span 1; }
                .col-2 { grid-column: span 2; }
                .col-3 { grid-column: span 3; }
                .col-4 { grid-column: span 4; }
                .col-6 { grid-column: span 6; }

                label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
                input, select, textarea {
                    background: var(--bg-page); border: 2px solid var(--border-color); border-radius: var(--radius-sm);
                    padding: 0.9rem 1.1rem; font-size: 1rem; font-weight: 600; color: var(--text-main);
                    outline: none; transition: all 0.2s; width: 100%;
                }
                input:focus, select:focus, textarea:focus { border-color: var(--primary); background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,0.08); }
                
                .input-with-icon { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--primary); }
                .input-with-icon input, .input-with-icon select { padding-left: 3rem; }

                .input-icon-wrap { position: relative; }
                .input-icon-wrap svg { position: absolute; left: 1.1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); size: 18px; }
                .input-icon-wrap input { padding-left: 3.2rem; }

                /* Buttons */
                .btn-primary-v3 {
                    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                    color: #fff; border: none; border-radius: var(--radius-md); 
                    padding: 1rem 2rem; font-size: 1.1rem; font-weight: 700;
                    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 8px 25px rgba(99,102,241,0.3);
                }
                .btn-primary-v3:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(99,102,241,0.4); }
                .btn-primary-v3:disabled { opacity: 0.6; cursor: not-allowed; }

                .btn-cancel {
                    background: #fff; border: 2px solid var(--border-color); border-radius: var(--radius-md);
                    padding: 1rem 2rem; font-size: 1.1rem; font-weight: 700; color: var(--text-muted);
                    cursor: pointer; transition: 0.2s;
                }
                .btn-cancel:hover { background: var(--bg-page); color: var(--text-main); border-color: var(--text-muted); }

                /* Top Back Nav */
                .top-back-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
                .top-back-btn {
                    display: flex; align-items: center; gap: 0.5rem; background: var(--primary-light);
                    border: none; border-radius: 12px; padding: 0.65rem 1.25rem; font-weight: 700;
                    color: var(--primary); cursor: pointer; transition: 0.3s;
                }
                .top-back-btn:hover { background: #e0e7ff; transform: translateX(-4px); }

                /* Booking Step Specifics */
                .p-banner { 
                    background: linear-gradient(to right, var(--primary-light), #fff); 
                    border-radius: var(--radius-md); padding: 1.5rem; 
                    display: flex; justify-content: space-between; align-items: center;
                    border: 1px solid var(--border-color); margin-bottom: 2.5rem;
                }
                .p-avatar-circle { 
                    width: 50px; height: 50px; background: #fff; color: var(--primary); 
                    border-radius: 15px; display: flex; align-items: center; 
                    justify-content: center; box-shadow: var(--shadow-md); 
                }
                .p-name-premium { font-size: 1.2rem; font-weight: 800; color: var(--text-main); }
                .p-id-premium { font-size: 0.9rem; font-weight: 600; color: var(--primary); }

                .slot-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.85rem; }
                .slot-pill-v3 {
                    padding: 1rem 0.5rem; border-radius: var(--radius-sm); border: 2px solid var(--border-color);
                    background: #fff; cursor: pointer; transition: all 0.2s; text-align: center;
                    display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
                }
                .slot-pill-v3:hover { border-color: var(--primary); transform: translateY(-2px); }
                .slot-pill-v3.active { border-color: var(--primary); background: var(--primary-light); box-shadow: 0 4px 12px rgba(99,102,241,0.15); }
                .slot-time { font-size: 1rem; font-weight: 800; color: var(--text-main); }
                .slot-session { font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase; background: #fff; padding: 2px 8px; border-radius: 6px; }

                /* Success View */
                .success-view { text-align: center; padding: 2rem 0; }
                .success-icon-wrap { 
                    width: 80px; height: 80px; background: #dcfce7; color: var(--success); 
                    border-radius: 24px; display: flex; align-items: center; 
                    justify-content: center; margin: 0 auto 2rem;
                    box-shadow: 0 10px 20px rgba(16,185,129,0.2);
                }

                /* Mobile Overrides */
                @media (max-width: 640px) {
                    .main-card-v3 { padding: 1.5rem; border-radius: var(--radius-md); }
                    .form-grid { grid-template-columns: 1fr; }
                    .col-1, .col-2, .col-3, .col-4, .col-6 { grid-column: span 1; }
                    .stepper-v3 { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .step-line { display: none; }
                    .btn-cancel, .btn-primary-v3 { width: 100%; }
                    .form-actions { flex-direction: column; }
                }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default PublicRegister;
