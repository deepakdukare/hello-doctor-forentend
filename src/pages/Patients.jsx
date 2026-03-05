import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, AlertCircle, UserPlus, X, Edit2,
    User, Phone, Mail, MapPin, Calendar as CalendarIcon,
    FileText, Share2, Shield, Heart, MoreVertical,
    ChevronRight, Info, Filter, CheckCircle2, Camera,
    Activity, ArrowRight, Baby, Users, Clipboard, Zap
} from 'lucide-react';
import StatCard from '../components/StatCard';
import PatientForm, { EMPTY_FORM } from '../components/PatientForm';
import { getPatients, registerPatient, updatePatient, getDoctors, uploadPatientPhoto, toIsoDate } from '../api/index';
import { removeSalutation } from '../utils/formatters';


const Patients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selected, setSelected] = useState(null);

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

    // Metadata
    const [doctors, setDoctors] = useState([]);
    const [todayCount, setTodayCount] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getPatients({
                page,
                limit: 20,
                search: search.trim() || undefined,
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
                const res = await getDoctors();
                setDoctors(res.data.data || []);
            } catch (e) {
                console.error("Failed to load doctors", e);
            }
        };
        loadMetadata();
    }, []);

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


    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                ...form,
                age_years: form.age_years ? parseInt(form.age_years) : undefined,
                age_months: form.age_months ? parseInt(form.age_months) : undefined,
                birth_time_hours: form.birth_time_hours ? parseInt(form.birth_time_hours) : undefined,
                birth_time_minutes: form.birth_time_minutes ? parseInt(form.birth_time_minutes) : undefined,
                parent_mobile: (form.parent_mobile || form.father_mobile || form.wa_id).toString(),
                wa_id: (form.wa_id || form.parent_mobile || form.father_mobile).toString(),
            };

            if (editId) {
                await updatePatient(editId, payload);
                setSuccess("Success: Patient profile updated and synced.");
            } else {
                const res = await registerPatient(payload);
                setSuccess(`Success: Registry ID ${res.data.data.patient_id} activated.`);
            }
            setShowInlineForm(false);
            setViewMode('list');
            setEditId(null);
            setForm(EMPTY_FORM);
            fetchData();
            setTimeout(() => setSuccess(null), 4000);
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            if (e.response?.status === 409) {
                setError("Profile Exists: Patient with this Registry ID or WhatsApp already exists.");
            } else if (errorMsg.includes("E11000") && errorMsg.includes("patient_id")) {
                setError("System Conflict: The generated ID (e.g. DICC-2026-0001) already has an existing Medical Record. This usually happens if a previous record wasn't fully cleared. Please contact support to sync the registry.");
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
            gender: p.gender || 'Male',
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
            birth_time_hours: p.birth_time_hours || '',
            birth_time_minutes: p.birth_time_minutes || '',
            birth_time_ampm: p.birth_time_ampm || 'AM',
            father_name: p.parent_full_name || p.father_name || '',
            father_mobile: p.parent_mobile || p.father_mobile || '',
            father_occupation: p.father_occupation || '',
            mother_name: p.mother_name || '',
            mother_mobile: p.mother_mobile || p.alt_mobile || '',
            parent_mobile: p.parent_mobile || p.wa_id || '',
            address: p.address || '',
            area: p.area || '',
            city: p.city || '',
            state: p.state || '',
            pin_code: p.pin_code || '',
            wa_id: p.wa_id || p.parent_mobile || '',
            email: p.email || '',
            doctor: p.doctor || '',
            communication_preference: p.communication_preference || 'whatsapp',
            remark: p.remark || p.remarks || '',
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
        <div className="patients-page-v2">
            <div className="header-section-premium">
                <div className="header-content-premium">
                    <h1 className="header-title-premium-v2">Patients</h1>
                    <div className="stats-pill-row">
                        <StatCard label="Total Registry" value={pagination.total} icon={Users} color="#6366f1" />
                        <StatCard label="Registered Today" value={todayCount} icon={Activity} color="#10b981" />
                    </div>
                </div>
                <div className="header-actions-premium" style={{ gap: '1.5rem' }}>
                    <div className="segmented-control-premium">
                        <button
                            className={`segment-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => { setViewMode('list'); setShowInlineForm(false); setEditId(null); }}
                        >
                            <Users size={18} />
                            <span>View Patients</span>
                        </button>
                        <button
                            className={`segment-btn ${viewMode === 'add' ? 'active' : ''}`}
                            onClick={() => { setViewMode('add'); setShowInlineForm(true); setEditId(null); setForm(EMPTY_FORM); }}
                        >
                            <UserPlus size={18} />
                            <span>New Enrollment</span>
                        </button>
                    </div>
                    <button className="btn-share-premium" onClick={copyFormLink}>
                        <Share2 size={20} />
                        <span>Public Form</span>
                    </button>
                </div>
            </div>



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
                        onCancel={() => { setShowInlineForm(false); setViewMode('list'); setEditId(null); setForm(EMPTY_FORM); }}
                        submitting={submitting}
                        editId={editId}
                        doctors={doctors}
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
                                placeholder="Search by name, Registry ID, or mobile..."
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
                                        <th>Patient Identity</th>
                                        <th>Parental Profile</th>
                                        <th>Contact & Location</th>
                                        <th>Enrollment</th>
                                        <th style={{ textAlign: 'center' }}>Management</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && !patients.length ? (
                                        Array(6).fill(0).map((_, i) => (
                                            <tr key={i}>
                                                <td colSpan={5}><div className="skeleton-row-premium"></div></td>
                                            </tr>
                                        ))
                                    ) : patients.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="empty-state-cell">
                                                <div className="empty-box-premium">
                                                    <Info size={48} />
                                                    <h3>Registry is empty</h3>
                                                    <p>No patient records found matching your current filters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : patients.map(p => (
                                        <React.Fragment key={p._id}>
                                            <tr className={`patient-row-v2 ${selected?._id === p._id ? 'is-active' : ''}`}>
                                                <td>
                                                    <div className="patient-meta-box">
                                                        <div className={`avatar-premium ${p.gender === 'Female' ? 'pink' : 'blue'}`}>
                                                            {p.first_name?.charAt(0) || 'P'}
                                                        </div>
                                                        <div className="patient-name-stack">
                                                            <div className="name-bold-v2">{removeSalutation(p.full_name)}</div>
                                                            <div className="id-tag-premium">
                                                                <span className="id-label">{p.patient_id}</span>
                                                                <span className="dot">•</span>
                                                                <span className="age-label">{p.gender}, {calculateAge(p.dob)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="parent-inline">
                                                        <div className="parent-main">{p.father_name || p.parent_name || 'Anonymous'}</div>
                                                        <div className="parent-sub">{p.mother_name ? `Mother: ${p.mother_name}` : 'Parent profile'}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="contact-inline">
                                                        <div className="wa-box-mini">
                                                            <Zap size={14} className="wa-icon-glow" />
                                                            {p.wa_id || p.father_mobile || p.parent_mobile}
                                                        </div>
                                                        <div className="loc-box-mini">
                                                            <MapPin size={12} />
                                                            {p.city || 'Remote'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="status-badge-stack">
                                                        <span className={`status-chip-v3 ${p.registration_status === 'COMPLETE' ? 'complete' : 'pending'}`}>
                                                            {p.registration_status}
                                                        </span>
                                                        <span className="source-meta">Via {p.enrollment_source || p.registration_source || 'Dashboard'}</span>
                                                        {p.balance > 0 && <span className="source-meta" style={{ color: '#ef4444' }}>Bal: ₹{p.balance}</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="action-hub-premium">
                                                        <label className="hub-btn-info" style={{ cursor: 'pointer' }}>
                                                            <Camera size={18} />
                                                            <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoUpload(p.patient_id, e)} />
                                                        </label>
                                                        <button className={`hub-btn-info ${selected?._id === p._id ? 'active' : ''}`} onClick={() => setSelected(selected?._id === p._id ? null : p)}>
                                                            {selected?._id === p._id ? <X size={18} /> : <Clipboard size={18} />}
                                                        </button>
                                                        <button className="hub-btn-edit" onClick={() => startEdit(p)}>
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {selected?._id === p._id && (
                                                <tr className="expansion-row">
                                                    <td colSpan={5}>
                                                        <div className="expansion-content-premium">
                                                            <div className="expansion-grid">
                                                                <div className="expansion-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                                                    <div className="avatar-preview-box">
                                                                        <div className="large-avatar-premium" style={{ width: '100px', height: '100px', borderRadius: '24px', background: '#f8fafc', overflow: 'hidden', border: '2px solid #eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {p.photo || p.patient_photo ? (
                                                                                <img src={p.photo || p.patient_photo} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <User size={48} color="#cbd5e1" />
                                                                            )}
                                                                        </div>
                                                                        <label className="btn-upload-avatar" style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', borderRadius: '10px', background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                                            <Camera size={14} />
                                                                            <span>Upload</span>
                                                                            <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoUpload(p.patient_id, e)} />
                                                                        </label>
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <div className="exp-card-header"><Activity size={18} /> <span>Medical Profile</span></div>
                                                                        <div className="exp-info-list">
                                                                            <div className="exp-info-item"><span>Full Name</span><strong>{removeSalutation(p.full_name)}</strong></div>
                                                                            <div className="exp-info-item"><span>Status</span><strong>{p.is_active ? 'Active' : 'Inactive'}</strong></div>
                                                                            <div className="exp-info-item"><span>Birth Date</span><strong>{p.dob ? new Date(p.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}</strong></div>
                                                                            <div className="exp-info-item"><span>Registry ID</span><strong>{p.patient_id}</strong></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="expansion-card">
                                                                    <div className="exp-card-header"><Users size={18} /> <span>Family Details</span></div>
                                                                    <div className="exp-info-list">
                                                                        <div className="exp-info-item"><span>Father</span><strong>{p.father_name || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>Mother</span><strong>{p.mother_name || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>WhatsApp</span><strong>{p.wa_id || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>Email</span><strong>{p.email || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>Preferences</span><strong>{p.communication_preference || 'WhatsApp'}</strong></div>
                                                                    </div>
                                                                </div>
                                                                <div className="expansion-card">
                                                                    <div className="exp-card-header"><MapPin size={18} /> <span>Address & Assignments</span></div>
                                                                    <div className="exp-info-list" style={{ gap: '0.5rem' }}>
                                                                        <div className="exp-info-item"><span>Area</span><strong>{p.area || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>City</span><strong>{p.city || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>State</span><strong>{p.state || '—'}</strong></div>
                                                                        <div className="exp-info-item"><span>Address</span><strong style={{ fontSize: '0.8rem', textAlign: 'right' }}>{p.address || '—'}</strong></div>
                                                                        <div className="exp-info-item" style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}><span>Doctor</span><strong>{p.doctor || 'Clinic Registry'}</strong></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {(p.remark || p.remarks) && (
                                                                <div className="expansion-footer-premium" style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#fff', borderRadius: '15px', border: '1px solid #eef2ff' }}>
                                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                                        <Info size={16} style={{ color: '#6366f1', marginTop: '0.2rem' }} />
                                                                        <div>
                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Administrative Remarks</span>
                                                                            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#475569', fontWeight: 600, lineHeight: 1.5 }}>{p.remark || p.remarks}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
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
                            <div className="pagination-v2-premium">
                                <div className="pag-info">
                                    Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, pagination.total)}</strong> of <strong>{pagination.total}</strong>
                                    <span className="pag-total">patients in registry</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
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

            <style>{`
                .segmented-control-premium {
                    background: #f1f5f9;
                    padding: 0.4rem;
                    border-radius: 20px;
                    display: flex;
                    gap: 0.25rem;
                    border: 1px solid #e2e8f0;
                }
                .segment-btn {
                    padding: 0.6rem 1.25rem;
                    border-radius: 16px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-size: 0.9rem;
                    white-space: nowrap;
                }
                .segment-btn.active {
                    background: #fff;
                    color: #6366f1;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
                }
                .segment-btn:not(.active):hover {
                    color: #1e293b;
                    background: rgba(255,255,255,0.5);
                }

                .patients-page-v2 {
                    padding: 2.5rem;
                    max-width: 1600px;
                    margin: 0 auto;
                    animation: pageIn 0.5s ease-out;
                }

                @keyframes pageIn {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .header-section-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 3.5rem;
                }

                .header-title-premium-v2 {
                    font-size: 2.5rem;
                    font-weight: 900;
                    letter-spacing: -0.03em;
                    background: linear-gradient(135deg, #0f172a 0%, #4338ca 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 1rem;
                }

                .stats-pill-row {
                    display: flex;
                    gap: 1.25rem;
                }

                .stat-pill-premium {
                    background: #fff;
                    padding: 0.6rem 1.25rem;
                    border-radius: 50px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }

                .stat-pill-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-pill-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-pill-value {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #1e293b;
                    line-height: 1;
                }

                .stat-pill-label {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .header-actions-premium {
                    display: flex;
                    gap: 1rem;
                }

                .btn-share-premium {
                    padding: 0.85rem 1.75rem;
                    border-radius: 18px;
                    border: 2px solid #e2e8f0;
                    background: #fff;
                    color: #64748b;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-share-premium:hover {
                    border-color: #6366f1;
                    color: #6366f1;
                    background: #f5f3ff;
                }

                .btn-add-premium {
                    padding: 0.85rem 1.75rem;
                    border-radius: 18px;
                    border: none;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: #fff;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 8px 16px rgba(99, 102, 241, 0.25);
                }

                .btn-add-premium:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 20px rgba(99, 102, 241, 0.35);
                }

                .search-filter-section {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 1.5rem;
                    margin-bottom: 2.5rem;
                }

                .search-container-premium {
                    position: relative;
                    background: #fff;
                    border-radius: 24px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                    overflow: hidden;
                    transition: all 0.3s;
                }

                .search-container-premium:focus-within {
                    border-color: #6366f1;
                    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.08);
                }

                .search-icon-premium {
                    position: absolute;
                    left: 1.5rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #cbd5e1;
                }

                .search-input-premium {
                    width: 100%;
                    height: 64px;
                    padding: 0 1.5rem 0 4rem;
                    border: none;
                    outline: none;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .filters-group-premium {
                    display: flex;
                    gap: 1rem;
                    background: #fff;
                    padding: 0.6rem;
                    border-radius: 24px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                }

                .filter-select-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0 1.25rem;
                    background: #f8fafc;
                    border-radius: 16px;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }

                .filter-select-wrap:hover {
                    border-color: #e2e8f0;
                }

                .filter-select-premium {
                    border: none;
                    background: transparent;
                    font-weight: 700;
                    color: #64748b;
                    font-size: 0.9rem;
                    height: 48px;
                    outline: none;
                    cursor: pointer;
                    min-width: 140px;
                }

                .status-dot-mini {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #cbd5e1;
                }
                .status-dot-mini.success { background: #10b981; box-shadow: 0 0 8px #10b981; }
                .status-dot-mini.warning { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }

                .refresh-btn-v2 {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .refresh-btn-v2:hover {
                    color: #6366f1;
                    border-color: #6366f1;
                    transform: rotate(180deg);
                }

                .repository-card-premium {
                    background: #fff;
                    border-radius: 32px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 30px rgba(0,0,0,0.02);
                    overflow: hidden;
                }

                .table-premium-v3 {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }

                .table-premium-v3 th {
                    padding: 1.5rem 2rem;
                    background: #fdfdff;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    text-align: left;
                    border-bottom: 1px solid #f8fafc;
                }

                .patient-row-v2 td {
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid #f8fafc;
                    transition: all 0.2s;
                }

                .patient-row-v2.is-active td {
                    background: #f5f8ff;
                }

                .patient-row-v2:hover td {
                    background: #fcfdff;
                }

                .avatar-premium {
                    width: 52px;
                    height: 52px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.25rem;
                    color: #fff;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.06);
                }

                .avatar-premium.pink { background: linear-gradient(135deg, #f472b6 0%, #db2777 100%); }
                .avatar-premium.blue { background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); }

                .patient-meta-box {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                }

                .name-bold-v2 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 0.15rem;
                }

                .id-tag-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 700;
                }

                .id-label { color: #6366f1; }
                .age-label { color: #94a3b8; }

                .parent-inline {
                    display: flex;
                    flex-direction: column;
                }

                .parent-main {
                    font-weight: 700;
                    color: #334155;
                    font-size: 0.95rem;
                }

                .parent-sub {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    font-weight: 500;
                }

                .wa-box-mini {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 0.95rem;
                    background: #f0fdf4;
                    padding: 0.35rem 0.75rem;
                    border-radius: 10px;
                    width: fit-content;
                }

                .wa-icon-glow { color: #10b981; filter: drop-shadow(0 0 5px #10b981); }

                .loc-box-mini {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    color: #94a3b8;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-top: 0.4rem;
                    padding-left: 0.5rem;
                }

                .status-badge-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .status-chip-v3 {
                    padding: 0.35rem 0.85rem;
                    border-radius: 50px;
                    font-size: 0.7rem;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    width: fit-content;
                }

                .status-chip-v3.complete { background: #f0fdf4; color: #16a34a; }
                .status-chip-v3.pending { background: #fefce8; color: #a16207; }

                .source-meta {
                    font-size: 0.7rem;
                    color: #cbd5e1;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .action-hub-premium {
                    display: flex;
                    justify-content: center;
                    gap: 0.75rem;
                }

                .hub-btn-info, .hub-btn-edit {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .hub-btn-info { background: #f8fafc; color: #64748b; }
                .hub-btn-info.active { background: #0f172a; color: #fff; }
                .hub-btn-edit { background: #eef2ff; color: #6366f1; }
                
                .hub-btn-edit:hover { background: #6366f1; color: #fff; transform: scale(1.1); }

                .expansion-content-premium {
                    background: #f8faff;
                    padding: 2.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    animation: slideDown 0.3s ease-out;
                }

                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .expansion-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 2rem;
                }

                .expansion-card {
                    background: #fff;
                    border-radius: 20px;
                    padding: 1.5rem;
                    border: 1px solid #eef2ff;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                }

                .exp-card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 1.25rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 2px solid #f8fafc;
                }

                .exp-card-header span { font-size: 0.95rem; }

                .exp-info-list { display: flex; flex-direction: column; gap: 0.85rem; }
                .exp-info-item { display: flex; justify-content: space-between; align-items: center; }
                .exp-info-item span { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                .exp-info-item strong { font-size: 0.9rem; font-weight: 700; color: #334155; }

                .pagination-premium {
                    padding: 2.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 2rem;
                    background: #fdfdff;
                }

                .pag-btn {
                    padding: 0.75rem 1.5rem;
                    border-radius: 16px;
                    border: 2px solid #e2e8f0;
                    background: #fff;
                    color: #64748b;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .pag-btn:not(:disabled):hover { border-color: #6366f1; color: #6366f1; }

                .pag-info { font-size: 1rem; color: #64748b; font-weight: 600; }
                .pag-info strong { color: #0f172a; }
                .pag-total { margin-left: 0.5rem; font-size: 0.8rem; opacity: 0.7; }

                .inline-form-premium {
                    background: #fff;
                    border-radius: 32px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 8px 40px rgba(99, 102, 241, 0.08);
                    overflow: hidden;
                    margin-bottom: 2.5rem;
                }

                .pagination-v2-premium {
                    padding: 2rem 2.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #fdfdff;
                    border-top: 1px solid #f1f5f9;
                }

                .modal-header-premium-v2 {
                    color: #fff;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                }

                .modal-header-premium-v2::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                }

                .modal-title-group { display: flex; align-items: center; gap: 2rem; position: relative; z-index: 1; }
                .modal-icon-wrap-v2 {
                    width: 52px;
                    height: 52px;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }

                .modal-title-group h2 { font-size: 1.5rem; font-weight: 900; letter-spacing: -0.02em; margin: 0; }
                .modal-title-group p { font-size: 0.9rem; opacity: 0.8; margin-top: 0.25rem; font-weight: 600; }


                /* Form Inline Close Button (light bg context) */
                .modal-close-v3 {
                    background: #f1f5f9;
                    border: none;
                    color: #64748b;
                    padding: 0.75rem;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .modal-close-v3:hover { background: #fee2e2; color: #ef4444; }

                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    z-index: 1;
                }

                .modal-close-v3:hover { background: #ef4444; }

                .modal-form-premium {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow: hidden;
                }

                .form-scroll-area { 
                    padding: 2rem 2.5rem; 
                    overflow-y: auto; 
                    flex: 1; 
                }

                .form-grid-v2 { display: grid; gap: 1.5rem; }

                .form-section-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    color: #1e293b;
                    font-weight: 900;
                    font-size: 1.1rem;
                    padding: 1rem 0;
                    border-bottom: 2px solid #f1f5f9;
                    margin-top: 1rem;
                }

                .section-number {
                    width: 32px;
                    height: 32px;
                    background: #6366f1;
                    color: #fff;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    font-weight: 900;
                    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
                }

                .form-row-multi { display: flex; gap: 1rem; }
                .form-group-v2 { display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }

                .form-group-v2 label { 
                    font-size: 0.9rem; 
                    font-weight: 800; 
                    color: #475569; 
                    padding-left: 0.25rem;
                }

                .input-v3 {
                    height: 54px;
                    background: #f8fafc;
                    border: 2px solid #f1f5f9;
                    border-radius: 16px;
                    padding: 0 1.25rem;
                    font-size: 1rem;
                    font-weight: 600;
                    outline: none;
                    transition: all 0.2s;
                    color: #0f172a;
                }

                .input-v3:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.08); }

                .input-v3-icon {
                    flex: 1;
                    height: 54px;
                    border: none;
                    background: transparent;
                    padding: 0 1.25rem;
                    font-size: 1rem;
                    font-weight: 600;
                    outline: none;
                    color: #0f172a;
                }

                .input-with-icon-v3 {
                    display: flex;
                    align-items: center;
                    padding-left: 1.25rem;
                    background: #f8fafc;
                    border: 2px solid #f1f5f9;
                    border-radius: 16px;
                    transition: all 0.2s;
                    color: #94a3b8;
                }

                .input-with-icon-v3:focus-within {
                    border-color: #6366f1;
                    background: #fff;
                    color: #6366f1;
                }

                .checkbox-inline-v3 { justify-content: flex-end; padding-bottom: 0.5rem; }
                .toggle-wrapper-v3 { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; }
                .toggle-label-v3 { font-size: 0.85rem; font-weight: 700; color: #64748b; }

                .modal-footer-premium {
                    padding: 1.5rem 2.5rem;
                    background: #fdfdff;
                    border-top: 2px solid #f8fafc;
                    display: flex;
                    justify-content: flex-end;
                    gap: 1.5rem;
                }

                .btn-cancel-v3 {
                    height: 60px;
                    padding: 0 2rem;
                    border-radius: 20px;
                    background: #f1f5f9;
                    border: none;
                    color: #64748b;
                    font-weight: 800;
                    cursor: pointer;
                    font-size: 1.1rem;
                }

                .btn-save-v3 {
                    height: 60px;
                    padding: 0 3rem;
                    border-radius: 20px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    border: none;
                    color: #fff;
                    font-weight: 800;
                    cursor: pointer;
                    font-size: 1.1rem;
                    box-shadow: 0 15px 25px -5px rgba(99, 102, 241, 0.4);
                    transition: all 0.2s;
                }

                .btn-save-v3:hover { transform: translateY(-3px); box-shadow: 0 20px 40px -5px rgba(99, 102, 241, 0.5); }

                .alert-premium {
                    padding: 1.5rem 2rem;
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 2.5rem;
                    font-weight: 700;
                    position: relative;
                }

                .alert-premium.success { background: #f0fdf4; border: 1px solid #dcfce7; color: #15803d; }
                .alert-premium.error { background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; }

                .alert-close { position: absolute; right: 1.5rem; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.5; }

                .skeleton-row-premium {
                    height: 80px;
                    background: linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%);
                    background-size: 200% 100%;
                    animation: shim 2s infinite;
                    border-radius: 20px;
                    margin: 0.5rem 0;
                }

                @keyframes shim {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 1200px) {
                    .expansion-grid { grid-template-columns: repeat(2, 1fr); }
                    .header-section-premium { flex-direction: column; align-items: flex-start; gap: 2rem; }
                }

                @media (max-width: 768px) {
                    .search-filter-section { grid-template-columns: 1fr; }
                    .form-row-multi { flex-direction: column; gap: 1rem; }
                    .expansion-grid { grid-template-columns: 1fr; }
                    .modal-header-premium-v2 { padding: 2rem; }
                    .form-scroll-area { padding: 2rem; }
                    .modal-footer-premium { padding: 2rem; flex-direction: column-reverse; }
                    .btn-save-v3, .btn-cancel-v3 { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default Patients;
