import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: number;
  name: string;
  email: string;
  role: number;
  created_at: string;
  last_login: string | null;
}

interface Session {
  token: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; password?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://54.147.246.169:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('session_token');
      const storedUser = await SecureStore.getItemAsync('user_data');
      
      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setSession({ token: storedToken, expires_at: '' });
        
        // Optionally verify token with /auth/me endpoint
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
          
          if (response.ok) {
            const freshUser = await response.json();
            const updatedUser: User = {
              id: freshUser.id,
              name: freshUser.name,
              email: freshUser.email,
              role: freshUser.role,
              created_at: freshUser.created_at,
              last_login: freshUser.last_login ?? null,
            };
            setUser(updatedUser);
            await SecureStore.setItemAsync('user_data', JSON.stringify(updatedUser));
          } else {
            // Token is invalid, clear storage
            await clearStorage();
          }
        } catch {
          // Network error, keep the stored session
        }
      }
    } catch (error) {
      console.error('Error loading stored session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearStorage = async () => {
    await SecureStore.deleteItemAsync('session_token');
    await SecureStore.deleteItemAsync('user_data');
    setUser(null);
    setSession(null);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const credentials = btoa(`${email}:${password}`);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      
      const userData: User = {
        id: data.id,
        name: data.name || email.split('@')[0],
        email: data.email,
        role: data.role ?? 0,
        created_at: data.created_at,
        last_login: data.last_login ?? null,
      };

      await SecureStore.setItemAsync('session_token', data.session.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(userData));

      setUser(userData);
      setSession(data.session);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      // Auto-login after registration
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await clearStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: { name?: string; email?: string; password?: string }) => {
    const token = await SecureStore.getItemAsync('session_token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Update failed');
    }
    const updated = await response.json();
    const updatedUser: User = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      created_at: updated.created_at,
      last_login: updated.last_login ?? null,
    };
    setUser(updatedUser);
    await SecureStore.setItemAsync('user_data', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user && !!session,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
