import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { request } from '@/lib/api';

const TOKEN_KEY = 'btp_token';
const USER_KEY = 'btp_user';

// expo-secure-store doesn't support web in SDK 54+; fall back to localStorage
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'officer' | 'admin';
  police_station: string;
  avatar_url: string | null;
  number: string;
  push_token: string | null;
  is_active: boolean;
  must_change_password?: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ request_id: string; status: string }>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  number: string;
  police_station: string;
  avatar_url?: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          storage.get(TOKEN_KEY),
          storage.get(USER_KEY),
        ]);
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u) as User);
        }
      } catch {
        // ignore storage errors
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    await Promise.all([
      storage.set(TOKEN_KEY, data.token),
      storage.set(USER_KEY, JSON.stringify(data.user)),
    ]);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return request<{ request_id: string; status: string }>('/auth/register', {
      method: 'POST',
      body: data,
    });
  }, []);

  const changePassword = useCallback(async (newPassword: string, currentPassword?: string) => {
    // Fall back to stored token if the in-memory one is missing (e.g. screen
    // reached before auth state hydrated). Avoids a spurious 401 on submit.
    const authToken = token ?? (await storage.get(TOKEN_KEY));
    if (!authToken) throw new Error('Your session has expired. Please log in again.');
    await request('/auth/change-password', {
      method: 'POST',
      body: { new_password: newPassword, current_password: currentPassword },
      token: authToken,
    });
    // Clear the first-login flag locally so guards stop redirecting.
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, must_change_password: false };
      storage.set(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [token]);

  const logout = useCallback(async () => {
    await Promise.all([
      storage.del(TOKEN_KEY),
      storage.del(USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
