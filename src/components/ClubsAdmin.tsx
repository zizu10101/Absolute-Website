import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Upload, Package, ClipboardList, RefreshCw, FileText, ChevronLeft, GripVertical } from 'lucide-react';
import { supabase, uploadImage } from '../supabase';
import { compressToWebP } from '../lib/imageUtils';
import { slugify } from '../utils/slugify';
import { StatusBadge, ORDER_STATUSES } from './portal/StatusBadge';
import { ClubItem, ClubOrder, PrintType, PrintAddon } from '../types/clubPortal';
import bcrypt from 'bcryptjs';
import { generateInvoiceHTML, printInvoice } from '../utils/invoice';

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
  discount_value: '',
  discount_type: '%' as '%' | '$',
  is_suggested: false,
  print_addons: [] as PrintAddon[],
};

function getSizesForCategory(category: string): string[] {
  if (category === 'Adult') return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
  if (category === 'Youth') return ['YXS', 'YS', 'YM', 'YL', 'YXL'];
  if (category === 'Adult Footwear') {
    const sizes: string[] = [];
    for (let s = 3; s <= 15; s += 0.5) sizes.push(s % 1 === 0 ? s.toString() : s.toFixed(1));
    return sizes;
  }
  if (category === 'Youth Footwear') return [
    '8K','8.5K','9K','9.5K','10K','10.5K','11K','11.5K','12K','12.5K','13K','13.5K',
    '1Y','1.5Y','2Y','2.5Y','3Y','3.5Y','4Y','4.5Y','5Y','5.5Y','6Y','6.5Y','7Y',
  ];
  if (category === 'Gloves') return ['3','4','5','6','7','8','9','10','11'];
  if (category === 'One Size') return ['One Size'];
  return [];
}


export const ClubsAdmin: React.FC = () => {
  const [view, setView] = useState<'clubs' | 'orders' | 'print_types'>('clubs');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const [showClubForm, setShowClubForm] = useState(false);
  const [clubForm, setClubForm] = useState(EMPTY_CLUB_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSavingClub, setIsSavingClub] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [managingItemsFor, setManagingItemsFor] = useState<Club | null>(null);
  const [viewingOrdersFor, setViewingOrdersFor] = useState<Club | null>(null);

  const loadClubs = useCallback(async (): Promise<Club[]> => {
    setClubsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('clubs').select(CLUB_COLUMNS).order('created_at', { ascending: false });
      if (error) throw error;
      const fresh = (data || []) as unknown as Club[];
      setClubs(fresh);
      return fresh;
    } catch (err: any) {
      setError(
        err?.message?.includes('relation "clubs" does not exist')
          ? 'Table "clubs" not found. Run docs/club-portal-migration.sql in Supabase first.'
          : (err?.message || 'Failed to load clubs')
      );
      return [];
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
      if (clubForm.id) {
        const updatePayload: any = { ...payload };
        if (clubForm.password.trim()) updatePayload.password_hash = await bcrypt.hash(clubForm.password.trim(), 10);
        const { error } = await supabase.from('clubs').update(updatePayload).eq('id', clubForm.id);
        if (error) throw error;
      } else {
        const password_hash = await bcrypt.hash(clubForm.password.trim(), 10);
        const { error } = await supabase.from('clubs').insert([{ ...payload, password_hash }]);
        if (error) throw error;
      }
      setShowClubForm(false);
      const fresh = await loadClubs();
      if (selectedClub && clubForm.id === selectedClub.id) {
        const updated = fresh.find(c => c.id === clubForm.id);
        if (updated) setSelectedClub(updated);
      }
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
      const { error } = await supabase.from('clubs').delete().eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (err: any) {
      console.error('Error deleting club:', err);
      alert(err.message || 'Failed to delete club.');
    }
  };

  return (
    <div className="space-y-6">

      {selectedClub ? (
        <ClubDashboard
          key={selectedClub.id}
          club={selectedClub}
          onBack={() => setSelectedClub(null)}
          onEdit={() => openEditClub(selectedClub)}
          onManageItems={() => setManagingItemsFor(selectedClub)}
        />
      ) : (
        <>
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
              <button
                onClick={() => setView('print_types')}
                className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all ${view === 'print_types' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
              >
                Print Types
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
                      <tr key={club.id} className={`${idx % 2 === 0 ? 'bg-zinc-50' : ''} hover:bg-zinc-100/60 cursor-pointer`} onClick={() => setSelectedClub(club)}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {club.logo_url ? (
                              <img src={club.logo_url} alt="" className="w-8 h-8 object-contain rounded bg-zinc-100" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-zinc-200" />
                            )}
                            <span className="font-bold text-zinc-900 hover:underline">{club.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-zinc-500 font-mono text-xs">/portal/{club.slug}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${club.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {club.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setManagingItemsFor(club)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1">
                              <Package size={12} /> Items
                            </button>
                            <button onClick={() => setViewingOrdersFor(club)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1">
                              <ClipboardList size={12} /> Orders
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
          ) : view === 'orders' ? (
            <ClubOrdersManager clubs={clubs} />
          ) : (
            <PrintTypesManager />
          )}
        </>
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
      {viewingOrdersFor && (
        <ClubOrdersPerClub club={viewingOrdersFor} onClose={() => setViewingOrdersFor(null)} />
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
  const [sizeCategory, setSizeCategory] = useState('');
  const [printTypes, setPrintTypes] = useState<PrintType[]>([]);

  useEffect(() => {
    supabase.from('print_types').select('*').order('sort_order').then(({ data }) => setPrintTypes((data || []) as PrintType[]));
  }, []);

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
    setSizeCategory('');
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
      discount_value: item.discount_value != null ? String(item.discount_value) : '',
      discount_type: (item.discount_type === '$' ? '$' : '%') as '%' | '$',
      is_suggested: item.is_suggested,
      print_addons: item.print_addons || [],
    });
    setSizeCategory('');
    setShowForm(true);
  };

  const addPrintAddon = () => {
    setForm(prev => ({ ...prev, print_addons: [...prev.print_addons, { print_type_id: '', print_type_name: '', cost_per_unit: 0 }] }));
  };

  const updateAddon = (i: number, field: string, value: string) => {
    setForm(prev => {
      const addons = [...prev.print_addons];
      if (field === 'print_type_id') {
        const pt = printTypes.find(p => p.id === value);
        addons[i] = { ...addons[i], print_type_id: value, print_type_name: pt?.name || '' };
      } else if (field === 'cost_per_unit') {
        addons[i] = { ...addons[i], cost_per_unit: Number(value) || 0 };
      }
      return { ...prev, print_addons: addons };
    });
  };

  const removeAddon = (i: number) => {
    setForm(prev => ({ ...prev, print_addons: prev.print_addons.filter((_, idx) => idx !== i) }));
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
      const payload = {
        club_id: club.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url || null,
        sizes_available: form.sizes_available,
        price: form.price ? Number(form.price) : 0,
        discount_value: form.discount_value !== '' ? Math.max(0, Number(form.discount_value)) : 0,
        discount_type: form.discount_type,
        is_suggested: form.is_suggested,
        sort_order: items.length,
        print_addons: form.print_addons.filter(a => a.print_type_id),
      };
      if (form.id) {
        const { error } = await supabase.from('club_items').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('club_items').insert([payload]);
        if (error) throw error;
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
      const { error } = await supabase.from('club_items').delete().eq('id', item.id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
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
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Discount</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step={form.discount_type === '$' ? '0.01' : '1'}
                        placeholder="0"
                        value={form.discount_value}
                        onChange={e => setForm(prev => ({ ...prev, discount_value: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none"
                      />
                      <div className="flex border border-zinc-200 rounded-lg overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, discount_type: '%' }))}
                          className={`px-3 py-2 text-sm font-bold transition-colors ${form.discount_type === '%' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, discount_type: '$' }))}
                          className={`px-3 py-2 text-sm font-bold transition-colors border-l border-zinc-200 ${form.discount_type === '$' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                        >
                          $
                        </button>
                      </div>
                    </div>
                    {form.discount_value !== '' && Number(form.discount_value) > 0 && form.price !== '' && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">
                        → ${form.discount_type === '$'
                          ? Math.max(0, Number(form.price) - Number(form.discount_value)).toFixed(2)
                          : Math.max(0, Number(form.price) * (1 - Number(form.discount_value) / 100)).toFixed(2)
                        } after discount
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Sizes</label>
                  <div className="space-y-2">
                    <select
                      value={sizeCategory}
                      onChange={e => {
                        const cat = e.target.value;
                        setSizeCategory(cat);
                        const catSizes = getSizesForCategory(cat);
                        if (catSizes.length === 1) {
                          setForm(prev => ({
                            ...prev,
                            sizes_available: [...new Set([...prev.sizes_available, catSizes[0]])],
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                    >
                      <option value="">Pick a category to add sizes…</option>
                      <option value="Adult">Adult (XS – 3XL)</option>
                      <option value="Youth">Youth (YXS – YXL)</option>
                      <option value="Adult Footwear">Adult Footwear</option>
                      <option value="Youth Footwear">Youth Footwear</option>
                      <option value="Gloves">Gloves</option>
                      <option value="One Size">One Size</option>
                    </select>
                    {sizeCategory && (
                      <div className="flex flex-wrap gap-1.5 p-3 border border-zinc-200 rounded-lg bg-zinc-50">
                        {getSizesForCategory(sizeCategory).map(size => {
                          const checked = form.sizes_available.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setForm(prev => ({
                                ...prev,
                                sizes_available: checked
                                  ? prev.sizes_available.filter(s => s !== size)
                                  : [...prev.sizes_available, size],
                              }))}
                              className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${checked ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {form.sizes_available.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 self-center mr-1">Selected:</span>
                        {form.sizes_available.map(size => (
                          <span key={size} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded text-[11px] font-bold text-zinc-700">
                            {size}
                            <button type="button" onClick={() => setForm(prev => ({ ...prev, sizes_available: prev.sizes_available.filter(s => s !== size) }))}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Print Add-ons */}
                <div className="border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Print Add-ons</p>
                    <button type="button" onClick={addPrintAddon} className="text-xs font-bold text-zinc-700 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-1">+ Add Print</button>
                  </div>
                  {form.print_addons.map((addon, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <select
                        value={addon.print_type_id}
                        onChange={e => updateAddon(i, 'print_type_id', e.target.value)}
                        className="flex-1 border border-zinc-200 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">Select Print Type</option>
                        {printTypes.map(pt => (
                          <option key={pt.id} value={pt.id}>{pt.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-zinc-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={addon.cost_per_unit || ''}
                          onChange={e => updateAddon(i, 'cost_per_unit', e.target.value)}
                          placeholder="0.00"
                          className="w-20 border border-zinc-200 rounded px-2 py-1.5 text-sm"
                        />
                        <span className="text-xs text-zinc-400">/unit</span>
                      </div>
                      <button type="button" onClick={() => removeAddon(i)} className="text-red-400 hover:text-red-600 text-sm font-bold">✕</button>
                    </div>
                  ))}
                  {form.print_addons.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Print cost/unit: <span className="font-bold text-zinc-900">
                        ${form.print_addons.reduce((s, a) => s + (Number(a.cost_per_unit) || 0), 0).toFixed(2)}
                      </span>
                      {form.price !== '' && (
                        <span className="ml-2 text-zinc-400">
                          → Total/unit: <span className="font-bold text-zinc-800">
                            ${(() => {
                              const base = Number(form.price || 0);
                              const dv = Number(form.discount_value) || 0;
                              const discBase = form.discount_type === '$'
                                ? Math.max(0, base - dv)
                                : Math.max(0, base * (1 - dv / 100));
                              return (discBase + form.print_addons.reduce((s, a) => s + (Number(a.cost_per_unit) || 0), 0)).toFixed(2);
                            })()}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
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
      const totalAmount = Number(orderForm.total_amount) || 0;
      const depositPaid = Number(orderForm.deposit_paid) || 0;
      const updatePayload: any = {
        status: orderForm.status,
        total_amount: totalAmount,
        deposit_paid: depositPaid,
        balance_owing: Math.max(0, totalAmount - depositPaid),
        invoice_url: orderForm.invoice_url.trim() || null,
      };
      if (orderForm.status === 'confirmed' && !editingOrder.confirmed_at) {
        updatePayload.confirmed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('club_orders').update(updatePayload).eq('id', editingOrder.id);
      if (error) throw error;
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
              <div className="space-y-1 border border-zinc-100 rounded-lg p-2">
                {((editingOrder.items || []) as any[]).map((li: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <div>
                      <span className="font-medium text-zinc-900">{li.name}</span>
                      {li.sizes && typeof li.sizes === 'object' && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {Object.entries(li.sizes as Record<string, number>).filter(([, q]) => Number(q) > 0).map(([sz, qty]) => `${sz}:${qty}`).join(' | ')}
                        </div>
                      )}
                      {li.size && <span className="text-xs text-zinc-400 ml-2">{li.size}</span>}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-zinc-500 text-xs">{getItemQty(li)} × ${getItemPrice(li).toFixed(2)}</div>
                      <div className="font-medium text-zinc-800">${(getItemQty(li) * getItemPrice(li)).toFixed(2)}</div>
                    </div>
                  </div>
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

// ─── Per-club orders modal ───────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  ready: 'Ready for Pickup',
  delivered: 'Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_production: 'bg-purple-100 text-purple-700',
  ready: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-zinc-100 text-zinc-500',
};

function getItemQty(item: any): number {
  if (item.qty !== undefined) return Number(item.qty) || 0;
  if (item.quantity !== undefined) return Number(item.quantity) || 0;
  if (item.sizes && typeof item.sizes === 'object') {
    return Object.values(item.sizes as Record<string, unknown>).reduce<number>((s, q) => s + Number(q), 0);
  }
  return 0;
}

function getItemPrice(item: any): number {
  return Number(item.price) || Number(item.base_price) || Number(item.unit_total) || 0;
}

function groupLineItems(items: any[]) {
  const map: Record<string, { sizes: Record<string, number>; price: number }> = {};
  for (const li of items || []) {
    const price = getItemPrice(li);
    if (!map[li.name]) map[li.name] = { sizes: {}, price };
    if (li.size !== undefined && li.qty !== undefined) {
      const sz = li.size || '—';
      map[li.name].sizes[sz] = (map[li.name].sizes[sz] || 0) + Number(li.qty);
    } else if (li.sizes && typeof li.sizes === 'object') {
      for (const [sz, qty] of Object.entries(li.sizes as Record<string, unknown>)) {
        if (Number(qty) > 0) map[li.name].sizes[sz] = (map[li.name].sizes[sz] || 0) + Number(qty);
      }
    } else {
      map[li.name].sizes['—'] = (map[li.name].sizes['—'] || 0) + Number(li.quantity || 1);
    }
  }
  return Object.entries(map).map(([name, { sizes, price }]) => ({ name, sizes, price }));
}

function downloadCSV(data: any[][], filename: string) {
  const csv = data.map(row => row.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportOrderCSV(order: any, club: any) {
  const matrix = order.customization_matrix || [];
  if (matrix.length === 0) {
    const headers = ['Club', 'Order#', 'Item', 'Qty', 'Size', 'Price'];
    const rows = (order.items || []).map((item: any) => [
      club.name, order.order_number, item.name,
      getItemQty(item), item.size || 'Various', getItemPrice(item),
    ]);
    downloadCSV([headers, ...rows], `${order.order_number}_order.csv`);
    return;
  }
  const headers = ['Club', 'Order#', 'Item', 'Size', 'Player Name', 'Number', 'Initials', 'Sponsor', 'Print Types', 'Unit Cost'];
  const rows = matrix.map((row: any) => {
    const item = (order.items || []).find((i: any) => i.name === row.itemName);
    const prints = (item?.print_addons || []).map((a: any) => a.print_type_name).join('+');
    return [
      club.name, order.order_number, row.itemName, row.size,
      row.playerName || '', row.playerNumber || '', row.initials || '',
      row.sponsorName || '', prints, (Number(item?.unit_total) || 0).toFixed(2),
    ];
  });
  downloadCSV([headers, ...rows], `${order.order_number}_production.csv`);
}

function printOrderProof(order: any, club: any, orientation: 'portrait' | 'landscape' = 'portrait') {
  const matrix = order.customization_matrix || [];

  // Group matrix by item → size
  const grouped: Record<string, Record<string, any[]>> = {};
  matrix.forEach((row: any) => {
    if (!grouped[row.itemName]) grouped[row.itemName] = {};
    if (!grouped[row.itemName][row.size]) grouped[row.itemName][row.size] = [];
    grouped[row.itemName][row.size].push(row);
  });

  const sizeOrder = [
    '8K','8.5K','9K','9.5K','10K','10.5K','11K','11.5K',
    '12K','12.5K','13K','13.5K',
    '1Y','1.5Y','2Y','2.5Y','3Y','3.5Y',
    '4Y','4.5Y','5Y','5.5Y','6Y','6.5Y','7Y',
    'XS','S','M','L','XL','XXL','2XL','3XL',
  ];
  const sortSizes = (sizes: string[]) =>
    sizes.sort((a, b) => {
      const ai = sizeOrder.indexOf(a);
      const bi = sizeOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const pw = window.open('', '_blank');
  if (!pw) return;

  // Build items HTML (grouped layout)
  let itemsHTML = '';
  if (matrix.length > 0) {
    Object.entries(grouped).forEach(([itemName, sizes]) => {
      const sortedSizes = sortSizes(Object.keys(sizes));
      const orderItem = (order.items || []).find((i: any) => i.name === itemName);
      const prints = (orderItem?.print_addons || []).map((a: any) =>
        `${a.print_type_name} ($${(Number(a.cost_per_unit) || 0).toFixed(2)}/unit)`
      ).join(', ');

      const sizeRows = sortedSizes.map(size => {
        const players = sizes[size];
        const playerList = players.map((p: any) => {
          const name = p.playerName || '';
          const number = p.playerNumber || '';
          if (name && number) return `${name}(${number})`;
          if (name) return name;
          if (number) return `#${number}`;
          return '—';
        }).join(',  ');
        return `<tr><td class="size-cell">${size}</td><td class="players-cell">${playerList}</td><td class="qty-cell">${players.length} pcs</td></tr>`;
      }).join('');

      itemsHTML += `
        <div class="item-section">
          <div class="item-header">
            <span class="item-name">${itemName.toUpperCase()}</span>
            ${prints ? `<span class="item-prints">Prints: ${prints}</span>` : ''}
          </div>
          <table class="size-table"><tbody>${sizeRows}</tbody></table>
        </div>`;
    });
  } else {
    // Old-format fallback: simple item table
    const rows = (order.items || []).map((item: any) =>
      `<tr><td>${item.name}</td><td>${item.size || 'Various'}</td><td>${getItemQty(item)}</td><td>$${getItemPrice(item).toFixed(2)}</td><td>$${(getItemQty(item) * getItemPrice(item)).toFixed(2)}</td></tr>`
    ).join('');
    itemsHTML = `<table class="size-table"><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  const sponsorsHTML = (order.sponsors || []).length > 0
    ? `<div class="sponsors-section"><div class="section-title">SPONSOR LOGOS</div>${(order.sponsors || []).map((s: any) => `<div class="sponsor-row">${s.name}</div>`).join('')}</div>`
    : '';

  const totalNum = Number(order.total_amount) || 0;
  const depositNum = Number(order.deposit_paid) || 0;
  const balanceNum = Number(order.balance_owing) || 0;
  const subtotal = totalNum / 1.13;
  const hst = totalNum - subtotal;

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${order.order_number} - Production Sheet</title>
<style>
  @page{size:${orientation};margin:15mm}
  body{font-family:Arial,sans-serif;color:#000;font-size:12px;line-height:1.4}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:20px}
  .store-name{font-size:18px;font-weight:900;letter-spacing:-0.5px}
  .club-name{font-size:14px;font-weight:bold;color:#333;margin-top:4px}
  .order-meta{text-align:right;font-size:11px;color:#555}
  .order-number{font-size:16px;font-weight:900;color:#000}
  .item-section{margin-bottom:24px;break-inside:avoid}
  .item-header{background:#000;color:#fff;padding:6px 10px;display:flex;justify-content:space-between;align-items:center}
  .item-name{font-weight:900;font-size:13px;letter-spacing:1px}
  .item-prints{font-size:9px;color:#ccc}
  .size-table{width:100%;border-collapse:collapse;border:1px solid #000}
  .size-table tr{border-bottom:1px solid #ccc}
  .size-table tr:last-child{border-bottom:none}
  .size-table th{background:#f0f0f0;padding:6px 10px;text-align:left;font-size:11px;border:1px solid #ddd}
  .size-cell{width:50px;font-weight:900;font-size:12px;padding:6px 10px;border-right:2px solid #000;background:#f5f5f5;white-space:nowrap}
  .players-cell{padding:6px 12px;font-size:11px;color:#222;letter-spacing:0.3px}
  .qty-cell{width:50px;text-align:right;padding:6px 10px;font-size:10px;color:#666;border-left:1px solid #eee;white-space:nowrap}
  .sponsors-section{margin-top:20px;border-top:2px solid #000;padding-top:12px}
  .section-title{font-weight:900;font-size:11px;letter-spacing:1px;margin-bottom:6px;color:#555}
  .sponsor-row{font-size:11px;padding:2px 0}
  .notes-section{margin-top:16px;padding:8px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:11px}
  .totals-section{margin-top:20px;border-top:2px solid #000;padding-top:12px;text-align:right}
  .total-row{font-size:12px;margin-bottom:4px}
  .grand-total{font-size:16px;font-weight:900;margin-top:6px}
  .balance{color:#cc0000}
  .signoff{margin-top:30px;border-top:1px solid #ccc;padding-top:20px;display:flex;justify-content:space-between}
  .signoff-line{font-size:11px;margin-bottom:20px}
  .footer{margin-top:20px;font-size:9px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="store-name">ABSOLUTE SOCCER MISSISSAUGA</div>
    <div class="club-name">${club.name}</div>
  </div>
  <div class="order-meta">
    <div class="order-number">${order.order_number}</div>
    <div>Date: ${new Date(order.created_at).toLocaleDateString('en-CA')}</div>
    <div>Status: ${(order.status || '').toUpperCase()}</div>
  </div>
</div>

${itemsHTML}
${sponsorsHTML}
${order.notes ? `<div class="notes-section"><strong>Notes:</strong> ${order.notes}</div>` : ''}

${totalNum > 0 ? `
<div class="totals-section">
  <div class="total-row">Subtotal: $${subtotal.toFixed(2)}</div>
  <div class="total-row">HST (13%): $${hst.toFixed(2)}</div>
  <div class="grand-total">TOTAL: $${totalNum.toFixed(2)}</div>
  ${depositNum > 0 ? `<div class="total-row" style="margin-top:8px">Deposit Paid: $${depositNum.toFixed(2)}</div><div class="total-row balance">Balance Owing: $${balanceNum.toFixed(2)}</div>` : ''}
</div>` : ''}

<div class="signoff">
  <div>
    <div class="signoff-line">Club Representative: _______________________________</div>
    <div class="signoff-line">Signature: _______________________________</div>
    <div class="signoff-line">Date: _______________________________</div>
  </div>
  <div>
    <div class="signoff-line">Store Representative: _______________________________</div>
    <div class="signoff-line">Date: _______________________________</div>
  </div>
</div>

<div class="footer">Absolute Soccer Mississauga | 5600 Rose Cherry Place, Mississauga ON L4Z 4B6 | 905-593-3600 | torontosoccershop.com</div>

</body>
</html>`);
  pw.document.close();
  pw.print();
}

function buildClubInvoiceHTML(order: ClubOrder, club: Club): string {
  const total = Number(order.total_amount || 0);
  const deposit = Number(order.deposit_paid || 0);
  const balance = Math.max(0, total - deposit);
  const subtotal = total / 1.13;
  const tax = total - subtotal;
  const logoUrl = `${window.location.origin}/logo-black.png`;

  const paymentLine = deposit > 0
    ? `Deposit Paid: $${deposit.toFixed(2)} · Balance Owing: $${balance.toFixed(2)}`
    : `Balance Owing: $${balance.toFixed(2)}`;

  return generateInvoiceHTML({
    invoiceNumber: order.order_number,
    createdAt: new Date(order.created_at),
    logoUrl,
    customerInfo: {
      firstName: club.name,
      email: club.contact_email || undefined,
      phone: club.contact_phone || undefined,
    },
    items: (order.items || []).map(li => ({
      name: li.name,
      quantity: li.qty,
      price: li.price,
      size: li.size,
    })),
    subtotal,
    tax,
    total,
    paymentMethod: paymentLine,
  }, 'invoice');
}

const ClubOrdersPerClub: React.FC<{ club: Club; onClose: () => void }> = ({ club, onClose }) => {
  const [orders, setOrders] = useState<ClubOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, {
    status: string; total_amount: string; deposit_paid: string; invoice_url: string; notes: string;
  }>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('club_orders')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false });
    const rows = (data || []) as unknown as ClubOrder[];
    setOrders(rows);
    const init: typeof drafts = {};
    rows.forEach(o => {
      init[o.id] = {
        status: o.status,
        total_amount: String(o.total_amount ?? ''),
        deposit_paid: String(o.deposit_paid ?? ''),
        invoice_url: o.invoice_url || '',
        notes: o.notes || '',
      };
    });
    setDrafts(init);
    setLoading(false);
  }, [club.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const patch = (id: string, field: string, value: string) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const saveOrder = async (order: ClubOrder) => {
    const d = drafts[order.id];
    if (!d) return;
    setSavingId(order.id);
    try {
      const total = Number(d.total_amount) || 0;
      const deposit = Number(d.deposit_paid) || 0;
      const payload: any = {
        status: d.status,
        total_amount: total,
        deposit_paid: deposit,
        balance_owing: Math.max(0, total - deposit),
        invoice_url: d.invoice_url.trim() || null,
        notes: d.notes.trim() || null,
      };
      if (d.status === 'confirmed' && !order.confirmed_at) payload.confirmed_at = new Date().toISOString();
      const { error } = await supabase.from('club_orders').update(payload).eq('id', order.id);
      if (error) throw error;
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to save order.');
    } finally {
      setSavingId(null);
    }
  };

  const generateInvoice = async (order: ClubOrder) => {
    const html = buildClubInvoiceHTML(order, club);
    printInvoice(html);
    if (!order.invoice_url) {
      await supabase.from('club_orders').update({ invoice_url: order.order_number }).eq('id', order.id);
      await loadOrders();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 shrink-0">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">{club.name} — Orders</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading && <p className="text-center text-zinc-400 py-8 text-sm">Loading orders...</p>}
          {!loading && orders.length === 0 && (
            <p className="text-center text-zinc-400 py-8 text-sm">No orders yet for this club.</p>
          )}
          {orders.map(order => {
            const d = drafts[order.id];
            if (!d) return null;
            const totalNum = Number(d.total_amount) || 0;
            const depositNum = Number(d.deposit_paid) || 0;
            const balance = Math.max(0, totalNum - depositNum);
            return (
              <div key={order.id} className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-zinc-900 text-sm">{order.order_number}</span>
                    <span className="text-zinc-400 text-xs">{new Date(order.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STATUS_COLORS[order.status] || 'bg-zinc-100 text-zinc-500'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    {((order.items || []) as any[]).map((item: any, i: number) => (
                      <div key={i} className="border rounded-xl p-4 mb-3 bg-zinc-50">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-zinc-900">{item.name}</h4>
                          <span className="font-bold text-zinc-900">${(getItemQty(item) * getItemPrice(item)).toFixed(2)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {item.sizes ? (
                            Object.entries(item.sizes as Record<string, any>)
                              .filter(([, qty]) => Number(qty) > 0)
                              .sort(([a], [b]) => {
                                const ai = SIZE_ORDER.indexOf(a);
                                const bi = SIZE_ORDER.indexOf(b);
                                if (ai === -1 && bi === -1) return a.localeCompare(b);
                                if (ai === -1) return 1;
                                if (bi === -1) return -1;
                                return ai - bi;
                              })
                              .map(([size, qty]) => (
                                <div key={size} className="bg-white border rounded-lg px-3 py-1.5 text-center min-w-[60px]">
                                  <div className="text-xs text-zinc-400 font-medium">{size}</div>
                                  <div className="font-black text-zinc-900 text-lg">{String(qty)}</div>
                                </div>
                              ))
                          ) : (
                            <div className="bg-white border rounded-lg px-3 py-1.5">
                              <div className="text-xs text-zinc-400">Qty</div>
                              <div className="font-black text-lg">{item.qty || item.quantity || 0}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between text-sm text-zinc-500 border-t pt-2">
                          <span>{getItemQty(item)} units × ${getItemPrice(item).toFixed(2)}/unit</span>
                          {item.print_addons?.length > 0 && (
                            <span className="text-xs text-zinc-400">
                              Incl. {item.print_addons.map((a: any) => a.print_type_name).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {order.notes && <p className="text-xs text-zinc-400 italic pt-1">"{order.notes}"</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total ($)</label>
                      <input type="number" step="0.01" min="0" value={d.total_amount} onChange={e => patch(order.id, 'total_amount', e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Deposit Paid ($)</label>
                      <input type="number" step="0.01" min="0" value={d.deposit_paid} onChange={e => patch(order.id, 'deposit_paid', e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Balance Owing</label>
                      <div className={`px-2 py-1.5 rounded-lg text-sm font-black border ${balance > 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>${balance.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Status</label>
                      <select value={d.status} onChange={e => patch(order.id, 'status', e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none">
                        {Object.entries(STATUS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Invoice</label>
                      {order.invoice_url
                        ? <p className="text-xs text-zinc-500 py-1 font-mono">#{order.invoice_url}</p>
                        : <p className="text-xs text-zinc-400 py-1 italic">Not generated yet</p>
                      }
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Notes</label>
                    <textarea rows={2} value={d.notes} onChange={e => patch(order.id, 'notes', e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none" />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button onClick={() => exportOrderCSV(order, club)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                      CSV
                    </button>
                    <button onClick={() => printOrderProof(order, club, 'portrait')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                      Portrait
                    </button>
                    <button onClick={() => printOrderProof(order, club, 'landscape')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                      Landscape
                    </button>
                    <button onClick={() => generateInvoice(order)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-800 text-white hover:bg-zinc-900">
                      <FileText size={13} /> {order.invoice_url ? 'Reprint Invoice' : 'Generate Invoice'}
                    </button>
                    <button onClick={() => saveOrder(order)} disabled={savingId === order.id} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 disabled:opacity-50">
                      <Save size={13} /> {savingId === order.id ? 'Saving...' : 'Save Order'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Print Preview Content ───────────────────────────────────────────────────

const SIZE_ORDER = [
  '8K','8.5K','9K','9.5K','10K','10.5K','11K','11.5K',
  '12K','12.5K','13K','13.5K',
  '1Y','1.5Y','2Y','2.5Y','3Y','3.5Y',
  '4Y','4.5Y','5Y','5.5Y','6Y','6.5Y','7Y',
  'XS','S','M','L','XL','XXL','2XL','3XL',
];
const sortSizesArr = (sizes: string[]) =>
  [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

const PrintPreviewContent: React.FC<{
  order: any;
  club: any;
  orientation: 'portrait' | 'landscape';
}> = ({ order, club, orientation }) => {
  const matrix: any[] = order.customization_matrix || [];

  const grouped: Record<string, Record<string, any[]>> = {};
  matrix.forEach((row: any) => {
    if (!grouped[row.itemName]) grouped[row.itemName] = {};
    if (!grouped[row.itemName][row.size]) grouped[row.itemName][row.size] = [];
    grouped[row.itemName][row.size].push(row);
  });

  const totalNum = Number(order.total_amount) || 0;
  const depositNum = Number(order.deposit_paid) || 0;
  const balanceNum = Number(order.balance_owing) || 0;
  const subtotal = totalNum / 1.13;
  const hst = totalNum - subtotal;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 900 }}>ABSOLUTE SOCCER MISSISSAUGA</div>
          <div style={{ fontSize: '12px', color: '#333', marginTop: '3px' }}>{club.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 900 }}>{order.order_number}</div>
          <div style={{ fontSize: '10px', color: '#555' }}>{new Date(order.created_at).toLocaleDateString('en-CA')}</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Status: {(order.status || '').toUpperCase()}</div>
        </div>
      </div>

      {orientation === 'portrait' ? (
        /* Portrait: grouped by item → size */
        <div>
          {matrix.length === 0 ? (
            /* Old-format fallback */
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr>{['Item','Size','Qty','Unit Price','Total'].map(h => (
                  <th key={h} style={{ background: '#000', color: '#fff', padding: '6px 8px', fontSize: '10px', textAlign: 'left' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(order.items || []).map((item: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px', fontSize: '10px' }}>{item.name}</td>
                    <td style={{ padding: '6px 8px', fontSize: '10px' }}>{item.size || 'Various'}</td>
                    <td style={{ padding: '6px 8px', fontSize: '10px' }}>{getItemQty(item)}</td>
                    <td style={{ padding: '6px 8px', fontSize: '10px' }}>${getItemPrice(item).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', fontSize: '10px' }}>${(getItemQty(item) * getItemPrice(item)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            Object.entries(grouped).map(([itemName, sizes]) => {
              const sortedSizes = sortSizesArr(Object.keys(sizes));
              const orderItem = (order.items || []).find((i: any) => i.name === itemName);
              const prints = (orderItem?.print_addons || []).map((a: any) =>
                `${a.print_type_name} ($${(Number(a.cost_per_unit) || 0).toFixed(2)}/unit)`
              ).join(', ');
              return (
                <div key={itemName} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#000', color: '#fff', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, letterSpacing: '1px', fontSize: '12px' }}>{itemName.toUpperCase()}</span>
                    {prints && <span style={{ fontSize: '9px', color: '#ccc' }}>{prints}</span>}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                    <tbody>
                      {sortedSizes.map(size => {
                        const players: any[] = sizes[size];
                        const playerList = players.map((p: any) => {
                          const name = p.playerName || '';
                          const num = p.playerNumber || '';
                          if (name && num) return `${name}(${num})`;
                          if (name) return name;
                          if (num) return `#${num}`;
                          return '—';
                        }).join(',  ');
                        return (
                          <tr key={size} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ width: '50px', fontWeight: 900, padding: '6px 10px', borderRight: '2px solid #000', background: '#f5f5f5', whiteSpace: 'nowrap' }}>{size}</td>
                            <td style={{ padding: '6px 12px', fontSize: '11px' }}>{playerList}</td>
                            <td style={{ width: '50px', textAlign: 'right', padding: '6px 10px', fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>{players.length} pcs</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Landscape: one row per player */
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Item', 'Size', 'Player Name', 'Number', 'Initials', 'Sponsor', 'Print Type'].map(h => (
                <th key={h} style={{ background: '#000', color: '#fff', padding: '7px 8px', fontSize: '10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row: any, i: number) => {
              const item = (order.items || []).find((it: any) => it.name === row.itemName);
              const prints = (item?.print_addons || []).map((a: any) => a.print_type_name).join(', ') || '—';
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{row.itemName}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ background: '#f0f0f0', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>{row.size}</span>
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{row.playerName || '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 'bold' }}>{row.playerNumber || '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{row.initials || '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{row.sponsorName || '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: '10px' }}>{prints}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Sponsors */}
      {(order.sponsors || []).length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '2px solid #000', paddingTop: '10px' }}>
          <div style={{ fontWeight: 900, fontSize: '10px', letterSpacing: '1px', color: '#555', marginBottom: '6px' }}>SPONSOR LOGOS</div>
          {(order.sponsors || []).map((s: any, i: number) => (
            <div key={i} style={{ fontSize: '11px', padding: '2px 0' }}>{s.name}</div>
          ))}
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f9f9f9', border: '1px solid #ddd', fontSize: '10px' }}>
          <strong>Notes:</strong> {order.notes}
        </div>
      )}

      {/* Totals */}
      {totalNum > 0 && (
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <div style={{ fontSize: '11px' }}>Subtotal: ${subtotal.toFixed(2)}</div>
          <div style={{ fontSize: '11px' }}>HST (13%): ${hst.toFixed(2)}</div>
          <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '4px' }}>TOTAL: ${totalNum.toFixed(2)}</div>
          {depositNum > 0 && (
            <>
              <div style={{ fontSize: '11px', marginTop: '6px' }}>Deposit Paid: ${depositNum.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#cc0000' }}>Balance Owing: ${balanceNum.toFixed(2)}</div>
            </>
          )}
        </div>
      )}

      {/* Sign-off */}
      <div style={{ marginTop: '24px', borderTop: '1px solid #ccc', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <div>
          <div style={{ marginBottom: '16px' }}>Club Representative: _______________________________</div>
          <div style={{ marginBottom: '16px' }}>Signature: _______________________________</div>
          <div>Date: _______________________________</div>
        </div>
        <div>
          <div style={{ marginBottom: '16px' }}>Store Representative: _______________________________</div>
          <div>Date: _______________________________</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '16px', fontSize: '9px', color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '8px' }}>
        Absolute Soccer Mississauga | 5600 Rose Cherry Place, Mississauga ON L4Z 4B6 | 905-593-3600 | torontosoccershop.com
      </div>
    </div>
  );
};

// ─── Club Dashboard (full-page view) ────────────────────────────────────────

const ClubDashboard: React.FC<{
  club: Club;
  onBack: () => void;
  onEdit: () => void;
  onManageItems: () => void;
}> = ({ club, onBack, onEdit, onManageItems }) => {
  const [tab, setTab] = useState<'overview' | 'orders' | 'history'>('overview');
  const [orders, setOrders] = useState<ClubOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, {
    status: string; total_amount: string; deposit_paid: string; notes: string;
  }>>({});
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editingMatrix, setEditingMatrix] = useState<any[]>([]);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    order: any; club: any; orientation: 'portrait' | 'landscape';
  } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('club_orders')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false });
    const loaded = (data || []) as ClubOrder[];
    setOrders(loaded);
    const newDrafts: typeof drafts = {};
    loaded.forEach(o => {
      newDrafts[o.id] = {
        status: o.status,
        total_amount: String(o.total_amount ?? ''),
        deposit_paid: String(o.deposit_paid ?? ''),
        notes: o.notes || '',
      };
    });
    setDrafts(newDrafts);
    setLoading(false);
  }, [club.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const patch = (id: string, field: string, value: string) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const saveOrder = async (order: ClubOrder) => {
    const d = drafts[order.id];
    if (!d) return;
    setSavingId(order.id);
    try {
      const total = Number(d.total_amount) || 0;
      const deposit = Number(d.deposit_paid) || 0;
      const payload: any = {
        status: d.status,
        total_amount: total,
        deposit_paid: deposit,
        balance_owing: Math.max(0, total - deposit),
        notes: d.notes.trim() || null,
      };
      if (d.status === 'confirmed' && !order.confirmed_at) payload.confirmed_at = new Date().toISOString();
      const { error } = await supabase.from('club_orders').update(payload).eq('id', order.id);
      if (error) throw error;
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to save order.');
    } finally {
      setSavingId(null);
    }
  };

  const generateInvoice = async (order: ClubOrder) => {
    const html = buildClubInvoiceHTML(order, club);
    printInvoice(html);
    if (!order.invoice_url) {
      await supabase.from('club_orders').update({ invoice_url: order.order_number }).eq('id', order.id);
      await loadOrders();
    }
  };

  const startEditOrder = (order: ClubOrder) => {
    setEditingOrder({ ...order });
    setEditingMatrix(((order as any).customization_matrix || []).map((r: any) => ({ ...r })));
    setEditingItems(((order.items as any[]) || []).map((i: any) => ({ ...i })));
  };

  const updateMatrixRow = (index: number, field: string, value: string) => {
    setEditingMatrix(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateEditItemSize = (itemIndex: number, size: string, qty: string) => {
    setEditingItems(prev => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], sizes: { ...updated[itemIndex].sizes, [size]: Number(qty) } };
      return updated;
    });
  };

  const updateEditItemQty = (index: number, qty: string) => {
    setEditingItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: Number(qty) };
      return updated;
    });
  };

  const updateEditItemPrice = (index: number, price: string) => {
    setEditingItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price: Number(price), base_price: Number(price) };
      return updated;
    });
  };

  const removeEditItem = (index: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveEditedOrder = async () => {
    if (!editingOrder) return;
    setIsSavingEdit(true);
    try {
      const balanceOwing = Math.max(0, Number(editingOrder.total_amount) - Number(editingOrder.deposit_paid));
      const { error } = await supabase
        .from('club_orders')
        .update({
          items: editingItems,
          customization_matrix: editingMatrix.length > 0 ? editingMatrix : null,
          notes: editingOrder.notes || null,
          total_amount: Number(editingOrder.total_amount),
          deposit_paid: Number(editingOrder.deposit_paid),
          balance_owing: balanceOwing,
          status: editingOrder.status,
        })
        .eq('id', editingOrder.id);
      if (error) throw error;
      await loadOrders();
      setEditingOrder(null);
    } catch (err: any) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + Number(o.deposit_paid || 0), 0);
  const totalBalance = orders.reduce((sum, o) => sum + Number(o.balance_owing || 0), 0);

  const tabOrders = tab === 'orders'
    ? orders.filter(o => o.status !== 'delivered')
    : orders.filter(o => o.status === 'delivered');

  const renderOrderCard = (order: ClubOrder, readOnly: boolean) => {
    const d = drafts[order.id];
    if (!d) return null;
    const dTotal = Number(d.total_amount) || 0;
    const dDeposit = Number(d.deposit_paid) || 0;
    const dBalance = Math.max(0, dTotal - dDeposit);
    return (
      <div key={order.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900">{order.order_number}</p>
            <p className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startEditOrder(order)}
              className="flex items-center gap-1 text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-50"
            >
              <Edit2 size={12} /> Edit
            </button>
            {readOnly ? (
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${STATUS_COLORS[order.status] || 'bg-zinc-100 text-zinc-500'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            ) : (
              <select
                value={d.status}
                onChange={e => patch(order.id, 'status', e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            {((order.items || []) as any[]).map((item: any, i: number) => (
              <div key={i} className="border rounded-xl p-4 mb-3 bg-zinc-50">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-zinc-900">{item.name}</h4>
                  <span className="font-bold text-zinc-900">${(getItemQty(item) * getItemPrice(item)).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.sizes ? (
                    Object.entries(item.sizes as Record<string, any>)
                      .filter(([, qty]) => Number(qty) > 0)
                      .sort(([a], [b]) => {
                        const ai = SIZE_ORDER.indexOf(a);
                        const bi = SIZE_ORDER.indexOf(b);
                        if (ai === -1 && bi === -1) return a.localeCompare(b);
                        if (ai === -1) return 1;
                        if (bi === -1) return -1;
                        return ai - bi;
                      })
                      .map(([size, qty]) => (
                        <div key={size} className="bg-white border rounded-lg px-3 py-1.5 text-center min-w-[60px]">
                          <div className="text-xs text-zinc-400 font-medium">{size}</div>
                          <div className="font-black text-zinc-900 text-lg">{String(qty)}</div>
                        </div>
                      ))
                  ) : (
                    <div className="bg-white border rounded-lg px-3 py-1.5">
                      <div className="text-xs text-zinc-400">Qty</div>
                      <div className="font-black text-lg">{item.qty || item.quantity || 0}</div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-sm text-zinc-500 border-t pt-2">
                  <span>{getItemQty(item)} units × ${getItemPrice(item).toFixed(2)}/unit</span>
                  {item.print_addons?.length > 0 && (
                    <span className="text-xs text-zinc-400">
                      Incl. {item.print_addons.map((a: any) => a.print_type_name).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {order.notes && (
              <p className="text-xs text-zinc-400 italic mt-2 pt-2 border-t border-zinc-200">"{order.notes}"</p>
            )}
          </div>

          {readOnly ? (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-zinc-600">Total: <strong>${Number(order.total_amount || 0).toFixed(2)}</strong></span>
                <span className="text-zinc-600">Paid: <strong>${Number(order.deposit_paid || 0).toFixed(2)}</strong></span>
                <span className="text-zinc-600">Balance: <strong className={Number(order.balance_owing) > 0 ? 'text-red-600' : 'text-green-600'}>${Number(order.balance_owing || 0).toFixed(2)}</strong></span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportOrderCSV(order, club)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  CSV
                </button>
                <button onClick={() => setPrintPreview({ order, club, orientation: 'portrait' })} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  Portrait
                </button>
                <button onClick={() => setPrintPreview({ order, club, orientation: 'landscape' })} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  Landscape
                </button>
                {order.invoice_url && (
                  <button onClick={() => generateInvoice(order)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                    <FileText size={13} /> Print Invoice
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Amount</label>
                  <input
                    type="number" step="0.01"
                    value={d.total_amount}
                    onChange={e => patch(order.id, 'total_amount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Deposit Paid</label>
                  <input
                    type="number" step="0.01"
                    value={d.deposit_paid}
                    onChange={e => patch(order.id, 'deposit_paid', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Balance Owing</label>
                  <p className={`text-sm font-bold mt-2 ${dBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${dBalance.toFixed(2)}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={d.notes}
                  onChange={e => patch(order.id, 'notes', e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
                />
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-zinc-400 font-mono">
                  {order.invoice_url ? `Invoice: #${order.invoice_url}` : 'No invoice yet'}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => exportOrderCSV(order, club)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                    CSV
                  </button>
                  <button onClick={() => setPrintPreview({ order, club, orientation: 'portrait' })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                    Portrait
                  </button>
                  <button onClick={() => setPrintPreview({ order, club, orientation: 'landscape' })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                    Landscape
                  </button>
                  <button
                    onClick={() => generateInvoice(order)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-800 text-white hover:bg-zinc-900"
                  >
                    <FileText size={13} /> {order.invoice_url ? 'Reprint' : 'Generate Invoice'}
                  </button>
                  <button
                    onClick={() => saveOrder(order)}
                    disabled={savingId === order.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    <Save size={13} /> {savingId === order.id ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 mb-4">
          <ChevronLeft size={14} /> Back to All Clubs
        </button>
        <div className="flex items-start gap-4">
          {club.logo_url ? (
            <img src={club.logo_url} alt="" className="w-14 h-14 object-contain rounded-xl bg-zinc-100 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-zinc-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900">{club.name}</h3>
            {(club.contact_name || club.contact_phone) && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Contact: {[club.contact_name, club.contact_phone].filter(Boolean).join(' · ')}
              </p>
            )}
            {club.contact_email && <p className="text-xs text-zinc-400">{club.contact_email}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onManageItems} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
              <Package size={13} /> Items
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-xs border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-zinc-200">
        {(['overview', 'orders', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t === 'overview' ? 'Overview' : t === 'orders' ? `Orders${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Orders', value: String(orders.length) },
              { label: 'Active Orders', value: String(activeOrders.length) },
              { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}` },
              { label: 'Total Paid', value: `$${totalPaid.toFixed(2)}` },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
                <p className="text-lg font-black text-zinc-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl p-4 border ${totalBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Balance Owing</p>
            <p className={`text-2xl font-black ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>${totalBalance.toFixed(2)}</p>
          </div>

          {loading && <p className="text-sm text-zinc-400 py-4">Loading orders...</p>}
          {!loading && activeOrders.length === 0 && (
            <p className="text-sm text-zinc-400 py-4">No active orders.</p>
          )}
          {activeOrders.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Active Orders</p>
              <div className="space-y-2">
                {activeOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50"
                    onClick={() => setTab('orders')}
                  >
                    <div>
                      <p className="font-bold text-zinc-900 text-sm">{order.order_number}</p>
                      <p className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={order.status} />
                    <div className="text-right">
                      <p className="text-sm font-bold text-zinc-900">${Number(order.total_amount || 0).toFixed(2)}</p>
                      {Number(order.balance_owing) > 0 && (
                        <p className="text-xs font-bold text-red-600">Owing: ${(Number(order.balance_owing) || 0).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orders / History tabs */}
      {(tab === 'orders' || tab === 'history') && (
        <div className="space-y-4">
          {loading && <p className="text-sm text-zinc-400 text-center py-8">Loading...</p>}
          {!loading && tabOrders.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              {tab === 'orders' ? 'No active orders.' : 'No completed orders.'}
            </p>
          )}
          {tabOrders.map(order => renderOrderCard(order, tab === 'history'))}
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" onClick={() => setEditingOrder(null)}>
          <div className="bg-white max-w-4xl mx-auto my-8 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black text-xl text-zinc-900">Edit Order {editingOrder.order_number}</h2>
              <button onClick={() => setEditingOrder(null)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
            </div>

            {/* Status */}
            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Status</label>
              <select
                value={editingOrder.status}
                onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value })}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Items */}
            <div className="mb-6">
              <h3 className="font-bold text-zinc-900 mb-3">Items &amp; Quantities</h3>
              {editingItems.map((item: any, i: number) => (
                <div key={i} className="border border-zinc-200 rounded-xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-zinc-900">{item.name}</span>
                    <button onClick={() => removeEditItem(i)} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                  </div>
                  {item.sizes && typeof item.sizes === 'object' ? (
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(item.sizes as Record<string, number>).map(([size, qty]) => (
                        <div key={size} className="text-center">
                          <label className="block text-xs text-zinc-400 mb-1">{size}</label>
                          <input
                            type="number" min="0"
                            value={qty}
                            onChange={e => updateEditItemSize(i, size, e.target.value)}
                            className="w-full border border-zinc-200 rounded text-center py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 items-center">
                      {item.size && <span className="text-sm text-zinc-500">Size: {item.size}</span>}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-500">Qty:</label>
                        <input
                          type="number" min="0"
                          value={item.qty ?? item.quantity ?? 0}
                          onChange={e => updateEditItemQty(i, e.target.value)}
                          className="w-20 border border-zinc-200 rounded text-center py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <label className="text-xs text-zinc-500">Unit Price ($):</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={item.price ?? item.base_price ?? 0}
                      onChange={e => updateEditItemPrice(i, e.target.value)}
                      className="w-24 border border-zinc-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </div>
                </div>
              ))}
              {editingItems.length === 0 && (
                <p className="text-sm text-zinc-400 italic py-2">No items.</p>
              )}
            </div>

            {/* Customization Matrix */}
            {editingMatrix.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-zinc-900 mb-3">Player Customization</h3>
                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-400 bg-zinc-50 border-b border-zinc-200">
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">#</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Item</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Size</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Player Name</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Number</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Initials</th>
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest">Sponsor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingMatrix.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="py-2 px-3 text-zinc-400 text-xs">{i + 1}</td>
                          <td className="py-2 px-3 text-xs text-zinc-700">{row.itemName}</td>
                          <td className="py-2 px-3">
                            <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2 py-0.5 rounded">{row.size}</span>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.playerName || ''}
                              onChange={e => updateMatrixRow(i, 'playerName', e.target.value.toUpperCase())}
                              placeholder="Name"
                              className="w-full border border-zinc-200 rounded px-2 py-1 text-xs uppercase focus:outline-none focus:border-zinc-400"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.playerNumber || ''}
                              onChange={e => updateMatrixRow(i, 'playerNumber', e.target.value)}
                              placeholder="#"
                              className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-zinc-400"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              maxLength={3}
                              value={row.initials || ''}
                              onChange={e => updateMatrixRow(i, 'initials', e.target.value.toUpperCase())}
                              placeholder="JS"
                              className="w-14 border border-zinc-200 rounded px-2 py-1 text-xs text-center uppercase focus:outline-none focus:border-zinc-400"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.sponsorName || ''}
                              onChange={e => updateMatrixRow(i, 'sponsorName', e.target.value)}
                              placeholder="Sponsor"
                              className="w-full border border-zinc-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-400"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <h3 className="font-bold text-zinc-900 mb-2">Notes</h3>
              <textarea
                value={editingOrder.notes || ''}
                onChange={e => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                rows={3}
                placeholder="Order notes..."
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
              />
            </div>

            {/* Financials */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Total Amount ($)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editingOrder.total_amount ?? 0}
                  onChange={e => setEditingOrder({ ...editingOrder, total_amount: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Deposit Paid ($)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editingOrder.deposit_paid ?? 0}
                  onChange={e => setEditingOrder({ ...editingOrder, deposit_paid: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Balance Owing</label>
                <p className={`text-lg font-black mt-2 ${Math.max(0, Number(editingOrder.total_amount) - Number(editingOrder.deposit_paid)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${Math.max(0, Number(editingOrder.total_amount) - Number(editingOrder.deposit_paid)).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end border-t border-zinc-100 pt-4">
              <button
                onClick={() => setEditingOrder(null)}
                className="px-6 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedOrder}
                disabled={isSavingEdit}
                className="px-6 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-700 disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printPreview && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex flex-col">
          <div className="bg-zinc-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">
                Print Preview — {printPreview.orientation === 'portrait' ? '📄 Portrait' : '📋 Landscape'}
              </span>
              <span className="text-zinc-400 text-xs">
                {printPreview.order.order_number} — {printPreview.club.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrintPreview(prev => prev ? { ...prev, orientation: prev.orientation === 'portrait' ? 'landscape' : 'portrait' } : null)}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition"
              >
                Switch to {printPreview.orientation === 'portrait' ? 'Landscape' : 'Portrait'}
              </button>
              <button
                onClick={() => printOrderProof(printPreview.order, printPreview.club, printPreview.orientation)}
                className="bg-[var(--primary-color)] hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded text-sm transition flex items-center gap-2"
              >
                🖨️ Print
              </button>
              <button
                onClick={() => setPrintPreview(null)}
                className="text-zinc-400 hover:text-white text-xl transition ml-2 leading-none"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-zinc-800 p-8">
            <div className={`bg-white shadow-2xl mx-auto min-h-[400px] p-8 ${printPreview.orientation === 'portrait' ? 'max-w-[595px]' : 'max-w-[842px]'}`}>
              <PrintPreviewContent
                order={printPreview.order}
                club={printPreview.club}
                orientation={printPreview.orientation}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Print Types Manager ─────────────────────────────────────────────────────

const PrintTypesManager: React.FC = () => {
  const [printTypes, setPrintTypes] = useState<PrintType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('print_types').select('*').order('sort_order');
    setPrintTypes((data || []) as PrintType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addType = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    const maxOrder = printTypes.reduce((m, p) => Math.max(m, p.sort_order), 0);
    const { error } = await supabase.from('print_types').insert([{ name: newName.trim(), sort_order: maxOrder + 1 }]);
    if (!error) { setNewName(''); await load(); }
    setIsSaving(false);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('print_types').update({ name: editName.trim() }).eq('id', id);
    if (!error) { setEditingId(null); await load(); }
  };

  const deleteType = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await supabase.from('print_types').delete().eq('id', id);
    await load();
  };

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-900">Print Types</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Global list used across all club items</p>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-sm text-zinc-400 py-4 text-center">Loading...</p>
        ) : printTypes.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">No print types yet.</p>
        ) : (
          printTypes.map((pt, idx) => (
            <div key={pt.id} className="flex items-center gap-2 py-1.5 border-b border-zinc-100 last:border-0">
              <GripVertical size={14} className="text-zinc-300 shrink-0" />
              <span className="text-[11px] text-zinc-400 w-5 shrink-0">{idx + 1}</span>
              {editingId === pt.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(pt.id); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 border border-zinc-200 rounded px-2 py-1 text-sm"
                  />
                  <button onClick={() => saveEdit(pt.id)} className="text-emerald-600 hover:text-emerald-700 text-xs font-bold px-2">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 text-xs px-1">x</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-zinc-800">{pt.name}</span>
                  <button onClick={() => { setEditingId(pt.id); setEditName(pt.name); }} className="text-zinc-400 hover:text-zinc-700">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteType(pt.id, pt.name)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
        <div className="flex gap-2 pt-3 border-t border-zinc-100">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addType(); }}
            placeholder="New print type name..."
            className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={addType}
            disabled={isSaving || !newName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </div>
  );
};
