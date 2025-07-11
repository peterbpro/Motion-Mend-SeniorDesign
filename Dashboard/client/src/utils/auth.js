import Cookies from 'js-cookie';

const DOCTOR_COOKIE = 'doctor_data';

export const setDoctorAuth = (doctorData) => {
    Cookies.set(DOCTOR_COOKIE, JSON.stringify(doctorData), {
        expires: 7,
        path: '/',
        domain: window.location.hostname
    });
};

export const getDoctorAuth = () => {
    const doctorData = Cookies.get(DOCTOR_COOKIE);
    return doctorData ? JSON.parse(doctorData) : null;
};

export const clearDoctorAuth = () => {
    Cookies.remove(DOCTOR_COOKIE, {
        path: '/',
        domain: window.location.hostname
    });
};

export const isAuthenticated = () => {
    return !!getDoctorAuth();
}; 