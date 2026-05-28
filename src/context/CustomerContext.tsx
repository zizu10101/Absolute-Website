import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  boot_size: string;
  club_affinity: string;
  created_at: string;
}

interface CustomerContextType {
  customers: Customer[];
  isLoading: boolean;
  fetchCustomers: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCustomers = async () => {
    console.log("CRM: fetchCustomers loop triggered...");
    setIsLoading(true);
    try {
      const response = await fetch('/api/customers');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch customers');
      
      console.log(`CRM: Successfully loaded ${result.data.length} customers from database.`, result.data);
      setCustomers(result.data);
    } catch (e: any) {
      console.error("CRM: Critical failure loading customers from API:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <CustomerContext.Provider value={{ customers, isLoading, fetchCustomers }}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomers = () => {
  const context = useContext(CustomerContext);
  if (!context) throw new Error('useCustomers must be used within a CustomerProvider');
  return context;
};
