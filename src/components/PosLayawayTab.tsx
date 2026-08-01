import React, { useEffect, useMemo, useState } from 'react';
import { Search, Clock, Package, Printer, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { useSettings } from '../context/SettingsContext';
import { generateLayawayReceiptHTML, generatePayLaterReceiptHTML } from '../utils/thermalReceipt';

type RecordType = 'layaway' | 'pay_later';

interface LayawayPayLaterRecord {
  id: string;
  type: RecordType;
  customer_id: string | null;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  items: Array<{ name: string; quantity: number; price: number; size?: string; ageGroup?: string; variantId?: string; barcode?: string }>;
  total_amount: number;
  deposit_paid?: number; // layaway
  amount_paid?: number; // pay_later
  balance_due: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const paidField = (r: LayawayPayLaterRecord) => (r.type === 'layaway' ? r.deposit_paid || 0 : r.amount_paid || 0);

export const PosLayawayTab: React.FC = () => {
  const { footerLogo } = useSettings();
  const [records, setRecords] = useState<LayawayPayLaterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LayawayPayLaterRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const [layawaysRes, payLaterRes] = await Promise.all([
        supabase.from('layaways').select('*, customers(first_name, last_name, email, phone)').order('created_at', { ascending: false }),
        supabase.from('pay_later').select('*, customers(first_name, last_name, email, phone)').order('created_at', { ascending: false }),
      ]);
      const layaways: LayawayPayLaterRecord[] = (layawaysRes.data || []).map((r: any) => ({ ...r, type: 'layaway' as const }));
      const payLater: LayawayPayLaterRecord[] = (payLaterRes.data || []).map((r: any) => ({ ...r, type: 'pay_later' as const }));
      const combined = [...layaways, ...payLater].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecords(combined);
    } catch (err) {
      console.error('Error loading layaway/pay later records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records.filter(r => {
      if (!showCompleted && (r.status === 'completed' || r.status === 'paid' || r.status === 'cancelled')) return false;
      if (!q) return true;
      const name = `${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`.toLowerCase();
      return name.includes(q) || r.id.toLowerCase().includes(q);
    });
  }, [records, search, showCompleted]);

  const openRecord = (r: LayawayPayLaterRecord) => {
    setSelected(r);
    setPaymentAmount('');
    setError(null);
  };

  const handleTakePayment = async () => {
    if (!selected) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid payment amount.'); return; }
    if (amount > selected.balance_due + 0.001) { setError(`Amount exceeds balance due ($${selected.balance_due.toFixed(2)}).`); return; }

    setIsSaving(true);
    setError(null);
    try {
      const newPaid = paidField(selected) + amount;
      const newBalance = Math.max(0, Number((selected.total_amount - newPaid).toFixed(2)));
      const isFullyPaid = newBalance <= 0.001;
      const table = selected.type === 'layaway' ? 'layaways' : 'pay_later';
      const paidFieldName = selected.type === 'layaway' ? 'deposit_paid' : 'amount_paid';
      const noteLine = `Payment of $${amount.toFixed(2)} received ${new Date().toLocaleString()}`;
      const updatedNotes = selected.notes ? `${selected.notes}\n${noteLine}` : noteLine;

      const update: any = {
        [paidFieldName]: Number(newPaid.toFixed(2)),
        balance_due: newBalance,
        notes: updatedNotes,
        status: isFullyPaid ? (selected.type === 'layaway' ? 'completed' : 'paid') : selected.status,
      };

      const { error: updateError } = await supabase.from(table).update(update).eq('id', selected.id);
      if (updateError) throw updateError;

      const updatedRecord: LayawayPayLaterRecord = {
        ...selected,
        [paidFieldName]: update[paidFieldName],
        balance_due: newBalance,
        status: update.status,
        notes: updatedNotes,
      };
      setSelected(updatedRecord);
      setRecords(prev => prev.map(r => (r.id === selected.id && r.type === selected.type ? updatedRecord : r)));
      setPaymentAmount('');

      if (isFullyPaid) {
        printReceipt(updatedRecord);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to record payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (r: LayawayPayLaterRecord) => {
    const label = r.type === 'layaway' ? 'layaway' : 'Pay Later order';
    if (!confirm(`Cancel this ${label}? This cannot be undone.`)) return;

    setIsSaving(true);
    setError(null);
    try {
      const table = r.type === 'layaway' ? 'layaways' : 'pay_later';
      const noteLine = `Cancelled ${new Date().toLocaleString()}`;
      const updatedNotes = r.notes ? `${r.notes}\n${noteLine}` : noteLine;

      const { error: updateError } = await supabase
        .from(table)
        .update({ status: 'cancelled', notes: updatedNotes })
        .eq('id', r.id);
      if (updateError) throw updateError;

      // Return held items to sellable stock (they were deducted when the hold was created)
      for (const item of r.items) {
        if (!item.variantId) continue;
        try {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', item.variantId)
            .single();
          if (variant) {
            const newQty = (variant.stock_quantity || 0) + (item.quantity || 1);
            await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', item.variantId);
          }
        } catch (err) {
          console.error('Restock error:', err);
        }
      }

      const updatedRecord: LayawayPayLaterRecord = { ...r, status: 'cancelled', notes: updatedNotes };
      setSelected(updatedRecord);
      setRecords(prev => prev.map(rec => (rec.id === r.id && rec.type === r.type ? updatedRecord : rec)));
    } catch (e: any) {
      setError(e.message || 'Failed to cancel.');
    } finally {
      setIsSaving(false);
    }
  };

  const printReceipt = (r: LayawayPayLaterRecord) => {
    const customerName = r.customers ? `${r.customers.first_name} ${r.customers.last_name}` : 'Walk-in';
    const html = r.type === 'layaway'
      ? generateLayawayReceiptHTML({
          layawayId: r.id,
          customerName,
          items: r.items,
          totalAmount: r.total_amount,
          depositPaid: r.deposit_paid || 0,
          balanceDue: r.balance_due,
          createdAt: new Date(r.created_at),
          logoUrl: footerLogo || '/logo.svg',
        })
      : generatePayLaterReceiptHTML({
          payLaterId: r.id,
          customerName,
          items: r.items,
          totalAmount: r.total_amount,
          createdAt: new Date(r.created_at),
          logoUrl: footerLogo || '/logo.svg',
        });

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = function () {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = function () { printWindow.close(); };
        }, 500);
      };
    }
  };

  if (selected) {
    const paid = paidField(selected);
    const isComplete = selected.status === 'completed' || selected.status === 'paid';
    const isCancelled = selected.status === 'cancelled';
    return (
      <div className="flex flex-col h-full bg-zinc-50">
        <div className="bg-white border-b border-zinc-200 p-5 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg"><ArrowLeft size={16} /></button>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
            {selected.type === 'layaway' ? <Clock size={16} /> : <Package size={16} />}
            {selected.type === 'layaway' ? 'Layaway' : 'Pay Later'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-100 p-5">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Customer</p>
            <p className="font-black text-zinc-900">{selected.customers ? `${selected.customers.first_name} ${selected.customers.last_name}` : 'Unknown'}</p>
            <p className="text-[10px] text-zinc-400 mt-1">Created {new Date(selected.created_at).toLocaleString()}</p>
            {isComplete && (
              <p className="text-[10px] font-black uppercase text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Fully Paid</p>
            )}
            {isCancelled && (
              <p className="text-[10px] font-black uppercase text-zinc-500 mt-2 flex items-center gap-1"><XCircle size={12} /> Cancelled</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-zinc-100 p-5">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3">Items</p>
            <div className="space-y-2">
              {selected.items.map((item, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <div>
                    <p className="font-bold text-zinc-900">{item.name} x{item.quantity}</p>
                    {(item.size || item.ageGroup) && <p className="text-zinc-400">{item.ageGroup ? `${item.ageGroup} · ` : ''}{item.size && `Size ${item.size}`}</p>}
                  </div>
                  <p className="font-black text-zinc-900">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-100 p-5 space-y-2 text-[11px]">
            <div className="flex justify-between"><span className="text-zinc-500">Total</span><span className="font-black text-zinc-900">${selected.total_amount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">{selected.type === 'layaway' ? 'Deposit Paid' : 'Amount Paid'}</span><span className="font-black text-emerald-600">${paid.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-zinc-100 pt-2"><span className="text-zinc-500 font-bold">Balance Due</span><span className="font-black text-[var(--primary-color)] text-sm">${selected.balance_due.toFixed(2)}</span></div>
          </div>

          {!isComplete && !isCancelled && (
            <div className="bg-white rounded-xl border border-zinc-100 p-5 space-y-2">
              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Take Payment</p>
              <input
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-800"
              />
              {error && <p className="text-[11px] text-red-600 font-bold">{error}</p>}
              <button
                onClick={handleTakePayment}
                disabled={isSaving}
                className="w-full py-3 bg-zinc-950 text-white rounded-xl text-[11px] font-black uppercase hover:bg-[var(--primary-color)] transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          )}

          <button
            onClick={() => printReceipt(selected)}
            className="w-full flex items-center justify-center gap-2 py-3 border border-zinc-200 rounded-xl text-[11px] font-black uppercase hover:bg-zinc-50"
          >
            <Printer size={13} /> Print Receipt
          </button>

          {!isComplete && !isCancelled && (
            <button
              onClick={() => handleCancel(selected)}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 rounded-xl text-[11px] font-black uppercase hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <XCircle size={13} /> Cancel {selected.type === 'layaway' ? 'Layaway' : 'Order'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Layaways &amp; Pay Later</h2>
          <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer">
            <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
            Show Completed / Cancelled
          </label>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by customer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[11px] text-zinc-900 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Clock size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest">No records found</p>
          </div>
        ) : filtered.map(r => (
          <div
            key={`${r.type}-${r.id}`}
            onClick={() => openRecord(r)}
            className="bg-white rounded-xl border border-zinc-100 p-4 flex items-center gap-3 cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${r.type === 'layaway' ? 'bg-amber-500' : 'bg-blue-500'}`}>
              {r.type === 'layaway' ? <Clock size={16} /> : <Package size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-900 truncate">{r.customers ? `${r.customers.first_name} ${r.customers.last_name}` : 'Unknown customer'}</p>
              <p className="text-[10px] text-zinc-400 truncate">{r.type === 'layaway' ? 'Layaway' : 'Pay Later'} · {new Date(r.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black text-[var(--primary-color)]">${r.balance_due.toFixed(2)} due</p>
              <p className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                r.status === 'completed' || r.status === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                r.status === 'cancelled' ? 'bg-zinc-200 text-zinc-500' :
                'bg-amber-100 text-amber-600'
              }`}>
                {r.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
