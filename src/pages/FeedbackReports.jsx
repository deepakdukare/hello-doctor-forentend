import React, { useState, useEffect, useCallback } from 'react';
import {
    Star, MessageSquare, Calendar, User, Search,
    Filter, RefreshCw, ChevronLeft, ChevronRight,
    TrendingUp, Award, Activity, Clock
} from 'lucide-react';
import { getFeedback } from '../api/index';

const FeedbackReports = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        avg_doctor: 0,
        avg_front: 0,
        avg_hosp: 0,
        total: 0
    });
    const [params, setParams] = useState({
        page: 1,
        limit: 10
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getFeedback(params);
            setFeedback(res.data.data);

            // Calculate simple stats for current view
            const data = res.data.data;
            if (data.length > 0) {
                const doc = data.reduce((acc, curr) => acc + curr.doctor_rating, 0) / data.length;
                const front = data.reduce((acc, curr) => acc + curr.frontdesk_rating, 0) / data.length;
                const hosp = data.reduce((acc, curr) => acc + curr.hospital_rating, 0) / data.length;
                setStats({
                    avg_doctor: doc.toFixed(1),
                    avg_front: front.toFixed(1),
                    avg_hosp: hosp.toFixed(1),
                    total: res.data.total
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [params]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const RatingStars = ({ val }) => {
        return (
            <div className="tiny-stars">
                {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} fill={s <= val ? "#f59e0b" : "none"} color={s <= val ? "#f59e0b" : "#e2e8f0"} />
                ))}
            </div>
        );
    };

    return (
        <div className="reports-container-v5">
            <div className="header-section-premium">
                <div className="header-content-premium">
                    <h1 className="header-title-premium">Feedback Hub</h1>
                    <p className="header-subtitle-premium">Patient satisfaction and service quality metrics</p>
                </div>
                <div className="header-actions-premium">
                    <button onClick={fetchData} className="btn-refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh Data</span>
                    </button>
                </div>
            </div>

            <div className="stats-grid-v5">
                <div className="stat-card-v5 purple">
                    <Award size={24} />
                    <div className="s-data">
                        <span className="s-val">{stats.avg_doctor}</span>
                        <span className="s-lbl">Doctor Interaction</span>
                    </div>
                </div>
                <div className="stat-card-v5 blue">
                    <TrendingUp size={24} />
                    <div className="s-data">
                        <span className="s-val">{stats.avg_front}</span>
                        <span className="s-lbl">Front-desk Rating</span>
                    </div>
                </div>
                <div className="stat-card-v5 orange">
                    <Activity size={24} />
                    <div className="s-data">
                        <span className="s-val">{stats.avg_hosp}</span>
                        <span className="s-lbl">Hospital Score</span>
                    </div>
                </div>
                <div className="stat-card-v5 total">
                    <MessageSquare size={24} />
                    <div className="s-data">
                        <span className="s-val">{stats.total}</span>
                        <span className="s-lbl">Total Responses</span>
                    </div>
                </div>
            </div>

            <div className="feedback-list-card">
                <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="search-wrap">
                        <Search size={18} />
                        <input type="text" placeholder="Search by name or mobile..." />
                    </div>
                    <div className="sentiment-summary" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, border: '1px solid #10b98130', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <Activity size={12} /> "VERY NICE" (85%)
                        </div>
                        <div style={{ backgroundColor: '#fff7ed', color: '#d97706', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, border: '1px solid #f59e0b30', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <Clock size={12} /> "WAITING TIME" (12%)
                        </div>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="feedback-table">
                        <thead>
                            <tr>
                                <th>Patient Details</th>
                                <th>Doctor Rating</th>
                                <th>Front Desk</th>
                                <th>Hospital</th>
                                <th>Suggestions & Comments</th>
                                <th>Date Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="loading-row">Loading feedback entries...</td></tr>
                            ) : feedback.length === 0 ? (
                                <tr><td colSpan="6" className="empty-row">No feedback entries found.</td></tr>
                            ) : (
                                feedback.map((fb) => (
                                    <tr key={fb._id}>
                                        <td>
                                            <div className="p-info">
                                                <div className="p-avatar">{fb.name?.charAt(0) || 'P'}</div>
                                                <div className="p-meta">
                                                    <strong>{fb.name || 'Anonymous'}</strong>
                                                    <span>{fb.mobile || fb.email || 'No contact'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td><RatingStars val={fb.doctor_rating} /></td>
                                        <td><RatingStars val={fb.frontdesk_rating} /></td>
                                        <td><RatingStars val={fb.hospital_rating} /></td>
                                        <td>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontStyle: fb.suggestions ? 'normal' : 'italic', maxWidth: '250px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                                                {fb.suggestions || 'No suggestions provided'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="date-badge">
                                                <Calendar size={12} />
                                                {new Date(fb.submitted_at).toLocaleDateString('en-GB')}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default FeedbackReports;
