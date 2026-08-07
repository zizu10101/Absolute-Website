import React, { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../supabase';
import { useCustomers } from '../context/CustomerContext';
import { InvoiceCustomerInfo } from '../utils/invoice';

interface InvoiceCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (customerInfo: InvoiceCustomerInfo, saveToDb: boolean) => void;
  prefilledCustomerId?: string;
  prefilledCustomer?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  docType: 'invoice' | 'estimate';
}

export const InvoiceCustomerModal: React.FC<InvoiceCustomerModalProps> = ({
  isOpen,
  onClose,
  onPrint,
  prefilledCustomerId,
  prefilledCustomer,
  docType,
}) => {
  const { customers } = useCustomers();
  const [mode, setMode] = useState<'form' | 'search'>('form');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<InvoiceCustomerInfo>({
    firstName: prefilledCustomer?.first_name || '',
    lastName: prefilledCustomer?.last_name || '',
    email: prefilledCustomer?.email || '',
    phone: prefilledCustomer?.phone || '',
    company: '',
    address: '',
  });
  const [saveToDb, setSaveToDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filtered customers for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchQuery, customers]);

  const handleSelectCustomer = (customer: any) => {
    setFormData({
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email || '',
      phone: customer.phone || '',
      company: '',
      address: '',
    });
    setMode('form');
    setSearchQuery('');
  };

  const handlePrint = async () => {
    if (saveToDb && formData.firstName && formData.lastName && !prefilledCustomerId) {
      // Save customer to DB if requested
      setIsLoading(true);
      try {
        const { error } = await supabase.from('customers').insert([
          {
            first_name: formData.firstName || '',
            last_name: formData.lastName || '',
            email: formData.email || null,
            phone: formData.phone || null,
          }
        ]);
        if (error) throw error;
      } catch (e: any) {
        console.error('Error saving customer:', e.message);
        // Continue anyway - don't block printing
      } finally {
        setIsLoading(false);
      }
    }
    onPrint(formData, saveToDb);
  };

  if (!isOpen) return null;

  const title = docType === 'invoice' ? 'Invoice Details' : 'Estimate Details';
  const buttonLabel = docType === 'invoice' ? 'Print Invoice' : 'Print Estimate';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('form')}
              className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors ${
                mode === 'form'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setMode('search')}
              className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors ${
                mode === 'search'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Search Customer
            </button>
          </div>

          {/* Search Mode */}
          {mode === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Name, email, or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-200 rounded-lg bg-zinc-50">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-white transition-colors border-b border-zinc-100 last:border-b-0"
                    >
                      <p className="text-[11px] font-bold text-zinc-900">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <p className="text-[11px] text-zinc-500 text-center py-4">No customers found</p>
              )}
            </div>
          )}

          {/* Form Mode */}
          {mode === 'form' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName || ''}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName || ''}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="905-123-4567"
                  className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  value={formData.company || ''}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="ABC Corp"
                  className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wide mb-1">
                  Address (Optional)
                </label>
                <textarea
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St, City, Province"
                  rows={2}
                  className="w-full px-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white text-zinc-900 resize-none"
                />
              </div>

              {/* Save to DB checkbox */}
              {!prefilledCustomerId && (
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={saveToDb}
                    onChange={e => setSaveToDb(e.target.checked)}
                    className="mt-0.5 accent-zinc-800"
                  />
                  <span className="text-[11px] text-zinc-600">
                    Save customer info for future use
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 flex gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 text-zinc-900 text-[11px] font-black uppercase tracking-wide hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 text-white text-[11px] font-black uppercase tracking-wide hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
