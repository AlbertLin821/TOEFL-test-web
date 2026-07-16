import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiUser } from '../lib/api';

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
  };

  const register = async (name: string, email: string, password: string) => {
    const { user: u } = await api.register(name, email, password);
    setUser(u);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function homeForRole(role: string): string {
  switch (role) {
    case 'student':
      return '/student/exams';
    case 'teacher':
      return '/teacher';
    case 'org_admin':
    case 'platform_admin':
      return '/admin';
    default:
      return '/login';
  }
}
