import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Check, AlertCircle,
    User, Smartphone, Mail, MapPin, Calendar,
    MessageSquare, Activity, ShieldCheck, RefreshCw,
    Baby, Users, ClipboardList, Clock, Briefcase, Heart
} from 'lucide-react';

const RegistrationWizard = ({ onComplete, onCancel, submitting }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState({
        salutation: 'Master',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: '',
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
        enrollment_option: 'just_enroll'
    });

    const [tempValue, setTempValue] = useState('');
    const [error, setError] = useState('');

    const steps = [
        {
            id: 1,
            field: 'salutation',
            title: "How should we address the child?",
            type: 'selection',
            options: ['Master', 'Miss', 'Baby', 'Baby of', 'Mr.', 'Ms.'],
            icon: <Baby size={24} />,
            validate: (val) => val ? null : "Please select a salutation"
        },
        {
            id: 2,
            field: 'first_name',
            title: "Child's First Name",
            placeholder: "e.g. Arjun",
            icon: <User size={24} />,
            validate: (val) => val.length >= 2 ? null : "First name is required (min 2 chars)",
            format: (val) => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
        },
        {
            id: 3,
            field: 'middle_name',
            title: "Middle Name (Optional)",
            placeholder: "e.g. Rohit or type SKIP",
            icon: <User size={24} />,
            validate: (val) => null,
            format: (val) => val.toUpperCase() === 'SKIP' ? '' : val
        },
        {
            id: 4,
            field: 'last_name',
            title: "Surname / Last Name",
            placeholder: "e.g. Sharma",
            icon: <User size={24} />,
            validate: (val) => val.length >= 2 ? null : "Last name is required",
            format: (val) => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
        },
        {
            id: 5,
            field: 'gender',
            title: "Gender",
            type: 'selection',
            options: ['Male', 'Female', 'Other'],
            icon: <Activity size={24} />,
            validate: (val) => val ? null : "Selection required"
        },
        {
            id: 6,
            field: 'dob',
            title: "Date of Birth",
            type: 'date',
            icon: <Calendar size={24} />,
            validate: (val) => {
                if (!val) return null; // DOB can be optional if Age is provided
                if (new Date(val) > new Date()) return "Date cannot be in the future";
                return null;
            }
        },
        {
            id: 7,
            field: 'age_years',
            title: "Age (Years)",
            type: 'number',
            placeholder: "e.g. 3",
            icon: <Activity size={24} />,
            validate: (val) => null
        },
        {
            id: 8,
            field: 'age_months',
            title: "Age (Months)",
            type: 'number',
            placeholder: "e.g. 9",
            icon: <Activity size={24} />,
            validate: (val) => null
        },
        {
            id: 9,
            field: 'birth_time_hours',
            title: "Birth Time (Hours)",
            type: 'number',
            placeholder: "1-12",
            icon: <Clock size={24} />,
            validate: (val) => (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) ? null : "Enter 1-12"
        },
        {
            id: 10,
            field: 'birth_time_minutes',
            title: "Birth Time (Minutes)",
            type: 'number',
            placeholder: "0-59",
            icon: <Clock size={24} />,
            validate: (val) => (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) ? null : "Enter 0-59"
        },
        {
            id: 11,
            field: 'birth_time_ampm',
            title: "Time Period",
            type: 'selection',
            options: ['AM', 'PM'],
            icon: <Clock size={24} />,
            validate: (val) => val ? null : "Selection required"
        },
        {
            id: 12,
            field: 'father_name',
            title: "Father's Full Name",
            placeholder: "e.g. Rohit Sharma",
            icon: <Users size={24} />,
            validate: (val) => val.length >= 3 ? null : "Full name required"
        },
        {
            id: 13,
            field: 'father_mobile',
            title: "Father's Mobile Number",
            placeholder: "10-digit number",
            icon: <Smartphone size={24} />,
            validate: (val) => /^[6-9]\d{9}$/.test(val) ? null : "Enter valid 10-digit Indian mobile"
        },
        {
            id: 14,
            field: 'father_occupation',
            title: "Father's Occupation",
            placeholder: "e.g. Engineer",
            icon: <Briefcase size={24} />,
            validate: (val) => null
        },
        {
            id: 15,
            field: 'mother_name',
            title: "Mother's Full Name",
            placeholder: "e.g. Anjali Sharma",
            icon: <Heart size={24} />,
            validate: (val) => val.length >= 3 ? null : "Full name required"
        },
        {
            id: 16,
            field: 'mother_mobile',
            title: "Mother's Mobile Number",
            placeholder: "10-digit number",
            icon: <Smartphone size={24} />,
            validate: (val) => (val === '' || /^[6-9]\d{9}$/.test(val)) ? null : "Enter valid 10-digit mobile"
        },
        {
            id: 17,
            field: 'wa_id',
            title: "WhatsApp ID for Updates",
            placeholder: "Same as father/mother mobile?",
            icon: <MessageSquare size={24} />,
            validate: (val) => /^[6-9]\d{9}$/.test(val) ? null : "Enter valid 10-digit mobile"
        },
        {
            id: 18,
            field: 'area',
            title: "Residential Area",
            placeholder: "e.g. Bandra",
            icon: <MapPin size={24} />,
            validate: (val) => val ? null : "Area is required"
        },
        {
            id: 19,
            field: 'city',
            title: "City",
            placeholder: "e.g. Mumbai",
            icon: <MapPin size={24} />,
            validate: (val) => val ? null : "City is required"
        },
        {
            id: 20,
            field: 'pin_code',
            title: "Pin Code",
            type: 'number',
            placeholder: "6-digit code",
            icon: <MapPin size={24} />,
            validate: (val) => /^\d{6}$/.test(val) ? null : "Enter valid 6-digit pin"
        },
        {
            id: 21,
            field: 'email',
            title: "Parent's Email Address",
            type: 'email',
            placeholder: "e.g. parent@example.com",
            icon: <Mail size={24} />,
            validate: (val) => (!val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) ? null : "Invalid email"
        },
        {
            id: 22,
            field: 'doctor',
            title: "Preferred Doctor",
            type: 'selection',
            options: ['Dr. Indu', 'Dr. Sharma', 'Dr. Patil'],
            icon: <User size={24} />,
            validate: (val) => val ? null : "Selection required"
        },
        {
            id: 23,
            field: 'enrollment_option',
            title: "Enrollment Intent",
            type: 'selection',
            options: ['just_enroll', 'book_appointment'],
            icon: <ShieldCheck size={24} />,
            validate: (val) => val ? null : "Selection required"
        },
        {
            id: 24,
            field: 'summary',
            title: "Review Application",
            type: 'summary',
            icon: <ShieldCheck size={24} />,
            validate: () => null
        }
    ];

    const currentStepData = steps[currentStep - 1];

    useEffect(() => {
        if (currentStepData.field !== 'summary') {
            setTempValue(data[currentStepData.field] || '');
        }
        setError('');
    }, [currentStep]);

    const handleNext = () => {
        const errorMsg = currentStepData.validate(tempValue);
        if (errorMsg) {
            setError(errorMsg);
            return;
        }

        const formattedValue = currentStepData.format ? currentStepData.format(tempValue) : tempValue;
        let newData = { ...data, [currentStepData.field]: formattedValue };

        if (currentStepData.field === 'dob' && formattedValue) {
            const birthDate = new Date(formattedValue);
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
            newData.age_years = Math.max(0, years).toString();
            newData.age_months = Math.max(0, months).toString();
        }

        setData(newData);
        setError('');

        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const renderField = () => {
        if (currentStepData.type === 'selection') {
            return (
                <div style={styles.selectionGrid}>
                    {currentStepData.options.map(opt => (
                        <button
                            key={opt}
                            style={{
                                ...styles.selectionBtn,
                                border: tempValue === opt ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                                background: tempValue === opt ? '#eff6ff' : '#fff',
                                color: tempValue === opt ? 'var(--primary)' : '#64748b'
                            }}
                            onClick={() => {
                                setTempValue(opt);
                                setError('');
                            }}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            );
        }

        if (currentStepData.type === 'summary') {
            return (
                <div style={styles.summaryContainer}>
                    <div style={styles.summaryGrid}>
                        {steps.filter(s => s.type !== 'summary').map(s => (
                            <div key={s.id} style={styles.summaryItem}>
                                <div style={styles.summaryLabel}>{s.field.replace(/_/g, ' ')}</div>
                                <div style={styles.summaryValue}>{data[s.field] || '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <input
                type={currentStepData.type || 'text'}
                style={styles.input}
                placeholder={currentStepData.placeholder}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                autoFocus
            />
        );
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.titleRow}>
                        <div style={styles.iconCircle}>
                            <ClipboardList size={22} color="var(--primary)" />
                        </div>
                        <div>
                            <h2 style={styles.headerTitle}>Sequential Enrollment</h2>
                            <p style={styles.headerSub}>Step {currentStep} of {steps.length}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${(currentStep / steps.length) * 100}%` }} />
                </div>

                <div style={styles.content}>
                    <div style={styles.stepTitleRow}>
                        <div style={styles.stepIcon}>{currentStepData.icon}</div>
                        <h3 style={styles.stepTitle}>{currentStepData.title}</h3>
                    </div>

                    <div style={styles.fieldWrapper}>
                        {renderField()}
                    </div>

                    {error && (
                        <div style={styles.errorBox}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div style={styles.footer}>
                    <button onClick={handleBack} style={{ ...styles.btn, ...styles.btnSec }} disabled={currentStep === 1 || submitting}>
                        <ChevronLeft size={20} /> Back
                    </button>

                    {currentStep === steps.length ? (
                        <button onClick={() => onComplete(data)} style={{ ...styles.btn, ...styles.btnPri }} disabled={submitting}>
                            {submitting ? <RefreshCw size={20} className="animate-spin" /> : <><Check size={20} /> Confirm Registration</>}
                        </button>
                    ) : (
                        <button onClick={handleNext} style={{ ...styles.btn, ...styles.btnPri }} disabled={submitting}>
                            Continue <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    card: { width: '100%', maxWidth: '550px', backgroundColor: '#fff', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' },
    header: { padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' },
    titleRow: { display: 'flex', alignItems: 'center', gap: '1rem' },
    iconCircle: { width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 },
    headerSub: { fontSize: '0.8rem', color: '#94a3b8', margin: 0, fontWeight: 600 },
    closeBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem' },
    progressBar: { height: '4px', backgroundColor: '#f1f5f9', width: '100%' },
    progressFill: { height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.4s ease' },
    content: { padding: '2.5rem 2rem', minHeight: '350px', display: 'flex', flexDirection: 'column' },
    stepTitleRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' },
    stepIcon: { color: 'var(--primary)' },
    stepTitle: { fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.5px' },
    fieldWrapper: { flex: 1, display: 'flex', flexDirection: 'column' },
    input: { width: '100%', fontSize: '1.25rem', padding: '1rem 0', border: 'none', borderBottom: '2px solid #e2e8f0', outline: 'none', fontWeight: 600, color: '#1e293b' },
    selectionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    selectionBtn: { padding: '1.1rem', borderRadius: '18px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    errorBox: { marginTop: '1rem', backgroundColor: '#fff1f2', color: '#e11d48', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' },
    footer: { padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '1rem' },
    btn: { padding: '0.85rem 1.5rem', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none' },
    btnPri: { backgroundColor: 'var(--primary)', color: '#fff', flex: 1, justifyContent: 'center' },
    btnSec: { backgroundColor: '#f1f5f9', color: '#64748b' },
    summaryContainer: { maxHeight: '380px', overflowY: 'auto' },
    summaryGrid: { display: 'grid', gap: '0.6rem' },
    summaryItem: { padding: '0.8rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' },
    summaryLabel: { fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.15rem' },
    summaryValue: { fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }
};

export default RegistrationWizard;
