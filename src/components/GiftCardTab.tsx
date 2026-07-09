import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import Barcode from 'react-barcode';

type GCTab = 'sell' | 'redeem' | 'history';

interface GiftCard {
  id: string;
  card_number: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  gift_card_transactions?: Array<{
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

interface GiftCardTabProps {
  onIssueGiftCard: (giftCard: any) => void;
  onRedeemGiftCard: (cardNumber: string, amount: number) => Promise<void>;
  cartTotal: number;
  cartHasItems: boolean;
}

const PRESET_AMOUNTS = [25, 50, 100, 150];

export const GiftCardTab: React.FC<GiftCardTabProps> = ({
  onIssueGiftCard,
  onRedeemGiftCard,
  cartTotal,
  cartHasItems,
}) => {
  const [activeTab, setActiveTab] = useState<GCTab>('sell');

  // ===== SELL TAB STATE =====
  const [amount, setAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateMode, setShowCreateMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ===== REDEEM TAB STATE =====
  const [redeemCardNumber, setRedeemCardNumber] = useState('');
  const [redeemAmount, setRedeemAmount] = useState(cartTotal);
  const [redeemCardData, setRedeemCardData] = useState<any | null>(null);
  const [isRedeemLoading, setIsRedeemLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedCardForRedeem, setSelectedCardForRedeem] = useState<any | null>(null);

  // ===== HISTORY TAB STATE =====
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'depleted'>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // ===== EFFECTS =====
  useEffect(() => {
    if (activeTab === 'history') {
      fetchGiftCards();
    }
  }, [activeTab]);

  useEffect(() => {
    setRedeemAmount(cartTotal);
  }, [cartTotal]);

  // ===== FETCH FUNCTIONS =====
  const fetchGiftCards = async () => {
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          customers (first_name, last_name, email),
          gift_card_transactions (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGiftCards(data || []);
    } catch (e: any) {
      console.error('Failed to fetch gift cards:', e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // ===== SELL TAB FUNCTIONS =====
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
      console.error('Search error:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsDropdownOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    setIsDropdownOpen(false);
  };

  const handleRemoveCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      setSellError('Customer name is required');
      return;
    }

    setIsIssuing(true);
    setSellError(null);

    try {
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
      console.error('Create customer error:', e);
      setSellError(e.message || 'Failed to create customer');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleGenerateCardNumber = () => {
    const randomNum = Math.random().toString(16).slice(2).toUpperCase().padEnd(16, '0').slice(0, 16);
    setCardNumber(randomNum);
  };

  const handleIssueGiftCard = async () => {
    setSellError(null);
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;

    if (finalAmount <= 0) {
      setSellError('Please select or enter a valid amount');
      return;
    }

    setIsIssuing(true);

    try {
      const generatedCardNumber = autoGenerate
        ? Math.random().toString().slice(2, 18).padEnd(16, '0')
        : cardNumber;

      if (!generatedCardNumber) {
        setSellError('Please enter a card number or enable auto-generate');
        return;
      }

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

      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: giftCard.id,
          amount: finalAmount,
          transaction_type: 'issue',
          created_at: new Date().toISOString(),
        });

      onIssueGiftCard({
        id: `gc-${giftCard.id}`,
        name: `Gift Card - $${finalAmount.toFixed(2)}`,
        price: finalAmount,
        quantity: 1,
        category: 'Gift Card',
        type: 'gift_card',
        taxable: false,
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
    } catch (e: any) {
      console.error('Issue gift card error:', e);
      setSellError(e.message);
    } finally {
      setIsIssuing(false);
    }
  };

  // ===== REDEEM TAB FUNCTIONS =====
  const handleLookup = async () => {
    if (!redeemCardNumber.trim()) {
      setRedeemError('Please enter a card number');
      return;
    }

    setIsRedeemLoading(true);
    setRedeemError(null);
    setRedeemCardData(null);

    try {
      const res = await fetch(`/api/gift-cards/lookup?card_number=${encodeURIComponent(redeemCardNumber)}`);
      const result = await res.json();

      if (!res.ok) {
        setRedeemError(result?.error || 'Card not found');
        return;
      }

      setRedeemCardData(result.data);
      setRedeemAmount(Math.min(cartTotal, result.data.current_balance));
    } catch (e: any) {
      setRedeemError(e.message);
    } finally {
      setIsRedeemLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCardData || !redeemAmount || redeemAmount <= 0) {
      setRedeemError('Invalid amount');
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);

    try {
      await onRedeemGiftCard(redeemCardNumber, redeemAmount);
      setRedeemCardNumber('');
      setRedeemCardData(null);
      setRedeemAmount(cartTotal);
    } catch (e: any) {
      setRedeemError(e.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const openRedeemFromHistory = (gc: GiftCard) => {
    setSelectedCardForRedeem(gc);
    setShowRedeemModal(true);
  };

  const handleRedeemFromHistory = async () => {
    if (!selectedCardForRedeem || !redeemAmount || redeemAmount <= 0) {
      setRedeemError('Invalid amount');
      return;
    }

    if (!cartHasItems) {
      setRedeemError('Please add items to cart first');
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);

    try {
      await onRedeemGiftCard(selectedCardForRedeem.card_number, redeemAmount);
      setShowRedeemModal(false);
      setSelectedCardForRedeem(null);
      setRedeemAmount(cartTotal);
      fetchGiftCards();
    } catch (e: any) {
      setRedeemError(e.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  // ===== FILTERED DATA =====
  const filteredCards = useMemo(() => {
    return giftCards.filter(gc => {
      const q = historySearchQuery.toLowerCase();
      const cardNum = gc.card_number.toLowerCase();
      const customerName = gc.customers
        ? `${gc.customers.first_name} ${gc.customers.last_name}`.toLowerCase()
        : '';

      const matchesSearch = !q || cardNum.includes(q) || customerName.includes(q);

      if (statusFilter === 'active') return matchesSearch && gc.is_active && gc.current_balance > 0;
      if (statusFilter === 'depleted') return matchesSearch && (!gc.is_active || gc.current_balance === 0);
      return matchesSearch;
    });
  }, [giftCards, historySearchQuery, statusFilter]);

  const totalCards = giftCards.length;
  const totalIssued = giftCards.reduce((sum, gc) => sum + gc.initial_balance, 0);
  const totalRemaining = giftCards.reduce((sum, gc) => sum + gc.current_balance, 0);

  const finalSellAmount = customAmount ? parseFloat(customAmount) : amount;

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Tab Headers */}
      <div className="bg-white border-b border-zinc-200 flex">
        {(['sell', 'redeem', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
                : 'border-transparent text-zinc-900 hover:text-zinc-900'
            }`}
          >
            {tab === 'sell' ? 'ðŸ’³ Sell' : tab === 'redeem' ? 'ðŸ’° Redeem' : 'ðŸ“Š History'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* SELL TAB */}
        {activeTab === 'sell' && (
          <div className="p-4 space-y-4">
            {sellError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold">
                {sellError}
              </div>
            )}

            {/* Amount Selection */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
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
                        ? 'bg-[var(--primary-color)] text-white'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
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
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold text-gray-900 placeholder-gray-600"
                />
              </div>
            </div>

            {/* Customer Selection */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
                Customer
              </label>

              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-emerald-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    {(selectedCustomer.email || selectedCustomer.phone) && (
                      <p className="text-[9px] text-emerald-700">
                        {selectedCustomer.email} {selectedCustomer.email && selectedCustomer.phone ? 'Â·' : ''} {selectedCustomer.phone}
                      </p>
                    )}
                  </div>
                  <button onClick={handleRemoveCustomer} className="text-emerald-700 hover:text-emerald-900 p-1">
                    <X size={16} />
                  </button>
                </div>
              ) : showCreateMode ? (
                <div className="space-y-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                  <input
                    type="text"
                    placeholder="Customer name *"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-600"
                    autoFocus
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-600"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newCustomerEmail}
                    onChange={e => setNewCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCreateMode(false);
                        setNewCustomerName('');
                        setNewCustomerPhone('');
                        setNewCustomerEmail('');
                      }}
                      className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-900 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCustomer}
                      disabled={isIssuing}
                      className="flex-1 px-3 py-2 bg-[var(--primary-color)] text-white rounded-lg text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      {isIssuing ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      placeholder="Search customer by name..."
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                    />

                    {isDropdownOpen && (
                      <ul className="absolute top-full left-0 right-0 bg-white border border-zinc-200 mt-1 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                        {isSearching && (
                          <li className="p-3 text-xs text-zinc-900 text-center">
                            <div className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
                            Searching...
                          </li>
                        )}
                        {!isSearching && searchResults.length === 0 && searchTerm && (
                          <li className="p-3 text-xs text-zinc-900">No customers found</li>
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
                                  <p className="text-[9px] text-zinc-900">
                                    {customer.email} {customer.email && customer.phone ? 'Â·' : ''} {customer.phone}
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
                    className="w-full text-left px-3 py-2 text-[10px] font-bold text-[var(--primary-color)] hover:text-red-700 uppercase hover:underline"
                  >
                    + Create new customer instead
                  </button>

                  <p className="text-[9px] text-zinc-900 italic">Customer field is optional</p>
                </div>
              )}
            </div>

            {/* Card Number */}
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2 cursor-pointer">
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
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-mono font-bold uppercase text-gray-900 placeholder-gray-600"
                    maxLength={16}
                  />
                </div>
              )}
              {autoGenerate && (
                <button
                  onClick={handleGenerateCardNumber}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-zinc-200 rounded-lg text-[10px] font-bold uppercase text-zinc-900 hover:bg-zinc-50 transition-colors"
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
              <p className="text-[10px] text-zinc-900 uppercase tracking-wide">Preview</p>
              <p className="text-sm font-bold text-zinc-900">Amount: ${finalSellAmount.toFixed(2)}</p>
              <p className="text-xs text-zinc-900">
                Customer: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'No customer linked'}
              </p>
            </div>

            {/* Issue Button */}
            <button
              onClick={handleIssueGiftCard}
              disabled={isIssuing || finalSellAmount <= 0}
              className="w-full px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isIssuing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Plus size={14} /> Issue Gift Card
                </>
              )}
            </button>
          </div>
        )}

        {/* REDEEM TAB */}
        {activeTab === 'redeem' && (
          <div className="p-4 space-y-4">
            {redeemError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold">
                <AlertCircle size={14} />
                {redeemError}
              </div>
            )}

            {!redeemCardData ? (
              <>
                {/* Card Number Input */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
                    Gift Card Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={redeemCardNumber}
                      onChange={e => setRedeemCardNumber(e.target.value.toUpperCase().slice(0, 16))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleLookup();
                      }}
                      placeholder="Scan or type card number..."
                      maxLength={16}
                      className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono font-bold uppercase text-black"
                      autoFocus
                    />
                    <button
                      onClick={handleLookup}
                      disabled={isRedeemLoading || !redeemCardNumber.trim()}
                      className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg text-[10px] font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isRedeemLoading ? '...' : 'Look Up'}
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-50 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-900">Cart Total: ${cartTotal.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <>
                {/* Card Details */}
                <div className="bg-zinc-50 p-4 rounded-lg space-y-2">
                  <div>
                    <p className="text-[10px] text-zinc-900 uppercase tracking-wide font-bold">Card Number</p>
                    <p className="text-sm font-mono font-black text-zinc-900">{redeemCardData.card_number}</p>
                  </div>
                  {redeemCardData.customers && (
                    <div>
                      <p className="text-[10px] text-zinc-900 uppercase tracking-wide font-bold">Holder</p>
                      <p className="text-xs font-bold text-zinc-900">
                        {redeemCardData.customers.first_name} {redeemCardData.customers.last_name}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-zinc-900 uppercase tracking-wide font-bold">Available Balance</p>
                    <p className="text-sm font-black text-[var(--primary-color)]">${redeemCardData.current_balance.toFixed(2)}</p>
                  </div>
                </div>

                {/* Amount Selection */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
                    Redemption Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-zinc-900">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={redeemCardData.current_balance}
                      value={redeemAmount}
                      onChange={e => setRedeemAmount(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold text-black"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-900 mt-1">
                    {redeemAmount > redeemCardData.current_balance ? (
                      <span className="text-red-600">Exceeds card balance</span>
                    ) : redeemAmount < cartTotal ? (
                      <span className="text-amber-600">Partial redemption: ${(cartTotal - redeemAmount).toFixed(2)} still due</span>
                    ) : (
                      <span className="text-emerald-600">Full payment from gift card</span>
                    )}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRedeemCardNumber('');
                      setRedeemCardData(null);
                      setRedeemAmount(cartTotal);
                      setRedeemError(null);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleRedeem}
                    disabled={isRedeeming || redeemAmount <= 0 || redeemAmount > redeemCardData.current_balance || !cartHasItems}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={!cartHasItems ? 'Add items to cart first' : ''}
                  >
                    {isRedeeming ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Redeeming...
                      </>
                    ) : (
                      'Apply to Cart'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-4">
            {/* Header & Filters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">All Gift Cards</h3>
                <button
                  onClick={fetchGiftCards}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 rounded text-[10px] font-bold text-zinc-900 transition-colors"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-zinc-900" />
                <input
                  type="text"
                  placeholder="Search by card or customer..."
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-800"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {(['all', 'active', 'depleted'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                      statusFilter === status
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Depleted'}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards List */}
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center">
                <AlertCircle size={32} className="text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-900 font-bold">No gift cards found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCards.map(gc => (
                  <div key={gc.id} className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                    {/* Card Row */}
                    <button
                      onClick={() => setExpandedCardId(expandedCardId === gc.id ? null : gc.id)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-mono font-black text-zinc-900">{gc.card_number}</p>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              gc.is_active && gc.current_balance > 0
                                ? 'bg-emerald-100 text-emerald-600'
                                : gc.current_balance === 0
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {gc.is_active && gc.current_balance > 0 ? 'Active' : gc.current_balance === 0 ? 'Depleted' : 'Inactive'}
                          </span>
                        </div>
                        {gc.customers && (
                          <p className="text-[10px] text-zinc-900 font-bold">
                            {gc.customers.first_name} {gc.customers.last_name}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-900">
                          {new Date(gc.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right shrink-0 mr-1">
                        <p className="text-xs font-black text-zinc-900">${gc.current_balance.toFixed(2)}</p>
                        <p className="text-[10px] text-zinc-900">
                          of ${gc.initial_balance.toFixed(2)}
                        </p>
                      </div>

                      {expandedCardId === gc.id ? (
                        <ChevronUp size={14} className="text-zinc-900" />
                      ) : (
                        <ChevronDown size={14} className="text-zinc-900" />
                      )}
                    </button>

                    {/* Expanded Details */}
                    {expandedCardId === gc.id && (
                      <div className="border-t border-zinc-200 bg-zinc-50 p-3 space-y-3">
                        {/* Transaction History */}
                        <div>
                          <p className="text-[10px] font-bold uppercase text-zinc-900 mb-2">Transaction History</p>
                          {!gc.gift_card_transactions || gc.gift_card_transactions.length === 0 ? (
                            <p className="text-[10px] text-zinc-900 text-center py-2">No transactions yet</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {gc.gift_card_transactions.map(tx => (
                                <div key={tx.id} className="flex justify-between items-center p-2 bg-white rounded border border-zinc-200 text-[9px]">
                                  <div>
                                    <p className="font-bold text-zinc-900 uppercase">{tx.transaction_type}</p>
                                    <p className="text-zinc-900">{new Date(tx.created_at).toLocaleString()}</p>
                                  </div>
                                  <p className={`font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Redeem Button */}
                        {gc.is_active && gc.current_balance > 0 && (
                          <button
                            onClick={() => openRedeemFromHistory(gc)}
                            className="w-full px-3 py-2 bg-[var(--primary-color)] text-white rounded-lg text-[10px] font-bold uppercase hover:bg-red-700 transition-colors"
                          >
                            Redeem This Card
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {!isHistoryLoading && giftCards.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-900 font-bold uppercase tracking-widest mb-1">Total Cards</p>
                    <p className="text-xl font-black text-zinc-900">{totalCards}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-900 font-bold uppercase tracking-widest mb-1">Issued</p>
                    <p className="text-xl font-black text-zinc-900">${totalIssued.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-900 font-bold uppercase tracking-widest mb-1">Remaining</p>
                    <p className="text-xl font-black text-[var(--primary-color)]">${totalRemaining.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Redeem from History Modal */}
      <AnimatePresence>
        {showRedeemModal && selectedCardForRedeem && (
          <div className="fixed inset-0 bg-black/50 z-70 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-xl shadow-2xl max-w-sm w-full"
            >
              {/* Header */}
              <div className="bg-zinc-950 text-white p-4 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest">Redeem Gift Card</h2>
                <button
                  onClick={() => setShowRedeemModal(false)}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {redeemError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold">
                    <AlertCircle size={14} />
                    {redeemError}
                  </div>
                )}

                {/* Card Details */}
                <div className="bg-zinc-50 p-4 rounded-lg space-y-2">
                  <div>
                    <p className="text-[10px] text-zinc-900 uppercase tracking-wide font-bold">Card Number</p>
                    <p className="text-sm font-mono font-black text-zinc-900">{selectedCardForRedeem.card_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-900 uppercase tracking-wide font-bold">Available Balance</p>
                    <p className="text-sm font-black text-[var(--primary-color)]">${selectedCardForRedeem.current_balance.toFixed(2)}</p>
                  </div>
                </div>

                {!cartHasItems && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-amber-700 text-[11px] font-bold">
                    âš ï¸ Add items to cart first
                  </div>
                )}

                {/* Amount Selection */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-900 mb-2">
                    Redemption Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-zinc-900">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={selectedCardForRedeem.current_balance}
                      value={redeemAmount}
                      onChange={e => setRedeemAmount(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold text-black"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRedeemModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRedeemFromHistory}
                    disabled={isRedeeming || redeemAmount <= 0 || redeemAmount > selectedCardForRedeem.current_balance || !cartHasItems}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRedeeming ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Redeeming...
                      </>
                    ) : (
                      'Apply to Cart'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
