import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useClub } from '../../hooks/useClub';
import { getClubSession } from '../../utils/clubAuth';

// Gated behind login: this is the branded "welcome" screen a club sees right after
// authenticating, not a public marketing splash. Visiting /portal/:slug while logged out
// redirects to the universal /portal login instead of showing this page.
export const ClubLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { club, isLoading, error } = useClub(slug);

  useEffect(() => {
    if (!club) return;
    if (!getClubSession(club.slug)) {
      navigate('/portal', { replace: true });
    }
  }, [club, navigate]);

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

  const enterPortal = () => navigate(`/portal/${club.slug}/dashboard`);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center relative overflow-hidden"
      style={{
        background: club.primary_color,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 24px)',
      }}
    >
      {club.logo_url && (
        <img src={club.logo_url} alt={club.name} className="w-32 h-32 md:w-48 md:h-48 object-contain mx-auto mb-6 drop-shadow-lg" />
      )}
      <h1 className="text-white text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">{club.name}</h1>
      <p className="text-white/70 text-sm md:text-base mb-10 uppercase tracking-widest font-bold">Team Store Portal</p>

      {club.photos && club.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-w-2xl w-full mb-10">
          {club.photos.slice(0, 6).map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt=""
              className="w-full aspect-square object-cover rounded-lg shadow-md"
            />
          ))}
        </div>
      )}

      <button
        onClick={enterPortal}
        className="flex items-center gap-2 bg-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-105 transition-transform"
        style={{ color: club.primary_color }}
      >
        Enter Portal <ArrowRight size={18} />
      </button>
    </div>
  );
};
