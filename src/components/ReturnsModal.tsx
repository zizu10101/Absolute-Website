import React, { useState, useRef, useEffect } from 'react';
import { X, Search, AlertCircle, Check, ChevronRight, Package, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { useCustomers } from '../context/CustomerContext';
import { generateThermalReceiptHTML } from '../utils/thermalReceipt';

interface ReturnItem {
  id: string;
  name: string;
  size?: string;
  originalQuantity: number;
  returnQuantity: number;
  pricePerUnit: number;
  variantId?: string;
}

interface Transaction {
  id: string;
  created_at: string;
  total_amount: number;
  method: string;
  items: any[];
  customer_id?: string;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  subtotal?: number;
  hst?: number;
  isTaxExempt?: boolean;
}

type Step = 'lookup' | 'select-items' | 'choose-refund' | 'confirm' | 'complete';

interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTransactionId?: string;
  prefilledCustomerId?: string;
  onComplete?: () => void;
}

export const ReturnsModal: React.FC<ReturnsModalProps> = ({
  isOpen,
  onClose,
  prefilledTransactionId,
  prefilledCustomerId,
  onComplete
}) => {
  const { customers } = useCustomers();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>(prefilledTransactionId ? 'select-items' : 'lookup');
  const [invoiceInput, setInvoiceInput] = useState(prefilledTransactionId || '');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'store-credit' | 'original-payment' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);

  // Auto-load transaction if prefilled
  useEffect(() => {
    if (isOpen && prefilledTransactionId && !transaction) {
      loadTransactionByIdDirect(prefilledTransactionId);
    }
  }, [isOpen, prefilledTransactionId]);

  useEffect(() => {
    if (isOpen && currentStep === 'lookup') {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [isOpen, currentStep]);

  const loadTransactionByIdDirect = async (txId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('id', txId)
        .single();

      if (dbError || !data) {
        setError('Invoice not found');
        return;
      }

      if (data.status !== 'completed') {
        setError('This transaction has already been voided or refunded');
        return;
      }

      setTransaction(data);
      initializeReturnItems(data);
      setCurrentStep('select-items');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error looking up invoice');
    } finally {
      setLoading(false);
    }
  };

  const lookupInvoice = async () => {
    if (!invoiceInput.trim()) {
      setError('Please enter invoice number or scan barcode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, email, phone)')
        .or(`id.eq.${invoiceInput.trim()},id.ilike.%${invoiceInput.trim()}%`)
        .eq('status', 'completed')
        .single();

      if (dbError || !data) {
        setError('Invoice not found or already voided');
        return;
      }

      if (data.status !== 'completed') {
        setError('This transaction has already been voided or refunded');
        return;
      }

      setTransaction(data);
      initializeReturnItems(data);
      setCurrentStep('select-items');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error looking up invoice');
    } finally {
      setLoading(false);
    }
  };

  const initializeReturnItems = (tx: Transaction) => {
    const items = Array.isArray(tx.items) ? tx.items : [];
    const returnItems: ReturnItem[] = items.map((item, idx) => ({
      id: `${item.id || idx}`,
      name: item.name || 'Unknown Item',
      size: item.size,
      originalQuantity: item.quantity || 1,
      returnQuantity: 0,
      pricePerUnit: item.price || 0,
      variantId: item.variantId,
    }));
    setReturnItems(returnItems);
  };

  const updateReturnQuantity = (itemId: string, qty: number) => {
    setReturnItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, returnQuantity: Math.min(Math.max(0, qty), item.originalQuantity) }
          : item
      )
    );
  };

  const getSelectedItems = () => returnItems.filter(item => item.returnQuantity > 0);

  const calculateReturnAmount = () => {
    if (!transaction) return { subtotal: 0, tax: 0, total: 0 };

    const selectedItems = getSelectedItems();
    let subtotal = 0;

    selectedItems.forEach(item => {
      subtotal += item.pricePerUnit * item.returnQuantity;
    });

    // Calculate proportional tax
    const originalSubtotal = transaction.subtotal || transaction.total_amount / 1.13;
    const originalTax = transaction.hst || transaction.total_amount - originalSubtotal;

    // Tax as percentage
    const taxRate = originalSubtotal > 0 ? originalTax / originalSubtotal : 0.13;
    const tax = transaction.isTaxExempt ? 0 : subtotal * taxRate;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat((subtotal + tax).toFixed(2)),
    };
  };

  const handleRefundMethodSelect = (method: 'store-credit' | 'original-payment') => {
    if (method === 'store-credit' && !transaction?.customer_id) {
      setError('Customer must be linked to transaction for store credit');
      return;
    }
    setRefundMethod(method);
    setCurrentStep('confirm');
  };

  const handleCompleteReturn = async () => {
    if (!transaction || refundMethod === null) return;

    setProcessing(true);
    setError(null);

    try {
      const selectedItems = getSelectedItems();
      if (selectedItems.length === 0) {
        setError('No items selected for return');
        setProcessing(false);
        return;
      }

      const amounts = calculateReturnAmount();

      // Determine if full or partial return
      const totalOriginalQty = returnItems.reduce((sum, item) => sum + item.originalQuantity, 0);
      const totalReturnedQty = selectedItems.reduce((sum, item) => sum + item.returnQuantity, 0);
      const isFullReturn = totalReturnedQty === totalOriginalQty;
      const newTransactionStatus = isFullReturn ? 'returned' : 'partial_return';

      // 1. Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          transaction_id: transaction.id,
          customer_id: transaction.customer_id,
          refund_method: refundMethod,
          items: selectedItems,
          refund_amount: amounts.total,
          status: 'completed',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: newTransactionStatus })
        .eq('id', transaction.id);

      // 2. Restore inventory
      for (const item of selectedItems) {
        if (item.variantId) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', item.variantId)
            .single();

          if (variant) {
            const newQty = (variant.stock_quantity || 0) + item.returnQuantity;
            await supabase
              .from('product_variants')
              .update({ stock_quantity: newQty })
              .eq('id', item.variantId);
          }
        }
      }

      // 3. Process refund based on method
      if (refundMethod === 'store-credit') {
        // Issue store credit
        const { data: scRecord } = await supabase
          .from('store_credits')
          .insert({
            customer_id: transaction.customer_id,
            amount: amounts.total,
            remaining_balance: amounts.total,
            reason: 'Product Return',
            is_active: true,
          })
          .select()
          .single();

        if (scRecord) {
          await supabase.from('store_credit_transactions').insert({
            store_credit_id: scRecord.id,
            amount: amounts.total,
            transaction_type: 'issued',
          });
        }

        setCompletionData({
          type: 'store-credit',
          returnId: returnRecord.id,
          amount: amounts.total,
          creditId: scRecord?.id,
        });
      } else {
        // Refund to original payment method
        // Create refund audit record
        await supabase.from('transactions').insert({
          type: 'refund',
          original_transaction_id: transaction.id,
          method: transaction.method,
          total_amount: amounts.total,
          customer_id: transaction.customer_id,
          items: selectedItems,
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        // If original payment was Gift Card or Store Credit, restore balance
        if (transaction.method === 'Gift Card') {
          // Find and restore gift card
          const gcItem = transaction.items.find((i: any) => i.type === 'gift_card');
          if (gcItem) {
            const { data: gc } = await supabase
              .from('gift_cards')
              .select('*')
              .eq('card_number', gcItem.cardNumber)
              .single();

            if (gc) {
              const newBalance = (gc.current_balance || 0) + amounts.total;
              await supabase
                .from('gift_cards')
                .update({
                  current_balance: newBalance,
                  is_active: newBalance > 0,
                })
                .eq('id', gc.id);
            }
          }
        } else if (transaction.method === 'Store Credit') {
          // Find and restore store credit
          // This would be the reference to the original SC used
          // For now, we'd need to track which SC was used in the transaction
        }

        setCompletionData({
          type: 'refund',
          returnId: returnRecord.id,
          amount: amounts.total,
          method: transaction.method,
        });
      }

      setCurrentStep('complete');
      generateReturnReceipt();
      // Call onComplete callback if provided (for customer profile refresh)
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing return');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const generateReturnReceipt = () => {
    if (!transaction) return;

    const selectedItems = getSelectedItems();
    const amounts = calculateReturnAmount();
    const customerName = transaction.customers
      ? `${transaction.customers.first_name} ${transaction.customers.last_name}`
      : 'Walk-in';

    const html = generateThermalReceiptHTML({
      transactionId: transaction.id,
      customerName,
      items: selectedItems.map(item => ({
        name: `${item.name} (Return)`,
        quantity: item.returnQuantity,
        price: item.pricePerUnit,
        size: item.size,
      })),
      subtotal: amounts.subtotal,
      hst: amounts.tax,
      total: amounts.total,
      paymentMethod: `${refundMethod === 'store-credit' ? 'Store Credit' : transaction.method} - RETURN`,
      createdAt: new Date(),
      status: 'return',
    });

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleReset = () => {
    setCurrentStep(prefilledTransactionId ? 'select-items' : 'lookup');
    setInvoiceInput(prefilledTransactionId || '');
    setTransaction(null);
    setReturnItems([]);
    setRefundMethod(null);
    setError(null);
    setCompletionData(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  const amounts = calculateReturnAmount();
  const selectedItemsCount = getSelectedItems().length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Undo2 size={24} />
              <div>
                <h2 className="font-bold text-lg">Process Return</h2>
                <p className="text-sm opacity-90">
                  {currentStep === 'lookup' && 'Find the original invoice'}
                  {currentStep === 'select-items' && 'Select items to return'}
                  {currentStep === 'choose-refund' && 'Choose refund method'}
                  {currentStep === 'confirm' && 'Review and confirm'}
                  {currentStep === 'complete' && 'Return processed'}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* STEP 1: LOOKUP INVOICE */}
            {currentStep === 'lookup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Invoice Number or Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={invoiceInput}
                      onChange={(e) => setInvoiceInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && lookupInvoice()}
                      placeholder="Scan invoice barcode or type invoice #"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={lookupInvoice}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-semibold"
                    >
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}

                <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                  💡 You can scan the invoice barcode from the receipt or enter the transaction ID
                </div>
              </div>
            )}

            {/* STEP 2: SELECT ITEMS */}
            {currentStep === 'select-items' && transaction && (
              <div className="space-y-4">
                {/* Transaction Summary */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Invoice #</p>
                      <p className="font-mono font-bold text-gray-900">{transaction.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Date</p>
                      <p className="font-bold text-gray-900">{new Date(transaction.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Payment Method</p>
                      <p className="font-bold text-gray-900">{transaction.method}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Original Total</p>
                      <p className="font-bold text-gray-900">${transaction.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  {transaction.customers && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                      <p className="text-gray-600">Customer</p>
                      <p className="font-bold text-gray-900">
                        {transaction.customers.first_name} {transaction.customers.last_name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Items Checklist */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-black">Items Purchased</h3>
                  {returnItems.map((item) => {
                    const itemTax = (item.pricePerUnit * item.returnQuantity * 0.13);
                    const itemTotal = (item.pricePerUnit * item.returnQuantity) + itemTax;
                    const hasMultiple = item.originalQuantity > 1;

                    return (
                      <div key={item.id} className={`p-4 border rounded-lg ${item.returnQuantity > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <p className="font-semibold text-black">{item.name}</p>
                            {item.size && <p className="text-sm text-black">Size: {item.size}</p>}
                            <div className="mt-2 text-sm text-black">
                              <p>Price per unit: ${item.pricePerUnit.toFixed(2)}</p>
                              <p>Tax per unit: ${(item.pricePerUnit * 0.13).toFixed(2)}</p>
                              <p className="mt-1 font-semibold">Qty purchased: {item.originalQuantity}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            {hasMultiple ? (
                              <>
                                <p className="text-sm text-black font-semibold mb-2">Return Qty</p>
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    onClick={() => updateReturnQuantity(item.id, item.returnQuantity - 1)}
                                    className="px-2 py-1 bg-gray-300 text-black rounded hover:bg-gray-400 transition font-bold"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.originalQuantity}
                                    value={item.returnQuantity}
                                    onChange={(e) => updateReturnQuantity(item.id, parseInt(e.target.value) || 0)}
                                    className="w-12 text-center text-black border-2 border-gray-400 rounded py-1 font-bold"
                                  />
                                  <button
                                    onClick={() => updateReturnQuantity(item.id, item.returnQuantity + 1)}
                                    className="px-2 py-1 bg-gray-300 text-black rounded hover:bg-gray-400 transition font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                                <p className="text-xs text-black font-semibold">of {item.originalQuantity}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-black font-semibold mb-3">Return this item?</p>
                                <button
                                  onClick={() => updateReturnQuantity(item.id, item.returnQuantity === 1 ? 0 : 1)}
                                  className={`px-4 py-2 rounded font-bold text-white transition ${
                                    item.returnQuantity === 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 hover:bg-gray-500'
                                  }`}
                                >
                                  {item.returnQuantity === 1 ? '✓ Selected' : 'Select'}
                                </button>
                              </>
                            )}
                            {item.returnQuantity > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-300 text-right">
                                <p className="text-xs text-black font-semibold">Return amount</p>
                                <p className="font-bold text-black text-lg">${itemTotal.toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Return Total */}
                {selectedItemsCount > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Subtotal</span>
                        <span className="font-semibold">${amounts.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Tax (13%)</span>
                        <span className="font-semibold">${amounts.tax.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-blue-200 pt-2 flex justify-between text-base font-bold">
                        <span>Total Return</span>
                        <span className="text-blue-600">${amounts.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: CHOOSE REFUND METHOD */}
            {currentStep === 'choose-refund' && transaction && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">How would you like to process this return?</h3>

                  <div className="space-y-3">
                    {/* Store Credit Option */}
                    <button
                      onClick={() => handleRefundMethodSelect('store-credit')}
                      disabled={!transaction.customer_id}
                      className={`w-full p-4 rounded-lg border-2 transition text-left ${
                        !transaction.customer_id
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Issue Store Credit</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Customer receives ${amounts.total.toFixed(2)} in store credit to use on future purchases
                          </p>
                        </div>
                        <ChevronRight className="text-blue-600" size={20} />
                      </div>
                    </button>

                    {/* Refund to Original Payment Option */}
                    <button
                      onClick={() => handleRefundMethodSelect('original-payment')}
                      className="w-full p-4 rounded-lg border-2 border-green-300 hover:border-green-500 hover:bg-green-50 transition text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Refund to {transaction.method}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Refund ${amounts.total.toFixed(2)} back to the original payment method
                          </p>
                          {transaction.method === 'Gift Card' && (
                            <p className="text-xs text-amber-600 mt-2">Gift card balance will be restored</p>
                          )}
                          {transaction.method === 'Store Credit' && (
                            <p className="text-xs text-amber-600 mt-2">Store credit balance will be restored</p>
                          )}
                        </div>
                        <ChevronRight className="text-green-600" size={20} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: CONFIRMATION */}
            {currentStep === 'confirm' && transaction && refundMethod && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Return Summary</h3>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600">Items</p>
                      <ul className="mt-1 space-y-1">
                        {getSelectedItems().map((item) => (
                          <li key={item.id} className="text-gray-900">
                            • {item.name} {item.size && `(${item.size})`} × {item.returnQuantity}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">${amounts.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="font-semibold">${amounts.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200">
                        <span>Total</span>
                        <span className="text-blue-600">${amounts.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-gray-600">Refund Method</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {refundMethod === 'store-credit'
                          ? `Store Credit (${transaction.customers?.first_name} ${transaction.customers?.last_name})`
                          : `Refund to ${transaction.method}`}
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: COMPLETE */}
            {currentStep === 'complete' && completionData && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-6">
                    <Check size={48} className="text-green-600" />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Return Processed</h3>
                  <p className="text-gray-600 mt-2">
                    {completionData.type === 'store-credit'
                      ? `Store credit of $${completionData.amount.toFixed(2)} has been issued`
                      : `Refund of $${completionData.amount.toFixed(2)} has been processed to ${completionData.method}`}
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-sm text-gray-900">
                  <p className="font-semibold mb-2">What to do next:</p>
                  <ul className="text-left space-y-1">
                    <li>✓ Receipt has been printed</li>
                    <li>✓ Inventory has been restored</li>
                    {completionData.type === 'store-credit' && (
                      <li>✓ Customer can use their store credit immediately</li>
                    )}
                    {completionData.type === 'refund' && (
                      <li>✓ Refund will appear in customer&apos;s account within 1-2 business days</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-between">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              Close
            </button>

            {currentStep === 'lookup' && (
              <div />
            )}

            {currentStep === 'select-items' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep('lookup')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep('choose-refund')}
                  disabled={selectedItemsCount === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-semibold"
                >
                  Next: Choose Refund Method
                </button>
              </div>
            )}

            {currentStep === 'choose-refund' && (
              <button
                onClick={() => setCurrentStep('select-items')}
                className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Back
              </button>
            )}

            {currentStep === 'confirm' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep('choose-refund')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteReturn}
                  disabled={processing}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-semibold"
                >
                  {processing ? 'Processing...' : 'Complete Return'}
                </button>
              </div>
            )}

            {currentStep === 'complete' && (
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Process Another Return
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
