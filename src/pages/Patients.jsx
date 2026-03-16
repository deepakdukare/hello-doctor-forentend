import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Search, RefreshCw, AlertCircle, UserPlus, X, Edit2,
    User, Phone, Mail, MapPin, Calendar as CalendarIcon,
    FileText, Share2, Shield, Heart, MoreVertical,
    ChevronRight, Info, Filter, CheckCircle2, Camera,
    Activity, ArrowRight, Baby, Users, Clipboard, Zap, Stethoscope, Clock, History
} from 'lucide-react';
import StatCard from '../components/StatCard';
import PatientForm, { EMPTY_FORM } from '../components/PatientForm';
import { getPatients, registerPatient, updatePatient, getDoctors, getReferringDoctors, uploadPatientPhoto, toIsoDate, getMRDByPatientId, getAppointments, lookupAppointments } from '../api/index';
import { removeSalutation } from '../utils/formatters';
import { hasPermission } from '../utils/auth';


const Patients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selected, setSelected] = useState(null);
    const [patientTab, setPatientTab] = useState('summary'); // summary, documents, history
    const [patientDocs, setPatientDocs] = useState([]);
    const [patientAppointments, setPatientAppointments] = useState([]);
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
                limit: 20,
                search: query || undefined,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            });
            setPatients(res.data.data || []);
            setPagination({
                total: res.data.total || 0,
                pages: res.data.pagination?.pages || 1,
                page: res.data.pagination?.page || 1
            });
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, filters]);

    useEffect(() => {
        const t = setTimeout(fetchData, 500);
        return () => clearTimeout(t);
    }, [fetchData]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const res = await getDoctors({ all: true });
                setDoctors(res.data.data || []);
                const refRes = await getReferringDoctors();
                setReferringDoctors(refRes.data.data || []);
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
                                                    <td colSpan={hasPermission('view_patient_mobile') ? 8 : 7}><div className="skeleton-row-premium"></div></td>
                                                </tr>
                                            ))
                                        ) : patients.length === 0 ? (
                                            <tr>
                                                <td colSpan={hasPermission('view_patient_mobile') ? 8 : 7} className="empty-state-cell">
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
                                                            <span className="id-label" style={{ background: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800, color: '#000000' }}>{p.patient_id || 'T-XX'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="patient-meta-box">
                                                            <div className="patient-name-stack">
                                                                                                                                 <div className="name-bold-v2" style={{ color: '#000000' }}>{removeSalutation(p.full_name)}</div>
                                                                <div className="id-tag-premium">
                                                                    <span className="age-label">{calculateAge(p.dob)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="gender-tag-v2" style={{ textTransform: 'capitalize', fontWeight: 700, color: '#64748b' }}>
                                                            {p.gender}
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
                                                            <button className="hub-btn-edit" onClick={() => startEdit(p)}>
                                                                <Edit2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                 {selected?._id === p._id && (
                                                    <tr className="expansion-row">
                                                        <td colSpan={hasPermission('view_patient_mobile') ? 8 : 7}>
                                                            <div className="expansion-content-premium" style={{ paddingTop: '1rem' }}>
                                                                <div className="expansion-tabs" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', padding: '0 1rem' }}>
                                                                    <button
                                                                        onClick={() => setPatientTab('summary')}
                                                                        style={{ padding: '0.75rem 0.5rem', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: patientTab === 'summary' ? '#6366f1' : '#94a3b8', cursor: 'pointer', borderBottom: patientTab === 'summary' ? '2px solid #6366f1' : 'none', transition: '0.2s' }}
                                                                    >
                                                                        Profile Summary
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            setPatientTab('documents');
                                                                            if (patientDocs.length === 0 || selected?.patient_id !== p.patient_id) {
                                                                                setDocsLoading(true);
                                                                                try {
                                                                                    const r = await getMRDByPatientId(p.patient_id);
                                                                                    const entries = r.data?.data?.entries || [];
                                                                                    const docs = entries.flatMap(e => (e.attachments || []).map(a => ({ ...a, date: e.visit_date || e.createdAt, diagnosis: e.diagnosis })));
                                                                                    setPatientDocs(docs);
                                                                                } catch (e) { console.error(e); }
                                                                                finally { setDocsLoading(false); }
                                                                            }
                                                                        }}
                                                                        style={{ padding: '0.75rem 0.5rem', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: patientTab === 'documents' ? '#6366f1' : '#94a3b8', cursor: 'pointer', borderBottom: patientTab === 'documents' ? '2px solid #6366f1' : 'none', transition: '0.2s' }}
                                                                    >
                                                                        Patient Documents
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            setPatientTab('history');
                                                                            if (patientAppointments.length === 0 || selected?.patient_id !== p.patient_id) {
                                                                                setApptsLoading(true);
                                                                                try {
                                                                                    const r = await getAppointments({ patient_id: p.patient_id, search: p.patient_id, limit: 100 });
                                                                                    const allAppts = r.data?.data || [];
                                                                                    const patientOnlyAppts = allAppts.filter(a => a.patient_id === p.patient_id);
                                                                                    setPatientAppointments(patientOnlyAppts);
                                                                                } catch (e) { console.error(e); }
                                                                                finally { setApptsLoading(false); }
                                                                            }
                                                                        }}
                                                                        style={{ padding: '0.75rem 0.5rem', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, color: patientTab === 'history' ? '#6366f1' : '#94a3b8', cursor: 'pointer', borderBottom: patientTab === 'history' ? '2px solid #6366f1' : 'none', transition: '0.2s' }}
                                                                    >
                                                                        Appointment History
                                                                    </button>
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
                                                                                        <div className="exp-info-item"><span>Patient ID</span><strong>{p.patient_id}</strong></div>
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
                                                                    <div className="history-view-premium" style={{ marginTop: '1.5rem' }}>
                                                                        {apptsLoading ? (
                                                                            <div style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw size={24} className="animate-spin" color="#6366f1" /></div>
                                                                        ) : patientAppointments.length === 0 ? (
                                                                            <div className="empty-history-premium" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                                                                                <History size={48} style={{ marginBottom: '1rem', color: '#94a3b8' }} />
                                                                                <p style={{ color: '#64748b', fontWeight: 600 }}>No past appointments found for this patient.</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="doc-history-timeline" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                                <table className="table-premium-v3" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                                        <tr>
                                                                                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Date & Time</th>
                                                                                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                                                                                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Doctor</th>
                                                                                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {patientAppointments.map((appt, idx) => (
                                                                                            <tr key={appt._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                                <td style={{ padding: '1rem' }}>
                                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                                                                                                            {new Date(appt.appointment_date || appt.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                        </span>
                                                                                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                                                                                                            <Clock size={12} /> {appt.appointment_time || appt.start_time || 'N/A'}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '1rem' }}>
                                                                                                    <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                                                                                        {(appt.visit_category || appt.visit_type || 'Consultation').replace('_', ' ')}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td style={{ padding: '1rem' }}>
                                                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                                                                                        {appt.doctor_name || appt.attending_doctor || 'Clinic'}
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '1rem' }}>
                                                                                                    <span className={`status-chip-v3 ${String(appt.status || 'PENDING').toLowerCase()}`}>
                                                                                                        {appt.status || 'PENDING'}
                                                                                                    </span>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
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

                            {pagination.pages > 1 && (
                                <div className="pagination-v2-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="pag-info">
                                        Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, pagination.total)}</strong> of <strong>{pagination.total}</strong>
                                        <span className="pag-total"> patients in the whole registry</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                                        <button className="pag-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                                            <span>Previous</span>
                                        </button>
                                        <button className="pag-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
                                            <span>Next</span>
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default Patients;


