import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, ExternalLink, Search, Upload } from 'lucide-react';
import { supabase, uploadImage } from '../supabase';
import { compressToWebP } from '../lib/imageUtils';
import { slugify } from '../utils/slugify';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  author: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  featured_product_ids: string[] | null;
}

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  image: string;
  product_code: string | null;
}

const EMPTY_FORM = {
  id: null as string | null,
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  image_url: '',
  thumbnail_url: '',
  author: 'Absolute Soccer Gear Experts',
  is_published: false,
};

export const BlogAdminTab: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<'hero' | 'thumbnail' | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FeaturedProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error('Error loading blog posts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const openNewPost = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setError(null);
    setProductSearch('');
    setSearchResults([]);
    setFeaturedProducts([]);
    setShowEditor(true);
  };

  const openEditPost = async (post: BlogPost) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content,
      image_url: post.image_url || '',
      thumbnail_url: post.thumbnail_url || '',
      author: post.author || 'Absolute Soccer Gear Experts',
      is_published: post.is_published,
    });
    setSlugTouched(true);
    setError(null);
    setProductSearch('');
    setSearchResults([]);
    setFeaturedProducts([]);
    setShowEditor(true);

    if (post.featured_product_ids && post.featured_product_ids.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, salePrice, image, product_code')
        .in('id', post.featured_product_ids);
      if (!error && data) {
        // Preserve the saved order rather than whatever order the DB returns
        const byId = new Map(data.map((p: FeaturedProduct) => [p.id, p]));
        setFeaturedProducts(post.featured_product_ids.map(id => byId.get(id)).filter(Boolean) as FeaturedProduct[]);
      }
    }
  };

  const handleTitleChange = (title: string) => {
    setForm(prev => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  };

  const handleBlogImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'hero' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingType(type);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Hero: 1200x630 (blog banner ratio); Thumbnail: 800x500 (card ratio)
        const [width, height] = type === 'hero' ? [1200, 630] : [800, 500];
        const compressed = await compressToWebP(reader.result as string, width, height, 0.85);
        const path = `blog/${type}_${Date.now()}.jpg`;
        const publicUrl = await uploadImage(compressed, path);

        if (type === 'hero') {
          setForm(prev => ({ ...prev, image_url: publicUrl }));
        } else {
          setForm(prev => ({ ...prev, thumbnail_url: publicUrl }));
        }
      } catch (err) {
        console.error('Blog image upload failed:', err);
        alert('Failed to upload image');
      } finally {
        setUploadingType(null);
      }
    };
    reader.onerror = () => {
      console.error('FileReader error reading blog image');
      setUploadingType(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const searchProducts = (query: string) => {
    setProductSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, salePrice, image, product_code')
          .ilike('name', `%${query.trim()}%`)
          .eq('is_online', true)
          .limit(8);
        if (!error) setSearchResults(data || []);
      } catch (err) {
        console.error('Product search failed:', err);
      }
    }, 300);
  };

  const addFeaturedProduct = (product: FeaturedProduct) => {
    setFeaturedProducts(prev => (prev.some(p => p.id === product.id) ? prev : [...prev, product]));
    setProductSearch('');
    setSearchResults([]);
  };

  const removeFeaturedProduct = (productId: string) => {
    setFeaturedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    const finalSlug = slugify(form.slug || form.title);
    if (!finalSlug) {
      setError('A valid slug is required.');
      return;
    }
    if (!form.content.trim()) {
      setError('Content is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        slug: finalSlug,
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        image_url: form.image_url.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        author: form.author.trim() || 'Absolute Soccer Gear Experts',
        is_published: form.is_published,
        featured_product_ids: featuredProducts.map(p => p.id),
      };

      if (form.id) {
        const { error } = await supabase
          .from('blog_posts')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert([{ ...payload, published_at: form.is_published ? new Date().toISOString() : null }]);
        if (error) throw error;
      }

      setShowEditor(false);
      await loadPosts();
    } catch (e: any) {
      console.error('Error saving blog post:', e);
      setError(e?.message?.includes('duplicate') ? 'That slug is already in use — choose a different one.' : (e?.message || 'Failed to save post.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', post.id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== post.id));
    } catch (e) {
      console.error('Error deleting blog post:', e);
      alert('Failed to delete post.');
    }
  };

  const filteredPosts = posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900">Blog / Gear Guides</h2>
          <p className="text-xs text-zinc-500 mt-1">{posts.length} total post{posts.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <button
            onClick={openNewPost}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
          >
            <Plus size={14} /> Add New Post
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading posts...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm">No blog posts found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-100">
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map(post => (
                <tr key={post.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="py-3 pr-4 font-bold text-zinc-900">{post.title}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {post.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-500 text-xs">
                    {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {post.is_published && (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
                          aria-label="View post"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => openEditPost(post)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
                        aria-label="Edit post"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                        aria-label="Delete post"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">
                {form.id ? 'Edit Post' : 'Add New Post'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-900" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{error}</div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="Article title"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => { setSlugTouched(true); setForm(prev => ({ ...prev, slug: e.target.value })); }}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-mono"
                  placeholder="auto-generated-from-title"
                />
                <p className="text-[10px] text-zinc-400 mt-1">torontosoccershop.com/blog/{slugify(form.slug || form.title) || '...'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Excerpt</label>
                <textarea
                  value={form.excerpt}
                  onChange={e => setForm(prev => ({ ...prev, excerpt: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="Short summary shown on the blog listing page"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Content (Markdown)</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={12}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="## Heading&#10;&#10;Article content in Markdown..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                  Hero Image (shown at top of article)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                    className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Hero image URL or upload"
                  />
                  <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 flex items-center gap-2 whitespace-nowrap">
                    <Upload size={14} />
                    {uploadingType === 'hero' ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingType !== null}
                      onChange={e => handleBlogImageUpload(e, 'hero')}
                    />
                  </label>
                </div>
                {form.image_url && (
                  <img src={form.image_url} alt="Hero preview" className="w-full h-40 object-cover rounded mt-2" referrerPolicy="no-referrer" />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                  Thumbnail (shown on blog listing cards)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.thumbnail_url}
                    onChange={e => setForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                    className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Thumbnail URL or upload"
                  />
                  <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 flex items-center gap-2 whitespace-nowrap">
                    <Upload size={14} />
                    {uploadingType === 'thumbnail' ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingType !== null}
                      onChange={e => handleBlogImageUpload(e, 'thumbnail')}
                    />
                  </label>
                </div>
                {form.thumbnail_url && (
                  <img src={form.thumbnail_url} alt="Thumbnail preview" className="w-full h-32 object-cover rounded mt-2" referrerPolicy="no-referrer" />
                )}
                <p className="text-[10px] text-zinc-400 mt-1">Falls back to the hero image on the listing page if left blank.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                  Featured Products (shown at bottom of article)
                </label>

                <input
                  type="text"
                  placeholder="Search products by name..."
                  value={productSearch}
                  onChange={e => searchProducts(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />

                {searchResults.filter(p => !featuredProducts.some(fp => fp.id === p.id)).length > 0 && (
                  <div className="mt-1 border border-zinc-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.filter(p => !featuredProducts.some(fp => fp.id === p.id)).map(product => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-2 border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 cursor-pointer"
                        onClick={() => addFeaturedProduct(product)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={product.image} alt="" className="w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
                          <span className="text-sm text-zinc-900 truncate">{product.name}</span>
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0 ml-2">${product.salePrice || product.price}</span>
                      </div>
                    ))}
                  </div>
                )}

                {featuredProducts.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {featuredProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={product.image} alt="" className="w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
                          <span className="text-sm font-medium text-zinc-900 truncate">{product.name}</span>
                        </div>
                        <button
                          onClick={() => removeFeaturedProduct(product.id)}
                          className="min-w-[28px] min-h-[28px] flex items-center justify-center text-red-500 hover:text-red-700 shrink-0"
                          aria-label={`Remove ${product.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Author</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={e => setForm(prev => ({ ...prev, author: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={e => setForm(prev => ({ ...prev, is_published: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-700">Published (visible on /blog)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowEditor(false)}
                className="px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs bg-[var(--primary-color)] text-white hover:bg-red-800 transition-colors disabled:opacity-50"
              >
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
