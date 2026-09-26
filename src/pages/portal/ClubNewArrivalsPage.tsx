import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { supabase } from '../../supabase';
import { useClub } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { ClubItem } from '../../types/clubPortal';

export const ClubNewArrivalsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { club, isLoading, error } = useClub(slug);
  const [items, setItems] = useState<ClubItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    if (!club) return;
    supabase
      .from('club_items')
      .select('*')
      .eq('club_id', club.id)
      .eq('is_suggested', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setItems((data || []) as unknown as ClubItem[]);
        setItemsLoading(false);
      });
  }, [club]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading...</div>;
  }
  if (error || !club) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-600 font-bold">Club not found.</div>;
  }

  const requestItem = (item: ClubItem) => {
    navigate(`/portal/${club.slug}/order`, { state: { preselectItemId: item.id } });
  };

  return (
    <ClubPortalLayout club={club} activeNav="new-arrivals">
      {() => (
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">New Arrivals</h2>

          {itemsLoading ? (
            <p className="text-sm text-zinc-400 py-8 text-center">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">No new items available right now.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id} className="rounded-xl overflow-hidden shadow bg-white border border-zinc-100 relative flex flex-col">
                  <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                    <Star size={10} fill="currentColor" /> New
                  </span>
                  <img
                    src={item.image_url || ''}
                    alt={item.name}
                    className="w-full aspect-square object-contain bg-[#f6f6f6]"
                  />
                  <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-bold text-sm text-zinc-900">{item.name}</h3>
                    {item.description && <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>}
                    <p className="font-bold text-zinc-900 mt-1">${Number(item.price || 0).toFixed(2)}/unit</p>
                    <p className="text-xs text-emerald-700 font-bold mt-1">Available with your logo</p>
                    <button
                      onClick={() => requestItem(item)}
                      className="mt-auto pt-3 w-full text-white font-bold text-xs uppercase tracking-widest py-2.5 rounded-lg"
                      style={{ backgroundColor: club.primary_color }}
                    >
                      Request This Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ClubPortalLayout>
  );
};
