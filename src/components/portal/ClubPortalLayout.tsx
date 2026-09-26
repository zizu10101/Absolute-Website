import React, { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Club } from '../../hooks/useClub';
import { ClubSession, getClubSession, clearClubSession } from '../../utils/clubAuth';

type NavKey = 'dashboard' | 'overview' | 'order' | 'orders' | 'new-arrivals';

const NAV_ITEMS: { key: NavKey; label: string; path: (slug: string) => string }[] = [
  { key: 'dashboard', label: 'Home', path: slug => `/portal/${slug}/dashboard` },
  { key: 'overview', label: 'Overview', path: slug => `/portal/${slug}/overview` },
  { key: 'order', label: 'Orders', path: slug => `/portal/${slug}/order` },
  { key: 'orders', label: 'History', path: slug => `/portal/${slug}/orders` },
  { key: 'new-arrivals', label: 'New Arrivals', path: slug => `/portal/${slug}/new-arrivals` },
];

interface Props {
  club: Club;
  activeNav: NavKey;
  children: (session: ClubSession) => ReactNode;
}

export const ClubPortalLayout: React.FC<Props> = ({ club, activeNav, children }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<ClubSession | null | 'checking'>('checking');

  useEffect(() => {
    const s = getClubSession(club.slug);
    if (!s) {
      navigate('/portal', { replace: true });
    } else {
      setSession(s);
    }
  }, [club.slug, navigate]);

  const handleLogout = () => {
    clearClubSession(club.slug);
    navigate('/portal', { replace: true });
  };

  if (session === 'checking' || session === null) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header
        className="text-white sticky top-0 z-20 shadow-md"
        style={{ backgroundColor: club.primary_color }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {club.logo_url && (
              <img src={club.logo_url} alt={club.name} className="w-10 h-10 rounded-full object-contain bg-white p-1 shrink-0" />
            )}
            <span className="font-black uppercase tracking-tight truncate">{club.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest bg-black/20 hover:bg-black/30 px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => navigate(item.path(club.slug))}
              className={`px-3 py-2.5 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                activeNav === item.key ? 'border-white text-white' : 'border-transparent text-white/70 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children(session)}
      </main>
    </div>
  );
};
