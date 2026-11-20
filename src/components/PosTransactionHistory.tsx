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
  RotateCcw, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Undo2, Gift, X, Eye,
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'completed' | 'voided' | 'refunded' | 'returned' | 'partial_return';

interface Transaction {
  id: string;
  invoice_number?: string;
  total_amount: number;
  method: string;
  payment_method?: string;
  status: string;
  items: any[];
  customer_id: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
  refund_amount?: number;
  refunded_items?: any[];
  refunded_at?: string;
  related_transaction_id?: string | null;
}


interface ReturnRecord {
  id: string;
  transaction_id: string;
  items: any[];
  refund_amount: number;
  refund_method: string;
  refund_payment_method?: string;
  store_credit_id?: string;
  created_at: string;
}

interface PosTransactionHistoryProps {
  // Notifies the parent POS page to sync its local stock state (productVariants/productStockMap)
  // after this component writes a stock_quantity change directly to the DB.
  onStockChange?: (variantId: string, delta: number) => void;
}

// Returns a [lower, upper] UUID bound pair for prefix queries.
// Prefix is the first N hex chars (6–8) of a transaction UUID.
function getUuidPrefixRange(prefix: string): { lower: string; upper: string } | null {
  if (prefix.length < 6 || prefix.length > 8) return null;
  const lo = prefix.padEnd(8, '0');
  const hi = prefix.padEnd(8, 'f');
  return {
    lower: `${lo}-0000-0000-0000-000000000000`,
    upper: `${hi}-ffff-ffff-ffff-ffffffffffff`,
  };
}

const statusBadge = (status: string): string => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    voided: 'bg-red-100 text-red-700',
    refunded: 'bg-amber-100 text-amber-700',
    returned: 'bg-blue-100 text-blue-700',
    partial_return: 'bg-purple-100 text-purple-700',
  };
  return `inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${map[status] || 'bg-zinc-100 text-zinc-600'}`;
};

interface TransactionDetailModalProps {
  tx: Transaction;
  onClose: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ tx, onClose }) => {
  const [fullTx, setFullTx] = useState<any>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [originalReturns, setOriginalReturns] = useState<ReturnRecord[]>([]);
  const [linkedChildren, setLinkedChildren] = useState<Transaction[]>([]);
  const [originalSale, setOriginalSale] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isChildTx = !!(tx.invoice_number?.startsWith('RTN-') || tx.invoice_number?.startsWith('EXC-'));

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // select('*') so related_transaction_id appears if the column exists
        const { data: txFull, error: txErr } = await supabase
          .from('transactions')
          .select('*, customers(first_name, last_name, email, phone)')
          .eq('id', tx.id)
          .single();
        if (txErr) throw txErr;
        setFullTx(txFull);

        const hasRelatedIdCol = txFull != null && 'related_transaction_id' in txFull;

        // Returns whose transaction_id = this tx (non-EXC-/RTN- original sales)
        const { data: rData } = await supabase
          .from('returns')
          .select('*')
          .eq('transaction_id', tx.id)
          .order('created_at', { ascending: true });
        setReturns(rData || []);

        let origSale: Transaction | null = null;
        let children: Transaction[] = [];

        if (isChildTx) {
          // ── Find original sale ───────────────────────────────────────────
          if (hasRelatedIdCol && txFull.related_transaction_id) {
            const { data: orig } = await supabase
              .from('transactions')
              .select('*, customers(first_name, last_name)')
              .eq('id', txFull.related_transaction_id)
              .single();
            origSale = (orig as Transaction) ?? null;
          } else if (tx.invoice_number) {
            // RTN-{8hexchars} or EXC-{6hexchars}-{suffix}
            const idPrefix = tx.invoice_number.startsWith('RTN-')
              ? tx.invoice_number.slice(4)
              : tx.invoice_number.slice(4).split('-')[0];
            const range = getUuidPrefixRange(idPrefix);
            if (range) {
              const { data: candidates } = await supabase
                .from('transactions')
                .select('*, customers(first_name, last_name)')
                .gte('id', range.lower)
                .lte('id', range.upper)
                .neq('id', tx.id);
              if (candidates?.length === 1) origSale = candidates[0] as Transaction;
            }
          }
          setOriginalSale(origSale);

          // Fetch original's returns so we can show which item was returned/exchanged
          if (origSale) {
            const { data: origR } = await supabase
              .from('returns')
              .select('*')
              .eq('transaction_id', origSale.id)
              .order('created_at', { ascending: true });
            setOriginalReturns(origR || []);
          }
        } else {
          // ── Find child entries (RTN-/EXC- off this original) ────────────
          let foundChildren = false;
          if (hasRelatedIdCol) {
            try {
              const { data: ch, error: chErr } = await supabase
                .from('transactions')
                .select('*, customers(first_name, last_name)')
                .eq('related_transaction_id', tx.id);
              if (!chErr && ch && ch.length > 0) {
                children = ch as Transaction[];
                foundChildren = true;
              }
            } catch {}
          }
          if (!foundChildren) {
            // RTN- children have exact invoice_number RTN-{id8}; EXC- children match EXC-{id6}-*
            const id8 = tx.id.slice(0, 8);
            const id6 = tx.id.slice(0, 6);
            const [rtnRes, excRes] = await Promise.all([
              supabase
                .from('transactions')
                .select('*, customers(first_name, last_name)')
                .eq('invoice_number', `RTN-${id8}`)
                .neq('id', tx.id),
              supabase
                .from('transactions')
                .select('*, customers(first_name, last_name)')
                .ilike('invoice_number', `EXC-${id6}-%`)
                .neq('id', tx.id),
            ]);
            children = [
              ...((rtnRes.data as Transaction[]) || []),
              ...((excRes.data as Transaction[]) || []),
            ];
          }
          setLinkedChildren(children);
        }
      } catch (e: any) {
        setFetchError(e.message || 'Failed to load details');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [tx.id, isChildTx]);

  // EXC-: exchange return closest in time to this EXC- tx
  const excReturnEntry = useMemo((): ReturnRecord | null => {
    if (!tx.invoice_number?.startsWith('EXC-')) return null;
    const exchReturns = originalReturns.filter(r => r.refund_method === 'exchange');
    if (!exchReturns.length) return null;
    if (exchReturns.length === 1) return exchReturns[0];
    const target = new Date(tx.created_at).getTime();
    return exchReturns.reduce((prev, curr) =>
      Math.abs(new Date(curr.created_at).getTime() - target) <
      Math.abs(new Date(prev.created_at).getTime() - target) ? curr : prev
    );
  }, [tx.invoice_number, tx.created_at, originalReturns]);

  // RTN-: non-exchange return closest in time to this RTN- tx
  const rtnReturnEntry = useMemo((): ReturnRecord | null => {
    if (!tx.invoice_number?.startsWith('RTN-')) return null;
    const nonExch = originalReturns.filter(r => r.refund_method !== 'exchange');
    if (!nonExch.length) return null;
    if (nonExch.length === 1) return nonExch[0];
    const target = new Date(tx.created_at).getTime();
    return nonExch.reduce((prev, curr) =>
      Math.abs(new Date(curr.created_at).getTime() - target) <
      Math.abs(new Date(prev.created_at).getTime() - target) ? curr : prev
    );
  }, [tx.invoice_number, tx.created_at, originalReturns]);

  // Net totals — only for original (non-child) transactions with return events
  const netTotals = useMemo(() => {
    if (isChildTx || returns.length === 0) return null;
    const originalTotal = Number(tx.total_amount);
    const totalReturned = returns.reduce((s, r) => s + Number(r.refund_amount || 0), 0);
    const scIssued = returns
      .filter(r => r.refund_method === 'store_credit' || !!r.store_credit_id)
      .reduce((s, r) => s + Number(r.refund_amount || 0), 0);
    return { originalTotal, totalReturned, net: originalTotal - totalReturned, scIssued };
  }, [isChildTx, tx.total_amount, returns]);

  const customerName = fullTx?.customers
    ? `${fullTx.customers.first_name} ${fullTx.customers.last_name}`
    : (tx.customer_id ? 'Unknown' : 'Walk-in');

  const fmtDate = (d: string) => new Date(d).toLocaleString();
  const fmtAmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;

  const refundMethodLabel = (m: string): string =>
    ({ store_credit: 'Store Credit', original_payment: 'Original Payment', exchange: 'Exchange' } as Record<string, string>)[m] ?? m;

  const itemReturnedAmt = (item: any) =>
    ((item.pricePerUnit || item.price || 0) * (item.returnQuantity || item.quantity || 1) * 1.13).toFixed(2);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Transaction Details</h3>
            <p className="text-[10px] font-mono font-bold text-zinc-500 mt-0.5">
              {tx.invoice_number || tx.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="text-center py-8 text-red-500 text-xs font-bold">{fetchError}</div>
          ) : (
            <>
              {/* Meta */}
              <div className="bg-zinc-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</span>
                  <span className={statusBadge(tx.status || 'completed')}>{tx.status || 'completed'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</span>
                  <span className="text-[11px] font-bold text-zinc-900">{fmtDate(tx.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Customer</span>
                  <span className="text-[11px] font-bold text-zinc-900">{customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Payment</span>
                  <span className="text-[11px] font-bold text-zinc-900">{tx.method}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</span>
                  <span className={`text-[11px] font-black ${Number(tx.total_amount) < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                    {Number(tx.total_amount) < 0 ? '-' : ''}{fmtAmt(tx.total_amount)}
                  </span>
                </div>
              </div>

              {/* Items sold */}
              {(tx.items || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Items</p>
                  <div className="space-y-1.5">
                    {(tx.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] bg-zinc-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-bold text-zinc-900">{item.name}</p>
                          {(item.size || item.ageGroup) && (
                            <p className="text-zinc-400">{item.ageGroup ? `${item.ageGroup} · ` : ''}Size {item.size}</p>
                          )}
                          <p className="text-zinc-400">Qty {item.quantity || 1} × ${Number(item.price).toFixed(2)}</p>
                        </div>
                        <p className="font-black text-zinc-900 shrink-0">${(Number(item.price) * (item.quantity || 1)).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Original sale reference (RTN-/EXC- only) */}
              {isChildTx && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Original Sale</p>
                  {originalSale ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-blue-800">
                          {originalSale.invoice_number || originalSale.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={statusBadge(originalSale.status || 'completed')}>{originalSale.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500">{fmtDate(originalSale.created_at)}</span>
                        <span className="text-[11px] font-black text-zinc-900">${Number(originalSale.total_amount).toFixed(2)}</span>
                      </div>
                      {originalSale.customers && (
                        <p className="text-[10px] text-zinc-500">
                          {originalSale.customers.first_name} {originalSale.customers.last_name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-400 italic">Original sale not found</p>
                  )}
                </div>
              )}

              {/* Item returned in exchange (EXC- only) */}
              {tx.invoice_number?.startsWith('EXC-') && excReturnEntry && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Item Returned in Exchange</p>
                  <div className="space-y-1.5">
                    {(excReturnEntry.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-bold text-zinc-900">{item.name}</p>
                          {item.size && <p className="text-zinc-400">Size {item.size}</p>}
                          <p className="text-zinc-400">Qty {item.returnQuantity || item.quantity || 1}</p>
                        </div>
                        <p className="font-black text-amber-700 shrink-0">-${itemReturnedAmt(item)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items returned (RTN- only) */}
              {tx.invoice_number?.startsWith('RTN-') && rtnReturnEntry && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Returned Items</p>
                  <div className="space-y-1.5">
                    {(rtnReturnEntry.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-bold text-zinc-900">{item.name}</p>
                          {item.size && <p className="text-zinc-400">Size {item.size}</p>}
                          <p className="text-zinc-400">Qty {item.returnQuantity || item.quantity || 1}</p>
                        </div>
                        <p className="font-black text-red-600 shrink-0">-${itemReturnedAmt(item)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between text-[10px] font-bold text-zinc-600 px-1">
                      <span>Refund via</span>
                      <span>
                        {refundMethodLabel(rtnReturnEntry.refund_method)}
                        {rtnReturnEntry.refund_payment_method ? ` (${rtnReturnEntry.refund_payment_method})` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return events (original sale with returns) */}
              {!isChildTx && returns.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Return Events ({returns.length})
                  </p>
                  <div className="space-y-2">
                    {returns.map(r => (
                      <div key={r.id} className="border border-zinc-200 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">{fmtDate(r.created_at)}</span>
                          <span className="text-[10px] font-bold text-zinc-700">{refundMethodLabel(r.refund_method)}</span>
                        </div>
                        {(r.items || []).map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px]">
                            <div>
                              <p className="font-bold text-zinc-900">{item.name}</p>
                              {item.size && <p className="text-zinc-400">Size {item.size}</p>}
                              <p className="text-zinc-400">Qty {item.returnQuantity || item.quantity || 1}</p>
                            </div>
                            <p className="font-black text-red-600 shrink-0">-${itemReturnedAmt(item)}</p>
                          </div>
                        ))}
                        <div className="pt-1 border-t border-zinc-100 flex justify-between text-[10px] font-bold">
                          <span className="text-zinc-500">Total refunded</span>
                          <span className="text-red-600">-{fmtAmt(r.refund_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked RTN-/EXC- entries (original sale) */}
              {!isChildTx && linkedChildren.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    Linked Transactions ({linkedChildren.length})
                  </p>
                  <div className="space-y-1.5">
                    {linkedChildren.map(child => (
                      <div key={child.id} className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-zinc-900">
                            {child.invoice_number || child.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-[10px] text-zinc-400">{fmtDate(child.created_at)} · {child.method}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-[11px] font-black ${Number(child.total_amount) < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                            {Number(child.total_amount) < 0 ? '-' : ''}{fmtAmt(child.total_amount)}
                          </p>
                          <span className={statusBadge(child.status || 'completed')}>{child.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Net totals (original sale with returns only) */}
              {netTotals && (
                <div className="bg-zinc-900 rounded-lg p-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Net Totals</p>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">Original</span>
                    <span className="font-bold text-white">{fmtAmt(netTotals.originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">Returned</span>
                    <span className="font-bold text-red-400">-{fmtAmt(netTotals.totalReturned)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] border-t border-zinc-700 pt-1.5 mt-0.5">
                    <span className="text-zinc-200 font-black">Net</span>
                    <span className="font-black text-white">{fmtAmt(netTotals.net)}</span>
                  </div>
                  {netTotals.scIssued > 0 && (
                    <div className="flex justify-between text-[11px] mt-0.5">
                      <span className="text-zinc-400">Store credit issued</span>
                      <span className="font-bold text-emerald-400">{fmtAmt(netTotals.scIssued)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const [editingMOP, setEditingMOP] = useState<string | null>(null);
  const [newMOP, setNewMOP] = useState('');

  // Transaction detail modal
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

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

  const saveMOPChange = async (transactionId: string) => {
    if (!newMOP) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ method: newMOP, payment_method: newMOP })
        .eq('id', transactionId);
      if (error) throw error;
      setEditingMOP(null);
      setNewMOP('');
      flash(`Payment method updated to ${newMOP}`);
      await fetchTransactions();
    } catch (e: any) {
      flash(e.message, true);
    }
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

      // For EXC- receipts: fetch the item that was returned in the exchange
      let excReturnedItems: Array<{ name: string; size?: string; quantity: number; amount: number }> | undefined;
      if (fullTx.invoice_number?.startsWith('EXC-')) {
        let originalTxId: string | null = null;

        if ('related_transaction_id' in fullTx && fullTx.related_transaction_id) {
          originalTxId = fullTx.related_transaction_id;
        } else {
          // EXC- format: EXC-{tx.id.slice(0,6)}-{random}
          const idPrefix = fullTx.invoice_number.slice(4).split('-')[0];
          const range = getUuidPrefixRange(idPrefix);
          if (range) {
            const { data: origCandidates } = await supabase
              .from('transactions')
              .select('id')
              .gte('id', range.lower)
              .lte('id', range.upper)
              .neq('id', fullTx.id);
            if (origCandidates?.length === 1) originalTxId = origCandidates[0].id;
          }
        }

        if (originalTxId) {
          const { data: exchReturns } = await supabase
            .from('returns')
            .select('*')
            .eq('transaction_id', originalTxId)
            .eq('refund_method', 'exchange')
            .order('created_at', { ascending: false });

          if (exchReturns?.length) {
            const target = new Date(fullTx.created_at).getTime();
            const best: any = exchReturns.length === 1
              ? exchReturns[0]
              : exchReturns.reduce((prev: any, curr: any) =>
                  Math.abs(new Date(curr.created_at).getTime() - target) <
                  Math.abs(new Date(prev.created_at).getTime() - target) ? curr : prev
                );
            excReturnedItems = (best.items || []).map((item: any) => ({
              name: item.name || 'Item',
              size: item.size,
              quantity: item.returnQuantity || item.quantity || 1,
              amount: parseFloat(
                ((item.pricePerUnit || item.price || 0) * (item.returnQuantity || item.quantity || 1) * 1.13).toFixed(2)
              ),
            }));
          }
        }
      }

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
        refundedItems: excReturnedItems ?? (
          fullTx.refunded_items && Array.isArray(fullTx.refunded_items)
            ? fullTx.refunded_items.map((item: any) => ({
                name: item.name || 'Unknown',
                size: item.size,
                quantity: item.returnQuantity || item.quantity || 1,
                amount: parseFloat(
                  ((item.pricePerUnit || item.price || 0) * (item.returnQuantity || item.quantity || 1) * 1.13).toFixed(2)
                ),
              }))
            : undefined
        ),
        refundAmount: fullTx.refund_amount ? Number(fullTx.refund_amount) : undefined,
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
          const canReturn = tx.status === 'completed' || tx.status === 'partial_return';

          return (
            <div key={tx.id} className={`rounded-xl border transition-all ${tx.total_amount < 0 ? (expanded ? 'bg-red-50 border-red-200 shadow-md' : 'bg-red-50 border-red-100 hover:border-red-200') : (expanded ? 'bg-white border-zinc-300 shadow-md' : 'bg-white border-zinc-100 hover:border-zinc-200')}`}>
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
                      onClick={() => setDetailTx(tx)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wide hover:bg-zinc-900 transition-colors"
                    >
                      <Eye size={12} /> Details
                    </button>
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

                  {/* Fix MOP */}
                  {editingMOP === tx.id ? (
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 mt-2">
                      <p className="text-xs text-zinc-500 mb-2 font-medium">Change Payment Method</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Other'].map(method => (
                          <button
                            key={method}
                            onClick={() => setNewMOP(method)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${newMOP === method ? 'bg-[#b90014] text-white border-[#b90014]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveMOPChange(tx.id)}
                          disabled={!newMOP}
                          className="bg-zinc-800 disabled:bg-zinc-400 text-white text-xs px-4 py-1.5 rounded-lg font-medium"
                        >
                          Save Change
                        </button>
                        <button
                          onClick={() => { setEditingMOP(null); setNewMOP(''); }}
                          className="text-zinc-500 text-xs px-3 py-1.5 hover:text-zinc-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingMOP(tx.id); setNewMOP(tx.method || ''); }}
                      className="text-xs text-zinc-400 hover:text-zinc-600 mt-1"
                    >
                      ✏️ Fix MOP
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction Detail Modal */}
      {detailTx && (
        <TransactionDetailModal tx={detailTx} onClose={() => setDetailTx(null)} />
      )}

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
