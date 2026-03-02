import React, { useState, useEffect, useCallback } from 'react';
import {
    UserPlus, CheckCircle, AlertCircle, Calendar, User, Phone,
    MapPin, FileText, Share2, ClipboardCheck, ArrowRight,
    ChevronRight, Clock, Heart, ShieldCheck, Stethoscope,
    ChevronLeft, Check, Sparkles, RefreshCw, Smartphone,
    MapPinned, UserCheck2, Baby, Users, Briefcase, Mail
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableSlots, getDoctors } from '../api/index';

const SALUTATIONS = ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'];
const GENDERS = ['Male', 'Female', 'Other'];

const PublicRegister = () => {
    const [step, setStep] = useState(1); // 1: Registration, 2: Booking, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [doctors, setDoctors] = useState([]);

    // Step 1: Detailed Patient Data
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
        pin_code: '',
        wa_id: '',
        email: '',
        doctor: 'Dr. Indu',
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
        visit_type: 'CONSULTATION'
    });

    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const res = await getDoctors();
                setDoctors(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch doctors", err);
            }
        };
        fetchDoctors();
    }, []);

    const fetchSlots = useCallback(async (date, visitType) => {
        setSlotsLoading(true);
        try {
            const docType = visitType === 'VACCINATION' ? 'VACCINATION' : 'PULMONARY';
            const res = await getAvailableSlots(docType, date);
            setAvailableSlots(res.data.data || []);
        } catch (err) {
            console.error("Failed to fetch slots", err);
        } finally {
            setSlotsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (step === 2 && bookingForm.appointment_date) {
            fetchSlots(bookingForm.appointment_date, bookingForm.visit_type);
        }
    }, [step, bookingForm.appointment_date, bookingForm.visit_type, fetchSlots]);

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
            await registerFromForm(payload);
            setBookingForm(prev => ({ ...prev, wa_id: patientForm.wa_id || patientForm.father_mobile }));

            if (patientForm.enrollment_option === 'book_appointment') {
                setStep(2);
            } else {
                setStep(3);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            if (err.response?.data?.error_code === 'PATIENT_EXISTS') {
                setBookingForm(prev => ({ ...prev, wa_id: patientForm.wa_id || patientForm.father_mobile }));
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setError("A profile with this registration identifier already exists. If this is unexpected, please refresh or contact the clinic for assistance.");
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
            await bookByForm(bookingForm);
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err.response?.data?.message || "Booking failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderProgress = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
            {[
                { s: 1, label: 'Enroll', icon: <UserPlus size={16} /> },
                { s: 2, label: 'Schedule', icon: <Calendar size={16} /> },
                { s: 3, label: 'Done', icon: <CheckCircle size={16} /> }
            ].map((item, idx) => (
                <React.Fragment key={item.s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', opacity: step >= item.s ? 1 : 0.4 }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: step === item.s ? 'var(--primary)' : (step > item.s ? '#10b981' : '#e2e8f0'),
                            color: step >= item.s ? '#fff' : '#64748b'
                        }}>
                            {step > item.s ? <Check size={18} /> : item.icon}
                        </div>
                    </div>
                    {idx < 2 && <div style={{ width: '20px', height: '2px', background: step > item.s ? '#10b981' : '#e2e8f0' }} />}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem 1rem'
        }}>
            <div style={{ maxWidth: '680px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: '#fff', borderRadius: '24px', boxShadow: '0 12px 24px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
                        <Stethoscope size={36} color="var(--primary)" />
                    </div>
                    <h1 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>Dr. Indu Child Care</h1>
                    <p style={{ color: '#64748b', fontWeight: 600, marginTop: '0.5rem' }}>Premium Clinical Enrollment</p>
                </div>

                {renderProgress()}

                <div className="card" style={{
                    padding: '2.5rem',
                    borderRadius: '32px',
                    background: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #f1f5f9'
                }}>
                    {error && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fee2e2', borderRadius: '16px', padding: '1rem', marginBottom: '2rem', color: '#e11d48', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <AlertCircle size={20} />
                            <span style={{ fontWeight: 600 }}>{error}</span>
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleRegistration}>
                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Baby size={22} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Children's Profile</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Salutation</label>
                                    <select value={patientForm.salutation} onChange={e => setPatientForm({ ...patientForm, salutation: e.target.value })}>
                                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>First Name *</label>
                                    <input required placeholder="Arjun" value={patientForm.first_name} onChange={e => setPatientForm({ ...patientForm, first_name: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Middle Name</label>
                                    <input placeholder="Rohit" value={patientForm.middle_name} onChange={e => setPatientForm({ ...patientForm, middle_name: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Last Name *</label>
                                    <input required placeholder="Sharma" value={patientForm.last_name} onChange={e => setPatientForm({ ...patientForm, last_name: e.target.value })} />
                                </div>

                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Gender *</label>
                                    <select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Date of Birth</label>
                                    <input
                                        type="date"
                                        value={patientForm.dob}
                                        onChange={e => {
                                            const dobVal = e.target.value;
                                            if (!dobVal) {
                                                setPatientForm({ ...patientForm, dob: dobVal, age_years: '', age_months: '' });
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
                                            setPatientForm({
                                                ...patientForm,
                                                dob: dobVal,
                                                age_years: Math.max(0, years).toString(),
                                                age_months: Math.max(0, months).toString()
                                            });
                                        }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Age (Y)</label>
                                    <input type="number" placeholder="3" value={patientForm.age_years} onChange={e => setPatientForm({ ...patientForm, age_years: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Age (M)</label>
                                    <input type="number" placeholder="9" value={patientForm.age_months} onChange={e => setPatientForm({ ...patientForm, age_months: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Birth Time</label>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <input type="number" placeholder="Hr" style={{ padding: '0.6rem' }} value={patientForm.birth_time_hours} onChange={e => setPatientForm({ ...patientForm, birth_time_hours: e.target.value })} />
                                        <select style={{ padding: '0.6rem' }} value={patientForm.birth_time_ampm} onChange={e => setPatientForm({ ...patientForm, birth_time_ampm: e.target.value })}>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ margin: '2.5rem 0 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Users size={22} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Parental Contact</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Father's Name</label>
                                    <input placeholder="Rohit Sharma" value={patientForm.father_name} onChange={e => setPatientForm({ ...patientForm, father_name: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Father's Mobile *</label>
                                    <input required placeholder="10 digits" value={patientForm.father_mobile} onChange={e => setPatientForm({ ...patientForm, father_mobile: e.target.value.replace(/\D/g, '').substring(0, 10) })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Mother's Name</label>
                                    <input placeholder="Anjali Sharma" value={patientForm.mother_name} onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Mother's Mobile</label>
                                    <input placeholder="10 digits" value={patientForm.mother_mobile} onChange={e => setPatientForm({ ...patientForm, mother_mobile: e.target.value.replace(/\D/g, '').substring(0, 10) })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>WhatsApp ID for Updates *</label>
                                    <div style={{ position: 'relative' }}>
                                        <Smartphone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input required placeholder="Enter WhatsApp Number" style={{ paddingLeft: '3rem' }} value={patientForm.wa_id} onChange={e => setPatientForm({ ...patientForm, wa_id: e.target.value.replace(/\D/g, '').substring(0, 10) })} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ margin: '2.5rem 0 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <MapPinned size={22} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Location & Other</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Area / Locality *</label>
                                    <input required placeholder="e.g. Bandra" value={patientForm.area} onChange={e => setPatientForm({ ...patientForm, area: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>City</label>
                                    <input placeholder="Mumbai" value={patientForm.city} onChange={e => setPatientForm({ ...patientForm, city: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Email ID</label>
                                    <input type="email" placeholder="parent@example.com" value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Enrollment Option</label>
                                    <select value={patientForm.enrollment_option} onChange={e => setPatientForm({ ...patientForm, enrollment_option: e.target.value })}>
                                        <option value="just_enroll">Join Registry Only</option>
                                        <option value="book_appointment">Enroll & Book Now</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary-lg" style={{ width: '100%', marginTop: '3rem' }}>
                                {loading ? <RefreshCw size={24} className="animate-spin" /> : 'Create Clinical Profile'}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleBooking}>
                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Calendar size={22} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Schedule Appointment</h2>
                            </div>
                            {/* ... simplified booking ... */}
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <label>Visit Date</label>
                                <input type="date" min={new Date().toISOString().split('T')[0]} value={bookingForm.appointment_date} onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })} />

                                <label>Available Slots</label>
                                {slotsLoading ? <RefreshCw className="animate-spin" /> : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                        {availableSlots.map(s => (
                                            <button key={s.slot_id} type="button" onClick={() => setBookingForm({ ...bookingForm, slot_id: s.slot_id })} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid', borderColor: bookingForm.slot_id === s.slot_id ? 'var(--primary)' : '#e2e8f0', background: bookingForm.slot_id === s.slot_id ? '#eff6ff' : '#fff', fontWeight: 700 }}>{s.label}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn-primary-lg" style={{ width: '100%', marginTop: '2rem' }}>Confirm Appointment</button>
                        </form>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fdf4', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                <Check size={48} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Activation Successful!</h2>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Your clinical record is now active. You will receive updates on WhatsApp.</p>
                            <button onClick={() => window.location.reload()} className="btn-primary-lg" style={{ marginTop: '2.5rem', width: '100%' }}>Return to Home</button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                :root { --primary: #6366f1; }
                input, select { 
                    width: 100%; 
                    padding: 0.75rem 1rem; 
                    border-radius: 14px; 
                    border: 2px solid #f1f5f9; 
                    margin-top: 0.4rem; 
                    font-size: 0.95rem; 
                    font-weight: 600;
                    outline: none;
                    transition: all 0.2s;
                    color: #1e293b;
                }
                input:focus, select:focus { border-color: #6366f1; background: #fff; }
                label { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                .btn-primary-lg {
                    height: 64px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    border: none;
                    border-radius: 20px;
                    font-size: 1.1rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
                    transition: all 0.2s;
                }
                .btn-primary-lg:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default PublicRegister;
