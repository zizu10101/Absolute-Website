import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

interface GiftCard {
  id: string;
  card_number: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  gift_card_transactions?: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    created_at: string;
  }>;
}

interface CustomerGiftCardsProps {
  customerId: string;
}

export const CustomerGiftCards: React.FC<CustomerGiftCardsProps> = ({ customerId }) => {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomerGiftCards();
  }, [customerId]);

  const fetchCustomerGiftCards = async () => {
    setIsLoading(true);
    setError(null);


    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          gift_card_transactions (
            id,
            amount,
            transaction_type,
            created_at
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });


      if (error) {
        console.error('ERROR Gift cards fetch error:', error);
        throw error;
      }

      setGiftCards(data || []);
    } catch (e: any) {
      console.error('ERROR Failed to fetch gift cards:', e);
      setError('Failed to load gift cards');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-zinc-100 p-5">
        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3">Gift Cards</p>
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-zinc-100 p-5">
        <div className="flex items-center gap-2 text-red-600 text-[11px] font-bold">
          <AlertCircle size={14} />
          {error}
        </div>
      </div>
    );
  }

  if (giftCards.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-100 p-5">
        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3">Gift Cards</p>
        <p className="text-[11px] text-zinc-500 text-center py-4">No gift cards linked to this customer</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Gift Cards ({giftCards.length})</p>
        <button
          onClick={fetchCustomerGiftCards}
          className="p-1 hover:bg-zinc-100 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="space-y-2">
        {giftCards.map(gc => (
          <div key={gc.id} className="border border-zinc-100 rounded-lg overflow-hidden">
            {/* Card Summary */}
            <button
              onClick={() => setExpandedCardId(expandedCardId === gc.id ? null : gc.id)}
              className="w-full p-3 flex items-center gap-3 hover:bg-zinc-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono font-black text-zinc-900">{gc.card_number}</p>
                <p className="text-[9px] text-zinc-500">{new Date(gc.created_at).toLocaleDateString()}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs font-black text-zinc-900">${gc.current_balance.toFixed(2)}</p>
                <p className="text-[8px] text-zinc-500">of ${gc.initial_balance.toFixed(2)}</p>
              </div>

              {!gc.is_active && (
                <span className="text-[8px] font-black px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded uppercase">
                  Inactive
                </span>
              )}

              <div>
                {expandedCardId === gc.id ? (
                  <ChevronUp size={14} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={14} className="text-zinc-400" />
                )}
              </div>
            </button>

            {/* Transaction History */}
            {expandedCardId === gc.id && (
              <div className="border-t border-zinc-100 bg-zinc-50 p-3 space-y-2">
                {!gc.gift_card_transactions || gc.gift_card_transactions.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 text-center py-2">No transactions yet</p>
                ) : (
                  gc.gift_card_transactions.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center p-2 bg-white rounded border border-zinc-100 text-[9px]">
                      <div>
                        <p className="font-bold text-zinc-900 uppercase">{tx.transaction_type}</p>
                        <p className="text-zinc-500">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                      <p className={`font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
