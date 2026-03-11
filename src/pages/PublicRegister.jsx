import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Calendar, Phone, MapPin, FileText, CheckCircle,
    AlertCircle, Stethoscope, Baby, Users, Briefcase, Mail,
    Clock, Smartphone, MapPinned, ChevronRight, ChevronLeft,
    Check, RefreshCw, Activity, Clipboard, Edit2, Plus, XCircle,
    ArrowRight, Map, ShieldCheck, ArrowLeft, Zap, Shield, ChevronDown, UserPlus, CalendarClock
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableTokens, getTokenConfig, getDoctors, getReferringDoctors, getPatientByWa, getPatientByEmail, getAppointmentsByWaId, updateAppointment } from '../api/index';
import '../glass-landing.css';

const SALUTATIONS = ['Baby', 'Baby of', 'Mr.', 'Mrs.', 'Ms.', 'Master', 'Miss', 'Dr.'];
const GENDERS = ['boy', 'girl'];
const COMM_PREFERENCES = ['WhatsApp', 'SMS', 'Email'];
const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Just Enroll' },
    { value: 'book_appointment', label: 'Enroll & Book Visit' }
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
    const [verifyError, setVerifyError] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [referringDoctors, setReferringDoctors] = useState([]);
    const [searchWaId, setSearchWaId] = useState('');
    const [rescheduleWaId, setRescheduleWaId] = useState('');
    const [rescheduleError, setRescheduleError] = useState(null);
    const [waIdValidation, setWaIdValidation] = useState({ loading: false, error: null });
    const [emailValidation, setEmailValidation] = useState({ loading: false, error: null });
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
    const [regSubmitted, setRegSubmitted] = useState(false);
    const [regErrors, setRegErrors] = useState({});

    const [patientForm, setPatientForm] = useState({
        salutation: 'Master',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'boy',
        dob: '',
        mother_name: '',
        father_name: '',
        wa_id: '',
        comm_preference: 'WhatsApp',
        preferred_doctor: '',
        notes: '',
        referred_by: '',
        enrollment_option: 'just_enroll',
        registration_source: 'form',
        email: '',
        state: 'Maharashtra',
        city: 'Mumbai',
        pincode: '',
        residential_address: ''
    });

    const [bookingForm, setBookingForm] = useState({
        wa_id: '',
        doctor_name: '',
        appointment_date: new Date().toISOString().split('T')[0],
        registration_type: 'online',
        doctor_speciality: 'Pediatrics',
        visit_category: 'First visit',
        appointment_mode: 'OFFLINE',
        reason: ''
    });

    const [availableTokens, setAvailableTokens] = useState(null);
    const [tokensLoading, setTokensLoading] = useState(false);
    const [registeredPatient, setRegisteredPatient] = useState(null);
    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [docRes, refRes] = await Promise.all([
                    getDoctors({ all: true }),
                    getReferringDoctors()
                ]);
                const docs = docRes.data.data || [];
                setDoctors(docs);
                setReferringDoctors(refRes.data.data || []);
                if (docs.length > 0) {
                    setPatientForm(prev => ({ ...prev, preferred_doctor: getDoctorDisplayName(docs[0]) }));
                    setBookingForm(prev => ({ ...prev, doctor_name: getRawDoctorName(docs[0]) }));
                }
            } catch (err) {
                console.error("Failed to fetch metadata", err);
            }
        };
        fetchMetadata();
    }, []);

    const fetchTokens = useCallback(async (doctorRef, date) => {
        if (!doctorRef || !date) return;
        setTokensLoading(true);
        try {
            // Find doctor id
            const doc = doctors.find(d => getRawDoctorName(d) === doctorRef || getDoctorDisplayName(d) === doctorRef);
            if (!doc) return;

            const [tokenRes, configRes] = await Promise.all([
                getAvailableTokens(doc.doctor_id, date),
                getTokenConfig(doc.doctor_id)
            ]);

            const tokens = tokenRes.data.data;
            const config = configRes.data.data;

            // Map day of week to our config key
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const selectedDay = days[new Date(date + 'T00:00:00').getDay()];
            const dayConfig = config?.weekly_config?.[selectedDay];

            if (dayConfig && dayConfig.is_active === false) {
                setAvailableTokens({ ...tokens, is_offline: true });
            } else {
                setAvailableTokens(tokens);
            }
        } catch (err) {
            console.error("Failed to fetch tokens", err);
            setAvailableTokens(null);
        } finally {
            setTokensLoading(false);
        }
    }, [doctors]);

    useEffect(() => {
        if (step === 2 && bookingForm.appointment_date) {
            fetchTokens(bookingForm.doctor_name, bookingForm.appointment_date);
        }
    }, [step, bookingForm.appointment_date, bookingForm.doctor_name, fetchTokens]);

    const checkMember = async (e, type = 'lookup') => {
        if (e) e.preventDefault();
        const rawId = type === 'lookup' ? searchWaId : rescheduleWaId;
        const targetId = rawId.trim();
        const setErrorFn = type === 'lookup' ? setVerifyError : setRescheduleError;

        if (!targetId || targetId.length < 10) {
            setErrorFn("Enter a valid 10-digit mobile number");
            return;
        }
        setLoading(true);
        setErrorFn(null);
        setError(null);

        try {
            if (type === 'reschedule') {
                const patientRes = await getPatientByWa(targetId);
                const patientData = patientRes.data.data;

                if (!patientData) {
                    setErrorFn("No patient record found");
                    setLoading(false);
                    return;
                }

                const apptsRes = await getAppointmentsByWaId(patientData.wa_id || targetId);
                const appointments = apptsRes.data.data || [];

                setRegisteredPatient(patientData);
                setIsNewPatient(false);
                // More robust filtering (case-insensitive)
                const pendingAppts = appointments.filter(a => {
                    const s = String(a.status || '').toUpperCase();
                    return s === 'PENDING' || s === 'CONFIRMED' || s === 'SCHEDULED';
                });
                setPatientAppointments(pendingAppts);
                setStep(4);
            } else {
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
                    setErrorFn("Record not found. Use New Registration.");
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            if (err.response?.status === 404) {
                setErrorFn("No record found for this number");
            } else {
                setErrorFn("Unable to verify. Please try again.");
            }
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
                    error: "Already registered. Use 'Book Appointment' above."
                });
            } else {
                setWaIdValidation({ loading: false, error: null });
            }
        } catch (err) {
            setWaIdValidation({ loading: false, error: null });
        }
    };

    const handleEmailCheck = async (val) => {
        if (!val || val.length < 5 || !val.includes('@')) {
            setEmailValidation({ loading: false, error: null });
            return;
        }
        setEmailValidation({ loading: true, error: null });
        try {
            const res = await getPatientByEmail(val.trim().toLowerCase());
            if (res.data.data) {
                setEmailValidation({
                    loading: false,
                    error: "Email already registered. Use 'Book Appointment' with mobile."
                });
            } else {
                setEmailValidation({ loading: false, error: null });
            }
        } catch (err) {
            setEmailValidation({ loading: false, error: null });
        }
    };

    const validateRegistration = () => {
        const errors = {};
        const nameRegex = /^[A-Za-z\s]+$/;
        const phoneRegex = /^\d{10}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!patientForm.first_name?.trim()) errors.first_name = "First Name is required";
        else if (!nameRegex.test(patientForm.first_name)) errors.first_name = "Letters only";

        if (!patientForm.last_name?.trim()) errors.last_name = "Last Name is required";
        else if (!nameRegex.test(patientForm.last_name)) errors.last_name = "Letters only";

        if (!patientForm.gender?.trim()) errors.gender = "Gender is required";
        if (!patientForm.dob?.trim()) errors.dob = "Date of Birth is required";

        if (!patientForm.father_name?.trim()) errors.father_name = "Father Name is required";


        if (!patientForm.mother_name?.trim()) errors.mother_name = "Mother Name is required";

        if (!patientForm.wa_id?.trim()) errors.wa_id = "Mobile Number is required";
        else if (!phoneRegex.test(patientForm.wa_id)) errors.wa_id = "10-digit numeric required";

        if (!patientForm.email?.trim()) {
            errors.email = "Email Address is required";
        } else if (!emailRegex.test(patientForm.email)) {
            errors.email = "Invalid email format";
        } else if (emailValidation.error) {
            errors.email = emailValidation.error;
        }

        if (!patientForm.preferred_doctor?.trim()) errors.preferred_doctor = "Doctor choice required";

        if (!patientForm.city?.trim()) errors.city = "City is required";
        if (!patientForm.pincode?.trim()) errors.pincode = "Pincode is required";
        else if (!/^\d{6}$/.test(patientForm.pincode)) errors.pincode = "6-digit pincode required";
        if (!patientForm.residential_address?.trim()) errors.residential_address = "Address is required";

        if (Object.keys(errors).length > 0) {
            setRegErrors(errors);
            // Scroll to first error
            const firstErrorKey = Object.keys(errors)[0];
            const el = document.getElementsByName(firstErrorKey)[0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return false;
        }

        setRegErrors({});
        return true;
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const nameRegex = /^[A-Za-z\s]+$/;
        const phoneRegex = /^\d{10}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        let error = null;
        if (['first_name', 'last_name', 'father_name', 'mother_name', 'wa_id', 'preferred_doctor', 'gender', 'dob', 'email'].includes(name) && !value.trim()) {
            const labelMap = { dob: 'Date of Birth', wa_id: 'Mobile Number', preferred_doctor: 'Preferred Doctor', email: 'Email Address' };
            const label = labelMap[name] || name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            error = `${label} is required`;
        } else if (name === 'first_name' || name === 'last_name') {
            if (!nameRegex.test(value)) error = "Letters only";
        } else if (name === 'wa_id') {
            if (value && !phoneRegex.test(value)) error = "10-digit numeric required";
        } else if (name === 'email') {
            if (value && !emailRegex.test(value)) error = "Invalid email format";
            else if (emailValidation.error) error = emailValidation.error;
        }

        setRegErrors(prev => {
            const newErrors = { ...prev };
            if (error) newErrors[name] = error;
            else delete newErrors[name];
            return newErrors;
        });
    };

    const handleRegistration = async (e) => {
        if (e) e.preventDefault();
        setRegSubmitted(true);
        setError(null);

        if (!validateRegistration()) return;

        setLoading(true);
        try {
            const matchedDoc = doctors.find(d => getDoctorDisplayName(d) === patientForm.preferred_doctor);
            const rawDocName = matchedDoc ? getRawDoctorName(matchedDoc) : patientForm.preferred_doctor;

            const payload = {
                salutation: patientForm.salutation,
                first_name: patientForm.first_name,
                middle_name: patientForm.middle_name || null,
                last_name: patientForm.last_name,
                gender: patientForm.gender,
                dob: patientForm.dob,
                mother_name: patientForm.mother_name || null,
                father_name: patientForm.father_name || null,
                communication_preference: patientForm.comm_preference.toLowerCase(),
                doctor: rawDocName,
                remarks: patientForm.notes || null,
                registration_source: patientForm.registration_source,
                enrollment_option: patientForm.enrollment_option,
                wa_id: patientForm.wa_id,
                state: patientForm.state,
                city: patientForm.city,
                pincode: patientForm.pincode,
                residential_address: patientForm.residential_address,
            };

            if (patientForm.email?.trim()) {
                payload.email = patientForm.email.trim();
            }

            const res = await registerFromForm(payload);
            const patientData = res.data?.data;
            if (patientData) {
                setRegisteredPatient(patientData);
                if (patientForm.enrollment_option === 'just_enroll') {
                    setStep(3);
                } else {
                    setBookingForm(prev => ({
                        ...prev,
                        wa_id: patientData.wa_id,
                        doctor_name: rawDocName
                    }));
                    setStep(2);
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed. Please check all fields.");
        } finally {
            setLoading(false);
        }
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (bookingForm.reschedule_from) {
                const reschedulePayload = {
                    appointment_date: bookingForm.appointment_date,
                    appointment_mode: bookingForm.appointment_mode,
                    doctor_name: bookingForm.doctor_name,
                    visit_category: bookingForm.visit_category,
                    reason: bookingForm.reason
                };
                await updateAppointment(bookingForm.reschedule_from, reschedulePayload);
            } else {
                const isToday = bookingForm.appointment_date === todayStr;
                let res;
                res = await bookByForm({
                    ...bookingForm,
                    visit_category: bookingForm.visit_category,
                    registration_type: 'online'
                });
                if (res?.data?.data) {
                    setRegisteredPatient(res.data.data);
                }
            }
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Booking detailed error:", err.response?.data || err);
            const serverMsg = (err.response?.data?.message || err.response?.data?.error || err.response?.data?.details);
            setError(serverMsg || "Booking failed. The daily token capacity might have been reached for this date.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {step === 0 ? (
                <div className="glass-landing-container">
                    <div className="glass-content-wrapper">

                        {/* Left Side: Hero Text */}
                        <div className="glass-hero-section">
                            <h1 className="glass-hero-title">
                                Dr. Indu's<br />
                                New Born &<br />
                                Childcare<br />
                                Center
                            </h1>
                            <p className="glass-hero-subtitle">
                                Welcome to a smarter way to manage your child's health.
                                Our modern portal gives you direct access to premium care,
                                scheduling, and medical records.
                            </p>
                            <button className="glass-hero-btn" onClick={() => { setIsNewPatient(true); setStep(1); }}>
                                Register Now
                            </button>
                        </div>

                        {/* Right Side: Action Cards */}
                        <div className="glass-cards-container">

                            {/* Card 1: New Registration */}
                            <div className="glass-card">
                                <div className="glass-card-icon">
                                    <UserPlus />
                                </div>
                                <h3 className="glass-card-title">New Registration</h3>
                                <p className="glass-card-desc">
                                    Start your journey with us. Fill out your details once and gain access to our full suite of medical services.
                                </p>
                                <button className="glass-btn-full" onClick={() => { setIsNewPatient(true); setStep(1); }}>
                                    Register Now
                                </button>
                            </div>

                            {/* Card 2: Book Appointment */}
                            <div className="glass-card">
                                <div className="glass-card-icon">
                                    <Calendar />
                                </div>
                                <h3 className="glass-card-title">Book Appointment</h3>
                                <p className="glass-card-desc">
                                    Have a patient record? Enter mobile number to book instantly.
                                </p>
                                <div className="glass-input-wrapper">
                                    <input
                                        className="glass-input"
                                        placeholder="Mobile Number"
                                        value={searchWaId}
                                        onChange={e => setSearchWaId(e.target.value.replace(/\D/g, ''))}
                                        onKeyDown={e => e.key === 'Enter' && checkMember(e)}
                                    />
                                </div>
                                {verifyError && <div className="error-text-glass">{verifyError}</div>}
                                <button className="glass-btn-full" onClick={checkMember} disabled={loading || !searchWaId}>
                                    {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Schedule Now'}
                                </button>
                            </div>

                            {/* Card 3: Modify Visit */}
                            <div className="glass-card">
                                <div className="glass-card-icon">
                                    <CalendarClock />
                                </div>
                                <h3 className="glass-card-title">Modify Visit</h3>
                                <p className="glass-card-desc">
                                    Need to change your time? Access your existing booking with your mobile number to reschedule.
                                </p>
                                <div className="glass-input-wrapper">
                                    <input
                                        className="glass-input"
                                        placeholder="Mobile Number"
                                        value={rescheduleWaId}
                                        onChange={e => setRescheduleWaId(e.target.value.replace(/\D/g, ''))}
                                        onKeyDown={e => e.key === 'Enter' && checkMember(e, 'reschedule')}
                                    />
                                </div>
                                {rescheduleError && <div className="error-text-glass">{rescheduleError}</div>}
                                <button className="glass-btn-full" onClick={e => checkMember(e, 'reschedule')} disabled={loading || !rescheduleWaId}>
                                    {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Manage Booking'}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            ) : (
                <div className="landing-premium">
                    <div className="landing-background">
                        <div className="blob blob-1"></div>
                        <div className="blob blob-2"></div>
                        <div className="blob blob-3"></div>
                    </div>

                    <div className="landing-content">
                        <div className="main-stage-v4">
                            {step > 0 && (
                                <div className="step-container-v4">
                                    {step === 1 && (
                                        <form onSubmit={handleRegistration} className="reg-form-clean">
                                            {/* Unified Header inside Form */}
                                            <div className="reg-unified-header">
                                                <button type="button" className="btn-back-v4" onClick={() => {
                                                    if (step === 3) window.location.reload();
                                                    else if (step === 1) setStep(0);
                                                    else if (step === 2) isNewPatient ? setStep(1) : setStep(0);
                                                    else setStep(0);
                                                }}>
                                                    <ArrowLeft size={20} />
                                                    <span>Back</span>
                                                </button>

                                                <div className="logo-box mini">
                                                    <img src="/logo.jpg" alt="DICC" />
                                                    <div className="logo-text">
                                                        <span className="brand">Dr. Indu's</span>
                                                        <span className="sub">New Born &<br />Childcare<br />Center</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {error && <div className="global-alert-v4 error"><AlertCircle size={20} /> {error}</div>}

                                            {/* â”€â”€ Child Identification â”€â”€ */}
                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Child Identification</h2>

                                                {/* Gender Picker */}
                                                <div className="reg-gender-row">
                                                    <button
                                                        type="button"
                                                        className={`reg-gender-card ${patientForm.gender === 'boy' ? 'selected' : ''}`}
                                                        onClick={() => setPatientForm({ ...patientForm, gender: 'boy', salutation: 'Baby' })}
                                                    >
                                                        <div className="reg-gender-avatar">
                                                            <img src="/boy_avatar.png" alt="Boy" />
                                                        </div>
                                                        <span className="reg-gender-label">Boy</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`reg-gender-card ${patientForm.gender === 'girl' ? 'selected' : ''}`}
                                                        onClick={() => setPatientForm({ ...patientForm, gender: 'girl', salutation: 'Baby' })}
                                                    >
                                                        <div className="reg-gender-avatar">
                                                            <img src="/girl_avatar.png" alt="Girl" />
                                                        </div>
                                                        <span className="reg-gender-label">Girl</span>
                                                    </button>
                                                </div>
                                                {regErrors.gender && <p className="reg-err">{regErrors.gender}</p>}

                                                <div className="reg-grid-2">
                                                    <div className="reg-field">
                                                        <label className="reg-label">Salutation</label>
                                                        <div className="reg-select-wrap">
                                                            <select
                                                                className="reg-select"
                                                                name="salutation"
                                                                value={patientForm.salutation}
                                                                onChange={e => setPatientForm({ ...patientForm, salutation: e.target.value })}
                                                            >
                                                                {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            <ChevronDown size={16} className="reg-select-icon" />
                                                        </div>
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">First Name *</label>
                                                        <input
                                                            className={`reg-input ${regErrors.first_name ? 'has-error' : ''}`}
                                                            name="first_name"
                                                            placeholder="Arjun"
                                                            value={patientForm.first_name}
                                                            onBlur={handleBlur}
                                                            onChange={e => setPatientForm({ ...patientForm, first_name: e.target.value })}
                                                        />
                                                        {regErrors.first_name && <p className="reg-err">{regErrors.first_name}</p>}
                                                    </div>
                                                </div>

                                                <div className="reg-grid-2">
                                                    <div className="reg-field">
                                                        <label className="reg-label">Middle Name</label>
                                                        <input
                                                            className="reg-input"
                                                            name="middle_name"
                                                            placeholder="Rohit"
                                                            value={patientForm.middle_name}
                                                            onChange={e => setPatientForm({ ...patientForm, middle_name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">Last Name *</label>
                                                        <input
                                                            className={`reg-input ${regErrors.last_name ? 'has-error' : ''}`}
                                                            name="last_name"
                                                            placeholder="Sharma"
                                                            value={patientForm.last_name}
                                                            onBlur={handleBlur}
                                                            onChange={e => setPatientForm({ ...patientForm, last_name: e.target.value })}
                                                        />
                                                        {regErrors.last_name && <p className="reg-err">{regErrors.last_name}</p>}
                                                    </div>
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Date of Birth *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.dob ? 'has-error' : ''}`}
                                                        name="dob"
                                                        type="date"
                                                        placeholder="dd-mm-yyyy"
                                                        max={todayStr}
                                                        value={patientForm.dob}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, dob: e.target.value })}
                                                    />
                                                    {regErrors.dob && <p className="reg-err">{regErrors.dob}</p>}
                                                </div>
                                            </div>

                                            {/* â”€â”€ Parental Details â”€â”€ */}
                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Parental Details</h2>

                                                <div className="reg-field">
                                                    <label className="reg-label">Father's Name *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.father_name ? 'has-error' : ''}`}
                                                        name="father_name"
                                                        placeholder="Father's Name"
                                                        value={patientForm.father_name}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, father_name: e.target.value })}
                                                    />
                                                    {regErrors.father_name && <p className="reg-err">{regErrors.father_name}</p>}
                                                </div>


                                                <div className="reg-field">
                                                    <label className="reg-label">Mother's Name *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.mother_name ? 'has-error' : ''}`}
                                                        name="mother_name"
                                                        placeholder="Full Name"
                                                        value={patientForm.mother_name}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })}
                                                    />
                                                    {regErrors.mother_name && <p className="reg-err">{regErrors.mother_name}</p>}
                                                </div>

                                            </div>

                                            {/* â”€â”€ Contact & Location â”€â”€ */}
                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Contact &amp; Location</h2>

                                                <div className="reg-field">
                                                    <label className="reg-label">Mobile Number *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.wa_id || waIdValidation.error ? 'has-error' : ''}`}
                                                        name="wa_id"
                                                        placeholder="9545651222"
                                                        value={patientForm.wa_id}
                                                        onBlur={handleBlur}
                                                        onChange={e => {
                                                            const v = e.target.value.replace(/\D/g, '');
                                                            setPatientForm({ ...patientForm, wa_id: v });
                                                            handleWaIdCheck(v);
                                                        }}
                                                    />
                                                    {regErrors.wa_id && <p className="reg-err">{regErrors.wa_id}</p>}
                                                    {waIdValidation.error && <p className="reg-err">{waIdValidation.error}</p>}
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Communication Pref.</label>
                                                    <div className="reg-select-wrap">
                                                        <select
                                                            className="reg-select"
                                                            name="comm_preference"
                                                            value={patientForm.comm_preference}
                                                            onChange={e => setPatientForm({ ...patientForm, comm_preference: e.target.value })}
                                                        >
                                                            {COMM_PREFERENCES.map(p => <option key={p} value={p}>{p}</option>)}
                                                        </select>
                                                        <ChevronDown size={16} className="reg-select-icon" />
                                                    </div>
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Email Address *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.email || emailValidation.error ? 'has-error' : ''}`}
                                                        name="email"
                                                        type="email"
                                                        placeholder="parents@gmail.com"
                                                        value={patientForm.email}
                                                        onBlur={handleBlur}
                                                        onChange={e => {
                                                            setPatientForm({ ...patientForm, email: e.target.value });
                                                            handleEmailCheck(e.target.value);
                                                        }}
                                                    />
                                                    {regErrors.email && <p className="reg-err">{regErrors.email}</p>}
                                                    {emailValidation.error && <p className="reg-err">{emailValidation.error}</p>}
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Referred by Patient</label>
                                                    <input
                                                        className="reg-input"
                                                        name="referred_by"
                                                        placeholder="Friend or family name"
                                                        value={patientForm.referred_by}
                                                        onChange={e => setPatientForm({ ...patientForm, referred_by: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* â”€â”€ Address Details â”€â”€ */}
                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Address Details</h2>

                                                <div className="reg-grid-2">
                                                    <div className="reg-field">
                                                        <label className="reg-label">State</label>
                                                        <input
                                                            className="reg-input"
                                                            name="state"
                                                            placeholder="State"
                                                            value={patientForm.state}
                                                            onChange={e => setPatientForm({ ...patientForm, state: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">City *</label>
                                                        <input
                                                            className={`reg-input ${regErrors.city ? 'has-error' : ''}`}
                                                            name="city"
                                                            placeholder="City"
                                                            value={patientForm.city}
                                                            onBlur={handleBlur}
                                                            onChange={e => setPatientForm({ ...patientForm, city: e.target.value })}
                                                        />
                                                        {regErrors.city && <p className="reg-err">{regErrors.city}</p>}
                                                    </div>
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Pincode *</label>
                                                    <input
                                                        className={`reg-input ${regErrors.pincode ? 'has-error' : ''}`}
                                                        name="pincode"
                                                        placeholder="400001"
                                                        value={patientForm.pincode}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, pincode: e.target.value.replace(/\D/g, '') })}
                                                    />
                                                    {regErrors.pincode && <p className="reg-err">{regErrors.pincode}</p>}
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Residential Address *</label>
                                                    <textarea
                                                        className={`reg-input reg-textarea ${regErrors.residential_address ? 'has-error' : ''}`}
                                                        name="residential_address"
                                                        placeholder="House No, Building, Area"
                                                        value={patientForm.residential_address}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, residential_address: e.target.value })}
                                                    />
                                                    {regErrors.residential_address && <p className="reg-err">{regErrors.residential_address}</p>}
                                                </div>
                                            </div>

                                            {/* â”€â”€ Preferred Doctor â”€â”€ */}
                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Preferred Doctor *</h2>
                                                <div className="reg-doctor-grid">
                                                    {doctors.map((d, idx) => {
                                                        const displayName = getDoctorDisplayName(d);
                                                        const isSelected = patientForm.preferred_doctor === displayName;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={d._id || d.doctor_id || `doc-${idx}`}
                                                                className={`reg-doctor-card ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => setPatientForm({ ...patientForm, preferred_doctor: displayName })}
                                                            >
                                                                <div className="reg-doctor-avatar">
                                                                    {d.photo_url || d.profile_image
                                                                        ? <img src={d.photo_url || d.profile_image} alt={displayName} />
                                                                        : <span className="reg-doctor-initials">{displayName.charAt(0)}</span>
                                                                    }
                                                                </div>
                                                                <span className="reg-doctor-name">{displayName}</span>
                                                                <span className="reg-doctor-spec">Pediatrics</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {regErrors.preferred_doctor && <p className="reg-err">{regErrors.preferred_doctor}</p>}
                                            </div>

                                            {/* â”€â”€ Remarks & Enrollment â”€â”€ */}
                                            <div className="reg-section">
                                                <div className="reg-field">
                                                    <label className="reg-label">Remarks / Notes</label>
                                                    <input
                                                        className="reg-input"
                                                        name="notes"
                                                        placeholder="Optional extra info"
                                                        value={patientForm.notes}
                                                        onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })}
                                                    />
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Enrollment Option</label>
                                                    <div className="reg-select-wrap">
                                                        <select
                                                            className="reg-select"
                                                            name="enrollment_option"
                                                            value={patientForm.enrollment_option}
                                                            onChange={e => setPatientForm({ ...patientForm, enrollment_option: e.target.value })}
                                                        >
                                                            {ENROLLMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                        <ChevronDown size={16} className="reg-select-icon" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* â”€â”€ Submit â”€â”€ */}
                                            <div className="reg-submit-bar">
                                                <button type="submit" disabled={loading} className="reg-submit-btn">
                                                    {loading
                                                        ? <RefreshCw className="animate-spin" size={20} />
                                                        : <><span>Start Booking</span><ArrowRight size={20} /></>
                                                    }
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 2 && (
                                        <form onSubmit={handleBooking} className="booking-stage-v4">
                                            <div className="booking-summary-v4">
                                                <div className="p-badge-v4">
                                                    <div className="p-avatar-v4"><User size={24} /></div>
                                                    <div className="p-meta-v4">
                                                        <strong>{registeredPatient?.child_name || patientForm.first_name}</strong>
                                                        <span>{registeredPatient?.patient_id || 'New Patient'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="booking-grid-v4">
                                                <div className="f-group-v4 col-2">
                                                    <label>Select Clinician</label>
                                                    <div className="sel-wrap-v4">
                                                        <select
                                                            value={bookingForm.doctor_name}
                                                            onChange={e => setBookingForm({ ...bookingForm, doctor_name: e.target.value })}
                                                        >
                                                            {doctors.map((d, idx) => (
                                                                <option key={d._id || d.doctor_id || `book-doc-${idx}`} value={getRawDoctorName(d)}>
                                                                    {getDoctorDisplayName(d)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown size={18} className="arrow-v4" />
                                                    </div>
                                                </div>
                                                <div className="f-group-v4 col-2">
                                                    <label>Appointment Date</label>
                                                    <input type="date" min={todayStr} value={bookingForm.appointment_date} onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })} />
                                                </div>

                                                <div className="f-group-v4 col-full">
                                                    <div className="token-info-v4 card-premium-v3">
                                                        <div className="token-header-v4">
                                                            <h3>Clinic Queue Status</h3>
                                                            {tokensLoading && <RefreshCw size={18} className="animate-spin text-primary" />}
                                                        </div>

                                                        {availableTokens ? (
                                                            availableTokens.is_offline ? (
                                                                <div className="token-display-v4">
                                                                    <div className="token-instruction-v4 error" style={{ padding: '1.25rem', background: '#fff1f2', border: '1px solid #fecaca' }}>
                                                                        <AlertCircle className="text-danger" size={20} />
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            <strong style={{ color: '#e11d48' }}>Doctor is OFF Today</strong>
                                                                            <span style={{ fontSize: '0.85rem', color: '#be123c' }}>Not available due to weekly schedule.</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="token-display-v4">
                                                                    <div className="token-card-v4 large">
                                                                        <div className="token-count-v4">#{availableTokens.online_next_token ?? '--'}</div>
                                                                        <div className="token-label-v4">Next Available Token</div>
                                                                        <div className="token-sub-v4">For {new Date(bookingForm.appointment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                                                                        <div className="token-sub-v4">Tokens Available Online for this date</div>
                                                                    </div>

                                                                    {availableTokens.online_tokens_remaining > 0 ? (
                                                                        <div className="token-instruction-v4">
                                                                            <CheckCircle className="text-success" size={20} />
                                                                            <span>
                                                                                Confirmed: Tokens available for today/selected date.
                                                                                Your next token is {availableTokens.online_next_token ?? '--'} and the exact token will be assigned upon confirmation.
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="token-instruction-v4 error">
                                                                            <AlertCircle className="text-danger" size={20} />
                                                                            <span>Online tokens are not available for this date. Please <strong>try for another doctor</strong> or <strong>try for next days</strong>.</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="token-info-mini-v4" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                                        <Clock size={16} />
                                                                        <span>Start Time: {availableTokens.start_time || '--:--'}</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="token-placeholder-v4">
                                                                <Activity size={24} />
                                                                <p>Checking live clinic availability...</p>
                                                            </div>
                                                        )}

                                                        <div className="emergency-alert-v4">
                                                            <div className="alert-content">
                                                                <strong>Emergency?</strong>
                                                                <p>If this is an emergency, please get an urgent appointment immediately by calling:</p>
                                                                <p style={{ marginTop: '0.4rem', fontWeight: 700 }}>
                                                                    Main Line: 022-46057766<br />
                                                                    Alternate: 022-46054411<br />
                                                                    Mobile: 8779398681
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="f-group-v4 col-2">
                                                    <label>Visit Category</label>
                                                    <div className="sel-wrap-v4">
                                                        <select value={bookingForm.visit_category} onChange={e => setBookingForm({ ...bookingForm, visit_category: e.target.value })}>
                                                            <option value="First visit">First visit</option>
                                                            <option value="Follow-up">Follow-up</option>
                                                            <option value="Vaccination">Vaccination</option>
                                                            <option value="Other">Other</option>
                                                        </select>
                                                        <ChevronDown size={18} className="arrow-v4" />
                                                    </div>
                                                </div>
                                                <div className="f-group-v4 col-2">
                                                    <label>Appointment Mode</label>
                                                    <div className="sel-wrap-v4">
                                                        <select value={bookingForm.appointment_mode} onChange={e => setBookingForm({ ...bookingForm, appointment_mode: e.target.value })}>
                                                            <option value="OFFLINE">Clinic Visit (Offline)</option>
                                                            <option value="ONLINE">Online Consultation</option>
                                                        </select>
                                                        <ChevronDown size={18} className="arrow-v4" />
                                                    </div>
                                                </div>
                                                <div className="f-group-v4 col-full">
                                                    <label>Reason (Optional)</label>
                                                    <input placeholder="" value={bookingForm.reason} onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="form-footer-v4">
                                                <button
                                                    type="submit"
                                                    disabled={loading || (availableTokens && (availableTokens.is_offline || availableTokens.online_tokens_remaining <= 0))}
                                                    className="btn-main-v4"
                                                >
                                                    {loading ? <RefreshCw className="animate-spin" /> : (
                                                        availableTokens && availableTokens.is_offline ? (
                                                            <><span>Doctor Offline</span> <XCircle size={20} /></>
                                                        ) : availableTokens && availableTokens.online_tokens_remaining <= 0 ? (
                                                            <><span>Fully Booked</span> <AlertCircle size={20} /></>
                                                        ) : (
                                                            <><span>Complete Booking</span> <CheckCircle size={20} /></>
                                                        )
                                                    )}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 4 && (
                                        <div className="reschedule-panel-v4">
                                            <div className="reschedule-header-v4">
                                                <button type="button" className="btn-back-v4" onClick={() => setStep(0)}>
                                                    <ArrowLeft size={20} />
                                                    <span>Home</span>
                                                </button>
                                                <div className="pan-header">
                                                    <h2>Reschedule Appointment</h2>
                                                    <p>Select an ongoing appointment to modify</p>
                                                </div>
                                            </div>
                                            <div className="appt-list-v4">
                                                {patientAppointments.length > 0 ? patientAppointments.map(appt => (
                                                    <div key={appt._id} className="appt-card-v4">
                                                        <div className="appt-info-v4">
                                                            <div className="a-date-wrap">
                                                                <Calendar size={18} className="a-icon" />
                                                                <strong>{new Date(appt.appointment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                                                            </div>
                                                            <div className="a-meta-wrap">
                                                                <span>{formatTime12h(appt.start_time)} Ã¢â‚¬Â¢ {appt.doctor_name}</span>
                                                            </div>
                                                        </div>
                                                        <button className="btn-reschedule-v4" onClick={() => {
                                                            setBookingForm({
                                                                ...bookingForm,
                                                                wa_id: appt.wa_id,
                                                                doctor_name: appt.doctor_name,
                                                                appointment_date: appt.appointment_date ? appt.appointment_date.split('T')[0] : todayStr,
                                                                visit_category: appt.visit_category || 'First visit',
                                                                appointment_mode: appt.appointment_mode || 'OFFLINE',
                                                                reschedule_from: appt.appointment_id || appt._id
                                                            });
                                                            setStep(2);
                                                        }}>
                                                            <RefreshCw size={18} />
                                                            <span>Reschedule</span>
                                                        </button>
                                                    </div>
                                                )) : (
                                                    <div className="no-appts-v4">
                                                        <AlertCircle size={40} />
                                                        <p>No pending appointments found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="success-screen-v4">
                                            <div className="success-blob">
                                                <CheckCircle size={64} />
                                            </div>
                                            {bookingForm.reschedule_from ? (
                                                <>
                                                    <h1>Appointment Rescheduled!</h1>
                                                    <p>Your appointment rescheduling has been done successfully. We have sent a confirmation message to your registered WhatsApp number.</p>
                                                </>
                                            ) : (patientForm.enrollment_option === 'just_enroll' && isNewPatient) ? (
                                                <>
                                                    <h1>Registration Complete!</h1>
                                                    <div className="patient-id-card-v4">
                                                        <span className="id-label">Patient ID</span>
                                                        <span className="id-value">{registeredPatient?.patient_id}</span>
                                                    </div>
                                                    <p>Your registration has been done successfully. We have sent a confirmation message to your registered WhatsApp number.</p>
                                                </>
                                            ) : (
                                                <>
                                                    <h1>Appointment Confirmed!</h1>
                                                    <div className="patient-id-card-v4">
                                                        <div className="id-row"><span>Patient ID</span> <strong>{registeredPatient?.patient_id}</strong></div>
                                                        <div className="id-row"><span>Doctor Name</span> <strong>{registeredPatient?.doctor_name || 'N/A'}</strong></div>
                                                        <div className="id-row"><span>Appointment Date</span> <strong>{registeredPatient?.appointment_date ? new Date(registeredPatient.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</strong></div>
                                                        <div className="id-row"><span>Shift Start Time</span> <strong>{registeredPatient?.appointment_time || '14:00'}</strong></div>
                                                        <div className="id-row"><span>Token Number</span> <strong>{registeredPatient?.token_display || registeredPatient?.token_number || 'T-XX'}</strong></div>
                                                    </div>
                                                    <p>Your appointment booking has been done successfully. We have sent a confirmation message to your registered WhatsApp number.</p>
                                                </>
                                            )}
                                            <button onClick={() => window.location.reload()} className="btn-main-v4">Go Back Home</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PublicRegister;
