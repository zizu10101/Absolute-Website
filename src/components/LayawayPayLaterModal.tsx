import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Clock, Printer, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { CartItem, getItemDiscountedPrice } from '../hooks/usePOSCart';
import { Customer } from '../context/CustomerContext';
import { generateLayawayReceiptHTML, generatePayLaterReceiptHTML } from '../utils/thermalReceipt';

interface LayawayPayLaterModalProps {
  isOpen: boolean;
  mode: 'layaway' | 'pay_later';
  cart: CartItem[];
  totalAmount: number;
  customer: Customer | null;
  footerLogo?: string;
  onClose: () => void;
  onComplete: () => void; // called when staff dismisses the confirmation - parent should clear the cart
}

export const LayawayPayLaterModal: React.FC<LayawayPayLaterModalProps> = ({
  isOpen, mode, cart, totalAmount, customer, footerLogo, onClose, onComplete,
}) => {
  const [depositAmount, setDepositAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<{ id: string; createdAt: Date; deposit: number; balanceDue: number } | null>(null);

  if (!isOpen) return null;

  const title = mode === 'layaway' ? 'Layaway' : 'Pay Later';
  const deposit = mode === 'layaway' ? Math.max(0, Math.min(totalAmount, parseFloat(depositAmount) || 0)) : 0;
  const balanceDue = Math.max(0, totalAmount - deposit);

  const itemsPayload = cart.map(item => ({
    name: item.name,
    quantity: item.quantity,
    price: getItemDiscountedPrice(item),
    size: item.size,
    ageGroup: item.ageGroup,
    color: item.color,
    variantId: item.variantId,
    barcode: item.barcode,
  }));

  const handleSave = async () => {
    if (!customer) { setError('A customer is required.'); return; }
    if (mode === 'layaway' && (!depositAmount || deposit <= 0)) { setError('Enter a deposit amount.'); return; }
    if (cart.length === 0) { setError('Cart is empty.'); return; }

    setIsSaving(true);
    setError(null);
    try {
      const table = mode === 'layaway' ? 'layaways' : 'pay_later';
      const payload: any = mode === 'layaway'
        ? {
            customer_id: customer.id,
            items: itemsPayload,
            total_amount: Number(totalAmount.toFixed(2)),
            deposit_paid: Number(deposit.toFixed(2)),
            balance_due: Number(balanceDue.toFixed(2)),
            status: 'active',
          }
        : {
            customer_id: customer.id,
            items: itemsPayload,
            total_amount: Number(totalAmount.toFixed(2)),
            amount_paid: 0,
            balance_due: Number(totalAmount.toFixed(2)),
            status: 'unpaid',
          };

      const { data, error: insertError } = await supabase.from(table).insert([payload]).select();
      if (insertError) throw insertError;

      // Deduct stock for held items, same as a completed sale
      for (const item of cart) {
        const variantId = item.variantId || (item.id.startsWith('var-') ? item.id.replace('var-', '') : null);
        if (variantId) {
          try {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', variantId)
              .single();
            if (variant) {
              const newQty = Math.max(0, (variant.stock_quantity || 0) - (item.quantity || 1));
              await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', variantId);
            }
          } catch (err) {
            console.error('Stock deduction error:', err);
          }
        }
      }

      setSavedRecord({
        id: data?.[0]?.id,
        createdAt: new Date(data?.[0]?.created_at || Date.now()),
        deposit,
        balanceDue,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!savedRecord) return;
    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'Walk-in';
    const customerPhone = customer?.phone || undefined;
    const html = mode === 'layaway'
      ? generateLayawayReceiptHTML({
          layawayId: savedRecord.id,
          customerName,
          customerPhone,
          items: itemsPayload,
          totalAmount,
          depositPaid: savedRecord.deposit,
          balanceDue: savedRecord.balanceDue,
          createdAt: savedRecord.createdAt,
          logoUrl: footerLogo || '/logo.svg',
        })
      : generatePayLaterReceiptHTML({
          payLaterId: savedRecord.id,
          customerName,
          customerPhone,
          items: itemsPayload,
          totalAmount,
          createdAt: savedRecord.createdAt,
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

  const handleClose = () => {
    setDepositAmount('');
    setError(null);
    setSavedRecord(null);
    onClose();
  };

  const handleDone = () => {
    setDepositAmount('');
    setError(null);
    setSavedRecord(null);
    onComplete();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 z-[65] flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1a2236] rounded-lg w-full max-w-sm border border-[#2d3547] overflow-hidden">
          <div className="p-4 border-b border-[#2d3547] flex items-center justify-between bg-[#0f1117]">
            <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              {mode === 'layaway' ? <Clock size={16} /> : <Package size={16} />} {title}
            </h2>
            {!savedRecord && (
              <button onClick={handleClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
            )}
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {!savedRecord ? (
              <>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Customer</p>
                  <p className="text-sm text-white font-semibold">{customer ? `${customer.first_name} ${customer.last_name}` : 'None selected'}</p>
                </div>

                <div className="border-t border-[#2d3547] pt-2 space-y-1 max-h-40 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-[11px] text-gray-300">
                      <span className="truncate pr-2">{item.name} x{item.quantity}</span>
                      <span className="font-bold shrink-0">${(getItemDiscountedPrice(item) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#2d3547] pt-2 flex justify-between text-sm font-bold text-white">
                  <span>Total</span><span>${totalAmount.toFixed(2)}</span>
                </div>

                {mode === 'layaway' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Deposit Amount</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0f1117] border border-[#2d3547] rounded px-3 py-2 text-white text-sm"
                    />
                    {deposit > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">Balance due: <span className="text-amber-400 font-bold">${balanceDue.toFixed(2)}</span></p>
                    )}
                  </div>
                )}

                {mode === 'pay_later' && (
                  <p className="text-[10px] text-gray-400 bg-[#0f1117] border border-[#2d3547] rounded p-2">
                    Full amount will be saved as owed. No payment is collected now.
                  </p>
                )}

                {error && <p className="text-[11px] text-red-400 font-bold">{error}</p>}

                <button
                  onClick={handleSave}
                  disabled={isSaving || !customer || cart.length === 0}
                  className="w-full py-3 bg-[var(--primary-color)] hover:bg-red-700 disabled:opacity-50 text-white rounded font-bold text-sm uppercase"
                >
                  {isSaving ? 'Saving...' : `Confirm ${title}`}
                </button>
              </>
            ) : (
              <div className="text-center space-y-3 py-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                <p className="text-sm font-bold text-white">{title} saved successfully!</p>
                <p className="text-[11px] text-gray-400">
                  {mode === 'layaway'
                    ? `Deposit $${savedRecord.deposit.toFixed(2)} collected. Balance due $${savedRecord.balanceDue.toFixed(2)}. Items held for 30 days.`
                    : `Amount owed: $${totalAmount.toFixed(2)}. Payment due upon next visit.`}
                </p>
                <div className="flex gap-2 pt-2">
                  <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-1 border border-[#2d3547] rounded py-2.5 text-[10px] font-black uppercase text-white hover:bg-[#2d3547]">
                    <Printer size={13} /> Print Receipt
                  </button>
                  <button onClick={handleDone} className="flex-1 bg-[var(--primary-color)] rounded py-2.5 text-[10px] font-black uppercase text-white hover:bg-red-700">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
