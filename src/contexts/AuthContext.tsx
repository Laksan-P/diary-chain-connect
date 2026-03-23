import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { getStoredUser, logout as apiLogout, setStoredUser, setToken } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginUser: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true, loginUser: () => {}, logout: () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setIsLoading(false);
  }, []);

  const loginUser = useCallback((user: User, token: string) => {
    setToken(token);
    setStoredUser(user);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
