import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  devLogin?: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ADMIN_EMAILS = ['info@edgedbs.com', 'ziad@golazo.ca', 'nabil@golazo.ca'];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    const checkSession = async () => {
      try {
        const savedDevUser = localStorage.getItem('dev_admin_user');
        if (savedDevUser) {
          const parsed = JSON.parse(savedDevUser);
          setUser(parsed);
          setIsAdmin(true);
          setIsLoading(false);
          clearTimeout(timer);
          return;
        }
      } catch (e) {
        console.warn('Failed parsing saved dev user:', e);
      }

      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          checkAdminStatus(currentUser);
        })
        .catch((err) => {
          console.error("AuthContext getSession error:", err);
        })
        .finally(() => {
          setIsLoading(false);
          clearTimeout(timer);
        });
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const savedDevUser = localStorage.getItem('dev_admin_user');
      if (savedDevUser) {
        try {
          const parsed = JSON.parse(savedDevUser);
          setUser(parsed);
          setIsAdmin(true);
          setIsLoading(false);
          return;
        } catch (e) {}
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      checkAdminStatus(currentUser);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const checkAdminStatus = (currentUser: User | null) => {
    const userEmail = currentUser?.email?.toLowerCase().trim();
    if (!userEmail) {
      setIsAdmin(false);
      return;
    }

    const isMatch = ADMIN_EMAILS.some(matchEmail => {
      const matchLower = matchEmail.toLowerCase().trim();
      return matchLower === userEmail;
    });

    setIsAdmin(isMatch);
  };

  const login = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/admin', // Redirect back to admin url
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('AuthContext: Login failed', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/admin', // Redirect back to admin url
        },
      });
      if (error) throw error;
      alert('Check your email for a login link!');
    } catch (error) {
      console.error('AuthContext: Email login failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('dev_admin_user');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.warn('AuthContext: Logout issue (suppressed):', error);
    } finally {
      setUser(null);
      setIsAdmin(false);
    }
  };

  const devLogin = async (email: string) => {
    setIsLoading(true);
    const mockUser: any = {
      id: 'dev-admin-' + email.replace(/[^a-zA-Z0-9]/g, '-'),
      email: email,
      user_metadata: {
        full_name: email.split('@')[0],
      }
    };
    setUser(mockUser);
    setIsAdmin(true);
    localStorage.setItem('dev_admin_user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, loginWithEmail, logout, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
