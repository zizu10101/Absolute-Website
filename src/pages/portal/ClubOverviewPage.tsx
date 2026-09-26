import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { useClub } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { ClubOrder } from '../../types/clubPortal';

const Card: React.FC<{ title: string; value: string | number; valueColor?: string }> = ({ title, value, valueColor }) => (
  <div className="bg-white rounded-xl border border-zinc-200 p-4">
    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{title}</div>
    <div className="text-2xl font-black mt-1" style={valueColor ? { color: valueColor } : { color: '#18181b' }}>{value}</div>
  </div>
);

export const ClubOverviewPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
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

  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const balanceOwing = orders.reduce((sum, o) => sum + Number(o.balance_owing || 0), 0);
  const lastOrderDate = orders[0] ? new Date(orders[0].created_at).toLocaleDateString() : '—';

  return (
    <ClubPortalLayout club={club} activeNav="overview">
      {() => (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Overview</h2>
            <button
              onClick={() => navigate(`/portal/${club.slug}/order`)}
              className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
              style={{ backgroundColor: club.primary_color }}
            >
              <PlusCircle size={16} /> Place New Order
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card title="Active Orders" value={activeOrders.length} />
            <Card title="Balance Owing" value={`$${balanceOwing.toFixed(2)}`} valueColor={balanceOwing > 0 ? '#dc2626' : undefined} />
            <Card title="Last Order" value={lastOrderDate} />
            <Card title="Total Orders" value={orders.length} />
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Active Orders</h2>
              <button
                onClick={() => navigate(`/portal/${club.slug}/orders`)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-900 underline"
              >
                Full History
              </button>
            </div>

            {ordersLoading ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Loading orders...</p>
            ) : activeOrders.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No active orders.</p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between border border-zinc-100 rounded-lg p-3">
                    <div>
                      <p className="font-bold text-sm text-zinc-900">{order.order_number}</p>
                      <p className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ClubPortalLayout>
  );
};
