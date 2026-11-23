-- Storage RLS policies for the media bucket on self-hosted Supabase.
-- Rerunnable: each policy is dropped before creation.

-- Public read: anon + authenticated
DROP POLICY IF EXISTS "media public select" ON storage.objects;
CREATE POLICY "media public select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');

-- Public upload: anon + authenticated
DROP POLICY IF EXISTS "media public insert" ON storage.objects;
CREATE POLICY "media public insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'media');

-- service_role full write access
DROP POLICY IF EXISTS "media service_role insert" ON storage.objects;
CREATE POLICY "media service_role insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media service_role update" ON storage.objects;
CREATE POLICY "media service_role update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media service_role delete" ON storage.objects;
CREATE POLICY "media service_role delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'media');
