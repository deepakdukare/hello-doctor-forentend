import axios from 'axios';

const REMOTE_API_BASE_URL = 'https://api-vfbnzo4maa-uc.a.run.app/api';
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : REMOTE_API_BASE_URL);
if (API_BASE_URL.endsWith('/')) {
    API_BASE_URL = API_BASE_URL.slice(0, -1);
}

const ENABLE_REMOTE_FALLBACK = String(import.meta.env.VITE_ENABLE_REMOTE_FALLBACK || '').toLowerCase() === 'true';
const REMOTE_FALLBACK_METHODS = new Set(['get', 'head', 'options']);

if (import.meta.env.DEV) {
    console.info('API Connectivity v1.1.0:', {
        baseURL: API_BASE_URL,
        remoteFallback: ENABLE_REMOTE_FALLBACK ? 'enabled' : 'disabled'
    });
}

const normalizePatientGender = (gender) => {
    if (gender === undefined || gender === null || gender === '') return gender;
    const value = String(gender).trim().toLowerCase();
    if (value === 'boy' || value === 'male' || value === 'm') return 'boy';
    if (value === 'girl' || value === 'female' || value === 'f') return 'girl';
    if (value === 'other' || value === 'others' || value === 'o') return gender;
    return gender;
};

const normalizePatientPayload = (data = {}) => {
    if (!data || typeof data !== 'object') return data;
    const normalized = { ...data };
    if (Object.prototype.hasOwnProperty.call(normalized, 'gender')) {
        normalized.gender = normalizePatientGender(normalized.gender);
    }
    return normalized;
};
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config || {};
        const isNetworkError = !error.response;
        const isProxyFailure = error.response?.status === 404 || error.response?.status === 502;

        const requestMethod = String(config.method || 'get').toLowerCase();
        const canRetryWithRemote =
            ENABLE_REMOTE_FALLBACK &&
            REMOTE_FALLBACK_METHODS.has(requestMethod) &&
            (isNetworkError || isProxyFailure) &&
            !config.__retriedWithRemote &&
            typeof config.url === 'string' &&
            config.url.startsWith('/') &&
            API_BASE_URL.startsWith('/');

        if (canRetryWithRemote) {
            config.__retriedWithRemote = true;
            config.baseURL = REMOTE_API_BASE_URL;
            return api.request(config);
        }

        if (isNetworkError && API_BASE_URL.startsWith('/api')) {
            error.message = 'Cannot connect to local API at http://localhost:5000. Start the backend server and retry.';
        }
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const toIsoDate = (date = new Date()) => {
    if (typeof date === 'string') return date;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- CORE RESOURCES ---

// Appointments
export const getAppointments = (params) => api.get('/appointments', { params });
export const getAppointmentById = (id) => api.get(`/appointments/${id}`);
export const getAppointmentsByDate = (date) => api.get('/appointments', { params: { date } });
export const getAppointmentStats = (date) => api.get('/appointments/stats', { params: { date } });
export const getTodayAppointments = () => getAppointmentsByDate(toIsoDate());
export const createAppointment = (data) => api.post('/appointments', data);
export const bookAppointment = (data) => createAppointment(data); // Alias
export const updateAppointment = (id, data) => api.patch(`/appointments/${id}`, data);
export const cancelAppointment = (id, data) => api.patch(`/appointments/${id}/cancel`, data);
export const completeAppointment = (id) => api.patch(`/appointments/${id}/complete`);
export const markNoShow = (id, data) => api.patch(`/appointments/${id}/no-show`, data);
export const lookupAppointments = (query) => api.get(`/appointments/lookup`, { params: { query } });
export const bookWithToken = (data) => api.post('/appointments/book-with-token', data);
export const bookAppointmentWithToken = (data) => bookWithToken(data); // Alias

// Patients
export const getPatients = (params) => api.get('/patients', { params });
export const searchPatients = (q) => getPatients(typeof q === 'string' ? { search: q } : q); // Alias
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const getPatientByEmail = (email) => api.get(`/patients/by-email/${email}`);
export const registerPatient = (data) => api.post('/patients', normalizePatientPayload(data));
export const updatePatient = (id, data) => api.put(`/patients/${id}`, normalizePatientPayload(data));
export const registerFromForm = (data) => api.post('/patients/form', normalizePatientPayload(data));
export const uploadPatientPhoto = (id, data) => api.patch(`/patients/${id}/photo`, data);

// Doctors
export const getDoctors = (params) => api.get('/doctors', { params });
export const getDoctorById = (id) => api.get(`/doctors/${id}`);
export const getDoctorHistory = (id, params) => api.get(`/doctors/${id}/history`, { params });
export const createDoctor = (data) => api.post('/doctors', data);
export const updateDoctor = (id, data) => api.patch(`/doctors/${id}`, data);
export const deleteDoctor = (id) => api.delete(`/doctors/${id}`);

// Doctor Availability & Schedule
export const getDoctorAvailability = (id, params) => api.get(`/doctor/availability/${id}`, { params });
export const getDoctorAvailabilityDashboard = (id) => api.get(`/doctor/availability-dashboard/${id}`);
export const updateDoctorAvailability = (data) => api.post('/doctor/availability/update', data);
export const patchDoctorAvailabilityStatus = (id, statusOrData, notes) => {
    const payload = (statusOrData && typeof statusOrData === 'object') ? statusOrData : { status: statusOrData, notes };
    return api.patch(`/doctor/availability/${id}/status`, payload);
};
export const patchDoctorAvailabilityEta = (id, data) => api.patch(`/doctor/availability/${id}/eta`, data);
export const logDoctorLateCheckin = (data) => api.post('/doctor/late-checkin', data);
export const getDoctorLateCheckins = (id) => api.get(`/doctor/late-checkins/${id}`);

export const getDoctorSchedule = (id) => api.get(`/doctor/schedule/${id}`);
export const updateDoctorSchedule = (id, data) => api.put(`/doctor/schedule/${id}`, data);
export const getTodaySchedule = (id) => api.get(`/doctor/schedule/${id}/today`);
export const getScheduleHistory = (id) => api.get(`/doctor/schedule/${id}/history`);
export const setTodayStartTime = (data) => api.patch('/doctor/today-start', data);
export const notifyPatientsOfTime = (data) => api.post('/doctor/notify-patients', data);
export const notifyDelay = (data) => api.post('/appointments/notify-delay', data);

// Token-based Scheduling Config
export const getTokenConfig = (doctorId) => api.get(`/token-config/${doctorId}`);
export const updateTokenConfig = (data) => api.post('/token-config', data);
export const addDateOverride = (data) => api.post('/token-config/override', data);

// Available Tokens (Replacement for Slots)
export const getAvailableTokens = (doctorId, date) => api.get('/appointments/tokens/available', { params: { doctor_id: doctorId, date } });
export const getDailyTokens = (params) => api.get('/appointments/daily-tokens', { params });
export const getClinicDisplayData = () => api.get('/appointments/clinic-display');
export const nextToken = (doctorId) => api.get(`/appointments/next-token/${doctorId}`);
export const checkInToken = (token, data) => api.post(`/appointments/token/${token}/check-in`, data);
export const updateTokenStatus = (token, data) => api.patch(`/appointments/token/${token}/status`, data);
export const getTokenStatus = (token) => api.get(`/appointments/token-status/${token}`);
export const autoReschedule = (data) => api.post('/appointments/auto-reschedule', data);

// MRD
export const getMRDByPatientId = (patientId) => api.get(`/mrd/${patientId}`);
export const addMRDEntry = (data) => api.post('/mrd/entry', data);
export const getEntryByAppointment = (appointmentId) => api.get(`/mrd/appointment/${appointmentId}`);
export const lockMRDEntry = (id, data) => api.patch(`/mrd/entry/${id}/lock`, data);
export const uploadMRDAttachment = (id, data) => api.post(`/mrd/entry/${id}/attachment`, data);
export const getMRDEntryPdfUrl = (id) => `${API_BASE_URL}/mrd/entry/${id}/pdf`;

// Clinical Master Data
export const getClinicalNoteTemplates = () => api.get('/clinical/note-templates');
export const getCareAdviceTemplates = () => api.get('/clinical/care-advice-templates');
export const getClinicalIcd10 = (search) => api.get('/clinical/icd10', { params: { search } });
export const getClinicalMedicines = (search) => api.get('/clinical/medicines', { params: { search } });
export const getClinicalInvestigations = (search) => api.get('/clinical/investigations', { params: { search } });
export const getClinicalProcedures = (search) => api.get('/clinical/procedures', { params: { search } });
export const getClinicalComplaints = (search) => api.get('/clinical/complaints', { params: { search } });
export const getClinicalAllergies = (search) => api.get('/clinical/allergies', { params: { search } });
export const getClinicalDiagramTemplates = () => api.get('/clinical/diagrams');
export const getReferralTargets = () => api.get('/clinical/referral-targets');
export const upsertClinicalTemplate = (data) => api.post('/clinical/templates', data);
export const getTemplates = (params) => api.get('/clinical/templates', { params });
export const deleteClinicalTemplate = (id) => api.delete(`/clinical/templates/${id}`);

// Patient Clinical Context
export const getPatientVitalsHistory = (patientId) => api.get(`/mrd/${patientId}/vitals-history`);
export const getPatientAllergySummary = (patientId) => api.get(`/mrd/${patientId}/allergy-summary`);
export const getPatientCurrentMeds = (patientId) => api.get(`/mrd/${patientId}/current-meds`);
export const getPatientHistory = (patientId) => api.get(`/mrd/${patientId}/history`);

// Comprehensive Patient Profile
export const getComprehensiveProfile = (patientId) => api.get(`/patients/${patientId}/comprehensive`);

// System
export const getSystemHealth = () => api.get('/system/health');
export const getConfig = () => api.get('/config');
export const updateConfig = (data) => api.patch('/config', data);
export const getAuditLogs = (params) => api.get('/audit/logs', { params });
export const getNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/mark-read`);
export const scheduleReminder = (data) => api.post('/reminders/schedule', data);

// Reports
export const getReportsDashboard = (params) => api.get('/reports/dashboard', { params });
export const getAppointmentsReport = (params) => api.get('/reports/appointments', { params });

// Analytics
export const getPracticeInsights = (params) => api.get('/analytics/practice-insights', { params });
export const submitFeedback = (data) => api.post('/feedback', data);
export const getFeedback = (params) => api.get('/feedback', { params });

// Admin / Users
export const getAdminOverview = () => api.get('/admin/overview');
export const getAdminRoles = () => api.get('/admin/roles');
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const createAdminUser = (data) => api.post('/admin/users', data);
export const updateAdminUser = (id, data) => api.patch(`/admin/users/${id}`, data);
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`);
export const getAdminProfile = (params) => api.get('/admin/profile', { params });
export const updateAdminProfile = (data) => api.patch('/admin/profile', data);

// Compatibility aliases
export const getPatientByMobile = (mobile) => api.get('/patients', { params: { search: mobile } });
export const resolveEscalation = (id) => markNotificationRead(id);

export default api;
