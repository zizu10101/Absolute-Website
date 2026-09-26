import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export interface Club {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  photos: string[];
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

// Never selects password_hash or username - portal/public pages have no reason to
// see them even though anon SELECT is granted on the whole clubs table.
const PUBLIC_CLUB_COLUMNS = 'id, name, slug, logo_url, primary_color, secondary_color, photos, contact_name, contact_email, contact_phone, is_active, created_at';

export function useClub(slug: string | undefined) {
  const [club, setClub] = useState<Club | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setError('No club specified');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    supabase
      .from('clubs')
      .select(PUBLIC_CLUB_COLUMNS)
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else if (!data) {
          setError('Club not found');
        } else {
          setClub(data as unknown as Club);
        }
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  return { club, isLoading, error };
}
