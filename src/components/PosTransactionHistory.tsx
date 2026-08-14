import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Barcode from 'react-barcode';
import { useCustomers } from '../context/CustomerContext';
import { useSettings } from '../context/SettingsContext';
import { generateThermalReceiptHTML, generateGiftReceiptHTML } from '../utils/thermalReceipt';
import { generateInvoiceHTML, printInvoice, InvoiceCustomerInfo } from '../utils/invoice';
import { InvoiceCustomerModal } from './InvoiceCustomerModal';
import { ReturnsModal } from './ReturnsModal';
import { supabase } from '../supabase';
import {
  Search, ChevronDown, ChevronUp, Printer, FileText,
  RotateCcw, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Undo2, Gift, X,
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'completed' | 'voided' | 'refunded' | 'returned' | 'partial_return';

interface Transaction {
  id: string;
  invoice_number?: string;
  total_amount: number;
  method: string;
  status: string;
  items: any[];
  customer_id: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
}


interface PosTransactionHistoryProps {
  // Notifies the parent POS page to sync its local stock state (productVariants/productStockMap)
  // after this component writes a stock_quantity change directly to the DB.
  onStockChange?: (variantId: string, delta: number) => void;
}

export const PosTransactionHistory: React.FC<PosTransactionHistoryProps> = ({ onStockChange }) => {
  const { customers } = useCustomers();
  const { logo } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [returnsTransactionId, setReturnsTransactionId] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);

  // Gift receipt modal
  const [giftTx, setGiftTx] = useState<Transaction | null>(null);
  const [giftSelected, setGiftSelected] = useState<Set<number>>(new Set());

  // Invoice/Estimate modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'invoice' | 'estimate'>('invoice');
  const [invoiceTx, setInvoiceTx] = useState<Transaction | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
    } catch (e: any) {
      console.error('ERROR Transaction fetch error:', e.message, e);
      setErrorMsg(`Failed to load transactions: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach(c => map.set(c.id, `${c.first_name} ${c.last_name}`));
    return map;
  }, [customers]);

  const getCustomerName = (tx: Transaction) => {
    if (!tx.customer_id) return 'Walk-in';
    return customerMap.get(tx.customer_id) || 'Unknown';
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const result = transactions.filter(tx => {
      const d = new Date(tx.created_at);

      // Date filter
      if (dateFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (dateFilter === 'week') {
        const w = new Date(); w.setDate(w.getDate() - 7);
        if (d < w) return false;
      }
      if (dateFilter === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (dateFilter === 'year' && d.getFullYear() !== now.getFullYear()) return false;

      // Status filter - include all statuses including voided/refunded when 'all' is selected
      if (statusFilter !== 'all') {
        if (tx.status !== statusFilter) return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getCustomerName(tx).toLowerCase();
        const id = tx.id.toLowerCase();
        const invoiceNum = (tx.invoice_number || '').toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !invoiceNum.includes(q) && !tx.method?.toLowerCase().includes(q)) return false;
      }

      return true;
    });
    return result;
  }, [transactions, dateFilter, statusFilter, searchQuery, customerMap]);

  const isToday = (dateStr: string) =>
    new Date(dateStr).toDateString() === new Date().toDateString();

  const flash = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 3500); }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); }
  };

  const handleVoid = async (tx: Transaction) => {
    if (!confirm('Void this transaction?')) return;
    try {
      // Restore the full quantity of every item back to inventory
      if (tx.status === 'completed') {
        const items = tx.items || [];
        for (const item of items) {
          if (item.variantId) {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', item.variantId)
              .single();

            if (variant) {
              const newQty = (variant.stock_quantity || 0) + (item.quantity || 1);
              await supabase
                .from('product_variants')
                .update({ stock_quantity: newQty })
                .eq('id', item.variantId);
              onStockChange?.(item.variantId, item.quantity || 1);
            }
          }
        }
      }

      const { error } = await supabase
        .from('transactions')
        .update({ status: 'voided' })
        .eq('id', tx.id);

      if (error) throw error;
      flash('Transaction voided');
      await fetchTransactions();
    } catch (e: any) {
      console.error("Void error:", e.message);
      flash(e.message, true);
    }
  };

  const handleUnvoid = async (tx: Transaction) => {
    if (!confirm('Restore this transaction?')) return;
    try {
      // Mirror handleVoid: re-deduct the items that were restored to inventory on void
      const items = tx.items || [];
      for (const item of items) {
        if (item.variantId) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', item.variantId)
            .single();

          if (variant) {
            const newQty = Math.max(0, (variant.stock_quantity || 0) - (item.quantity || 1));
            await supabase
              .from('product_variants')
              .update({ stock_quantity: newQty })
              .eq('id', item.variantId);
            onStockChange?.(item.variantId, -(item.quantity || 1));
          }
        }
      }

      const { error } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id);

      if (error) throw error;
      flash('Transaction restored');
      await fetchTransactions();
    } catch (e: any) {
      console.error('Unvoid error:', e.message);
      flash(e.message, true);
    }
  };

  const handleRefundComplete = () => {
    setRefundTx(null);
    fetchTransactions();
  };

  const openReturnsModal = (txId: string) => {
    setReturnsTransactionId(txId);
    setShowReturnsModal(true);
  };

  const handleReturnsComplete = () => {
    setShowReturnsModal(false);
    fetchTransactions();
  };

  const handlePrint = (tx: Transaction) => {
    const customerName = getCustomerName(tx);

    // Calculate totals (assume 13% HST)
    const total = Math.abs(Number(tx.total_amount));
    const subtotal = total / 1.13;
    const hst = total - subtotal;

    const html = generateThermalReceiptHTML({
      transactionId: tx.id,
      invoiceNumber: tx.invoice_number,
      barcodeValue: tx.invoice_number || tx.id,
      customerName,
      items: (tx.items || []).map((item: any) => ({
        name: item.name || 'Item',
        quantity: item.quantity || 1,
        price: Number(item.price),
        size: item.size,
        ageGroup: item.ageGroup,
      })),
      subtotal,
      hst,
      total,
      paymentMethod: tx.method,
      createdAt: new Date(tx.created_at),
      status: tx.status,
      logoUrl: logo,
    });

    const win = window.open('', '_blank', 'width=300,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = function() {
      setTimeout(() => {
        win.focus();
        win.print();
        win.onafterprint = function() { win.close(); };
      }, 500);
    };
  };

  // Reprint receipt from transaction data (copies: 1 = customer only, 2 = customer + merchant)
  const handleReprint = async (txId: string, copies: 1 | 2 = 1) => {
    try {
      const { data: fullTx, error } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('id', txId)
        .single();

      if (error || !fullTx) {
        flash('Could not fetch transaction details', true);
        return;
      }

      const customerName = fullTx.customers
        ? `${fullTx.customers.first_name} ${fullTx.customers.last_name}`
        : 'Walk-in';

      const total = Math.abs(Number(fullTx.total_amount));
      const subtotal = total / 1.13;
      const hst = total - subtotal;

      const html = generateThermalReceiptHTML({
        transactionId: fullTx.id,
        invoiceNumber: fullTx.invoice_number,
        barcodeValue: fullTx.invoice_number || fullTx.id,
        customerName,
        items: (fullTx.items || []).map((item: any) => ({
          name: item.name || 'Item',
          quantity: item.quantity || 1,
          price: Number(item.price),
          size: item.size,
          ageGroup: item.ageGroup,
        })),
        subtotal,
        hst,
        total,
        paymentMethod: fullTx.method,
        createdAt: new Date(fullTx.created_at),
        status: fullTx.status,
        logoUrl: logo,
        isReprint: true,
        copies,
      });

      const win = window.open('', '_blank', 'width=300,height=600');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.onload = function() {
        setTimeout(() => {
          win.focus();
          win.print();
          win.onafterprint = function() { win.close(); };
        }, 500);
      };
    } catch (e: any) {
      console.error('Reprint error:', e);
      flash('Error reprinting receipt', true);
    }
  };

  const openGiftReceiptModal = (tx: Transaction) => {
    setGiftTx(tx);
    setGiftSelected(new Set((tx.items || []).map((_, i) => i)));
  };

  const handlePrintGiftReceipt = () => {
    if (!giftTx) return;
    const allItems = (giftTx.items || []).map((item: any) => ({
      name: item.name || 'Item',
      quantity: item.quantity || 1,
      price: Number(item.price),
      size: item.size,
      ageGroup: item.ageGroup,
    }));
    const selectedItems = allItems.filter((_, i) => giftSelected.has(i));
    if (selectedItems.length === 0) return;

    const html = generateGiftReceiptHTML({
      transactionId: giftTx.id,
      invoiceNumber: giftTx.invoice_number,
      barcodeValue: giftTx.invoice_number || giftTx.id,
      customerName: getCustomerName(giftTx),
      items: selectedItems,
      createdAt: new Date(giftTx.created_at),
      logoUrl: logo,
    });

    const win = window.open('', '_blank', 'width=300,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = function() {
      setTimeout(() => {
        win.focus();
        win.print();
        win.onafterprint = function() { win.close(); };
      }, 500);
    };
    setGiftTx(null);
  };

  // Open invoice/estimate modal
  const openInvoiceModal = (tx: Transaction, type: 'invoice' | 'estimate') => {
    setInvoiceTx(tx);
    setInvoiceType(type);
    setShowInvoiceModal(true);
  };

  // Handle invoice/estimate print with customer info
  const handlePrintInvoice = (customerInfo: InvoiceCustomerInfo) => {
    if (!invoiceTx) return;

    const invoiceHtml = generateInvoiceHTML(
      {
        invoiceNumber: invoiceTx.invoice_number || 'INV-00000',
        items: (invoiceTx.items || []).map((item: any) => ({
          name: item.name || 'Item',
          quantity: item.quantity || 1,
          price: Number(item.price),
          size: item.size,
          color: item.color,
        })),
        subtotal: Math.abs(Number(invoiceTx.total_amount)) / 1.13,
        tax: Math.abs(Number(invoiceTx.total_amount)) - Math.abs(Number(invoiceTx.total_amount)) / 1.13,
        total: Math.abs(Number(invoiceTx.total_amount)),
        createdAt: new Date(invoiceTx.created_at),
        customerInfo,
        paymentMethod: invoiceTx.method,
        logoUrl: logo,
      },
      invoiceType
    );

    printInvoice(invoiceHtml);
    setShowInvoiceModal(false);
    setInvoiceTx(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-700',
      voided: 'bg-red-100 text-red-700',
      refunded: 'bg-amber-100 text-amber-700',
      returned: 'bg-blue-100 text-blue-700',
      partial_return: 'bg-purple-100 text-purple-700',
    };
    return `inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${map[status] || 'bg-zinc-100 text-zinc-600'}`;
  };

  const totalRevenue = useMemo(() =>
    filtered.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.total_amount), 0),
    [filtered]);

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Transaction History</h2>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">
              {filtered.length} transactions · Revenue: ${totalRevenue.toFixed(2)}
            </p>
          </div>
          <button onClick={fetchTransactions} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
            <RefreshCw size={15} className={`text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Flash messages */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-emerald-700 text-[11px] font-bold">
            <CheckCircle2 size={14} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-[11px] font-bold">
            <AlertTriangle size={14} /> {errorMsg}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Date */}
          <div className="flex gap-1">
            {(['today','week','month','year','all'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-colors ${dateFilter === f ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex gap-1">
            {(['all','completed','voided','refunded','returned','partial_return'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-colors ${statusFilter === s ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}>
                {s === 'partial_return' ? 'Partial' : s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by customer, ID, payment..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <p className="text-xs font-bold uppercase tracking-widest">No transactions found</p>
          </div>
        ) : filtered.map(tx => {
          const expanded = expandedId === tx.id;
          const customerName = getCustomerName(tx);
          const canVoid = tx.status === 'completed';
          const canRefund = tx.status === 'completed';
          const canReturn = tx.status === 'completed';

          return (
            <div key={tx.id} className={`bg-white rounded-xl border transition-all ${expanded ? 'border-zinc-300 shadow-md' : 'border-zinc-100 hover:border-zinc-200'}`}>
              {/* Row summary */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : tx.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-zinc-900">{tx.invoice_number || tx.id.slice(0,8).toUpperCase()}</span>
                    <span className={statusBadge(tx.status || 'completed')}>{tx.status || 'completed'}</span>
                    {tx.total_amount < 0 && <span className={statusBadge('refunded')}>REFUND</span>}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-900 mt-0.5 truncate">{customerName}</p>
                  <p className="text-[10px] text-zinc-400">{new Date(tx.created_at).toLocaleString()} · {tx.method}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${tx.total_amount < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                    ${Number(tx.total_amount).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-bold">{(tx.items || []).length} item(s)</p>
                </div>
                {expanded ? <ChevronUp size={14} className="text-zinc-400 shrink-0" /> : <ChevronDown size={14} className="text-zinc-400 shrink-0" />}
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="border-t border-zinc-100 p-4 space-y-4">
                  {/* Barcode */}
                  <div className="flex justify-center py-2 bg-zinc-50 rounded-lg">
                    <Barcode value={tx.invoice_number || tx.id} width={1.2} height={32} fontSize={9} />
                  </div>

                  {/* Invoice Number Display */}
                  <div className="p-2 bg-zinc-100 rounded-lg text-center">
                    <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Invoice</p>
                    <p className="text-[14px] font-mono font-black text-zinc-900">{tx.invoice_number || tx.id.slice(0,8).toUpperCase()}</p>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Items</p>
                    {(tx.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <div>
                          <p className="font-bold text-zinc-900">{item.name}</p>
                          {(item.size || item.ageGroup) && (
                            <p className="text-zinc-400">{item.ageGroup ? `${item.ageGroup} · ` : ''}Size {item.size}</p>
                          )}
                          <p className="text-zinc-400">Qty {item.quantity} × ${Number(item.price).toFixed(2)}</p>
                        </div>
                        <p className="font-black text-zinc-900">${(Number(item.price) * (item.quantity || 1)).toFixed(2)}</p>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-zinc-100 flex justify-between text-xs font-black text-zinc-900">
                      <span>Total</span>
                      <span>${Number(tx.total_amount).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => handleReprint(tx.id, 1)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-indigo-700 transition-colors"
                    >
                      <Printer size={12} /> Reprint 1x
                    </button>
                    <button
                      onClick={() => handleReprint(tx.id, 2)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-indigo-600 transition-colors"
                    >
                      <Printer size={12} /> Reprint 2x
                    </button>
                    <button
                      onClick={() => openGiftReceiptModal(tx)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-purple-700 transition-colors"
                    >
                      <Gift size={12} /> Gift Receipt
                    </button>
                    <button
                      onClick={() => openInvoiceModal(tx, 'invoice')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-cyan-700 transition-colors"
                    >
                      <FileText size={12} /> Invoice
                    </button>
                    <button
                      onClick={() => openInvoiceModal(tx, 'estimate')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-cyan-600 transition-colors"
                    >
                      <FileText size={12} /> Estimate
                    </button>
                    {canVoid && (
                      <button
                        onClick={() => handleVoid(tx)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-700 transition-colors"
                      >
                        <XCircle size={12} /> Void
                      </button>
                    )}
                    {canRefund && (
                      <button
                        onClick={() => setRefundTx(tx)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-amber-600 transition-colors"
                      >
                        <RotateCcw size={12} /> Refund
                      </button>
                    )}
                    {canReturn && (
                      <button
                        onClick={() => openReturnsModal(tx.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-colors"
                      >
                        <Undo2 size={12} /> Return
                      </button>
                    )}
                    {tx.status === 'voided' && (
                      <>
                        <span className="text-[10px] text-red-500 font-bold self-center">Voided</span>
                        <button
                          onClick={() => handleUnvoid(tx)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-colors"
                        >
                          <RefreshCw size={12} /> Unvoid
                        </button>
                      </>
                    )}
                    {tx.status === 'refunded' && (
                      <span className="text-[10px] text-amber-600 font-bold self-center">Already refunded</span>
                    )}
                    {tx.status === 'returned' && (
                      <span className="text-[10px] text-blue-600 font-bold self-center">Fully returned</span>
                    )}
                    {tx.status === 'partial_return' && (
                      <span className="text-[10px] text-purple-600 font-bold self-center">Partially returned</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Returns Modal */}
      {returnsTransactionId && (
        <ReturnsModal
          isOpen={showReturnsModal}
          onClose={() => setShowReturnsModal(false)}
          prefilledTransactionId={returnsTransactionId}
          prefilledCustomerId={transactions.find(t => t.id === returnsTransactionId)?.customer_id || undefined}
          onComplete={handleReturnsComplete}
        />
      )}

      {/* Refund Modal */}
      {refundTx && (
        <ReturnsModal
          mode="refund"
          isOpen={!!refundTx}
          onClose={handleRefundComplete}
          prefilledTransaction={refundTx as any}
          onComplete={handleRefundComplete}
        />
      )}

      {/* Gift Receipt Modal */}
      {giftTx && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Gift size={16} className="text-purple-600" /> Gift Receipt
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{giftTx.invoice_number || giftTx.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setGiftTx(null)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-zinc-500 mb-3 uppercase tracking-wide font-bold">Select items to include</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(giftTx.items || []).map((item: any, i: number) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      checked={giftSelected.has(i)}
                      onChange={() => {
                        const next = new Set(giftSelected);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        setGiftSelected(next);
                      }}
                      className="mt-0.5 accent-purple-600"
                    />
                    <div className="flex-1 text-[11px]">
                      <p className="font-bold text-zinc-900 leading-tight">{item.name || 'Item'}</p>
                      {(item.size || item.ageGroup) && (
                        <p className="text-zinc-500">{item.ageGroup ? `${item.ageGroup} · ` : ''}Size {item.size}</p>
                      )}
                      <p className="text-zinc-500">Qty {item.quantity || 1}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 flex gap-2">
              <button
                onClick={() => setGiftTx(null)}
                className="flex-1 border border-zinc-200 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintGiftReceipt}
                disabled={giftSelected.size === 0}
                className="flex-1 bg-purple-600 disabled:bg-zinc-300 text-white rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
              >
                <Printer size={13} /> Print Gift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice/Estimate Modal */}
      <InvoiceCustomerModal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoiceTx(null);
        }}
        onPrint={handlePrintInvoice}
        prefilledCustomerId={invoiceTx?.customer_id || ''}
        prefilledCustomer={invoiceTx?.customers || undefined}
        docType={invoiceType}
      />
    </div>
  );
};
