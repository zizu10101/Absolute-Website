import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { useCustomers, Customer } from '../context/CustomerContext';
import {
  Search, User, ArrowLeft, Edit2, Save, X, Plus,
  ShoppingBag, DollarSign, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';

type View = 'list' | 'profile' | 'create' | 'edit';

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', boot_size: '', club_affinity: '', notes: '' };

export const PosCustomerManager: React.FC = () => {
  const { customers, fetchCustomers, addCustomer, updateCustomer } = useCustomers();
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customerTxns, setCustomerTxns] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const flash = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 4000); }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c =>
      `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const loadCustomerTransactions = async (customerId: string) => {
    setTxLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomerTxns(data || []);
    } catch {
      setCustomerTxns([]);
    } finally {
      setTxLoading(false);
    }
  };

  const openProfile = (c: Customer) => {
    setSelected(c);
    setView('profile');
    loadCustomerTransactions(c.id);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      first_name: selected.first_name || '',
      last_name: selected.last_name || '',
      email: selected.email || '',
      phone: selected.phone || '',
      boot_size: selected.boot_size || '',
      club_affinity: selected.club_affinity || '',
      notes: (selected as any).notes || '',
    });
    setView('edit');
  };

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name) { flash('First and last name required', true); return; }
    setIsSaving(true);
    const result = await addCustomer(form);
    setIsSaving(false);
    if (result) { flash('Customer created'); setForm({ ...EMPTY_FORM }); setView('list'); fetchCustomers(); }
    else flash('Failed to create customer', true);
  };

  const handleUpdate = async () => {
    if (!selected || !form.first_name || !form.last_name) { flash('First and last name required', true); return; }
    setIsSaving(true);
    const result = await updateCustomer(selected.id, form);
    setIsSaving(false);
    if (result) {
      flash('Customer updated');
      setSelected(result);
      setView('profile');
    } else flash('Failed to update customer', true);
  };

  const totalSpent = useMemo(() =>
    customerTxns.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.total_amount), 0),
    [customerTxns]);

  const lastVisit = useMemo(() => {
    const completed = customerTxns.filter(t => t.status === 'completed');
    if (!completed.length) return null;
    return new Date(completed[0].created_at).toLocaleDateString();
  }, [customerTxns]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const Flash = () => (
    <>
      {successMsg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-emerald-700 text-[11px] font-bold"><CheckCircle2 size={13} /> {successMsg}</div>}
      {errorMsg && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-[11px] font-bold"><AlertTriangle size={13} /> {errorMsg}</div>}
    </>
  );

  const FormFields = () => (
    <div className="grid grid-cols-2 gap-3">
      {[
        { key: 'first_name', label: 'First Name *', half: true },
        { key: 'last_name', label: 'Last Name *', half: true },
        { key: 'email', label: 'Email', half: false },
        { key: 'phone', label: 'Phone', half: false },
        { key: 'boot_size', label: 'Boot Size', half: true },
        { key: 'club_affinity', label: 'Club', half: true },
        { key: 'notes', label: 'Notes', half: false },
      ].map(({ key, label, half }) => (
        <div key={key} className={half ? '' : 'col-span-2'}>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
          {key === 'notes' ? (
            <textarea
              value={(form as any)[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              rows={2}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-800 resize-none"
            />
          ) : (
            <input
              type={key === 'email' ? 'email' : 'text'}
              value={(form as any)[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          )}
        </div>
      ))}
    </div>
  );

  // ─── Views ────────────────────────────────────────────────────────────────

  if (view === 'create' || view === 'edit') {
    return (
      <div className="flex flex-col h-full bg-zinc-50">
        <div className="bg-white border-b border-zinc-200 p-5 flex items-center gap-3">
          <button onClick={() => setView(view === 'create' ? 'list' : 'profile')} className="p-1.5 hover:bg-zinc-100 rounded-lg">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">
            {view === 'create' ? 'New Customer' : `Edit — ${selected?.first_name} ${selected?.last_name}`}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Flash />
          <FormFields />
        </div>
        <div className="p-5 border-t bg-white flex gap-3">
          <button onClick={() => setView(view === 'create' ? 'list' : 'profile')} className="flex-1 py-3 border border-zinc-200 rounded-xl text-[11px] font-black uppercase">Cancel</button>
          <button
            onClick={view === 'create' ? handleCreate : handleUpdate}
            disabled={isSaving}
            className="flex-1 py-3 bg-zinc-950 text-white rounded-xl text-[11px] font-black uppercase hover:bg-[#b90014] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'profile' && selected) {
    return (
      <div className="flex flex-col h-full bg-zinc-50">
        <div className="bg-white border-b border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setView('list')} className="p-1.5 hover:bg-zinc-100 rounded-lg">
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex-1">Customer Profile</h2>
            <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-lg text-[10px] font-black uppercase hover:bg-zinc-50">
              <Edit2 size={12} /> Edit
            </button>
          </div>
          <Flash />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact card */}
          <div className="bg-white rounded-xl border border-zinc-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-zinc-950 rounded-full flex items-center justify-center text-white font-black text-sm">
                {selected.first_name[0]}{selected.last_name[0]}
              </div>
              <div>
                <p className="font-black text-zinc-900">{selected.first_name} {selected.last_name}</p>
                <p className="text-[10px] text-zinc-400">Since {new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              {[
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Boot Size', selected.boot_size],
                ['Club', selected.club_affinity],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">{label}</p>
                  <p className="font-bold text-zinc-800">{value}</p>
                </div>
              ))}
              {(selected as any).notes && (
                <div className="col-span-2">
                  <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest">Notes</p>
                  <p className="font-bold text-zinc-800">{(selected as any).notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShoppingBag, label: 'Purchases', value: customerTxns.filter(t => t.status === 'completed').length },
              { icon: DollarSign, label: 'Total Spent', value: `$${totalSpent.toFixed(2)}` },
              { icon: Clock, label: 'Last Visit', value: lastVisit || '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
                <Icon size={16} className="text-zinc-400 mx-auto mb-1" />
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{label}</p>
                <p className="font-black text-zinc-900 text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Purchase history */}
          <div className="bg-white rounded-xl border border-zinc-100 p-5">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3">Purchase History</p>
            {txLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
              </div>
            ) : customerTxns.length === 0 ? (
              <p className="text-[11px] text-zinc-400 text-center py-6">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {customerTxns.map(tx => (
                  <div key={tx.id} className="flex justify-between items-start py-2 border-b border-zinc-50 last:border-0">
                    <div>
                      <p className="text-[11px] font-bold text-zinc-900">{new Date(tx.created_at).toLocaleDateString()}</p>
                      <p className="text-[9px] text-zinc-400 font-mono">{tx.id.slice(0, 8).toUpperCase()} · {tx.method}</p>
                      <p className="text-[9px] text-zinc-400">{(tx.items || []).length} item(s)</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${tx.total_amount < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                        ${Number(tx.total_amount).toFixed(2)}
                      </p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        tx.status === 'voided' ? 'bg-red-100 text-red-600' :
                        tx.status === 'refunded' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>{tx.status || 'completed'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Customer list view
  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Customers ({customers.length})</h2>
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setView('create'); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-lg text-[10px] font-black uppercase hover:bg-[#b90014] transition-colors"
          >
            <Plus size={13} /> New Customer
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[11px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest">No customers found</p>
          </div>
        ) : filtered.map(c => (
          <div
            key={c.id}
            onClick={() => openProfile(c)}
            className="bg-white rounded-xl border border-zinc-100 p-4 flex items-center gap-3 cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 bg-zinc-950 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0">
              {c.first_name[0]}{c.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-900 truncate">{c.first_name} {c.last_name}</p>
              <p className="text-[10px] text-zinc-400 truncate">{c.email || c.phone || 'No contact info'}</p>
            </div>
            <div className="text-right shrink-0">
              {c.club_affinity && <p className="text-[9px] text-zinc-400 font-bold">{c.club_affinity}</p>}
              <p className="text-[9px] text-zinc-300 font-mono">{c.id.slice(0, 6)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
