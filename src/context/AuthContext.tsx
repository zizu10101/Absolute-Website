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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ADMIN_EMAILS = ['info@edgedbs.com', 'ziad@golazo.ca', 'nabil@golazo.ca'];

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      checkAdminStatus(currentUser);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      checkAdminStatus(currentUser);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
          redirectTo: window.location.origin, // Redirect back to base URL
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
          emailRedirectTo: window.location.origin, // Redirect back to base URL
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('AuthContext: Logout failed', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
