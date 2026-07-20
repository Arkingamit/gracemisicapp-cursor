"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getFullUrl } from '@/lib/api';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  /** Re-fetch current user from the server (roles, moderation, session). */
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper for authenticated API calls
// With HttpOnly cookies, the browser automatically attaches the cookie to same-origin requests.
// We no longer need to manually inject the Authorization header.
export const authFetch = async (url: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(getFullUrl(url), { ...options, headers });
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // On mount, check for stored token and load user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const fetchUrl = '/api/auth/me';
        const res = await authFetch(fetchUrl);
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        } else {
          // Token expired or invalid
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(getFullUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setCurrentUser(data.user);

      toast({
        title: 'Login successful',
        description: `Welcome back, ${data.user.username || data.user.name}!`,
      });
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(getFullUrl('/api/auth/logout'), { method: 'POST' });
    } catch (e) {
      console.error('Logout failed', e);
    }
    setCurrentUser(null);
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out',
    });
  };

  const register = async (email: string, password: string, username: string) => {
    setLoading(true);
    try {
      const res = await fetch(getFullUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setCurrentUser(data.user);

      toast({
        title: 'Registration successful',
        description: `Welcome, ${username}!`,
      });
    } catch (error) {
      toast({
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      // Decode Google JWT to extract user info
      const decoded = jwtDecode<{ email: string, sub: string, name: string }>(credential);

      // Register or login the Google user via our API
      // First try to login, if that fails, register
      let res = await fetch(getFullUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: decoded.email, 
          password: `google_${decoded.sub}` // Google users use sub as password
        }),
      });

      if (!res.ok) {
        // User doesn't exist, register them
        res = await fetch(getFullUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: decoded.name,
            email: decoded.email,
            password: `google_${decoded.sub}`,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Google sign-in failed');
      }

      setCurrentUser(data.user);

      toast({
        title: 'Google Sign-in successful',
        description: `Welcome, ${data.user.username || data.user.name}!`,
      });
    } catch (error) {
      toast({
        title: 'Google Sign-in failed',
        description: 'Could not process Google login token.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) {
        setCurrentUser(null);
        return null;
      }
      const data = await res.json();
      setCurrentUser(data.user);
      return data.user as User;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setCurrentUser(null);
      return null;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      const res = await authFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setCurrentUser(data.user);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile information has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    logout,
    register,
    loginWithGoogle,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
