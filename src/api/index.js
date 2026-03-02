import axios from 'axios';

const REMOTE_API_BASE_URL = 'https://api-dr-indu-child-care.brahmaastra.ai/api';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || REMOTE_API_BASE_URL;

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
        const canRetryWithRemote =
            isNetworkError &&
            !config.__retriedWithRemote &&
            typeof config.url === 'string' &&
            config.url.startsWith('/');

        if (canRetryWithRemote) {
            config.__retriedWithRemote = true;
            config.baseURL = REMOTE_API_BASE_URL;
            return api.request(config);
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

const toIsoDate = (date = new Date()) => {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
};

const buildDoctorSlotParams = (doctorRef, date, extraParams = {}) => {
    const params = {
        ...extraParams,
        date,
    };

    if (!doctorRef) return params;

    const value = String(doctorRef).trim();
    const normalized = value.toUpperCase();
    if (['PULMONARY', 'NON_PULMONARY', 'VACCINATION', 'ANY'].includes(normalized)) {
        params.doctor_type = normalized;
    } else if (value.toLowerCase().startsWith('dr') || value.includes(' ')) {
        params.doctor_name = value;
    } else {
        params.doctor_id = value;
    }

    return params;
};

const getDoctorNameVariants = (name) => {
    const base = String(name || '').trim();
    if (!base) return [];

    const variants = new Set([
        base,
        base.replace(/\s+/g, ' '),
        base.replace(/^Dr\.\s+/i, 'Dr.'),
        base.replace(/^Dr\s+/i, 'Dr '),
    ]);

    const normalized = base.replace(/\s+/g, ' ');
    const drWithoutGap = normalized.replace(/^Dr\.\s*/i, 'Dr.');
    const drCompact = normalized.replace(/^Dr\.?\s*/i, 'Dr');

    variants.add(drWithoutGap);
    variants.add(drCompact);
    variants.add(drCompact.replace(/^Dr/i, 'Dr '));
    variants.add(drCompact.replace(/^Dr/i, 'Dr.'));

    return [...variants].filter(Boolean);
};

const isDoctorLookupError = (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || '').toLowerCase();
    return status === 404 && message.includes('doctor not found');
};

const withDoctorNameFallback = async (requestFn, params) => {
    if (!params?.doctor_name) return requestFn(params);

    const variants = getDoctorNameVariants(params.doctor_name);
    let lastError;

    for (const doctorName of variants) {
        try {
            return await requestFn({ ...params, doctor_name: doctorName });
        } catch (error) {
            lastError = error;
            if (!isDoctorLookupError(error)) throw error;
        }
    }

    throw lastError;
};

const canonicalDoctorName = (name) => {
    const variants = getDoctorNameVariants(name);
    if (!variants.length) return name;
    const preferred =
        variants.find((v) => /^Dr\.[A-Za-z]/.test(v)) ||
        variants.find((v) => /^Dr\.\S/.test(v)) ||
        variants[0];
    return preferred;
};

// Auth
export const login = (credentials) => api.post('/admin/login', credentials);
export const refreshAccessToken = (data) => api.post('/admin/refresh-token', data);
export const logoutAdmin = (data) => api.post('/admin/logout', data);
export const getAdminProfile = () => api.get('/admin/profile');
export const updateAdminProfile = (data) => api.patch('/admin/profile', data);

// Admin
export const getAdminOverview = () => api.get('/admin/overview');
export const getAdminRoles = () => api.get('/admin/roles');
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const createAdminUser = (data) => api.post('/admin/users', data);
export const updateAdminUser = (id, data) => api.patch(`/admin/users/${id}`, data);
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`);

// Patients
export const getPatients = (params) => api.get('/patients', { params });
export const searchPatients = (q) => api.get('/patients', { params: { search: q } });
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const getPatientByWa = (waId) => api.get(`/patients/by-wa/${encodeURIComponent(waId)}`);
export const registerPatient = (data) => api.post('/patients', data);
export const registerFromForm = (data) => api.post('/patients/form', data);
export const registerFromWhatsapp = (data) => api.post('/patients/whatsapp', data);
export const updatePatient = (id, data) => api.put(`/patients/${id}`, data);
export const uploadPatientPhoto = (patientId, photoBase64) =>
    api.patch(`/patients/${patientId}/photo`, { photo: photoBase64 });

// Appointments
export const getAppointments = (params) => api.get('/appointments', { params });
export const getAppointmentsByDate = (date) => api.get('/appointments', { params: { date } });
export const getAppointmentStats = (date) => api.get('/appointments/stats', { params: date ? { date } : {} });
export const getAppointmentById = (id) => api.get(`/appointments/${id}`);
export const getAppointmentsByWaId = (waId) => api.get(`/appointments/by-wa/${encodeURIComponent(waId)}`);
export const bookAppointment = (data) => api.post('/appointments', {
    booking_source: 'dashboard',
    ...data,
    doctor_name: data?.doctor_name ? canonicalDoctorName(data.doctor_name) : data?.doctor_name,
});
export const bookByWhatsapp = (data) => api.post('/appointments/whatsapp', data);
export const bookByForm = (data) => api.post('/appointments/form', data);
export const updateAppointment = (id, data) => api.patch(`/appointments/${id}`, {
    ...data,
    doctor_name: data?.doctor_name ? canonicalDoctorName(data.doctor_name) : data?.doctor_name,
});
export const cancelAppointment = (id, data) => api.patch(`/appointments/${id}/cancel`, data);
export const completeAppointment = (id, data) => api.patch(`/appointments/${id}/complete`, data);
export const markNoShow = (id, data) => api.patch(`/appointments/${id}/no-show`, data);

// Tokens and queue
export const bookAppointmentWithToken = (data) => api.post('/appointments/book-with-token', data);
export const getDailyTokens = (params) => api.get('/appointments/daily-tokens', { params });
export const getClinicDisplayData = (params) => api.get('/appointments/clinic-display', { params });
export const nextToken = (doctorId, params) => api.get(`/appointments/next-token/${doctorId}`, { params });
export const checkInToken = (token, data) => api.post(`/appointments/token/${token}/check-in`, data);
export const updateTokenStatus = (token, data) => api.patch(`/appointments/token/${token}/status`, data);
export const getTokenStatus = (token) => api.get(`/appointments/token-status/${token}`);
export const autoReschedule = (data) => api.post('/appointments/auto-reschedule', data);

// Doctors
export const getDoctors = (params) => api.get('/doctors', { params });
export const getDoctorById = (id) => api.get(`/doctors/${id}`);
export const createDoctor = (data) => api.post('/doctors', data);
export const updateDoctor = (id, data) => api.patch(`/doctors/${id}`, data);
export const deleteDoctor = (id) => api.delete(`/doctors/${id}`);

// Doctor availability
export const updateDoctorAvailability = (data) => api.post('/doctor/availability/update', data);
export const getDoctorAvailability = (doctorId) => api.get(`/doctor/availability/${doctorId}`);
export const patchDoctorAvailabilityStatus = (doctorId, data) => api.patch(`/doctor/availability/${doctorId}/status`, data);
export const patchDoctorAvailabilityEta = (doctorId, data) => api.patch(`/doctor/availability/${doctorId}/eta`, data);
export const logDoctorLateCheckin = (data) => api.post('/doctor/late-checkin', data);
export const getDoctorLateCheckins = (doctorId) => api.get(`/doctor/late-checkins/${doctorId}`);
export const getDoctorAvailabilityDashboard = (doctorId) => api.get(`/doctor/availability-dashboard/${doctorId}`);

// Slots
export const getAvailableSlots = (doctorRef, date, extraParams = {}) => {
    const params = buildDoctorSlotParams(doctorRef, date, extraParams);
    return withDoctorNameFallback((nextParams) => api.get('/slots/available', { params: nextParams }), params);
};
export const getSlotConfig = () => api.get('/slots/config');
export const updateSlotConfig = (slots) => api.put('/slots/config', { slots });
export const createSlot = (data) => api.post('/slots/config/add', data);
export const deleteSlot = (slotId) => api.delete(`/slots/config/${slotId}`);
export const updateDailySlot = (data) => {
    const doctorName = data?.doctor_name ? canonicalDoctorName(data.doctor_name) : data?.doctor_name;
    const { date, ...rest } = data;
    const payload = {
        ...rest,
        doctor_name: doctorName,
        slot_date: date || data.slot_date
    };
    return withDoctorNameFallback(
        (nextPayload) => api.post('/slots/daily-update', nextPayload),
        payload
    );
};

// Messaging
export const queueDoctorLateAlert = (data) => api.post('/messages/doctor/late-alert', data);
export const getPendingMessages = () => api.get('/messages/messages/pending');
export const updateMessageStatus = (queueId, data) => api.patch(`/messages/messages/${queueId}/status`, data);

// MRD
export const getMRDByPatientId = (patientId) => api.get(`/mrd/${patientId}`);
export const addMRDEntry = (data) => api.post('/mrd/entry', data);
export const getEntryByAppointment = (appointmentId) => api.get(`/mrd/appointment/${appointmentId}`);
export const lockMRDEntry = (id, data) => api.patch(`/mrd/entry/${id}/lock`, data);
export const uploadMRDAttachment = (id, data) => api.post(`/mrd/entry/${id}/attachment`, data);

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

// WhatsApp bot
export const getBotSession = (waId) => api.get(`/bot/session/${waId}`);
export const createBotSession = (data) => api.post('/bot/session/create', data);
export const updateBotSession = (data) => api.patch('/bot/session/update', data);
export const escalateSession = (data) => api.post('/bot/escalate', data);
export const getUnregisteredInteractions = () => api.get('/bot/interactions/unregistered');
export const logChat = (data) => api.post('/bot/chat/log', data);
export const getChatHistory = (waId) => api.get(`/bot/chat/history/${waId}`);

// Compatibility aliases retained for existing screens
export const getTodayAppointments = () => getAppointmentsByDate(toIsoDate());
export const getPatientByMobile = (mobile) => getPatientByWa(mobile);
export const getAppointmentsByMobile = (mobile) => getAppointmentsByWaId(mobile);
export const getPendingReminders = () => getPendingMessages();
export const markReminderSent = (id) => updateMessageStatus(id, { status: 'SENT' });
export const getDailyStatus = async (doctorRef, date, extraParams = {}) => {
    const response = await getAvailableSlots(doctorRef, date, extraParams);
    const normalized = (response.data?.data || []).map((slot) => ({
        ...slot,
        is_booked: !!slot.is_booked,
        blocked_by_admin: !!slot.blocked_by_admin,
    }));
    return {
        ...response,
        data: {
            ...response.data,
            data: normalized,
        },
    };
};
export const blockSlots = (data) => updateDailySlot({ ...data, action: 'block' });
export const unblockSlots = (data) => updateDailySlot({ ...data, action: 'unblock' });
export const exportMRD = (patientId) => getMRDByPatientId(patientId);
export const updateMRDEntry = (id, data) => api.patch(`/mrd/entry/${id}`, data);
export const closeBotSession = (data) => escalateSession(data);
export const getSessionHistory = (waId) => getChatHistory(waId);
export const logBotMessage = (data) => logChat(data);
export const getEscalations = (params = {}) => getNotifications({ ...params, severity: 'high', status: 'UNREAD' });
export const resolveEscalation = (id) => markNotificationRead(id);

export default api;
