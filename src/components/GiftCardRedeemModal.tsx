import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface GiftCardRedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalDue: number;
  onRedeem: (cardNumber: string, amount: number) => Promise<void>;
}

export const GiftCardRedeemModal: React.FC<GiftCardRedeemModalProps> = ({
  isOpen,
  onClose,
  totalDue,
  onRedeem,
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [amount, setAmount] = useState(totalDue);
  const [cardData, setCardData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!cardNumber.trim()) {
      setError('Please enter a card number');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCardData(null);

    try {
      const res = await fetch(`/api/gift-cards/lookup?card_number=${encodeURIComponent(cardNumber)}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result?.error || 'Card not found');
        return;
      }

      setCardData(result.data);
      setAmount(Math.min(totalDue, result.data.current_balance));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!cardData || !amount || amount <= 0) {
      setError('Invalid amount');
      return;
    }

    setIsRedeeming(true);
    setError(null);

    try {
      await onRedeem(cardNumber, amount);
      setSuccess(`$${amount.toFixed(2)} redeemed from gift card`);
      setTimeout(() => {
        setCardNumber('');
        setCardData(null);
        setAmount(totalDue);
        setSuccess(null);
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsRedeeming(false);
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
          <h2 className="text-sm font-black uppercase tracking-widest">Redeem Gift Card</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-emerald-700 text-[11px] font-bold">
              {success}
            </div>
          )}

          {!cardData ? (
            <>
              {/* Card Number Input */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  Gift Card Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value.toUpperCase().slice(0, 16))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleLookup();
                    }}
                    placeholder="Scan or type card number..."
                    maxLength={16}
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono font-bold uppercase"
                    autoFocus
                  />
                  <button
                    onClick={handleLookup}
                    disabled={isLoading || !cardNumber.trim()}
                    className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg text-[10px] font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Look Up'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-500 text-center">Total Due: ${totalDue.toFixed(2)}</p>
            </>
          ) : (
            <>
              {/* Card Details */}
              <div className="bg-zinc-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Card Number</p>
                    <p className="text-sm font-mono font-black text-zinc-900">{cardData.card_number}</p>
                  </div>
                </div>
                {cardData.customers && (
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Holder</p>
                    <p className="text-xs font-bold text-zinc-900">
                      {cardData.customers.first_name} {cardData.customers.last_name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">Available Balance</p>
                  <p className="text-sm font-black text-[var(--primary-color)]">${cardData.current_balance.toFixed(2)}</p>
                </div>
              </div>

              {/* Amount Selection */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  Redemption Amount
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-zinc-900">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={cardData.current_balance}
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {amount > cardData.current_balance ? (
                    <span className="text-red-600">Exceeds card balance</span>
                  ) : amount < totalDue ? (
                    <span className="text-amber-600">Partial redemption: ${(totalDue - amount).toFixed(2)} still due</span>
                  ) : (
                    <span className="text-emerald-600">Full payment from gift card</span>
                  )}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCardNumber('');
                    setCardData(null);
                    setAmount(totalDue);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleRedeem}
                  disabled={isRedeeming || amount <= 0 || amount > cardData.current_balance}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isRedeeming ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    'Redeem'
                  )}
                </button>
              </div>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full text-xs text-zinc-500 hover:text-zinc-700 font-bold uppercase tracking-widest py-2"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
