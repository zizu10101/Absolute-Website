import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';

interface GiftCard {
  id: string;
  card_number: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
}

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
}

export const GiftCardsAdmin: React.FC = () => {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [cardTransactions, setCardTransactions] = useState<{ [key: string]: Transaction[] }>({});
  const [txLoading, setTxLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchGiftCards();
  }, []);

  const fetchGiftCards = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gift-cards');
      const result = await res.json();
      if (result.data) {
        setGiftCards(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch gift cards:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async (giftCardId: string) => {
    if (cardTransactions[giftCardId]) {
      setExpandedCardId(expandedCardId === giftCardId ? null : giftCardId);
      return;
    }

    setTxLoading(giftCardId);
    try {
      const res = await fetch(`/api/gift-cards/history?gift_card_id=${giftCardId}`);
      const result = await res.json();
      if (result.data) {
        setCardTransactions(prev => ({ ...prev, [giftCardId]: result.data }));
      }
    } catch (e) {
      console.error('Failed to fetch transactions:', e);
    } finally {
      setTxLoading(null);
      setExpandedCardId(expandedCardId === giftCardId ? null : giftCardId);
    }
  };

  const filtered = useMemo(() => {
    return giftCards.filter(gc => {
      if (statusFilter === 'active' && !gc.is_active) return false;
      if (statusFilter === 'inactive' && gc.is_active) return false;

      const q = searchQuery.toLowerCase();
      const cardNum = gc.card_number.toLowerCase();
      const customerName = gc.customers
        ? `${gc.customers.first_name} ${gc.customers.last_name}`.toLowerCase()
        : '';

      return !q || cardNum.includes(q) || customerName.includes(q);
    });
  }, [giftCards, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900">Gift Cards</h2>
          <button
            onClick={fetchGiftCards}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-lg text-[11px] font-black uppercase hover:bg-[#b90014] transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Search & Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by card number or customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          </div>

          <div className="flex gap-2">
            {['all', 'active', 'inactive'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                  statusFilter === status
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
            <AlertCircle size={32} className="text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-bold">No gift cards found</p>
          </div>
        ) : (
          filtered.map(gc => (
            <div key={gc.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              {/* Card Row */}
              <button
                onClick={() => fetchTransactions(gc.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-mono font-black text-zinc-900">{gc.card_number}</p>
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        gc.is_active
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {gc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {gc.customers && (
                    <p className="text-[11px] text-zinc-600 font-bold">
                      {gc.customers.first_name} {gc.customers.last_name}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400">
                    Issued: {new Date(gc.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-zinc-900 mb-1">
                    ${gc.current_balance.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    of ${gc.initial_balance.toFixed(2)}
                  </p>
                </div>

                <div className="p-2 rounded hover:bg-zinc-100 transition-colors shrink-0">
                  {expandedCardId === gc.id ? (
                    <ChevronUp size={16} className="text-zinc-400" />
                  ) : (
                    <ChevronDown size={16} className="text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Transaction History */}
              {expandedCardId === gc.id && (
                <div className="border-t border-zinc-200 bg-zinc-50 p-4">
                  {txLoading === gc.id ? (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                    </div>
                  ) : cardTransactions[gc.id]?.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 text-center py-2">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {cardTransactions[gc.id]?.map(tx => (
                        <div key={tx.id} className="flex justify-between items-center p-2 bg-white rounded border border-zinc-200 text-[10px]">
                          <div>
                            <p className="font-bold text-zinc-900 uppercase">{tx.transaction_type}</p>
                            <p className="text-zinc-500">{new Date(tx.created_at).toLocaleString()}</p>
                          </div>
                          <p className={`font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>
                            {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Cards', value: giftCards.length },
            { label: 'Active', value: giftCards.filter(gc => gc.is_active).length },
            { label: 'Total Balance', value: `$${giftCards.reduce((sum, gc) => sum + gc.current_balance, 0).toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{label}</p>
              <p className="text-2xl font-black text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
