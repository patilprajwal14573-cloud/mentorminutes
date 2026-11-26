import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  ensureProfileFromAuthUser,
  fetchProfileById,
  getPendingInviteCode,
  clearPendingInviteCode,
  joinRelationshipByInviteCodeRpc,
} from '../services/authService';
import { User, UserRole } from '../types';

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title?: string;
  companyOrSchool?: string;
}

export interface AuthActionResult {
  success: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (userData: RegisterData) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatAuthError = (message: string | undefined, fallback: string): string => {
  if (!message) return fallback;
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address before signing in. Check your inbox for the verification link.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Invalid email or password.';
  }
  if (/user already registered/i.test(message)) {
    return 'An account with that email already exists.';
  }
  return message;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserProfile = useCallback(
    async (
      activeSession: Session | null
    ): Promise<{ profile: User | null; errorMessage?: string }> => {
      if (!activeSession?.user) {
        setUser(null);
        return { profile: null };
      }

      try {
        const profile = await ensureProfileFromAuthUser(activeSession.user);
        setUser(profile);

        // Consume any pending learner invite code saved before email verification/login
        if (profile?.role === 'learner') {
          const pendingCode = getPendingInviteCode();
          if (pendingCode) {
            try {
              await joinRelationshipByInviteCodeRpc(pendingCode, 'Mentorship Workspace');
            } catch {
              // Ignore if already connected or code expired; user can still manage invites on RelationshipsPage
            } finally {
              clearPendingInviteCode();
            }
          }
        }

        return { profile };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load profile from Supabase';
        console.error('Failed to load profile from Supabase:', errorMessage);
        setUser(null);
        return { profile: null, errorMessage };
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const supabase = getSupabaseClient();

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Failed to restore Supabase session:', error.message);
        }
        if (!mounted) return;
        const currentSession = data.session ?? null;
        setSession(currentSession);
        await loadUserProfile(currentSession);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      // Defer DB profile fetch outside the auth callback to avoid Supabase client lock contention
      setTimeout(() => {
        if (!mounted) return;
        void loadUserProfile(nextSession).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Supabase is not configured in client/.env.' };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.session) {
        return {
          success: false,
          message: formatAuthError(error?.message, 'Invalid email or password.'),
        };
      }

      setSession(data.session);
      const { profile, errorMessage } = await loadUserProfile(data.session);
      if (!profile) {
        return {
          success: false,
          message: errorMessage
            ? `Signed in, but your profile could not be loaded: ${errorMessage}`
            : 'Signed in, but your profile record could not be loaded.',
        };
      }

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Login error occurred',
      };
    }
  };

  const register = async (userData: RegisterData): Promise<AuthActionResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Supabase is not configured in client/.env.' };
    }

    try {
      const supabase = getSupabaseClient();
      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        options: {
          emailRedirectTo,
          data: {
            name: userData.name.trim(),
            role: userData.role,
            title: userData.title?.trim() || '',
            companyOrSchool: userData.companyOrSchool?.trim() || '',
          },
        },
      });

      if (error) {
        return {
          success: false,
          message: formatAuthError(error.message, 'Registration failed'),
        };
      }

      // Supabase returns identities: [] when an email is already registered (if confirm email is on)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          success: false,
          message: 'An account with this email already exists. Please sign in instead.',
        };
      }

      if (!data.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          message:
            'Account created! Please check your email inbox and click the confirmation link before signing in.',
        };
      }

      setSession(data.session);
      const { profile, errorMessage } = await loadUserProfile(data.session);
      if (!profile) {
        return {
          success: false,
          message: errorMessage
            ? `Account created, but your profile could not be loaded: ${errorMessage}`
            : 'Account created, but your profile record could not be loaded.',
        };
      }

      return { success: true, requiresEmailConfirmation: false };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Registration error occurred',
      };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
    } finally {
      setSession(null);
      setUser(null);
      localStorage.removeItem('mentorminutes_token');
      localStorage.removeItem('mentorminutes_user');
    }
  };

  const refreshUser = async () => {
    if (!session?.user) return;
    try {
      const freshProfile = await fetchProfileById(session.user.id, 1);
      if (freshProfile) {
        setUser(freshProfile);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token: session?.access_token ?? null,
        isAuthenticated: Boolean(session && user),
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
