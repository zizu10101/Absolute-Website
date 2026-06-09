import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Discount } from '../hooks/usePOSCart';

interface PosDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (discount: Discount) => void;
  currentDiscount: Discount | null;
  subtotal: number;
}

export const PosDiscountModal: React.FC<PosDiscountModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentDiscount,
  subtotal,
}) => {
  const [tab, setTab] = useState<'percentage' | 'custom'>('percentage');
  const [percentageValue, setPercentageValue] = useState(currentDiscount?.type === 'percentage' ? currentDiscount.value : 0);
  const [customValue, setCustomValue] = useState(currentDiscount?.type === 'custom' ? currentDiscount.value : 0);

  const discountPreview = useMemo(() => {
    if (tab === 'percentage') {
      const amount = (subtotal * percentageValue) / 100;
      return {
        discountAmount: amount,
        finalTotal: subtotal - amount,
      };
    } else {
      // Custom price is the new total, not a discount
      return {
        discountAmount: Math.max(0, subtotal - customValue),
        finalTotal: customValue,
      };
    }
  }, [tab, percentageValue, customValue, subtotal]);

  const handleApply = () => {
    if (tab === 'percentage') {
      if (percentageValue < 0 || percentageValue > 100) {
        alert('Percentage must be between 0 and 100');
        return;
      }
      onApply({ type: 'percentage', value: percentageValue });
    } else {
      if (customValue < 0) {
        alert('Custom total price cannot be negative');
        return;
      }
      onApply({ type: 'custom', value: customValue });
    }
    onClose();
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
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-zinc-950 text-white p-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest">Apply Discount</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => setTab('percentage')}
            className={`flex-1 p-3 text-xs font-black uppercase tracking-widest transition-colors ${
              tab === 'percentage'
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            % Discount
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`flex-1 p-3 text-xs font-black uppercase tracking-widest transition-colors ${
              tab === 'custom'
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Custom Price
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {tab === 'percentage' ? (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  Discount Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentageValue}
                    onChange={(e) => setPercentageValue(Math.max(0, Math.min(100, Number(e.target.value))))}
                    onKeyDown={(e) => {
                      // Allow number keys, backspace, delete, arrow keys
                      if (/^\d$/.test(e.key) || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                        return;
                      }
                      e.preventDefault();
                    }}
                    autoFocus={tab === 'percentage'}
                    className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm font-bold text-black bg-white"
                  />
                  <span className="text-lg font-black">%</span>
                </div>
              </div>
              <div className="bg-zinc-50 p-3 rounded-lg space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Preview</p>
                <p className="text-sm font-bold text-zinc-900">Subtotal: ${subtotal.toFixed(2)}</p>
                <p className="text-xs font-bold text-red-600">−Discount: ${discountPreview.discountAmount.toFixed(2)}</p>
                <p className="text-sm font-black text-zinc-950 pt-1 border-t border-zinc-200">
                  Total: ${discountPreview.finalTotal.toFixed(2)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  Custom Total Price
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-zinc-900">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customValue}
                    onChange={(e) => setCustomValue(Math.max(0, Number(e.target.value)))}
                    onKeyDown={(e) => {
                      // Allow number keys, decimal point, backspace, delete, arrow keys
                      if (/^\d$/.test(e.key) || ['.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                        return;
                      }
                      e.preventDefault();
                    }}
                    autoFocus={tab === 'custom'}
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-bold text-black"
                  />
                </div>
              </div>
              <div className="bg-zinc-50 p-3 rounded-lg space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Preview</p>
                <p className="text-sm font-bold text-black">Original Total: ${subtotal.toFixed(2)}</p>
                {discountPreview.discountAmount > 0 && (
                  <p className="text-xs font-bold text-red-600">−Discount: ${discountPreview.discountAmount.toFixed(2)}</p>
                )}
                <p className="text-sm font-black text-black pt-1 border-t border-zinc-200">
                  New Total: ${discountPreview.finalTotal.toFixed(2)}
                </p>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 rounded-lg bg-[#b90014] text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
