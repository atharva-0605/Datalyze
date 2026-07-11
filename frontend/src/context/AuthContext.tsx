import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface User {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  workspace_id: number | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, password: string, workspaceName?: string, role?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync token value with Axios defaults and localStorage
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      fetchUserProfile();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const response = await axios.get<User>('/api/v1/auth/me');
      setUser(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load user credentials:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.response?.data?.detail || 'Failed to authenticate user.');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      // Standard OAuth2 uses urlencoded forms for login exchange
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await axios.post<{ access_token: string }>('/api/v1/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      setToken(response.data.access_token);
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || 'Login failed. Please verify credentials.';
      setError(detailMsg);
      setLoading(false);
      throw err;
    }
  };

  const register = async (email: string, password: string, workspaceName?: string, role?: string) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post('/api/v1/auth/register', {
        email,
        password,
        workspace_name: workspaceName || null,
        role: role || 'analyst',
      });
      // Automatically log user in upon registration
      await login(email, password);
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || 'Registration failed. Try again.';
      setError(detailMsg);
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
