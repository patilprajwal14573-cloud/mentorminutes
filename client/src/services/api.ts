import axios from 'axios';

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    if (import.meta.env.PROD && configured.startsWith('http://localhost') && typeof window !== 'undefined') {
      return '/api';
    }
    return configured;
  }
  return import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';
};

const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mentorminutes_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-redirect on login check
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
        localStorage.removeItem('mentorminutes_token');
        localStorage.removeItem('mentorminutes_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
