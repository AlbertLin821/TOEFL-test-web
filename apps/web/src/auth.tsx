import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, type CurrentUser } from './api/client';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>('/users/me');
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const logout = async () => {
    await api.post('/auth/logout');
    queryClient.setQueryData(['me'], null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
