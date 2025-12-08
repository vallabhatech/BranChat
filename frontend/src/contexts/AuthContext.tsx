import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiService } from '../lib/api';
import { userStorage } from '../lib/conversationStorage';

interface User {
  id: string;
  email?: string;
  name?: string;
  isGuest: boolean;
  memoryOptIn: boolean;
  createdAt: string;
  lastActiveAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  createGuestSession: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const guestToken = localStorage.getItem('guestToken');
      
      if (token || guestToken) {
        const result = await apiService.getCurrentUser();
        if (result.success) {
          // Handle different response structures from backend vs mock
          const userData = result.data.user || result.data.data || result.data;
          setUser(userData);
        } else {
          // Only clear tokens if it's an authentication error (401/403)
          // Don't clear on network errors or server issues
          console.warn('Auth check failed, but keeping tokens for retry:', result);
        }
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      
      // Only clear tokens if it's specifically an authentication error
      // Don't clear on network errors, API_FALLBACK, or server issues
      if (error.message && (
        error.message.includes('401') || 
        error.message.includes('403') || 
        error.message.includes('Unauthorized')
      )) {
        console.log('Clearing tokens due to authentication error');
        localStorage.removeItem('token');
        localStorage.removeItem('guestToken');
      } else {
        console.log('Keeping tokens - error might be temporary:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const result = await apiService.register(email, password, name);
      if (result.success) {
        // Clear guest token when signing up
        localStorage.removeItem('guestToken');
        localStorage.setItem('token', (result.data as any).data?.token || (result.data as any).token);
        setUser((result.data as any).data?.user || (result.data as any).user);
        return { error: null };
      }
      return { error: { message: 'Registration failed' } };
    } catch (error: any) {
      return { error: { message: error.message || 'Registration failed' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiService.login(email, password);
      if (result.success) {
        // Clear guest token when signing in
        localStorage.removeItem('guestToken');
        localStorage.setItem('token', (result.data as any).data?.token || (result.data as any).token);
        setUser((result.data as any).data?.user || (result.data as any).user);
        return { error: null };
      }
      return { error: { message: 'Login failed' } };
    } catch (error: any) {
      return { error: { message: error.message || 'Login failed' } };
    }
  };

  const createGuestSession = async () => {
    try {
      const result = await apiService.createGuestToken();
      if (result.success) {
        localStorage.setItem('guestToken', (result.data as any).data?.token || (result.data as any).token);
        setUser((result.data as any).data?.user || (result.data as any).user);
        return { error: null };
      }
      return { error: { message: 'Failed to create guest session' } };
    } catch (error: any) {
      return { error: { message: error.message || 'Failed to create guest session' } };
    }
  };

  const signOut = async () => {
    try {
      // Call backend logout endpoint if we have a token
      const token = localStorage.getItem('token');
      const guestToken = localStorage.getItem('guestToken');
      
      if (token || guestToken) {
        await apiService.logout();
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local cleanup even if backend call fails
    } finally {
      // Clear all user-specific data from localStorage
      userStorage.clearUserData();
      
      // Clear auth tokens
      localStorage.removeItem('token');
      localStorage.removeItem('guestToken');
      
      // Clear user state
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUp, 
      signIn, 
      signOut, 
      createGuestSession 
    }}>
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
