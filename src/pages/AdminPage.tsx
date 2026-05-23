import React, { useState, ChangeEvent, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, Product } from '../context/ProductContext';
import { useSettings, NavMenu, SEO, forceManualNavigationMigration } from '../context/SettingsContext';
import { DEFAULT_NAV } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import { Trash2, Edit2, Plus, Upload, LayoutDashboard, Package, Image as ImageIcon, Save, Check, X, ArrowLeft, Menu, ChevronDown, ChevronUp, LogOut, FileText, AlertCircle, Globe, Search, AlertTriangle, Download, Zap, CloudDownload, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { resizeImage } from '../lib/imageUtils';
import { uploadImage, supabase } from '../supabase';

type Tab = 'slider' | 'products' | 'home-layout' | 'navigation' | 'footer' | 'seo' | 'tools';

const CATEGORIES = [
  'Footwear',
  'Clubs',
  'National Teams',
  'Apparel',
  'Equipment',
  'Teams',
  'Soccer Balls',
  'Shin Guards',
  'Accessories',
  'Training',
  'Custom Lab',
  'Uniform Submission'
];

const getCategoryPath = (name: string) => {
  if (name === 'Custom Lab') return '/customization';
  if (name === 'Uniform Submission') return '/uniform-submission';
  return `/${name.toLowerCase().replace(/\s+/g, '-')}`;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminPageErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AdminPage Uncaught rendering error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-200 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900">Admin Panel Error Caught</h2>
              <p className="text-sm text-zinc-500">The dashboard encountered an error trying to process or render some data fields.</p>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl text-left border border-zinc-200">
              <p className="text-xs font-mono text-zinc-700 whitespace-pre-wrap overflow-x-auto max-h-32">
                {this.state.error?.message || "Unknown rendering exception"}
              </p>
            </div>
            <button 
              onClick={() => {
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-3 bg-[#b90014] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-zinc-900 transition-all shadow-lg"
            >
              Reset & Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AdminPage() {
  return (
    <AdminPageErrorBoundary>
      <AdminPageInner />
    </AdminPageErrorBoundary>
  );
}

function AdminPageInner() {
  const { 
    products, addProduct, deleteProduct, updateProduct, resetProducts, 
    fetchAdminProducts, loadMoreAdminProducts, hasMoreProducts, isLoading
  } = useProducts();
  const { sliderImages: contextSliderImages, setSliderImages: setContextSliderImages, logo, setLogo, landingLogo, setLandingLogo, labBackgroundImage, setLabBackgroundImage, footerLogo, setFooterLogo, homeCategories, setHomeCategories, navigationMenus, updateNavigationItem, saveNavigation, footerLinks, setFooterLinks, seoSettings, setSeoSettings, setGlobalSettings, resetSettings } = useSettings();
  const { logout, user } = useAuth();

  const updateDraftNavigationMenu = (index: number, field: string, value: string) => {
    setDraftNavigationMenus(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  useEffect(() => {
    fetchAdminProducts();
  }, []);
  
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({ 
    name: '', 
    price: 0, 
    category: 'Uncategorized', 
    submenu: '',
    submenus: [],
    image: '', 
    images: [],
    description: '',
    isNewArrival: true,
    isOnSale: false,
    isFeatured: true,
    salePrice: 0,
    colors: []
  });

  const availableCategories = useMemo(() => {
    const uniqueCats: string[] = [];
    const seen = new Set<string>();
    [...navigationMenus.map(m => m.label), ...homeCategories.map(c => c.name), ...CATEGORIES].forEach(c => {
      if (!seen.has(c.toUpperCase())) {
        seen.add(c.toUpperCase());
        uniqueCats.push(c);
      }
    });
    return uniqueCats.sort();
  }, [navigationMenus, homeCategories]);

  useEffect(() => {
    if (availableCategories.length > 0 && (!newProduct.category || newProduct.category === 'Uncategorized')) {
      setNewProduct(prev => ({ ...prev, category: availableCategories[0] }));
    }
  }, [availableCategories, newProduct.category]);

  const [activeTab, setActiveTab] = useState<Tab>('slider');
  const [dbMode, setDbMode] = useState<'supabase' | 'fallback' | 'unknown'>('unknown');

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        if (data.mode === 'supabase') setDbMode('supabase');
        else setDbMode('fallback');
      })
      .catch(() => setDbMode('unknown'));
  }, []);

  const isSupabaseConnected = dbMode === 'supabase';

  useEffect(() => {
    // Rely on Context to fetch products on mount
  }, []);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sliderImages, setSliderImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSyncingBucket, setIsSyncingBucket] = useState(false);
  const [draftLogo, setDraftLogo] = useState<string>(logo || '');
  const [draftLandingLogo, setDraftLandingLogo] = useState<string>(landingLogo || '');
  const [draftLabBackgroundImage, setDraftLabBackgroundImage] = useState<string>(labBackgroundImage || '');
  const [draftFooterLogo, setDraftFooterLogo] = useState<string>(footerLogo || '');
  const [draftHomeCategories, setDraftHomeCategories] = useState<any[]>(homeCategories || []);
  const [draftFooterLinks, setDraftFooterLinks] = useState<any[]>(footerLinks || []);
  const [draftNavigationMenus, setDraftNavigationMenus] = useState<any[]>(navigationMenus || []);
  const [draftSeoSettings, setDraftSeoSettings] = useState<any>(seoSettings || {});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<'idle' | 'success' | 'error' | 'syncing'>('idle');
  const [addErrorMessage, setAddErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [productSubTab, setProductSubTab] = useState<'list' | 'add' | 'bulk'>('list');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);

  useEffect(() => {
    setDisplayLimit(20);
  }, [productCategoryFilter, adminSearchTerm]);

  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [localSyncStatus, setLocalSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);
  const [localRestoreStatus, setLocalRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [pullStatus, setPullStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const syncToLocal = async () => {
    setIsSyncingLocal(true);
    setLocalSyncStatus('idle');
    try {
      const response = await fetch('/api/admin/sync-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: products,
          settings: {
            global: {
              logo,
              landingLogo,
              labBackgroundImage,
              footerLogo
            },
            slider: { sliderImages },
            homeCategories,
            navigation: { navigationMenus },
            footer: { footerLinks },
            seo: seoSettings
          }
        })
      });

      if (response.ok) {
        setLocalSyncStatus('success');
        setTimeout(() => setLocalSyncStatus('idle'), 3000);
      } else {
        setLocalSyncStatus('error');
      }
    } catch (error) {
      console.error('Sync to Local failed:', error);
      setLocalSyncStatus('error');
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const syncFromLocal = async (clearExisting: boolean = false) => {
    const message = clearExisting 
      ? 'Wipe your Supabase products and migrate fresh from local files?' 
      : 'Migrate data to Supabase? This will take the data from your local JSON files and upload it to your live Supabase database.';
      
    if (!window.confirm(message)) return;
    
    setIsRestoringLocal(true);
    setLocalRestoreStatus('idle');

    try {
      const response = await fetch('/api/admin/sync-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearExisting }) // Sending empty body or flag triggers server to read its own files
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to sync');
      }

      const result = await response.json();
      setLocalRestoreStatus('success');
      setTimeout(() => setLocalRestoreStatus('idle'), 3000);
      alert('Migration successful: ' + result.message);
      window.location.reload(); 
    } catch (error: any) {
      console.error('Migration failed:', error);
      setLocalRestoreStatus('error');
      alert('Migration failed: ' + error.message);
    } finally {
      setIsRestoringLocal(false);
    }
  };

  const pullFromCloud = async () => {
    if (!window.confirm('Pull data from Supabase? This will fetch all products and settings from your live database and save them as local backup files (products_exported.json). This is useful if you want to update your fallback data.')) return;
    
    setIsPullingCloud(true);
    setPullStatus('idle');

    try {
      const response = await fetch('/api/admin/pull-from-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to pull data');
      }

      const result = await response.json();
      setPullStatus('success');
      setTimeout(() => setPullStatus('idle'), 3000);
      alert('Pull Successful: ' + result.message);
    } catch (error: any) {
      console.error('Pull failed:', error);
      setPullStatus('error');
      alert('Pull failed: ' + error.message);
    } finally {
      setIsPullingCloud(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchLower = adminSearchTerm.trim().toLowerCase();
      
      // Category matching
      const matchesCategory = productCategoryFilter === 'All' || 
        (p.category && p.category.toString().toUpperCase() === productCategoryFilter.toUpperCase());
      
      // Search matching (case-insensitive)
      const name = (p.name || '').toString().toLowerCase();
      const cat = (p.category || '').toString().toLowerCase();
      const desc = (p.description || '').toString().toLowerCase();
      const sub = (p.submenu || '').toString().toLowerCase();
      const subsArr = (p.submenus || []).map(s => s.toString().toLowerCase());

      const matchesSearch = !searchLower || 
        name.includes(searchLower) ||
        cat.includes(searchLower) ||
        desc.includes(searchLower) ||
        sub.includes(searchLower) ||
        subsArr.some(s => s.includes(searchLower));
        
      return matchesCategory && matchesSearch;
    });
  }, [products, adminSearchTerm, productCategoryFilter]);

  const [bulkUploadStatus, setBulkUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const cleanImages = (contextSliderImages || []).filter(img => img && img.url && !img.url.startsWith('data:'));
    setSliderImages(cleanImages);
  }, [contextSliderImages]);

  useEffect(() => {
    setDraftLogo(logo || '');
  }, [logo]);

  useEffect(() => {
    setDraftLandingLogo(landingLogo || '');
  }, [landingLogo]);

  useEffect(() => {
    setDraftLabBackgroundImage(labBackgroundImage || '');
  }, [labBackgroundImage]);

  useEffect(() => {
    setDraftFooterLogo(footerLogo || '');
  }, [footerLogo]);

  useEffect(() => {
    setDraftHomeCategories(homeCategories || []);
  }, [homeCategories]);

  useEffect(() => {
    setDraftFooterLinks(footerLinks || []);
  }, [footerLinks]);

  useEffect(() => {
    setDraftSeoSettings(seoSettings || {});
  }, [seoSettings]);

  useEffect(() => {
    let menus = [...(navigationMenus || [])];
    
    // Merge existing/server menus into DEFAULT_NAV
    const merged = DEFAULT_NAV.map(defaultItem => {
      const existingItem = menus.find(m => m.label.toUpperCase() === defaultItem.label.toUpperCase());
      if (existingItem) {
        // Only use existingItem.submenus if it actually has items, otherwise keep default submenus
        const submenus = (existingItem.submenus && existingItem.submenus.length > 0) 
          ? existingItem.submenus 
          : defaultItem.submenus;
        return { ...defaultItem, ...existingItem, submenus };
      }
      return defaultItem;
    });
    
    // If there are items in menus not in DEFAULT_NAV, add them
    menus.forEach(menuItem => {
      if (!merged.find(m => m.label.toUpperCase() === menuItem.label.toUpperCase())) {
        merged.push(menuItem);
      }
    });

    setDraftNavigationMenus(merged);
  }, [navigationMenus]);

  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBulkUploading(true);
    setBulkUploadStatus('idle');
    setBulkUploadError(null);
    setBulkProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        setBulkProgress({ current: 0, total: data.length });

        let successCount = 0;
        let failCount = 0;

        for (const row of data) {
          try {
            // Basic validation
            if (!row.name || !row.price || !row.category || !row.image) {
              console.warn('Skipping invalid row:', row);
              failCount++;
              continue;
            }

            let mainImage = row.image;
            if (mainImage.startsWith('data:')) {
              console.log(`Uploading bulk image for: ${row.name}`);
              const path = `products/bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              mainImage = await uploadImage(mainImage, path);
            }

            const galleryImages = row.images ? row.images.split(',').map((s: string) => s.trim()) : [];
            const uploadedGallery = await Promise.all(galleryImages.map(async (img: string, idx: number) => {
              if (img.startsWith('data:')) {
                const path = `products/bulk_gallery_${Date.now()}_${idx}`;
                return await uploadImage(img, path);
              }
              return img;
            }));

            const product: Product = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: row.name,
              price: parseFloat(row.price),
              category: row.category,
              submenu: row.submenu || '',
              submenus: row.submenus ? row.submenus.split(',').map((s: string) => s.trim()) : [],
              image: mainImage,
              images: uploadedGallery,
              description: row.description || '',
              isNewArrival: row.isNewArrival === 'true' || row.isNewArrival === true,
              isOnSale: row.isOnSale === 'true' || row.isOnSale === true,
              isFeatured: row.isFeatured === 'true' || row.isFeatured === true,
              salePrice: row.salePrice ? parseFloat(row.salePrice) : undefined
            };

            await addProduct(product);
            successCount++;
            setBulkProgress(prev => ({ ...prev, current: successCount + failCount }));
          } catch (error) {
            console.error('Error adding bulk product:', error);
            failCount++;
          }
        }

        setIsBulkUploading(false);
        if (failCount === 0) {
          setBulkUploadStatus('success');
        } else {
          setBulkUploadError(`Uploaded ${successCount} products. ${failCount} failed.`);
          setBulkUploadStatus('error');
        }
        
        // Reset file input
        e.target.value = '';
        setTimeout(() => setBulkUploadStatus('idle'), 5000);
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setBulkUploadError('Failed to parse CSV file.');
        setBulkUploadStatus('error');
        setIsBulkUploading(false);
      }
    });
  };

  const downloadTemplate = () => {
    const headers = ['name', 'price', 'category', 'submenu', 'submenus', 'image', 'images', 'description', 'isNewArrival', 'isOnSale', 'isFeatured', 'salePrice'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" +
      "Example Shoe,299.99,Footwear,Firm-Ground,\"Nike,Firm-Ground,Men\",https://example.com/image.jpg,\"https://example.com/1.jpg,https://example.com/2.jpg\",Great shoe description,true,false,true,";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdd = async () => {
    setAddErrorMessage(null);
    
    if (!newProduct.name || !newProduct.price || !newProduct.image) {
      setAddErrorMessage('Please fill in Name, Price, and Image.');
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 3000);
      return;
    }

    setAddStatus('syncing');

    try {
      // Ensure no base64 in newProduct
      if (containsBase64(newProduct)) {
        setAddErrorMessage('Image upload in progress or invalid image data. Please try again.');
        setAddStatus('error');
        setTimeout(() => setAddStatus('idle'), 3000);
        return;
      }

      const productData = { ...newProduct };
      if (!productData.isOnSale) {
        delete (productData as any).salePrice;
      }
      
      // Perform the add
      await addProduct(productData);
      
      setAddStatus('success');
      setNewProduct({
        name: '',
        price: 0,
        description: '',
        category: availableCategories[0] || 'Uncategorized',
        submenu: '',
        submenus: [],
        image: '',
        isNewArrival: true,
        isOnSale: false,
        isFeatured: true,
        salePrice: 0,
        colors: []
      });
      setTimeout(() => setAddStatus('idle'), 3000);
      fetchAdminProducts();
    } catch (error: any) {
      console.error('AdminPage: Failed to add product', error);
      setAddErrorMessage(error.message || 'Failed to save to database.');
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 5000);
    }
  };

  const handleUpdate = async () => {
    if (editingProduct && editingProduct.name && editingProduct.price > 0) {
      setIsUploading(true);
      try {
        // Ensure no base64 in editingProduct
        if (containsBase64(editingProduct)) {
          alert('Image upload in progress. Please wait.');
          return;
        }

        const productData = { ...editingProduct };
        if (!productData.isOnSale) {
          delete productData.salePrice;
        }
        await updateProduct(productData);
        await fetchAdminProducts();
        setEditingProduct(null);
        alert('Product updated successfully!');
      } catch (error: any) {
        console.error('AdminPage: Failed to update product', error);
        alert('Failed to update product: ' + error.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        await fetchAdminProducts();
        alert('Product deleted successfully!');
      } catch (error: any) {
        console.error('AdminPage: Failed to delete product', error);
        alert('Failed to delete product: ' + error.message);
      }
    }
  };

  const handleReset = async () => {
    try {
      await resetProducts();
    } catch (error) {
      console.error('AdminPage: Failed to reset products', error);
    }
  };

  const handleClearAll = async () => {
    try {
      for (const p of products) {
        await deleteProduct(p.id);
      }
    } catch (error) {
      console.error('AdminPage: Failed to clear all products', error);
    }
  };

  const handleProductImageUpload = (e: ChangeEvent<HTMLInputElement>, isEditing: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 1000, 1250, 0.8);
          // Upload to Supabase instead of storing base64
          const path = `products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          
          if (isEditing && editingProduct) {
            setEditingProduct({ ...editingProduct, image: publicUrl });
          } else {
            setNewProduct({ ...newProduct, image: publicUrl });
          }
        } catch (err) {
          console.error("Product image upload failed:", err);
          setSaveErrorMessage("Failed to upload image to storage. Please check your Supabase configuration.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalImageUpload = (e: ChangeEvent<HTMLInputElement>, index: number, isEditing: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 1000, 1250, 0.8);
          const path = `products/gallery_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);

          if (isEditing && editingProduct) {
            const newImages = [...(editingProduct.images || [])];
            newImages[index] = publicUrl;
            setEditingProduct({ ...editingProduct, images: newImages });
          } else {
            const newImages = [...(newProduct.images || [])];
            newImages[index] = publicUrl;
            setNewProduct({ ...newProduct, images: newImages });
          }
        } catch (err) {
          console.error("Gallery image upload failed:", err);
          setSaveErrorMessage("Failed to upload image to storage.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNewSlide = async (publicUrl: string) => {
    const newImage = { url: publicUrl, title: '', link: '' };
    setSliderImages(prev => [...(prev || []), newImage]);
  };

  const syncSliderFromBucket = async (quiet = false) => {
    setIsSyncingBucket(true);
    if (!quiet) setSaveErrorMessage(null);
    try {
      const { data, error } = await supabase.storage.from('media').list('slider', {
        limit: 100
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        if (!quiet) alert("No files found in 'media' bucket folder 'slider'.");
        return;
      }

      const validFiles = data.filter(file => file.name && !file.name.startsWith('.') && file.name !== '.emptyFolderPlaceholder');
      if (validFiles.length === 0) {
        if (!quiet) alert("Found empty bucket folder or placeholder files in 'media/slider'.");
        return;
      }

      const newSliderImages = validFiles.map(file => {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(`slider/${file.name}`);
        let niceTitle = file.name.split('_').slice(1).join('_').replace(/\.[^/.]+$/, "");
        if (!niceTitle) niceTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
        return {
          url: urlData.publicUrl || '',
          title: niceTitle,
          link: ''
        };
      });

      const { error: dbError } = await supabase
        .from('settings')
        .update({ data: { sliderImages: newSliderImages } })
        .eq('key', 'slider');

      if (dbError) throw dbError;

      setSliderImages(newSliderImages);
      await setContextSliderImages(newSliderImages);
      
      if (!quiet) {
        alert(`Successfully synced ${newSliderImages.length} images from 'media/slider' to settings database!`);
      }
    } catch (err: any) {
      console.error("Bucket slider synchronization failed:", err);
      if (!quiet) setSaveErrorMessage("Sync Failed: " + (err.message || err));
    } finally {
      setIsSyncingBucket(false);
    }
  };

  // Disabled auto-sync of slider to allow deletions of images. Database is the absolute single source of truth.
  // Manual sync can be triggered from the "Sync Slider with Bucket" panel or Button by the admin.

  const handleDeleteSlide = (targetIndex: number) => {
    setSliderImages(prev => {
      const finalArray = (prev || []).filter((_, index) => index !== targetIndex);
      supabase
        .from('settings')
        .upsert({ key: 'slider', data: { sliderImages: finalArray } }, { onConflict: 'key' })
        .then(({ error }) => {
          if (error) {
            console.error("Failed to delete slide from database settings:", error);
          } else {
            console.log("Database slider settings updated successfully on delete!");
            setContextSliderImages(finalArray).catch(err => console.error("Context update error:", err));
          }
        });
      return finalArray;
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onerror = (err) => {
          console.error("FileReader error:", err);
          setUploading(false);
          setIsUploading(false);
          setSaveErrorMessage("Failed to read selected file.");
        };
        reader.onloadend = async () => {
          try {
            // STEP 1 - UPLOAD THE FILE (resized to save storage space and bandwidth)
            const resized = await resizeImage(reader.result as string, 1920, 1080, 0.8);
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const path = `slider/${fileName}`;
            const publicUrl = await uploadImage(resized, path);
            
            if (!publicUrl || publicUrl.startsWith('data:')) {
              throw new Error('Image upload returned invalid URL');
            }
            
            // STEP 2 - GRAB URL
            const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
            const verifiedUrl = urlData?.publicUrl || publicUrl;

            // STEP 3 - OVERWRITE THE SETTINGS TABLE
            const newSlide = { url: verifiedUrl, link: "", title: "New Slide" };
            setSliderImages(prev => {
              const finalArray = [...(prev || []), newSlide];
              
              supabase
                .from('settings')
                .upsert({ key: 'slider', data: { sliderImages: finalArray } }, { onConflict: 'key' })
                .then(({ error }) => {
                  if (error) {
                    console.error("Failed to update database slider settings:", error);
                    setSaveErrorMessage("Failed to save image to settings table: " + error.message);
                  } else {
                    console.log("Database slider settings updated successfully!");
                    setContextSliderImages(finalArray).catch(err => console.error("Context update error:", err));
                  }
                });

              return finalArray;
            });

            setSaveErrorMessage(null);
          } catch (error: any) {
            console.error("Upload error:", error);
            setSaveErrorMessage("Upload failed: " + (error.message || error));
          } finally {
            setUploading(false);
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (outerErr: any) {
        console.error("Outer slider upload exception:", outerErr);
        setUploading(false);
        setIsUploading(false);
        setSaveErrorMessage("Failed to process file: " + outerErr.message);
      }
    }
  };

  const updateSliderImage = async (index: number, field: 'title' | 'link' | 'url', value: string) => {
    let finalValue = value;
    if (field === 'url' && value.startsWith('data:')) {
      setUploading(true);
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 1920, 1080, 0.8);
        const path = `slider/${Date.now()}_pasted`;
        finalValue = await uploadImage(resized, path);
      } catch (err) {
        console.error("Slider upload failed:", err);
        alert("Failed to upload pasted image.");
        return;
      } finally {
        setUploading(false);
        setIsUploading(false);
      }
    }

    const newImages = [...sliderImages];
    newImages[index] = { ...newImages[index], [field]: finalValue as any };
    setSliderImages(newImages);
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 800, 800, 0.9);
          const path = `logos/main_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          setDraftLogo(publicUrl);
        } catch (err) {
          console.error("Logo upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLandingLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 800, 800, 0.9);
          const path = `logos/landing_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          setDraftLandingLogo(publicUrl);
        } catch (err) {
          console.error("Landing logo upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLabBackgroundImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 1920, 1080, 0.8);
          const path = `backgrounds/lab_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          setDraftLabBackgroundImage(publicUrl);
        } catch (err) {
          console.error("Background upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFooterLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 800, 800, 0.9);
          const path = `logos/footer_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          setDraftFooterLogo(publicUrl);
        } catch (err) {
          console.error("Footer logo upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const containsBase64 = (obj: any): boolean => {
    const str = JSON.stringify(obj);
    return str.includes('data:image');
  };

  const sanitizeNavMenus = async (menus: NavMenu[]): Promise<NavMenu[]> => {
    console.log('AdminPage: Sanitizing navigation menus (Deep recursion)...');
    const sanitized = await Promise.all(menus.map(async (menu) => {
      const sanitizedSubmenus = await Promise.all(menu.submenus.map(async (submenu) => {
        let sanitizedLogo = submenu.logo;
        if (sanitizedLogo?.startsWith('data:')) {
          console.log(`AdminPage: Sanitizing submenu logo: ${submenu.heading}`);
          const resized = await resizeImage(sanitizedLogo, 200, 200, 0.8);
          const path = `nav/submenu_${Date.now()}_sanitized`;
          sanitizedLogo = await uploadImage(resized, path);
        }

        const sanitizedItems = await Promise.all(submenu.items.map(async (item) => {
          let itemLogo = item.logo;
          if (itemLogo?.startsWith('data:')) {
            console.log(`AdminPage: Sanitizing item logo: ${item.label}`);
            const resized = await resizeImage(itemLogo, 200, 200, 0.8);
            const path = `nav/item_${Date.now()}_sanitized`;
            itemLogo = await uploadImage(resized, path);
          }
          return { ...item, logo: itemLogo };
        }));

        return { ...submenu, logo: sanitizedLogo, items: sanitizedItems };
      }));
      return { ...menu, submenus: sanitizedSubmenus };
    }));
    return sanitized;
  };

  const sanitizeState = async (obj: any): Promise<any> => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      if (obj.startsWith('data:')) {
        console.log('Sanitizing rogue base64 string during save...');
        const path = `sanitized/${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        // For navigation logos, we want smaller sizes
        const resized = await resizeImage(obj, 800, 800, 0.7);
        return await uploadImage(resized, path);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return await Promise.all(obj.map(item => sanitizeState(item)));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      const keys = Object.keys(obj);
      for (const key of keys) {
        result[key] = await sanitizeState(obj[key]);
      }
      return result;
    }

    return obj;
  };

  const handleSaveSlider = async () => {
    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      // First save the slider images
      await setContextSliderImages(sliderImages);
      // Then save global settings
      await setGlobalSettings({
        logo: draftLogo,
        landingLogo: draftLandingLogo,
        labBackgroundImage: draftLabBackgroundImage,
        footerLogo: draftFooterLogo
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save slider/logo:', error);
      setSaveErrorMessage(error.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHomeLayout = async () => {
    if (containsBase64(draftHomeCategories)) {
      setSaveErrorMessage('Image uploads in progress. Please wait.');
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);
    
    try {
      await setHomeCategories(draftHomeCategories);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save home layout', error);
      setSaveErrorMessage(error.message || 'Failed to save home layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNavigation = async () => {
    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      await saveNavigation(draftNavigationMenus);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Navigation save failed:', error);
      alert(`Database rejected navigation save: ${error.message}`);
      setSaveErrorMessage(error.message || 'Failed to save navigation.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFooter = async () => {
    setIsSaving(true);
    setSaveErrorMessage(null);

    const footerSize = JSON.stringify({ footerLinks: draftFooterLinks }).length;
    
    if (footerSize > 1000000) {
      setSaveErrorMessage('Footer links are too large.');
      setIsSaving(false);
      setTimeout(() => setSaveErrorMessage(null), 5000);
      return;
    }

    try {
      await setFooterLinks(draftFooterLinks);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save footer links', error);
      setSaveErrorMessage(error.message || 'Failed to save footer links.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSEO = async () => {
    if (containsBase64(draftSeoSettings)) {
      setSaveErrorMessage('Image upload in progress. Please wait.');
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      await setSeoSettings(draftSeoSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save SEO settings', error);
      setSaveErrorMessage(error.message || 'Failed to save SEO settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const addFooterLink = () => {
    setDraftFooterLinks([...draftFooterLinks, { label: 'New Link', path: '/' }]);
  };

  const removeFooterLink = (index: number) => {
    setDraftFooterLinks(draftFooterLinks.filter((_, i) => i !== index));
  };

  const updateFooterLink = (index: number, field: 'label' | 'path', value: string) => {
    const newLinks = [...draftFooterLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setDraftFooterLinks(newLinks);
  };

  const updateSeoField = async (field: keyof SEO, value: string) => {
    let finalValue = value;
    if (field === 'ogImage' && value.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 1200, 630, 0.8);
        const path = `seo/${Date.now()}_og`;
        finalValue = await uploadImage(resized, path);
      } catch (err) {
        console.error("SEO image upload failed:", err);
        alert("Failed to upload pasted image.");
        return;
      } finally {
        setIsUploading(false);
      }
    }
    setDraftSeoSettings({ ...draftSeoSettings, [field]: finalValue });
  };

  const updateNewProductImage = async (field: 'image' | 'additional' | 'color', value: string, index?: number, colorIndex?: number) => {
    let finalValue = value;
    if (value.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 1000, 1250, 0.8);
        const path = `products/${Date.now()}_pasted`;
        finalValue = await uploadImage(resized, path);
      } catch (err) {
        console.error("Product image upload failed:", err);
        alert("Failed to upload pasted image.");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (field === 'image') {
      setNewProduct({...newProduct, image: finalValue});
    } else if (field === 'additional' && index !== undefined) {
      const newImages = [...(newProduct.images || [])];
      newImages[index] = finalValue;
      setNewProduct({...newProduct, images: newImages});
    } else if (field === 'color' && colorIndex !== undefined && index !== undefined) {
      const newColors = [...(newProduct.colors || [])];
      const newImages = [...(newColors[colorIndex].images || [])];
      newImages[index] = finalValue;
      newColors[colorIndex] = { ...newColors[colorIndex], images: newImages };
      setNewProduct({...newProduct, colors: newColors});
    }
  };

  const updateEditingProductImage = async (field: 'image' | 'additional' | 'color', value: string, index?: number, colorIndex?: number) => {
    if (!editingProduct) return;
    let finalValue = value;
    if (value.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 1000, 1250, 0.8);
        const path = `products/${Date.now()}_pasted`;
        finalValue = await uploadImage(resized, path);
      } catch (err) {
        console.error("Editing product image upload failed:", err);
        alert("Failed to upload pasted image.");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (field === 'image') {
      setEditingProduct({...editingProduct, image: finalValue});
    } else if (field === 'additional' && index !== undefined) {
      const newImages = [...(editingProduct.images || [])];
      newImages[index] = finalValue;
      setEditingProduct({...editingProduct, images: newImages});
    } else if (field === 'color' && colorIndex !== undefined && index !== undefined) {
      const newColors = [...(editingProduct.colors || [])];
      const newImages = [...(newColors[colorIndex].images || [])];
      newImages[index] = finalValue;
      newColors[colorIndex] = { ...newColors[colorIndex], images: newImages };
      setEditingProduct({...editingProduct, colors: newColors});
    }
  };

  const addNavigationMenu = () => {
    setDraftNavigationMenus([...draftNavigationMenus, { label: 'NEW MENU', path: '/', submenus: [] }]);
  };

  const removeNavigationMenu = (index: number) => {
    setDraftNavigationMenus(draftNavigationMenus.filter((_, i) => i !== index));
  };

  const addSubmenu = (menuIndex: number) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus.push({ heading: 'NEW SUBMENU', items: [] });
    setDraftNavigationMenus(newMenus);
  };

  const removeSubmenu = (menuIndex: number, submenuIndex: number) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus = newMenus[menuIndex].submenus.filter((_, i) => i !== submenuIndex);
    setDraftNavigationMenus(newMenus);
  };

  const moveSubmenu = (menuIndex: number, submenuIndex: number, direction: 'up' | 'down') => {
    const newMenus = [...draftNavigationMenus];
    const submenus = [...newMenus[menuIndex].submenus];
    
    if (direction === 'up' && submenuIndex > 0) {
      [submenus[submenuIndex], submenus[submenuIndex - 1]] = [submenus[submenuIndex - 1], submenus[submenuIndex]];
    } else if (direction === 'down' && submenuIndex < submenus.length - 1) {
      [submenus[submenuIndex], submenus[submenuIndex + 1]] = [submenus[submenuIndex + 1], submenus[submenuIndex]];
    }
    
    newMenus[menuIndex].submenus = submenus;
    setDraftNavigationMenus(newMenus);
  };

  const updateSubmenuHeading = (menuIndex: number, submenuIndex: number, heading: string) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus[submenuIndex].heading = heading;
    setDraftNavigationMenus(newMenus);
  };

  const updateSubmenuPath = (menuIndex: number, submenuIndex: number, path: string) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus[submenuIndex].path = path;
    setDraftNavigationMenus(newMenus);
  };

  const updateSubmenuLogo = async (menuIndex: number, submenuIndex: number, logo: string) => {
    if (logo.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(logo, 200, 200, 0.8);
        const path = `nav/submenu_${Date.now()}_pasted`;
        const publicUrl = await uploadImage(resized, path);
        const newMenus = [...draftNavigationMenus];
        newMenus[menuIndex].submenus[submenuIndex].logo = publicUrl;
        setDraftNavigationMenus(newMenus);
      } catch (err) {
        console.error("Failed to upload pasted submenu logo:", err);
        alert("Failed to upload image. Please try again or use a URL.");
      } finally {
        setIsUploading(false);
      }
    } else {
      const newMenus = [...draftNavigationMenus];
      newMenus[menuIndex].submenus[submenuIndex].logo = logo;
      setDraftNavigationMenus(newMenus);
    }
  };

  const handleColorImageUpload = (e: ChangeEvent<HTMLInputElement>, colorIndex: number, imageIndex: number, isEditing: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 1000, 1250, 0.8);
          const path = `products/color_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);

          if (isEditing && editingProduct) {
            const newColors = [...(editingProduct.colors || [])];
            const colorImages = [...(newColors[colorIndex].images || [])];
            colorImages[imageIndex] = publicUrl;
            newColors[colorIndex] = { ...newColors[colorIndex], images: colorImages };
            setEditingProduct({ ...editingProduct, colors: newColors });
          } else {
            const newColors = [...(newProduct.colors || [])];
            const colorImages = [...(newColors[colorIndex].images || [])];
            colorImages[imageIndex] = publicUrl;
            newColors[colorIndex] = { ...newColors[colorIndex], images: colorImages };
            setNewProduct({ ...newProduct, colors: newColors });
          }
        } catch (err) {
          console.error("Color image upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmenuLogoUpload = async (menuIndex: number, submenuIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const path = `nav/submenu_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase()}`;
        const publicUrl = await uploadImage(file, path, 'navigation_logos');
        const sub = draftNavigationMenus[menuIndex].submenus[submenuIndex];

        // Update local state IMMEDIATELY so the user sees the preview
        const newMenus = [...draftNavigationMenus];
        newMenus[menuIndex].submenus[submenuIndex].logo = publicUrl;
        setDraftNavigationMenus(newMenus);

        // Try to update DB if id exists (legacy item being edited individually)
        if (sub.id) {
           await updateNavigationItem(sub.id, { logo_url: publicUrl });
        }
      } catch (err: any) {
        console.error("Submenu logo upload failed:", err);
        alert("Submenu logo upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const addSubmenuItem = (menuIndex: number, submenuIndex: number) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus[submenuIndex].items.push({ label: 'New Item', path: '/' });
    setDraftNavigationMenus(newMenus);
  };

  const removeSubmenuItem = (menuIndex: number, submenuIndex: number, itemIndex: number) => {
    const newMenus = [...draftNavigationMenus];
    newMenus[menuIndex].submenus[submenuIndex].items = newMenus[menuIndex].submenus[submenuIndex].items.filter((_, i) => i !== itemIndex);
    setDraftNavigationMenus(newMenus);
  };

  const updateSubmenuItem = async (menuIndex: number, submenuIndex: number, itemIndex: number, field: 'label' | 'path' | 'logo', value: string) => {
    if (field === 'logo' && value.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 120, 120, 0.8);
        const path = `nav/item_${Date.now()}_pasted`;
        const publicUrl = await uploadImage(resized, path);
        const newMenus = [...draftNavigationMenus];
        newMenus[menuIndex].submenus[submenuIndex].items[itemIndex] = { ...newMenus[menuIndex].submenus[submenuIndex].items[itemIndex], logo: publicUrl };
        setDraftNavigationMenus(newMenus);
      } catch (err) {
        console.error("Failed to upload pasted item logo:", err);
        alert("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
      }
    } else {
      const newMenus = [...draftNavigationMenus];
      newMenus[menuIndex].submenus[submenuIndex].items[itemIndex] = { ...newMenus[menuIndex].submenus[submenuIndex].items[itemIndex], [field]: value };
      setDraftNavigationMenus(newMenus);
    }
  };

  const handleSubmenuItemLogoUpload = async (menuIndex: number, submenuIndex: number, itemIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const path = `nav/item_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase()}`;
        const publicUrl = await uploadImage(file, path, 'navigation_logos');
        const item = draftNavigationMenus[menuIndex].submenus[submenuIndex].items[itemIndex];
        
        // Update local state IMMEDIATELY
        const newMenus = [...draftNavigationMenus];
        newMenus[menuIndex].submenus[submenuIndex].items[itemIndex].logo = publicUrl;
        setDraftNavigationMenus(newMenus);

        // Try to update DB if id exists
        if (item.id) {
            await updateNavigationItem(item.id, { logo_url: publicUrl });
        }
      } catch (err: any) {
        console.error("Item logo upload failed:", err);
        alert("Item logo upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const restoreSampleLogos = () => {
    const newMenus = draftNavigationMenus.map(menu => {
      const sampleMenu = DEFAULT_NAV.find(m => m.label.toUpperCase().trim() === menu.label.toUpperCase().trim());
      if (!sampleMenu) return menu;

      return {
        ...menu,
        submenus: menu.submenus.map(sub => {
          const sampleSub = sampleMenu.submenus.find(s => s.heading.toUpperCase().trim() === sub.heading.toUpperCase().trim());
          if (!sampleSub) return sub;

          return {
            ...sub,
            logo: sub.logo || sampleSub.logo,
            items: sub.items.map(item => {
              const sampleItem = sampleSub.items.find(i => i.label.toUpperCase().trim() === item.label.toUpperCase().trim());
              if (!sampleItem) return item;
              return { ...item, logo: item.logo || sampleItem.logo };
            })
          };
        })
      };
    });

    setDraftNavigationMenus(newMenus);
    alert('Sample logos applied to your current navigation. Click "Save Navigation" to apply changes.');
  };

  const handleAutoFixLogos = async () => {
    setIsSaving(true);
    setSaveErrorMessage("AUTO-FIXING LOGOS: Searching and uploading base64 strings directly to Supabase...");
    
    try {
      const menus = JSON.parse(JSON.stringify(draftNavigationMenus));
      let fixCount = 0;

      // Recursively find and fix base64 logos
      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        if (menu.submenus) {
          for (let j = 0; j < menu.submenus.length; j++) {
            const sub = menu.submenus[j];
            if (sub.logo && sub.logo.startsWith('data:image')) {
              console.log(`Fixing logo at [${i}].submenus[${j}].logo`);
              const path = `nav/auto-fix_${Date.now()}_sub_${i}_${j}`;
              sub.logo = await uploadImage(sub.logo, path);
              fixCount++;
            }
            if (sub.items) {
              for (let k = 0; k < sub.items.length; k++) {
                const item = sub.items[k];
                if (item.logo && item.logo.startsWith('data:image')) {
                  console.log(`Fixing logo at [${i}].submenus[${j}].items[${k}].logo`);
                  const path = `nav/auto-fix_${Date.now()}_item_${i}_${j}_${k}`;
                  item.logo = await uploadImage(item.logo, path);
                  fixCount++;
                }
              }
            }
          }
        }
      }
      
      if (fixCount === 0) {
        setSaveErrorMessage(null);
        setIsSaving(false);
        alert('No base64 logos detected. Your navigation state is clean!');
        return;
      }

      console.log(`Auto-fix complete. Total logos fixed: ${fixCount}`);
      setDraftNavigationMenus(menus);
      
      // Fixed: Removed invalid call to setNavigationMenus
      
      setSaveSuccess(true);
      setSaveErrorMessage(null);
      alert(`Auto-fix successfully fixed ${fixCount} logos in your local state. Please save your navigation to persist changes.`);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Auto-fix failed:', error);
      setSaveErrorMessage(`Auto-fix failed: ${error.message}`);
      alert(`Auto-fix failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addCategory = () => {
    const usedNames = draftHomeCategories.map(c => c.name);
    const firstAvailable = CATEGORIES.find(name => !usedNames.includes(name)) || CATEGORIES[0];
    setDraftHomeCategories([...draftHomeCategories, { 
      name: firstAvailable, 
      description: `Shop our ${firstAvailable} collection`, 
      image: '', 
      path: getCategoryPath(firstAvailable)
    }]);
  };

  const removeCategory = (index: number) => {
    setDraftHomeCategories(draftHomeCategories.filter((_, i) => i !== index));
  };

  const updateCategory = async (index: number, field: keyof typeof draftHomeCategories[0], value: string) => {
    let finalValue = value;
    if (field === 'image' && value.startsWith('data:')) {
      setIsUploading(true);
      try {
        const resized = await resizeImage(value, 900, 1200, 0.8);
        const path = `categories/${Date.now()}_pasted`;
        finalValue = await uploadImage(resized, path);
      } catch (err) {
        console.error("Category image upload failed:", err);
        alert("Failed to upload pasted image.");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const newCats = [...draftHomeCategories];
    newCats[index] = { ...newCats[index], [field]: finalValue as any };
    setDraftHomeCategories(newCats);
  };

  const handleCategoryImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resized = await resizeImage(reader.result as string, 900, 1200, 0.8);
          const path = `categories/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const publicUrl = await uploadImage(resized, path);
          updateCategory(index, 'image', publicUrl);
        } catch (err) {
          console.error("Category image upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-4 p-4 bg-zinc-900 rounded-lg flex flex-wrap gap-4 justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Database Tools</p>
            <div className="h-4 w-px bg-zinc-700" />
            <button 
              onClick={async () => {
                if (window.confirm('Standardize all products and navigation (lowercase fields, leading slashes, path normalization)? This fixes filtering issues and 404s on production.')) {
                  try {
                    const resp = await fetch('/api/admin/standardize-db', { method: 'POST' });
                    
                    if (!resp.ok) {
                      const text = await resp.text();
                      console.error('Server error response:', text);
                      throw new Error(`Server returned ${resp.status}: ${text.substring(0, 100)}...`);
                    }

                    const data = await resp.json();
                    if (data.results) {
                      alert(`Standardization complete!\n- Products Fixed: ${data.results.productsFixed}\n- Navigation Fixed: ${data.results.navigationFixed}\n- Errors: ${data.results.errors.length}`);
                    } else {
                      alert(data.message || 'Standardization complete');
                    }
                    window.location.reload();
                  } catch (err: any) {
                    console.error('Standardization error:', err);
                    alert('Standardization failed: ' + err.message);
                  }
                }
              }} 
              className="px-4 py-2 bg-zinc-700 text-white font-bold text-[10px] uppercase tracking-widest rounded hover:bg-zinc-600 transition-colors flex items-center gap-2"
            >
              🛠️ Standardize Database & Assets
            </button>
          </div>
          <button onClick={(e) => { e.preventDefault(); forceManualNavigationMigration(); }} className="px-4 py-2 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest rounded hover:bg-blue-700 transition-colors">
            🚀 Force Manual Database Migration
          </button>
        </div>
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-bold uppercase tracking-widest text-[10px] transition-colors">
            <ArrowLeft size={14} /> Back to Store
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-[10px] font-bold text-zinc-900 leading-none">{user?.email}</p>
              <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-black mt-1">Administrator</p>
            </div>
            <button 
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-red-50 hover:text-[#b90014] transition-all"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-headline font-black uppercase tracking-tighter italic text-zinc-900">
              Admin <span className="text-[#b90014]">Control Center</span>
            </h1>
            <div className="mt-2">
              <div className="flex items-center gap-4">
                <p className="text-zinc-500 font-medium">Manage your store's content and inventory</p>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm transition-all bg-green-50 border-green-100 text-green-700">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Database: Supabase (Ready)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <button 
                  onClick={() => syncFromLocal()}
                  disabled={isRestoringLocal}
                  className="flex items-center gap-2 px-4 py-2 bg-[#b90014] text-white rounded-lg border border-[#b90014] hover:bg-zinc-900 transition-all text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-900/20"
                >
                  {isRestoringLocal ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} />} 
                  {isRestoringLocal ? 'Migrating...' : 'Migrate Real Supabase Data'}
                </button>
                <button 
                  onClick={() => handleReset()}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-200 transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  <Package size={14} /> Restore All Local JSON Data
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm('Reset all settings (slider, logos, menus) to defaults?')) {
                      await resetSettings();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-200 transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  <LayoutDashboard size={14} /> Restore Default Settings
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-zinc-200">
            <button 
              onClick={() => setActiveTab('slider')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'slider' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <ImageIcon size={16} /> Slider
            </button>
            <button 
              onClick={() => setActiveTab('home-layout')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'home-layout' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <LayoutDashboard size={16} /> Home Layout
            </button>
            <button 
              onClick={() => setActiveTab('navigation')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'navigation' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Menu size={16} /> Navigation
            </button>
            <button 
              onClick={() => setActiveTab('footer')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'footer' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <FileText size={16} /> Footer
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'products' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Package size={16} /> Products
            </button>
            <button 
              onClick={() => setActiveTab('seo')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'seo' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Globe size={16} /> SEO
            </button>
            <button 
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'tools' ? 'bg-[#b90014] text-white shadow-md' : 'text-zinc-500 hover:text-[#b90014] hover:bg-red-50'}`}
            >
              <Zap size={16} /> Database Sync
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'slider' && (
            <motion.div 
              key="slider"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden mb-8">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Brand Identity</h2>
                    <p className="text-sm text-zinc-500 mt-1">Upload your store's logos (recommended 500x300, transparent SVG/PNG)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Header Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoFileChange} />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Landing Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleLandingLogoFileChange} />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Lab Background
                      <input type="file" className="hidden" accept="image/*" onChange={handleLabBackgroundImageFileChange} />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Footer Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleFooterLogoFileChange} />
                    </label>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 bg-zinc-50">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Header Logo Preview</p>
                    <div className="bg-white p-8 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center h-48">
                      <img src={draftLogo} alt="Header Logo Preview" className="max-h-32 w-auto object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Landing Logo Preview</p>
                    <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm flex items-center justify-center h-48">
                      <img src={draftLandingLogo} alt="Landing Logo Preview" className="max-h-32 w-auto object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Lab Background Preview</p>
                    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden h-48">
                      <img src={draftLabBackgroundImage} alt="Lab Background Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Footer Logo Preview</p>
                    <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm flex items-center justify-center h-48">
                      <img src={draftFooterLogo} alt="Footer Logo Preview" className="max-h-32 w-auto object-contain" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Homepage Hero Slider</h2>
                    <p className="text-sm text-zinc-500 mt-1">Upload high-resolution images for the main banner (recommended 1920x1080 for 16:9)</p>
                    {saveErrorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-bold uppercase tracking-widest">
                        {saveErrorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => syncSliderFromBucket()}
                      disabled={isSyncingBucket || isSaving || isUploading || uploading}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors hover:bg-[#b90014] ${(isSyncingBucket || isSaving || isUploading || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <RefreshCw size={14} className={isSyncingBucket ? "animate-spin" : ""} />
                      {isSyncingBucket ? 'Syncing...' : 'Sync from Storage'}
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Upload New
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleSaveSlider()}
                        disabled={isSaving || isUploading || uploading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[#b90014] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                      {isSaving || isUploading || uploading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : saveSuccess ? (
                        <Check size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {uploading || isUploading ? 'Uploading...' : isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                    </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-8">
                  {!sliderImages || !Array.isArray(sliderImages) || sliderImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                      <ImageIcon size={48} className="text-zinc-300 mb-4" />
                      <p className="text-zinc-500 font-medium">No images in slider. Upload some to get started.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sliderImages.map((img, index) => (
                        <motion.div 
                          layout
                          key={index} 
                          className="group relative rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-sm flex flex-col"
                        >
                          <div className="relative aspect-video">
                            <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => handleDeleteSlide(index)}
                                className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-lg"
                                title="Remove image"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                              Slide {index + 1}
                            </div>
                          </div>
                          
                          <div className="p-4 space-y-3 bg-white border-t border-zinc-100">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Slide Title (Optional)</label>
                              <input 
                                type="text" 
                                value={img.title || ''} 
                                onChange={(e) => updateSliderImage(index, 'title', e.target.value)}
                                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-[#b90014] outline-none"
                                placeholder="e.g. New Season Arrivals"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Click Link (URL)</label>
                              <input 
                                type="text" 
                                value={img.link || ''} 
                                onChange={(e) => updateSliderImage(index, 'link', e.target.value)}
                                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-[#b90014] outline-none"
                                placeholder="e.g. /footwear"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'home-layout' && (
            <motion.div 
              key="home-layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Home Page Categories</h2>
                    <p className="text-sm text-zinc-500 mt-1">Manage the category cards displayed on the home page</p>
                    {saveErrorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-bold uppercase tracking-widest">
                        {saveErrorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => addCategory()}
                      disabled={draftHomeCategories.length >= CATEGORIES.length}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-colors ${draftHomeCategories.length >= CATEGORIES.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Plus size={14} /> Add Category
                    </button>
                    <button 
                      onClick={() => handleSaveHomeLayout()}
                      disabled={isSaving || isUploading}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[#b90014] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSaving || isUploading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : saveSuccess ? (
                        <Check size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Layout'}
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {draftHomeCategories.map((cat, index) => (
                      <div key={index} className="bg-zinc-50 p-6 rounded-xl border border-zinc-100 space-y-4 relative group">
                        <button 
                          onClick={() => removeCategory(index)}
                          className="absolute top-4 right-4 text-zinc-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Category Name</label>
                          <select 
                            value={cat.name} 
                            onChange={(e) => {
                              const newName = e.target.value;
                              const newPath = getCategoryPath(newName);
                              const newCats = [...draftHomeCategories];
                              newCats[index] = { 
                                ...newCats[index], 
                                name: newName,
                                path: newPath,
                                description: newCats[index].description === `Shop our ${cat.name} collection` || newCats[index].description === 'Description' 
                                  ? `Shop our ${newName} collection` 
                                  : newCats[index].description
                              };
                              setDraftHomeCategories(newCats);
                            }}
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-[#b90014]"
                          >
                            <option value={cat.name}>{cat.name}</option>
                            {CATEGORIES.filter(name => 
                              name !== cat.name && !draftHomeCategories.some(c => c.name === name)
                            ).map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
                          <input 
                            type="text" 
                            value={cat.description} 
                            onChange={(e) => updateCategory(index, 'description', e.target.value)}
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Path (e.g. /clubs)</label>
                          <input 
                            type="text" 
                            value={cat.path} 
                            onChange={(e) => updateCategory(index, 'path', e.target.value)}
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Image (900x1200)</label>
                          <div className="flex gap-4 items-start">
                            <div className="w-20 h-20 bg-zinc-200 rounded-lg overflow-hidden flex-shrink-0">
                              {cat.image ? (
                                <img src={cat.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                  <ImageIcon size={24} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="relative">
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => handleCategoryImageUpload(index, e)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <button className="w-full p-2 bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                  Upload Image
                                </button>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Or Image URL"
                                value={cat.image} 
                                onChange={(e) => updateCategory(index, 'image', e.target.value)}
                                className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-[10px]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'navigation' && (
            <motion.div
              key="navigation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Main Navigation & Mega Menus</h2>
                    <p className="text-sm text-zinc-500 mt-1">Configure your site's main navigation and the columns in the mega menus.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button 
                        onClick={restoreSampleLogos}
                        className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors border border-zinc-200"
                      >
                        Restore Sample Logos
                      </button>
                      <button 
                        onClick={handleAutoFixLogos}
                        className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors border border-zinc-900 shadow-sm flex items-center gap-1"
                      >
                        <Zap size={12} className="text-yellow-400" />
                        Auto-Fix Default Logos
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('This will completely replace your current navigation with the default structure. Are you sure?')) {
                            setDraftNavigationMenus(DEFAULT_NAV);
                            alert('Navigation reset to defaults. Click "Save Changes" to apply.');
                          }
                        }}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors border border-red-100"
                      >
                        Reset to Defaults
                      </button>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest flex items-center">
                        ← Apply default club/brand logos to your menus
                      </p>
                    </div>
                    {saveErrorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-bold uppercase tracking-widest">
                        {saveErrorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={addNavigationMenu}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors"
                    >
                      <Plus size={14} /> Add Main Menu
                    </button>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleSaveNavigation()}
                        disabled={isSaving || isUploading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[#b90014] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                      {isSaving || isUploading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : saveSuccess ? (
                        <Check size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                    </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-12">
                  {draftNavigationMenus.map((menu, menuIndex) => (
                    <div key={menuIndex} className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
                      <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between gap-4">
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Menu Label</label>
                            <input 
                              type="text" 
                              value={menu.label}
                              onChange={(e) => updateDraftNavigationMenu(menuIndex, 'label', e.target.value)}
                              className="w-full bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900 rounded-lg px-3 py-2 text-sm font-bold"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Path</label>
                            <input 
                              type="text" 
                              value={menu.path}
                              onChange={(e) => updateDraftNavigationMenu(menuIndex, 'path', e.target.value)}
                              className="w-full bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => removeNavigationMenu(menuIndex)}
                          className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                            <ChevronDown size={14} /> Submenu Columns
                          </h3>
                          <button 
                            onClick={() => addSubmenu(menuIndex)}
                            className="text-[10px] font-black text-zinc-500 hover:text-zinc-900 uppercase tracking-widest flex items-center gap-1 transition-colors"
                          >
                            <Plus size={12} /> Add Column
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {menu.submenus.map((submenu, submenuIndex) => (
                            <div key={submenuIndex} className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                              <div className="flex items-center justify-between mb-4 gap-2">
                                <div className="flex-1 space-y-2">
                                  <div>
                                    <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Column Heading</label>
                                    <input 
                                      type="text" 
                                      value={submenu.heading}
                                      onChange={(e) => updateSubmenuHeading(menuIndex, submenuIndex, e.target.value)}
                                      className="w-full text-[10px] font-black text-zinc-900 uppercase tracking-widest bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900 rounded px-2 py-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Column Page Path (Optional)</label>
                                    <input 
                                      type="text" 
                                      placeholder="/path"
                                      value={submenu.path || ''}
                                      onChange={(e) => updateSubmenuPath(menuIndex, submenuIndex, e.target.value)}
                                      className="w-full text-[10px] text-zinc-500 bg-zinc-50 border-none focus:ring-1 focus:ring-zinc-900 rounded px-2 py-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Column Logo (Optional)</label>
                                    <div className="flex gap-2 items-start">
                                      <div className="w-10 h-10 bg-zinc-50 border border-zinc-200 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {submenu.logo ? (
                                          <img src={submenu.logo} alt="" className="w-full h-full object-contain" />
                                        ) : (
                                          <ImageIcon size={14} className="text-zinc-300" />
                                        )}
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        <div className="relative">
                                          <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={(e) => handleSubmenuLogoUpload(menuIndex, submenuIndex, e)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          />
                                          <button className="w-full p-1 bg-zinc-200 text-zinc-700 rounded text-[8px] font-bold uppercase tracking-widest">
                                            Upload Logo
                                          </button>
                                        </div>
                                        <input 
                                          type="text" 
                                          placeholder="Or Logo URL"
                                          value={submenu.logo || ''}
                                          onChange={(e) => updateSubmenuLogo(menuIndex, submenuIndex, e.target.value)}
                                          className="w-full text-[10px] text-zinc-500 bg-zinc-50 border-none focus:ring-1 focus:ring-zinc-900 rounded px-2 py-1"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => moveSubmenu(menuIndex, submenuIndex, 'up')}
                                    className="text-zinc-400 hover:text-zinc-900 transition-colors"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button 
                                    onClick={() => moveSubmenu(menuIndex, submenuIndex, 'down')}
                                    className="text-zinc-400 hover:text-zinc-900 transition-colors"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                  <button 
                                    onClick={() => removeSubmenu(menuIndex, submenuIndex)}
                                    className="text-zinc-400 hover:text-red-600 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                {submenu.items.map((item, itemIndex) => (
                                  <div key={itemIndex} className="flex items-center gap-2 group">
                                    <div className="flex-1 space-y-1">
                                      <input 
                                        type="text" 
                                        placeholder="Label"
                                        value={item.label}
                                        onChange={(e) => updateSubmenuItem(menuIndex, submenuIndex, itemIndex, 'label', e.target.value)}
                                        className="w-full text-xs bg-zinc-50 border-none focus:ring-1 focus:ring-zinc-900 rounded px-2 py-1"
                                      />
                                      <input 
                                        type="text" 
                                        placeholder="Path"
                                        value={item.path}
                                        onChange={(e) => updateSubmenuItem(menuIndex, submenuIndex, itemIndex, 'path', e.target.value)}
                                        className="w-full text-[10px] text-zinc-500 bg-zinc-50 border-none focus:ring-1 focus:ring-zinc-900 rounded px-2 py-1"
                                      />
                                      <div className="flex gap-2 items-center">
                                        <div className="w-6 h-6 bg-zinc-50 border border-zinc-200 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                          {item.logo ? (
                                            <img src={item.logo} alt="" className="w-full h-full object-contain" />
                                          ) : (
                                            <ImageIcon size={10} className="text-zinc-300" />
                                          )}
                                        </div>
                                        <div className="flex-1 relative">
                                          <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={(e) => handleSubmenuItemLogoUpload(menuIndex, submenuIndex, itemIndex, e)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          />
                                          <button className="w-full p-1 bg-zinc-200 text-zinc-700 rounded text-[8px] font-bold uppercase tracking-widest">
                                            Upload
                                          </button>
                                        </div>
                                        <input 
                                          type="text" 
                                          placeholder="URL"
                                          value={item.logo || ''}
                                          onChange={(e) => updateSubmenuItem(menuIndex, submenuIndex, itemIndex, 'logo', e.target.value)}
                                          className="flex-[2] text-[10px] text-zinc-500 bg-zinc-50 border-none focus:ring-1 focus:ring-zinc-900 rounded px-2 py-1"
                                        />
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => removeSubmenuItem(menuIndex, submenuIndex, itemIndex)}
                                      className="p-1 text-zinc-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => addSubmenuItem(menuIndex, submenuIndex)}
                                  className="w-full py-2 border border-dashed border-zinc-200 rounded text-[10px] font-bold text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all uppercase tracking-widest"
                                >
                                  + Add Link
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'footer' && (
            <motion.div 
              key="footer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Footer Links Editor</h2>
                    <p className="text-sm text-zinc-500 mt-1">Manage the links displayed in the footer.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => addFooterLink()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors"
                    >
                      <Plus size={14} /> Add Link
                    </button>
                    <button 
                      onClick={() => handleSaveFooter()}
                      disabled={isSaving || isUploading}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[#b90014] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSaving || isUploading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : saveSuccess ? (
                        <Check size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Footer'}
                    </button>
                  </div>
                </div>
                
                <div className="p-8 space-y-4">
                  {draftFooterLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <input 
                        type="text" 
                        value={link.label} 
                        onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                        className="flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm"
                        placeholder="Link Label"
                      />
                      <input 
                        type="text" 
                        value={link.path} 
                        onChange={(e) => updateFooterLink(index, 'path', e.target.value)}
                        className="flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm"
                        placeholder="Link Path (e.g., /contact-us)"
                      />
                      <button onClick={() => removeFooterLink(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'seo' && (
            <motion.div 
              key="seo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">SEO Settings</h2>
                    <p className="text-sm text-zinc-500 mt-1">Optimize your site for search engines and social sharing.</p>
                  </div>
                  <button 
                    onClick={() => handleSaveSEO()}
                    disabled={isSaving || isUploading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[#b90014] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSaving || isUploading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveSuccess ? (
                      <Check size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save SEO'}
                  </button>
                </div>
                
                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#b90014]">General Meta Tags</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Meta Title</label>
                        <input
                          type="text"
                          value={draftSeoSettings.title}
                          onChange={(e) => updateSeoField('title', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b90014] outline-none transition-all"
                          placeholder="Site Title"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Meta Description</label>
                        <textarea
                          value={draftSeoSettings.description}
                          onChange={(e) => updateSeoField('description', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b90014] outline-none transition-all min-h-[100px]"
                          placeholder="Site Description"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Keywords</label>
                        <input
                          type="text"
                          value={draftSeoSettings.keywords}
                          onChange={(e) => updateSeoField('keywords', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b90014] outline-none transition-all"
                          placeholder="soccer, mississauga, custom uniforms..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#b90014]">Social Sharing</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OG Title</label>
                        <input
                          type="text"
                          value={draftSeoSettings.ogTitle}
                          onChange={(e) => updateSeoField('ogTitle', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b90014] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OG Image URL</label>
                        <input
                          type="text"
                          value={draftSeoSettings.ogImage}
                          onChange={(e) => updateSeoField('ogImage', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[#b90014] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tools' && (
            <motion.div 
              key="tools"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Migration Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-zinc-100 bg-[#b90014]/5">
                    <div className="w-12 h-12 bg-[#b90014] rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-red-900/20">
                      <Zap size={24} />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 italic">Data <span className="text-[#b90014]">Migration</span></h2>
                    <p className="text-sm text-zinc-500 mt-2">Move your existing data from local files or Firebase to your new Supabase database.</p>
                  </div>
                  <div className="p-8 flex-1 space-y-6">
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm h-fit">
                        {dbMode === 'supabase' ? (
                          <AlertTriangle size={20} className="text-[#b90014]" />
                        ) : (
                          <AlertCircle size={20} className="text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 uppercase tracking-widest leading-relaxed">
                          Database Status: <span className={dbMode === 'supabase' ? 'text-green-600' : 'text-amber-600'}>{dbMode.toUpperCase()}</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {dbMode === 'fallback' 
                            ? "Server is currently using local backup files because Supabase is not configured or reachable. Run migration to sync to Supabase."
                            : "Server is connected to Supabase. You can sync or re-migrate your local data at any time."
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl mb-2">
                        <p className="text-[10px] font-black uppercase text-[#b90014] mb-2 text-center flex items-center justify-center gap-2">
                          <Check size={12} /> Supabase Schema Tip
                        </p>
                        <p className="text-[9px] text-red-900 leading-relaxed text-center">
                          If you get errors about "column already exists", it means your table structure is already correct! 
                          <strong> Do not try to add the column again</strong>. Just hit the "Sync" button below to upload your data.
                        </p>
                      </div>

                      <button 
                        onClick={() => syncFromLocal(false)}
                        disabled={isRestoringLocal}
                        className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#b90014] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-zinc-900/10 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {isRestoringLocal ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Zap size={16} />
                        )}
                        {isRestoringLocal ? 'Migrating Data...' : 'Sync Local Data (Incremental)'}
                      </button>

                      <button 
                        onClick={() => syncFromLocal(true)}
                        disabled={isRestoringLocal}
                        className="w-full py-3 border-2 border-zinc-900 text-zinc-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-900 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <Trash2 size={14} />
                        Clear & Full Re-Migration
                      </button>
                    </div>
                    
                    {localRestoreStatus === 'success' && (
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest text-center animate-bounce">
                        Migration Successful! Database is now synced.
                      </p>
                    )}
                  </div>
                </div>

                {/* Backup Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-zinc-100 bg-zinc-50">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-zinc-900/10">
                      <Download size={24} />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 italic">Backups <span className="text-zinc-400">& Recovery</span></h2>
                    <p className="text-sm text-zinc-500 mt-2">Download a full snapshot of your database or restore from a previously saved file.</p>
                  </div>
                  <div className="p-8 flex-1 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => pullFromCloud()}
                        disabled={isPullingCloud}
                        className="p-4 rounded-xl border border-zinc-200 hover:border-[#b90014] hover:bg-zinc-50 transition-all text-left flex items-center gap-4 disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-zinc-900/10">
                          {isPullingCloud ? (
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CloudDownload size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-zinc-900 tracking-widest">Pull from Cloud</p>
                          <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">Update local backups from Supabase</p>
                        </div>
                      </button>

                      <button
                        onClick={async () => {
                          const response = await fetch('/api/admin/local-backup');
                          const data = await response.json();
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                        }}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-center group"
                      >
                        <div className="p-3 bg-zinc-100 rounded-xl text-zinc-600 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                          <Download size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Download Snapshot</span>
                      </button>

                      <label className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-center group cursor-pointer">
                        <div className={`p-3 rounded-xl transition-all ${
                          isRestoringLocal ? 'bg-zinc-900 text-white' : 
                          localRestoreStatus === 'success' ? 'bg-green-600 text-white' :
                          localRestoreStatus === 'error' ? 'bg-red-600 text-white' :
                          'bg-zinc-100 text-zinc-600 group-hover:bg-[#b90014] group-hover:text-white'
                        }`}>
                          {isRestoringLocal ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Upload size={20} />
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Restore Snapshot</span>
                        <input type="file" className="hidden" accept=".json" disabled={isRestoringLocal} onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          if (!window.confirm('Are you sure you want to restore this snapshot? This will overwrite existing data in Supabase.')) {
                            e.target.value = '';
                            return;
                          }

                          setIsRestoringLocal(true);
                          setLocalRestoreStatus('idle');

                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const data = JSON.parse(event.target?.result as string);
                              
                              if (containsBase64(data)) {
                                if (!window.confirm('This backup contains base64 images which may cause "Payload Too Large" errors on Vercel. Would you like to try anyway?')) {
                                  setIsRestoringLocal(false);
                                  return;
                                }
                              }

                              const response = await fetch('/api/admin/sync-local', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                              });

                              if (!response.ok) {
                                const errData = await response.json();
                                throw new Error(errData.error || 'Failed to restore backup');
                              }

                              const result = await response.json();
                              setLocalRestoreStatus('success');
                              alert('Backup restored successfully: ' + result.message);
                              window.location.reload();
                            } catch (error: any) {
                              console.error('Restore failed:', error);
                              setLocalRestoreStatus('error');
                              alert('Restore failed: ' + (error.message || 'Unknown error'));
                            } finally {
                              setIsRestoringLocal(false);
                            }
                          };
                          reader.onerror = () => {
                            setIsRestoringLocal(false);
                            setLocalRestoreStatus('error');
                            alert('Failed to read file');
                          };
                          reader.readAsText(file);
                        }} />
                      </label>
                    </div>

                    <div className="p-4 bg-zinc-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Local Cache Sync</span>
                      </div>
                      <button 
                        onClick={() => syncToLocal()}
                        disabled={isSyncingLocal}
                        className="text-[9px] font-black uppercase tracking-widest text-[#b90014] hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        {isSyncingLocal ? 'Syncing...' : 'Force Sync Now'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div 
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex gap-4 border-b border-zinc-200 pb-4">
                {(['list', 'add', 'bulk'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setProductSubTab(tab)}
                    className={`px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${productSubTab === tab ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    {tab === 'list' ? 'Product List' : tab === 'add' ? 'Add Product' : 'Bulk Upload'}
                  </button>
                ))}
              </div>

              {productSubTab === 'bulk' && (
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
                  <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-[#b90014]" /> Bulk Upload
                  </h2>
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-500">
                      Upload a CSV file to add multiple products at once. 
                      <button 
                        onClick={downloadTemplate}
                        className="text-[#b90014] font-bold hover:underline ml-1"
                      >
                        Download Template
                      </button>
                    </p>
                    
                    <div className="relative">
                      <label className={`w-full flex flex-col items-center justify-center px-4 py-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                        isBulkUploading ? 'bg-zinc-50 border-zinc-200 cursor-not-allowed' : 
                        bulkUploadStatus === 'success' ? 'bg-green-50 border-green-200' :
                        bulkUploadStatus === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-zinc-50 border-zinc-200 hover:border-[#b90014] hover:bg-white'
                      }`}>
                        {isBulkUploading ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-zinc-200 border-t-[#b90014] rounded-full animate-spin" />
                            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                              Processing {bulkProgress.current} / {bulkProgress.total}
                            </p>
                          </div>
                        ) : bulkUploadStatus === 'success' ? (
                          <div className="flex flex-col items-center gap-2 text-green-600">
                            <Check size={32} />
                            <p className="text-xs font-bold uppercase tracking-widest">Upload Complete!</p>
                          </div>
                        ) : bulkUploadStatus === 'error' ? (
                          <div className="flex flex-col items-center gap-2 text-red-600">
                            <AlertCircle size={32} />
                            <p className="text-xs font-bold uppercase tracking-widest text-center">{bulkUploadError}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <Upload size={32} />
                            <p className="text-xs font-bold uppercase tracking-widest">Select CSV File</p>
                          </div>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".csv" 
                          onChange={handleBulkUpload}
                          disabled={isBulkUploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {productSubTab === 'add' && (
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
                  <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <Plus size={20} className="text-[#b90014]" /> Add New Product
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Product Name</label>
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] focus:border-transparent transition-all outline-none" placeholder="e.g. Real Madrid Home Kit" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Price ($)</label>
                        <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] focus:border-transparent transition-all outline-none" placeholder="0.00" type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Category</label>
                          <select 
                            className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none appearance-none cursor-pointer" 
                            value={newProduct.category} 
                            onChange={e => setNewProduct({...newProduct, category: e.target.value, submenu: ''})}
                          >
                            {availableCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const menu = navigationMenus.find(m => m.label.toUpperCase() === newProduct.category.toUpperCase());
                          if (!menu || menu.submenus.length === 0) return null;
                          
                          return (
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Submenus / Columns (Multiple)</label>
                              <div className="space-y-2">
                                <div className="relative">
                                  <select 
                                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none appearance-none cursor-pointer pr-10" 
                                    value="" 
                                    onChange={e => {
                                      if (e.target.value && !newProduct.submenus?.includes(e.target.value)) {
                                        setNewProduct({...newProduct, submenus: [...(newProduct.submenus || []), e.target.value]});
                                      }
                                    }}
                                  >
                                    <option value="">Add Submenu...</option>
                                    {menu.submenus.map(sub => (
                                      <React.Fragment key={sub.heading}>
                                        <option value={sub.heading} className="font-bold">{sub.heading} (Column Heading)</option>
                                        {sub.items.map((item, itemIdx) => (
                                          <option key={item.label + itemIdx} value={item.label}>&nbsp;&nbsp;{item.label}</option>
                                        ))}
                                      </React.Fragment>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {newProduct.submenus?.map(sub => (
                                    <span key={sub} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase rounded border border-zinc-200">
                                      {sub}
                                      <button onClick={() => setNewProduct({...newProduct, submenus: newProduct.submenus?.filter(s => s !== sub)})}>
                                        <X size={10} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Product Image (1000x1250)</label>
                      <div className="flex gap-4 items-start">
                        <div className="w-20 h-20 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                          {newProduct.image ? (
                            <img src={newProduct.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                              <ImageIcon size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                            <Upload size={14} /> Upload Image
                            <input type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                          </label>
                          <input 
                            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[#b90014] outline-none" 
                            placeholder="Or paste image URL..." 
                            value={newProduct.image} 
                            onChange={e => updateNewProductImage('image', e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Additional Images</label>
                      <div className="space-y-3">
                        {(newProduct.images || []).map((img, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="w-10 h-10 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                              {img ? (
                                <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                  <ImageIcon size={14} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-200 transition-colors w-fit">
                                <Upload size={12} /> Upload
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAdditionalImageUpload(e, idx)} />
                              </label>
                              <input 
                                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[#b90014] outline-none" 
                                placeholder="Or paste image URL..." 
                                value={img} 
                                onChange={e => updateNewProductImage('additional', e.target.value, idx)} 
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newImages = (newProduct.images || []).filter((_, i) => i !== idx);
                                setNewProduct({...newProduct, images: newImages});
                              }}
                              className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => setNewProduct({...newProduct, images: [...(newProduct.images || []), '']})}
                          className="w-full py-2 border border-dashed border-zinc-200 rounded text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-all uppercase tracking-widest"
                        >
                          + Add Image
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Color Ways (Optional)</label>
                      <div className="space-y-4">
                        {(newProduct.colors || []).map((color, colorIdx) => (
                          <div key={colorIdx} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 relative group">
                            <button 
                              onClick={() => {
                                const newColors = (newProduct.colors || []).filter((_, i) => i !== colorIdx);
                                setNewProduct({...newProduct, colors: newColors});
                              }}
                              className="absolute top-2 right-2 text-zinc-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Name</label>
                                <input 
                                  className="w-full p-2 bg-white border border-zinc-200 rounded text-xs" 
                                  placeholder="e.g. Red/White" 
                                  value={color.name} 
                                  onChange={e => {
                                    const newColors = [...(newProduct.colors || [])];
                                    newColors[colorIdx] = {...newColors[colorIdx], name: e.target.value};
                                    setNewProduct({...newProduct, colors: newColors});
                                  }} 
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Price (Optional)</label>
                                <input 
                                  className="w-full p-2 bg-white border border-zinc-200 rounded text-xs" 
                                  placeholder="Leave empty for base price" 
                                  type="number"
                                  value={color.price || ''} 
                                  onChange={e => {
                                    const newColors = [...(newProduct.colors || [])];
                                    newColors[colorIdx] = {...newColors[colorIdx], price: e.target.value ? parseFloat(e.target.value) : undefined};
                                    setNewProduct({...newProduct, colors: newColors});
                                  }} 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Images</label>
                              <div className="space-y-2">
                                {(color.images || []).map((img, imgIdx) => (
                                  <div key={imgIdx} className="flex gap-2 items-center">
                                    <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                                      {img ? (
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                          <ImageIcon size={12} />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 flex gap-2">
                                      <label className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-zinc-200 text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-50 transition-colors w-fit">
                                        <Upload size={10} />
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleColorImageUpload(e, colorIdx, imgIdx)} />
                                      </label>
                                      <input 
                                        className="flex-1 p-1 bg-white border border-zinc-200 rounded text-[9px]" 
                                        placeholder="URL" 
                                        value={img} 
                                        onChange={e => updateNewProductImage('color', e.target.value, imgIdx, colorIdx)} 
                                      />
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const newColors = [...(newProduct.colors || [])];
                                        const newImages = (newColors[colorIdx].images || []).filter((_, i) => i !== imgIdx);
                                        newColors[colorIdx] = {...newColors[colorIdx], images: newImages};
                                        setNewProduct({...newProduct, colors: newColors});
                                      }}
                                      className="p-1 text-zinc-400 hover:text-red-600"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => {
                                    const newColors = [...(newProduct.colors || [])];
                                    const newImages = [...(newColors[colorIdx].images || []), ''];
                                    newColors[colorIdx] = {...newColors[colorIdx], images: newImages};
                                    setNewProduct({...newProduct, colors: newColors});
                                  }}
                                  className="w-full py-1 border border-dashed border-zinc-300 rounded text-[8px] font-bold text-zinc-400 hover:text-zinc-600 transition-all uppercase tracking-widest"
                                >
                                  + Color Image
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={() => setNewProduct({...newProduct, colors: [...(newProduct.colors || []), { name: '', images: [] }]})}
                          className="w-full py-2 border border-dashed border-zinc-300 rounded text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-all uppercase tracking-widest bg-zinc-50"
                        >
                          + Add Color Way
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Description</label>
                      <textarea 
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] focus:border-transparent transition-all outline-none min-h-[100px] resize-none" 
                        placeholder="Describe the product features, materials, and fit..." 
                        value={newProduct.description} 
                        onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                      />
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 rounded border-zinc-300 text-[#b90014] focus:ring-[#b90014]" checked={newProduct.isNewArrival} onChange={e => setNewProduct({...newProduct, isNewArrival: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">Mark as New Arrival</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 rounded border-zinc-300 text-[#b90014] focus:ring-[#b90014]" checked={newProduct.isOnSale} onChange={e => setNewProduct({...newProduct, isOnSale: e.target.checked, salePrice: e.target.checked ? (newProduct.salePrice || 0) : 0})} />
                        <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">Mark as On Sale</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 rounded border-zinc-300 text-[#b90014] focus:ring-[#b90014]" checked={newProduct.isFeatured} onChange={e => setNewProduct({...newProduct, isFeatured: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">Featured on Home Page</span>
                      </label>
                    </div>
                    {newProduct.isOnSale && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-2"
                      >
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sale Price ($)</label>
                        <input 
                          className="w-full p-3 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none font-bold text-[#b90014]" 
                          placeholder="Discounted price..." 
                          type="number" 
                          value={newProduct.salePrice || ''} 
                          onChange={e => setNewProduct({...newProduct, salePrice: parseFloat(e.target.value)})} 
                        />
                      </motion.div>
                    )}
                    <button 
                      className={`w-full mt-4 p-4 rounded-xl font-headline font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                        addStatus === 'success' ? 'bg-green-600 text-white' : 
                        addStatus === 'error' ? 'bg-red-600 text-white' : 
                        addStatus === 'syncing' || isUploading ? 'bg-zinc-700 text-white' :
                        'bg-zinc-900 text-white hover:bg-[#b90014] shadow-zinc-900/10'
                      }`}
                      onClick={() => handleAdd()}
                      disabled={addStatus === 'syncing' || isUploading}
                    >
                      {addStatus === 'syncing' || isUploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {isUploading ? 'Uploading Image...' : 'Syncing...'}
                        </>
                      ) : addStatus === 'success' ? (
                        <>
                          <Check size={20} />
                          Product Created!
                        </>
                      ) : addStatus === 'error' ? (
                        <>
                          <X size={20} />
                          {addErrorMessage || 'Error / Missing Fields'}
                        </>
                      ) : (
                        <>
                          <Plus size={20} />
                          Create Product
                        </>
                      )}
                    </button>
                    {addStatus === 'error' && addErrorMessage && (
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest text-center mt-2 animate-pulse">
                        {addErrorMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {productSubTab === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="p-8 border-b border-zinc-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-zinc-900">Inventory Management</h2>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[9px] font-bold text-green-700 uppercase tracking-widest bg-green-50 px-2.5 py-1.5 rounded-full border border-green-100 w-fit">
                          <Zap size={11} className="fill-current" />
                          Shared Storage Active (Always Synchronized)
                        </div>
                        <p className="text-sm text-zinc-500 mt-1">
                          {isLoading ? 'Updating catalog...' : 
                           adminSearchTerm ? `Found ${filteredProducts.length} matches` : 
                           `Connected: ${products.length} live products`}
                        </p>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#b90014] transition-colors" size={14} />
                          <input 
                            type="text" 
                            placeholder="Find products..."
                            value={adminSearchTerm}
                            onChange={(e) => setAdminSearchTerm(e.target.value)}
                            className="pl-9 pr-12 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-[#b90014] transition-all w-[260px]"
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {adminSearchTerm && (
                              <button 
                                onClick={() => setAdminSearchTerm('')}
                                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            await fetchAdminProducts();
                            setSyncStatus('success');
                            setTimeout(() => setSyncStatus('idle'), 3000);
                          }}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-[#b90014] transition-all disabled:opacity-50 shadow-sm relative overflow-hidden"
                        >
                          <Plus className={`transition-transform ${isLoading ? 'animate-spin' : ''}`} size={14} style={{ rotate: isLoading ? '0deg' : '45deg' }} />
                          {isLoading ? 'Syncing...' : syncStatus === 'success' ? 'Synchronized!' : 'Sync from DB'}
                          {syncStatus === 'success' && (
                            <motion.div 
                              initial={{ y: 20 }}
                              animate={{ y: 0 }}
                              className="absolute inset-0 bg-green-600 flex items-center justify-center"
                            >
                              <Check size={14} className="mr-1" /> OK
                            </motion.div>
                          )}
                        </button>
                        <div className="relative">
                          <button 
                            onClick={() => setConfirmReset(true)}
                            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-widest"
                          >
                            Defaults
                          </button>
                          {confirmReset && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl p-4 z-50">
                              <p className="text-[10px] font-bold text-zinc-900 mb-3 text-left normal-case">Wipe your database and replace with sample data?</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={async () => {
                                    await handleReset();
                                    setConfirmReset(false);
                                  }}
                                  className="flex-1 px-2 py-1 bg-red-600 text-white text-[8px] font-black uppercase rounded tracking-widest"
                                >
                                  Yes, Reset
                                </button>
                                <button 
                                  onClick={() => setConfirmReset(false)}
                                  className="flex-1 px-2 py-1 bg-zinc-100 text-zinc-600 text-[8px] font-black uppercase rounded tracking-widest"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {confirmClear ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-red-600 uppercase">Are you sure?</span>
                              <button 
                                onClick={handleClearAll}
                                className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase"
                              >
                                Yes
                              </button>
                              <button 
                                onClick={() => setConfirmClear(false)}
                                className="px-2 py-1 bg-zinc-200 text-zinc-600 text-[10px] font-bold rounded uppercase"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmClear(true)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-widest"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Category Sub-tabs */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setProductCategoryFilter('All');
                        }}
                        className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${productCategoryFilter === 'All' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        All
                      </button>
                      {availableCategories
                        .filter(cat => !['CUSTOM KITS', 'UNIFORM SUBMISSION'].includes(cat.toUpperCase()))
                        .map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setProductCategoryFilter(cat);
                          }}
                          className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${productCategoryFilter === cat ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-100 relative">
                    {isLoading && products.length === 0 && (
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-zinc-200 border-t-[#b90014] rounded-full animate-spin mb-3" />
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Loading Catalog...</p>
                        </div>
                      </div>
                    )}
                    {filteredProducts.length === 0 && !isLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 bg-zinc-50">
                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mb-2">No matches found</p>
                        <p className="text-zinc-500 text-[10px]">Try a different search term or category.</p>
                        <button 
                          onClick={() => {
                            setAdminSearchTerm('');
                            setProductCategoryFilter('All');
                          }}
                          className="mt-6 text-[#b90014] text-[10px] font-black uppercase tracking-widest hover:underline"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      filteredProducts.slice().reverse().slice(0, displayLimit).map(product => {
                        try {
                          return (
                            <div key={product.id} className="p-6 flex items-center gap-6 hover:bg-zinc-50 transition-colors group">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                                <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-zinc-900 truncate">{product.name}</h3>
                                  {product.isNewArrival && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded tracking-widest">New</span>}
                                  {product.isOnSale && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase rounded tracking-widest">Sale</span>}
                                </div>
                                <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mb-1">
                                  {product.category} {product.submenus && product.submenus.length > 0 ? `• ${product.submenus.join(', ')}` : product.submenu && `• ${product.submenu}`} • 
                                  {product.isOnSale && product.salePrice ? (
                                    <span className="ml-1">
                                      <span className="line-through opacity-50 mr-1">${product.price}</span>
                                      <span className="text-[#b90014] font-bold">${product.salePrice}</span>
                                    </span>
                                  ) : (
                                    <span className="ml-1">${product.price}</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-zinc-400 line-clamp-1">{product.description}</p>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setEditingProduct(product)}
                                  className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all shadow-sm"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(product.id)}
                                  className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all shadow-sm"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        } catch (err) {
                          console.error("Failed to render item", product, err);
                          return (
                            <div key={product?.id || Math.random().toString()} className="p-4 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest">
                              Corrupt product record (skipped rendering detailed fields)
                            </div>
                          );
                        }
                      })
                    )}
                  </div>
                  
                  {filteredProducts.length > displayLimit && (
                    <div className="p-8 border-t border-zinc-100 bg-zinc-50 flex flex-col items-center gap-2 justify-center">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                        Showing {displayLimit} of {filteredProducts.length} Products
                      </p>
                      <button
                        onClick={() => setDisplayLimit(prev => prev + 25)}
                        className="flex items-center gap-2 px-8 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                      >
                        <RefreshCw size={14} className="animate-spin" />
                        Show More Products
                      </button>
                    </div>
                  )}
                  
                  {hasMoreProducts && productCategoryFilter === 'All' && !adminSearchTerm && filteredProducts.length <= displayLimit && (
                    <div className="p-8 border-t border-zinc-100 bg-zinc-50 flex justify-center">
                      <button
                        onClick={loadMoreAdminProducts}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-8 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-zinc-900 hover:text-white transition-all shadow-sm disabled:opacity-50"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                        ) : (
                          <>
                            <CloudDownload size={16} />
                            Load More Products (DB)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Diagnostic Section */}
                  <div className="mt-12 p-8 border-t border-zinc-100 bg-zinc-50/50 rounded-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">System Diagnostics</h3>
                            <p className="text-[10px] text-zinc-500 mt-1">Real-time status of your database and environment</p>
                        </div>
                        <div className="flex gap-2">
                            {isSupabaseConnected ? (
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100`}>
                                    <div className={`w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse`} />
                                    Internal Health: Optimizing (No Quotas)
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-amber-100">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Syncing Diagnostics...
                                </span>
                            )}
                            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-100">
                                Mode: PRODUCTION
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Environment Status</p>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">Base Config:</span>
                               <span className="font-mono text-zinc-400">{String(import.meta.env.VITE_USE_MOCK_DATA)}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">Active Mode:</span>
                               <span className={`font-mono font-black text-[#b90014]`}>
                                 LIVE
                               </span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Inventory Stats</p>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">RAM Count:</span>
                               <span className="font-mono text-zinc-900 font-bold">{products.length} items</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">Source:</span>
                               <span className="font-mono text-zinc-900 font-bold">Internal Disk</span>
                           </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Database Integrity</p>
                        <div className="space-y-2">
                           <button 
                             onClick={async () => {
                               try {
                                 const testId = `test_${Date.now()}`;
                                 await addProduct({
                                   id: testId,
                                   name: 'DIAGNOSTIC TEST PRODUCT',
                                   price: 0,
                                   category: 'Diagnostic',
                                   image: 'https://picsum.photos/200',
                                   description: 'Testing database bridge...',
                                   isNewArrival: false,
                                   isOnSale: false
                                 });
                                 alert('WRITE SUCCESS: Check list now (filter by Diagnostic)');
                               } catch (err: any) {
                                 alert(`WRITE FAILED: ${err.message}`);
                               }
                             }}
                             className="w-full py-1 bg-[#b90014] text-white text-[8px] font-black uppercase rounded tracking-widest hover:opacity-90"
                           >
                             Test Live Write
                           </button>
                           <p className="text-[7px] text-zinc-400 leading-tight">Writes a temporary "Diagnostic" product to verify your live connection.</p>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Identity Info</p>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">Role:</span>
                               <span className="font-mono text-[#b90014] font-black">ADMIN</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px]">
                               <span className="text-zinc-500 font-bold uppercase tracking-widest">Type:</span>
                               <span className="font-mono text-zinc-900 uppercase tracking-widest">{user?.isAnonymous ? 'Guest' : 'OAuth'}</span>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                         Raw Catalog Snapshot (IDs)
                         <button 
                            onClick={fetchAdminProducts}
                            className="text-[#b90014] hover:underline"
                         >
                            Re-Sync Trace
                         </button>
                      </p>
                      <div className="max-h-40 overflow-y-auto text-[9px] font-mono text-zinc-500 leading-relaxed">
                        {products.length === 0 ? (
                           <div className="py-4 text-center text-zinc-400 italic">No products currently loaded in memory.</div>
                        ) : products.map(p => (
                          <div key={p.id} className="mb-1 border-b border-zinc-50 pb-1 flex justify-between">
                            <span>ID: {p.id} | NAME: {p.name.substring(0, 30)}...</span>
                            <span className="text-zinc-300">[{p.category}]</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingProduct(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-zinc-900">Edit Product</h2>
                  <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={24} className="text-zinc-400" />
                  </button>
                </div>
                
                <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Product Name</label>
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Category</label>
                      <select 
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none appearance-none cursor-pointer" 
                        value={editingProduct.category} 
                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value, submenu: ''})}
                      >
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const menu = navigationMenus.find(m => m.label.toUpperCase() === editingProduct.category.toUpperCase());
                      if (!menu || menu.submenus.length === 0) return null;
                      
                      return (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Submenus / Columns (Multiple)</label>
                          <div className="space-y-2">
                            <div className="relative">
                              <select 
                                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none appearance-none cursor-pointer pr-10" 
                                value="" 
                                onChange={e => {
                                  if (e.target.value && !editingProduct.submenus?.includes(e.target.value)) {
                                    setEditingProduct({...editingProduct, submenus: [...(editingProduct.submenus || []), e.target.value]});
                                  }
                                }}
                              >
                                <option value="">Add Submenu...</option>
                                {menu.submenus.map(sub => (
                                  <React.Fragment key={sub.heading}>
                                    <option value={sub.heading} className="font-bold">{sub.heading} (Column Heading)</option>
                                    {sub.items.map((item, itemIdx) => (
                                      <option key={item.label + itemIdx} value={item.label}>&nbsp;&nbsp;{item.label}</option>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {editingProduct.submenus?.map(sub => (
                                <span key={sub} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase rounded border border-zinc-200">
                                  {sub}
                                  <button onClick={() => setEditingProduct({...editingProduct, submenus: editingProduct.submenus?.filter(s => s !== sub)})}>
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Price ($)</label>
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none" type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                    </div>
                    <div className="flex flex-col gap-4 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[#b90014]" checked={editingProduct.isNewArrival} onChange={e => setEditingProduct({...editingProduct, isNewArrival: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700">New Arrival</span>
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[#b90014]" checked={editingProduct.isFeatured} onChange={e => setEditingProduct({...editingProduct, isFeatured: e.target.checked})} />
                          <span className="text-sm font-medium text-zinc-700">Featured on Home Page</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[#b90014]" checked={editingProduct.isOnSale} onChange={e => setEditingProduct({...editingProduct, isOnSale: e.target.checked, salePrice: e.target.checked ? (editingProduct.salePrice || 0) : 0})} />
                          <span className="text-sm font-medium text-zinc-700">On Sale</span>
                        </label>
                        {editingProduct.isOnSale && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sale Price ($)</label>
                            <input 
                              className="w-full p-2 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none font-bold text-[#b90014]" 
                              type="number" 
                              value={editingProduct.salePrice || ''} 
                              onChange={e => setEditingProduct({...editingProduct, salePrice: parseFloat(e.target.value)})} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Product Image (1000x1250)</label>
                    <div className="flex gap-4 items-start">
                      <div className="w-24 h-24 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                        <img src={editingProduct.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                          <Upload size={14} /> Replace Image
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleProductImageUpload(e, true)} />
                        </label>
                        <input 
                          className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[#b90014] outline-none" 
                          placeholder="Or paste image URL..." 
                          value={editingProduct.image} 
                          onChange={e => updateEditingProductImage('image', e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Additional Images</label>
                    <div className="space-y-3">
                      {(editingProduct.images || []).map((img, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <div className="w-10 h-10 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                            {img ? (
                              <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                <ImageIcon size={14} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col gap-2">
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-200 transition-colors w-fit">
                              <Upload size={12} /> Upload
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAdditionalImageUpload(e, idx, true)} />
                            </label>
                            <input 
                              className="flex-1 p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[#b90014] outline-none" 
                              placeholder="Or paste image URL..." 
                              value={img} 
                              onChange={e => updateEditingProductImage('additional', e.target.value, idx)} 
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newImages = (editingProduct.images || []).filter((_, i) => i !== idx);
                              setEditingProduct({...editingProduct, images: newImages});
                            }}
                            className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setEditingProduct({...editingProduct, images: [...(editingProduct.images || []), '']})}
                        className="w-full py-2 border border-dashed border-zinc-200 rounded text-[10px] font-bold text-zinc-400 hover:text-zinc-900 transition-all uppercase tracking-widest"
                      >
                        + Add Image
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Color Ways (Optional)</label>
                    <div className="space-y-4">
                      {(editingProduct.colors || []).map((color, colorIdx) => (
                        <div key={colorIdx} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 relative group">
                          <button 
                            onClick={() => {
                              const newColors = (editingProduct.colors || []).filter((_, i) => i !== colorIdx);
                              setEditingProduct({...editingProduct, colors: newColors});
                            }}
                            className="absolute top-2 right-2 text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Name</label>
                              <input 
                                className="w-full p-2 bg-white border border-zinc-200 rounded text-xs" 
                                placeholder="e.g. Red/White" 
                                value={color.name} 
                                onChange={e => {
                                  const newColors = [...(editingProduct.colors || [])];
                                  newColors[colorIdx] = {...newColors[colorIdx], name: e.target.value};
                                  setEditingProduct({...editingProduct, colors: newColors});
                                }} 
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Price (Optional)</label>
                              <input 
                                className="w-full p-2 bg-white border border-zinc-200 rounded text-xs" 
                                placeholder="Leave empty for base price" 
                                type="number"
                                value={color.price || ''} 
                                onChange={e => {
                                  const newColors = [...(editingProduct.colors || [])];
                                  newColors[colorIdx] = {...newColors[colorIdx], price: e.target.value ? parseFloat(e.target.value) : undefined};
                                  setEditingProduct({...editingProduct, colors: newColors});
                                }} 
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Color Images</label>
                            <div className="space-y-2">
                              {(color.images || []).map((img, imgIdx) => (
                                <div key={imgIdx} className="flex gap-2 items-center">
                                  <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                                    {img ? (
                                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                        <ImageIcon size={12} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 flex gap-2">
                                    <label className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-zinc-200 text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-50 transition-colors w-fit">
                                      <Upload size={10} />
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleColorImageUpload(e, colorIdx, imgIdx, true)} />
                                    </label>
                                    <input 
                                      className="flex-1 p-1 bg-white border border-zinc-200 rounded text-[9px]" 
                                      placeholder="URL" 
                                      value={img} 
                                      onChange={e => updateEditingProductImage('color', e.target.value, imgIdx, colorIdx)} 
                                    />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const newColors = [...(editingProduct.colors || [])];
                                      const newImages = (newColors[colorIdx].images || []).filter((_, i) => i !== imgIdx);
                                      newColors[colorIdx] = {...newColors[colorIdx], images: newImages};
                                      setEditingProduct({...editingProduct, colors: newColors});
                                    }}
                                    className="p-1 text-zinc-400 hover:text-red-600"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              <button 
                                onClick={() => {
                                  const newColors = [...(editingProduct.colors || [])];
                                  const newImages = [...(newColors[colorIdx].images || []), ''];
                                  newColors[colorIdx] = {...newColors[colorIdx], images: newImages};
                                  setEditingProduct({...editingProduct, colors: newColors});
                                }}
                                className="w-full py-1 border border-dashed border-zinc-300 rounded text-[8px] font-bold text-zinc-400 hover:text-zinc-600 transition-all uppercase tracking-widest"
                              >
                                + Color Image
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => setEditingProduct({...editingProduct, colors: [...(editingProduct.colors || []), { name: '', images: [] }]})}
                        className="w-full py-2 border border-dashed border-zinc-300 rounded text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-all uppercase tracking-widest bg-zinc-50"
                      >
                        + Add Color Way
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Description</label>
                    <textarea 
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[#b90014] outline-none min-h-[120px] resize-none" 
                      value={editingProduct.description} 
                      onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 flex items-center justify-end gap-4">
                  <button 
                    onClick={() => setEditingProduct(null)}
                    className="px-6 py-3 text-zinc-500 font-bold uppercase tracking-widest text-xs hover:text-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (editingProduct) {
                        await handleUpdate();
                      }
                    }}
                    disabled={isUploading}
                    className={`px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#b90014] transition-all shadow-lg shadow-zinc-900/10 flex items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

