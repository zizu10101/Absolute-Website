import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClub } from '../../hooks/useClub';
import { getClubSession } from '../../utils/clubAuth';
import { supabase } from '../../supabase';

export const ClubLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { club, isLoading, error } = useClub(slug);
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!club) return;
    if (!getClubSession(club.slug)) {
      navigate('/portal', { replace: true });
    }
  }, [club, navigate]);

  useEffect(() => {
    if (!club || (club.photos && club.photos.length > 0)) return;
    supabase
      .from('club_items')
      .select('image_url')
      .eq('club_id', club.id)
      .not('image_url', 'is', null)
      .limit(4)
      .then(({ data }) => {
        if (data) setItemPhotos(data.map((i: any) => i.image_url).filter(Boolean));
      });
  }, [club]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-white text-sm font-bold uppercase tracking-widest animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-center px-4">
        <div>
          <h1 className="text-white text-2xl font-black mb-2">Club Not Found</h1>
          <p className="text-zinc-400 text-sm">This club portal doesn't exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  if (!getClubSession(club.slug)) return null;

  const displayPhotos = (club.photos?.length > 0 ? club.photos : itemPhotos).filter(Boolean);

  return (
    <div className="h-screen overflow-hidden flex flex-col md:flex-row">

      {/* LEFT — Branding */}
      <div
        className="w-full md:w-1/2 h-[55vh] md:h-full flex flex-col items-center justify-center p-8 md:p-16 relative"
        style={{ backgroundColor: club.primary_color }}
      >
        {club.logo_url && (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-[280px] h-[280px] md:w-[440px] md:h-[440px] object-contain mb-10 drop-shadow-2xl"
          />
        )}
        <h1 className="text-white text-4xl md:text-5xl font-black text-center uppercase tracking-tight mb-2">
          {club.name}
        </h1>
        <p className="text-white/60 text-xs mb-10 tracking-[0.3em] uppercase font-bold">
          Your Club Portal
        </p>
        <button
          onClick={() => navigate(`/portal/${club.slug}/dashboard`)}
          className="bg-white font-black uppercase tracking-widest px-10 py-4 rounded-full text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          style={{ color: club.primary_color }}
        >
          Enter Portal →
        </button>
        <p className="text-white/25 text-[10px] mt-16 tracking-[0.25em] uppercase absolute bottom-6">
          Powered by Absolute Soccer
        </p>
      </div>

      {/* RIGHT — Photo Collage */}
      <div className="w-full md:w-1/2 h-[45vh] md:h-full">
        {displayPhotos.length >= 4 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
            {displayPhotos.slice(0, 4).map((photo, i) => (
              <div key={i} className="overflow-hidden">
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : displayPhotos.length === 3 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
            <div className="row-span-2 overflow-hidden">
              <img src={displayPhotos[0]} alt="" className="w-full h-full object-cover" />
            </div>
            {displayPhotos.slice(1).map((photo, i) => (
              <div key={i} className="overflow-hidden">
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : displayPhotos.length > 0 ? (
          <img
            src={displayPhotos[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: club.secondary_color || '#f0f0f0' }}
          />
        )}
      </div>

    </div>
  );
};
