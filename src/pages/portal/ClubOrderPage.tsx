import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { useClub } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { ClubItem, ClubOrderLineItem } from '../../types/clubPortal';
import { generateOrderNumber } from '../../utils/clubOrderNumber';

export const ClubOrderPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const preselectItemId = (location.state as { preselectItemId?: string } | null)?.preselectItemId;
  const { club, isLoading, error } = useClub(slug);
  const [items, setItems] = useState<ClubItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const didPreselect = useRef(false);

  useEffect(() => {
    if (!club) return;
    supabase
      .from('club_items')
      .select('*')
      .eq('club_id', club.id)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setItems((data || []) as unknown as ClubItem[]);
        setItemsLoading(false);
      });
  }, [club]);

  // "Request This Item" from New Arrivals: arrive here with a suggested item's id and
  // pre-fill qty 1 in its first size so the coach just has to confirm/adjust and submit.
  useEffect(() => {
    if (didPreselect.current || !preselectItemId || items.length === 0) return;
    const item = items.find(i => i.id === preselectItemId);
    const firstSize = item?.sizes_available?.[0];
    if (item && firstSize) {
      setQuantities(prev => ({ ...prev, [item.id]: { ...prev[item.id], [firstSize]: 1 } }));
    }
    didPreselect.current = true;
  }, [items, preselectItemId]);

  const regularItems = items.filter(i => !i.is_suggested);
  const preselectedSuggestedItem = items.find(i => i.id === preselectItemId && i.is_suggested);
  const displayedItems = preselectedSuggestedItem ? [...regularItems, preselectedSuggestedItem] : regularItems;

  const updateQty = (itemId: string, size: string, value: string) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    setQuantities(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [size]: qty },
    }));
  };

  const lineItems: ClubOrderLineItem[] = displayedItems.flatMap(item =>
    Object.entries(quantities[item.id] || {})
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => ({ name: item.name, size, qty, price: Number(item.price || 0) }))
  );

  const estimatedTotal = lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);

  const submitOrder = async () => {
    if (!club || estimatedTotal === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const orderNumber = await generateOrderNumber();
      const { error } = await supabase.from('club_orders').insert([{
        club_id: club.id,
        order_number: orderNumber,
        status: 'pending',
        items: lineItems,
        notes: notes.trim() || null,
        total_amount: estimatedTotal,
        deposit_paid: 0,
        balance_owing: estimatedTotal,
      }]);
      if (error) throw error;
      setConfirmedOrderNumber(orderNumber);
    } catch (err: any) {
      console.error('Error submitting club order:', err);
      setSubmitError(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading...</div>;
  }
  if (error || !club) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-600 font-bold">Club not found.</div>;
  }

  if (confirmedOrderNumber) {
    return (
      <ClubPortalLayout club={club} activeNav="order">
        {() => (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <CheckCircle2 size={56} className="text-emerald-600 mb-4" />
            <h2 className="text-xl font-black text-zinc-900 mb-1">Order Submitted!</h2>
            <p className="text-zinc-500 text-sm mb-6">Order <span className="font-bold">{confirmedOrderNumber}</span> has been sent to the store for review.</p>
            <button
              onClick={() => navigate(`/portal/${club.slug}/orders`)}
              className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-white"
              style={{ backgroundColor: club.primary_color }}
            >
              View Order History
            </button>
          </div>
        )}
      </ClubPortalLayout>
    );
  }

  return (
    <ClubPortalLayout club={club} activeNav="order">
      {() => (
        <div className="pb-28">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">New Order</h2>

          {itemsLoading ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Loading items...</p>
          ) : displayedItems.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">No items available to order yet.</p>
          ) : (
            displayedItems.map(item => (
              <div key={item.id} className="border border-zinc-200 rounded-xl p-4 mb-4 bg-white">
                <div className="flex gap-4">
                  <img
                    src={item.image_url || ''}
                    alt={item.name}
                    className="w-24 h-24 object-contain bg-[#f6f6f6] rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900">{item.name}</h3>
                    <p className="text-sm text-zinc-500">${Number(item.price || 0).toFixed(2)}/unit</p>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {(item.sizes_available || []).map(size => (
                        <div key={size} className="text-center">
                          <label className="text-xs text-zinc-500">{size}</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={quantities[item.id]?.[size] || ''}
                            onChange={e => updateQty(item.id, size, e.target.value)}
                            className="w-full border border-zinc-200 rounded text-center p-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          <textarea
            placeholder="Any special instructions? (names, numbers, home/away, delivery date needed...)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-zinc-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />

          {submitError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{submitError}</div>
          )}

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 z-30">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
              <div>
                <p className="text-sm text-zinc-500">Estimated Total</p>
                <p className="text-2xl font-black text-zinc-900">${estimatedTotal.toFixed(2)}</p>
                <p className="text-xs text-zinc-400">* Final price confirmed by store</p>
              </div>
              <button
                onClick={submitOrder}
                disabled={estimatedTotal === 0 || isSubmitting}
                className="text-white font-bold px-8 py-3 rounded-xl disabled:opacity-40 transition-opacity whitespace-nowrap"
                style={{ backgroundColor: club.primary_color }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ClubPortalLayout>
  );
};
