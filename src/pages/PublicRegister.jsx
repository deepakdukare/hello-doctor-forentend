import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Calendar, Phone, MapPin, FileText, CheckCircle,
    AlertCircle, Stethoscope, Baby, Users, Briefcase, Mail,
    Clock, Smartphone, MapPinned, ChevronRight, ChevronLeft,
    Check, RefreshCw, Activity, Clipboard, Edit2, Plus, XCircle,
    ArrowRight, Map, ShieldCheck, ArrowLeft, Zap, Shield, ChevronDown, UserPlus, CalendarClock, CheckCircle2
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableTokens, getTokenConfig, getDoctors, getReferringDoctors, getPatientByWa, getPatientByEmail, getAppointmentsByWaId, getAppointmentById, updateAppointment, lookupAppointments } from '../api/index';
import '../glass-landing.css';
import { removeSalutation } from '../utils/formatters';

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
    const [activeInput, setActiveInput] = useState(null); // null | 'book' | 'reschedule'
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
        address: ''
    });

    const [bookingForm, setBookingForm] = useState({
        wa_id: '',
        doctor_name: '',
        appointment_date: new Date().toISOString().split('T')[0],
        registration_type: 'online',
        doctor_speciality: 'Pediatrics',
        visit_category: 'First visit',
        appointment_mode: 'OFFLINE',
        reason: '',
        reschedule_from: null
    });

    const [availableTokens, setAvailableTokens] = useState(null);
    const [tokensLoading, setTokensLoading] = useState(false);
    const [registeredPatient, setRegisteredPatient] = useState(null);
    const todayStr = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 15);
    const maxStr = maxDate.toISOString().split('T')[0];

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
        console.log('checkMember triggered:', { type, searchWaId, rescheduleWaId });
        const rawId = type === 'lookup' ? searchWaId : rescheduleWaId;
        const targetId = rawId?.trim();
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
                console.log('Using unified lookup for:', targetId);
                const res = await lookupAppointments(targetId);
                const { type: matchType, data, patient: patientInfo } = res.data;

                if (matchType === 'single') {
                    // Direct Appointment ID match
                    const appt = data;
                    setRegisteredPatient({
                        ...appt,
                        first_name: appt.child_name || 'Patient',
                        wa_id: appt.wa_id
                    });
                    setBookingForm(prev => ({
                        ...prev,
                        wa_id: appt.wa_id,
                        doctor_name: appt.doctor_name || appt.assigned_doctor_name || '',
                        appointment_date: appt.appointment_date ? appt.appointment_date.split('T')[0] : todayStr,
                        visit_category: appt.visit_category || 'First visit',
                        appointment_mode: appt.appointment_mode || 'OFFLINE',
                        reschedule_from: appt.appointment_id || appt._id
                    }));
                    setStep(2);
                } else if (matchType === 'list') {
                    // Mobile match (returns list of upcoming appointments)
                    setRegisteredPatient({
                        ...patientInfo,
                        wa_id: patientInfo.mobile
                    });
                    setIsNewPatient(false);
                    setPatientAppointments(data || []);
                    setRescheduleWaId(patientInfo.mobile);
                    setStep(4);
                }
            } else {
                // Regular login/check
                const res = await getPatientByWa(targetId);
                const patientData = res.data.data;
                if (patientData) {
                    setRegisteredPatient(patientData);
                    setIsNewPatient(false);
                    setBookingForm(prev => ({
                        ...prev,
                        wa_id: patientData.wa_id,
                        doctor_name: patientData.preferred_doctor || prev.doctor_name,
                        reschedule_from: null
                    }));
                    setStep(2);
                } else {
                    setErrorFn("Record not found. Use New Registration.");
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('Lookup failed:', err);
            const msg = err.response?.data?.message || "Search failed. Please check your input.";
            setErrorFn(msg);
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
        if (!patientForm.address?.trim()) errors.address = "Address is required";

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
                address: patientForm.address,
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
                        doctor_name: rawDocName,
                        reschedule_from: null
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
        console.log('handleBooking started:', { reschedule_from: bookingForm.reschedule_from, bookingForm });
        try {
            if (bookingForm.reschedule_from) {
                // Simplified payload as per user/API requirements
                const reschedulePayload = {
                    appointment_date: bookingForm.appointment_date,
                    reason: bookingForm.reason || "Patient requested reschedule"
                };
                console.log('Triggering updateAppointment payload:', reschedulePayload);
                const patchRes = await updateAppointment(bookingForm.reschedule_from, reschedulePayload);
                const updatedData = patchRes.data.data;

                if (updatedData) {
                    // Success: PATCH now returns the fully enriched object
                    setRegisteredPatient({
                        ...updatedData,
                        first_name: updatedData.child_name || 'Patient',
                        wa_id: updatedData.wa_id
                    });
                }
                console.log('Reschedule successful');
            } else {
                const isToday = bookingForm.appointment_date === todayStr;
                console.log('Triggering new booking...');
                const res = await bookByForm({
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
                <div className="pf-scroll-root">
                    {/* ── Section 1: Hero ── */}
                    <section className="pf-hero-section">
                        <div className="pf-hero-overlay" />
                        <div className="pf-hero-content">
                            <h1 className="pf-hero-title">PediPulse</h1>
                            <p className="pf-hero-sub">Pediatric Care Portal</p>
                            <button
                                className="pf-scroll-btn"
                                onClick={() => {
                                    if (window.innerWidth >= 900) {
                                        document.getElementById('pf-book-input')?.focus();
                                    } else {
                                        document.getElementById('pf-cards-section').scrollIntoView({ behavior: 'smooth' });
                                    }
                                }}
                            >
                                <span className="pf-btn-mobile-label">Scroll down <span className="pf-arrow">↓</span></span>
                                <span className="pf-btn-desktop-label">Book Appointment <span className="pf-arrow">↓</span></span>
                            </button>
                        </div>
                    </section>

                    {/* ── Section 2: Cards ── */}
                    <section id="pf-cards-section" className="pf-cards-section">
                        <div className="pf-bg-image" />
                        <div className="pf-cards-content">
                            {/* Welcome banner */}
                            <div className="pf-welcome-banner">
                                <span className="pf-welcome-pill">Welcome</span>
                                <h2 className="pf-welcome-title">Happy Smiles,<br />Healthy Kids</h2>
                                <p className="pf-welcome-sub">Compassionate medical care<br />for your little wonders.</p>
                                <Baby className="pf-welcome-icon-svg" />
                            </div>

                            {/* 3 Action Cards (2-col mobile / 3-col desktop) */}
                            <div className="pf-top-cards">
                                <button className="pf-action-card" onClick={() => { setIsNewPatient(true); setStep(1); }}>
                                    <div className="pf-card-icon pf-icon-teal"><UserPlus size={34} strokeWidth={1.5} /></div>
                                    <span className="pf-card-label">New<br />Registration</span>
                                </button>
                                <button className="pf-action-card" onClick={() => {
                                    setActiveInput(prev => prev === 'book' ? null : 'book');
                                    setTimeout(() => document.getElementById('pf-book-input')?.focus(), 50);
                                }}>
                                    <div className="pf-card-icon pf-icon-pink"><Calendar size={34} strokeWidth={1.5} /></div>
                                    <span className="pf-card-label">Book<br />Appointment</span>
                                </button>
                                <button className="pf-action-card pf-reschedule-tile" onClick={() => {
                                    setActiveInput(prev => prev === 'reschedule' ? null : 'reschedule');
                                    setTimeout(() => document.getElementById('pf-reschedule-input')?.focus(), 50);
                                }}>
                                    <div className="pf-card-icon pf-icon-orange"><CalendarClock size={34} strokeWidth={1.5} /></div>
                                    <span className="pf-card-label">Reschedule<br />Visit</span>
                                </button>
                            </div>

                            {/* Conditional Inputs */}
                            {activeInput === 'book' && (
                                <div className="pf-input-wrapper pf-expand-anim">
                                    <div className="pf-input-card">
                                        <input
                                            id="pf-book-input"
                                            className="pf-inline-input"
                                            placeholder="Mobile number to book appointment"
                                            value={searchWaId}
                                            onChange={e => setSearchWaId(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={e => e.key === 'Enter' && checkMember(e)}
                                        />
                                        <button className="pf-inline-btn" onClick={checkMember} disabled={loading || !searchWaId}>
                                            {loading ? <RefreshCw className="animate-spin" size={16} /> : '→'}
                                        </button>
                                    </div>
                                    {verifyError && <div className="pf-err-text">{verifyError}</div>}
                                </div>
                            )}

                            {activeInput === 'reschedule' && (
                                <div className="pf-input-wrapper pf-expand-anim">
                                    <div className="pf-input-card">
                                        <input
                                            id="pf-reschedule-input"
                                            className="pf-inline-input"
                                            placeholder="Mobile number to reschedule"
                                            value={rescheduleWaId}
                                            onChange={e => setRescheduleWaId(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={e => e.key === 'Enter' && checkMember(e, 'reschedule')}
                                        />
                                        <button className="pf-inline-btn" onClick={e => checkMember(e, 'reschedule')} disabled={loading || !rescheduleWaId}>
                                            {loading ? <RefreshCw className="animate-spin" size={16} /> : '→'}
                                        </button>
                                    </div>
                                    {rescheduleError && <div className="pf-err-text">{rescheduleError}</div>}
                                </div>
                            )}
                        </div>
                    </section>
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
                                                    <img src="/logo.jpg" alt="PediPulse" />
                                                    <div className="logo-text">
                                                        <span className="brand">PediPulse</span>
                                                        <span className="sub">Pediatric<br />Care<br />Portal</span>
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
                                                            placeholder=""
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
                                                            placeholder=""
                                                            value={patientForm.middle_name}
                                                            onChange={e => setPatientForm({ ...patientForm, middle_name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">Last Name *</label>
                                                        <input
                                                            className={`reg-input ${regErrors.last_name ? 'has-error' : ''}`}
                                                            name="last_name"
                                                            placeholder=""
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
                                                        placeholder=""
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
                                                        placeholder=""
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
                                                        placeholder=""
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
                                                        placeholder=""
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
                                                        placeholder=""
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
                                                        placeholder=""
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
                                                            placeholder=""
                                                            value={patientForm.state}
                                                            onChange={e => setPatientForm({ ...patientForm, state: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">City *</label>
                                                        <input
                                                            className={`reg-input ${regErrors.city ? 'has-error' : ''}`}
                                                            name="city"
                                                            placeholder=""
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
                                                        placeholder=""
                                                        value={patientForm.pincode}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, pincode: e.target.value.replace(/\D/g, '') })}
                                                    />
                                                    {regErrors.pincode && <p className="reg-err">{regErrors.pincode}</p>}
                                                </div>

                                                <div className="reg-field">
                                                    <label className="reg-label">Address *</label>
                                                    <textarea
                                                        className={`reg-input reg-textarea ${regErrors.address ? 'has-error' : ''}`}
                                                        name="address"
                                                        placeholder=""
                                                        value={patientForm.address}
                                                        onBlur={handleBlur}
                                                        onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                                                    />
                                                    {regErrors.address && <p className="reg-err">{regErrors.address}</p>}
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
                                                        placeholder=""
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
                                        <form onSubmit={handleBooking} className="reg-form-clean">
                                            {/* Unified Header with Patient Info */}
                                            <div className="reg-unified-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem' }}>
                                                <button type="button" className="btn-back-v4" onClick={() => isNewPatient ? setStep(1) : setStep(0)}>
                                                    <ArrowLeft size={20} />
                                                    <span>Back</span>
                                                </button>
                                                <div className="p-badge-v4" style={{ background: '#f8fafc', padding: '6px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1.5px solid #eef2ff' }}>
                                                    <div className="p-avatar-v4" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}><User size={18} /></div>
                                                    <div className="p-meta-v4" style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{removeSalutation(registeredPatient?.child_name) || patientForm.first_name}</strong>
                                                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>ID: {registeredPatient?.patient_id || 'New Record'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="reg-section">
                                                <h2 className="reg-section-title">Visit Configuration</h2>
                                                <div className="reg-grid-2">
                                                    <div className="reg-field">
                                                        <label className="reg-label">Select Clinician</label>
                                                        <div className="reg-select-wrap">
                                                            <select
                                                                className="reg-select"
                                                                value={bookingForm.doctor_name}
                                                                onChange={e => setBookingForm({ ...bookingForm, doctor_name: e.target.value })}
                                                            >
                                                                {doctors.map((d, idx) => (
                                                                    <option key={d._id || d.doctor_id || `book-doc-${idx}`} value={getRawDoctorName(d)}>
                                                                        {getDoctorDisplayName(d)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={16} className="reg-select-icon" />
                                                        </div>
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">Proposed Visit Date</label>
                                                        <input type="date" className="reg-input" min={todayStr} max={maxStr} value={bookingForm.appointment_date} onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })} />
                                                    </div>
                                                </div>

                                                <div className="reg-field" style={{ marginTop: '0.5rem' }}>
                                                    <div style={{ backgroundColor: '#fff', border: '1.5px solid #f1f5f9', borderRadius: '16px', padding: '1.25rem', position: 'relative', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div className="token-header-v4" style={{ position: 'absolute', top: '10px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>Clinic Availability</h3>
                                                            {tokensLoading && <RefreshCw size={14} className="animate-spin text-primary" />}
                                                        </div>

                                                        {availableTokens ? (
                                                            availableTokens.is_offline ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1.5px solid #fecaca', marginTop: '1rem' }}>
                                                                    <div style={{ background: '#fff', padding: '8px', borderRadius: '50%', color: '#e11d48' }}><AlertCircle size={20} /></div>
                                                                    <div>
                                                                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#e11d48' }}>Doctor Off Duty</div>
                                                                        <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>Not available via standard scheduling on this date.</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem', marginTop: '1.5rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'space-between', background: '#f8faff', padding: '12px 16px', borderRadius: '14px', border: '1.5px solid #eef2ff' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>Next Online Token</span>
                                                                            <span style={{ fontSize: '28px', fontWeight: 950, color: '#1e293b' }}>#{availableTokens.online_next_token ?? '--'}</span>
                                                                        </div>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#1e293b', fontWeight: 800, justifyContent: 'flex-end' }}>
                                                                                <Clock size={16} color="#6366f1" />
                                                                                <span>{availableTokens.start_time || '--:--'}</span>
                                                                            </div>
                                                                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, fontWeight: 600 }}>Estimated arrival time</p>
                                                                        </div>
                                                                    </div>
                                                                    {availableTokens.online_tokens_remaining > 0 ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '10px 14px', borderRadius: '10px' }}>
                                                                            <CheckCircle size={16} />
                                                                            <span>Tokens are currently available for this selection.</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#dc2626', fontWeight: 700, background: '#fef2f2', padding: '10px 14px', borderRadius: '10px' }}>
                                                                            <AlertCircle size={16} />
                                                                            <span>Online booking is full. Try another date or doctor.</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '1rem' }}>
                                                                <Activity size={24} style={{ opacity: 0.5, marginBottom: '8px', animation: 'pulse 2s infinite' }} />
                                                                <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>Syncing availability...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="reg-grid-2" style={{ marginTop: '1.5rem' }}>
                                                    <div className="reg-field">
                                                        <label className="reg-label">Visit Category</label>
                                                        <div className="reg-select-wrap">
                                                            <select className="reg-select" value={bookingForm.visit_category} onChange={e => setBookingForm({ ...bookingForm, visit_category: e.target.value })}>
                                                                <option value="First visit">First visit</option>
                                                                <option value="Follow-up">Follow-up</option>
                                                                <option value="Vaccination">Vaccination</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                            <ChevronDown size={16} className="reg-select-icon" />
                                                        </div>
                                                    </div>
                                                    <div className="reg-field">
                                                        <label className="reg-label">Service Type</label>
                                                        <div className="reg-select-wrap">
                                                            <select className="reg-select" value={bookingForm.appointment_mode} onChange={e => setBookingForm({ ...bookingForm, appointment_mode: e.target.value })}>
                                                                <option value="OFFLINE">In-Clinic Visit</option>
                                                                <option value="ONLINE">Video Consultation</option>
                                                            </select>
                                                            <ChevronDown size={16} className="reg-select-icon" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="reg-field">
                                                    <label className="reg-label">Primary Concern (Optional)</label>
                                                    <input className="reg-input" placeholder="e.g. Regular vaccination, Fever, etc." value={bookingForm.reason} onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="reg-submit-bar" style={{ background: '#fcfcfc', borderRadius: '0 0 24px 24px' }}>
                                                <button
                                                    type="submit"
                                                    disabled={loading || (!bookingForm.reschedule_from && availableTokens && (availableTokens.is_offline || availableTokens.online_tokens_remaining <= 0))}
                                                    className="reg-submit-btn"
                                                >
                                                    {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                                                        availableTokens && availableTokens.is_offline ? (
                                                            <><span>Clinician Offline</span> <XCircle size={20} /></>
                                                        ) : availableTokens && availableTokens.online_tokens_remaining <= 0 ? (
                                                            <><span>Fully Booked</span> <AlertCircle size={20} /></>
                                                        ) : (
                                                            <>
                                                                <CheckCircle size={20} />
                                                                <span>{bookingForm.reschedule_from ? 'Apply Reschedule' : 'Reserve My Token'}</span>
                                                                <ArrowRight size={18} />
                                                            </>
                                                        )
                                                    )}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {step === 4 && (
                                        <div className="reg-form-clean">
                                            <div className="reg-unified-header">
                                                <button type="button" className="btn-back-v4" onClick={() => setStep(0)}>
                                                    <ArrowLeft size={20} />
                                                    <span>Home</span>
                                                </button>
                                                <div style={{ textAlign: 'right' }}>
                                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>My Appointments</h2>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Sync or modify your visits</p>
                                                </div>
                                            </div>

                                            <div className="reg-section">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {patientAppointments.length > 0 ? patientAppointments.map(appt => (
                                                        <div
                                                            key={appt.appointment_id || appt._id}
                                                            className="reg-doctor-card"
                                                            style={{ 
                                                                flexDirection: 'row', 
                                                                textAlign: 'left', 
                                                                padding: '1.25rem', 
                                                                gap: '1.25rem',
                                                                width: '100%',
                                                                background: '#fff',
                                                                border: '1.5px solid #f1f5f9',
                                                                borderRadius: '20px',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                                                            }}
                                                            onClick={() => {
                                                                setBookingForm({
                                                                    ...bookingForm,
                                                                    wa_id: appt.wa_id,
                                                                    doctor_name: appt.doctor_name || appt.assigned_doctor_name || '',
                                                                    appointment_date: appt.appointment_date ? appt.appointment_date.split('T')[0] : todayStr,
                                                                    visit_category: appt.visit_category || 'First visit',
                                                                    appointment_mode: appt.appointment_mode || 'OFFLINE',
                                                                    reschedule_from: appt.appointment_id || appt._id
                                                                });
                                                                setStep(2);
                                                            }}
                                                        >
                                                            <div style={{ background: '#f0f4ff', color: '#4f46e5', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <CalendarClock size={28} />
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                                                                        {new Date(appt.appointment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                    </h4>
                                                                    <div style={{ background: '#ecfdf5', color: '#059669', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '50px' }}>CONFIRMED</div>
                                                                </div>
                                                                <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                                                                    with {appt.doctor_name || 'Clinic Clinician'}
                                                                </p>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span>Tap to reschedule</span>
                                                                        <ChevronRight size={14} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                                                            <Activity size={44} style={{ color: '#cbd5e1', marginBottom: '1.25rem' }} />
                                                            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>No Ongoing Visits</h3>
                                                            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, maxWidth: '240px', margin: '0.5rem auto 1.5rem' }}>We couldn't find any upcoming appointments linked to this primary mobile.</p>
                                                            <button className="reg-submit-btn" style={{ maxWidth: '200px', fontSize: '14px', margin: '0 auto', padding: '10px' }} onClick={() => setStep(0)}>Return Home</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="reg-form-clean">
                                            <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#fff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                                                <div style={{ width: '84px', height: '84px', background: '#ecfdf5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.75rem', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.12)' }}>
                                                    <CheckCircle2 size={44} />
                                                </div>
                                                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>Reservation Success</h2>
                                                <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, lineHeight: 1.5, marginBottom: '2.5rem', maxWidth: '400px', margin: '0 auto 2.5rem' }}>
                                                    {bookingForm.reschedule_from 
                                                        ? "Your appointment has been successfully updated. We've synchronized the changes with our clinician's roster."
                                                        : "Your profile is active and appointment is reserved. A confirmation summary telah sent to your registered mobile."
                                                    }
                                                </p>
                                                
                                                <div style={{ background: '#f8faff', borderRadius: '20px', padding: '1.5rem', textAlign: 'left', marginBottom: '2.5rem', border: '1.5px solid #eef2ff' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #eef2ff', paddingBottom: '14px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Patient</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{removeSalutation(registeredPatient?.child_name || registeredPatient?.first_name || 'Patient')}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #eef2ff', paddingBottom: '14px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Token ID</span>
                                                        <span style={{ fontSize: '15px', fontWeight: 950, color: '#6366f1' }}>{registeredPatient?.token_display || registeredPatient?.token_number || 'T-RESERVED'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Patient ID</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{registeredPatient?.patient_id || 'REGISTERED'}</span>
                                                    </div>
                                                </div>

                                                <button className="reg-submit-btn" onClick={() => window.location.reload()}>
                                                    <span>Back to Landing</span>
                                                    <ArrowRight size={20} />
                                                </button>
                                            </div>
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
