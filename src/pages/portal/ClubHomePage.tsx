import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useClub } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { ClubItem } from '../../types/clubPortal';

export const ClubHomePage: React.FC = () => {
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
      .eq('is_suggested', false)
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

  return (
    <ClubPortalLayout club={club} activeNav="dashboard">
      {() => (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Your Team Apparel</h2>
            <span className="text-xs text-zinc-400">{items.length} item{items.length === 1 ? '' : 's'}</span>
          </div>

          {itemsLoading ? (
            <p className="text-sm text-zinc-400 py-8 text-center">Loading apparel...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">No items set up for your club yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/portal/${club.slug}/order`)}
                  className="text-left rounded-xl overflow-hidden shadow bg-white border border-zinc-100 hover:shadow-lg transition-shadow"
                >
                  <img
                    src={item.image_url || ''}
                    alt={item.name}
                    className="w-full aspect-square object-contain bg-[#f6f6f6]"
                  />
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-zinc-900 truncate">{item.name}</h3>
                    <p className="font-bold mt-0.5" style={{ color: club.primary_color }}>
                      ${Number(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ClubPortalLayout>
  );
};
