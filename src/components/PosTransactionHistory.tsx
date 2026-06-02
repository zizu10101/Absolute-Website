import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Barcode from 'react-barcode';
import { useCustomers } from '../context/CustomerContext';
import {
  Search, ChevronDown, ChevronUp, Printer,
  RotateCcw, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'completed' | 'voided' | 'refunded';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/transactions');
      const text = await res.text();
      let result: any;
      try { result = JSON.parse(text); } catch { throw new Error(`Server error: unexpected response`); }
      if (!res.ok) throw new Error(result?.error || 'Failed to fetch');
      setTransactions((result?.data || []).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (e: any) {
      console.error('Transaction fetch error:', e);
      setErrorMsg('Failed to load transactions');
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
    return transactions.filter(tx => {
      const d = new Date(tx.created_at);

      // Date filter
      if (dateFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (dateFilter === 'week') {
        const w = new Date(); w.setDate(w.getDate() - 7);
        if (d < w) return false;
      }
      if (dateFilter === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (dateFilter === 'year' && d.getFullYear() !== now.getFullYear()) return false;

      // Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getCustomerName(tx).toLowerCase();
        const id = tx.id.toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !tx.method?.toLowerCase().includes(q)) return false;
      }

      return true;
    });
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
      await apiPost('/api/transactions/void', { transactionId: tx.id });
      flash('Transaction voided');
      fetchTransactions();
    } catch (e: any) { flash(e.message, true); }
  };

  const handleRefund = async (tx: Transaction) => {
    if (!confirm('Issue a refund? Stock will be restored.')) return;
    try {
      await apiPost('/api/transactions/refund', { transactionId: tx.id });
      flash('Refund issued & stock restored');
      fetchTransactions();
    } catch (e: any) { flash(e.message, true); }
  };

  const handlePrint = (tx: Transaction) => {
    const customerName = getCustomerName(tx);
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    const items = (tx.items || []).map((item: any) =>
      `<tr><td>${item.name || ''}${item.size ? ` · Sz ${item.size}` : ''}</td><td style="text-align:right">×${item.quantity}</td><td style="text-align:right">$${(Number(item.price) * (item.quantity || 1)).toFixed(2)}</td></tr>`
    ).join('');
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;font-size:12px;padding:20px}table{width:100%}td{padding:2px 4px}hr{border-top:1px dashed #000}</style>
      </head><body>
      <div style="text-align:center"><h2 style="margin:0">ABSOLUTE SOCCER</h2><p style="margin:4px 0">${new Date(tx.created_at).toLocaleString()}</p></div>
      <hr/>
      <p><b>TXN:</b> ${tx.id.slice(0, 8).toUpperCase()}<br/><b>Customer:</b> ${customerName}<br/><b>Payment:</b> ${tx.method}</p>
      <hr/>
      <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table>
      <hr/>
      <p style="text-align:right"><b>TOTAL: $${Number(tx.total_amount).toFixed(2)}</b></p>
      <p style="text-align:center;margin-top:16px">Status: ${(tx.status || 'completed').toUpperCase()}</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-700',
      voided: 'bg-red-100 text-red-700',
      refunded: 'bg-amber-100 text-amber-700',
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
            {(['all','completed','voided','refunded'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide transition-colors ${statusFilter === s ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400'}`}>
                {s}
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
          const canVoid = tx.status === 'completed' && isToday(tx.created_at);
          const canRefund = tx.status === 'completed' && !isToday(tx.created_at);

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
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handlePrint(tx)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 text-[10px] font-black uppercase tracking-wide hover:bg-zinc-50 transition-colors"
                    >
                      <Printer size={12} /> Print
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
                    {tx.status === 'voided' && (
                      <span className="text-[10px] text-red-500 font-bold self-center">Voided — no further action</span>
                    )}
                    {tx.status === 'refunded' && (
                      <span className="text-[10px] text-amber-600 font-bold self-center">Already refunded</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
