import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../supabase';

interface GiftCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssue: (giftCard: any) => void;
}

const PRESET_AMOUNTS = [25, 50, 100, 150];

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export const GiftCardModal: React.FC<GiftCardModalProps> = ({ isOpen, onClose, onIssue }) => {
  // Amount state
  const [amount, setAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create customer mode
  const [showCreateMode, setShowCreateMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Card state
  const [cardNumber, setCardNumber] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  // Debounced search function
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      console.error('❌ Search error:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsDropdownOpen(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    setIsDropdownOpen(false);
  };

  // Remove selected customer
  const handleRemoveCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      setError('Customer name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const nameParts = newCustomerName.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || '';

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          first_name,
          last_name,
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
        }])
        .select()
        .single();

      if (error) throw error;
      setSelectedCustomer(data);
      setShowCreateMode(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
    } catch (e: any) {
      console.error('❌ Create customer error:', e);
      setError(e.message || 'Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateCardNumber = () => {
    const randomNum = Math.random().toString(16).slice(2).toUpperCase().padEnd(16, '0').slice(0, 16);
    setCardNumber(randomNum);
  };

  const handleIssue = async () => {
    setError(null);

    if (finalAmount <= 0) {
      setError('Please select or enter a valid amount');
      console.error('❌ Amount validation failed:', finalAmount);
      return;
    }

    setIsIssuing(true);

    try {
      // Generate card number if auto-generating
      const generatedCardNumber = autoGenerate
        ? Math.random().toString().slice(2, 18).padEnd(16, '0')
        : cardNumber;

      if (!generatedCardNumber) {
        setError('Please enter a card number or enable auto-generate');
        return;
      }

      // Insert gift card directly to Supabase
      const { data: giftCard, error: gcError } = await supabase
        .from('gift_cards')
        .insert({
          card_number: generatedCardNumber,
          initial_balance: finalAmount,
          current_balance: finalAmount,
          customer_id: selectedCustomer?.id || null,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (gcError) throw new Error(gcError.message || 'Failed to create gift card');

      // Insert transaction record
      const { error: txError } = await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: giftCard.id,
          amount: finalAmount,
          transaction_type: 'issue',
          created_at: new Date().toISOString(),
        });

      if (txError) {
        // Don't fail the whole operation if transaction logging fails
      }

      onIssue({
        id: `gc-${giftCard.id}`,
        name: `Gift Card - $${finalAmount.toFixed(2)}`,
        price: finalAmount,
        quantity: 1,
        category: 'Gift Card',
        type: 'gift_card',
        taxable: false, // Gift cards are not taxable
        originalPrice: finalAmount,
        giftCardData: giftCard,
      });

      // Reset form
      setAmount(0);
      setCustomAmount('');
      setSelectedCustomer(null);
      setSearchTerm('');
      setCardNumber('');
      setAutoGenerate(true);
      onClose();
    } catch (e: any) {
      console.error('❌ Issue gift card error:', e);
      setError(e.message);
    } finally {
      setIsIssuing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-70 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full"
      >
        {/* Header */}
        <div className="bg-zinc-950 text-white p-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest">Issue Gift Card</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold">
              {error}
            </div>
          )}

          {/* Amount Selection */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
              Select Amount
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount('');
                  }}
                  className={`py-2 rounded-lg font-bold text-xs transition-colors ${
                    amount === preset && !customAmount
                      ? 'bg-[#b90014] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
              Custom Amount
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-zinc-900">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customAmount}
                onChange={e => {
                  setCustomAmount(e.target.value);
                  setAmount(0);
                }}
                placeholder="0.00"
                className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
              Customer
            </label>

            {selectedCustomer ? (
              // Selected customer tag
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <div>
                  <p className="text-xs font-bold text-emerald-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  {(selectedCustomer.email || selectedCustomer.phone) && (
                    <p className="text-[9px] text-emerald-700">
                      {selectedCustomer.email} {selectedCustomer.email && selectedCustomer.phone ? '·' : ''} {selectedCustomer.phone}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRemoveCustomer}
                  className="text-emerald-700 hover:text-emerald-900 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ) : showCreateMode ? (
              // Create new customer form
              <div className="space-y-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <input
                  type="text"
                  placeholder="Customer name *"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-400"
                  autoFocus
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-400"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newCustomerEmail}
                  onChange={e => setNewCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCreateMode(false);
                      setNewCustomerName('');
                      setNewCustomerPhone('');
                      setNewCustomerEmail('');
                    }}
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCustomer}
                    disabled={isCreating}
                    className="flex-1 px-3 py-2 bg-[#b90014] text-white rounded-lg text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              // Search existing customer
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="Search customer by name..."
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]"
                  />

                  {/* Dropdown - Show when open and when there's content to display */}
                  {isDropdownOpen && (
                    <ul className="absolute top-full left-0 right-0 bg-white border border-zinc-200 mt-1 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                      {isSearching && (
                        <li className="p-3 text-xs text-zinc-500 text-center">
                          <div className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
                          Searching...
                        </li>
                      )}
                      {!isSearching && searchResults.length === 0 && searchTerm && (
                        <li className="p-3 text-xs text-zinc-500">No customers found</li>
                      )}
                      {!isSearching && searchResults.length === 0 && !searchTerm && (
                        <li className="p-3 text-xs text-zinc-400">Start typing to search...</li>
                      )}
                      {!isSearching && searchResults.length > 0 && (
                        <>
                          {searchResults.map(customer => (
                            <li
                              key={customer.id}
                              onMouseDown={e => {
                                e.preventDefault();
                                handleSelectCustomer(customer);
                              }}
                              className="p-3 cursor-pointer hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                            >
                              <p className="text-xs font-bold text-zinc-900">{customer.first_name} {customer.last_name}</p>
                              {(customer.email || customer.phone) && (
                                <p className="text-[9px] text-zinc-500">
                                  {customer.email} {customer.email && customer.phone ? '·' : ''} {customer.phone}
                                </p>
                              )}
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  )}
                </div>

                <button
                  onClick={() => setShowCreateMode(true)}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold text-[#b90014] hover:text-red-700 uppercase hover:underline"
                >
                  + Create new customer instead
                </button>

                <p className="text-[9px] text-zinc-400 italic">Customer field is optional</p>
              </div>
            )}
          </div>

          {/* Card Number */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={e => {
                  setAutoGenerate(e.target.checked);
                  if (e.target.checked) setCardNumber('');
                }}
                className="rounded w-4 h-4"
              />
              Auto-Generate Card Number
            </label>
            {!autoGenerate && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value.toUpperCase().slice(0, 16))}
                  placeholder="16-digit card number..."
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-mono font-bold uppercase text-gray-900 placeholder-gray-400"
                  maxLength={16}
                />
              </div>
            )}
            {autoGenerate && (
              <button
                onClick={handleGenerateCardNumber}
                type="button"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-zinc-200 rounded-lg text-[10px] font-bold uppercase text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <RefreshCw size={12} /> Generate Preview
              </button>
            )}
            {cardNumber && (
              <p className="text-xs font-mono font-black text-zinc-900 mt-2">
                Card: {cardNumber}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-zinc-50 p-3 rounded-lg space-y-1">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Preview</p>
            <p className="text-sm font-bold text-zinc-900">Amount: ${finalAmount.toFixed(2)}</p>
            <p className="text-xs text-zinc-600">
              Customer: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'No customer linked'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleIssue}
              disabled={isIssuing || finalAmount <= 0}
              className="flex-1 px-4 py-2 rounded-lg bg-[#b90014] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isIssuing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Issuing...
                </>
              ) : (
                'Issue Gift Card'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
