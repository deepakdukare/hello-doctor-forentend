import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    Plus,
    AlertTriangle,
    ChevronDown,
    Stethoscope,
    Activity,
    User,
    ArrowRight,
    Clipboard,
    Clock,
    Edit2,
    Calendar,
    UserPlus,
    Trash2,
    Info,
    ChevronLeft,
    ChevronRight
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
                                    background: isSelected ? '#6366f1' : 'none',
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
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>{selectedDate.toLocaleString('default', { month: 'long', day: '2-digit', year: 'numeric' })}</span>
            </div>
        </div>
    );
};

const Appointments = () => {
    // Shared State
    const [appointments, setAppointments] = useState([]);
    const [stats, setStats] = useState(null);
    const [trends, setTrends] = useState({ load: 0, completed: 0, cancelled: 0 });
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [enrollErrors, setEnrollErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Queue Filters
    const [filters, setFilters] = useState({
        date: toIsoDate(),
        doctor_id: '',
        status: ''
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
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [newPatient, setNewPatient] = useState({
        first_name: '',
        last_name: '',
        gender: 'boy',
        dob: '',
        wa_id: '',
        state: 'Maharashtra',
        city: 'Mumbai',
        pincode: '',
        residential_address: ''
    });
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [editMode, setEditMode] = useState(false);

    const [form, setForm] = useState({
        patient_id: '',
        doctor_name: 'Dr. Indu',
        appointment_date: filters.date,
        doctor_id: '',
        doctor_speciality: 'Pediatrics',
        visit_category: 'First visit',
        registration_type: 'walkin', // Default for admin
        appointment_mode: 'OFFLINE',
        reason: ''
    });

    const [cancelModal, setCancelModal] = useState({ show: false, id: null, reason: '' });
    const dateInputRef = useRef(null);

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

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoDate = toIsoDate(sevenDaysAgo);

            const [apptRes, statsRes, pastStatsRes, doctorRes] = await Promise.all([
                getAppointments(filters),
                getAppointmentStats(filters.date),
                getAppointmentStats(sevenDaysAgoDate),
                getDoctors({ all: true })
            ]);
            
            const currentStats = statsRes.data.data || {};
            const pastStats = pastStatsRes.data.data || {};

            setAppointments(apptRes.data.data || []);
            setStats(currentStats);
            setDoctors(doctorRes.data.data || []);

            const calcTrend = (curr, prev) => {
                if (!prev || prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };

            setTrends({
                load: calcTrend(currentStats.total_today || 0, pastStats.total_today || 0),
                completed: calcTrend(currentStats.completed || 0, pastStats.completed || 0),
                cancelled: calcTrend(currentStats.cancelled || 0, pastStats.cancelled || 0)
            });
        } catch (err) {
            setError("Failed to fetch clinic data. Please check connection.");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        setPatientSearch(val);
        setSearching(true);
        try {
            const res = await searchPatients(val);
            setSearchResults(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (activeView === 'authorizer') {
            if (activeTab === 'visit') {
                fetchTokens();
            } else if (activeTab === 'patient') {
                handlePatientSearch(patientSearch);
            }
        }
    }, [activeView, activeTab, fetchTokens, handlePatientSearch, patientSearch]);

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setForm(prev => ({ ...prev, patient_id: patient.patient_id }));
        setActiveTab('visit');
    };

    const handleQuickRegister = async (e) => {
        if (e) e.preventDefault();
        setEnrollErrors({});
        setError(null);

        const errors = {};
        if (!newPatient.first_name?.trim()) errors.first_name = "First name required";
        if (!newPatient.last_name?.trim()) errors.last_name = "Last name required";
        if (!newPatient.gender?.trim()) errors.gender = "Gender required";
        if (!newPatient.dob?.trim()) errors.dob = "Birth date required";
        if (!newPatient.wa_id?.trim()) errors.wa_id = "Mobile required";
        else if (newPatient.wa_id.length < 10) errors.wa_id = "10-digit required";
        if (!newPatient.city?.trim()) errors.city = "City required";
        if (!newPatient.pincode?.trim()) errors.pincode = "Pincode required";
        else if (newPatient.pincode.length < 6) errors.pincode = "6-digit required";
        if (!newPatient.residential_address?.trim()) errors.residential_address = "Address required";

        if (Object.keys(errors).length > 0) {
            setEnrollErrors(errors);
            const first = Object.keys(errors)[0];
            const el = document.getElementsByName(first)[0];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await registerPatient({
                first_name: newPatient.first_name,
                last_name: newPatient.last_name,
                gender: newPatient.gender,
                dob: newPatient.dob,
                wa_id: newPatient.wa_id,
                city: newPatient.city || 'Mumbai',
                pincode: newPatient.pincode,
                residential_address: newPatient.residential_address,
                state: newPatient.state || 'Maharashtra',
                doctor: form.doctor_name
            });
            selectPatient(res.data.data);
            setActiveTab('visit');
        } catch (err) {
            setError(err.response?.data?.message || "Enrollment failed");
        } finally {
            setSubmitting(false);
        }
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
                await bookAppointment(payload);
            }
            setError(null);
            setActiveView('queue');
            fetchData();
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
            fetchData();
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
            const defaultDoc = doctors.find(d => getDoctorDisplayName(d).toLowerCase().includes('indu')) || doctors[0];
            setForm({
                patient_id: '',
                doctor_name: defaultDoc ? getDoctorDisplayName(defaultDoc) : '',
                appointment_date: filters.date || toIsoDate(),
                doctor_id: defaultDoc?.doctor_id || '',
                doctor_speciality: defaultDoc?.speciality || 'Pediatrics',
                visit_category: 'First visit',
                registration_type: 'walkin',
                appointment_mode: 'OFFLINE',
                reason: ''
            });
            setNewPatient({
                salutation: 'Master',
                first_name: '',
                last_name: '',
                gender: 'boy',
                dob: '',
                wa_id: '',
                state: 'Maharashtra',
                city: 'Mumbai',
                pincode: '',
                residential_address: '',
                registration_source: 'dashboard'
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
                        color="#6366f1" 
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
                        <div className="filter-shelf-premium" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', backgroundColor: '#f9fafb', padding: '12px 0' }}>
                            <div className="search-pill-v3" style={{ flex: 2.5, height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '10px', minWidth: '220px', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                                <Search size={18} color="#64748b" className="s-icon" />
                                <input
                                    type="text"
                                    placeholder="Search clinical registry..."
                                    value={queueSearch}
                                    onChange={(e) => setQueueSearch(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', fontWeight: 500, color: '#334155' }}
                                />
                            </div>

                            <div className="filter-group-v3" style={{ display: 'flex', gap: '1rem', flex: 'none', justifyContent: 'flex-start' }}>
                                <div className="filter-item-v3 date-pill-v3" onClick={openDatePicker} style={{ height: '42px', borderRadius: '10px', padding: '0 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
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
                            </div>


                        </div>



                        <div className="repository-card-v3">
                            <div className="table-flow-v3">
                                <table className="main-table-v3" style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0, textAlign: 'left', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Token</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Patient</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Gender</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Time</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Doctor</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Category</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Token Status</th>
                                            <th style={{ padding: '16px 20px', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && !appointments.length ? (
                                            Array(6).fill(0).map((_, i) => (
                                                <tr key={i}><td colSpan={9}><div className="skeleton-line-v3"></div></td></tr>
                                            ))
                                        ) : filteredAppointments.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="empty-state-card">
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
                                                onEdit={openBookingModal}
                                                onCancel={(id) => setCancelModal({ show: true, id, reason: '' })}
                                            />
                                        ))}


                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="authorizer-panel-premium">
                        <div className="authorizer-header-v3" style={{ padding: '1.25rem 1.5rem 0.75rem' }}>
                            <div className="header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="header-text">
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', marginBottom: '2px' }}>{editMode ? 'Update Appointment' : 'Schedule New Visit'}</h2>
                                </div>
                                <button className="close-btn-v3" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setActiveView('queue')}><XCircle size={20} /></button>
                            </div>
                        </div>


                        <div className="modal-body-v3">
                            {error && (
                                <div className="alert-v3-premium error">
                                    <AlertTriangle size={20} />
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)}>x</button>
                                </div>
                            )}

                            {activeTab === 'patient' ? (
                                <div className="patient-selector-premium" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                                    <div className="search-wrap-premium" style={{
                                        position: 'relative',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '8px',
                                        padding: '4px 12px',
                                        border: '1.5px solid #e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        height: '40px',
                                        flexShrink: 0
                                    }}>
                                        <Search size={16} color="#64748b" style={{ marginRight: '8px' }} />
                                        <input
                                            type="text"
                                            placeholder="Search by name, ID or mobile..."
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearch(e.target.value)}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                outline: 'none',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#1e293b',
                                                width: '100%',
                                                height: '100%'
                                            }}
                                        />
                                    </div>

                                    {searching && <div className="scanner-line" style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0', flexShrink: 0 }}>Scanning records...</div>}

                                    <div className="search-results-premium" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
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
                                                        padding: '8px 12px',
                                                        backgroundColor: '#fff',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        gap: '8px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = '#6366f1';
                                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                                        e.currentTarget.style.backgroundColor = '#fff';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <img src={avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '1px' }}>{name}</span>
                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                                            {p.patient_id} <span style={{ color: '#cbd5e1', margin: '0 4px' }}>|</span> {p.parent_mobile || 'No Mobile'}
                                                        </span>
                                                    </div>
                                                    <div style={{ color: '#94a3b8' }}>
                                                        <ArrowRight size={14} />
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!searching && searchResults.length === 0 && (
                                            <div className="no-identity-state" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ color: '#94a3b8' }}><User size={32} /></div>
                                                <div>
                                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Patient not found</h3>
                                                    <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, margin: 0 }}>The identity could not be located.</p>
                                                </div>
                                                <button
                                                    onClick={() => setActiveTab('new-patient')}
                                                    className="btn-save"
                                                    style={{
                                                        backgroundColor: '#6366f1',
                                                        color: '#fff',
                                                        padding: '6px 14px',
                                                        borderRadius: '6px',
                                                        fontWeight: 700,
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                                                        fontSize: '12px',
                                                        marginTop: '8px'
                                                    }}
                                                >
                                                    + Create New Profile
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'new-patient' ? (
                                <form onSubmit={handleQuickRegister} className="wizard-form-v3" noValidate style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <div className="form-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>First Name *</label>
                                            <input name="first_name" placeholder="Enter first name" value={newPatient.first_name} onChange={e => setNewPatient({ ...newPatient, first_name: e.target.value })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.first_name ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }} />
                                            {enrollErrors.first_name && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.first_name}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Last Name *</label>
                                            <input name="last_name" placeholder="Enter last name" value={newPatient.last_name} onChange={e => setNewPatient({ ...newPatient, last_name: e.target.value })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.last_name ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none', transition: 'all 0.2s' }} />
                                            {enrollErrors.last_name && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.last_name}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Gender *</label>
                                            <select name="gender" value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.gender ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none', cursor: 'pointer' }}>
                                                <option value="boy">Boy</option>
                                                <option value="girl">Girl</option>
                                            </select>
                                            {enrollErrors.gender && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.gender}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Date of Birth *</label>
                                            <input name="dob" type="date" value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.dob ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none' }} />
                                            {enrollErrors.dob && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.dob}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>WhatsApp Mobile *</label>
                                            <input name="wa_id" placeholder="10-digit mobile number" value={newPatient.wa_id} onChange={e => setNewPatient({ ...newPatient, wa_id: e.target.value.replace(/\D/g, '') })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.wa_id ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none' }} />
                                            {enrollErrors.wa_id && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.wa_id}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>City *</label>
                                            <input name="city" placeholder="e.g. Mumbai" value={newPatient.city || 'Mumbai'} onChange={e => setNewPatient({ ...newPatient, city: e.target.value })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.city ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none' }} />
                                            {enrollErrors.city && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.city}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Pincode *</label>
                                            <input name="pincode" placeholder="6-digit pincode" value={newPatient.pincode || ''} onChange={e => setNewPatient({ ...newPatient, pincode: e.target.value.replace(/\D/g, '') })} style={{ height: '48px', padding: '0 16px', borderRadius: '10px', border: enrollErrors.pincode ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none' }} />
                                            {enrollErrors.pincode && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.pincode}</p>}
                                        </div>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Residential Address *</label>
                                            <textarea name="residential_address" placeholder="Full residential address" value={newPatient.residential_address || ''} onChange={e => setNewPatient({ ...newPatient, residential_address: e.target.value })} style={{ height: '80px', padding: '12px 16px', borderRadius: '10px', border: enrollErrors.residential_address ? '2px solid #ef4444' : '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 500, outline: 'none', resize: 'vertical' }} />
                                            {enrollErrors.residential_address && <p style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, margin: '2px 0 0 4px' }}>{enrollErrors.residential_address}</p>}
                                        </div>
                                    </div>
                                    <div className="wizard-footer-v3" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                        <button type="button" onClick={() => setActiveTab('patient')} style={{ height: '44px', padding: '0 24px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#fff', fontSize: '14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>Back to Search</button>
                                        <button type="submit" disabled={submitting} style={{ height: '44px', padding: '0 24px', borderRadius: '10px', border: 'none', backgroundColor: '#6366f1', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>{submitting ? 'Enrolling...' : 'Enroll & Proceed'}</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="wizard-form-v3" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className="selected-patient-v3" style={{ marginBottom: '1rem', border: '1.5px solid #f1f5f9', borderRadius: '14px', background: '#f8fafc', padding: '0.6rem 1rem' }}>
                                        <div className="p-info-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div className="p-avatar-circle" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)' }}>
                                                    <User size={16} />
                                                </div>
                                                <div className="p-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="p-name-premium" style={{ fontSize: '13px', fontWeight: 850, color: '#1e293b' }}>{removeSalutation(selectedPatient?.child_name)}</span>
                                                    <span className="p-id-premium" style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700 }}>• Patient ID: {selectedPatient?.patient_id}</span>
                                                </div>
                                            </div>
                                            {!editMode && (
                                                <button type="button" onClick={() => setActiveTab('patient')} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fff', border: '1px solid #E0E7FF', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, color: '#4F46E5', cursor: 'pointer' }}>
                                                    <Edit2 size={10} />
                                                    <span>Change</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Select Doctor</label>
                                            <div className="input-with-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <Stethoscope size={18} style={{ position: 'absolute', left: '16px', color: '#94a3b8' }} />
                                                <select
                                                    value={form.doctor_id}
                                                    onChange={e => {
                                                        const doc = doctors.find(d => d.doctor_id === e.target.value);
                                                        setForm({ ...form, doctor_id: e.target.value, doctor_name: getDoctorDisplayName(doc) });
                                                    }}
                                                    style={{ width: '100%', height: '38px', paddingLeft: '40px', paddingRight: '12px', borderRadius: '10px', border: '1.5px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#1e293b', outline: 'none', appearance: 'none' }}
                                                >
                                                    <option value="" disabled>Select Doctor</option>
                                                    {doctors.map(doc => <option key={doc.doctor_id} value={doc.doctor_id}>{getDoctorDisplayName(doc)}</option>)}
                                                </select>
                                                <ChevronDown size={14} style={{ position: 'absolute', right: '16px', color: '#94a3b8', pointerEvents: 'none' }} />
                                            </div>
                                        </div>

                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Visit Date</label>
                                            <div className="input-with-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <CalendarIcon size={16} style={{ position: 'absolute', left: '14px', color: '#94a3b8' }} />
                                                <input
                                                    type="date"
                                                    min={todayStr}
                                                    max={maxStr}
                                                    value={form.appointment_date}
                                                    onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                                                    style={{ width: '100%', height: '38px', paddingLeft: '40px', paddingRight: '12px', borderRadius: '10px', border: '1.5px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#1e293b', outline: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="f-group full-span" style={{ gridColumn: 'span 2' }}>
                                            <div className="token-availability-v3 card-premium-v3" style={{ backgroundColor: '#fff', border: '1.5px solid #eef2ff', borderRadius: '14px', padding: '10px' }}>
                                                <div className="token-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <h3 style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token Status</h3>
                                                    {tokensLoading && <RefreshCw size={12} style={{ color: '#6366f1' }} className="animate-spin" />}
                                                </div>

                                                {availableTokens ? (
                                                    availableTokens.is_offline ? (
                                                        <div className="alert-offline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                                                            <AlertTriangle size={16} color="#e11d48" />
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e11d48' }}>Doctor is OFF on this day (Weekly Schedule)</span>
                                                        </div>
                                                    ) : (
                                                        <div className="token-stats-grid" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <div className="token-stat-pill" style={{ padding: '6px 12px', backgroundColor: '#eff6ff', border: '1.5px solid #6366f1', borderRadius: '10px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                                <div style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>Walk-in</div>
                                                                <div style={{ fontSize: '20px', fontWeight: 950, color: '#1e293b' }}>#{availableTokens.walkin_next_token || '--'}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
                                                                <Clock size={10} />
                                                                 <span>Approx Appointment time: {availableTokens.start_time || '--:--'}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="token-placeholder" style={{ textAlign: 'center', padding: '10px', color: '#94a3b8' }}>
                                                        <p style={{ fontSize: '11px', fontWeight: 600 }}>Select clinician to view tokens</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="f-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Visit Category</label>
                                            <div className="input-with-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <Activity size={18} style={{ position: 'absolute', left: '16px', color: '#94a3b8' }} />
                                                <select
                                                    value={form.visit_category}
                                                    onChange={e => setForm({ ...form, visit_category: e.target.value })}
                                                    style={{ width: '100%', height: '38px', paddingLeft: '40px', paddingRight: '12px', borderRadius: '10px', border: '1.5px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#1e293b', outline: 'none', appearance: 'none' }}
                                                >
                                                    <option value="First visit">First visit</option>
                                                    <option value="Follow-up">Follow-up</option>
                                                    <option value="Vaccination">Vaccination</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                                <ChevronDown size={14} style={{ position: 'absolute', right: '16px', color: '#94a3b8', pointerEvents: 'none' }} />
                                            </div>
                                        </div>

                                        <div className="f-group">
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Clinical Reason</label>
                                            <div className="input-with-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <Clipboard size={18} style={{ position: 'absolute', left: '16px', color: '#94a3b8' }} />
                                                <input
                                                    placeholder="Reason for visit"
                                                    value={form.reason}
                                                    onChange={e => setForm({ ...form, reason: e.target.value })}
                                                    style={{ width: '100%', height: '38px', paddingLeft: '40px', paddingRight: '12px', borderRadius: '10px', border: '1.5px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#1e293b', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="wizard-footer-large" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                        <button type="button" onClick={() => setActiveView('queue')} style={{ flex: 1, height: '42px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#fff', fontSize: '13px', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>
                                            Discard Changes
                                        </button>
                                        <button type="submit" disabled={submitting || (availableTokens && availableTokens.is_offline)} style={{ flex: 2, height: '42px', borderRadius: '10px', border: 'none', backgroundColor: (availableTokens && availableTokens.is_offline) ? '#cbd5e1' : '#6366f1', fontSize: '13px', fontWeight: 900, color: '#fff', cursor: (availableTokens && availableTokens.is_offline) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: (availableTokens && availableTokens.is_offline) ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                                            {submitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                            <span>{editMode ? 'Update Record' : 'Confirm Appointment'}</span>
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

