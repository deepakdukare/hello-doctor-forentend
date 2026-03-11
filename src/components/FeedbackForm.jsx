import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send, User, Phone, Smile, RefreshCw, Activity, ArrowRight, BriefcaseMedical, Headphones, HeartPulse } from 'lucide-react';
import { submitFeedback } from '../api/index';
import doctorAvatar from '../assets/doctor-avatar.png';
import frontdeskAvatar from '../assets/frontdesk-avatar.png';
import clinicIcon from '../assets/logo.jpg';

const FeedbackForm = ({ appointmentId = null, onComplete = null }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        name: '',
        mobile: '',
        doctor_rating: 0,
        frontdesk_rating: 0,
        hospital_rating: 0,
        appointment_id: appointmentId
    });

    const categories = [
        { key: 'doctor_rating', label: 'Doctor Interaction', title: 'Doctor' },
        { key: 'frontdesk_rating', label: 'Front-desk Service', title: 'Front-desk' },
        { key: 'hospital_rating', label: 'Clinic Atmosphere', title: 'Clinic' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.doctor_rating === 0 || form.frontdesk_rating === 0 || form.hospital_rating === 0) {
            setError("Please provide all ratings before submitting.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await submitFeedback(form);
            setStep(2);
            if (onComplete) onComplete();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit feedback. Check your connectivity.");
        } finally {
            setLoading(false);
        }
    };

    const SuccessState = () => {
        React.useEffect(() => {
            const timer = setTimeout(() => {
                if (onComplete) onComplete();
                else navigate('/');
            }, 3000);
            return () => clearTimeout(timer);
        }, []);

        return (
            <div className="success-state-v2">
                <div className="success-icon-v2">
                    <Smile size={64} />
                </div>
                <h3>Feedback Submitted!</h3>
                <p>Thank you for sharing your experience with us.</p>
                <div style={{ marginTop: '2rem' }}>
                    <RefreshCw className="spinning" size={32} style={{ color: '#6366f1' }} />
                </div>
            </div>
        );
    };

    if (step === 2) return <SuccessState />;

    return (
        <form onSubmit={handleSubmit} className="feedback-form-comp">
            <div className="feedback-form-card">
                <div className="feedback-hero-v2">
                    <div className="feedback-branding">
                        <img src={clinicIcon} alt="Logo" className="feedback-logo-mini" />
                        <div className="feedback-branding-text">
                            <span className="feedback-brand-main">DR. INDU'S NEW BORN</span>
                            <span className="feedback-brand-sub">CHILDCARE CENTER</span>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#1e293b' }}>
                        Patient Feedback
                    </h2>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Your feedback helps us deliver the highest quality pediatric care.
                    </p>
                </div>

                <div className="feedback-divider-v2"></div>

                <div className="feedback-section-v2">
                    <div className="feedback-inputs-grid-v2">
                        <div className="feedback-input-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="feedback-field"
                            />
                        </div>
                        <div className="feedback-input-group">
                            <label>Mobile Number</label>
                            <input
                                type="tel"
                                required
                                value={form.mobile}
                                onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
                                className="feedback-field"
                            />
                        </div>
                        <div className="feedback-input-group full-width">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={form.email || ''}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="feedback-field"
                            />
                        </div>
                    </div>
                </div>

                <div className="feedback-divider-v2"></div>

                <div className="feedback-section-v2">
                    <span className="feedback-label-v2 compact">Service Calibration</span>
                    <div className="rating-grid-compact-v2">
                        {categories.map((cat) => (
                            <div key={cat.key} className="rating-item-compact-v2">
                                <div className="rating-cat-head-compact">
                                    <div className="rating-cat-icon-mini">
                                        {cat.key === 'doctor_rating' && <img src={doctorAvatar} alt="Doctor" />}
                                        {cat.key === 'frontdesk_rating' && <img src={frontdeskAvatar} alt="Front-desk" />}
                                        {cat.key === 'hospital_rating' && <img src={clinicIcon} alt="Clinic" />}
                                    </div>
                                    <div className="rating-texts">
                                        <span className="rating-title-main">{cat.title}</span>
                                        <label>{cat.label}</label>
                                    </div>
                                </div>
                                <div className="star-strip-v2-mini">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            className={`rating-btn-v2 ${form[cat.key] === s ? 'active' : ''}`}
                                            onClick={() => setForm({ ...form, [cat.key]: s })}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="feedback-divider-v2"></div>

                {error && (
                    <div className="doc-alert doc-alert-error" style={{ marginBottom: '1.5rem', borderRadius: '12px' }}>
                        <Activity size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="feedback-footer-v2">
                    <button type="submit" disabled={loading} className="btn-submit-v2">
                        {loading ? <RefreshCw className="spinning" /> : <><span>Submit Feedback</span> <Send size={20} /></>}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default FeedbackForm;
