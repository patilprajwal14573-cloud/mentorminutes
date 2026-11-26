import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';
import { User, UserRole } from '../types';

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title?: string;
  companyOrSchool?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mentorminutes_user');
    return saved ? (JSON.parse(saved) as User) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('mentorminutes_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Check auth status on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('mentorminutes_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('mentorminutes_user', JSON.stringify(res.data.user));
          }
        } catch {
          console.warn('Auth token expired or invalid');
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('mentorminutes_token', newToken);
        localStorage.setItem('mentorminutes_user', JSON.stringify(newUser));
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'Login error occurred') };
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const res = await api.post('/auth/register', userData);
      if (res.data.success) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('mentorminutes_token', newToken);
        localStorage.setItem('mentorminutes_user', JSON.stringify(newUser));
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Registration failed' };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'Registration error occurred') };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mentorminutes_token');
    localStorage.removeItem('mentorminutes_user');
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('mentorminutes_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('mentorminutes_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
