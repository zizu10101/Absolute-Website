import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  boot_size: string | null;
  club_affinity: string | null;
  created_at: string;
}

interface CustomerContextType {
  customers: Customer[];
  isLoading: boolean;
  fetchCustomers: () => Promise<void>;
  addCustomer: (data: Partial<Customer>) => Promise<Customer | null>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<Customer | null>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('last_name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (e: any) {
      console.error('Failed to fetch customers:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomer = async (data: Partial<Customer>): Promise<Customer | null> => {
    try {
      // If email is provided, use UPSERT to handle duplicate emails gracefully
      // This will update existing customer if email already exists
      if (data.email) {
        const { data: result, error } = await supabase
          .from('customers')
          .upsert([data], { onConflict: 'email' })
          .select()
          .single();

        if (error) throw error;

        if (result) {
          // Refresh customers list to reflect any changes
          await fetchCustomers();
        }
        return result || null;
      } else {
        // If no email, use regular INSERT (allows duplicate names)
        const { data: newData, error } = await supabase
          .from('customers')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        if (newData) setCustomers(prev => [...prev, newData].sort((a, b) => a.last_name.localeCompare(b.last_name)));
        return newData || null;
      }
    } catch (e: any) {
      // Check for duplicate email error
      if (e.code === '23505' || e.message?.includes('duplicate') || e.message?.includes('unique')) {
        console.error('Customer add error: A customer with this email already exists');
        console.error('Error details:', e);
      } else {
        console.error('Customer add error:', e);
        console.error('Customer add error details:', e.message || e);
      }
      return null;
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>): Promise<Customer | null> => {
    try {
      const { data: updated, error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (updated) setCustomers(prev => prev.map(c => c.id === id ? updated : c));
      return updated || null;
    } catch (e: any) {
      console.error('Failed to update customer:', e.message);
      return null;
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  return (
    <CustomerContext.Provider value={{ customers, isLoading, fetchCustomers, addCustomer, updateCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomers = () => {
  const context = useContext(CustomerContext);
  if (!context) throw new Error('useCustomers must be used within a CustomerProvider');
  return context;
};
