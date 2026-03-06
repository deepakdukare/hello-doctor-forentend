import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Calendar, Phone, MapPin, FileText, CheckCircle,
    AlertCircle, Stethoscope, Baby, Users, Briefcase, Mail,
    Clock, Smartphone, MapPinned, ChevronRight, ChevronLeft,
    Check, RefreshCw, Activity, Clipboard, Edit2, Plus,
    ArrowRight, Map, ShieldCheck, ArrowLeft, Zap, Shield, ChevronDown
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableSlots, getDoctors, getPatientByWa, getAppointmentsByWaId, updateAppointment } from '../api/index';

const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
const GENDERS = ['Male', 'Female', 'Other'];
const COMM_PREFERENCES = ['WhatsApp', 'SMS', 'Email'];
const ENROLLMENT_OPTIONS = [
    { value: 'just_enroll', label: 'Enroll & Book Visit' }
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
    const [searchWaId, setSearchWaId] = useState('');
    const [rescheduleWaId, setRescheduleWaId] = useState('');
    const [rescheduleError, setRescheduleError] = useState(null);
    const [waIdValidation, setWaIdValidation] = useState({ loading: false, error: null });
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
    const [regSubmitted, setRegSubmitted] = useState(false);

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
        city: 'Pune',
        state: 'Maharashtra',
        pin_code: '411001',
        comm_preference: 'WhatsApp',
        preferred_doctor: '',
        notes: '',
        enrollment_option: 'just_enroll',
        registration_source: 'public_form'
    });

    const [bookingForm, setBookingForm] = useState({
        wa_id: '',
        doctor_name: '',
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
                if (docs.length > 0) {
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

                const apptsRes = await getAppointmentsByWaId(targetId);
                const appointments = apptsRes.data.data || [];

                setRegisteredPatient(patientData);
                setIsNewPatient(false);
                setPatientAppointments(appointments.filter(a => a.status === 'PENDING' || a.status === 'CONFIRMED'));
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

    const handleRegistration = async (e) => {
        e.preventDefault();
        setRegSubmitted(true);
        setLoading(true);
        setError(null);
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
                father_mobile: patientForm.father_mobile || null,
                mother_mobile: patientForm.mother_mobile || null,
                parent_mobile: patientForm.wa_id,
                wa_id: patientForm.wa_id,
                email: patientForm.email || null,
                address: patientForm.address,
                city: patientForm.city,
                state: patientForm.state,
                pin_code: patientForm.pin_code,
                communication_preference: patientForm.comm_preference.toLowerCase(),
                doctor: rawDocName,
                remarks: patientForm.notes || null,
                registration_source: patientForm.registration_source,
                enrollment_option: patientForm.enrollment_option,
            };

            const res = await registerFromForm(payload);
            const patientData = res.data?.data;
            if (patientData) {
                setRegisteredPatient(patientData);
                setBookingForm(prev => ({
                    ...prev,
                    wa_id: patientData.wa_id,
                    doctor_name: rawDocName
                }));
                setStep(2);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed");
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
            setError(err.response?.data?.message || "Booking failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-premium">
            <div className="landing-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <div className="landing-content">
                <div className="landing-header">
                    <div className="logo-box">
                        <img src="/logo.jpg" alt="DICC" />
                        <div className="logo-text">
                            <span className="brand">DICC</span>
                            <span className="sub">Pediatric Care Excellence</span>
                        </div>
                    </div>
                </div>

                <div className="main-stage-v4">
                    {step === 0 && (
                        <div className="home-hero-v4">
                            <div className="hero-text-center">
                                <h1>Welcome to Dr. Indu Child Care</h1>
                                <p>Are you a registered patient or visiting for the first time?</p>
                            </div>

                            <div className="action-cards-v4">
                                <div className="card-v4 new-reg" onClick={() => { setIsNewPatient(true); setStep(1); }}>
                                    <div className="card-icon-box">
                                        <Plus size={28} />
                                    </div>
                                    <div className="card-details-v4">
                                        <h3>New Registration</h3>
                                        <p>First time visiting our clinic? Register details & book an appointment.</p>
                                    </div>
                                    <ChevronRight className="card-arrow" />
                                </div>

                                <div className="card-v4 book-appt" onClick={e => e.stopPropagation()}>
                                    <div className="card-icon-box purple">
                                        <Calendar size={28} />
                                    </div>
                                    <div className="card-details-v4">
                                        <h3>Book Appointment</h3>
                                        <p>Have a patient record? Enter mobile number to book instantly.</p>
                                        <div className="inline-verify-v4">
                                            <input
                                                placeholder="Mobile Number"
                                                value={searchWaId}
                                                onChange={e => setSearchWaId(e.target.value.replace(/\D/g, ''))}
                                                onKeyDown={e => e.key === 'Enter' && checkMember(e)}
                                            />
                                            <button onClick={checkMember} disabled={loading || !searchWaId}>
                                                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Book'}
                                            </button>
                                        </div>
                                        {verifyError && <div className="error-text-mini">{verifyError}</div>}
                                    </div>
                                </div>

                                <div className="card-v4 reschedule" onClick={e => e.stopPropagation()}>
                                    <div className="card-icon-box orange">
                                        <RefreshCw size={28} />
                                    </div>
                                    <div className="card-details-v4">
                                        <h3>Reschedule Appointment</h3>
                                        <p>Need to change time? Use your mobile to reschedule existing booking.</p>
                                        <div className="inline-verify-v4">
                                            <input
                                                placeholder="Mobile Number"
                                                value={rescheduleWaId}
                                                onChange={e => setRescheduleWaId(e.target.value.replace(/\D/g, ''))}
                                                onKeyDown={e => e.key === 'Enter' && checkMember(e, 'reschedule')}
                                            />
                                            <button className="btn-res" onClick={e => checkMember(e, 'reschedule')} disabled={loading || !rescheduleWaId}>
                                                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Modify'}
                                            </button>
                                        </div>
                                        {rescheduleError && <div className="error-text-mini">{rescheduleError}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step > 0 && (
                        <div className="step-container-v4">
                            <div className="step-nav-header">
                                <button className="btn-back-v4" onClick={() => {
                                    if (step === 3) window.location.reload();
                                    else if (step === 1) setStep(0);
                                    else if (step === 2) isNewPatient ? setStep(1) : setStep(0);
                                    else setStep(0);
                                }}>
                                    <ArrowLeft size={20} />
                                    <span>Back</span>
                                </button>
                                {step < 3 && (
                                    <div className="step-indicator-v4">
                                        <div className={`ind-dot ${step === 1 ? 'active' : 'done'}`}>1</div>
                                        <div className="ind-line"></div>
                                        <div className={`ind-dot ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>2</div>
                                    </div>
                                )}
                            </div>

                            {error && <div className="global-alert-v4 error"><AlertCircle size={20} /> {error}</div>}

                            {step === 1 && (
                                <form onSubmit={handleRegistration} className="premium-scroll-form">
                                    <div className="form-section-v4">
                                        <div className="sec-title-v4">
                                            <div className="sec-icon-circle"><Baby size={22} /></div>
                                            <h2>Child Identification</h2>
                                        </div>

                                        <div className="grid-v4">
                                            <div className="f-group-v4">
                                                <label>Salutation</label>
                                                <div className="sel-wrap-v4">
                                                    <select value={patientForm.salutation} onChange={e => setPatientForm({ ...patientForm, salutation: e.target.value })}>
                                                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                    <ChevronDown size={18} className="arrow-v4" />
                                                </div>
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>First Name *</label>
                                                <input required placeholder="Arjun" value={patientForm.first_name} onChange={e => setPatientForm({ ...patientForm, first_name: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4">
                                                <label>Middle Name</label>
                                                <input placeholder="Rohit" value={patientForm.middle_name} onChange={e => setPatientForm({ ...patientForm, middle_name: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4">
                                                <label>Last Name *</label>
                                                <input required placeholder="Sharma" value={patientForm.last_name} onChange={e => setPatientForm({ ...patientForm, last_name: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4">
                                                <label>Gender *</label>
                                                <div className="sel-wrap-v4">
                                                    <select required value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                    <ChevronDown size={18} className="arrow-v4" />
                                                </div>
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Date of Birth *</label>
                                                <input type="date" required max={todayStr} value={patientForm.dob} onChange={e => setPatientForm({ ...patientForm, dob: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section-v4">
                                        <div className="sec-title-v4 blue">
                                            <div className="sec-icon-circle"><Users size={22} /></div>
                                            <h2>Parental Details</h2>
                                        </div>
                                        <div className="grid-v4">
                                            <div className="f-group-v4 col-2">
                                                <label>Father's Name</label>
                                                <input placeholder="Name" value={patientForm.father_name} onChange={e => setPatientForm({ ...patientForm, father_name: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Father's Mobile</label>
                                                <input placeholder="Mobile" value={patientForm.father_mobile} onChange={e => setPatientForm({ ...patientForm, father_mobile: e.target.value.replace(/\D/g, '') })} />
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Mother's Name</label>
                                                <input placeholder="Name" value={patientForm.mother_name} onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Mother's Mobile</label>
                                                <input placeholder="Mobile" value={patientForm.mother_mobile} onChange={e => setPatientForm({ ...patientForm, mother_mobile: e.target.value.replace(/\D/g, '') })} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section-v4">
                                        <div className="sec-title-v4 orange">
                                            <div className="sec-icon-circle"><MapPin size={22} /></div>
                                            <h2>Contact & Location</h2>
                                        </div>
                                        <div className="grid-v4">
                                            <div className="f-group-v4 col-2">
                                                <label>WhatsApp ID / Mobile *</label>
                                                <div className="icon-input-v4">
                                                    <Zap size={18} className="i-v4" />
                                                    <input required placeholder="9876543210" value={patientForm.wa_id} onChange={e => {
                                                        const v = e.target.value.replace(/\D/g, '');
                                                        setPatientForm({ ...patientForm, wa_id: v });
                                                        handleWaIdCheck(v);
                                                    }} />
                                                </div>
                                                {waIdValidation.error && <p className="err-v4">{waIdValidation.error}</p>}
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Communication Pref.</label>
                                                <div className="sel-wrap-v4">
                                                    <select value={patientForm.comm_preference} onChange={e => setPatientForm({ ...patientForm, comm_preference: e.target.value })}>
                                                        {COMM_PREFERENCES.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <ChevronDown size={18} className="arrow-v4" />
                                                </div>
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>City *</label>
                                                <input required value={patientForm.city} onChange={e => setPatientForm({ ...patientForm, city: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4">
                                                <label>State</label>
                                                <input value={patientForm.state} onChange={e => setPatientForm({ ...patientForm, state: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4">
                                                <label>Pin Code *</label>
                                                <input required placeholder="411xxx" maxLength={6} value={patientForm.pin_code} onChange={e => setPatientForm({ ...patientForm, pin_code: e.target.value.replace(/\D/g, '') })} />
                                            </div>
                                            <div className="f-group-v4 col-full">
                                                <label>Residential Address *</label>
                                                <textarea required placeholder="Area, Building, Flat No..." value={patientForm.address} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })} />
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Preferred Doctor *</label>
                                                <div className="sel-wrap-v4">
                                                    <select required value={patientForm.preferred_doctor} onChange={e => setPatientForm({ ...patientForm, preferred_doctor: e.target.value })}>
                                                        <option value="">— Select Doctor —</option>
                                                        {doctors.map(d => <option key={getDoctorDisplayName(d)} value={getDoctorDisplayName(d)}>{getDoctorDisplayName(d)}</option>)}
                                                    </select>
                                                    <ChevronDown size={18} className="arrow-v4" />
                                                </div>
                                            </div>
                                            <div className="f-group-v4 col-2">
                                                <label>Remarks / Notes</label>
                                                <input placeholder="Optional extra info" value={patientForm.notes} onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-footer-v4">
                                        <button type="submit" disabled={loading || !!waIdValidation.error} className="btn-main-v4">
                                            {loading ? <RefreshCw className="animate-spin" /> : <><span>Next: Slot Booking</span> <ArrowRight size={20} /></>}
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
                                                    {doctors.map(d => <option key={getRawDoctorName(d)} value={getRawDoctorName(d)}>{getDoctorDisplayName(d)}</option>)}
                                                </select>
                                                <ChevronDown size={18} className="arrow-v4" />
                                            </div>
                                        </div>
                                        <div className="f-group-v4 col-2">
                                            <label>Appointment Date</label>
                                            <input type="date" min={todayStr} value={bookingForm.appointment_date} onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })} />
                                        </div>

                                        <div className="f-group-v4 col-full">
                                            <label>Available Slots</label>
                                            <div className="slots-container-v4">
                                                {slotsLoading ? (
                                                    <div className="slots-skeleton-v4">
                                                        <RefreshCw className="animate-spin" /> Fetching slots...
                                                    </div>
                                                ) : availableSlots.length > 0 ? (
                                                    <div className="slots-reel-v4">
                                                        {availableSlots.map(slot => (
                                                            <div
                                                                key={slot.slot_id}
                                                                className={`slot-box-v4 ${bookingForm.slot_id === slot.slot_id ? 'active' : ''}`}
                                                                onClick={() => setBookingForm({ ...bookingForm, slot_id: slot.slot_id })}
                                                            >
                                                                <span className="s-time">{formatTime12h(slot.start_time)}</span>
                                                                <span className="s-session">{slot.session}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="no-slots-v4">
                                                        <Clock size={20} />
                                                        <span>No slots found for this date. Try another clinician or date.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="f-group-v4 col-2">
                                            <label>Visit Category</label>
                                            <div className="sel-wrap-v4">
                                                <select value={bookingForm.visit_type} onChange={e => setBookingForm({ ...bookingForm, visit_type: e.target.value })}>
                                                    <option value="CONSULTATION">Consultation</option>
                                                    <option value="FOLLOW_UP">Follow-up</option>
                                                    <option value="VACCINATION">Vaccination</option>
                                                </select>
                                                <ChevronDown size={18} className="arrow-v4" />
                                            </div>
                                        </div>
                                        <div className="f-group-v4 col-2">
                                            <label>Reason (Optional)</label>
                                            <input placeholder="e.g. Fever" value={bookingForm.reason} onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-footer-v4">
                                        <button type="submit" disabled={loading || !bookingForm.slot_id} className="btn-main-v4">
                                            {loading ? <RefreshCw className="animate-spin" /> : <><span>Complete Booking</span> <CheckCircle size={20} /></>}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {step === 4 && (
                                <div className="reschedule-panel-v4">
                                    <div className="pan-header">
                                        <h2>Reschedule Appointment</h2>
                                        <p>Select an ongoing appointment to modify</p>
                                    </div>
                                    <div className="appt-list-v4">
                                        {patientAppointments.length > 0 ? patientAppointments.map(appt => (
                                            <div key={appt._id} className="appt-card-v4">
                                                <div className="appt-info-v4">
                                                    <strong>{appt.appointment_date}</strong>
                                                    <span>{formatTime12h(appt.start_time)} • {appt.doctor_name}</span>
                                                </div>
                                                <button onClick={() => {
                                                    setBookingForm({
                                                        ...bookingForm,
                                                        wa_id: appt.wa_id,
                                                        doctor_name: appt.doctor_name,
                                                        reschedule_from: appt._id
                                                    });
                                                    setStep(2);
                                                }}>Reschedule</button>
                                            </div>
                                        )) : (
                                            <div className="no-appts-v4">No pending appointments found</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="success-screen-v4">
                                    <div className="success-blob">
                                        <CheckCircle size={64} />
                                    </div>
                                    <h1>Booking Confirmed!</h1>
                                    <p>Your appointment has been scheduled successfully. We have sent a confirmation message to your registered WhatsApp number.</p>
                                    <button onClick={() => window.location.reload()} className="btn-main-v4">Go Back Home</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                
                .landing-premium {
                    min-height: 100vh;
                    font-family: 'Outfit', sans-serif;
                    position: relative;
                    overflow: hidden;
                    background: #fdfdff;
                    color: #0f172a;
                    display: flex;
                    flex-direction: column;
                }

                .landing-background {
                    position: fixed;
                    inset: 0;
                    z-index: 0;
                    overflow: hidden;
                }

                .blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.4;
                    z-index: -1;
                }

                .blob-1 { width: 600px; height: 600px; background: #6366f1; top: -200px; right: -200px; }
                .blob-2 { width: 500px; height: 500px; background: #3b82f6; bottom: -150px; left: -150px; }
                .blob-3 { width: 400px; height: 400px; background: #f59e0b; top: 40%; left: 30%; opacity: 0.15; }

                .landing-content {
                    position: relative;
                    z-index: 10;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                }

                .landing-header { margin-bottom: 3rem; }
                .logo-box { display: flex; align-items: center; gap: 1rem; }
                .logo-box img { width: 56px; height: 56px; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
                .logo-text { display: flex; flex-direction: column; }
                .brand { font-size: 1.5rem; font-weight: 900; color: #6366f1; letter-spacing: -1px; line-height: 1; }
                .sub { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 0.25rem; }

                .main-stage-v4 { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

                .hero-text-center { text-align: center; margin-bottom: 4rem; }
                .hero-text-center h1 { font-size: 3.5rem; font-weight: 900; color: #0f172a; letter-spacing: -2px; margin: 0 0 1rem; }
                .hero-text-center p { font-size: 1.25rem; color: #64748b; font-weight: 600; }

                .action-cards-v4 {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 2rem;
                    max-width: 1100px;
                    width: 100%;
                }

                .card-v4 {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.4);
                    border-radius: 32px;
                    padding: 2.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.05);
                    position: relative;
                }

                .card-v4:hover { transform: translateY(-12px); box-shadow: 0 30px 60px rgba(99, 102, 241, 0.15); border-color: #6366f1; }

                .card-icon-box {
                    width: 64px; height: 64px; border-radius: 20px;
                    display: flex; align-items: center; justify-content: center;
                    background: #6366f1; color: #fff;
                    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
                }
                .card-icon-box.purple { background: #8b5cf6; box-shadow: 0 10px 20px rgba(139, 92, 246, 0.3); }
                .card-icon-box.orange { background: #f59e0b; box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3); }

                .card-details-v4 h3 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem; }
                .card-details-v4 p { font-size: 0.95rem; color: #64748b; font-weight: 500; line-height: 1.6; margin: 0; }

                .card-arrow { position: absolute; top: 2.5rem; right: 2rem; color: #cbd5e1; transition: 0.3s; }
                .card-v4:hover .card-arrow { color: #6366f1; transform: translateX(5px); }

                .inline-verify-v4 { display: flex; gap: 0.5rem; margin-top: 1.5rem; }
                .inline-verify-v4 input { 
                    flex: 1; height: 48px; border-radius: 12px; border: 2px solid #eef2f6; 
                    background: #fff; padding: 0 1rem; font-weight: 700; outline: none; transition: 0.2s;
                }
                .inline-verify-v4 input:focus { border-color: #6366f1; }
                .inline-verify-v4 button {
                    height: 48px; padding: 0 1.25rem; border-radius: 12px;
                    background: #0f172a; color: #fff; border: none; font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .inline-verify-v4 button:hover { background: #334155; }
                .error-text-mini { color: #ef4444; font-size: 0.75rem; font-weight: 700; margin-top: 0.5rem; }

                /* Step Views */
                .step-container-v4 {
                    width: 100%;
                    max-width: 900px;
                    background: #fff;
                    border-radius: 40px;
                    padding: 3.5rem;
                    box-shadow: 0 30px 100px rgba(15, 23, 42, 0.1);
                    animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
                }

                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }

                .step-nav-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3rem; }
                .btn-back-v4 { 
                    display: flex; align-items: center; gap: 0.5rem; background: #f1f5f9; 
                    border: none; padding: 0.75rem 1.25rem; border-radius: 14px; 
                    font-weight: 800; cursor: pointer; transition: 0.2s;
                }
                .btn-back-v4:hover { background: #e2e8f0; transform: translateX(-4px); }

                .step-indicator-v4 { display: flex; align-items: center; gap: 0.75rem; }
                .ind-dot { 
                    width: 32px; height: 32px; border-radius: 10px; border: 2.5px solid #e2e8f0; 
                    display: flex; align-items: center; justify-content: center; 
                    font-weight: 900; color: #cbd5e1; font-size: 0.85rem;
                }
                .ind-dot.active { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
                .ind-dot.done { border-color: #10b981; color: #10b981; background: #ecfdf5; }
                .ind-line { width: 40px; height: 3px; background: #f1f5f9; border-radius: 2px; }

                .form-section-v4 { margin-bottom: 4rem; }
                .sec-title-v4 { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
                .sec-icon-circle { width: 40px; height: 40px; border-radius: 12px; background: #eef2ff; color: #6366f1; display: flex; align-items: center; justify-content: center; }
                .sec-title-v4 h2 { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 0; }
                .sec-title-v4.blue .sec-icon-circle { background: #eff6ff; color: #3b82f6; }
                .sec-title-v4.orange .sec-icon-circle { background: #fff7ed; color: #f59e0b; }

                .grid-v4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem 1rem; }
                .f-group-v4 { display: flex; flex-direction: column; gap: 0.6rem; }
                .col-2 { grid-column: span 2; }
                .col-full { grid-column: span 4; }

                .f-group-v4 label { font-size: 0.85rem; font-weight: 800; color: #64748b; margin-left: 0.25rem; }
                .f-group-v4 input, .f-group-v4 select, .f-group-v4 textarea {
                    height: 52px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 14px;
                    padding: 0 1rem; font-size: 0.95rem; font-weight: 700; color: #1e293b; outline: none; transition: 0.2s;
                }
                .f-group-v4 input:focus, .f-group-v4 select:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,0.06); }
                .f-group-v4 textarea { height: 100px; padding: 1rem; resize: none; }

                .sel-wrap-v4 { position: relative; }
                .sel-wrap-v4 select { width: 100%; appearance: none; }
                .arrow-v4 { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }

                .icon-input-v4 { position: relative; }
                .icon-input-v4 .i-v4 { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6366f1; }
                .icon-input-v4 input { padding-left: 3rem !important; }

                .form-footer-v4 { margin-top: 3rem; display: flex; justify-content: flex-end; }

                .btn-main-v4 {
                    height: 60px; padding: 0 3rem; border-radius: 18px;
                    background: linear-gradient(135deg, #6366f1, #4338ca); color: #fff;
                    border: none; font-size: 1.1rem; font-weight: 800; cursor: pointer;
                    display: flex; align-items: center; gap: 1rem; box-shadow: 0 10px 25px rgba(99,102,241,0.3);
                    transition: all 0.3s;
                }
                .btn-main-v4:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(99, 102, 241, 0.4); }
                .btn-main-v4:disabled { opacity: 0.6; transform: none; box-shadow: none; }

                /* Slots UI */
                .slots-container-v4 { background: #fdfdff; border: 2px solid #f1f5f9; border-radius: 20px; padding: 1.5rem; }
                .slots-reel-v4 { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; }
                .slot-box-v4 {
                    background: #fff; border: 2px solid #eef2f6; border-radius: 16px; padding: 1rem 0.5rem;
                    text-align: center; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; gap: 0.25rem;
                }
                .slot-box-v4:hover { border-color: #6366f1; transform: translateY(-2px); }
                .slot-box-v4.active { background: #eef2ff; border-color: #6366f1; box-shadow: 0 8px 20px rgba(99,102,241,0.1); }
                .s-time { font-size: 1.1rem; font-weight: 900; color: #1e293b; }
                .s-session { font-size: 0.75rem; font-weight: 800; color: #6366f1; text-transform: uppercase; }

                .p-badge-v4 {
                    background: #f8fafc; border: 2px solid #f1f5f9; padding: 1.5rem; 
                    border-radius: 24px; display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2.5rem;
                }
                .p-avatar-v4 { width: 56px; height: 56px; border-radius: 18px; background: #fff; color: #6366f1; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 15px rgba(0,0,0,0.05); }
                .p-meta-v4 { display: flex; flex-direction: column; }
                .p-meta-v4 strong { font-size: 1.35rem; font-weight: 900; color: #0f172a; }
                .p-meta-v4 span { font-size: 0.9rem; font-weight: 700; color: #64748b; }

                /* Success UI */
                .success-screen-v4 { text-align: center; padding: 2rem 0; }
                .success-blob { 
                    width: 100px; height: 100px; background: #ecfdf5; color: #10b981; 
                    border-radius: 35px; display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 2.5rem; box-shadow: 0 20px 40px rgba(16,185,129,0.2);
                    animation: bounce 1s infinite alternate;
                }
                @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-15px); } }
                .success-screen-v4 h1 { font-size: 2.5rem; font-weight: 900; color: #0f172a; margin-bottom: 1rem; }
                .success-screen-v4 p { font-size: 1.1rem; color: #64748b; font-weight: 600; line-height: 1.6; max-width: 500px; margin: 0 auto 3rem; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* Mobile */
                @media (max-width: 1024px) {
                    .action-cards-v4 { grid-template-columns: 1fr; gap: 1.5rem; }
                    .hero-text-center h1 { font-size: 2.5rem; }
                    .step-container-v4 { padding: 2rem; margin: 1rem; }
                    .grid-v4 { grid-template-columns: repeat(2, 1fr); }
                    .col-2, .col-full { grid-column: span 2; }
                }

                @media (max-width: 640px) {
                    .grid-v4 { grid-template-columns: 1fr; }
                    .col-2, .col-full { grid-column: span 1; }
                    .step-indicator-v4 { display: none; }
                    .hero-text-center h1 { font-size: 2.25rem; }
                    .card-v4 { padding: 1.75rem; border-radius: 24px; }
                    .btn-main-v4 { width: 100%; justify-content: center; padding: 0 1.5rem; }
                    .logo-box img { width: 44px; height: 44px; }
                    .landing-header { margin-bottom: 2rem; }
                }

                @media (max-width: 480px) {
                    .hero-text-center h1 { font-size: 2rem; letter-spacing: -1px; }
                    .hero-text-center p { font-size: 1rem; }
                    .step-container-v4 { padding: 1.5rem; border-radius: 28px; }
                    .sec-title-v4 h2 { font-size: 1.35rem; }
                    .btn-main-v4 { font-size: 1rem; height: 56px; }
                }
            `}</style>
        </div>
    );
};

export default PublicRegister;
