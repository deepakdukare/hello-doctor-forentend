import React, { useState, useEffect, useCallback } from 'react';
import {
    UserPlus, CheckCircle, AlertCircle, Calendar, User, Phone,
    MapPin, FileText, Share2, ClipboardCheck, ArrowRight,
    ChevronRight, Clock, Heart, ShieldCheck, Stethoscope,
    ChevronLeft, Check, Sparkles, RefreshCw, Smartphone,
    MapPinned, UserCheck2, Baby
} from 'lucide-react';
import { registerFromForm, bookByForm, getAvailableSlots, getDoctors } from '../api/index';

const SALUTATIONS = ['Master', 'Miss', 'Baby of', 'Mr.', 'Mrs.'];
const CITIES = ['Mumbai', 'Thane', 'Navi Mumbai', 'Pune', 'Other'];

const PublicRegister = () => {
    const [step, setStep] = useState(1); // 1: Registration, 2: Booking, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [doctors, setDoctors] = useState([]);

    // Step 1: Registration Data
    const [patientForm, setPatientForm] = useState({
        salutation: 'Master',
        first_name: '',
        last_name: '',
        gender: 'Male',
        dob_unknown: false,
        dob: '',
        wa_id: '',
        father_name: '',
        mother_name: '',
        area: '',
        city: 'Mumbai',
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
            await registerFromForm(patientForm);
            setBookingForm(prev => ({ ...prev, wa_id: patientForm.wa_id }));
            setStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            if (err.response?.data?.error_code === 'PATIENT_EXISTS') {
                // Patient already exists, proceed to booking
                setBookingForm(prev => ({ ...prev, wa_id: patientForm.wa_id }));
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setError(err.response?.data?.message || "Registration failed. Please try again.");
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
                { s: 1, label: 'Details', icon: <User size={16} /> },
                { s: 2, label: 'Schedule', icon: <Calendar size={16} /> },
                { s: 3, label: 'Done', icon: <CheckCircle size={16} /> }
            ].map((item, idx) => (
                <React.Fragment key={item.s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', opacity: step >= item.s ? 1 : 0.5, transition: 'all 0.3s' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: step === item.s ? 'var(--primary)' : (step > item.s ? '#10b981' : '#e2e8f0'),
                            color: step >= item.s ? '#fff' : '#64748b',
                            boxShadow: step === item.s ? '0 8px 15px rgba(99, 102, 241, 0.3)' : 'none'
                        }}>
                            {step > item.s ? <Check size={18} /> : item.icon}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: step === item.s ? 'var(--primary)' : '#64748b' }}>{item.label}</span>
                    </div>
                    {idx < 2 && <div style={{ width: '20px', height: '2px', background: step > item.s ? '#10b981' : '#e2e8f0' }} />}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(rgba(248, 250, 252, 0.94), rgba(248, 250, 252, 0.94)), url('https://antigravity-artifacts.s3.amazonaws.com/clinic_background_clean_1772100690846.png')`, // Fallback for local dev, usually these are relative
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem 1rem'
        }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                {/* Header Section */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: '#fff', borderRadius: '24px', boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)', marginBottom: '1.25rem' }}>
                        <Stethoscope size={36} color="var(--primary)" />
                    </div>
                    <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: '#1e293b', letterSpacing: '-0.5px' }}>Dr. Indu Child Care</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 600 }}>Smart Patient Enrollment & Appointment Booking</p>
                </div>

                {renderProgress()}

                {/* Form Card */}
                <div className="card" style={{
                    padding: '2.5rem',
                    borderRadius: '32px',
                    border: '1px solid rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.08), 0 18px 36px -18px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#ef4444', display: 'flex', gap: '0.75rem', alignItems: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                            <AlertCircle size={20} />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{error}</span>
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleRegistration} style={{ animation: 'fadeIn 0.5s ease-out' }}>
                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Baby size={20} color="var(--primary)" />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Patient Registration</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>Salutation</label>
                                    <select value={patientForm.salutation} onChange={e => setPatientForm({ ...patientForm, salutation: e.target.value })}>
                                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 1' }}>
                                    <label>First Name *</label>
                                    <input required placeholder="Enter first name" value={patientForm.first_name} onChange={e => setPatientForm({ ...patientForm, first_name: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Last Name *</label>
                                    <input required placeholder="Enter last name" value={patientForm.last_name} onChange={e => setPatientForm({ ...patientForm, last_name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Gender *</label>
                                    <select value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Date of Birth *</label>
                                    <input type="date" required value={patientForm.dob} onChange={e => setPatientForm({ ...patientForm, dob: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>WhatsApp Number * (Primary Contact)</label>
                                    <div style={{ position: 'relative' }}>
                                        <Smartphone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            required
                                            placeholder="10-digit mobile number"
                                            style={{ paddingLeft: '3rem' }}
                                            value={patientForm.wa_id}
                                            onChange={e => setPatientForm({ ...patientForm, wa_id: e.target.value.replace(/\D/g, '').substring(0, 10) })}
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', paddingLeft: '0.5rem' }}>Used for sending confirmation and reminders via WhatsApp.</p>
                                </div>
                                <div>
                                    <label>Father's Name</label>
                                    <input placeholder="Father's full name" value={patientForm.father_name} onChange={e => setPatientForm({ ...patientForm, father_name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Mother's Name</label>
                                    <input placeholder="Mother's full name" value={patientForm.mother_name} onChange={e => setPatientForm({ ...patientForm, mother_name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Area / Locality</label>
                                    <div style={{ position: 'relative' }}>
                                        <MapPin size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input style={{ paddingLeft: '2.75rem' }} placeholder="e.g. Colaba" value={patientForm.area} onChange={e => setPatientForm({ ...patientForm, area: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label>City</label>
                                    <select value={patientForm.city} onChange={e => setPatientForm({ ...patientForm, city: e.target.value })}>
                                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '58px', borderRadius: '16px', fontSize: '1rem', fontWeight: 700 }}>
                                {loading ? <RefreshCw size={20} className="animate-spin" /> : <>Register & Continue <ArrowRight size={20} /></>}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleBooking} style={{ animation: 'fadeIn 0.5s ease-out' }}>
                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', background: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calendar size={20} color="#d97706" />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Schedule Visit</h2>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div>
                                    <label>Preferred Date *</label>
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={bookingForm.appointment_date}
                                        onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label>Type of Visit</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                        {['CONSULTATION', 'VACCINATION'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setBookingForm({ ...bookingForm, visit_type: type })}
                                                style={{
                                                    padding: '1rem', borderRadius: '16px', border: '2px solid',
                                                    background: bookingForm.visit_type === type ? 'var(--primary-light)' : '#fff',
                                                    borderColor: bookingForm.visit_type === type ? 'var(--primary)' : '#e2e8f0',
                                                    color: bookingForm.visit_type === type ? 'var(--primary)' : '#64748b',
                                                    fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ marginBottom: '0.75rem' }}>Available Time Slots *</label>
                                    {slotsLoading ? (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw size={24} className="animate-spin" color="var(--primary)" /></div>
                                    ) : availableSlots.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#fef2f2', borderRadius: '16px', color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                                            No slots available for this date.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                                            {availableSlots.map(slot => (
                                                <button
                                                    key={slot.slot_id}
                                                    type="button"
                                                    onClick={() => setBookingForm({ ...bookingForm, slot_id: slot.slot_id })}
                                                    style={{
                                                        padding: '0.85rem', borderRadius: '14px', border: '2px solid',
                                                        background: bookingForm.slot_id === slot.slot_id ? 'var(--primary)' : '#fff',
                                                        borderColor: bookingForm.slot_id === slot.slot_id ? 'var(--primary)' : '#e2e8f0',
                                                        color: bookingForm.slot_id === slot.slot_id ? '#fff' : '#1e293b',
                                                        fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                                                        boxShadow: bookingForm.slot_id === slot.slot_id ? '0 8px 15px rgba(99, 102, 241, 0.2)' : 'none'
                                                    }}
                                                >
                                                    {slot.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                                <button type="button" onClick={() => setStep(1)} className="btn btn-outline" style={{ flex: 1, borderRadius: '16px', height: '56px' }}>
                                    <ChevronLeft size={20} /> Back
                                </button>
                                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, height: '56px', borderRadius: '16px', fontSize: '1rem' }}>
                                    {loading ? 'Confirming...' : 'Book Appointment'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '1rem 0', animation: 'fadeIn 0.6s ease-out' }}>
                            <div style={{ width: '70px', height: '70px', background: '#ecfdf5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.15)' }}>
                                <CheckCircle size={40} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem 0' }}>Booking Confirmed!</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>Your appointment has been successfully scheduled. A confirmation message will be sent to your WhatsApp number.</p>

                            <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '1.25rem', marginBottom: '2rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <div style={{ display: 'grid', gap: '0.85rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Patient</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{patientForm.first_name} {patientForm.last_name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Date</span>
                                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>{new Date(bookingForm.appointment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Time</span>
                                        <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{availableSlots.find(s => s.slot_id === bookingForm.slot_id)?.label}</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: '0.85rem 2.5rem', borderRadius: '14px', width: '100%' }}>
                                Done, Thank You
                            </button>
                        </div>
                    )}
                </div>

                {/* Trust Badges */}
                <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                        <ShieldCheck size={18} color="#10b981" /> 256-bit Secure
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Heart size={18} color="#ef4444" /> Trusted Care
                    </div>
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>© 2026 Dr. Indu Child Care Clinic. All rights reserved.</p>
                </div>
            </div>

            <style>{`
                input, select, textarea {
                    width: 100%;
                    padding: 0.85rem 1.1rem;
                    border-radius: 14px;
                    border: 1.5px solid #e2e8f0;
                    margin-top: 0.5rem;
                    outline: none;
                    font-size: 0.95rem;
                    background: #fff;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                    color: #1e293b;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }
                input:focus, select:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1), 0 4px 6px -1px rgba(99, 102, 241, 0.05);
                }
                label {
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: #475569;
                    display: block;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); } to { transform: rotate(360deg); }
                }
                @media (max-width: 480px) {
                    .card {
                        padding: 1.5rem !important;
                    }
                    h1 {
                        font-size: 1.75rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PublicRegister;
