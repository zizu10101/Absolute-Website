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
      const res = await fetch('/api/customers');
      const text = await res.text();
      let result: any;
      try { result = JSON.parse(text); } catch { throw new Error('Server error: unexpected response'); }
      if (!res.ok) throw new Error(result?.error || 'Failed to fetch');
      const sorted = (result?.data || []).sort((a: Customer, b: Customer) =>
        (a.last_name || '').localeCompare(b.last_name || '')
      );
      setCustomers(sorted);
    } catch (e: any) {
      console.error('Failed to fetch customers:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomer = async (data: Partial<Customer>): Promise<Customer | null> => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const newCustomer = result.data?.[0] || null;
      if (newCustomer) setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.last_name.localeCompare(b.last_name)));
      return newCustomer;
    } catch (e: any) {
      console.error('Failed to add customer:', e.message);
      return null;
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>): Promise<Customer | null> => {
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const updated = result.data || null;
      if (updated) setCustomers(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
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
