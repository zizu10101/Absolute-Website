import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateGiftReceiptHTML } from '../utils/thermalReceipt';

interface GiftReceiptItem {
  id: string;
  name: string;
  quantity: number;
  size?: string;
  ageGroup?: string;
}

interface GiftReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: GiftReceiptItem[];
  invoiceNumber?: string;
  customerName: string;
  logoUrl?: string;
}

export const GiftReceiptModal: React.FC<GiftReceiptModalProps> = ({
  isOpen,
  onClose,
  items,
  invoiceNumber,
  customerName,
  logoUrl,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(items.map(item => item.id))
  );

  const handleSelectAll = () => {
    setSelectedItems(new Set(items.map(item => item.id)));
  };

  const handleClearAll = () => {
    setSelectedItems(new Set());
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handlePrintGiftReceipt = () => {
    const itemsToPrint = items
      .filter(item => selectedItems.has(item.id))
      .map(item => ({
        name: item.name,
        quantity: item.quantity,
        size: item.size,
        ageGroup: item.ageGroup,
      }));

    if (itemsToPrint.length === 0) {
      alert('Please select at least one item');
      return;
    }

    const receiptHtml = generateGiftReceiptHTML({
      invoiceNumber,
      customerName,
      items: itemsToPrint,
      createdAt: new Date(),
      logoUrl,
    });

    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-900">Select Items for Gift Receipt</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Control Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-semibold rounded transition-colors"
                >
                  Clear All
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-4 bg-gray-50">
                {items.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No items in transaction</p>
                ) : (
                  items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleToggleItem(item.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 break-words">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          {[item.ageGroup, item.size ? `Size ${item.size}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="text-sm font-medium text-gray-700">Qty: {item.quantity}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {/* Info Message */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                <p className="font-semibold mb-1">Gift Receipt Details:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>No prices shown</li>
                  <li>30-day exchange policy</li>
                  <li>Items only, no totals</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintGiftReceipt}
                disabled={selectedItems.size === 0}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Print Gift Receipt
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
