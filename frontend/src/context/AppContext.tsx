'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: number;
  username: string;
  aws_account_id: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  theme: 'light' | 'dark';
  loading: boolean;
  toasts: Toast[];
  toggleTheme: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  fetchApi: (path: string, options?: RequestInit) => Promise<Response>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  // Helper to fetch from the FastAPI backend with credentials/session cookies
  const fetchApi = async (path: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${path}`;
    
    // Merge headers
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Important to pass session cookies!
    };

    return fetch(url, config);
  };

  // Toast notifications helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Toggle light/dark theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Check auth status on load
  useEffect(() => {
    const initApp = async () => {
      // Initialize theme
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }

      // Check auth status
      if (pathname !== '/login') {
        try {
          const res = await fetchApi('/api/auth/me');
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            setUser(null);
            router.push('/login');
          }
        } catch (err) {
          console.error('Failed to authenticate:', err);
          setUser(null);
          router.push('/login');
        }
      }
      setLoading(false);
    };

    initApp();
  }, [pathname]);

  // Login handler
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        addToast('Successfully authenticated as AWS Administrator.', 'success');
        router.push('/hosted-zones');
        return true;
      } else {
        const errorData = await res.json();
        addToast(errorData.detail || 'Incorrect username or password', 'error');
        return false;
      }
    } catch (err) {
      addToast('Cannot connect to AWS Authorization service.', 'error');
      return false;
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
      setUser(null);
      addToast('Logged out of AWS Management Console.', 'info');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        theme,
        loading,
        toasts,
        toggleTheme,
        login,
        logout,
        addToast,
        removeToast,
        fetchApi,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
