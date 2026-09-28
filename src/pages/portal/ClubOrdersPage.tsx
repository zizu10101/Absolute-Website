import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { useClub, Club } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { ClubOrder } from '../../types/clubPortal';
import { generateInvoiceHTML, printInvoice } from '../../utils/invoice';

function printOrderInvoice(order: ClubOrder, club: Club) {
  const total = Number(order.total_amount || 0);
  const deposit = Number(order.deposit_paid || 0);
  const balance = Math.max(0, total - deposit);
  const subtotal = total / 1.13;
  const tax = total - subtotal;
  const logoUrl = `${window.location.origin}/logo-black.png`;
  const paymentLine = deposit > 0
    ? `Deposit Paid: $${deposit.toFixed(2)} · Balance Owing: $${balance.toFixed(2)}`
    : `Balance Owing: $${balance.toFixed(2)}`;
  const html = generateInvoiceHTML({
    invoiceNumber: order.order_number,
    createdAt: new Date(order.created_at),
    logoUrl,
    customerInfo: { firstName: club.name, email: club.contact_email || undefined, phone: club.contact_phone || undefined },
    items: (order.items || []).map(li => ({ name: li.name, quantity: li.qty, price: li.price, size: li.size })),
    subtotal, tax, total,
    paymentMethod: paymentLine,
  }, 'invoice');
  printInvoice(html);
}

export const ClubOrdersPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { club, isLoading, error } = useClub(slug);
  const [orders, setOrders] = useState<ClubOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!club) return;
    supabase
      .from('club_orders')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setOrders((data || []) as unknown as ClubOrder[]);
        setOrdersLoading(false);
      });
  }, [club]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading...</div>;
  }
  if (error || !club) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-600 font-bold">Club not found.</div>;
  }

  return (
    <ClubPortalLayout club={club} activeNav="orders">
      {() => (
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">Order History</h2>

          {ordersLoading ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">No orders yet.</p>
          ) : (
            orders.map(order => (
              <div key={order.id} className="border border-zinc-200 rounded-xl p-4 mb-3 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-zinc-900">{order.order_number}</p>
                    <p className="text-sm text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mt-3 space-y-1">
                  {(order.items || []).map((item, i) => (
                    <p key={i} className="text-sm text-zinc-700">
                      {item.name} - {item.size} x{item.qty}
                    </p>
                  ))}
                </div>

                {order.notes && (
                  <p className="mt-2 text-xs text-zinc-400 italic">"{order.notes}"</p>
                )}

                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm border-t border-zinc-100 pt-3">
                  <span className="text-zinc-600">Total: ${Number(order.total_amount || 0).toFixed(2)}</span>
                  <span className="text-zinc-600">Paid: ${Number(order.deposit_paid || 0).toFixed(2)}</span>
                  <span className="font-bold" style={{ color: club.primary_color }}>
                    Balance: ${Number(order.balance_owing || 0).toFixed(2)}
                  </span>
                </div>

                {order.invoice_url && (
                  <button
                    onClick={() => printOrderInvoice(order, club)}
                    className="mt-2 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    <FileText size={14} /> Print Invoice
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </ClubPortalLayout>
  );
};
