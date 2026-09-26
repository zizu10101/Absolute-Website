import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Upload, Package, ClipboardList, RefreshCw } from 'lucide-react';
import { supabase, uploadImage } from '../supabase';
import { compressToWebP } from '../lib/imageUtils';
import { slugify } from '../utils/slugify';
import { StatusBadge, ORDER_STATUSES } from './portal/StatusBadge';
import { ClubItem, ClubOrder } from '../types/clubPortal';

interface Club {
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
  username: string;
  is_active: boolean;
  created_at: string;
}

// Every field except password_hash - it never needs to reach the browser (mutations go
// through /api/clubs, which hashes server-side).
const CLUB_COLUMNS = 'id, name, slug, logo_url, primary_color, secondary_color, photos, contact_name, contact_email, contact_phone, username, is_active, created_at';

const EMPTY_CLUB_FORM = {
  id: null as string | null,
  name: '',
  slug: '',
  logo_url: '',
  primary_color: '#b90014',
  secondary_color: '#ffffff',
  photos: [] as string[],
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  username: '',
  password: '',
  is_active: true,
};

const EMPTY_ITEM_FORM = {
  id: null as string | null,
  name: '',
  description: '',
  image_url: '',
  sizes_available: [] as string[],
  price: '',
  is_suggested: false,
};

async function apiCall(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const ClubsAdmin: React.FC = () => {
  const [view, setView] = useState<'clubs' | 'orders'>('clubs');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showClubForm, setShowClubForm] = useState(false);
  const [clubForm, setClubForm] = useState(EMPTY_CLUB_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSavingClub, setIsSavingClub] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [managingItemsFor, setManagingItemsFor] = useState<Club | null>(null);

  const loadClubs = useCallback(async () => {
    setClubsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('clubs').select(CLUB_COLUMNS).order('created_at', { ascending: false });
      if (error) throw error;
      setClubs((data || []) as unknown as Club[]);
    } catch (err: any) {
      setError(
        err?.message?.includes('relation "clubs" does not exist')
          ? 'Table "clubs" not found. Run docs/club-portal-migration.sql in Supabase first.'
          : (err?.message || 'Failed to load clubs')
      );
    } finally {
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const openNewClub = () => {
    setClubForm(EMPTY_CLUB_FORM);
    setSlugTouched(false);
    setError(null);
    setShowClubForm(true);
  };

  const openEditClub = (club: Club) => {
    setClubForm({
      id: club.id,
      name: club.name,
      slug: club.slug,
      logo_url: club.logo_url || '',
      primary_color: club.primary_color || '#b90014',
      secondary_color: club.secondary_color || '#ffffff',
      photos: club.photos || [],
      contact_name: club.contact_name || '',
      contact_email: club.contact_email || '',
      contact_phone: club.contact_phone || '',
      username: club.username,
      password: '',
      is_active: club.is_active,
    });
    setSlugTouched(true);
    setError(null);
    setShowClubForm(true);
  };

  const handleNameChange = (name: string) => {
    setClubForm(prev => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressToWebP(reader.result as string, 400, 400, 0.9, true);
        const path = `clubs/logo_${Date.now()}.webp`;
        const publicUrl = await uploadImage(compressed, path);
        setClubForm(prev => ({ ...prev, logo_url: publicUrl }));
      } catch (err) {
        console.error('Club logo upload failed:', err);
        alert('Failed to upload logo');
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressToWebP(reader.result as string, 1000, 1000, 0.85);
        const path = `clubs/photo_${Date.now()}.webp`;
        const publicUrl = await uploadImage(compressed, path);
        setClubForm(prev => ({ ...prev, photos: [...prev.photos, publicUrl] }));
      } catch (err) {
        console.error('Club photo upload failed:', err);
        alert('Failed to upload photo');
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setClubForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSaveClub = async () => {
    if (!clubForm.name.trim()) return setError('Club name is required.');
    const finalSlug = slugify(clubForm.slug || clubForm.name);
    if (!finalSlug) return setError('A valid slug is required.');
    if (!clubForm.username.trim()) return setError('Username is required.');
    if (!clubForm.id && !clubForm.password.trim()) return setError('Password is required for a new club.');

    setIsSavingClub(true);
    setError(null);
    try {
      const payload: any = {
        name: clubForm.name.trim(),
        slug: finalSlug,
        logo_url: clubForm.logo_url || null,
        primary_color: clubForm.primary_color,
        secondary_color: clubForm.secondary_color,
        photos: clubForm.photos,
        contact_name: clubForm.contact_name.trim() || null,
        contact_email: clubForm.contact_email.trim() || null,
        contact_phone: clubForm.contact_phone.trim() || null,
        username: clubForm.username.trim(),
        is_active: clubForm.is_active,
      };
      if (clubForm.password.trim()) payload.password = clubForm.password.trim();

      if (clubForm.id) {
        await apiCall(`/api/clubs/${clubForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiCall('/api/clubs', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowClubForm(false);
      await loadClubs();
    } catch (err: any) {
      console.error('Error saving club:', err);
      setError(err.message || 'Failed to save club.');
    } finally {
      setIsSavingClub(false);
    }
  };

  const handleDeleteClub = async (club: Club) => {
    if (!window.confirm(`Delete "${club.name}"? This removes their portal, items and order history. This cannot be undone.`)) return;
    try {
      await apiCall(`/api/clubs/${club.id}`, { method: 'DELETE' });
      setClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (err: any) {
      console.error('Error deleting club:', err);
      alert(err.message || 'Failed to delete club.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Club Portal</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setView('clubs')}
            className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all ${view === 'clubs' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            Clubs
          </button>
          <button
            onClick={() => setView('orders')}
            className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all ${view === 'orders' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            Orders
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm font-bold">{error}</div>
      )}

      {view === 'clubs' ? (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-200">
            <p className="text-xs text-zinc-500">{clubs.length} club{clubs.length === 1 ? '' : 's'}</p>
            <button
              onClick={openNewClub}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-900 text-white hover:bg-zinc-800"
            >
              <Plus size={14} /> Add New Club
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <th className="py-2 px-3">Club</th>
                  <th className="py-2 px-3">Portal URL</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!clubsLoading && clubs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-zinc-400">No clubs yet</td></tr>
                )}
                {clubs.map((club, idx) => (
                  <tr key={club.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {club.logo_url ? (
                          <img src={club.logo_url} alt="" className="w-8 h-8 object-contain rounded bg-zinc-100" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-200" />
                        )}
                        <span className="font-bold text-zinc-900">{club.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">/portal/{club.slug}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${club.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {club.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setManagingItemsFor(club)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1">
                          <Package size={12} /> Items
                        </button>
                        <button onClick={() => openEditClub(club)} className="text-zinc-500 hover:text-zinc-900" aria-label="Edit club">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDeleteClub(club)} className="text-red-500 hover:text-red-700" aria-label="Delete club">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ClubOrdersManager clubs={clubs} />
      )}

      {showClubForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">{clubForm.id ? 'Edit Club' : 'Add New Club'}</h3>
              <button onClick={() => setShowClubForm(false)} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-900">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{error}</div>}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Club Name</label>
                <input
                  type="text"
                  value={clubForm.name}
                  onChange={e => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Slug</label>
                <input
                  type="text"
                  value={clubForm.slug}
                  onChange={e => { setSlugTouched(true); setClubForm(prev => ({ ...prev, slug: e.target.value })); }}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <p className="text-[10px] text-zinc-400 mt-1">torontosoccershop.com/portal/{slugify(clubForm.slug || clubForm.name) || '...'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Logo</label>
                <div className="flex items-center gap-3">
                  {clubForm.logo_url && <img src={clubForm.logo_url} alt="" className="w-16 h-16 object-contain rounded bg-zinc-100" />}
                  <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 flex items-center gap-2">
                    <Upload size={14} /> {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" disabled={isUploadingLogo} onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={clubForm.primary_color} onChange={e => setClubForm(prev => ({ ...prev, primary_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer p-1 bg-white" />
                    <input type="text" value={clubForm.primary_color} onChange={e => setClubForm(prev => ({ ...prev, primary_color: e.target.value }))} className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={clubForm.secondary_color} onChange={e => setClubForm(prev => ({ ...prev, secondary_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer p-1 bg-white" />
                    <input type="text" value={clubForm.secondary_color} onChange={e => setClubForm(prev => ({ ...prev, secondary_color: e.target.value }))} className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Landing Page Photos</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {clubForm.photos.map((photo, i) => (
                    <div key={i} className="relative group">
                      <img src={photo} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="cursor-pointer inline-flex bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 items-center gap-2">
                  <Upload size={14} /> {isUploadingPhoto ? 'Uploading...' : 'Add Photo'}
                  <input type="file" accept="image/*" className="hidden" disabled={isUploadingPhoto} onChange={handlePhotoUpload} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Contact Name</label>
                  <input type="text" value={clubForm.contact_name} onChange={e => setClubForm(prev => ({ ...prev, contact_name: e.target.value }))} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Contact Email</label>
                  <input type="email" value={clubForm.contact_email} onChange={e => setClubForm(prev => ({ ...prev, contact_email: e.target.value }))} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Contact Phone</label>
                  <input type="text" value={clubForm.contact_phone} onChange={e => setClubForm(prev => ({ ...prev, contact_phone: e.target.value }))} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Username</label>
                  <input type="text" value={clubForm.username} onChange={e => setClubForm(prev => ({ ...prev, username: e.target.value }))} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                    Password {clubForm.id && <span className="normal-case font-normal text-zinc-400">(leave blank to keep current)</span>}
                  </label>
                  <input type="text" value={clubForm.password} onChange={e => setClubForm(prev => ({ ...prev, password: e.target.value }))} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input type="checkbox" checked={clubForm.is_active} onChange={e => setClubForm(prev => ({ ...prev, is_active: e.target.checked }))} className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-700">Active (club can log in)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowClubForm(false)} className="px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs text-zinc-600 hover:bg-zinc-100">Cancel</button>
              <button onClick={handleSaveClub} disabled={isSavingClub} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 disabled:opacity-50">
                <Save size={14} /> {isSavingClub ? 'Saving...' : 'Save Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {managingItemsFor && (
        <ClubItemsManager club={managingItemsFor} onClose={() => setManagingItemsFor(null)} />
      )}
    </div>
  );
};

const ClubItemsManager: React.FC<{ club: Club; onClose: () => void }> = ({ club, onClose }) => {
  const [items, setItems] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sizeInput, setSizeInput] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('club_items').select('*').eq('club_id', club.id).order('sort_order', { ascending: true });
      if (error) throw error;
      setItems((data || []) as unknown as ClubItem[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [club.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openNewItem = () => {
    setForm(EMPTY_ITEM_FORM);
    setSizeInput('');
    setShowForm(true);
  };

  const openEditItem = (item: ClubItem) => {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || '',
      image_url: item.image_url || '',
      sizes_available: item.sizes_available || [],
      price: String(item.price ?? ''),
      is_suggested: item.is_suggested,
    });
    setSizeInput((item.sizes_available || []).join(', '));
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressToWebP(reader.result as string, 800, 800, 0.85);
        const path = `clubs/items/${Date.now()}.webp`;
        const publicUrl = await uploadImage(compressed, path);
        setForm(prev => ({ ...prev, image_url: publicUrl }));
      } catch (err) {
        console.error('Club item image upload failed:', err);
        alert('Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveItem = async () => {
    if (!form.name.trim()) return setError('Item name is required.');
    setIsSaving(true);
    setError(null);
    try {
      const sizes = sizeInput.split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        club_id: club.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url || null,
        sizes_available: sizes,
        price: form.price ? Number(form.price) : 0,
        is_suggested: form.is_suggested,
        sort_order: items.length,
      };
      if (form.id) {
        await apiCall(`/api/club-items/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiCall('/api/club-items', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: ClubItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await apiCall(`/api/club-items/${item.id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">{club.name} — Items</h3>
            <p className="text-xs text-zinc-500">{items.length} item{items.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openNewItem} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-900 text-white hover:bg-zinc-800">
              <Plus size={14} /> Add Item
            </button>
            <button onClick={onClose} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-900">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{error}</div>}
          {loading ? (
            <p className="text-center text-zinc-400 py-8">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-zinc-400 py-8">No items yet for this club.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <div key={item.id} className="border border-zinc-200 rounded-lg p-3 flex gap-3">
                  <img src={item.image_url || ''} alt="" className="w-16 h-16 object-contain bg-[#f6f6f6] rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-zinc-900 truncate">{item.name}</p>
                      {item.is_suggested && <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Suggested</span>}
                    </div>
                    <p className="text-xs text-zinc-500">${Number(item.price || 0).toFixed(2)}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{(item.sizes_available || []).join(', ') || 'No sizes set'}</p>
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => openEditItem(item)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline">Edit</button>
                      <button onClick={() => handleDeleteItem(item)} className="text-[11px] font-bold text-red-600 hover:text-red-700 underline">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-zinc-100">
                <h4 className="font-black uppercase tracking-tight text-zinc-900">{form.id ? 'Edit Item' : 'Add Item'}</h4>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-zinc-500" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Image</label>
                  <label className="cursor-pointer border-2 border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl p-4 text-center block transition-colors">
                    {isUploading ? (
                      <div className="text-zinc-400 py-8">
                        <p className="text-sm font-bold">Uploading...</p>
                      </div>
                    ) : form.image_url ? (
                      <img src={form.image_url} alt="" className="w-full h-48 object-contain bg-[#f6f6f6] rounded-lg" />
                    ) : (
                      <div className="text-zinc-400 py-8">
                        <Upload size={24} className="mx-auto mb-2" />
                        <p className="text-sm">Upload item image</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={handleImageUpload} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Price</label>
                    <input type="number" step="0.01" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Sizes (comma separated)</label>
                    <input type="text" value={sizeInput} onChange={e => setSizeInput(e.target.value)} placeholder="S, M, L, XL" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.is_suggested} onChange={e => setForm(prev => ({ ...prev, is_suggested: e.target.checked }))} className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-700">Suggested upsell item (shown under "You Might Also Like")</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-100">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs text-zinc-600 hover:bg-zinc-100">Cancel</button>
                <button onClick={handleSaveItem} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 disabled:opacity-50">
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type OrderWithClub = ClubOrder & { club?: { name: string; slug: string } };

const ClubOrdersManager: React.FC<{ clubs: Club[] }> = ({ clubs }) => {
  const [orders, setOrders] = useState<OrderWithClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubFilter, setClubFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingOrder, setEditingOrder] = useState<OrderWithClub | null>(null);
  const [orderForm, setOrderForm] = useState({ status: 'pending', total_amount: '', deposit_paid: '', invoice_url: '' });
  const [isSaving, setIsSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('club_orders')
        .select('*, club:clubs(name, slug)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data || []) as unknown as OrderWithClub[]);
    } catch (err: any) {
      setError(
        err?.message?.includes('relation "club_orders" does not exist')
          ? 'Table "club_orders" not found. Run docs/club-portal-migration.sql in Supabase first.'
          : (err?.message || 'Failed to load orders')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openEditOrder = (order: OrderWithClub) => {
    setEditingOrder(order);
    setOrderForm({
      status: order.status,
      total_amount: String(order.total_amount ?? 0),
      deposit_paid: String(order.deposit_paid ?? 0),
      invoice_url: order.invoice_url || '',
    });
  };

  const handleSaveOrder = async () => {
    if (!editingOrder) return;
    setIsSaving(true);
    try {
      await apiCall(`/api/club-orders/${editingOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: orderForm.status,
          total_amount: Number(orderForm.total_amount) || 0,
          deposit_paid: Number(orderForm.deposit_paid) || 0,
          invoice_url: orderForm.invoice_url.trim() || null,
        }),
      });
      setEditingOrder(null);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update order.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (clubFilter !== 'all' && o.club_id !== clubFilter) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <select value={clubFilter} onChange={e => setClubFilter(e.target.value)} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm">
            <option value="all">All Clubs</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-zinc-200 rounded-lg text-sm">
            <option value="all">All Statuses</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button onClick={loadOrders} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm font-bold">{error}</div>}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <th className="py-2 px-3">Order #</th>
                <th className="py-2 px-3">Club</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Total</th>
                <th className="py-2 px-3 text-right">Balance</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredOrders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-zinc-400">No orders found</td></tr>
              )}
              {filteredOrders.map((order, idx) => (
                <tr key={order.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{order.order_number}</td>
                  <td className="py-2 px-3 text-zinc-700">{order.club?.name || '—'}</td>
                  <td className="py-2 px-3 text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-3"><StatusBadge status={order.status} /></td>
                  <td className="py-2 px-3 text-right text-zinc-700">${Number(order.total_amount || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-red-600">${Number(order.balance_owing || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => openEditOrder(order)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1 ml-auto">
                      <ClipboardList size={12} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h4 className="font-black uppercase tracking-tight text-zinc-900">Order {editingOrder.order_number}</h4>
              <button onClick={() => setEditingOrder(null)}><X size={18} className="text-zinc-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                {(editingOrder.items || []).map((li, i) => (
                  <p key={i} className="text-sm text-zinc-700">{li.name} - {li.size} x{li.qty} (${li.price.toFixed(2)})</p>
                ))}
              </div>
              {editingOrder.notes && <p className="text-xs text-zinc-400 italic border-t border-zinc-100 pt-2">"{editingOrder.notes}"</p>}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Status</label>
                <select value={orderForm.status} onChange={e => setOrderForm(prev => ({ ...prev, status: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm">
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Total Amount</label>
                  <input type="number" step="0.01" value={orderForm.total_amount} onChange={e => setOrderForm(prev => ({ ...prev, total_amount: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Deposit Paid</label>
                  <input type="number" step="0.01" value={orderForm.deposit_paid} onChange={e => setOrderForm(prev => ({ ...prev, deposit_paid: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Balance owing: <span className="font-bold text-red-600">
                  ${Math.max(0, (Number(orderForm.total_amount) || 0) - (Number(orderForm.deposit_paid) || 0)).toFixed(2)}
                </span>
              </p>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Invoice URL</label>
                <input type="text" value={orderForm.invoice_url} onChange={e => setOrderForm(prev => ({ ...prev, invoice_url: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" placeholder="https://..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-100">
              <button onClick={() => setEditingOrder(null)} className="px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs text-zinc-600 hover:bg-zinc-100">Cancel</button>
              <button onClick={handleSaveOrder} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 disabled:opacity-50">
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
