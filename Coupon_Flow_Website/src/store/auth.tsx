import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, onUnauthorized, setToken } from '../lib/api';
import type { User } from '../lib/types';

interface AuthValue {
  user: User | null;
  /** True until a stored token has been checked against the API. */
  checking: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** Re-reads the signed-in user (after confirming an email address, for example). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => getToken() !== null);

  useEffect(() => onUnauthorized(() => setUser(null)), []);

  useEffect(() => {
    if (!getToken()) return;
    api.get<{ data: User }>('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password, device_name: 'website' });
    setToken(res.token, remember);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', {
      name, email, password, password_confirmation: password,
    });
    setToken(res.token, true);
    setUser(res.user);
    return res.user;
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    const res = await api.get<{ data: User }>('/auth/me');
    setUser(res.data);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
