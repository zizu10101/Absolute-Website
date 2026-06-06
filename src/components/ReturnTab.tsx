import React, { useState, useRef, useEffect } from 'react';
import { Search, AlertCircle, Check, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  taxable?: boolean;
}

interface Transaction {
  id: string;
  created_at: string;
  items: CartItem[];
  total_amount: number;
  method: string;
  customer_id?: string;
  subtotal?: number;
  hst?: number;
  isTaxExempt?: boolean;
}

interface ReturnItem {
  itemId: string;
  name: string;
  size?: string;
  quantity: number;
  originalPrice: number;
  returnAmount: number;
  returnType: 'refund' | 'store_credit';
  isSelected: boolean;
}

export function ReturnTab() {
  const [invoiceInput, setInvoiceInput] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const searchTransaction = async () => {
    if (!invoiceInput.trim()) {
      setError('Please enter invoice number');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Search by transaction ID (invoice number)
      const { data, error: dbError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', invoiceInput.trim())
        .single();

      if (dbError || !data) {
        // Try searching by partial ID in case user entered last few digits
        const { data: partialData, error: partialError } = await supabase
          .from('transactions')
          .select('*')
          .ilike('id', `%${invoiceInput.trim()}%`)
          .limit(1)
          .single();

        if (partialError || !partialData) {
          setError('Invoice not found');
          setTransaction(null);
          setReturnItems([]);
          setLoading(false);
          return;
        }

        loadTransaction(partialData);
      } else {
        loadTransaction(data);
      }
    } catch (err) {
      setError('Error searching transaction');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransaction = (tx: any) => {
    setTransaction(tx);

    // Parse items and calculate return amounts
    const items = Array.isArray(tx.items) ? tx.items : [];
    const isTaxed = !tx.isTaxExempt && tx.hst && tx.hst > 0;

    const returnItemsList: ReturnItem[] = items.map((item: any, idx: number) => {
      const itemSubtotal = (item.price || 0) * (item.quantity || 1);

      // Calculate proportional discount (if any)
      let discountAmount = 0;
      if (tx.discount && tx.subtotal && tx.subtotal > 0) {
        if (tx.discount.type === 'percentage') {
          // Percentage discount: apply to this item's portion
          const discountPercent = tx.discount.value;
          discountAmount = itemSubtotal * (discountPercent / 100);
        } else {
          // Custom price discount: apply proportionally
          const totalDiscount = tx.subtotal - tx.discount.value;
          const itemProportion = itemSubtotal / tx.subtotal;
          discountAmount = totalDiscount * itemProportion;
        }
      }

      // Calculate item amount after discount
      const itemAfterDiscount = itemSubtotal - discountAmount;

      // Add proportional tax if transaction was taxed
      let itemReturnAmount = itemAfterDiscount;
      if (isTaxed && item.taxable !== false) {
        const itemTax = itemAfterDiscount * 0.13;
        itemReturnAmount += itemTax;
      }

      return {
        itemId: `${item.id}-${idx}`,
        name: item.name || 'Unknown Item',
        size: item.size,
        quantity: item.quantity || 1,
        originalPrice: item.price || 0,
        returnAmount: Math.round(itemReturnAmount * 100) / 100,
        returnType: 'refund' as const,
        isSelected: false,
      };
    });

    setReturnItems(returnItemsList);
  };

  const toggleItemSelection = (itemId: string) => {
    setReturnItems(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const updateReturnType = (itemId: string, returnType: 'refund' | 'store_credit') => {
    setReturnItems(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, returnType } : item
      )
    );
  };

  const getSelectedItems = () => returnItems.filter(item => item.isSelected);
  const getTotalRefund = () => getSelectedItems().filter(i => i.returnType === 'refund').reduce((sum, i) => sum + i.returnAmount, 0);
  const getTotalStoreCredit = () => getSelectedItems().filter(i => i.returnType === 'store_credit').reduce((sum, i) => sum + i.returnAmount, 0);

  const processReturn = async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      setError('Please select items to return');
      return;
    }

    if (!transaction) {
      setError('No transaction loaded');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const refundAmount = getTotalRefund();
      const storeCreditAmount = getTotalStoreCredit();

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          returnItems: selectedItems.map(item => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            amount: item.returnAmount,
            returnType: item.returnType,
          })),
          refundAmount,
          storeCreditAmount,
          originalPaymentMethod: transaction.method,
          customerId: transaction.customer_id,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to process return');
        return;
      }

      setSuccess(`Return processed successfully! Refund: $${refundAmount.toFixed(2)}, Store Credit: $${storeCreditAmount.toFixed(2)}`);
      setInvoiceInput('');
      setTransaction(null);
      setReturnItems([]);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing return');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-950 text-white h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-6">Return Items</h2>

      {/* Search Section */}
      <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
        <label className="block text-sm font-semibold mb-2 text-zinc-300">Invoice Number or Barcode</label>
        <div className="flex gap-2">
          <input
            ref={barcodeInputRef}
            type="text"
            value={invoiceInput}
            onChange={(e) => setInvoiceInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchTransaction()}
            placeholder="Scan barcode or enter invoice number..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-gray-500 font-mono text-sm"
          />
          <button
            onClick={searchTransaction}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Search size={18} />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded flex items-center gap-2 text-red-300">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded flex items-center gap-2 text-green-300">
          <Check size={18} />
          {success}
        </div>
      )}

      {/* Transaction Info */}
      {transaction && (
        <div className="mb-6 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Invoice #</span>
              <p className="font-mono text-green-400">{transaction.id.slice(0, 8)}...</p>
            </div>
            <div>
              <span className="text-zinc-400">Date</span>
              <p>{new Date(transaction.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-zinc-400">Payment Method</span>
              <p className="font-semibold">{transaction.method}</p>
            </div>
            <div>
              <span className="text-zinc-400">Total</span>
              <p className="text-lg font-bold">${(transaction.total_amount || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Items Selection */}
      {returnItems.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-semibold">Select Items to Return</h3>

          {returnItems.map((item) => (
            <div
              key={item.itemId}
              className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-3"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.isSelected}
                  onChange={() => toggleItemSelection(item.itemId)}
                  className="mt-1 w-5 h-5 accent-blue-600"
                />
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-zinc-400">
                    Qty: {item.quantity}
                    {item.size && ` | Size: ${item.size}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Return Amount</p>
                  <p className="text-lg font-bold text-green-400">${item.returnAmount.toFixed(2)}</p>
                </div>
              </div>

              {item.isSelected && (
                <div className="flex gap-2 ml-8 pt-2 border-t border-zinc-700">
                  <button
                    onClick={() => updateReturnType(item.itemId, 'refund')}
                    className={`flex-1 py-2 px-3 rounded font-semibold text-sm transition ${
                      item.returnType === 'refund'
                        ? 'bg-orange-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    <Trash2 size={16} className="inline mr-2" />
                    Refund
                  </button>
                  <button
                    onClick={() => updateReturnType(item.itemId, 'store_credit')}
                    className={`flex-1 py-2 px-3 rounded font-semibold text-sm transition ${
                      item.returnType === 'store_credit'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    <RefreshCw size={16} className="inline mr-2" />
                    Store Credit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary & Process */}
      {getSelectedItems().length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="bg-orange-900/20 p-3 rounded border border-orange-700">
                <span className="text-zinc-400">Refund to {transaction?.method}</span>
                <p className="text-xl font-bold text-orange-400">${getTotalRefund().toFixed(2)}</p>
              </div>
              <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                <span className="text-zinc-400">Store Credit Issued</span>
                <p className="text-xl font-bold text-blue-400">${getTotalStoreCredit().toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={processReturn}
              disabled={processing || getSelectedItems().length === 0}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {processing ? 'Processing Return...' : 'Process Return'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!transaction && invoiceInput === '' && (
        <div className="text-center py-12 text-zinc-400">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>Scan invoice barcode or enter invoice number to begin returns</p>
        </div>
      )}
    </div>
  );
}
