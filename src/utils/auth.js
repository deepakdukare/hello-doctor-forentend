export const getUser = () => {
    try {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : {};
    } catch (e) {
        return {};
    }
};

export const getToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const hasPermission = (permission) => {
    const user = getUser();
    if (!user || (!user.role && !user.id && !user._id)) return false;

    const role = String(user.role || '').toLowerCase();
    const isDoctor = role === 'doctor';

    // Restriction: Doctors should not see sensitive patient contact data
    if (isDoctor && (permission === 'view_patient_mobile' || permission === 'view_patient_email')) {
        return false;
    }

    // Super-admins and primary admins have full override access
    if (role === 'super_admin' || role === 'superadmin' || role === 'admin' || isDoctor) {
        return true;
    }

    // Safety fallback: allow Dashboard for everyone who is logged in
    if (permission === 'view_dashboard') return true;

    // Transition fallback: If the 'permissions' field is missing ENTIRELY from the user object,
    // grant full access to prevent locking out accounts that don't have the field yet.
    if (!user.permissions || user.permissions.length === 0) {
        return true;
    }

    // Standard array-based permission check
    return (user.permissions || []).includes(permission);
};
