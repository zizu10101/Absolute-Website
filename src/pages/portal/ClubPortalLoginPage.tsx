import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setClubSession } from '../../utils/clubAuth';

// Single entry point for every club: /portal. Looks a club up by username alone (globally
// unique - see docs/club-portal-migration.sql) and redirects to that club's branded landing
// page, so coaches don't need to know or type their club's slug/URL.
export const ClubPortalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/club-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setClubSession({
        clubId: data.club.id,
        clubSlug: data.club.slug,
        clubName: data.club.name,
        logoUrl: data.club.logo_url,
        primaryColor: data.club.primary_color,
        secondaryColor: data.club.secondary_color,
      });
      navigate(`/portal/${data.club.slug}`, { replace: true });
    } catch (err) {
      console.error('Club portal login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center bg-[var(--primary-color)]">
          <h1 className="text-white font-black uppercase tracking-tight text-lg">Club Portal</h1>
          <p className="text-white/70 text-xs uppercase tracking-widest font-bold mt-1">Team Store Login</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{error}</div>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg font-black uppercase tracking-widest text-sm text-white bg-[var(--primary-color)] transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
