import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';

interface StoreCreditData {
  id: string;
  customer_id: string;
  amount: number;
  remaining_balance: number;
  reason: string;
  is_active: boolean;
  created_at: string;
  store_credit_transactions?: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    created_at: string;
  }>;
}

interface StoreCreditionsSectionProps {
  customerId: string;
}

export const StoreCreditsSection: React.FC<StoreCreditionsSectionProps> = ({ customerId }) => {
  const [storeCredits, setStoreCredits] = useState<StoreCreditData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreCredits();
  }, [customerId]);

  const fetchStoreCredits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_credits')
        .select(`
          *,
          store_credit_transactions (*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStoreCredits(data || []);
    } catch (err) {
      console.error('Error fetching store credits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAvailable = storeCredits
    .filter(sc => sc.is_active)
    .reduce((sum, sc) => sum + sc.remaining_balance, 0);

  if (isLoading) {
    return <div className="text-sm text-zinc-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Total Available */}
      {totalAvailable > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-600">Available Store Credit</div>
          <div className="text-3xl font-black text-blue-900">${totalAvailable.toFixed(2)}</div>
        </div>
      )}

      {/* Credits List */}
      {storeCredits.length === 0 ? (
        <div className="text-sm text-zinc-500 p-4 text-center bg-zinc-50 rounded-lg">
          No store credits
        </div>
      ) : (
        <div className="space-y-2">
          {storeCredits.map((credit) => (
            <motion.div
              key={credit.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border border-zinc-200 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === credit.id ? null : credit.id)
                }
                className="w-full px-4 py-3 bg-white hover:bg-zinc-50 flex items-center justify-between text-left transition-all"
              >
                <div className="flex-1">
                  <div className="text-sm font-bold text-zinc-900">
                    Credit #{credit.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{credit.reason}</div>
                </div>
                <div className="text-right mr-3">
                  <div className="text-sm font-bold text-zinc-900">
                    ${credit.remaining_balance.toFixed(2)}
                  </div>
                  <div
                    className={`text-xs font-bold ${
                      credit.is_active ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {credit.is_active ? 'ACTIVE' : 'DEPLETED'}
                  </div>
                </div>
                {expandedId === credit.id ? (
                  <ChevronUp size={16} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={16} className="text-zinc-400" />
                )}
              </button>

              {/* Expanded Details */}
              {expandedId === credit.id && (
                <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 space-y-3">
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Issued:</span>
                      <span>{new Date(credit.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Original Amount:</span>
                      <span>${credit.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Used:</span>
                      <span>${(credit.amount - credit.remaining_balance).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-zinc-600">Remaining:</span>
                      <span>${credit.remaining_balance.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Transaction History */}
                  {credit.store_credit_transactions &&
                    credit.store_credit_transactions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-200">
                        <div className="text-xs font-bold text-zinc-700 mb-2">
                          TRANSACTION HISTORY
                        </div>
                        <div className="space-y-1 text-[10px]">
                          {credit.store_credit_transactions.map((tx) => (
                            <div key={tx.id} className="flex justify-between">
                              <span className="capitalize text-zinc-600">
                                {tx.transaction_type === 'redeemed'
                                  ? '↓ Redeemed'
                                  : '↑ Issued'}
                              </span>
                              <span
                                className={
                                  tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                ${Math.abs(tx.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
