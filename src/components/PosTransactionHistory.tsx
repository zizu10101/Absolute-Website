import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Barcode from 'react-barcode';
import { useCustomers } from '../context/CustomerContext';
import { useSettings } from '../context/SettingsContext';
import { generateThermalReceiptHTML } from '../utils/thermalReceipt';
import { ReturnsModal } from './ReturnsModal';
import {
  Search, ChevronDown, ChevronUp, Printer,
  RotateCcw, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Undo2,
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'completed' | 'voided' | 'refunded' | 'returned' | 'partial_return';

interface Transaction {
  id: string;
  total_amount: number;
  method: string;
  status: string;
  items: any[];
  customer_id: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
}

const apiPost = async (url: string, body: object) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Server error (${res.status}): unexpected response`); }
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
};

export const PosTransactionHistory: React.FC = () => {
  const { customers } = useCustomers();
  const { logo } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [returnsTransactionId, setReturnsTransactionId] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    console.log("📡 STEP A: fetchTransactions called");
    setIsLoading(true);
    setErrorMsg(null);
    try {
      console.log("📡 STEP B: Fetching from /api/transactions...");
      const res = await fetch('/api/transactions');
      const text = await res.text();

      console.log("📡 STEP B1: Raw response text:", text.substring(0, 200));

      let result: any;
      try { result = JSON.parse(text); } catch {
        console.error("❌ Failed to parse JSON:", text);
        throw new Error(`Server error: unexpected response`);
      }

      console.log("📡 STEP C: Response status:", res.status);
      console.log("📡 STEP C1: Result object:", result);
      console.log("📡 STEP D: Response data count:", result?.data ? result.data.length : 0);
      console.log("📡 STEP D1: Response error field:", result?.error);

      if (!res.ok) {
        console.error("❌ Response not OK - error:", result?.error);
        throw new Error(result?.error || `Failed to fetch (${res.status})`);
      }

      const sortedData = (result?.data || []).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log("📡 STEP E: Sorted data count:", sortedData.length);
      console.log("📡 STEP F: Transaction statuses:", sortedData.map((t: any) => ({ id: t.id.slice(0, 8), status: t.status })));

      setTransactions(sortedData);
      console.log("📡 STEP G: State updated with new transactions");
    } catch (e: any) {
      console.error('❌ Transaction fetch error:', e.message, e);
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
    console.log("🔍 FILTER: Starting filter with", transactions.length, "transactions, statusFilter:", statusFilter);
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
        console.log("🔍 FILTER: Checking status for tx", tx.id.slice(0, 8), "- tx.status:", tx.status, "statusFilter:", statusFilter, "match?", tx.status === statusFilter);
        if (tx.status !== statusFilter) return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getCustomerName(tx).toLowerCase();
        const id = tx.id.toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !tx.method?.toLowerCase().includes(q)) return false;
      }

      return true;
    });
    console.log("🔍 FILTER: Filtered result:", result.length, "transactions");
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
      console.log("🔵 CLIENT: handleVoid called for transaction ID:", tx.id);
      console.log("🔵 CLIENT: Sending POST to /api/transactions/void with body:", { transactionId: tx.id });

      const response = await apiPost('/api/transactions/void', { transactionId: tx.id });

      console.log("✅ CLIENT: Void response received:", response);
      flash('Transaction voided');

      console.log("🔵 CLIENT: Waiting 300ms before refetching...");
      await new Promise(r => setTimeout(r, 300));

      console.log("🔵 CLIENT: Refetching transactions...");
      await fetchTransactions();
      console.log("✅ CLIENT: Transactions refetched and state updated");
    } catch (e: any) {
      console.error("❌ CLIENT: Void error:", e.message);
      flash(e.message, true);
    }
  };

  const handleRefund = async (tx: Transaction) => {
    if (!confirm('Issue a refund? Stock will be restored.')) return;
    try {
      await apiPost('/api/transactions/refund', { transactionId: tx.id });
      flash('Refund issued & stock restored');
      fetchTransactions();
    } catch (e: any) { flash(e.message, true); }
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

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  // Reprint receipt from transaction data
  const handleReprint = async (txId: string) => {
    try {
      // Fetch full transaction details from Supabase
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

      // Calculate totals (assume 13% HST)
      const total = Math.abs(Number(fullTx.total_amount));
      const subtotal = total / 1.13;
      const hst = total - subtotal;

      const html = generateThermalReceiptHTML({
        transactionId: fullTx.id,
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
      });

      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(html);
      win.document.close();
    } catch (e: any) {
      console.error('Reprint error:', e);
      flash('Error reprinting receipt', true);
    }
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
                    <span className="text-[10px] font-mono text-zinc-400">{tx.id.slice(0,8).toUpperCase()}</span>
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
                    <Barcode value={tx.id} width={1.2} height={32} fontSize={9} />
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
                      onClick={() => handlePrint(tx)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 text-[10px] font-black uppercase tracking-wide hover:bg-zinc-50 transition-colors"
                    >
                      <Printer size={12} /> Print
                    </button>
                    <button
                      onClick={() => handleReprint(tx.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 bg-zinc-100 text-[10px] font-black uppercase tracking-wide hover:bg-zinc-200 transition-colors"
                      title="Reprint this transaction receipt"
                    >
                      <RefreshCw size={12} /> Reprint
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
                        onClick={() => handleRefund(tx)}
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
                      <span className="text-[10px] text-red-500 font-bold self-center">Voided — no further action</span>
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
    </div>
  );
};
