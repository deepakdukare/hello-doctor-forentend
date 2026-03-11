import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, RefreshCw, Users, Clock, Hash } from 'lucide-react';
import { getClinicDisplayData, toIsoDate } from '../api/index';
import { removeSalutation } from '../utils/formatters';
import clinicLogo from '../assets/logo.jpg';

const ClinicDisplay = () => {
    const [displayData, setDisplayData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchData = useCallback(async () => {
        try {
            const today = toIsoDate();
            const res = await getClinicDisplayData({ date: today });
            setDisplayData(res.data?.display || res.data?.data || []);
            setError(null);
        } catch (err) {
            console.error('Display Data Error:', err);
            setError('Refreshing...');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const formatDate = (date) => date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="clinic-display-v2">
            <header className="clinic-display-header">
                <div className="clinic-display-logo-box">
                    <img src={clinicLogo} alt="Clinic Logo" className="clinic-display-logo-img" />
                    <div className="clinic-display-brand">
                        <h1>DR. INDU'S NEW BORN & CHILDCARE CENTER</h1>
                        <p>PREMIUM PEDIATRIC CARE • O.P.D. MANAGEMENT</p>
                    </div>
                </div>

                <div className="clinic-display-clock shadow-sm">
                    <div className="time">{formatTime(currentTime)}</div>
                    <div className="date">{formatDate(currentTime)}</div>
                </div>
            </header>

            <main className="clinic-display-main">
                {displayData.length > 0 ? (
                    <div className="clinic-display-grid-v2">
                        {displayData.map((doctor) => (
                            <div key={doctor.doctor_id} className="doctor-card-v2">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h2>{doctor.doctor_name}</h2>
                                        <div className="specialty-label">
                                            {doctor.speciality || 'Pediatrics Specialist'}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 900,
                                        background: doctor.status === 'PRESENT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: doctor.status === 'PRESENT' ? '#10b981' : '#ef4444',
                                        border: `1px solid ${doctor.status === 'PRESENT' ? '#10b98140' : '#ef444440'}`,
                                        letterSpacing: '0.05em'
                                    }}>
                                        {doctor.status === 'PRESENT' ? '● IN-SESSION' : '● ON-BREAK'}
                                    </div>
                                </div>

                                <div className="serving-section-v2" style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.2em', marginBottom: '0.5rem' }}>NOW SERVING</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <Hash size={32} color="#6366f1" />
                                        <span>{doctor.now_serving_token || '—'}</span>
                                    </div>
                                    <div className="patient-label" style={{ marginTop: '0.5rem', opacity: 0.9 }}>
                                        {removeSalutation(doctor.now_serving_patient) || 'Waiting...'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div className="stat-box-v2" style={{ flex: 1 }}>
                                        <div className="icon-wrap">
                                            <Users size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>QUEUE</div>
                                            <div className="val">{doctor.queue_length || 0} Patients</div>
                                        </div>
                                    </div>
                                    <div className="stat-box-v2" style={{ flex: 1 }}>
                                        <div className="icon-wrap">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>DELAY</div>
                                            <div className="val">{doctor.eta_time || 'None'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="next-up-v2">
                                    <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em' }}>NEXT UP</span>
                                    <span style={{ fontWeight: 900, color: '#818cf8', fontSize: '1rem' }}>
                                        {doctor.next_token ? `TOKEN ${doctor.next_token}` : 'EMPTY'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', opacity: 0.3 }}>
                        <Monitor size={64} strokeWidth={1} style={{ marginBottom: '1.5rem', color: '#fff' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>SESSIONS INACTIVE</h2>
                    </div>
                )}
            </main>

            {error && (
                <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, zIndex: 1000, backdropFilter: 'blur(10px)' }}>
                    <RefreshCw size={16} className="animate-spin inline mr-2" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default ClinicDisplay;


