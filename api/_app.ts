import express from 'express';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log('Express received:', req.method, req.url);
  next();
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

// --- CLUB PORTAL ---

app.post('/club-login', async (req, res) => {
  const { slug, username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    let query = supabase.from('clubs').select('*').eq('username', username);
    if (slug) query = query.eq('slug', slug);
    const { data: club, error } = await query.maybeSingle();
    if (error) throw error;
    if (!club || !club.is_active) return res.status(401).json({ error: 'Invalid username or password' });
    const valid = await bcrypt.compare(password, club.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });
    const { password_hash: _ph, username: _u, ...safeClub } = club;
    return res.json({ success: true, club: safeClub });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

app.post('/clubs', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { password, ...clubData } = req.body || {};
  if (!clubData.name || !clubData.slug || !clubData.username || !password)
    return res.status(400).json({ error: 'Name, slug, username and password are required' });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('clubs').insert([{ ...clubData, password_hash }]).select();
    if (error) throw error;
    const created = data?.[0];
    if (created) delete created.password_hash;
    return res.json(created);
  } catch (err: any) {
    if (err.message?.includes('duplicate')) return res.status(409).json({ error: 'That slug or username is already in use.' });
    res.status(500).json({ error: err.message || 'Failed to create club' });
  }
});

app.put('/clubs/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { id } = req.params;
  const { password, ...clubData } = req.body || {};
  delete clubData.id;
  try {
    const payload: any = { ...clubData };
    if (password && password.trim()) payload.password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('clubs').update(payload).eq('id', id).select();
    if (error) throw error;
    const updated = data?.[0];
    if (updated) delete updated.password_hash;
    return res.json(updated);
  } catch (err: any) {
    if (err.message?.includes('duplicate')) return res.status(409).json({ error: 'That slug or username is already in use.' });
    res.status(500).json({ error: err.message || 'Failed to update club' });
  }
});

app.delete('/clubs/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { id } = req.params;
  try {
    const { error } = await supabase.from('clubs').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete club' });
  }
});

app.get('/club-items', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { club_id } = req.query;
  if (!club_id) return res.status(400).json({ error: 'club_id is required' });
  try {
    const { data, error } = await supabase.from('club_items').select('*').eq('club_id', club_id).order('sort_order');
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch items' });
  }
});

app.post('/club-items', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const itemData = req.body || {};
  if (!itemData.club_id || !itemData.name) return res.status(400).json({ error: 'club_id and name are required' });
  try {
    const { data, error } = await supabase.from('club_items').insert([itemData]).select();
    if (error) throw error;
    return res.json(data?.[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create item' });
  }
});

app.put('/club-items/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { id } = req.params;
  const itemData = { ...(req.body || {}) };
  delete itemData.id;
  try {
    const { data, error } = await supabase.from('club_items').update(itemData).eq('id', id).select();
    if (error) throw error;
    return res.json(data?.[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update item' });
  }
});

app.delete('/club-items/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { id } = req.params;
  try {
    const { error } = await supabase.from('club_items').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete item' });
  }
});

app.put('/club-orders/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { id } = req.params;
  const updateData = { ...(req.body || {}) };
  delete updateData.id;
  try {
    const { data: existing, error: fetchErr } = await supabase.from('club_orders').select('*').eq('id', id).single();
    if (fetchErr) throw fetchErr;
    const totalAmount = updateData.total_amount !== undefined ? Number(updateData.total_amount) : Number(existing.total_amount || 0);
    const depositPaid = updateData.deposit_paid !== undefined ? Number(updateData.deposit_paid) : Number(existing.deposit_paid || 0);
    updateData.balance_owing = Math.max(0, totalAmount - depositPaid);
    if (updateData.status === 'confirmed' && !existing.confirmed_at) updateData.confirmed_at = new Date().toISOString();
    const { data, error } = await supabase.from('club_orders').update(updateData).eq('id', id).select();
    if (error) throw error;
    return res.json(data?.[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update order' });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});

export default app;
