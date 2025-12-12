import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'lss_session_token';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface User {
  id: number;
  lssName: string;
  displayName: string | null;
  allianceMemberId: number | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isPending: boolean; // User registered but not approved
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isPending: false,
    isLoading: true,
    error: null,
  });

  // Check session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);

      if (!storedToken) {
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isPending: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const user = data.data as User;

          setState({
            user,
            token: storedToken,
            isAuthenticated: user.isActive,
            isPending: !user.isActive,
            isLoading: false,
            error: null,
          });
        } else {
          // Invalid session
          localStorage.removeItem(TOKEN_KEY);
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isPending: false,
            isLoading: false,
            error: null,
          });
        }
      } catch {
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isPending: false,
          isLoading: false,
          error: 'Verbindungsfehler',
        });
      }
    };

    checkAuth();
  }, []);

  // Login
  const login = useCallback(async (lssName: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lssName, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { user, token } = data.data;
        localStorage.setItem(TOKEN_KEY, token);

        setState({
          user,
          token,
          isAuthenticated: user.isActive,
          isPending: !user.isActive,
          isLoading: false,
          error: null,
        });

        return { success: true };
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Login fehlgeschlagen',
        }));
        return { success: false, error: data.message };
      }
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Verbindungsfehler',
      }));
      return { success: false, error: 'Verbindungsfehler' };
    }
  }, []);

  // Register
  const register = useCallback(async (lssName: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lssName, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { user, token } = data.data;
        localStorage.setItem(TOKEN_KEY, token);

        setState({
          user,
          token,
          isAuthenticated: false,
          isPending: true,
          isLoading: false,
          error: null,
        });

        return { success: true };
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Registrierung fehlgeschlagen',
        }));
        return { success: false, error: data.message };
      }
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Verbindungsfehler',
      }));
      return { success: false, error: 'Verbindungsfehler' };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore errors
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isPending: false,
      isLoading: false,
      error: null,
    });
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.data as User;

        setState(prev => ({
          ...prev,
          user,
          isAuthenticated: user.isActive,
          isPending: !user.isActive,
        }));
      }
    } catch {
      // Ignore
    }
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    refreshUser,
  };
}

// Helper function to get token for API calls
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Helper function to get auth headers
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
