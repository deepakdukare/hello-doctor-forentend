import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import '../glass-landing.css';
import {
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    XCircle,
    X,
    RefreshCw,
    Search,
    Plus,
    AlertTriangle,
    ChevronDown,
    Stethoscope,
    Activity,
    User,
    ArrowRight,
    Baby,
    Clipboard,
    Clock,
    Edit2,
    Calendar,
    UserPlus,
    Trash2,
    Info,
    ChevronLeft,
    ChevronRight,
    CalendarClock
} from 'lucide-react';
import AppointmentRow from '../components/AppointmentRow';
import {
    getAppointments,
    getAppointmentStats,
    getDoctors,
    bookAppointment,
    updateAppointment,
    cancelAppointment,
    searchPatients,
    registerPatient,
    bookAppointmentWithToken,
    getAvailableTokens,
    getTokenConfig,
    toIsoDate
} from '../api/index';
import { removeSalutation } from '../utils/formatters';
import { getUser } from '../utils/auth';

const getDoctorDisplayName = (doctor) => doctor?.full_name || doctor?.name || doctor?.doctor_name || doctor?.doctor_id || 'Unknown Doctor';

const formatTime12h = (t) => {
    if (!t) return '--';
    const [h, m] = String(t).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getApiErrorMessage = (err, fallback = 'Operation failed.') => {
    const message = err?.response?.data?.message;
    if (!message) return fallback;
    if (message.toLowerCase().includes('token not available') || message.toLowerCase().includes('capacity reached')) {
        return 'The daily token capacity for this clinician has been reached. Please select another date or practitioner.';
    }
    return message;
};

const formatCompactDate = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const StatCard = ({ title, value, icon: Icon, color, loading, trend }) => {
    let trendColor = '#3b82f6'; // neutral blue
    if (trend > 0) trendColor = '#10b981'; // green
    else if (trend < 0) trendColor = '#ef4444'; // red

    return (
        <div className="stat-card-v4">
            <div className="stat-icon-v4" style={{ backgroundColor: `${color}15`, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-info-v4">
                <span className="stat-label-v4">{title}</span>
                <div className="stat-value-v4">
                    {loading ? <div className="skeleton-pulse" style={{ height: '32px', width: '60px', borderRadius: '6px' }}></div> : value}
                </div>
                {trend !== undefined && (
                    <div className="stat-trend-v4" style={{ color: trendColor }}>
                        {trend > 0 ? '+' : ''}{trend}% in last 7 days
                    </div>
                )}
            </div>
        </div>
    );
};

const InlineCalendar = ({ value, onChange }) => {
    const selectedDate = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewDate, setViewDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthYearStr = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    const prevMonthDays = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth() - 1);

    const handlePrev = (e) => {
        e.preventDefault();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNext = (e) => {
        e.preventDefault();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDayClick = (e, day) => {
        e.preventDefault();
        const newD = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const yyyy = newD.getFullYear();
        const mm = String(newD.getMonth() + 1).padStart(2, '0');
        const dd = String(newD.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
    };

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
        <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ChevronLeft size={20} color="#0f172a" /></button>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{monthYearStr}</div>
                    <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><ChevronRight size={20} color="#0f172a" /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '16px' }}>
                    {daysOfWeek.map(d => (
                        <div key={d} style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{d}</div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', rowGap: '16px', textAlign: 'center' }}>
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`prev-${i}`} style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 600, padding: '4px 0' }}>{prevMonthDays - firstDay + i + 1}</div>
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1;
                        const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                        return (
                            <button
                                key={`d-${d}`}
                                onClick={(e) => handleDayClick(e, d)}
                                style={{
                                    background: isSelected ? '#0d7f6e' : 'none',
                                    border: 'none',
                                    color: isSelected ? '#fff' : '#1e293b',
                                    fontSize: '14px',
                                    fontWeight: isSelected ? 800 : 600,
                                    width: '32px',
                                    height: '32px',
                                    margin: '0 auto',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    padding: 0
                                }}
                            >
                                {d}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '0 8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Selected Date:</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d7f6e' }}>{selectedDate.toLocaleString('default', { month: 'long', day: '2-digit', year: 'numeric' })}</span>
            </div>
        </div>
    );
};

const Appointments = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // Shared State
    const [appointments, setAppointments] = useState([]);
    const [stats, setStats] = useState(null);
    const [trends, setTrends] = useState({ load: 0, completed: 0, cancelled: 0 });
    const [pastStats, setPastStats] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const currentUser = getUser();
    const isDoctor = currentUser?.role === 'doctor';

    // Queue Filters
    const [filters, setFilters] = useState({
        date: toIsoDate(),
        doctor_id: isDoctor ? (currentUser.doctor_id || '') : '',
        status: '',
        showAll: false
    });

    // View State
    const [activeView, setActiveView] = useState('queue'); // 'queue' | 'authorizer'
    const todayStr = toIsoDate();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 15);
    const maxStr = maxDate.toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState('patient');
    const [availableTokens, setAvailableTokens] = useState(null);
    const [tokensLoading, setTokensLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [queueSearch, setQueueSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Pagination
    const PAGE_SIZE = 20;
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [editMode, setEditMode] = useState(false);

    const [form, setForm] = useState({
        patient_id: '',
        doctor_name: isDoctor ? (currentUser.full_name || currentUser.username || 'Dr. Indu') : 'Dr. Indu',
        appointment_date: filters.date,
        doctor_id: isDoctor ? (currentUser.doctor_id || '') : '',
        doctor_speciality: 'Pediatrics',
        visit_category: 'First visit',
        registration_type: 'walkin', // Default for admin
        appointment_mode: 'OFFLINE',
        reason: ''
    });

    const [cancelModal, setCancelModal] = useState({ show: false, id: null, reason: '' });
    const dateInputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    const filteredAppointments = appointments.filter((appt) => {
        const q = queueSearch.trim().toLowerCase();
        if (!q) return true;
        return [
            appt.appointment_id,
            appt.patient_id,
            appt.child_name,
            appt.parent_mobile,
            appt.parent_name,
            appt.doctor_name,
        ].some((value) => String(value || '').toLowerCase().includes(q));
    });

    const fetchQueueData = useCallback(async () => {
        setLoading(true);
        try {
            const apiFilters = { ...filters };
            if (filters.showAll) {
                delete apiFilters.date;
            }
            delete apiFilters.showAll;

            // Always pass pagination params
            apiFilters.page = page;
            apiFilters.limit = PAGE_SIZE;

            const [apptRes, statsRes] = await Promise.all([
                getAppointments(apiFilters),
                getAppointmentStats(filters.showAll ? undefined : filters.date)
            ]);

            const resData = apptRes.data;
            const currentStats = statsRes.data.data || {};

            setAppointments(resData.data || []);

            // Support multiple response shapes for total count
            const total =
                resData.total ??
                resData.pagination?.total ??
                resData.count ??
                (resData.data?.length ?? 0);
            setTotalCount(total);

            setStats(currentStats);

            const calcTrend = (curr, prev) => {
                if (!prev || prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };

            setTrends({
                load: calcTrend(currentStats.total_today || 0, pastStats?.total_today || 0),
                completed: calcTrend(currentStats.completed || 0, pastStats?.completed || 0),
                cancelled: calcTrend(currentStats.cancelled || 0, pastStats?.cancelled || 0)
            });
        } catch (err) {
            setError("Failed to fetch clinic data. Please check connection.");
        } finally {
            setLoading(false);
        }
    }, [filters, pastStats, page]);

    useEffect(() => {
        fetchQueueData();
    }, [fetchQueueData]);

    // Reset to page 1 whenever filters change
    useEffect(() => {
        setPage(1);
    }, [filters]);

    // Fetch initial static data once
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const sevenDaysAgoDate = toIsoDate(sevenDaysAgo);

                const [doctorRes, pastStatsRes] = await Promise.all([
                    getDoctors({ all: true }),
                    getAppointmentStats(sevenDaysAgoDate)
                ]);

                setDoctors(doctorRes.data.data || []);
                setPastStats(pastStatsRes.data.data || {});
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            }
        };
        fetchInitialData();
    }, []);

    // Handle incoming patient prefill request
    useEffect(() => {
        if (location.state?.prefillPatient && doctors.length > 0 && !editMode && activeView === 'queue') {
            const p = location.state.prefillPatient;
            
            setEditMode(false);
            let defaultDocId, defaultDocName, defaultDocSpeciality;
            if (isDoctor) {
                defaultDocId = currentUser.doctor_id || '';
                defaultDocName = currentUser.full_name || currentUser.username || '';
                const matchedDoc = doctors.find(d => d.doctor_id === defaultDocId);
                defaultDocSpeciality = matchedDoc?.speciality || 'Pediatrics';
            } else {
                const defaultDoc = doctors.find(d => getDoctorDisplayName(d).toLowerCase().includes('indu')) || doctors[0];
                defaultDocId = defaultDoc?.doctor_id || '';
                defaultDocName = defaultDoc ? getDoctorDisplayName(defaultDoc) : '';
                defaultDocSpeciality = defaultDoc?.speciality || 'Pediatrics';
            }

            setForm({
                patient_id: p.patient_id || p.patient_key,
                doctor_name: defaultDocName,
                appointment_date: toIsoDate(),
                doctor_id: defaultDocId,
                doctor_speciality: defaultDocSpeciality,
                visit_category: 'First visit',
                registration_type: 'walkin',
                appointment_mode: 'OFFLINE',
                reason: ''
            });

            setSelectedPatient({
                child_name: p.child_name || p.full_name || p.first_name || 'Walking Patient',
                patient_id: p.patient_id || p.patient_key,
                parent_mobile: p.wa_id || p.parent_mobile
            });

            setActiveTab('visit');
            setActiveView('authorizer');
            
            // Consume the state so it doesn't run again on reload
            window.history.replaceState({}, '');
        }
    }, [location.state, doctors, isDoctor, currentUser, editMode, activeView]);

    const fetchTokens = useCallback(async () => {
        if (!form.appointment_date || !form.doctor_id) return;
        setTokensLoading(true);
        try {
            const [tokenRes, configRes] = await Promise.all([
                getAvailableTokens(form.doctor_id, form.appointment_date),
                getTokenConfig(form.doctor_id)
            ]);

            const tokens = tokenRes.data.data;
            const config = configRes.data.data;

            // Map day of week to our config key
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const selectedDay = days[new Date(form.appointment_date + 'T00:00:00').getDay()];
            const dayConfig = config?.weekly_config?.[selectedDay];

            if (dayConfig && dayConfig.is_active === false) {
                setAvailableTokens({ ...tokens, is_offline: true });
            } else {
                setAvailableTokens(tokens);
            }
        } catch (err) {
            setError(getApiErrorMessage(err, "Unable to load token availability."));
        } finally {
            setTokensLoading(false);
        }
    }, [form.appointment_date, form.doctor_id]);

    const handlePatientSearch = useCallback(async (val) => {
        setSearching(true);
        try {
            const query = val && val.trim().length >= 2 ? val.trim() : { limit: 50 };
            const res = await searchPatients(query);
            setSearchResults(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    }, []);

    // Debounced search effect
    useEffect(() => {
        if (activeView === 'authorizer' && activeTab === 'patient') {
            const timer = setTimeout(() => {
                handlePatientSearch(patientSearch);
            }, 400); // 400ms debounce
            return () => clearTimeout(timer);
        }
    }, [activeView, activeTab, patientSearch, handlePatientSearch]);

    // Fetch tokens when relevant form fields change
    useEffect(() => {
        if (activeView === 'authorizer' && activeTab === 'visit') {
            fetchTokens();
        }
    }, [activeView, activeTab, fetchTokens]);

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setForm(prev => ({ ...prev, patient_id: patient.patient_id }));
        setActiveTab('visit');
    };



    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.doctor_id) {
            setError('Please select a clinician before booking.');
            return;
        }
        if (!form.patient_id) {
            setError('Please select a patient before booking.');
            return;
        }
        setSubmitting(true);
        try {
            const visitCat = form.visit_category || 'First visit';
            const payload = {
                ...form,
                visit_category: visitCat,
                registration_type: editMode ? form.registration_type : 'walkin',
                booking_source: 'dashboard'
            };
            if (editMode) {
                await updateAppointment(selectedAppointment.appointment_id, payload);
            } else {
                await bookAppointmentWithToken(payload);
            }
            setError(null);
            setActiveView('queue');
            fetchQueueData();
        } catch (err) {
            console.error(err);
            setError(getApiErrorMessage(err, "Operation failed."));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        try {
            await cancelAppointment(cancelModal.id, { cancellation_reason: cancelModal.reason });
            setCancelModal({ show: false, id: null, reason: '' });
            setError(null);
            fetchQueueData();
        } catch (err) {
            setError(getApiErrorMessage(err, "Cancellation request rejected."));
        }
    };

    const formatCategory = (type) => {
        if (!type) return 'First visit';
        return String(type)
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .replace('Follow Up', 'Follow-up');
    };

    const openBookingModal = (appt = null) => {
        if (appt) {
            setEditMode(true);
            setSelectedAppointment(appt);
            setForm({
                patient_id: appt.patient_id,
                doctor_name: appt.assigned_doctor_name || appt.doctor_name || 'Dr. Indu',
                appointment_date: appt.appointment_date.split('T')[0],
                doctor_speciality: appt.doctor_speciality || 'Pediatrics',
                visit_category: formatCategory(appt.visit_category),
                registration_type: appt.registration_type || 'walkin',
                appointment_mode: appt.appointment_mode,
                reason: appt.reason || ''
            });
            setSelectedPatient({
                child_name: appt.child_name,
                patient_id: appt.patient_id,
                parent_mobile: appt.parent_mobile
            });
            setActiveTab('visit');
        } else {
            setEditMode(false);
            // For a doctor user, always use their own ID/name from the auth token
            let defaultDocId, defaultDocName, defaultDocSpeciality;
            if (isDoctor) {
                defaultDocId = currentUser.doctor_id || '';
                defaultDocName = currentUser.full_name || currentUser.username || '';
                // Try to get speciality from the loaded doctors list
                const matchedDoc = doctors.find(d => d.doctor_id === defaultDocId);
                defaultDocSpeciality = matchedDoc?.speciality || 'Pediatrics';
            } else {
                const defaultDoc = doctors.find(d => getDoctorDisplayName(d).toLowerCase().includes('indu')) || doctors[0];
                defaultDocId = defaultDoc?.doctor_id || '';
                defaultDocName = defaultDoc ? getDoctorDisplayName(defaultDoc) : '';
                defaultDocSpeciality = defaultDoc?.speciality || 'Pediatrics';
            }
            setForm({
                patient_id: '',
                doctor_name: defaultDocName,
                appointment_date: filters.date || toIsoDate(),
                doctor_id: defaultDocId,
                doctor_speciality: defaultDocSpeciality,
                visit_category: 'First visit',
                registration_type: 'walkin',
                appointment_mode: 'OFFLINE',
                reason: ''
            });

            setSelectedPatient(null);
            setActiveTab('patient');
        }
        setActiveView('authorizer');
    };

    const openDatePicker = () => {
        const input = dateInputRef.current;
        if (!input) return;
        input.focus();
        if (typeof input.showPicker === 'function') {
            input.showPicker();
        } else {
            input.click();
        }
    };

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Appointment</h1>
                    <p>Schedule and manage patient visits</p>
                </div>

                <div className="header-right-v4">
                    <button
                        className={`btn-header-v4 ${activeView === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveView('queue')}
                    >
                        <CalendarIcon size={16} />
                        <span>View Appointments</span>
                    </button>
                    <button
                        className="btn-header-v4 btn-primary-v4"
                        onClick={() => {
                            setEditMode(false);
                            openBookingModal();
                        }}
                    >
                        <Plus size={16} />
                        <span>New Appointment</span>
                    </button>
                </div>
            </div>

            {activeView === 'queue' && (
                <div className="stats-grid-v4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <StatCard 
                        title="Today's Appointments" 
                        value={appointments.length} 
                        icon={Users} 
                        color="#0d7f6e" 
                        loading={loading} 
                        trend={trends.load} 
                    />
                    <StatCard 
                        title="Completed Appointments" 
                        value={appointments.filter(a => (a.status || '').toUpperCase() === 'COMPLETED').length} 
                        icon={CheckCircle2} 
                        color="#10b981" 
                        loading={loading} 
                        trend={trends.completed} 
                    />
                    <StatCard 
                        title="Cancelled Appointments" 
                        value={appointments.filter(a => (a.status || '').toUpperCase() === 'CANCELLED').length} 
                        icon={XCircle} 
                        color="#ef4444" 
                        loading={loading} 
                        trend={trends.cancelled} 
                    />
                </div>
            )}

            <div className="view-content-v3">
                {activeView === 'queue' ? (
                    <>
                        <div className="filter-shelf-premium" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', backgroundColor: '#f9fafb', padding: '12px 0', flexWrap: 'wrap' }}>
                            <div className="search-pill-v3" style={{ flex: 2.5, height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '10px', minWidth: '220px', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                                <Search size={18} color="#64748b" className="s-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by name, Patient ID, or Appointment ID..."
                                    value={queueSearch}
                                    onChange={(e) => setQueueSearch(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', fontWeight: 500, color: '#334155' }}
                                />
                            </div>

                            <div className="filter-group-v3" style={{ display: 'flex', gap: '1rem', flex: 'none', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                                {/* Date Picker — hidden when showAll is active */}
                                {!filters.showAll && (
                                    <div className="filter-item-v3 date-pill-v3" onClick={openDatePicker} style={{ height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', position: 'relative' }}>
                                        <CalendarIcon size={16} className="f-icon" color="#64748b" />
                                        <input
                                            ref={dateInputRef}
                                            type="date"
                                            value={filters.date}
                                            onChange={e => setFilters({ ...filters, date: e.target.value })}
                                            className="date-input-v3"
                                            style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
                                        />
                                        <span className="f-label" style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                                            {formatCompactDate(filters.date)}
                                        </span>
                                        <ChevronDown size={14} className="drop-icon" style={{ marginLeft: '4px', color: '#64748b' }} />
                                    </div>
                                )}

                                {/* Show All / Today Toggle */}
                                <button
                                    onClick={() => setFilters(f => ({ ...f, showAll: !f.showAll, date: f.showAll ? toIsoDate() : f.date }))}
                                    style={{
                                        height: '42px', borderRadius: '10px', padding: '0 14px',
                                        border: filters.showAll ? '1.5px solid #0d7f6e' : '1px solid #e5e7eb',
                                        background: filters.showAll ? '#f4fdfa' : '#fff',
                                        color: filters.showAll ? '#0d7f6e' : '#64748b',
                                        fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'nowrap'
                                    }}
                                >
                                    <CalendarIcon size={14} />
                                    {filters.showAll ? 'All Dates ✓' : 'Show All Dates'}
                                </button>

                                <div className="filter-item-v3 select-pill-v3" style={{ height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '8px', position: 'relative', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                                    <Activity size={16} className="f-icon" color="#64748b" />
                                    <select
                                        className="f-select"
                                        value={filters.status}
                                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: '20px', color: '#334155' }}
                                    >
                                        <option value="">All Status</option>
                                        <option value="CONFIRMED">Confirmed</option>
                                        <option value="COMPLETED">Completed</option>
                                        <option value="CANCELLED">Cancelled</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="NO_SHOW">No Show</option>
                                    </select>
                                    <ChevronDown size={14} className="drop-icon" style={{ position: 'absolute', right: '12px', color: '#64748b', pointerEvents: 'none' }} />
                                </div>
                                {!isDoctor && (
                                    <div className="filter-item-v3 select-pill-v3" style={{ height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '8px', position: 'relative', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                                        <Stethoscope size={16} className="f-icon" color="#64748b" />
                                        <select
                                            className="f-select"
                                            value={filters.doctor_id}
                                            onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: '20px', color: '#334155' }}
                                        >
                                            <option value="">All Combined Doctors</option>
                                            {doctors.map((doc, idx) => (
                                                <option key={doc.doctor_id || idx} value={doc.doctor_id}>
                                                    {getDoctorDisplayName(doc)}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="drop-icon" style={{ position: 'absolute', right: '12px', color: '#64748b', pointerEvents: 'none' }} />
                                    </div>
                                )}
                            </div>

                        </div>



                        <div className="repository-card-v3">
                            {filters.showAll && (
                                <div style={{ padding: '0.5rem 1rem', background: '#f4fdfa', borderRadius: '10px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#0d7f6e' }}>
                                    <CalendarIcon size={14} />
                                    Showing all {appointments.length} appointments across all dates
                                </div>
                            )}
                            <div className="table-flow-v3">
                                <table className="main-table-v3" style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0, textAlign: 'left', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                                            {filters.showAll && <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 800, color: '#0d7f6e', textTransform: 'uppercase', background: '#f4fdfa' }}>Date</th>}
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Doctor</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Token</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Patient ID</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Patient</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Gender</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Time</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Category</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Token Status</th>
                                            <th style={{ padding: '6px 10px', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && !appointments.length ? (
                                            Array(6).fill(0).map((_, i) => (
                                                <tr key={i}><td colSpan={filters.showAll ? 10 : 9}><div className="skeleton-line-v3"></div></td></tr>
                                            ))
                                        ) : filteredAppointments.length === 0 ? (
                                            <tr>
                                                <td colSpan={filters.showAll ? 10 : 9} className="empty-state-card">
                                                    <div className="empty-content">
                                                        <div className="empty-icon-wrap">
                                                            <CalendarIcon size={48} />
                                                        </div>
                                                        <h3>No Appointments Found</h3>
                                                        <p>We couldn't find any visits matching your current filters.</p>
                                                        <button className="btn-save btn-new-booking" onClick={() => openBookingModal()}>
                                                            <Plus size={20} />
                                                            <span>New Booking</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredAppointments.map((appt, idx) => (
                                            <AppointmentRow
                                                key={appt.appointment_id || idx}
                                                appt={appt}
                                                showDate={filters.showAll}
                                                onEdit={openBookingModal}
                                                onCancel={(id) => setCancelModal({ show: true, id, reason: '' })}
                                            />
                                        ))}


                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Bar */}
                            {totalPages > 1 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderTop: '1px solid #e2e8f0',
                                    backgroundColor: '#fff',
                                    borderRadius: '0 0 12px 12px'
                                }}>
                                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                                        Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of <strong>{totalCount}</strong> appointments
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            style={{
                                                padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                background: page === 1 ? '#f8fafc' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                                                color: page === 1 ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '13px'
                                            }}
                                        >«</button>
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                background: page === 1 ? '#f8fafc' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                                                color: page === 1 ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '13px'
                                            }}
                                        >
                                            <ChevronLeft size={14} /> Prev
                                        </button>

                                        {/* Page number pills */}
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let p;
                                            if (totalPages <= 5) {
                                                p = i + 1;
                                            } else if (page <= 3) {
                                                p = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                p = totalPages - 4 + i;
                                            } else {
                                                p = page - 2 + i;
                                            }
                                            const isActive = p === page;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(p)}
                                                    style={{
                                                        width: '36px', height: '36px', borderRadius: '8px',
                                                        border: isActive ? '1.5px solid #0d7f6e' : '1px solid #e2e8f0',
                                                        background: isActive ? '#0d7f6e' : '#fff',
                                                        color: isActive ? '#fff' : '#334155',
                                                        fontWeight: isActive ? 800 : 600, fontSize: '13px',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                >{p}</button>
                                            );
                                        })}

                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                background: page === totalPages ? '#f8fafc' : '#fff',
                                                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                                color: page === totalPages ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '13px'
                                            }}
                                        >
                                            Next <ChevronRight size={14} />
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            style={{
                                                padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                background: page === totalPages ? '#f8fafc' : '#fff',
                                                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                                color: page === totalPages ? '#cbd5e1' : '#334155', fontWeight: 700, fontSize: '13px'
                                            }}
                                        >»</button>
                                    </div>
                                </div>
                            )}

                            {/* Single-page result count */}
                            {totalPages <= 1 && totalCount > 0 && (
                                <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                                    {totalCount} appointment{totalCount !== 1 ? 's' : ''} found
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="reg-form-clean" style={{ maxWidth: '100%', background: '#fff', padding: '1.25rem', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', height: 'fit-content' }}>
                        <div className="reg-unified-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="modal-header-icon-container" style={{ background: 'linear-gradient(135deg, #0d7f6e, #0d7f6e)', padding: '10px', borderRadius: '12px' }}>
                                    <CalendarClock size={24} color="#fff" />
                                </div>
                                <div>
                                    <h2 className="reg-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>{editMode ? 'Update Appointment' : 'Schedule New Visit'}</h2>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, margin: 0 }}>Securely manage clinic bookings</p>
                                </div>
                            </div>
                            <button type="button" className="btn-back-v4" onClick={() => setActiveView('queue')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <X size={20} />
                                <span>Cancel</span>
                            </button>
                        </div>

                        <div className="modal-body-v3">
                            {error && (
                                <div className="alert-v3-premium error" style={{ marginBottom: '1.5rem', borderRadius: '12px' }}>
                                    <AlertTriangle size={20} />
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)}>x</button>
                                </div>
                            )}

                            {activeTab === 'patient' ? (
                                <div className="reg-section">
                                    <div className="reg-field">
                                        <label className="reg-label">Search Registry</label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                className="reg-input"
                                                style={{ paddingLeft: '44px', paddingRight: '90px' }}
                                                placeholder="Search by name, ID or mobile..."
                                                value={patientSearch}
                                                onChange={(e) => setPatientSearch(e.target.value)}
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => handlePatientSearch(patientSearch)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    backgroundColor: '#0d7f6e',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    padding: '6px 16px',
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s'
                                                }}
                                            >
                                                Search
                                            </button>
                                        </div>
                                    </div>

                                    {searching && <div style={{ fontSize: '11px', color: '#0d7f6e', fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 0' }}>Updating Registry View...</div>}

                                    <div className="search-results-premium" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', maxHeight: '400px', overflowY: 'auto', padding: '4px' }}>
                                        {searchResults.map(p => {
                                            const name = removeSalutation(p.child_name) || 'Unnamed Patient';
                                            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=EEF2FF&color=4F46E5&bold=true`;

                                            return (
                                                <div
                                                    key={p.patient_id}
                                                    className="patient-result-item"
                                                    onClick={() => selectPatient(p)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '12px 16px',
                                                        backgroundColor: '#fff',
                                                        border: '1.5px solid #f1f5f9',
                                                        borderRadius: '16px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        gap: '12px'
                                                    }}
                                                >
                                                    <img src={avatarUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{name}</span>
                                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                                            ID: {p.patient_id} <span style={{ color: '#cbd5e1', margin: '0 4px' }}>|</span> {p.parent_mobile || 'No Mobile'}
                                                        </span>
                                                    </div>
                                                    <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '50%', color: '#0d7f6e' }}>
                                                        <ArrowRight size={16} />
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!searching && patientSearch.length >= 2 && searchResults.length === 0 && (
                                            <div style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                                                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '50%', color: '#94a3b8', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}><User size={40} /></div>
                                                <div>
                                                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>Patient not found</h3>
                                                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, margin: 0 }}>The identity could not be located in our records.</p>
                                                </div>
                                                <Link
                                                    to="/patients?add=true"
                                                    className="reg-submit-btn"
                                                    style={{ maxWidth: '240px', padding: '0.75rem 1.5rem', fontSize: '14px' }}
                                                >
                                                    <Plus size={18} />
                                                    <span>Register New Profile</span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="reg-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ border: '1.5px solid #f4fdfa', borderRadius: '20px', background: '#f8faff', padding: '1rem 1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d7f6e', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.12)' }}>
                                                    <Baby size={22} />
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0d7f6e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Patient</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>{removeSalutation(selectedPatient?.child_name)}</span>
                                                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>• ID: {selectedPatient?.patient_id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {!editMode && (
                                                <button type="button" onClick={() => setActiveTab('patient')} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', border: '1.5px solid #f4fdfa', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, color: '#0d7f6e', cursor: 'pointer', transition: 'all 0.2s' }}>
                                                    <Edit2 size={12} />
                                                    <span>Change</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="reg-grid-2">
                                        <div className="reg-field">
                                            <label className="reg-label">Select Clinician</label>
                                            <div className="reg-select-wrap">
                                                <select
                                                    className="reg-select"
                                                    value={form.doctor_id}
                                                    onChange={e => {
                                                        const doc = doctors.find(d => d.doctor_id === e.target.value);
                                                        setForm({
                                                            ...form,
                                                            doctor_id: e.target.value,
                                                            doctor_name: getDoctorDisplayName(doc),
                                                            doctor_speciality: doc?.speciality || form.doctor_speciality
                                                        });
                                                    }}
                                                >
                                                    <option value="" disabled>— Select Doctor —</option>
                                                    {doctors.map(doc => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                                                </select>
                                                <ChevronDown size={16} className="reg-select-icon" />
                                            </div>
                                        </div>

                                        <div className="reg-field">
                                            <label className="reg-label">Proposed Visit Date</label>
                                            <input
                                                type="date"
                                                className="reg-input"
                                                min={todayStr}
                                                max={maxStr}
                                                value={form.appointment_date}
                                                onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="reg-section">
                                        <h2 className="reg-section-title">Token Reservation Status</h2>
                                        <div style={{ backgroundColor: '#fff', border: '1.5px solid #f1f5f9', borderRadius: '16px', padding: '1rem', position: 'relative', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {tokensLoading && (
                                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                                                    <RefreshCw size={24} className="animate-spin text-primary" />
                                                </div>
                                            )}
                                            
                                            {availableTokens ? (
                                                availableTokens.is_offline ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1.5px solid #fecaca' }}>
                                                        <div style={{ background: '#fff', padding: '8px', borderRadius: '50%', color: '#e11d48' }}><AlertTriangle size={20} /></div>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#e11d48' }}>Doctor Off Duty</div>
                                                            <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>Clinician is not available via standard scheduling on this date.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '1.5rem', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '8px 16px', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>Next Walk-in</div>
                                                            <div style={{ fontSize: '24px', fontWeight: 950, color: '#1e293b' }}>#{availableTokens.walkin_next_token || '--'}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 700, justifyContent: 'flex-end' }}>
                                                                <Clock size={16} color="#0d7f6e" />
                                                                <span>Estimated Time: {availableTokens.start_time || '--:--'}</span>
                                                            </div>
                                                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Subject to clinic flow on visit day</p>
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                                    <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Select clinician &amp; date to reserve token</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="reg-grid-2">
                                        <div className="reg-field">
                                            <label className="reg-label">Visit Category</label>
                                            <div className="reg-select-wrap">
                                                <select
                                                    className="reg-select"
                                                    value={form.visit_category}
                                                    onChange={e => setForm({ ...form, visit_category: e.target.value })}
                                                >
                                                    <option value="First visit">First visit</option>
                                                    <option value="Follow-up">Follow-up</option>
                                                    <option value="Vaccination">Vaccination</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                                <ChevronDown size={16} className="reg-select-icon" />
                                            </div>
                                        </div>

                                        <div className="reg-field">
                                            <label className="reg-label">Clinical Reason</label>
                                            <input
                                                className="reg-input"
                                                placeholder="e.g. Fever, Checkup, etc."
                                                value={form.reason}
                                                onChange={e => setForm({ ...form, reason: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="reg-submit-bar" style={{ borderRadius: '0 0 24px 24px', margin: '0 -2rem -2rem -2rem', padding: '1.5rem 2rem' }}>
                                        <button type="submit" className="reg-submit-btn" disabled={submitting || (availableTokens && availableTokens.is_offline)}>
                                            {submitting ? (
                                                <RefreshCw size={20} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={20} />
                                                    <span>{editMode ? 'Synch Changes' : 'Confirm & Reserve Token'}</span>
                                                    <ArrowRight size={18} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {
                cancelModal.show && (
                    <div className="modal-overlay-premium">
                        <div className="modal-alert-card">
                            <div className="alert-icon-wrap"><Trash2 size={32} /></div>
                            <h2>Purge Reservation</h2>
                            <p>Are you sure you want to cancel appointment <strong>{cancelModal.id}</strong>? This action will immediately release the token back to the clinic capacity.</p>

                            <div className="cancel-reason-input">
                                <label>Cancellation Reason</label>
                                <input
                                    placeholder=""
                                    value={cancelModal.reason}
                                    onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                                    className="input-v3"
                                />
                            </div>

                            <div className="alert-actions">
                                <button className="btn-cancel" onClick={() => setCancelModal({ show: false, id: null, reason: '' })}>Keep Booking</button>
                                <button className="btn-danger-v3" onClick={handleCancel}>Confirm Cancellation</button>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    );
};

export default Appointments;

