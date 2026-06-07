import React, { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, ChevronUp, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

type SCTab = 'issue' | 'history';

interface StoreCredit {
  id: string;
  customer_id: string;
  amount: number;
  remaining_balance: number;
  reason: string;
  custom_reason?: string;
  is_active: boolean;
  created_at: string;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  store_credit_transactions?: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    created_at: string;
  }>;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

interface StoreCreditsTabProps {
  onIssueStoreCredit?: (credit: any) => void;
}

const REASON_OPTIONS = ['Return', 'Exchange', 'Goodwill', 'Other'];

export const StoreCreditsTab: React.FC<StoreCreditsTabProps> = ({ onIssueStoreCredit }) => {
  const [activeTab, setActiveTab] = useState<SCTab>('issue');

  // ===== ISSUE TAB STATE =====
  const [amount, setAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [reason, setReason] = useState('Return');
  const [customReason, setCustomReason] = useState('');
  const [referenceTransaction, setReferenceTransaction] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<any | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ===== HISTORY TAB STATE =====
  const [storeCredits, setStoreCredits] = useState<StoreCredit[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);

  // ===== EFFECTS =====
  useEffect(() => {
    if (activeTab === 'history') {
      fetchStoreCredits();
      // Auto-refresh every 3 seconds when history tab is active
      const interval = setInterval(fetchStoreCredits, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // ===== FETCH FUNCTIONS =====
  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching customers:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCustomerSearch = (value: string) => {
    setSearchTerm(value);
    setIsDropdownOpen(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchCustomers(value);
    }, 300);
  };

  const fetchStoreCredits = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch('/api/store-credits');
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await response.json();
      console.log('Store credits history fetched:', result.data);
      setStoreCredits(result.data || []);
    } catch (err) {
      console.error('Error fetching store credits:', err);
      setStoreCredits([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // ===== ISSUE STORE CREDIT =====
  const handleIssueStoreCredit = async () => {
    setIssueError(null);

    if (!selectedCustomer) {
      setIssueError('Please select a customer');
      return;
    }

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      setIssueError('Please enter a valid amount');
      return;
    }

    if (!reason) {
      setIssueError('Please select a reason');
      return;
    }

    if (reason === 'Other' && !customReason.trim()) {
      setIssueError('Please enter a custom reason');
      return;
    }

    setIsIssuing(true);

    try {
      // Generate unique card number: SC-XXXXXXXXXXXX (12 random digits)
      const cardNumber = 'SC-' + Math.random().toString().slice(2, 14).padEnd(12, '0');

      // Insert store credit
      const { data: creditData, error: creditError } = await supabase
        .from('store_credits')
        .insert([
          {
            customer_id: selectedCustomer.id,
            amount: creditAmount,
            remaining_balance: creditAmount,
            reason: reason === 'Other' ? customReason : reason,
            is_active: true,
            card_number: cardNumber, // Add barcode number
          },
        ])
        .select();

      if (creditError) throw creditError;

      const creditId = creditData?.[0]?.id;

      // Insert transaction record
      if (creditId) {
        const { error: txError } = await supabase
          .from('store_credit_transactions')
          .insert([
            {
              store_credit_id: creditId,
              amount: creditAmount,
              transaction_type: 'issued',
            },
          ]);

        if (txError) throw txError;
      }

      // Success
      setIssueSuccess({
        creditId: creditData?.[0]?.id,
        amount: creditAmount,
        customer: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
        cardNumber: cardNumber,
      });

      // Reset form
      setSelectedCustomer(null);
      setSearchTerm('');
      setAmount('');
      setReason('Return');
      setCustomReason('');
      setReferenceTransaction('');

      if (onIssueStoreCredit) {
        onIssueStoreCredit(creditData?.[0]);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setIssueSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error issuing store credit:', err);
      setIssueError(err.message || 'Failed to issue store credit');
    } finally {
      setIsIssuing(false);
    }
  };

  // ===== FILTERED RESULTS =====
  const filteredCredits = storeCredits.filter(credit => {
    if (!historySearchQuery) return true;
    const query = historySearchQuery.toLowerCase();
    const customerName =
      `${credit.customers?.first_name || ''} ${credit.customers?.last_name || ''}`.toLowerCase();
    return customerName.includes(query) || credit.id.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-200 pb-4">
        <button
          onClick={() => setActiveTab('issue')}
          className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all ${
            activeTab === 'issue'
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Plus size={14} className="inline mr-1" /> Issue Credit
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all ${
            activeTab === 'history'
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <RefreshCw size={14} className="inline mr-1" /> History
        </button>
      </div>

      {/* ISSUE TAB */}
      {activeTab === 'issue' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Customer Search */}
          <div className="relative">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 block">
              Customer (Required)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {selectedCustomer && (
              <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2">
                <span className="text-sm font-bold text-green-900">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </span>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-green-700 hover:text-green-900"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {isDropdownOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg z-10">
                {searchResults.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setSearchTerm('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 text-sm"
                  >
                    <div className="font-bold">
                      {cust.first_name} {cust.last_name}
                    </div>
                    <div className="text-xs text-zinc-500">{cust.phone || cust.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 block">
              Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 block">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason (if Other selected) */}
          {reason === 'Other' && (
            <div>
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 block">
                Custom Reason
              </label>
              <input
                type="text"
                placeholder="Describe the reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>
          )}

          {/* Reference Transaction (optional) */}
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2 block">
              Reference Transaction (Optional)
            </label>
            <input
              type="text"
              placeholder="Transaction ID"
              value={referenceTransaction}
              onChange={(e) => setReferenceTransaction(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
            />
          </div>

          {/* Error Message */}
          {issueError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start">
              <AlertCircle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-red-700">{issueError}</p>
            </div>
          )}

          {/* Success Message */}
          {issueSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
              <p className="text-[11px] font-bold text-green-700">✓ Store Credit Issued!</p>
              <p className="text-[10px] text-green-600">Customer: {issueSuccess.customer}</p>
              <p className="text-[10px] text-green-600">Amount: ${issueSuccess.amount.toFixed(2)}</p>
              {issueSuccess.cardNumber && (
                <p className="text-[10px] font-mono font-bold text-green-700">Card: {issueSuccess.cardNumber}</p>
              )}
            </div>
          )}

          {/* Issue Button */}
          <button
            onClick={handleIssueStoreCredit}
            disabled={isIssuing || !selectedCustomer}
            className="w-full py-3 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-[#b90014] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isIssuing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {isIssuing ? 'Issuing...' : 'Issue Store Credit'}
          </button>
        </motion.div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by customer or ID..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchStoreCredits}
            disabled={isHistoryLoading}
            className="w-full py-2 text-[11px] font-bold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} />
            {isHistoryLoading ? 'Loading...' : 'Refresh'}
          </button>

          {/* Credits List */}
          <div className="space-y-2">
            {filteredCredits.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p className="text-sm">No store credits found</p>
              </div>
            ) : (
              filteredCredits.map((credit) => (
                <div key={credit.id} className="border border-zinc-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() =>
                      setExpandedCreditId(
                        expandedCreditId === credit.id ? null : credit.id
                      )
                    }
                    className="w-full px-4 py-3 bg-white hover:bg-zinc-50 flex items-center justify-between text-left transition-all"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-bold text-zinc-900">
                        {credit.customers?.first_name} {credit.customers?.last_name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        ${credit.amount.toFixed(2)} • {credit.reason}
                      </div>
                    </div>
                    <div className="text-right mr-3">
                      <div className="text-sm font-bold text-zinc-900">
                        ${credit.remaining_balance.toFixed(2)}
                      </div>
                      <div className={`text-xs font-bold ${credit.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                        {credit.is_active ? 'ACTIVE' : 'DEPLETED'}
                      </div>
                    </div>
                    {expandedCreditId === credit.id ? (
                      <ChevronUp size={16} className="text-zinc-400" />
                    ) : (
                      <ChevronDown size={16} className="text-zinc-400" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  {expandedCreditId === credit.id && (
                    <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 space-y-3">
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Credit ID:</span>
                          <span className="font-mono">{credit.id.slice(0, 8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Created:</span>
                          <span>{new Date(credit.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Original:</span>
                          <span>${credit.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Used:</span>
                          <span>${(credit.amount - credit.remaining_balance).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Transaction History */}
                      {credit.store_credit_transactions && credit.store_credit_transactions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-200">
                          <div className="text-xs font-bold text-zinc-700 mb-2">TRANSACTIONS</div>
                          <div className="space-y-1 text-[10px]">
                            {credit.store_credit_transactions.map((tx) => (
                              <div key={tx.id} className="flex justify-between">
                                <span className="capitalize text-zinc-600">
                                  {tx.transaction_type === 'redeemed' ? '↓ Redeemed' : '↑ Issued'}
                                </span>
                                <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                                  ${Math.abs(tx.amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
