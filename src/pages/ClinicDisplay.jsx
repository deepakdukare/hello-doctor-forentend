import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, RefreshCw, User, Users, Clock, Hash, ArrowRight, Activity, Zap } from 'lucide-react';
import { getClinicDisplayData, toIsoDate } from '../api/index';
import { removeSalutation } from '../utils/formatters';

const ClinicDisplay = () => {
    const [displayData, setDisplayData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchData = useCallback(async () => {
        try {
            const today = toIsoDate();
            const res = await getClinicDisplayData({ date: today });
            setDisplayData(res.data?.display || res.data?.data || []);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            console.error('Display Data Error:', err);
            setError('Syncing...');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, [fetchData]);

    const getTimeStr = () => lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="clinic-display-v2">
            <div className="display-header-v2">
                <div className="header-brand-v2">
                    <div className="brand-icon-v2">🩺</div>
                    <div className="brand-text-v2">
                        <h1>Dr. Indu Child Care</h1>
                    </div>
                </div>
                <div className="header-meta-v2">
                    <div className="time-box-v2">{getTimeStr()}</div>
                    <div className="sync-pill-v2">
                        <div className="sync-dot-v2 animate-pulse"></div>
                        <span>Live Sync</span>
                    </div>
                </div>
            </div>

            <div className="display-grid-v2">
                {displayData.map((doctor) => (
                    <div key={doctor.doctor_id} className="doctor-card-v2">
                        <div className="card-top-v2">
                            <div className="doctor-info-v2">
                                <h2 className="doctor-name-v2">{doctor.doctor_name}</h2>
                                <span className="speciality-tag-v2">{doctor.speciality || 'Pediatrics'}</span>
                            </div>
                            <div className={`status-pill-v2 ${doctor.status === 'PRESENT' ? 'online' : 'away'}`}>
                                {doctor.status === 'PRESENT' ? 'In-Session' : 'On-Break'}
                            </div>
                        </div>

                        <div className="serving-section-v2">
                            <div className="serving-label-v2">NOW SERVING</div>
                            <div className="serving-token-v2">
                                {doctor.now_serving_token ? (
                                    <>
                                        <Hash size={40} className="hash-icon-v2" />
                                        <span>{doctor.now_serving_token}</span>
                                    </>
                                ) : (
                                    <span className="empty-val-v2">—</span>
                                )}
                            </div>
                            <div className="patient-name-v2">
                                {removeSalutation(doctor.now_serving_patient) || 'Waiting for next patient'}
                            </div>
                        </div>

                        <div className="card-stats-v2">
                            <div className="stat-item-v2">
                                <Users size={20} />
                                <span>{doctor.queue_length || 0} in queue</span>
                            </div>
                            <div className="stat-divider-v2"></div>
                            <div className="stat-item-v2">
                                <Clock size={20} />
                                <span>{doctor.eta_time || 'No Delay'}</span>
                            </div>
                        </div>

                        <div className="next-up-v2">
                            <div className="next-label-v2">NEXT UP</div>
                            <div className="next-token-v2">
                                {doctor.next_token ? `Token ${doctor.next_token}` : 'Queue Empty'}
                            </div>
                        </div>
                    </div>
                ))}

                {displayData.length === 0 && !loading && (
                    <div className="empty-display-v2">
                        <Monitor size={64} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                        <h3>No Active O.P.D Handlers</h3>
                        <p>Waiting for doctors to start their sessions.</p>
                    </div>
                )}
            </div>

            <div className="display-footer-v2">
                <div className="ticker-v2">
                    <span className="ticker-label-v2">ANNOUNCEMENT:</span>
                    <marquee behavior="scroll" direction="left">
                        Welcome to Dr. Indu Child Care. Please wait for your token number to appear on the screen.
                        Carry your registry ID for faster check-in. Total today visits: {displayData.reduce((acc, d) => acc + (d.queue_length || 0) + (d.now_serving_token ? 1 : 0), 0)}
                    </marquee>
                </div>
            </div>

            <style>{`
                .clinic-display-v2 {
                    min-height: 100vh;
                    background: #0f172a;
                    color: #fff;
                    padding: 3rem;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    display: flex;
                    flex-direction: column;
                    gap: 3rem;
                }

                .display-header-v2 {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(30, 41, 59, 0.5);
                    padding: 2rem 3rem;
                    border-radius: 32px;
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .header-brand-v2 {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .brand-icon-v2 {
                    font-size: 3rem;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    width: 72px;
                    height: 72px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 20px;
                    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
                }

                .brand-text-v2 h1 {
                    font-size: 2.25rem;
                    font-weight: 900;
                    margin: 0;
                    letter-spacing: -0.03em;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .header-meta-v2 {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }

                .time-box-v2 {
                    font-size: 3.5rem;
                    font-weight: 800;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: -0.02em;
                }

                .sync-pill-v2 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    padding: 0.6rem 1.25rem;
                    border-radius: 50px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    font-size: 0.9rem;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .sync-dot-v2 {
                    width: 10px;
                    height: 10px;
                    background: #10b981;
                    border-radius: 50%;
                    box-shadow: 0 0 15px #10b981;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.4; }
                }
                .animate-pulse { animation: pulse 2s infinite ease-in-out; }

                .display-grid-v2 {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                    gap: 2.5rem;
                    flex: 1;
                }

                .doctor-card-v2 {
                    background: #1e293b;
                    border-radius: 40px;
                    padding: 2.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.2);
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.3s;
                }

                .doctor-card-v2:before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 4px;
                    background: linear-gradient(to right, #6366f1, #06b6d4);
                }

                .card-top-v2 {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .doctor-name-v2 {
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .speciality-tag-v2 {
                    display: inline-block;
                    margin-top: 0.5rem;
                    color: #94a3b8;
                    font-weight: 600;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .status-pill-v2 {
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .status-pill-v2.online { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .status-pill-v2.away { background: rgba(148, 163, 184, 0.1); color: #94a3b8; }

                .serving-section-v2 {
                    background: rgba(15, 23, 42, 0.4);
                    border-radius: 32px;
                    padding: 2rem;
                    text-align: center;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .serving-label-v2 {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: #6366f1;
                    letter-spacing: 0.2em;
                    margin-bottom: 1.5rem;
                }

                .serving-token-v2 {
                    font-size: 7rem;
                    font-weight: 950;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    color: #fff;
                    margin-bottom: 1rem;
                    text-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
                }

                .hash-icon-v2 {
                    color: #6366f1;
                    opacity: 0.5;
                }

                .empty-val-v2 { color: #334155; }

                .patient-name-v2 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #94a3b8;
                    margin: 0;
                }

                .card-stats-v2 {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 2rem;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 1rem;
                    border-radius: 20px;
                }

                .stat-item-v2 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #94a3b8;
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .stat-divider-v2 {
                    width: 1px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                }

                .next-up-v2 {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 1rem;
                    border-top: 1px dashed rgba(255, 255, 255, 0.1);
                }

                .next-label-v2 {
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: #64748b;
                    letter-spacing: 0.1em;
                }

                .next-token-v2 {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #06b6d4;
                }

                .display-footer-v2 {
                    background: #1e293b;
                    padding: 1.25rem 3rem;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .ticker-v2 {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    overflow: hidden;
                }

                .ticker-label-v2 {
                    flex-shrink: 0;
                    background: #f59e0b;
                    color: #000;
                    padding: 0.4rem 1rem;
                    border-radius: 8px;
                    font-weight: 900;
                    font-size: 0.8rem;
                }

                marquee {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #cbd5e1;
                }

                .empty-display-v2 {
                    grid-column: 1 / -1;
                    padding: 10rem;
                    text-align: center;
                }

                @media (max-width: 1024px) {
                    .clinic-display-v2 { padding: 1.5rem; }
                    .time-box-v2 { font-size: 2.5rem; }
                }
            `}</style>
        </div>
    );
};

export default ClinicDisplay;

