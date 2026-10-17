import React, { useState, useRef, useEffect } from 'react';
import { X, AlertCircle, Check, ChevronRight, Undo2, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { useCustomers } from '../context/CustomerContext';
import { generateThermalReceiptHTML, generateStoreCreditReceiptHTML } from '../utils/thermalReceipt';

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
  invoice_number?: string;
  created_at: string;
  total_amount: number;
  method: string;
  items: any[];
  customer_id?: string;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  subtotal?: number;
  hst?: number;
  isTaxExempt?: boolean;
  status?: string;
  refunded_items?: any[];
  refund_amount?: number;
}

type Step =
  | 'lookup'
  | 'mode-select'
  | 'select-items'
  | 'choose-refund'
  | 'choose-payment-type'
  | 'confirm'
  | 'complete'
  | 'exchange-select'
  | 'exchange-scan'
  | 'exchange-confirm'
  | 'exchange-complete';

interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTransactionId?: string;
  prefilledCustomerId?: string;
  onComplete?: () => void;
  mode?: 'return' | 'refund';
  prefilledTransaction?: Transaction;
}

export const ReturnsModal: React.FC<ReturnsModalProps> = ({
  isOpen,
  onClose,
  prefilledTransactionId,
  prefilledCustomerId,
  onComplete,
  mode = 'return',
  prefilledTransaction,
}) => {
  const { customers } = useCustomers();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const exchangeScanRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<Step>(
    mode === 'refund' ? 'choose-refund' : (prefilledTransactionId ? 'mode-select' : 'lookup')
  );
  const [invoiceInput, setInvoiceInput] = useState(prefilledTransactionId || '');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'store-credit' | 'original-payment' | null>(null);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);
  const [issuedStoreCreditCardNumber, setIssuedStoreCreditCardNumber] = useState<string | null>(null);

  // Exchange-specific state
  const [exchangeFromItem, setExchangeFromItem] = useState<ReturnItem | null>(null);
  const [exchangeScanInput, setExchangeScanInput] = useState('');
  const [exchangeToVariant, setExchangeToVariant] = useState<any | null>(null);
  const [exchangeSearching, setExchangeSearching] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [exchangePriceDiff, setExchangePriceDiff] = useState(0);
  const [scanMode, setScanMode] = useState<'barcode' | 'search'>('barcode');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const exchangeSearchRef = useRef<HTMLInputElement>(null);

  // Refund mode: set transaction directly from prop
  useEffect(() => {
    if (isOpen && mode === 'refund' && prefilledTransaction && !transaction) {
      setTransaction(prefilledTransaction);
    }
  }, [isOpen, mode, prefilledTransaction]);

  // Auto-load transaction if prefilled (return mode)
  useEffect(() => {
    if (isOpen && mode === 'return' && prefilledTransactionId && !transaction) {
      loadTransactionByIdDirect(prefilledTransactionId);
    }
  }, [isOpen, prefilledTransactionId]);

  useEffect(() => {
    if (isOpen && currentStep === 'lookup') {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
    if (isOpen && currentStep === 'exchange-scan') {
      setTimeout(() => {
        if (scanMode === 'barcode') exchangeScanRef.current?.focus();
        else exchangeSearchRef.current?.focus();
      }, 100);
    }
  }, [isOpen, currentStep, scanMode]);

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
        setLoading(false);
        return;
      }

      if (data.status === 'voided') {
        setError('This transaction has been voided and cannot be returned.');
        setLoading(false);
        return;
      }

      if (data.status === 'refunded') {
        setError('This transaction has already been refunded and cannot be returned.');
        setLoading(false);
        return;
      }

      if (data.status === 'returned') {
        setError('This transaction has already been fully returned.');
        setLoading(false);
        return;
      }

      if (data.status !== 'completed' && data.status !== 'partial_return') {
        setError(`This transaction cannot be returned (status: ${data.status})`);
        setLoading(false);
        return;
      }

      setTransaction(data);
      initializeReturnItems(data);
      setCurrentStep('mode-select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error looking up invoice');
    } finally {
      setLoading(false);
    }
  };

  const lookupInvoice = async () => {
    const input = invoiceInput.trim();
    if (!input) {
      setError('Please enter invoice number or scan barcode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isUUID = input.length === 36 && input.includes('-') && !input.startsWith('INV-');
      if (isUUID) {
        setError('Error: Please scan the invoice barcode, not the transaction UUID');
        setLoading(false);
        return;
      }

      const normalizedInvoice = input.startsWith('INV-')
        ? input
        : 'INV-' + input.padStart(5, '0');

      const { data, error } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('invoice_number', normalizedInvoice)
        .maybeSingle();

      if (!data) {
        setError(`Invoice ${normalizedInvoice} not found`);
        setLoading(false);
        return;
      }

      if (data.status === 'voided') {
        setError('This transaction has been voided');
        setLoading(false);
        return;
      }

      if (data.status === 'refunded') {
        setError('This transaction has already been refunded');
        setLoading(false);
        return;
      }

      if (data.status === 'returned') {
        setError('This transaction has already been returned');
        setLoading(false);
        return;
      }

      if (data.status !== 'completed' && data.status !== 'partial_return') {
        setError(`This transaction cannot be returned (status: ${data.status})`);
        setLoading(false);
        return;
      }

      setTransaction(data);
      initializeReturnItems(data);
      setCurrentStep('mode-select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error looking up invoice');
    } finally {
      setLoading(false);
    }
  };

  const initializeReturnItems = (tx: Transaction) => {
    const items = Array.isArray(tx.items) ? tx.items : [];
    const alreadyRefunded = Array.isArray(tx.refunded_items) ? tx.refunded_items : [];

    const returnedQtyMap = new Map<string, number>();
    alreadyRefunded.forEach((r: any) => {
      const key = String(r.id);
      returnedQtyMap.set(key, (returnedQtyMap.get(key) || 0) + (r.returnQuantity || r.quantity || 1));
    });

    const items2: ReturnItem[] = items
      .map((item, idx) => {
        const key = `${item.id || idx}`;
        const alreadyQty = returnedQtyMap.get(key) || 0;
        const availableQty = Math.max(0, (item.quantity || 1) - alreadyQty);
        return {
          id: key,
          name: item.name || 'Unknown Item',
          size: item.size,
          originalQuantity: availableQty,
          returnQuantity: 0,
          pricePerUnit: item.price || 0,
          variantId: item.variantId,
        };
      })
      .filter(item => item.originalQuantity > 0);

    setReturnItems(items2);
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

  const getSelectedItems = (): ReturnItem[] => {
    if (mode === 'refund' && transaction) {
      return (Array.isArray(transaction.items) ? transaction.items : []).map((item: any, idx: number) => ({
        id: `${item.id || idx}`,
        name: item.name || 'Unknown Item',
        size: item.size,
        originalQuantity: item.quantity || 1,
        returnQuantity: item.quantity || 1,
        pricePerUnit: item.price || 0,
        variantId: item.variantId,
      }));
    }
    return returnItems.filter(item => item.returnQuantity > 0);
  };

  const calculateReturnAmount = () => {
    if (!transaction) return { subtotal: 0, tax: 0, total: 0 };

    if (mode === 'refund') {
      const subtotal = transaction.subtotal ?? transaction.total_amount / 1.13;
      const tax = transaction.hst ?? (transaction.total_amount - subtotal);
      return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(transaction.total_amount.toFixed(2)),
      };
    }

    const selectedItems = getSelectedItems();
    let subtotal = 0;
    selectedItems.forEach(item => {
      subtotal += item.pricePerUnit * item.returnQuantity;
    });

    const originalSubtotal = transaction.subtotal || transaction.total_amount / 1.13;
    const originalTax = transaction.hst || transaction.total_amount - originalSubtotal;
    const taxRate = originalSubtotal > 0 ? originalTax / originalSubtotal : 0.13;
    const tax = transaction.isTaxExempt ? 0 : subtotal * taxRate;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat((subtotal + tax).toFixed(2)),
    };
  };

  const handleRefundMethodSelect = (method: 'store-credit' | 'original-payment') => {
    setRefundMethod(method);
    if (method === 'original-payment') {
      setRefundPaymentMethod(null);
      setCurrentStep('choose-payment-type');
    } else {
      setCurrentStep('confirm');
    }
  };

  // EXCHANGE: look up replacement item by barcode
  const lookupExchangeVariant = async () => {
    const barcode = exchangeScanInput.trim();
    if (!barcode) return;

    setExchangeSearching(true);
    setExchangeError(null);

    try {
      const { data: exact } = await supabase
        .from('product_variants')
        .select('*, products(*)')
        .eq('barcode', barcode)
        .maybeSingle();

      let variantData = exact;
      if (!variantData) {
        const { data: fuzzy } = await supabase
          .from('product_variants')
          .select('*, products(*)')
          .ilike('barcode', barcode)
          .maybeSingle();
        variantData = fuzzy;
      }

      if (!variantData) {
        setExchangeError(`No product found for barcode: ${barcode}`);
        return;
      }

      setExchangeToVariant(variantData);

      if (exchangeFromItem) {
        const newPrice = variantData.products?.price || 0;
        const oldPrice = exchangeFromItem.pricePerUnit;
        const taxMult = transaction?.isTaxExempt ? 1 : 1.13;
        const diff = parseFloat(((newPrice - oldPrice) * taxMult).toFixed(2));
        setExchangePriceDiff(diff);
      }

      setCurrentStep('exchange-confirm');
    } catch (err) {
      setExchangeError(err instanceof Error ? err.message : 'Error looking up item');
    } finally {
      setExchangeSearching(false);
    }
  };

  // EXCHANGE: search products by name or product code
  const searchProducts = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, product_code, product_variants(id, size, color, stock_quantity, barcode)')
        .or(`name.ilike.%${query}%,product_code.ilike.%${query}%`)
        .limit(8);
      setSearchResults(data || []);
    } catch {
      // silently ignore search errors
    }
  };

  // EXCHANGE: select replacement from search results
  const selectReplacementProduct = (product: any, variant: any) => {
    const variantObj = {
      id: variant.id,
      size: variant.size,
      color: variant.color,
      stock_quantity: variant.stock_quantity,
      barcode: variant.barcode,
      products: {
        id: product.id,
        name: product.name,
        price: product.price,
      },
    };
    setExchangeToVariant(variantObj);

    if (exchangeFromItem) {
      const newPrice = product.price || 0;
      const oldPrice = exchangeFromItem.pricePerUnit;
      const taxMult = transaction?.isTaxExempt ? 1 : 1.13;
      const diff = parseFloat(((newPrice - oldPrice) * taxMult).toFixed(2));
      setExchangePriceDiff(diff);
    }

    setCurrentStep('exchange-confirm');
  };

  // EXCHANGE: complete the exchange
  const handleCompleteExchange = async () => {
    if (!transaction || !exchangeFromItem || !exchangeToVariant) return;

    setProcessing(true);
    setError(null);

    try {
      // 1. Restore old item inventory
      if (exchangeFromItem.variantId) {
        const { data: oldVariant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', exchangeFromItem.variantId)
          .single();
        if (oldVariant) {
          await supabase.from('product_variants')
            .update({ stock_quantity: (oldVariant.stock_quantity || 0) + 1 })
            .eq('id', exchangeFromItem.variantId);
        }
      }

      // 2. Reduce new item inventory
      const { data: newVariantRow } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', exchangeToVariant.id)
        .single();
      if (newVariantRow) {
        await supabase.from('product_variants')
          .update({ stock_quantity: Math.max(0, (newVariantRow.stock_quantity || 0) - 1) })
          .eq('id', exchangeToVariant.id);
      }

      // 3. Update original transaction status
      const existingRefunded = Array.isArray(transaction.refunded_items) ? transaction.refunded_items : [];
      const exchangedEntry = { ...exchangeFromItem, returnQuantity: 1, exchanged: true };
      const newRefundedItems = [...existingRefunded, exchangedEntry];

      const allOriginalItems = Array.isArray(transaction.items) ? transaction.items : [];
      const totalOriginalQty = allOriginalItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      const newReturnedQty = newRefundedItems.reduce((sum: number, r: any) => sum + (r.returnQuantity || 1), 0);
      const isFullExchange = newReturnedQty >= totalOriginalQty;

      await supabase.from('transactions').update({
        status: isFullExchange ? 'returned' : 'partial_return',
        refunded_items: newRefundedItems,
        refunded_at: new Date().toISOString(),
      }).eq('id', transaction.id);

      // 4. Insert returns record
      await supabase.from('returns').insert({
        transaction_id: transaction.id,
        customer_id: transaction.customer_id,
        refund_method: 'exchange',
        items: [{ ...exchangeFromItem, returnQuantity: 1 }],
        refund_amount: exchangePriceDiff,
        status: 'completed',
        created_at: new Date().toISOString(),
      });

      // 5. Record exchange transaction in history
      const newProduct = exchangeToVariant.products;
      await supabase.from('transactions').insert({
        method: 'Exchange',
        payment_method: 'Exchange',
        total_amount: exchangePriceDiff,
        customer_id: transaction.customer_id,
        items: [{
          name: newProduct?.name || 'Unknown',
          size: exchangeToVariant.size,
          quantity: 1,
          price: newProduct?.price || 0,
          variantId: exchangeToVariant.id,
        }],
        invoice_number: 'EXC-' + transaction.id.slice(0, 8),
        status: 'completed',
        created_at: new Date().toISOString(),
      });

      setCompletionData({
        type: 'exchange',
        fromItem: exchangeFromItem,
        toItem: {
          name: newProduct?.name || 'Unknown',
          size: exchangeToVariant.size,
          price: newProduct?.price || 0,
        },
        priceDiff: exchangePriceDiff,
      });

      setCurrentStep('exchange-complete');
      generateExchangeReceipt();
      if (onComplete) setTimeout(onComplete, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing exchange');
    } finally {
      setProcessing(false);
    }
  };

  const generateExchangeReceipt = () => {
    if (!transaction || !exchangeFromItem || !exchangeToVariant) return;

    const newProduct = exchangeToVariant.products;
    const customerName = transaction.customers
      ? `${transaction.customers.first_name} ${transaction.customers.last_name}`
      : 'Walk-in';

    const receiptData: any = {
      transactionId: transaction.id,
      invoiceNumber: 'EXC-' + transaction.id.slice(0, 8),
      barcodeValue: transaction.invoice_number,
      customerName,
      items: [
        {
          name: `${exchangeFromItem.name} (Returned)`,
          quantity: 1,
          price: -exchangeFromItem.pricePerUnit,
          size: exchangeFromItem.size,
        },
        {
          name: `${newProduct?.name || 'New Item'} (Exchange)`,
          quantity: 1,
          price: newProduct?.price || 0,
          size: exchangeToVariant.size,
        },
      ],
      subtotal: parseFloat((exchangePriceDiff / 1.13).toFixed(2)),
      hst: parseFloat((exchangePriceDiff - exchangePriceDiff / 1.13).toFixed(2)),
      total: exchangePriceDiff,
      paymentMethod:
        exchangePriceDiff > 0
          ? 'Exchange (Difference Owed)'
          : exchangePriceDiff < 0
          ? 'Exchange (Difference Refunded)'
          : 'Even Exchange',
      createdAt: new Date(),
      status: 'exchange',
    };

    printInIframe(generateThermalReceiptHTML(receiptData));
  };

  const handleCompleteReturn = async () => {
    if (!transaction || refundMethod === null) return;

    setProcessing(true);
    setError(null);

    try {
      let issuedSCCardNumber: string | null = null;
      const amounts = calculateReturnAmount();

      // REFUND MODE: full amount, no inventory restore, no returns record
      if (mode === 'refund') {
        const { error: statusErr } = await supabase
          .from('transactions')
          .update({ status: 'refunded' })
          .eq('id', transaction.id);
        if (statusErr) throw statusErr;

        if (refundMethod === 'store-credit') {
          const { data: scData, error: scError } = await supabase
            .from('store_credits')
            .insert([{
              customer_id: transaction.customer_id || null,
              amount: amounts.total,
              remaining_balance: amounts.total,
              reason: 'Refund',
              is_active: true,
              card_number: 'SC-' + Math.random().toString(36).substr(2, 12).toUpperCase(),
            }])
            .select()
            .single();
          if (scError) throw new Error('Failed to create store credit');

          issuedSCCardNumber = scData.card_number;
          setIssuedStoreCreditCardNumber(scData.card_number);
          setCompletionData({ type: 'store-credit', amount: amounts.total, cardNumber: scData.card_number });
        } else {
          setCompletionData({ type: 'refund', amount: amounts.total, method: refundPaymentMethod || transaction.method });
        }

        const rtnMethod = refundMethod === 'store-credit' ? 'Store Credit' : (refundPaymentMethod || transaction.method);
        await supabase.from('transactions').insert({
          method: rtnMethod,
          payment_method: rtnMethod,
          total_amount: -amounts.total,
          customer_id: transaction.customer_id,
          items: Array.isArray(transaction.items) ? transaction.items : [],
          invoice_number: 'RTN-' + transaction.id.slice(0, 8),
          status: 'completed',
          created_at: new Date().toISOString(),
        });
        await supabase.from('transactions').update({
          refund_amount: amounts.total,
          refunded_items: Array.isArray(transaction.items) ? transaction.items : [],
          refunded_at: new Date().toISOString(),
        }).eq('id', transaction.id);

        setCurrentStep('complete');
        generateReturnReceipt(issuedSCCardNumber || undefined, true);
        setTimeout(() => { if (onComplete) onComplete(); }, 1500);
        return;
      }

      // RETURN MODE below:
      const selectedItems = getSelectedItems();
      if (selectedItems.length === 0) {
        setError('No items selected for return');
        setProcessing(false);
        return;
      }

      const allOriginalItems = Array.isArray(transaction.items) ? transaction.items : [];
      const totalOriginalQty = allOriginalItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      const existingRefunded = Array.isArray(transaction.refunded_items) ? transaction.refunded_items : [];
      const existingRefundedQty = existingRefunded.reduce((sum: number, r: any) => sum + (r.returnQuantity || r.quantity || 1), 0);
      const newReturnedQty = selectedItems.reduce((sum, item) => sum + item.returnQuantity, 0);
      const isFullReturn = (existingRefundedQty + newReturnedQty) >= totalOriginalQty;
      const newTransactionStatus = isFullReturn ? 'returned' : 'partial_return';
      const newRefundedItems = [...existingRefunded, ...selectedItems];

      // 1. Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          transaction_id: transaction.id,
          customer_id: transaction.customer_id,
          refund_method: refundMethod === 'store-credit' ? 'store_credit' : 'original_payment',
          refund_payment_method: refundMethod === 'original-payment' ? refundPaymentMethod : null,
          items: selectedItems,
          refund_amount: amounts.total,
          status: 'completed',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (returnError) {
        console.error('ERROR [Returns] Error creating return record:', returnError);
        throw returnError;
      }

      // Update transaction status
      const { error: statusError } = await supabase
        .from('transactions')
        .update({ status: newTransactionStatus })
        .eq('id', transaction.id);
      if (statusError) console.error('ERROR: [Returns] Error updating status:', statusError);

      await supabase.from('transactions').update({
        refund_amount: (transaction.refund_amount || 0) + amounts.total,
        refunded_items: newRefundedItems,
        refunded_at: new Date().toISOString(),
      }).eq('id', transaction.id);

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
        const { data: scData, error: scError } = await supabase
          .from('store_credits')
          .insert([{
            customer_id: transaction.customer_id,
            amount: amounts.total,
            remaining_balance: amounts.total,
            reason: 'Product Return',
            is_active: true,
            card_number: 'SC-' + Math.random().toString(36).substr(2, 12).toUpperCase(),
          }])
          .select()
          .single();

        if (scError) {
          console.error('ERROR [Returns] Error creating store credit:', scError);
          throw new Error('Failed to create store credit');
        }

        const { error: updateReturnError } = await supabase
          .from('returns')
          .update({ store_credit_id: scData.id })
          .eq('id', returnRecord.id);

        if (updateReturnError) {
          console.error('ERROR: [Returns] Error updating return with store_credit_id:', updateReturnError);
        }

        issuedSCCardNumber = scData.card_number;
        setIssuedStoreCreditCardNumber(scData.card_number);

        await supabase.from('transactions').insert({
          method: 'Store Credit',
          payment_method: 'Store Credit',
          total_amount: -amounts.total,
          customer_id: transaction.customer_id,
          items: selectedItems,
          invoice_number: 'RTN-' + transaction.id.slice(0, 8),
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        setCompletionData({
          type: 'store-credit',
          returnId: returnRecord.id,
          amount: amounts.total,
          creditId: scData.id,
          cardNumber: scData.card_number,
        });
      } else {
        await supabase.from('transactions').insert({
          method: refundPaymentMethod || transaction.method,
          payment_method: refundPaymentMethod || transaction.method,
          total_amount: -amounts.total,
          customer_id: transaction.customer_id,
          items: selectedItems,
          invoice_number: 'RTN-' + transaction.id.slice(0, 8),
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        if (transaction.method === 'Gift Card') {
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
                .update({ current_balance: newBalance, is_active: newBalance > 0 })
                .eq('id', gc.id);
            }
          }
        }

        setCompletionData({
          type: 'refund',
          returnId: returnRecord.id,
          amount: amounts.total,
          method: refundPaymentMethod || transaction.method,
        });
      }

      setCurrentStep('complete');
      generateReturnReceipt(issuedSCCardNumber || undefined);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('ERROR [Returns] ERROR:', errorMsg);
      setError(err instanceof Error ? err.message : 'Error processing return');
    } finally {
      setProcessing(false);
    }
  };

  const generateReturnReceipt = (scCardNumber?: string, isRefund = false) => {
    if (!transaction) return;

    const selectedItems = getSelectedItems();
    const amounts = calculateReturnAmount();
    const customerName = transaction.customers
      ? `${transaction.customers.first_name} ${transaction.customers.last_name}`
      : 'Walk-in';

    const label = isRefund ? 'Refund' : 'Return';
    const returnReceiptData: any = {
      transactionId: transaction.id,
      invoiceNumber: transaction.invoice_number,
      barcodeValue: transaction.invoice_number,
      customerName,
      items: selectedItems.map(item => ({
        name: `${item.name} (${label})`,
        quantity: item.returnQuantity,
        price: item.pricePerUnit,
        size: item.size,
      })),
      subtotal: amounts.subtotal,
      hst: amounts.tax,
      total: amounts.total,
      paymentMethod: refundMethod === 'store-credit'
        ? `Store Credit (${label})`
        : `${refundPaymentMethod || transaction.method} - ${label.toUpperCase()}`,
      createdAt: new Date(),
      status: isRefund ? 'refund' : 'return',
    };

    const returnHtml = generateThermalReceiptHTML(returnReceiptData);
    printInIframe(returnHtml);

    if (refundMethod === 'store-credit' && scCardNumber) {
      setTimeout(() => {
        const scReceiptData: any = {
          customerName,
          storeCreditCardNumber: scCardNumber,
          storeCreditAmount: amounts.total,
          storeCreditBalance: amounts.total,
          storeCreditReason: 'Product Return',
          transactionId: transaction.id,
          invoiceNumber: undefined,
          createdAt: new Date(),
        };
        printInIframe(generateStoreCreditReceiptHTML(scReceiptData));
      }, 1500);
    }
  };

  const printInIframe = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = function () {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    };
  };

  const handleReset = () => {
    setCurrentStep(mode === 'refund' ? 'choose-refund' : (prefilledTransactionId ? 'mode-select' : 'lookup'));
    setInvoiceInput(prefilledTransactionId || '');
    setTransaction(null);
    setReturnItems([]);
    setRefundMethod(null);
    setRefundPaymentMethod(null);
    setError(null);
    setCompletionData(null);
    setIssuedStoreCreditCardNumber(null);
    setExchangeFromItem(null);
    setExchangeScanInput('');
    setExchangeToVariant(null);
    setExchangeError(null);
    setExchangePriceDiff(0);
    setScanMode('barcode');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  const amounts = calculateReturnAmount();
  const selectedItemsCount = getSelectedItems().length;

  const headerSubtitle = (() => {
    switch (currentStep) {
      case 'lookup': return 'Find the original invoice';
      case 'mode-select': return 'Return or exchange?';
      case 'select-items': return 'Select items to return';
      case 'choose-refund': return 'Choose refund method';
      case 'choose-payment-type': return 'How will refund be given?';
      case 'confirm': return 'Review and confirm';
      case 'complete': return mode === 'refund' ? 'Refund processed' : 'Return processed';
      case 'exchange-select': return 'Select item to exchange';
      case 'exchange-scan': return 'Scan replacement item';
      case 'exchange-confirm': return 'Review exchange';
      case 'exchange-complete': return 'Exchange complete';
    }
  })();

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
                <h2 className="font-bold text-lg">{mode === 'refund' ? 'Process Refund' : 'Process Return / Exchange'}</h2>
                <p className="text-sm opacity-90">{headerSubtitle}</p>
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
                  Tip: You can scan the invoice barcode from the receipt or enter the transaction ID
                </div>
              </div>
            )}

            {/* MODE SELECTOR */}
            {currentStep === 'mode-select' && transaction && (
              <div className="space-y-4">
                {/* Transaction summary */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Invoice #</p>
                      <p className="font-mono font-bold text-gray-900">{transaction.invoice_number || transaction.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-bold text-gray-900">{new Date(transaction.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Payment</p>
                      <p className="font-bold text-gray-900">{transaction.method}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-bold text-gray-900">${transaction.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  {transaction.customers && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                      <p className="text-gray-500">Customer</p>
                      <p className="font-bold text-gray-900">
                        {transaction.customers.first_name} {transaction.customers.last_name}
                      </p>
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-gray-800 text-center mt-2">What would you like to do?</h3>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setCurrentStep('select-items')}
                    className="flex flex-col items-center gap-2 border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <span className="text-3xl">↩️</span>
                    <span className="font-bold text-gray-900">Return Items</span>
                    <span className="text-xs text-gray-400 text-center">Refund to customer</span>
                  </button>

                  <button
                    onClick={() => setCurrentStep('exchange-select')}
                    className="flex flex-col items-center gap-2 border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 hover:bg-purple-50 transition"
                  >
                    <span className="text-3xl">↔️</span>
                    <span className="font-bold text-gray-900">Exchange Item</span>
                    <span className="text-xs text-gray-400 text-center">Swap for different item</span>
                  </button>
                </div>
              </div>
            )}

            {/* RETURN: STEP 2: SELECT ITEMS */}
            {currentStep === 'select-items' && transaction && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Invoice #</p>
                      <p className="font-mono font-bold text-gray-900">{transaction.invoice_number || transaction.id.slice(0, 8)}</p>
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

            {/* RETURN: STEP 3: CHOOSE REFUND METHOD */}
            {currentStep === 'choose-refund' && transaction && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">How would you like to process this {mode === 'refund' ? 'refund' : 'return'}?</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleRefundMethodSelect('store-credit')}
                      className="w-full p-4 rounded-lg border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Issue Store Credit</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {transaction.customer_id
                              ? `Issue $${amounts.total.toFixed(2)} store credit to customer account`
                              : `Issue $${amounts.total.toFixed(2)} store credit — note the SC card number`}
                          </p>
                        </div>
                        <ChevronRight className="text-blue-600" size={20} />
                      </div>
                    </button>

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

            {/* RETURN: STEP 3b: CHOOSE PAYMENT TYPE */}
            {currentStep === 'choose-payment-type' && transaction && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">How will the refund be given?</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Refunding <span className="font-bold text-gray-800">${amounts.total.toFixed(2)}</span> — select the payment method used to return money to the customer.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {['Cash', 'Visa', 'Mastercard', 'Debit', 'Amex'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setRefundPaymentMethod(method)}
                        className={`py-4 px-3 rounded-lg border-2 font-semibold transition text-center text-sm ${
                          refundPaymentMethod === method
                            ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                            : 'border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-700'
                        }`}
                      >
                        {refundPaymentMethod === method && <span className="block text-green-500 text-xs mb-1">✓</span>}
                        {method}
                      </button>
                    ))}
                  </div>
                  {!refundPaymentMethod && (
                    <p className="text-xs text-gray-400 mt-3 text-center">Select a payment method to continue</p>
                  )}
                </div>
              </div>
            )}

            {/* RETURN: STEP 4: CONFIRMATION */}
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
                          : `${refundPaymentMethod} Refund`}
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

            {/* EXCHANGE: STEP 1 — SELECT ITEM */}
            {currentStep === 'exchange-select' && transaction && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Select the item the customer is bringing back:</p>
                <div className="space-y-3">
                  {returnItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setExchangeFromItem({ ...item, returnQuantity: 1 });
                        setExchangeScanInput('');
                        setExchangeToVariant(null);
                        setExchangeError(null);
                        setCurrentStep('exchange-scan');
                      }}
                      className={`w-full p-4 border-2 rounded-lg text-left transition hover:border-purple-400 hover:bg-purple-50 ${
                        exchangeFromItem?.id === item.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          {item.size && <p className="text-sm text-gray-600">Size: {item.size}</p>}
                          <p className="text-sm text-gray-500 mt-1">${item.pricePerUnit.toFixed(2)} + tax</p>
                        </div>
                        <ChevronRight className="text-purple-400" size={20} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EXCHANGE: STEP 2 — SCAN / SEARCH NEW ITEM */}
            {currentStep === 'exchange-scan' && exchangeFromItem && (
              <div className="space-y-4">
                {/* Returning item pill */}
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                  <p className="text-purple-700 font-semibold">Returning:</p>
                  <p className="text-purple-900 font-bold">
                    {exchangeFromItem.name}{exchangeFromItem.size ? ` — Size ${exchangeFromItem.size}` : ''}
                  </p>
                  <p className="text-purple-600">${exchangeFromItem.pricePerUnit.toFixed(2)} + tax</p>
                </div>

                {/* Mode toggle */}
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => { setScanMode('barcode'); setExchangeError(null); }}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      scanMode === 'barcode' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    📷 Scan Barcode
                  </button>
                  <button
                    onClick={() => { setScanMode('search'); setExchangeError(null); }}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      scanMode === 'search' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    🔍 Search Product
                  </button>
                </div>

                {/* BARCODE mode */}
                {scanMode === 'barcode' && (
                  <div className="flex gap-2">
                    <input
                      ref={exchangeScanRef}
                      type="text"
                      value={exchangeScanInput}
                      onChange={(e) => setExchangeScanInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && lookupExchangeVariant()}
                      placeholder="Scan replacement item barcode"
                      className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <button
                      onClick={lookupExchangeVariant}
                      disabled={exchangeSearching}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-semibold"
                    >
                      {exchangeSearching ? 'Looking up...' : 'Look Up'}
                    </button>
                  </div>
                )}

                {/* SEARCH mode */}
                {scanMode === 'search' && (
                  <div>
                    <input
                      ref={exchangeSearchRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        searchProducts(e.target.value);
                      }}
                      placeholder="Search by name or product code..."
                      className="w-full px-4 py-3 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-purple-500 text-sm"
                    />

                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        {searchResults.map((product: any) => {
                          const inStockVariants = (product.product_variants || []).filter(
                            (v: any) => v.stock_quantity > 0
                          );
                          if (inStockVariants.length === 0) return null;
                          return inStockVariants.map((variant: any) => (
                            <button
                              key={variant.id}
                              onClick={() => selectReplacementProduct(product, variant)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 border-b border-gray-100 last:border-b-0 text-left transition"
                            >
                              <div>
                                <p className="font-medium text-sm text-zinc-900">{product.name}</p>
                                <p className="text-xs text-zinc-400">
                                  Size: {variant.size}{variant.color ? ` · ${variant.color}` : ''} · Stock: {variant.stock_quantity}
                                </p>
                              </div>
                              <span className="font-bold text-zinc-900 ml-4 flex-shrink-0">
                                ${Number(product.price).toFixed(2)}
                              </span>
                            </button>
                          ));
                        })}
                      </div>
                    )}

                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="mt-2 text-sm text-zinc-400 text-center">No products found</p>
                    )}
                  </div>
                )}

                {exchangeError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    {exchangeError}
                  </div>
                )}
              </div>
            )}

            {/* EXCHANGE: STEP 3 — CONFIRM */}
            {currentStep === 'exchange-confirm' && exchangeFromItem && exchangeToVariant && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <h3 className="font-semibold text-gray-900">Exchange Summary</h3>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Returning</p>
                      <p className="font-bold text-gray-900">{exchangeFromItem.name}</p>
                      {exchangeFromItem.size && <p className="text-gray-600">Size: {exchangeFromItem.size}</p>}
                      <p className="text-gray-700 font-semibold mt-1">${(exchangeFromItem.pricePerUnit * 1.13).toFixed(2)}</p>
                    </div>

                    <ArrowLeftRight size={20} className="text-gray-400 flex-shrink-0" />

                    <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Exchanging For</p>
                      <p className="font-bold text-gray-900">{exchangeToVariant.products?.name || 'Unknown'}</p>
                      {exchangeToVariant.size && <p className="text-gray-600">Size: {exchangeToVariant.size}</p>}
                      <p className="text-gray-700 font-semibold mt-1">
                        ${((exchangeToVariant.products?.price || 0) * 1.13).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    {exchangePriceDiff === 0 && (
                      <p className="text-center font-bold text-green-700 text-lg">✓ Even Exchange — no payment needed</p>
                    )}
                    {exchangePriceDiff > 0 && (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Price difference — collect from customer:</p>
                        <p className="font-bold text-red-600 text-2xl mt-1">+${exchangePriceDiff.toFixed(2)}</p>
                      </div>
                    )}
                    {exchangePriceDiff < 0 && (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Price difference — refund to customer:</p>
                        <p className="font-bold text-blue-600 text-2xl mt-1">${Math.abs(exchangePriceDiff).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {exchangeToVariant.stock_quantity !== undefined && exchangeToVariant.stock_quantity < 1 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>Warning: replacement item shows 0 stock in inventory</span>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* EXCHANGE: STEP 4 — COMPLETE */}
            {currentStep === 'exchange-complete' && completionData?.type === 'exchange' && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-6">
                    <Check size={48} className="text-green-600" />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Exchange Complete</h3>
                  <p className="text-gray-600 mt-2">
                    {completionData.fromItem.name} → {completionData.toItem.name}
                    {completionData.toItem.size ? ` (Size ${completionData.toItem.size})` : ''}
                  </p>
                  {completionData.priceDiff !== 0 && (
                    <p className={`mt-2 font-bold text-lg ${completionData.priceDiff > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {completionData.priceDiff > 0
                        ? `Collected $${completionData.priceDiff.toFixed(2)} from customer`
                        : `Refunded $${Math.abs(completionData.priceDiff).toFixed(2)} to customer`}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-sm text-gray-900">
                  <p className="font-semibold mb-2">What to do next:</p>
                  <ul className="text-left space-y-1">
                    <li>✓ Exchange receipt has been printed</li>
                    <li>✓ Inventory updated (old item restored, new item deducted)</li>
                    {completionData.priceDiff > 0 && <li>✓ Collect ${completionData.priceDiff.toFixed(2)} difference from customer</li>}
                    {completionData.priceDiff < 0 && <li>✓ Return ${Math.abs(completionData.priceDiff).toFixed(2)} difference to customer</li>}
                  </ul>
                </div>
              </div>
            )}

            {/* RETURN/REFUND: STEP 5 — COMPLETE */}
            {currentStep === 'complete' && completionData && completionData.type !== 'exchange' && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-6">
                    <Check size={48} className="text-green-600" />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{mode === 'refund' ? 'Refund Processed' : 'Return Processed'}</h3>
                  <p className="text-gray-600 mt-2">
                    {completionData.type === 'store-credit'
                      ? `Store credit of $${completionData.amount.toFixed(2)} has been issued`
                      : `Refund of $${completionData.amount.toFixed(2)} has been processed to ${completionData.method}`}
                  </p>
                  {completionData.type === 'store-credit' && completionData.cardNumber && (
                    <div className="mt-4 p-4 bg-blue-50 border-3 border-blue-500 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-2">STORE CREDIT CARD NUMBER</p>
                      <p className="text-2xl font-mono font-bold text-blue-700 text-center break-all">
                        {completionData.cardNumber}
                      </p>
                      <p className="text-xs text-gray-600 text-center mt-2">Card printed on receipt below</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-sm text-gray-900">
                  <p className="font-semibold mb-2">What to do next:</p>
                  <ul className="text-left space-y-1">
                    <li>✓ Receipt has been printed</li>
                    {mode === 'return' && <li>✓ Inventory has been restored</li>}
                    {completionData.type === 'store-credit' && (
                      <li>✓ {transaction?.customer_id ? 'Store credit linked to customer account' : 'Note the SC card number from the receipt'}</li>
                    )}
                    {completionData.type === 'refund' && (
                      <li>✓ {mode === 'refund' ? 'Refund recorded' : "Refund will appear in customer's account within 1-2 business days"}</li>
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

            {currentStep === 'lookup' && <div />}

            {currentStep === 'mode-select' && (
              <button
                onClick={() => {
                  setTransaction(null);
                  setCurrentStep('lookup');
                }}
                className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                ← Back
              </button>
            )}

            {currentStep === 'select-items' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep('mode-select')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  ← Back
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

            {currentStep === 'choose-refund' && mode === 'return' && (
              <button
                onClick={() => setCurrentStep('select-items')}
                className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                ← Back
              </button>
            )}

            {currentStep === 'choose-payment-type' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep('choose-refund')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setCurrentStep('confirm')}
                  disabled={!refundPaymentMethod}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-semibold"
                >
                  Next: Review Return
                </button>
              </div>
            )}

            {currentStep === 'confirm' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep(refundMethod === 'original-payment' ? 'choose-payment-type' : 'choose-refund')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  ← Back
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
                onClick={mode === 'refund' ? handleClose : handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                {mode === 'refund' ? 'Done' : 'Process Another Return'}
              </button>
            )}

            {/* Exchange footer buttons */}
            {currentStep === 'exchange-select' && (
              <button
                onClick={() => setCurrentStep('mode-select')}
                className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                ← Back
              </button>
            )}

            {currentStep === 'exchange-scan' && (
              <button
                onClick={() => setCurrentStep('exchange-select')}
                className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                ← Back
              </button>
            )}

            {currentStep === 'exchange-confirm' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep('exchange-scan')}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleCompleteExchange}
                  disabled={processing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-semibold"
                >
                  {processing ? 'Processing...' : 'Complete Exchange'}
                </button>
              </div>
            )}

            {currentStep === 'exchange-complete' && (
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                Process Another
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
