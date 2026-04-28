import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, RefreshCw, AlertCircle, UserPlus, X, Edit2,
    User, Phone, Mail, MapPin, Calendar as CalendarIcon,
    FileText, Share2, Shield, Heart, MoreVertical,
    ChevronRight, Info, Filter, CheckCircle2, Camera,
    Activity, ArrowRight, Baby, Users, Clipboard, Zap, Stethoscope, Clock, History, Syringe, TrendingUp, CalendarPlus
} from 'lucide-react';
import StatCard from '../components/StatCard';
import PatientForm, { EMPTY_FORM } from '../components/PatientForm';
import { getPatients, registerPatient, updatePatient, getDoctors, uploadPatientPhoto, toIsoDate, getMRDByPatientId, getAppointments, lookupAppointments, getComprehensiveProfile } from '../api/index';
import { removeSalutation } from '../utils/formatters';
import { hasPermission } from '../utils/auth';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area 
} from 'recharts';

const Patients = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selected, setSelected] = useState(null);
    const [patientTab, setPatientTab] = useState('summary'); // summary, documents, history
    const [patientDocs, setPatientDocs] = useState([]);
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [comprehensiveData, setComprehensiveData] = useState(null);
    const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
    const [docsLoading, setDocsLoading] = useState(false);
    const [apptsLoading, setApptsLoading] = useState(false);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        source: '',
        status: '',
        gender: '',
        doctor: '',
        city: ''
    });
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });

    // Modal & Form
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'add'
    const [showInlineForm, setShowInlineForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formErrors, setFormErrors] = useState({});

    // Metadata
    const [doctors, setDoctors] = useState([]);
    const [referringDoctors, setReferringDoctors] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const REQUIRED_FORM_FIELDS = ['first_name', 'last_name', 'gender', 'dob', 'father_name', 'mother_name', 'wa_id', 'email', 'city', 'pincode', 'address'];

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const query = search.trim();
            if (query.toUpperCase().startsWith('APT-')) {
                // Handle direct appointment ID search if entered in patient registry
                const lookupRes = await lookupAppointments(query);
                if (lookupRes.data.type === 'single') {
                    // It's an appointment, but we want the patient for this list
                    const appt = lookupRes.data.data;
                    const pRes = await getPatients({ search: appt.patient_id });
                    setPatients(pRes.data.data || []);
                    setPagination({ total: pRes.data.data?.length || 0, pages: 1, page: 1 });
                    return;
                }
            }

            const res = await getPatients({
                page,
                limit: limit === -1 ? 1000 : limit,
                search: query || undefined,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            });
            setPatients(res.data.data || []);
            setPagination({
                total: res.data.total || 0,
                pages: limit === -1 ? 1 : (res.data.pagination?.pages || 1),
                page: res.data.pagination?.page || 1
            });
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, filters]);

    useEffect(() => {
        const t = setTimeout(fetchData, 500);
        return () => clearTimeout(t);
    }, [fetchData]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const res = await getDoctors({ all: true });
                setDoctors(res.data.data || []);
            } catch (e) {
                console.error("Failed to load metadata", e);
            }
        };
        loadMetadata();
    }, []);

    // Handle initial redirect for adding patient
    const location = useLocation();
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('add') === 'true') {
            setViewMode('add');
            setShowInlineForm(true);
            setEditId(null);
            setForm(EMPTY_FORM);
        }
    }, [location.search]);

    // Fetch today's registration count
    useEffect(() => {
        const fetchTodayCount = async () => {
            try {
                const today = toIsoDate();
                const res = await getPatients({ registration_date: today, limit: 1 });
                // The API should return total count in header or we can count from response
                setTodayCount(res.data.total || 0);
            } catch (e) {
                console.error("Failed to load today's count", e);
                setTodayCount(0);
            }
        };
        fetchTodayCount();
    }, []);


    const validateForm = (singleField = null) => {
        const errs = singleField ? { ...formErrors } : {};
        const fieldsToValidate = singleField ? [singleField] : REQUIRED_FORM_FIELDS;

        fieldsToValidate.forEach(field => {
            if (!REQUIRED_FORM_FIELDS.includes(field)) {
                delete errs[field];
                return;
            }
            const val = form[field];
            if (!val || (typeof val === 'string' && !val.trim())) {
                const labelMap = { dob: 'Date of Birth', wa_id: 'WhatsApp ID / Mobile' };
                const label = labelMap[field] || field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                errs[field] = `${label} is required`;
            } else {
                delete errs[field];
            }
        });

        setFormErrors(errs);

        if (!singleField && Object.keys(errs).length > 0) {
            const first = Object.keys(errs)[0];
            const el = document.getElementsByName(first)[0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            } else {
                window.scrollTo({ top: 300, behavior: 'smooth' });
            }
            return false;
        }
        return Object.keys(errs).length === 0;
    };

    const handleFormSubmit = async (e) => {
        if (e) e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const payload = {
                ...form,
                age_years: form.age_years ? parseInt(form.age_years) : undefined,
                age_months: form.age_months ? parseInt(form.age_months) : undefined,
                wa_id: form.wa_id.toString(),
                parent_mobile: form.wa_id.toString(),
            };

            if (editId) {
                await updatePatient(editId, payload);
                setSuccess("Success: Patient profile updated and synced.");
            } else {
                const res = await registerPatient(payload);
                setSuccess(`Success: Patient ID ${res.data.data.patient_id} activated.`);
            }
            setShowInlineForm(false);
            setViewMode('list');
            setEditId(null);
            setForm(EMPTY_FORM);
            setFormErrors({});
            fetchData();
            setTimeout(() => setSuccess(null), 4000);
        } catch (e) {
            const baseErrorMsg = e.response?.data?.message || e.message;
            const detailErrorMsg = Array.isArray(e.response?.data?.details)
                ? e.response.data.details.map((item) => item.message).join(', ')
                : '';
            const errorMsg = detailErrorMsg ? baseErrorMsg + ': ' + detailErrorMsg : baseErrorMsg;
            if (e.response?.status === 409) {
                setError("Profile Exists: Patient with this Patient ID or WhatsApp already exists.");
            } else if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setError("System Conflict: The generated ID (e.g. 26-AA1) already has an existing Medical Record. This usually happens if a previous record wasn't fully cleared. Please contact support to sync the registry.");
            } else {
                setError(errorMsg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handlePhotoUpload = async (patientId, e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                setLoading(true);
                await uploadPatientPhoto(patientId, reader.result);
                setSuccess("Success: Patient photo updated.");
                fetchData();
                setTimeout(() => setSuccess(null), 3000);
            } catch (err) {
                setError("Failed to upload photo: " + (err.response?.data?.message || err.message));
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const startEdit = (p) => {
        setEditId(p.patient_id);
        const fullName = p.child_full_name || p.full_name || '';
        const nameParts = fullName.split(' ');

        setForm({
            salutation: p.salutation || 'Master',
            first_name: p.first_name || nameParts[0] || '',
            middle_name: p.middle_name || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''),
            last_name: p.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''),
            gender: p.gender || 'boy',
            dob: (() => {
                const rawDob = p.date_of_birth || p.dob;
                if (!rawDob) return '';
                try {
                    const d = new Date(rawDob);
                    return isNaN(d.getTime()) ? '' : toIsoDate(d);
                } catch (e) {
                    return '';
                }
            })(),
            age_years: p.age_years || '',
            age_months: p.age_months || '',
            father_name: p.father_name || '',
            mother_name: p.mother_name || '',
            parent_mobile: p.wa_id || '',
            area: p.area || '',
            city: p.city || '',
            state: p.state || '',
            pincode: p.pincode || p.pin_code || '',
            address: p.residential_address || p.address || '',
            wa_id: p.wa_id || p.parent_mobile || '',
            email: p.email || '',
            doctor: p.doctor || '',
            communication_preference: p.communication_preference || 'WhatsApp',
            remarks: p.remarks || '',
            enrollment_source: p.enrollment_source || p.registration_source || 'dashboard',
            enrollment_option: p.enrollment_option || 'just_enroll'
        });
        setShowInlineForm(true);
        setViewMode('add');
        setSelected(null);
    };

    const calculateAge = (dob) => {
        if (!dob) return '—';
        const birthDate = new Date(dob);
        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months = 12 + months;
        }
        return `${years}y ${months}m`;
    };

    const copyFormLink = () => {
        const link = window.location.origin + '/register-form';
        navigator.clipboard.writeText(link);
        setSuccess('Enrollment link copied to clipboard!');
        setTimeout(() => setSuccess(null), 3000);
    };

    return (
        <div className="appointments-page-v4">
            <div className="header-v4">
                <div className="header-left-v4">
                    <h1>Patients</h1>
                    <p>{pagination.total} total profiles in records</p>
                </div>

                <div className="header-right-v4">
                    <button
                        className={`btn-header-v4 ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => { setViewMode('list'); setShowInlineForm(false); setEditId(null); }}
                    >
                        <Users size={16} />
                        <span>View Patients</span>
                    </button>
                    <button
                        className={`btn-header-v4 btn-primary-v4 ${viewMode === 'add' ? 'active' : ''}`}
                        onClick={() => { setViewMode('add'); setShowInlineForm(true); setEditId(null); setForm(EMPTY_FORM); }}
                    >
                        <UserPlus size={16} />
                        <span>New Enrollment</span>
                    </button>
                    <button className="btn-header-v4" onClick={copyFormLink} title="Copy Public Form Link">
                        <Share2 size={16} />
                    </button>
                </div>
            </div>
            <div className="view-content-v3">



                {error && (
                    <div className="alert-premium error">
                        <AlertCircle size={22} />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="alert-close">×</button>
                    </div>
                )}

                {success && (
                    <div className="alert-premium success">
                        <CheckCircle2 size={22} />
                        <span>{success}</span>
                    </div>
                )}

                {viewMode === 'add' && showInlineForm && (
                    <div className="inline-form-premium" style={{ animation: 'slideDown 0.4s ease' }}>

                        <PatientForm
                            form={form}
                            setForm={setForm}
                            onSubmit={handleFormSubmit}
                            onBlur={(e) => validateForm(e.target.name)}
                            onCancel={() => { setShowInlineForm(false); setViewMode('list'); setEditId(null); setForm(EMPTY_FORM); setFormErrors({}); }}
                            submitting={submitting}
                            editId={editId}
                            doctors={doctors}
                            referringDoctors={referringDoctors}
                            errors={formErrors}
                        />
                    </div>
                )}

                {viewMode === 'list' && (
                    <>
                        <div className="search-filter-section">
                            <div className="search-container-premium">
                                <Search className="search-icon-premium" size={22} />
                                <input
                                    type="text"
                                    placeholder="Search by name, Patient ID, or mobile..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="search-input-premium"
                                />
                            </div>
                            <div className="filters-group-premium">
                                <div className="filter-select-wrap">
                                    <Filter size={16} className="filter-icon" />
                                    <select
                                        value={filters.source}
                                        onChange={e => setFilters({ ...filters, source: e.target.value })}
                                        className="filter-select-premium"
                                    >
                                        <option value="">All Sources</option>
                                        <option value="dashboard">Dashboard</option>
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="form">Form Integration</option>
                                    </select>
                                </div>
                                <div className="filter-select-wrap">
                                    <Stethoscope size={16} className="filter-icon" />
                                    <select
                                        value={filters.doctor}
                                        onChange={e => setFilters({ ...filters, doctor: e.target.value })}
                                        className="filter-select-premium"
                                    >
                                        <option value="">All Doctors</option>
                                        {doctors.map(d => (
                                            <option key={d.doctor_id} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-select-wrap">
                                    <div className={`status-dot-mini ${filters.status === 'COMPLETE' ? 'success' : filters.status === 'PENDING' ? 'warning' : ''}`}></div>
                                    <select
                                        value={filters.status}
                                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                                        className="filter-select-premium"
                                    >
                                        <option value="">All Status</option>
                                        <option value="COMPLETE">Complete</option>
                                        <option value="PENDING">Pending Info</option>
                                    </select>
                                </div>
                                <button className="refresh-btn-v2" onClick={fetchData} title="Sync Repository">
                                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                        <div className="repository-card-premium">
                            <div className="table-wrapper-v2">
                                <table className="table-premium-v3">
                                    <thead>
                                        <tr>
                                            <th>Patient ID</th>
                                            <th>Patient Name</th>
                                            <th>Gender</th>
                                            <th>Age</th>
                                            <th>Father Name</th>
                                            <th>Mother Name</th>
                                            {hasPermission('view_patient_mobile') && <th>Mobile</th>}
                                             <th>Preferred Doctor</th>
                                             <th style={{ textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && !patients.length ? (
                                            Array(6).fill(0).map((_, i) => (
                                                <tr key={i}>
                                                    <td colSpan={hasPermission('view_patient_mobile') ? 9 : 8}><div className="skeleton-row-premium"></div></td>
                                                </tr>
                                            ))
                                        ) : patients.length === 0 ? (
                                            <tr>
                                                <td colSpan={hasPermission('view_patient_mobile') ? 9 : 8} className="empty-state-cell">
                                                    <div className="empty-box-premium">
                                                        <Info size={48} />
                                                        <h3>No patients found</h3>
                                                        <p>No patient records found matching your current filters.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : patients.map(p => (
                                            <React.Fragment key={p._id}>
                                                <tr className={`patient-row-v2 ${selected?._id === p._id ? 'is-active' : ''}`}>
                                                    <td>
                                                        <div className="id-tag-premium">
                                                            <span className="id-label" style={{ background: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800 }}>{p.patient_key || p.patient_id || 'T-XX'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="patient-meta-box">
                                                            <div className="patient-name-stack">
                                                                <div className="name-bold-v2">{removeSalutation(p.full_name)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="gender-tag-v2" style={{ textTransform: 'capitalize', fontWeight: 700, color: '#64748b' }}>
                                                            {p.gender}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 800, color: '#000000', fontSize: '13px' }}>
                                                            {calculateAge(p.dob)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                                                            {p.father_name || p.parent_name || '—'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: '13px' }}>
                                                            {p.mother_name || '—'}
                                                        </div>
                                                    </td>
                                                    {hasPermission('view_patient_mobile') && (
                                                        <td>
                                                            <div className="wa-box-mini mobile-col-v2">
                                                                <strong>{p.wa_id}</strong>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td>
                                                        <div style={{ fontWeight: 800, color: '#6366f1', fontSize: '13px' }}>
                                                            {p.doctor || 'Dr. Indu Khosla'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="action-hub-premium">
                                                            <button className={`hub-btn-info ${selected?._id === p._id ? 'active' : ''}`} onClick={() => {
                                                                if (selected?._id === p._id) {
                                                                    setSelected(null);
                                                                } else {
                                                                    setSelected(p);
                                                                    setPatientTab('summary');
                                                                    setPatientDocs([]);
                                                                    setPatientAppointments([]);
                                                                }
                                                            }}>
                                                                {selected?._id === p._id ? <X size={18} /> : <MoreVertical size={18} />}
                                                            </button>
                                                            <button className="hub-btn-edit" onClick={() => startEdit(p)} title="Edit Profile">
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button className="hub-btn-edit" style={{ color: '#0ea5e9' }} onClick={() => navigate('/appointments', { state: { prefillPatient: p } })} title="Book Appointment">
                                                                <CalendarPlus size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                 {selected?._id === p._id && (
                                                    <tr className="expansion-row">
                                                        <td colSpan={hasPermission('view_patient_mobile') ? 9 : 8}>
                                                            <div className="expansion-content-premium" style={{ paddingTop: '1rem' }}>
                                                                <div className="expansion-tabs" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', padding: '0 1rem', flexWrap: 'wrap' }}>
                                                                    {[['summary','Profile Summary'],['history','Appointment History'],['documents','Medical Documentation'],['clinical_360','Clinical Command Center (360°)']].map(([tab, label]) => (
                                                                        <button key={tab}
                                                                            onClick={async () => {
                                                                                setPatientTab(tab);
                                                                                if (!comprehensiveData || comprehensiveData._patientId !== (p.patient_key || p.patient_id)) {
                                                                                    setComprehensiveLoading(true);
                                                                                    try {
                                                                                        const r = await getComprehensiveProfile(p.patient_key || p.patient_id);
                                                                                        const d = r.data?.data || {};
                                                                                        d._patientId = p.patient_key || p.patient_id;
                                                                                        setComprehensiveData(d);
                                                                                        setPatientAppointments(d.appointments || []);
                                                                                        const mrdEntries = d.mrd?.entries || [];
                                                                                        setPatientDocs(mrdEntries.flatMap(e => (e.attachments || []).map(a => ({ ...a, date: e.visit_date || e.createdAt, diagnosis: e.diagnosis }))));
                                                                                    } catch(e2) { console.error('comprehensive fetch failed', e2); }
                                                                                    finally { setComprehensiveLoading(false); }
                                                                                }
                                                                            }}
                                                                            style={{ padding: '0.75rem 0.5rem', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: patientTab === tab ? '#6366f1' : '#94a3b8', cursor: 'pointer', borderBottom: patientTab === tab ? '2px solid #6366f1' : '2px solid transparent', transition: '0.2s', whiteSpace: 'nowrap' }}
                                                                        >{label}</button>
                                                                    ))}
                                                                 </div>

                                                                 {patientTab === 'summary' ? (
                                                                     <>
                                                                         <div className="expansion-grid">
                                                                             <div className="expansion-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                                                                 <div style={{ flex: 1 }}>
                                                                                     <div className="exp-card-header"><Activity size={18} /> <span>Medical Profile</span></div>
                                                                                     <div className="exp-info-list">
                                                                                         <div className="exp-info-item"><span>Full Name</span><strong>{removeSalutation(p.full_name)}</strong></div>
                                                                                         <div className="exp-info-item"><span>Status</span><strong>{p.is_active ? 'Active' : 'Inactive'}</strong></div>
                                                                                         <div className="exp-info-item"><span>Birth Date</span><strong>{p.dob ? new Date(p.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}</strong></div>
                                                                                         <div className="exp-info-item"><span>Patient ID</span><strong>{p.patient_key || p.patient_id}</strong></div>
                                                                                     </div>
                                                                                 </div>
                                                                             </div>
                                                                             <div className="expansion-card">
                                                                                 <div className="exp-card-header"><Users size={18} /> <span>Family Details</span></div>
                                                                                 <div className="exp-info-list">
                                                                                     <div className="exp-info-item"><span>Father</span><strong>{p.father_name || '—'}</strong></div>
                                                                                     <div className="exp-info-item"><span>Mother</span><strong>{p.mother_name || '—'}</strong></div>
                                                                                     <div className="exp-info-item"><span>WhatsApp</span><strong>{hasPermission('view_patient_mobile') ? (p.wa_id || '—') : '**********'}</strong></div>
                                                                                     <div className="exp-info-item"><span>Email</span><strong>{hasPermission('view_patient_email') ? (p.email || '—') : '**********'}</strong></div>
                                                                                     <div className="exp-info-item"><span>Preferences</span><strong>{p.communication_preference || 'WhatsApp'}</strong></div>
                                                                                 </div>
                                                                             </div>
                                                                             <div className="expansion-card">
                                                                                 <div className="exp-card-header"><MapPin size={18} /> <span>Address & Assignments</span></div>
                                                                                 <div className="exp-info-list" style={{ gap: '0.5rem' }}>
                                                                                     <div className="exp-info-item" style={{ flexWrap: 'wrap' }}><span>Address</span><strong style={{ textAlign: 'right', flex: '1 1 100%' }}>{p.residential_address || p.address || '—'}</strong></div>
                                                                                     <div className="exp-info-item"><span>City / PIN</span><strong>{(p.city || p.pincode) ? `${p.city || ''} ${p.pincode ? '- ' + p.pincode : ''}` : '—'}</strong></div>
                                                                                     <div className="exp-info-item"><span>State</span><strong>{p.state || '—'}</strong></div>
                                                                                     <div className="exp-info-item" style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}><span>Doctor</span><strong>{p.doctor || 'Clinic'}</strong></div>
                                                                                 </div>
                                                                             </div>
                                                                         </div>
                                                                         {p.remarks && (
                                                                             <div key="remarks" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                                                                 <FileText size={18} color="#6366f1" style={{ flexShrink: 0 }} />
                                                                                 <div>
                                                                                     <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Clinical Note / Remarks</div>
                                                                                     <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#475569', fontWeight: 600, lineHeight: 1.5 }}>{p.remarks}</p>
                                                                                 </div>
                                                                             </div>
                                                                         )}
                                                                     </>
                                                                 ) : patientTab === 'clinical_360' ? (
                                                                    <div className="clinical-360-container" style={{ padding: '0 1rem' }}>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                                                                            {/* Growth Tracking Section */}
                                                                            <div className="growth-tracking-section">
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                                                                    <TrendingUp size={20} color="#6366f1" />
                                                                                    <h3 style={{ fontSize: '1rem', fontWeight: 850, color: '#1e293b', margin: 0 }}>Automated Growth Charts</h3>
                                                                                </div>
                                                                                <div className="growth-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                                                    <div className="growth-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
                                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>Weight History (kg)</span>
                                                                                        <div style={{ height: '180px', marginTop: '1rem' }}>
                                                                                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                                                                <LineChart data={patientDocs.filter(d => d.weight).map(d => ({ date: new Date(d.visit_date).toLocaleDateString(), value: parseFloat(d.weight) })).sort((a,b) => new Date(a.date) - new Date(b.date))}>
                                                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                                                    <XAxis dataKey="date" hide />
                                                                                                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                                                                                                    <Tooltip />
                                                                                                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                                                                                                </LineChart>
                                                                                            </ResponsiveContainer>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="growth-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
                                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>Height History (cm)</span>
                                                                                        <div style={{ height: '180px', marginTop: '1rem' }}>
                                                                                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                                                                <AreaChart data={patientDocs.filter(d => d.height).map(d => ({ date: new Date(d.visit_date).toLocaleDateString(), value: parseFloat(d.height) })).sort((a,b) => new Date(a.date) - new Date(b.date))}>
                                                                                                    <defs>
                                                                                                        <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                                                                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                                                        </linearGradient>
                                                                                                    </defs>
                                                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                                                    <XAxis dataKey="date" hide />
                                                                                                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                                                                                    <Tooltip />
                                                                                                    <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorHeight)" strokeWidth={2} />
                                                                                                </AreaChart>
                                                                                            </ResponsiveContainer>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Unified Timeline Section */}
                                                                            <div className="unified-timeline">
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                                                                    <Activity size={20} color="#6366f1" />
                                                                                    <h3 style={{ fontSize: '1rem', fontWeight: 850, color: '#1e293b', margin: 0 }}>Vertical Patient Timeline</h3>
                                                                                </div>
                                                                                <div className="timeline-trail" style={{ position: 'relative', paddingLeft: '2rem', borderLeft: '2px dashed #e2e8f0', marginLeft: '0.5rem' }}>
                                                                                    {/* Start Point: Registration */}
                                                                                    <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                                                                                        <div style={{ position: 'absolute', left: '-2.6rem', top: '0', background: '#6366f1', color: '#fff', padding: '6px', borderRadius: '50%' }}><CheckCircle2 size={12} /></div>
                                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1' }}>REGISTRATION ({new Date(p.registered_at || p.createdAt).getFullYear()})</div>
                                                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Enrolled via {p.registration_source || 'Dashboard'}</div>
                                                                                    </div>

                                                                                    {/* Combined Appointments and Vaccinations */}
                                                                                    {[...patientAppointments, ...patientDocs].sort((a,b) => new Date(b.appointment_date || b.visit_date) - new Date(a.appointment_date || a.visit_date)).slice(0, 10).map((item, idx) => {
                                                                                        const isVaccination = item.visit_type === 'VACCINATION';
                                                                                        return (
                                                                                            <div key={idx} style={{ position: 'relative', marginBottom: '2rem' }}>
                                                                                                <div style={{ position: 'absolute', left: '-2.55rem', top: '0', background: isVaccination ? '#10b981' : '#f1f5f9', color: isVaccination ? '#fff' : '#64748b', border: '1.5px solid #e2e8f0', padding: '6px', borderRadius: '50%' }}>
                                                                                                    {isVaccination ? <Syringe size={10} /> : <CalendarIcon size={10} />}
                                                                                                </div>
                                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>{new Date(item.appointment_date || item.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{isVaccination ? (item.vaccine_given || 'Vaccination') : (item.visit_category || 'Appointment')}</div>
                                                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 650 }}>{item.doctor_name || item.attending_doctor || 'Pediatric Visit'}</div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : patientTab === 'documents' ? (
                                                                    <div className="documents-view-premium">
                                                                        {docsLoading ? (
                                                                            <div style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw size={24} className="animate-spin" /></div>
                                                                        ) : patientDocs.length === 0 ? (
                                                                            <div className="empty-docs-premium" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                                                                                <FileText size={48} style={{ marginBottom: '1rem' }} />
                                                                                <p>No medical documents found for this patient.</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="doc-grid-premium" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', padding: '1rem' }}>
                                                                                {patientDocs.map((doc, idx) => (
                                                                                    <div key={idx} className="doc-card-premium" style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', transition: '0.2s' }}>
                                                                                        <div style={{ height: '140px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                            {doc.file_type === 'application/pdf' ? <FileText size={40} color="#94a3b8" /> : <img src={doc.url} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                                                        </div>
                                                                                        <div style={{ padding: '1rem' }}>
                                                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{new Date(doc.date).toLocaleDateString()} • {doc.diagnosis || 'Visit'}</div>
                                                                                            <button
                                                                                                onClick={() => window.open(doc.url, '_blank')}
                                                                                                style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#4338ca', cursor: 'pointer' }}
                                                                                            >
                                                                                                View Original
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : patientTab === 'history' ? (
                                                                    <div style={{ marginTop: '1.5rem', padding: '0 1rem 1rem' }}>
                                                                        {comprehensiveLoading ? (
                                                                            <div style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw size={24} className="animate-spin" color="#6366f1" /></div>
                                                                        ) : (
                                                                            <>
                                                                                <div style={{ marginBottom: '2rem' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                                                        <CalendarIcon size={16} color="#6366f1" />
                                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>Clinic Appointments</span>
                                                                                        <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: '20px', padding: '1px 10px', fontSize: '0.72rem', fontWeight: 800 }}>{patientAppointments.length}</span>
                                                                                    </div>
                                                                                    {patientAppointments.length === 0 ? (
                                                                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                                                                            <History size={32} style={{ marginBottom: '0.5rem' }} />
                                                                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>No clinic appointments yet.</p>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                                                <thead style={{ background: '#f8fafc' }}>
                                                                                                    <tr>
                                                                                                        {['Appt ID','Date & Time','Type','Doctor','Status','Token'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                    {patientAppointments.map((appt, apptIdx) => (
                                                                                                        <tr key={appt._id || apptIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                                            <td style={{ padding: '0.85rem 1rem' }}><span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6366f1', background: '#ede9fe', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{appt.appointment_id || ('APT-' + String(apptIdx + 1).padStart(3,'0'))}</span></td>
                                                                                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>{new Date(appt.appointment_date || appt.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                                                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Clock size={11} />{appt.appointment_time || '—'}</div>
                                                                                                            </td>
                                                                                                            <td style={{ padding: '0.85rem 1rem' }}><span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>{(appt.visit_category || appt.visit_type || 'Consultation').replace(/_/g, ' ')}</span></td>
                                                                                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>{appt.doctor_name || appt.attending_doctor || 'Dr. Indu'}</td>
                                                                                                            <td style={{ padding: '0.85rem 1rem' }}><span className={`status-chip-v3 ${String(appt.status || 'PENDING').toLowerCase()}`}>{appt.status || 'PENDING'}</span></td>
                                                                                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed' }}>{appt.token_number ? `#${appt.token_number}` : '—'}</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {comprehensiveData?.legacy?.pid && (
                                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                                                        <div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                                                <Clipboard size={15} color="#0ea5e9" />
                                                                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>Legacy Prescriptions</span>
                                                                                                <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 800 }}>{comprehensiveData.legacy.prescriptions?.length || 0}</span>
                                                                                            </div>
                                                                                            {(comprehensiveData.legacy.prescriptions || []).length === 0 ? (
                                                                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', fontSize: '0.8rem' }}>No legacy prescriptions.</div>
                                                                                            ) : (
                                                                                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }}>
                                                                                                    {comprehensiveData.legacy.prescriptions.map((rx, rxIdx) => (
                                                                                                        <div key={rxIdx} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                                                            <div>
                                                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>{rx.prescription?.medication || 'Medication'}</div>
                                                                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{rx.prescription?.instruction || '—'}</div>
                                                                                                            </div>
                                                                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{rx.metadata?.createdOn ? new Date(rx.metadata.createdOn).toLocaleDateString('en-GB') : '—'}</div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                                                <Syringe size={15} color="#10b981" />
                                                                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>Legacy Vaccinations</span>
                                                                                                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 800 }}>{comprehensiveData.legacy.vaccinations?.length || 0}</span>
                                                                                            </div>
                                                                                            {(comprehensiveData.legacy.vaccinations || []).length === 0 ? (
                                                                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', fontSize: '0.8rem' }}>No vaccination records.</div>
                                                                                            ) : (
                                                                                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }}>
                                                                                                    {comprehensiveData.legacy.vaccinations.map((vx, vxIdx) => (
                                                                                                        <div key={vxIdx} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                            <div>
                                                                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>Vaccine #{vx.vaccine?.vaccineId || vxIdx+1}</div>
                                                                                                                <div style={{ fontSize: '0.72rem', marginTop: '2px' }}><span style={{ color: vx.vaccine?.isGiven ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{vx.vaccine?.isGiven ? 'Given' : 'Pending'}</span></div>
                                                                                                            </div>
                                                                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{vx.metadata?.createdOn ? new Date(vx.metadata.createdOn).toLocaleDateString('en-GB') : '—'}</div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ) : patientTab === 'documents' ? (
                                                                    <div style={{ padding: '0 1rem 1rem' }}>
                                                                        {comprehensiveLoading ? (
                                                                            <div style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw size={24} className="animate-spin" /></div>
                                                                        ) : (
                                                                            <>
                                                                                <div style={{ marginBottom: '2rem' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                                                        <Stethoscope size={16} color="#6366f1" />
                                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>Medical Record Entries (MRD)</span>
                                                                                        <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: '20px', padding: '1px 10px', fontSize: '0.72rem', fontWeight: 800 }}>{comprehensiveData?.mrd?.entries?.length || 0}</span>
                                                                                    </div>
                                                                                    {!(comprehensiveData?.mrd?.entries?.length) ? (
                                                                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                                                                            <FileText size={32} style={{ marginBottom: '0.5rem' }} />
                                                                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>No medical record entries found.</p>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                                            {comprehensiveData.mrd.entries.map((entry, entryIdx) => (
                                                                                                <div key={entryIdx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem' }}>
                                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                                                                        <div>
                                                                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{entry.diagnosis || 'Visit Note'}</div>
                                                                                                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{entry.visit_date ? new Date(entry.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} - {entry.visit_type || 'Consultation'}</div>
                                                                                                        </div>
                                                                                                        {entry.is_locked && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '6px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800 }}>LOCKED</span>}
                                                                                                    </div>
                                                                                                    {entry.chief_complaint && <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.5rem' }}><strong>Chief Complaint:</strong> {entry.chief_complaint}</div>}
                                                                                                    {entry.treatment && <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.5rem' }}><strong>Treatment:</strong> {entry.treatment}</div>}
                                                                                                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                                                        {entry.weight && <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>{entry.weight} kg</span>}
                                                                                                        {entry.height && <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>{entry.height} cm</span>}
                                                                                                    </div>
                                                                                                    {(entry.attachments || []).length > 0 && (
                                                                                                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                                                            {entry.attachments.map((att, attIdx) => (
                                                                                                                <button key={attIdx} onClick={() => window.open(att.url, '_blank')} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800, color: '#4338ca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                                                    <FileText size={11} /> {att.name || 'Document'}
                                                                                                                </button>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {comprehensiveData?.legacy?.pid && (comprehensiveData.legacy.child_history || []).length > 0 && (
                                                                                    <div>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                                            <Baby size={15} color="#f59e0b" />
                                                                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>Legacy Child History</span>
                                                                                            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 800 }}>{comprehensiveData.legacy.child_history.length}</span>
                                                                                        </div>
                                                                                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }}>
                                                                                            {comprehensiveData.legacy.child_history.map((h, hIdx) => (
                                                                                                <div key={hIdx} style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>{h.HistoryType || 'History'}</span>
                                                                                                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{h.CreatedOn ? new Date(h.CreatedOn).toLocaleDateString('en-GB') : '—'}</span>
                                                                                                    </div>
                                                                                                    <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600, marginTop: '0.4rem', lineHeight: 1.5 }}>{h.History}</div>
                                                                                                    {h.AddInfo && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>{h.AddInfo}</div>}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pagination-v2-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                                <div className="pag-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                            Rows per page:
                                            <select
                                                value={limit}
                                                onChange={(e) => {
                                                    setLimit(parseInt(e.target.value));
                                                    setPage(1);
                                                }}
                                                style={{ marginLeft: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px 8px', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value={20}>20</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                                <option value={-1}>Show All</option>
                                            </select>
                                        </div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                            Showing <strong>{limit === -1 ? 1 : ((page - 1) * limit + 1)}</strong> to <strong>{limit === -1 ? pagination.total : Math.min(page * limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> patients
                                        </div>
                                    </div>
                                </div>
                                {pagination.pages > 1 && limit !== -1 && (
                                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                                        <button className="pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                                            <span>Previous</span>
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6366f1' }}>{page}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>/ {pagination.pages}</span>
                                        </div>
                                        <button className="pag-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} style={{ opacity: page === pagination.pages ? 0.5 : 1, cursor: page === pagination.pages ? 'not-allowed' : 'pointer' }}>
                                            <span>Next</span>
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default Patients;


