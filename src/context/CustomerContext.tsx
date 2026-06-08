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
      const { data: newData, error } = await supabase
        .from('customers')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      if (newData) setCustomers(prev => [...prev, newData].sort((a, b) => a.last_name.localeCompare(b.last_name)));
      return newData || null;
    } catch (e: any) {
      console.error('Failed to add customer:', e.message);
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
