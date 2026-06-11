import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

interface CustomerAuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  register: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveCustomerProfile = async (user: User) => {
    try {
      // Extract name from full_name or email
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from('customers')
        .upsert(
          {
            email: user.email,
            first_name: firstName,
            last_name: lastName,
            avatar_url: user.user_metadata?.avatar_url,
          },
          { onConflict: 'email' }
        );

      if (error) {
        console.error('Error saving customer profile:', error);
      }
    } catch (err) {
      console.error('Error upserting customer profile:', err);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Save profile for OAuth users (Google, etc.)
          if (session.user.user_metadata?.full_name) {
            await saveCustomerProfile(session.user);
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Save profile when user signs in via OAuth
      if (currentUser?.user_metadata?.full_name) {
        await saveCustomerProfile(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const register = async (email: string, password: string, firstName: string, lastName: string, phone?: string) => {
    try {
      setError(null);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone || '',
          },
        },
      });

      if (signUpError) throw signUpError;
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      setError(errorMessage);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
    } catch (err: any) {
      const errorMessage = err.message || 'Password reset failed';
      setError(errorMessage);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <CustomerAuthContext.Provider value={{ user, isLoading, error, register, login, logout, resetPassword, clearError }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
}
