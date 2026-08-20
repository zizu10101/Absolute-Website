import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

export interface SizeOption {
  size: string;
  stock_quantity: number;
}

interface SizeSelectorProps {
  isOpen: boolean;
  sizes: SizeOption[];
  productName: string;
  onSelect: (size: string) => void;
  onClose: () => void;
}

export const SizeSelector: React.FC<SizeSelectorProps> = ({
  isOpen,
  sizes,
  productName,
  onSelect,
  onClose,
}) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedSize) {
      onSelect(selectedSize);
      setSelectedSize(null);
    }
  };

  if (!isOpen) return null;

  const inStockSizes = sizes.filter((s) => s.stock_quantity > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-50 max-w-md w-full mx-4"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-zinc-900">Select Size</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Product Name */}
          <p className="text-sm text-zinc-600 mb-4">{productName}</p>

          {/* Size Options */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {inStockSizes.length > 0 ? (
              inStockSizes.map((option) => (
                <button
                  key={option.size}
                  onClick={() => setSelectedSize(option.size)}
                  className={`py-2 px-3 text-sm font-bold uppercase transition-all rounded border-2 ${
                    selectedSize === option.size
                      ? 'bg-[#b90014] text-white border-[#b90014]'
                      : 'bg-white text-zinc-900 border-zinc-300 hover:border-[#b90014]'
                  }`}
                >
                  {option.size}
                </button>
              ))
            ) : (
              <p className="col-span-4 text-center text-zinc-500 py-4">
                No sizes in stock
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-zinc-300 text-zinc-900 font-bold uppercase text-sm hover:bg-zinc-50 transition-colors rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedSize || inStockSizes.length === 0}
              className="flex-1 py-2 px-4 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
