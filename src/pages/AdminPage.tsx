import React, { useState, ChangeEvent, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useProducts, Product } from '../context/ProductContext';
import { useSettings, NavMenu, SEO, ThemeSettings, BrandImages, forceManualNavigationMigration } from '../context/SettingsContext';
import { DEFAULT_NAV } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import { Trash2, Edit2, Plus, Upload, LayoutDashboard, Package, Image as ImageIcon, Save, Check, X, ArrowLeft, Menu, ChevronDown, ChevronUp, ChevronRight, LogOut, FileText, AlertCircle, Globe, Search, AlertTriangle, Download, Zap, CloudDownload, RefreshCw, CreditCard, BarChart3, ScanLine, GripVertical, Palette } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { resizeImage } from '../lib/imageUtils';
import { uploadImage, supabase } from '../supabase';
import { RapidScanIntakeMatrix } from '../components/RapidScanIntakeMatrix';
import { GiftCardsAdmin } from '../components/GiftCardsAdmin';
import { ReportsPage } from '../components/ReportsPage';

type Tab = 'slider' | 'products' | 'home-layout' | 'navigation' | 'footer' | 'seo' | 'gift-cards' | 'reports' | 'theme';

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
  if (name === 'Kit Orders') return '/kit-orders';
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
              className="w-full py-3 bg-[var(--primary-color)] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-zinc-900 transition-all shadow-lg"
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

interface SortableSlideCardProps {
  id: string;
  img: any;
  index: number;
  onDelete: (index: number) => void;
  onUpdate: (index: number, field: 'title' | 'link' | 'url', value: string) => void;
}

function SortableSlideCard({ id, img, index, onDelete, onUpdate }: SortableSlideCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-sm flex flex-col">
      <div className="relative aspect-video">
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-30 bg-black/60 text-white p-1.5 rounded cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>
        <img src={img.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={() => onDelete(index)}
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
            onChange={(e) => onUpdate(index, 'title', e.target.value)}
            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
            placeholder="e.g. New Season Arrivals"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Click Link (URL)</label>
          <input
            type="text"
            value={img.link || ''}
            onChange={(e) => onUpdate(index, 'link', e.target.value)}
            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
            placeholder="e.g. /footwear"
          />
        </div>
      </div>
    </div>
  );
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
    products, addProduct, deleteProduct, updateProduct, resetProducts, markAllProductsOnline,
    fetchAdminProducts, loadMoreAdminProducts, hasMoreProducts, isLoading, fetchProductById
  } = useProducts();
  const { sliderImages: contextSliderImages, setSliderImages: setContextSliderImages, logo, setLogo, landingLogo, setLandingLogo, labBackgroundImage, setLabBackgroundImage, footerLogo, setFooterLogo, homeCategories, setHomeCategories, navigationMenus, updateNavigationItem, saveNavigation, footerLinks, setFooterLinks, seoSettings, setSeoSettings, storeInfo, setStoreInfo, setGlobalSettings, resetSettings, showSizesOnline, setShowSizesOnline, themeSettings, setThemeSettings, brandImages, setBrandImages, categoryImages, setCategoryImages } = useSettings();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Barcode pre-fill when navigating here from POS "Create New Product"
  const [fromPOSData, setFromPOSData] = useState<{ barcode: string; brand: string; price: number; name: string } | null>(null);

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

  // If navigated here from POS "Create New Product", auto-open add form pre-filled
  useEffect(() => {
    const state = location.state as any;
    if (state?.openAddProduct && state?.pendingBarcode) {
      const pb = state.pendingBarcode;
      setFromPOSData(pb);
      setActiveTab('products');
      setProductSubTab('add');
      setNewProduct(prev => ({
        ...prev,
        name: pb.name || '',
        brand: pb.brand || '',
        price: pb.price || 0,
        image: '/logo.svg',
        showSizes: true,
      }));
      setNewProductVariantBarcode(pb.barcode || '');
      // Clear the navigation state so a refresh doesn't re-trigger
      window.history.replaceState({}, '', '/admin');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove preview font link tag when admin page unmounts
  useEffect(() => {
    return () => {
      const previewLink = document.getElementById('google-fonts-preview');
      if (previewLink) previewLink.remove();
    };
  }, []);

  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    name: '',
    price: 0,
    category: 'Uncategorized',
    brand: '',
    product_code: '',
    submenu: '',
    submenus: [],
    image: '',
    images: [],
    description: '',
    isNewArrival: true,
    showSizes: false,
    isOnSale: false,
    isFeatured: true,
    is_online: true,
    salePrice: 0,
    colors: [],
    release_date: null
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
  // On Vercel, Supabase is always the database (no /api/health check needed)
  const isSupabaseConnected = true;

  useEffect(() => {
    fetchAdminProducts();

    // Fetch all product variants at once and build stock map
    const fetchAllStock = async () => {
      try {
        const allVariants: { product_id: string; stock_quantity: number }[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('product_variants')
            .select('product_id, stock_quantity')
            .range(from, from + batchSize - 1);
          if (error || !data) break;
          allVariants.push(...data);
          if (data.length < batchSize) break;
          from += batchSize;
        }
        const stockMap = new Map<string, number>();
        allVariants.forEach(v => {
          const currentStock = stockMap.get(v.product_id) || 0;
          stockMap.set(v.product_id, currentStock + (v.stock_quantity || 0));
        });
        setProductStockCache(stockMap);
      } catch (err) {
        console.error('Error fetching stock:', err);
      }
    };
    fetchAllStock();

    // Fetch available brands
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('brand')
          .not('brand', 'is', null);
        if (!error && data) {
          const uniqueBrands = Array.from(new Set(data.map(p => p.brand).filter(Boolean)))
            .sort() as string[];
          setAvailableBrands(uniqueBrands);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    };
    fetchBrands();
  }, []);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [sliderImages, setSliderImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSyncingBucket, setIsSyncingBucket] = useState(false);
  const [draftLogo, setDraftLogo] = useState<string>(logo || '');
  const [draftLandingLogo, setDraftLandingLogo] = useState<string>(landingLogo || '');
  const [draftLabBackgroundImage, setDraftLabBackgroundImage] = useState<string>(labBackgroundImage || '');
  const [draftFooterLogo, setDraftFooterLogo] = useState<string>(footerLogo || '');
  const [draftShowSizesOnline, setDraftShowSizesOnline] = useState<boolean>(showSizesOnline);
  const [draftHomeCategories, setDraftHomeCategories] = useState<any[]>(homeCategories || []);
  const [draftFooterLinks, setDraftFooterLinks] = useState<any[]>(footerLinks || []);
  const [draftNavigationMenus, setDraftNavigationMenus] = useState<any[]>(navigationMenus || []);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [expandedSubmenus, setExpandedSubmenus] = useState<string[]>([]);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [draftSeoSettings, setDraftSeoSettings] = useState<any>(seoSettings || {});
  const DEFAULT_STORE_INFO = {
    name: 'Absolute Soccer',
    address: '5600 Rose Cherry Place, Mississauga, Ontario',
    phone: '905-593-3600',
    email: 'info@absolutesoccer.ca',
    hours: {
      monday: '10:00 AM - 6:00 PM',
      tuesday: '10:00 AM - 6:00 PM',
      wednesday: '10:00 AM - 6:00 PM',
      thursday: '10:00 AM - 6:00 PM',
      friday: '10:00 AM - 6:00 PM',
      saturday: '10:00 AM - 5:00 PM',
      sunday: 'Closed',
    }
  };
  const [draftStoreInfo, setDraftStoreInfo] = useState<any>(DEFAULT_STORE_INFO);
  const [isSavingStoreInfo, setIsSavingStoreInfo] = useState(false);
  const [storeInfoSaveSuccess, setStoreInfoSaveSuccess] = useState(false);
  const DEFAULT_THEME_DRAFT: ThemeSettings = { storeName: 'Absolute Soccer Mississauga', primaryColor: '#b90014', secondaryColor: '#000000', fontFamily: 'default' };
  const [draftTheme, setDraftTheme] = useState<ThemeSettings>(themeSettings || DEFAULT_THEME_DRAFT);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSaveSuccess, setThemeSaveSuccess] = useState(false);

  const [draftBrandImages, setDraftBrandImages] = useState<BrandImages>({});
  const [isSavingBrandImages, setIsSavingBrandImages] = useState(false);
  const [brandImagesSaveSuccess, setBrandImagesSaveSuccess] = useState(false);

  const [draftCategoryImages, setDraftCategoryImages] = useState<Record<string, string>>({});
  const [isSavingCategoryImages, setIsSavingCategoryImages] = useState(false);
  const [categoryImagesSaveSuccess, setCategoryImagesSaveSuccess] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<'idle' | 'success' | 'error' | 'syncing'>('idle');
  const [addErrorMessage, setAddErrorMessage] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'idle' | 'success' | 'error' | 'saving'>('idle');
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<string | false>(false);
  const [productSubTab, setProductSubTab] = useState<'list' | 'add' | 'bulk'>('list');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmMarkAllOnline, setConfirmMarkAllOnline] = useState(false);
  const [isMarkingAllOnline, setIsMarkingAllOnline] = useState(false);
  const [markAllOnlineStatus, setMarkAllOnlineStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [localSyncStatus, setLocalSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);
  const [localRestoreStatus, setLocalRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [pullStatus, setPullStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [brandInputOpen, setBrandInputOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkBrandAssignBrand, setBulkBrandAssignBrand] = useState<string>('');
  const [isBulkBrandAssigning, setIsBulkBrandAssigning] = useState(false);
  const [bulkBrandStatus, setBulkBrandStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [productStockCache, setProductStockCache] = useState<Map<string, number>>(new Map());

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

  const [adminCurrentPage, setAdminCurrentPage] = useState<number>(1);
  const adminItemsPerPage = 20;

  useEffect(() => {
    setAdminCurrentPage(1);
  }, [adminSearchTerm, productCategoryFilter]);

  const paginatedProducts = useMemo(() => {
    const reversed = filteredProducts.slice().reverse();
    const startIndex = (adminCurrentPage - 1) * adminItemsPerPage;
    return reversed.slice(startIndex, startIndex + adminItemsPerPage);
  }, [filteredProducts, adminCurrentPage, adminItemsPerPage]);

  const [bulkUploadStatus, setBulkUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // --- Sizing Variant States & Handlers ---
  const [editingProductVariants, setEditingProductVariants] = useState<any[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [newVariantAgeGroup, setNewVariantAgeGroup] = useState<'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size'>('Adult');
  const [newVariantSize, setNewVariantSize] = useState<string>('');
  const [newVariantBarcode, setNewVariantBarcode] = useState<string>('');
  const newVariantBarcodeRef = useRef<HTMLInputElement>(null);
  const [newVariantQuantity, setNewVariantQuantity] = useState<number>(30);
  const [editingProductHasNoSizes, setEditingProductHasNoSizes] = useState<boolean>(false);

  // --- States for newly created product pending size variants ---
  const [createdProductVariants, setCreatedProductVariants] = useState<any[]>([]);
  const [newProductVariantAgeGroup, setNewProductVariantAgeGroup] = useState<'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size'>('Adult');
  const [newProductVariantSize, setNewProductVariantSize] = useState<string>('');
  const [newProductVariantBarcode, setNewProductVariantBarcode] = useState<string>('');
  const [newProductVariantQuantity, setNewProductVariantQuantity] = useState<number>(30);
  const [newProductHasNoSizes, setNewProductHasNoSizes] = useState<boolean>(false);

  const getTempBarcode = (name: string, ageGroup: string, sizeName: string) => {
    const cleanName = (name || 'PROD').slice(0, 5).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanAge = (ageGroup || 'A')[0].toUpperCase();
    const cleanSize = (sizeName || 'M').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `${cleanName}-${cleanAge}-${cleanSize}-${randomSuffix}`;
  };

  const handleAddCreatedProductVariant = () => {
    if (!newProductHasNoSizes && !newProductVariantSize.trim()) {
      alert("Please specify a sizing label (e.g. Medium, Size 5) or check 'No Sizes'.");
      return;
    }
    const sizeLabel = newProductHasNoSizes ? 'One Size' : newProductVariantSize;
    const barcode = newProductVariantBarcode.trim() || getTempBarcode(newProduct.name, newProductVariantAgeGroup, sizeLabel);

    if (createdProductVariants.some(v => v.barcode === barcode.toUpperCase())) {
      alert("This barcode is already assigned to another variant in this list.");
      return;
    }

    const payload = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      age_group: newProductVariantAgeGroup,
      size: newProductHasNoSizes ? null : newProductVariantSize,
      barcode: barcode.toUpperCase(),
      stock_quantity: newProductVariantQuantity
    };

    setCreatedProductVariants([...createdProductVariants, payload]);
    setNewProductVariantSize('');
    setNewProductVariantBarcode('');
  };

  const handleDeleteCreatedProductVariant = (tempId: string) => {
    setCreatedProductVariants(createdProductVariants.filter(v => v.id !== tempId));
  };

  useEffect(() => {
    let active = true;
    if (editingProduct && editingProduct.id) {
      setVariantsLoading(true);
      setEditingProductHasNoSizes(false);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', editingProduct.id)
            .order('age_group');

          if (active) {
            if (!error && data) {
              setEditingProductVariants(data);
              // Auto-detect if product has no sizes
              const hasOnlyNullSizes = data.length > 0 && data.every(v => v.size === null);
              setEditingProductHasNoSizes(hasOnlyNullSizes);
            } else {
              console.error("Error loading variants:", error);
              setEditingProductVariants([]);
            }
          }
        } catch (err) {
          console.error("Error loading variants:", err);
          if(active) setEditingProductVariants([]);
        } finally {
          if (active) setVariantsLoading(false);
        }
      })();
    } else {
      setEditingProductVariants([]);
      setEditingProductHasNoSizes(false);
    }
    return () => { active = false; };
  }, [editingProduct?.id]);

  const handleAddVariant = async () => {
    if (!editingProduct?.id) return;
    if (!editingProductHasNoSizes && !newVariantSize.trim()) {
      alert("Please enter a size or check 'No Sizes'.");
      return;
    }
    const sizeLabel = editingProductHasNoSizes ? 'One Size' : newVariantSize;
    const barcodeValue = newVariantBarcode.trim() ||
      `${editingProduct.id.slice(0,8)}-${newVariantAgeGroup.slice(0,1)}-${sizeLabel.replace('.','_')}-${Date.now()}`.toUpperCase();

    const colorMatch = newVariantBarcode.includes(' - ') ? newVariantBarcode.split(' - ')[0] : null;

    try {
      // Check if barcode already exists for a DIFFERENT product
      const { data: existing } = await supabase
        .from('product_variants')
        .select('id, product_id, size')
        .eq('barcode', barcodeValue)
        .maybeSingle();

      if (existing && existing.product_id !== editingProduct.id) {
        alert(`Barcode "${barcodeValue}" is already assigned to a different product (Size: ${existing.size}). Please use a unique barcode.`);
        return;
      }

      const { error } = await supabase
        .from('product_variants')
        .upsert([{
          product_id: editingProduct.id,
          age_group: newVariantAgeGroup,
          size: editingProductHasNoSizes ? null : newVariantSize.trim(),
          color: colorMatch,
          barcode: barcodeValue,
          stock_quantity: newVariantQuantity
        }], { onConflict: 'barcode' });
      if (error) throw error;
      const { data: fresh } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', editingProduct.id)
        .order('age_group');
      setEditingProductVariants(fresh || []);
      setNewVariantSize('');
      setNewVariantBarcode('');
      setNewVariantQuantity(0);
      alert('Variant saved!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);
      
      if (error) throw error;
      
      setEditingProductVariants(prev => prev.filter(v => v.id !== variantId));
    } catch (err: any) {
      console.error(err);
      alert('Error deleting variant: ' + err.message);
    }
  };

  const getSuggestedSizes = (category: string = '', productName: string = '', ageGroup: 'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size') => {
    if (ageGroup === 'Balls') {
      return ['Size 1', 'Size 2', 'Size 3', 'Size 4', 'Size 5'];
    }

    if (ageGroup === 'Gloves') {
      return ['3', '4', '5', '6', '7', '8', '9', '10', '11'];
    }

    if (ageGroup === 'One Size') {
      return ['One Size'];
    }

    if (ageGroup === 'Adult Footwear') {
      const sizes = [];
      for (let s = 3; s <= 13; s += 0.5) {
        sizes.push(s % 1 === 0 ? s.toString() : s.toFixed(1));
      }
      return sizes;
    }

    if (ageGroup === 'Youth Footwear') {
      const sizes = [];
      for (let s = 1; s <= 6; s += 0.5) {
        sizes.push(s % 1 === 0 ? `${s}Y` : `${s.toFixed(1)}Y`);
      }
      return sizes;
    }

    const cat = category.toLowerCase();
    const isShoes = cat.includes('shoe') || cat.includes('footwear') || cat.includes('cleats');

    if (isShoes) {
      if (ageGroup === 'Toddler') {
        const toddlerShoeSizes = [];
        for (let s = 4; s <= 13; s += 0.5) {
          toddlerShoeSizes.push(`${s}C`);
        }
        return toddlerShoeSizes;
      }
      if (ageGroup === 'Youth') {
        const youthShoeSizes = [];
        for (let s = 1; s <= 7; s += 0.5) {
          youthShoeSizes.push(`${s}Y`);
        }
        return youthShoeSizes;
      }
      const adultShoeSizes = [];
      for (let s = 4; s <= 15; s += 0.5) {
        adultShoeSizes.push(s.toString());
      }
      return adultShoeSizes;
    }

    if (ageGroup === 'Toddler') {
      return ['12M', '18M', '24M', '2T', '3T', '4T'];
    }
    if (ageGroup === 'Youth') {
      return ['YXXS', 'YXS', 'YS', 'YM', 'YL', 'YXL'];
    }
    return ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  };

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
    setDraftShowSizesOnline(showSizesOnline);
  }, [showSizesOnline]);

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
    if (themeSettings) setDraftTheme(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    if (brandImages && Object.keys(brandImages).length > 0) setDraftBrandImages(brandImages);
  }, [brandImages]);

  useEffect(() => {
    if (categoryImages && Object.keys(categoryImages).length > 0) setDraftCategoryImages(categoryImages);
  }, [categoryImages]);

  useEffect(() => {
    const fetchStoreInfo = async () => {
      const { data } = await supabase
        .from('settings')
        .select('data')
        .eq('key', 'store_info')
        .single();
      if (data?.data) {
        setDraftStoreInfo((prev: any) => ({
          ...DEFAULT_STORE_INFO,
          ...data.data,
          hours: { ...DEFAULT_STORE_INFO.hours, ...(data.data.hours || {}) }
        }));
      }
    };
    fetchStoreInfo();
  }, []);

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
      const imageFields = [
        newProduct.image,
        ...(newProduct.images || []),
        ...(newProduct.colors?.flatMap(c => c.images || []) || [])
      ];
      if (imageFields.some(f => f && f.startsWith('data:'))) {
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
      const savedProd = await addProduct(productData);
      
      // Sync size variants if specified
      if (savedProd && savedProd.id && createdProductVariants.length > 0) {
        for (const localVar of createdProductVariants) {
          try {
            await supabase
              .from('product_variants')
              .upsert([{
                product_id: savedProd.id,
                age_group: localVar.age_group,
                size: localVar.size,
                barcode: localVar.barcode,
                stock_quantity: localVar.stock_quantity,
                color: localVar.color || null
              }], { onConflict: 'barcode' });
          } catch (vErr) {
            console.error("Failed to record variant for new product:", vErr);
          }
        }
      }
      
      setCreatedProductVariants([]);
      setAddStatus('success');
      setNewProduct({
        name: '',
        price: 0,
        description: '',
        category: availableCategories[0] || 'Uncategorized',
        brand: '',
        product_code: '',
        submenu: '',
        submenus: [],
        image: '',
        isNewArrival: true,
        showSizes: false,
        isOnSale: false,
        isFeatured: true,
        is_online: true,
        salePrice: 0,
        colors: [],
        release_date: null
      });

      // If came from POS, remove barcode from pending list and return
      if (fromPOSData) {
        try {
          const stored = JSON.parse(localStorage.getItem('pending_barcodes') || '[]');
          const updated = stored.filter((p: any) => p.barcode !== fromPOSData.barcode);
          localStorage.setItem('pending_barcodes', JSON.stringify(updated));
        } catch {}
        setFromPOSData(null);
        setTimeout(() => navigate('/pos'), 1200);
      }

      setTimeout(() => setAddStatus('idle'), 3000);
      await resetProducts();
    } catch (error: any) {
      console.error('AdminPage: Failed to add product', error);
      // Handle duplicate product error
      if (error.isDuplicate) {
        setAddErrorMessage(error.message);
      } else {
        setAddErrorMessage(error.message || 'Failed to save to database.');
      }
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 5000);
    }
  };

  const handleUpdate = async () => {
    if (editingProduct) {
      setEditErrorMessage(null);
      setEditStatus('saving');

      if (!editingProduct.name) {
        setEditErrorMessage('Product Name is required.');
        setEditStatus('error');
        return;
      }
      
      const priceNum = typeof editingProduct.price === 'string' ? parseFloat(editingProduct.price) : editingProduct.price;
      if (typeof priceNum !== 'number' || isNaN(priceNum) || priceNum <= 0) {
        setEditErrorMessage('Product Price must be a valid number greater than 0.');
        setEditStatus('error');
        return;
      }

      try {
        const isNewBase64Image = (str: string | undefined) => {
          if (!str || !str.startsWith('data:')) return false;
          if (originalProduct) {
            if (originalProduct.image === str) return false;
            if (originalProduct.images?.includes(str)) return false;
            const originalColorImages = originalProduct.colors?.flatMap(c => c.images || []) || [];
            if (originalColorImages.includes(str)) return false;
          }
          return true;
        };

        // Ensure no new base64 in editingProduct if we are currently uploading
        const imageFields = [
          editingProduct.image,
          ...(editingProduct.images || []),
          ...(editingProduct.colors?.flatMap(c => c.images || []) || [])
        ].filter(f => f !== null && f !== undefined && typeof f === 'string');
        if (imageFields.some(f => isNewBase64Image(f))) {
          setEditErrorMessage('Image upload in progress. Please wait.');
          setEditStatus('error');
          return;
        }

        const allImages = [editingProduct.image, ...(editingProduct.images || [])]
          .filter(i => i !== null && i !== undefined && typeof i === 'string' && i !== '');

        // Upload any base64 images to Supabase Storage first
        setIsUploading(true);
        const uploadedImages = await Promise.all(allImages.map(async (img) => {
          if (img && img.startsWith('data:')) {
            try {
              const resized = await resizeImage(img, 1000, 1250, 0.8);
              const path = `products/${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              return await uploadImage(resized, path);
            } catch (err) {
              console.error("Image upload failed:", err);
              return img;
            }
          }
          return img;
        }));
        setIsUploading(false);

        const productData = { 
          ...editingProduct,
          price: priceNum,
          image: uploadedImages[0] || editingProduct.image || '',
          images: uploadedImages.slice(1)
        };
        if (!productData.isOnSale) {
          delete productData.salePrice;
        } else if (productData.salePrice !== undefined) {
          const sPriceNum = typeof productData.salePrice === 'string' ? parseFloat(productData.salePrice) : productData.salePrice;
          productData.salePrice = isNaN(sPriceNum) ? 0 : sPriceNum;
        }


        const result = await updateProduct(productData);

        await resetProducts();

        // Force fetch the product from Supabase to confirm it was saved
        const refreshedProduct = await fetchProductById(productData.id);

        if (!refreshedProduct) {
          throw new Error('Product not found in database after update');
        }

        setEditStatus('success');
        setTimeout(() => {
          setEditingProduct(null);
          setOriginalProduct(null);
          setEditStatus('idle');
          setEditErrorMessage(null);
        }, 1200);
      } catch (error: any) {
        console.error('AdminPage: Failed to update product', error);
        setEditStatus('error');
        if (error.isDuplicate) {
          setEditErrorMessage(error.message);
        } else if (error.message?.includes('RLS') || error.message?.toLowerCase().includes('row-level security')) {
          setEditErrorMessage('RLS policy error: Check Supabase RLS settings to allow product updates');
        } else {
          setEditErrorMessage('Failed to update product: ' + (error.message || error));
        }
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
    } catch (error: any) {
      console.error('AdminPage: Failed to delete product', error);
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

  const handleBulkBrandAssign = async () => {
    if (selectedProductIds.size === 0 || !bulkBrandAssignBrand.trim()) {
      alert('Please select products and choose a brand');
      return;
    }

    setIsBulkBrandAssigning(true);
    setBulkBrandStatus('idle');

    try {
      const ids = Array.from(selectedProductIds);
      const { error } = await supabase
        .from('products')
        .update({ brand: bulkBrandAssignBrand })
        .in('id', ids);

      if (error) throw error;

      // Refresh products
      await resetProducts();
      setSelectedProductIds(new Set());
      setBulkBrandAssignBrand('');
      setBulkBrandStatus('success');
      setTimeout(() => setBulkBrandStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Bulk brand assignment failed:', error);
      setBulkBrandStatus('error');
      setTimeout(() => setBulkBrandStatus('idle'), 5000);
    } finally {
      setIsBulkBrandAssigning(false);
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

  const syncBucketFromSlider = async () => {
    setIsSyncingBucket(true);
    try {
      let allBucketFiles: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: bucketFiles, error: bucketError } = await supabase.storage.from('media').list('slider', {
          limit: 100,
          offset: offset
        });
        if (bucketError) throw bucketError;
        
        if (bucketFiles && bucketFiles.length > 0) {
          allBucketFiles.push(...bucketFiles);
          offset += 100;
        } else {
          hasMore = false;
        }
      }
      
      const validFiles = allBucketFiles.filter(file => file.name && !file.name.startsWith('.') && file.name !== '.emptyFolderPlaceholder');
      
      const validFileNamesFromDb = sliderImages.map(img => {
          try {
              const urlParts = new URL(img.url);
              return urlParts.pathname.split('/').pop()?.split('?')[0];
          } catch(e) {
              return null;
          }
      }).filter(Boolean);
      
      
      const filesToDelete = validFiles.filter(file => !validFileNamesFromDb.includes(file.name));

      if (filesToDelete.length === 0) {
        alert("Bucket is already in sync with database (no redundant files found).");
        return;
      }
      
      const pathsToDelete = filesToDelete.map(file => `slider/${file.name}`);
      const { error: removeError } = await supabase.storage.from('media').remove(pathsToDelete);
      if (removeError) throw removeError;
      
      alert(`Successfully removed ${filesToDelete.length} redundant files from bucket.`);
    } catch (err: any) {
        console.error("Bucket synchronization failed:", err);
        alert("Bucket synchronization failed: " + (err.message || err));
    } finally {
        setIsSyncingBucket(false);
    }
  };

  // Disabled auto-sync of slider to allow deletions of images. Database is the absolute single source of truth.
  // Manual sync can be triggered from the "Sync Slider with Bucket" panel or Button by the admin.

  const handleSliderDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sliderImages.findIndex((img: any) => img.url === active.id);
    const newIndex = sliderImages.findIndex((img: any) => img.url === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sliderImages, oldIndex, newIndex);
    setSliderImages(reordered);
    try {
      await setContextSliderImages(reordered);
    } catch (err) {
      console.error('Failed to save slider order:', err);
      setSliderImages(sliderImages);
    }
  };

  const handleDeleteSlide = async (targetIndex: number) => {
    
    const imageToDelete = sliderImages[targetIndex];
    if (!imageToDelete) {
      return;
    }
    
    // 1. Remove the URL from local state (immediate UI response)
    const finalArray = (sliderImages || []).filter((_, index) => index !== targetIndex);
    setSliderImages(finalArray);
    
    // 2. Remove the URL from DB (via SettingsContext)
    try {
      await setContextSliderImages(finalArray);
    } catch (error) {
      console.error("Failed to update database slider settings:", error);
      alert("Failed to update database.");
      setSliderImages(sliderImages); // Revert local state
      return;
    }
    
    // 3. Remove from storage
    if (imageToDelete.url) {
      try {
        let path = '';
        if (imageToDelete.url.includes('/slider/')) {
           path = 'slider/' + imageToDelete.url.split('/slider/')[1];
        } else {
             const urlParts = new URL(imageToDelete.url);
             const fileName = urlParts.pathname.split('/').pop();
             path = `slider/${fileName}`;
        }
        
        
        const { error } = await supabase.storage.from('media').remove([path]);
        if (error) {
          console.error("Failed to remove slide from storage:", error);
        } else {
        }
      } catch (err) {
        console.error("Storage removal error:", err);
      }
    }
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

  const handleBrandImageUpload = (brandName: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const resized = await resizeImage(reader.result as string, 1200, 800, 0.85);
        const safeName = brandName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const path = `brand_images/${safeName}_${Date.now()}.jpg`;
        const publicUrl = await uploadImage(resized, path);
        setDraftBrandImages(prev => ({ ...prev, [brandName]: { ...prev[brandName], image: publicUrl } }));
      } catch (err) {
        console.error('Brand image upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBrandTitleChange = (brandName: string, title: string) => {
    setDraftBrandImages(prev => ({ ...prev, [brandName]: { ...prev[brandName], title } }));
  };

  const handleSaveBrandImages = async () => {
    setIsSavingBrandImages(true);
    try {
      await setBrandImages(draftBrandImages);
      setBrandImagesSaveSuccess(true);
      setTimeout(() => setBrandImagesSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save brand images.');
    } finally {
      setIsSavingBrandImages(false);
    }
  };

  const handleCategoryTileImageUpload = (categoryKey: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const resized = await resizeImage(reader.result as string, 800, 800, 0.85);
        const path = `category_images/${categoryKey}_${Date.now()}.jpg`;
        const publicUrl = await uploadImage(resized, path);
        setDraftCategoryImages(prev => ({ ...prev, [categoryKey]: publicUrl }));
      } catch (err) {
        console.error('Category image upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveCategoryImages = async () => {
    setIsSavingCategoryImages(true);
    try {
      await setCategoryImages(draftCategoryImages);
      setCategoryImagesSaveSuccess(true);
      setTimeout(() => setCategoryImagesSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save category images.');
    } finally {
      setIsSavingCategoryImages(false);
    }
  };

  const containsBase64 = (obj: any): boolean => {
    try {
      const str = JSON.stringify(obj);
      return str ? str.includes('data:image') : false;
    } catch {
      return false;
    }
  };

  const sanitizeNavMenus = async (menus: NavMenu[]): Promise<NavMenu[]> => {
    const sanitized = await Promise.all(menus.map(async (menu) => {
      const sanitizedSubmenus = await Promise.all(menu.submenus.map(async (submenu) => {
        let sanitizedLogo = submenu.logo;
        if (sanitizedLogo?.startsWith('data:')) {
          const resized = await resizeImage(sanitizedLogo, 200, 200, 0.8);
          const path = `nav/submenu_${Date.now()}_sanitized`;
          sanitizedLogo = await uploadImage(resized, path);
        }

        const sanitizedItems = await Promise.all(submenu.items.map(async (item) => {
          let itemLogo = item.logo;
          if (itemLogo?.startsWith('data:')) {
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
        footerLogo: draftFooterLogo,
        show_sizes_online: draftShowSizesOnline
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

  const handleSaveStoreInfo = async () => {
    setIsSavingStoreInfo(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'store_info', data: draftStoreInfo });
      if (error) throw error;
      setStoreInfoSaveSuccess(true);
      setTimeout(() => setStoreInfoSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save store info', error);
      setSaveErrorMessage(error.message || 'Failed to save store information.');
    } finally {
      setIsSavingStoreInfo(false);
    }
  };

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      // Always force fontFamily to 'default' — font feature is disabled
      await setThemeSettings({ ...draftTheme, fontFamily: 'default' });
      setThemeSaveSuccess(true);
      setTimeout(() => setThemeSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('AdminPage: Failed to save theme settings', error);
      alert(error.message || 'Failed to save theme settings.');
    } finally {
      setIsSavingTheme(false);
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
      // Check if this is the original product's loaded asset string
      let isOriginalValue = false;
      if (originalProduct) {
        if (field === 'image' && originalProduct.image === value) {
          isOriginalValue = true;
        } else if (field === 'additional' && index !== undefined && originalProduct.images?.[index] === value) {
          isOriginalValue = true;
        } else if (field === 'color' && colorIndex !== undefined && index !== undefined && originalProduct.colors?.[colorIndex]?.images?.[index] === value) {
          isOriginalValue = true;
        }
      }

      if (!isOriginalValue) {
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

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const toggleSubmenu = (key: string) => {
    setExpandedSubmenus(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
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
        const publicUrl = await uploadImage(file, path);
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
        const publicUrl = await uploadImage(file, path);
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
              const path = `nav/auto-fix_${Date.now()}_sub_${i}_${j}`;
              sub.logo = await uploadImage(sub.logo, path);
              fixCount++;
            }
            if (sub.items) {
              for (let k = 0; k < sub.items.length; k++) {
                const item = sub.items[k];
                if (item.logo && item.logo.startsWith('data:image')) {
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

  // Sanitize editing product images to prevent undefined crashes
  if (editingProduct) {
    if (editingProduct.image === undefined) editingProduct.image = '';
    if (editingProduct.images) {
      editingProduct.images = editingProduct.images.filter((i: any) => i !== null && i !== undefined).map((i: any) => String(i));
    }
  }

  // Stock Badge Component - Instant lookup from pre-loaded cache
  const StockBadge = ({ productId, productStockCache }: any) => {
    const stock = productStockCache.get(productId) || 0;

    // Don't show anything if no stock info available yet
    if (stock === undefined) return null;

    const isLowStock = stock <= 3;
    return (
      <p className={`text-[9px] font-bold mt-0.5 uppercase tracking-wider ${
        isLowStock
          ? 'text-red-600'
          : stock <= 10
          ? 'text-amber-600'
          : 'text-green-600'
      }`}>
        {stock} in stock
      </p>
    );
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
                      throw new Error(`Server returned ${resp.status}: ${(text || '').substring(0, 100)}...`);
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
              Standardize Database & Assets
            </button>
          </div>
          <button onClick={(e) => { e.preventDefault(); forceManualNavigationMigration(); }} className="px-4 py-2 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest rounded hover:bg-blue-700 transition-colors">
            Force Manual Database Migration
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
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-red-50 hover:text-[var(--primary-color)] transition-all"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-headline font-black uppercase tracking-tighter italic text-zinc-900">
              Admin <span className="text-[var(--primary-color)]">Control Center</span>
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
                  onClick={async () => {
                    if (window.confirm('Reset all settings (slider, logos, menus) to defaults?')) {
                      await resetSettings();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-200 transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  <LayoutDashboard size={14} /> Restore Default Settings
                </button>
                <button
                  onClick={() => window.open('/pos', '_blank', 'width=1024,height=768')}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all bg-[var(--primary-color)] text-white hover:bg-red-800 shadow-md"
                >
                  <CreditCard size={16} /> POS (New Tab)
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl shadow-sm border border-zinc-200">
            <button
              onClick={() => setActiveTab('slider')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'slider' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <ImageIcon size={14} /> Slider
            </button>
            <button
              onClick={() => setActiveTab('home-layout')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'home-layout' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <LayoutDashboard size={14} /> Home Layout
            </button>
            <button
              onClick={() => setActiveTab('navigation')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'navigation' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Menu size={14} /> Navigation
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'footer' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <FileText size={14} /> Footer
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'products' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Package size={14} /> Products
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'seo' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Globe size={14} /> SEO
            </button>
            <button
              onClick={() => setActiveTab('gift-cards')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'gift-cards' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <CreditCard size={14} /> Gift Cards
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'theme' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <Palette size={14} /> Theme
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all whitespace-nowrap ${activeTab === 'reports' ? 'bg-[var(--primary-color)] text-white shadow-md' : 'text-zinc-500 hover:text-[var(--primary-color)] hover:bg-red-50'}`}
            >
              <BarChart3 size={14} /> Reports
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

                {/* Sizing & Storefront Controls Toggle */}
                <div className="p-8 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">Sizing Configuration</h3>
                    <p className="text-xs text-zinc-500">Toggle whether shoe size selection grids are visible on product detail pages.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-3 cursor-pointer select-none bg-white border border-zinc-200 px-5 py-3 rounded-xl hover:border-zinc-300 transition-all shadow-sm">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)] cursor-pointer"
                        checked={draftShowSizesOnline} 
                        onChange={e => setDraftShowSizesOnline(e.target.checked)} 
                      />
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-700">
                        Show Shoe Sizes on Storefront
                      </span>
                    </label>
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
                      className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors hover:bg-[var(--primary-color)] ${(isSyncingBucket || isSaving || isUploading || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <RefreshCw size={14} className={isSyncingBucket ? "animate-spin" : ""} />
                      {isSyncingBucket ? 'Syncing...' : 'Sync from Storage'}
                    </button>
                    <button 
                      onClick={() => syncBucketFromSlider()}
                      disabled={isSyncingBucket || isSaving || isUploading || uploading}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors hover:bg-zinc-200 ${(isSyncingBucket || isSaving || isUploading || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <RefreshCw size={14} className={isSyncingBucket ? "animate-spin" : ""} />
                      {isSyncingBucket ? 'Syncing...' : 'Sync to Storage (Clean Up)'}
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Upload New
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleSaveSlider()}
                        disabled={isSaving || isUploading || uploading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleSliderDragEnd}>
                      <SortableContext items={sliderImages.map((img: any) => img.url)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {sliderImages.map((img: any, index: number) => (
                            <SortableSlideCard
                              key={img.url}
                              id={img.url}
                              img={img}
                              index={index}
                              onDelete={handleDeleteSlide}
                              onUpdate={updateSliderImage}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
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
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
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
                         Apply default club/brand logos to your menus
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
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                <div className="p-8">
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={navSearchQuery}
                    onChange={(e) => setNavSearchQuery(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />

                  <div className="space-y-3">
                    {draftNavigationMenus.map((menu, menuIndex) => {
                      if (navSearchQuery) {
                        const q = navSearchQuery.toLowerCase();
                        const matches = menu.label.toLowerCase().includes(q) ||
                          menu.submenus.some((sub: any) =>
                            sub.heading.toLowerCase().includes(q) ||
                            sub.items.some((item: any) => item.label.toLowerCase().includes(q))
                          );
                        if (!matches) return null;
                      }
                      const isExpanded = navSearchQuery ? true : expandedMenus.includes(menu.label);

                      return (
                        <div key={menuIndex} className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
                          <div className="p-4 bg-white border-b border-zinc-200 flex items-center gap-3">
                            <button
                              onClick={() => toggleMenu(menu.label)}
                              className="text-zinc-400 hover:text-zinc-900 transition-colors flex-shrink-0"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {isExpanded ? (
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
                            ) : (
                              <button
                                onClick={() => toggleMenu(menu.label)}
                                className="flex-1 text-left font-black text-sm uppercase tracking-widest text-zinc-900 hover:text-[var(--primary-color)] transition-colors"
                              >
                                {highlightText(menu.label, navSearchQuery)}
                                <span className="ml-2 text-xs text-zinc-400 font-normal normal-case tracking-normal">{menu.submenus.length} columns</span>
                              </button>
                            )}

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!isExpanded && (
                                <button
                                  onClick={() => toggleMenu(menu.label)}
                                  className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => removeNavigationMenu(menuIndex)}
                                className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Submenu Columns</h3>
                                <button
                                  onClick={() => addSubmenu(menuIndex)}
                                  className="text-[10px] font-black text-zinc-500 hover:text-zinc-900 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                >
                                  <Plus size={12} /> Add Column
                                </button>
                              </div>

                              <div className="space-y-3">
                                {menu.submenus.map((submenu: any, submenuIndex: number) => {
                                  if (navSearchQuery) {
                                    const q = navSearchQuery.toLowerCase();
                                    const matches = submenu.heading.toLowerCase().includes(q) ||
                                      submenu.items.some((item: any) => item.label.toLowerCase().includes(q));
                                    if (!matches) return null;
                                  }
                                  const subKey = `${menuIndex}-${submenuIndex}`;
                                  const isSubExpanded = navSearchQuery ? true : expandedSubmenus.includes(subKey);

                                  return (
                                    <div key={submenuIndex} className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                                      <div className="px-4 py-3 flex items-center gap-3 bg-zinc-50/50 border-b border-zinc-100">
                                        <button
                                          onClick={() => toggleSubmenu(subKey)}
                                          className="text-zinc-400 hover:text-zinc-900 transition-colors flex-shrink-0"
                                        >
                                          {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span className="flex-1 text-[11px] font-black text-zinc-700 uppercase tracking-widest">
                                          {highlightText(submenu.heading, navSearchQuery)}
                                          <span className="ml-2 text-zinc-400 font-normal normal-case tracking-normal text-[10px]">{submenu.items.length} items</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => moveSubmenu(menuIndex, submenuIndex, 'up')} className="text-zinc-400 hover:text-zinc-900 transition-colors"><ChevronUp size={14} /></button>
                                          <button onClick={() => moveSubmenu(menuIndex, submenuIndex, 'down')} className="text-zinc-400 hover:text-zinc-900 transition-colors"><ChevronDown size={14} /></button>
                                          <button onClick={() => removeSubmenu(menuIndex, submenuIndex)} className="text-zinc-400 hover:text-red-600 transition-colors"><X size={14} /></button>
                                        </div>
                                      </div>

                                      {isSubExpanded && (
                                        <div className="p-4">
                                          <div className="space-y-2 mb-4">
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

                                          <div className="space-y-3">
                                            {submenu.items.map((item: any, itemIndex: number) => (
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
                                      )}
                                    </div>
                                  );
                                })}

                                {menu.submenus.length === 0 && (
                                  <p className="text-sm text-zinc-400 text-center py-4">No submenu columns yet.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {navSearchQuery && !draftNavigationMenus.some(menu => {
                      const q = navSearchQuery.toLowerCase();
                      return menu.label.toLowerCase().includes(q) ||
                        menu.submenus.some((sub: any) =>
                          sub.heading.toLowerCase().includes(q) ||
                          sub.items.some((item: any) => item.label.toLowerCase().includes(q))
                        );
                    }) && (
                      <div className="text-center py-8 text-zinc-400 text-sm">No results found for "{navSearchQuery}"</div>
                    )}
                  </div>
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
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">General Meta Tags</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Meta Title</label>
                        <input
                          type="text"
                          value={draftSeoSettings.title}
                          onChange={(e) => updateSeoField('title', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                          placeholder="Site Title"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Meta Description</label>
                        <textarea
                          value={draftSeoSettings.description}
                          onChange={(e) => updateSeoField('description', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all min-h-[100px]"
                          placeholder="Site Description"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Keywords</label>
                        <input
                          type="text"
                          value={draftSeoSettings.keywords}
                          onChange={(e) => updateSeoField('keywords', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                          placeholder="soccer, mississauga, custom uniforms..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">Social Sharing</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OG Title</label>
                        <input
                          type="text"
                          value={draftSeoSettings.ogTitle}
                          onChange={(e) => updateSeoField('ogTitle', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OG Image URL</label>
                        <input
                          type="text"
                          value={draftSeoSettings.ogImage}
                          onChange={(e) => updateSeoField('ogImage', e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Store Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden mt-6">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Store Information</h2>
                    <p className="text-sm text-zinc-500 mt-1">Displayed in the "Visit Us" section on the homepage and in the schema markup.</p>
                  </div>
                  <button
                    onClick={handleSaveStoreInfo}
                    disabled={isSavingStoreInfo}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${storeInfoSaveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${isSavingStoreInfo ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {storeInfoSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {isSavingStoreInfo ? 'Saving...' : storeInfoSaveSuccess ? 'Saved!' : 'Save Store Info'}
                  </button>
                </div>
                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">Contact Details</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Store Name</label>
                      <input type="text" value={draftStoreInfo.name || ''} onChange={e => setDraftStoreInfo((p: any) => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Address</label>
                      <input type="text" value={draftStoreInfo.address || ''} onChange={e => setDraftStoreInfo((p: any) => ({ ...p, address: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Phone</label>
                      <input type="text" value={draftStoreInfo.phone || ''} onChange={e => setDraftStoreInfo((p: any) => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</label>
                      <input type="text" value={draftStoreInfo.email || ''} onChange={e => setDraftStoreInfo((p: any) => ({ ...p, email: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">Store Hours</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Use "10:00 AM - 6:00 PM" format or "Closed"</p>
                    {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => (
                      <div key={day} className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 w-24 shrink-0 capitalize">{day}</span>
                        <input
                          type="text"
                          value={draftStoreInfo.hours?.[day] || ''}
                          onChange={e => setDraftStoreInfo((p: any) => ({ ...p, hours: { ...p.hours, [day]: e.target.value } }))}
                          className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                          placeholder="10:00 AM - 6:00 PM"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'theme' && (
            <motion.div
              key="theme"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Theme & Branding */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Theme & Branding</h2>
                    <p className="text-sm text-zinc-500 mt-1">Customize colors, fonts, and store identity. Changes apply site-wide instantly.</p>
                  </div>
                  <button
                    onClick={handleSaveTheme}
                    disabled={isSavingTheme}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${themeSaveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${isSavingTheme ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSavingTheme ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : themeSaveSuccess ? (
                      <Check size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {isSavingTheme ? 'Saving...' : themeSaveSuccess ? 'Saved!' : 'Save Theme'}
                  </button>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Left column: Store name + Colors */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">Store Identity</h3>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Store Name</label>
                      <input
                        type="text"
                        value={draftTheme.storeName}
                        onChange={e => setDraftTheme(p => ({ ...p, storeName: e.target.value }))}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                        placeholder="Absolute Soccer Mississauga"
                      />
                      <p className="text-[10px] text-zinc-400">Used in receipts, emails, and page titles.</p>
                    </div>

                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)] pt-4">Brand Colors</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Primary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={draftTheme.primaryColor}
                            onChange={e => setDraftTheme(p => ({ ...p, primaryColor: e.target.value }))}
                            className="w-12 h-12 rounded-lg border border-zinc-200 cursor-pointer p-1 bg-white"
                          />
                          <input
                            type="text"
                            value={draftTheme.primaryColor}
                            onChange={e => setDraftTheme(p => ({ ...p, primaryColor: e.target.value }))}
                            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                            placeholder="#b90014"
                          />
                          <div
                            className="w-12 h-12 rounded-lg border border-zinc-200 shrink-0"
                            style={{ backgroundColor: draftTheme.primaryColor }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">Buttons, links, accents across the site.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Secondary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={draftTheme.secondaryColor}
                            onChange={e => setDraftTheme(p => ({ ...p, secondaryColor: e.target.value }))}
                            className="w-12 h-12 rounded-lg border border-zinc-200 cursor-pointer p-1 bg-white"
                          />
                          <input
                            type="text"
                            value={draftTheme.secondaryColor}
                            onChange={e => setDraftTheme(p => ({ ...p, secondaryColor: e.target.value }))}
                            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
                            placeholder="#000000"
                          />
                          <div
                            className="w-12 h-12 rounded-lg border border-zinc-200 shrink-0"
                            style={{ backgroundColor: draftTheme.secondaryColor }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">Dark backgrounds, navbars, section fills.</p>
                      </div>
                    </div>
                  </div>

                  {/* Right column: Live Preview */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--primary-color)]">Live Preview</h3>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden text-left">
                      {/* Nav bar */}
                      <div className="px-4 py-2 bg-white border-b border-zinc-100 flex items-center gap-4">
                        <span className="font-bold text-xs" style={{ color: draftTheme.primaryColor }}>
                          {draftTheme.storeName || 'Absolute Soccer'}
                        </span>
                        <span className="text-[10px] text-zinc-500 tracking-wider">FOOTWEAR</span>
                        <span className="text-[10px] text-zinc-500 tracking-wider">CLUBS</span>
                        <span className="text-[10px] text-zinc-500 tracking-wider">NATIONAL TEAMS</span>
                      </div>
                      {/* Hero area */}
                      <div className="px-4 py-5 bg-zinc-50">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">New Arrivals</p>
                        <h2 className="text-2xl font-black leading-tight text-zinc-900">Absolute Soccer Mississauga</h2>
                        <p className="text-sm text-zinc-600 mt-1">Premium Soccer Gear &amp; Custom Kits</p>
                        <button
                          className="mt-3 px-5 py-2 text-white text-xs font-bold rounded"
                          style={{ backgroundColor: draftTheme.primaryColor }}
                        >
                          Shop Now
                        </button>
                      </div>
                      {/* Footer strip */}
                      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: draftTheme.secondaryColor }}>
                        <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Footer · Dark Sections</span>
                        <span className="text-white/50 text-[10px]">torontosoccershop.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Brand Images */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Brand Showcase Images</h2>
                    <p className="text-sm text-zinc-500 mt-1">Upload lifestyle images for each brand banner on the homepage. Falls back to Unsplash placeholder if not set.</p>
                  </div>
                  <button
                    onClick={handleSaveBrandImages}
                    disabled={isSavingBrandImages || isUploading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${brandImagesSaveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSavingBrandImages || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {brandImagesSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {isSavingBrandImages ? 'Saving...' : brandImagesSaveSuccess ? 'Saved!' : 'Save Brand Images'}
                  </button>
                </div>
                <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  {(['Nike', 'Adidas', 'Puma', 'Joma', 'New Balance'] as const).map(brand => (
                    <div key={brand} className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">{brand}</p>
                      <input
                        type="text"
                        value={draftBrandImages[brand]?.title ?? ''}
                        onChange={e => handleBrandTitleChange(brand, e.target.value)}
                        placeholder={`${brand} Futbol`}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                      />
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
                        {draftBrandImages[brand]?.image ? (
                          <img src={draftBrandImages[brand]?.image} alt={brand} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-300">
                            <ImageIcon size={28} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">No image</span>
                          </div>
                        )}
                        {draftBrandImages[brand]?.image && (
                          <button
                            onClick={() => setDraftBrandImages(prev => ({ ...prev, [brand]: { ...prev[brand], image: undefined } }))}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-zinc-200 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50'}`}>
                        <Upload size={12} />
                        {draftBrandImages[brand]?.image ? 'Replace' : 'Upload'}
                        <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={e => handleBrandImageUpload(brand, e)} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Images */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Category Tile Images</h2>
                    <p className="text-sm text-zinc-500 mt-1">Upload images for the category quick-links row. The emoji icon is used as a fallback when no image is set.</p>
                  </div>
                  <button
                    onClick={handleSaveCategoryImages}
                    disabled={isSavingCategoryImages || isUploading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${categoryImagesSaveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSavingCategoryImages || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {categoryImagesSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {isSavingCategoryImages ? 'Saving...' : categoryImagesSaveSuccess ? 'Saved!' : 'Save Category Images'}
                  </button>
                </div>
                <div className="p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                  {([
                    { key: 'cleats', label: 'Cleats', emoji: '⚽' },
                    { key: 'jerseys', label: 'Jerseys', emoji: '👕' },
                    { key: 'gloves', label: 'Gloves', emoji: '🥊' },
                    { key: 'balls', label: 'Balls', emoji: '⚽' },
                    { key: 'training', label: 'Training', emoji: '💪' },
                    { key: 'accessories', label: 'Accessories', emoji: '🎽' },
                  ] as const).map(cat => (
                    <div key={cat.key} className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">{cat.label}</p>
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
                        {draftCategoryImages[cat.key] ? (
                          <img src={draftCategoryImages[cat.key]} alt={cat.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-300">
                            <span className="text-3xl" role="img" aria-label={cat.label}>{cat.emoji}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Fallback</span>
                          </div>
                        )}
                        {draftCategoryImages[cat.key] && (
                          <button
                            onClick={() => setDraftCategoryImages(prev => { const n = { ...prev }; delete n[cat.key]; return n; })}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-zinc-200 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50'}`}>
                        <Upload size={12} />
                        {draftCategoryImages[cat.key] ? 'Replace' : 'Upload'}
                        <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={e => handleCategoryTileImageUpload(cat.key, e)} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logos (mirrors Slider tab Brand Identity) */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Logos</h2>
                    <p className="text-sm text-zinc-500 mt-1">Upload your store's logos (recommended 500x300, transparent SVG/PNG). Also editable in the Slider tab.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Header Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoFileChange} />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Landing Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleLandingLogoFileChange} />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-200 transition-colors">
                      <Upload size={14} /> Footer Logo
                      <input type="file" className="hidden" accept="image/*" onChange={handleFooterLogoFileChange} />
                    </label>
                    <button
                      onClick={handleSaveSlider}
                      disabled={isSaving || isUploading}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${saveSuccess ? 'bg-green-600 text-white' : 'bg-[var(--primary-color)] text-white hover:bg-zinc-900 shadow-lg shadow-red-900/20'} ${(isSaving || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                      {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Logos'}
                    </button>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 bg-zinc-50">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Header Logo</p>
                    <div className="bg-white p-8 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center h-40">
                      <img src={draftLogo} alt="Header Logo" className="max-h-24 w-auto object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Landing Logo</p>
                    <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm flex items-center justify-center h-40">
                      <img src={draftLandingLogo} alt="Landing Logo" className="max-h-24 w-auto object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Footer Logo</p>
                    <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm flex items-center justify-center h-40">
                      <img src={draftFooterLogo} alt="Footer Logo" className="max-h-24 w-auto object-contain" />
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
                    <FileText size={20} className="text-[var(--primary-color)]" /> Bulk Upload
                  </h2>
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-500">
                      Upload a CSV file to add multiple products at once. 
                      <button 
                        onClick={downloadTemplate}
                        className="text-[var(--primary-color)] font-bold hover:underline ml-1"
                      >
                        Download Template
                      </button>
                    </p>
                    
                    <div className="relative">
                      <label className={`w-full flex flex-col items-center justify-center px-4 py-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                        isBulkUploading ? 'bg-zinc-50 border-zinc-200 cursor-not-allowed' : 
                        bulkUploadStatus === 'success' ? 'bg-green-50 border-green-200' :
                        bulkUploadStatus === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-zinc-50 border-zinc-200 hover:border-[var(--primary-color)] hover:bg-white'
                      }`}>
                        {isBulkUploading ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-zinc-200 border-t-[var(--primary-color)] rounded-full animate-spin" />
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
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="p-8 border-b border-zinc-100">
                    {fromPOSData && (
                      <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Creating product from POS scan</p>
                          <p className="text-[11px] text-amber-700 font-mono mt-0.5">Barcode: {fromPOSData.barcode}</p>
                        </div>
                        <button
                          onClick={() => navigate('/pos')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[11px] font-bold uppercase transition-colors"
                        >
                          <ArrowLeft size={13} /> Back to POS
                        </button>
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      <Plus size={20} className="text-[var(--primary-color)]" /> Add New Product
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">Use the form below to quickly add products to your catalog</p>
                  </div>

                  <div className="p-8">
                    {/* Two-Column Layout */}
                    <div className="grid grid-cols-3 gap-8 mb-8">
                      {/* LEFT COLUMN - 60% */}
                      <div className="col-span-2 space-y-6">
                        {/* Product Name */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Product Name</label>
                          <input
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all outline-none"
                            placeholder="e.g. Real Madrid Home Kit"
                            value={newProduct.name}
                            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                          />
                        </div>

                        {/* Description */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Description</label>
                          <textarea
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all outline-none min-h-[120px] resize-none"
                            placeholder="Describe the product features, materials, and fit..."
                            value={newProduct.description}
                            onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                          />
                        </div>

                        {/* Product Image */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Product Image (1000x1250)</label>
                          <div className="flex gap-4 items-start">
                            <div className="w-24 h-32 rounded-lg bg-white border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {newProduct.image ? (
                                <img src={newProduct.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon size={32} className="text-zinc-300" />
                              )}
                            </div>
                            <div className="flex-1 space-y-2 pt-1">
                              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 rounded-lg font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-zinc-100 transition-colors border border-zinc-200">
                                <Upload size={14} /> Upload Image
                                <input type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                              </label>
                              <input
                                className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                                placeholder="Or paste image URL..."
                                value={newProduct.image}
                                onChange={e => updateNewProductImage('image', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Additional Images */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Additional Images</label>
                          <div className="space-y-3">
                            {(newProduct.images || []).map((img, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      const imgs = [...(newProduct.images || [])];
                                      [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
                                      setNewProduct({...newProduct, images: imgs});
                                    }}
                                    className="w-5 h-5 bg-zinc-200 hover:bg-zinc-300 rounded flex items-center justify-center text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                  ><ChevronUp size={12} /></button>
                                  <button
                                    type="button"
                                    disabled={idx === (newProduct.images || []).length - 1}
                                    onClick={() => {
                                      const imgs = [...(newProduct.images || [])];
                                      [imgs[idx + 1], imgs[idx]] = [imgs[idx], imgs[idx + 1]];
                                      setNewProduct({...newProduct, images: imgs});
                                    }}
                                    className="w-5 h-5 bg-zinc-200 hover:bg-zinc-300 rounded flex items-center justify-center text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                  ><ChevronDown size={12} /></button>
                                </div>
                                <div className="w-10 h-10 rounded bg-white border border-zinc-200 overflow-hidden flex-shrink-0">
                                  {img ? (
                                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                      <ImageIcon size={14} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                  <label className="inline-flex items-center gap-1 px-2 py-1 bg-white text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-50 transition-colors border border-zinc-200 w-fit">
                                    <Upload size={10} /> Upload
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAdditionalImageUpload(e, idx)} />
                                  </label>
                                  <input
                                    className="w-full p-1 bg-white border border-zinc-200 rounded text-[9px] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                                    placeholder="Or URL..."
                                    value={img}
                                    onChange={e => updateNewProductImage('additional', e.target.value, idx)}
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const newImages = (newProduct.images || []).filter((_, i) => i !== idx);
                                    setNewProduct({...newProduct, images: newImages});
                                  }}
                                  className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => setNewProduct({...newProduct, images: [...(newProduct.images || []), '']})}
                              className="w-full py-2 border border-dashed border-zinc-300 rounded text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-all uppercase tracking-widest bg-white"
                            >
                              + Add Image
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT COLUMN - 40% */}
                      <div className="col-span-1 space-y-4">
                        {/* Price & Sale Price */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Pricing</label>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Price ($)</label>
                              <input
                                className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all outline-none"
                                placeholder="0.00"
                                type="number"
                                value={newProduct.price}
                                onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                              />
                            </div>
                            {newProduct.isOnSale && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                              >
                                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Sale Price ($)</label>
                                <input
                                  className="w-full p-3 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none font-bold text-[var(--primary-color)]"
                                  placeholder="Discounted price..."
                                  type="number"
                                  value={newProduct.salePrice || ''}
                                  onChange={e => setNewProduct({...newProduct, salePrice: parseFloat(e.target.value)})}
                                />
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Category & Brand */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Category</label>
                            <select
                              className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none appearance-none cursor-pointer"
                              value={availableCategories.find(c => c.toLowerCase() === (newProduct.category || '').toLowerCase()) || newProduct.category}
                              onChange={e => setNewProduct({...newProduct, category: e.target.value, submenu: '', submenus: []})}
                            >
                              {availableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Brand</label>
                            <div className="relative">
                              <input
                                className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all outline-none"
                                placeholder="Nike, Adidas, Puma..."
                                value={newProduct.brand || ''}
                                onChange={e => setNewProduct({...newProduct, brand: e.target.value})}
                                onFocus={() => setBrandInputOpen(true)}
                              />
                              {brandInputOpen && availableBrands.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                                  {availableBrands
                                    .filter(b => b.toLowerCase().includes((newProduct.brand || '').toLowerCase()))
                                    .map(brand => (
                                      <button
                                        key={brand}
                                        onClick={() => {
                                          setNewProduct({...newProduct, brand});
                                          setBrandInputOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm font-medium border-b border-zinc-100 last:border-0 transition-colors"
                                      >
                                        {brand}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Product Code */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                            Product Code <span className="text-zinc-400 normal-case">(Optional)</span>
                          </label>
                          <input
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all outline-none"
                            placeholder="e.g. NK-DV9237, ADI-HG6164"
                            value={newProduct.product_code || ''}
                            onChange={e => setNewProduct({...newProduct, product_code: e.target.value})}
                          />
                        </div>

                        {/* Submenus */}
                        {(() => {
                          const menu = navigationMenus.find(m => m.label.toUpperCase() === newProduct.category.toUpperCase());
                          if (!menu || menu.submenus.length === 0) return null;

                          return (
                            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Submenus / Tags</label>
                              <div className="space-y-2">
                                <select
                                  className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none appearance-none cursor-pointer text-sm"
                                  value=""
                                  onChange={e => {
                                    if (e.target.value && !newProduct.submenus?.includes(e.target.value)) {
                                      setNewProduct({...newProduct, submenus: [...(newProduct.submenus || []), e.target.value]});
                                    }
                                  }}
                                >
                                  <option value="">Add tag...</option>
                                  {menu.submenus.map(sub => (
                                    <React.Fragment key={sub.heading}>
                                      <option value={sub.heading} className="font-bold">{sub.heading}</option>
                                      {sub.items.map((item, itemIdx) => (
                                        <option key={item.label + itemIdx} value={item.label}>&nbsp;&nbsp;{item.label}</option>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </select>
                                {newProduct.submenus && newProduct.submenus.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {newProduct.submenus.map(sub => (
                                      <span key={sub} className="inline-flex items-center gap-1 px-3 py-1 bg-white text-zinc-700 text-[10px] font-bold uppercase rounded border border-zinc-200">
                                        {sub}
                                        <button onClick={() => setNewProduct({...newProduct, submenus: newProduct.submenus?.filter(s => s !== sub)})}>
                                          <X size={10} />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Toggles Grid */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Status & Flags</label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={newProduct.is_online} onChange={e => setNewProduct({...newProduct, is_online: e.target.checked})} />
                              <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-900">Online</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={newProduct.showSizes || false} onChange={e => setNewProduct({...newProduct, showSizes: e.target.checked})} />
                              <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-900">Show Sizes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={newProduct.isNewArrival} onChange={e => setNewProduct({...newProduct, isNewArrival: e.target.checked})} />
                              <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-900">New Arrival</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={newProduct.isFeatured} onChange={e => setNewProduct({...newProduct, isFeatured: e.target.checked})} />
                              <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-900">Featured</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group select-none col-span-2">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]" checked={newProduct.isOnSale} onChange={e => setNewProduct({...newProduct, isOnSale: e.target.checked, salePrice: e.target.checked ? (newProduct.salePrice || 0) : 0})} />
                              <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-900">On Sale</span>
                            </label>
                          </div>
                        </div>

                        {/* Release Date */}
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Release Date <span className="text-zinc-400 normal-case">(Optional)</span></label>
                          <input
                            type="datetime-local"
                            value={newProduct.release_date ? new Date(newProduct.release_date).toISOString().slice(0, 16) : ''}
                            onChange={e => setNewProduct({...newProduct, release_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
                            className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                          />
                          {newProduct.release_date && (
                            <button
                              type="button"
                              onClick={() => setNewProduct({...newProduct, release_date: null})}
                              className="mt-2 text-[9px] text-red-500 hover:underline uppercase tracking-widest font-bold cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Color Ways Section */}
                    <div className="border-t border-zinc-200 pt-8 mt-8">
                      <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
                        <span className="text-zinc-400">Optional</span> Color Variants
                      </h3>
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


                    {/* PRODUCT SIZING & AGE GROUP VARIANT ENGINE FOR NEW PRODUCT (RAPID INTENSIVE) */}
                    <div className="mt-8 border-t border-zinc-200 pt-8" id="product-variants-creation-section">
                      {/* No Sizes Toggle & Simple Variant Form */}
                      <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-700">Add Size Variants</h4>
                          <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                            <input
                              type="checkbox"
                              checked={newProductHasNoSizes}
                              onChange={e => setNewProductHasNoSizes(e.target.checked)}
                              className="w-4 h-4 accent-[var(--primary-color)] cursor-pointer rounded"
                            />
                            <span>This product has no sizes (one size only)</span>
                          </label>
                        </div>
                        {newProductHasNoSizes && (
                          <div className={`grid gap-3 grid-cols-1`}>
                            <div>
                              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Age Group</label>
                              <select
                                value={newProductVariantAgeGroup}
                                onChange={e => setNewProductVariantAgeGroup(e.target.value as any)}
                                className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                              >
                                <option value="Adult">Adult</option>
                                <option value="Youth">Youth</option>
                                <option value="Balls">Balls</option>
                                <option value="Gloves">Gloves</option>
                                <option value="One Size">One Size</option>
                                <option value="Adult Footwear">Adult Footwear</option>
                                <option value="Youth Footwear">Youth Footwear</option>
                                <option value="Toddler">Toddler</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Barcode</label>
                              <input
                                type="text"
                                value={newProductVariantBarcode}
                                onChange={e => setNewProductVariantBarcode(e.target.value)}
                                placeholder="Unique barcode"
                                className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Stock Qty</label>
                              <input
                                type="number"
                                value={newProductVariantQuantity}
                                onChange={e => setNewProductVariantQuantity(parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddCreatedProductVariant}
                              className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-[var(--primary-color)] transition-all"
                            >
                              + Add Variant
                            </button>
                          </div>
                        )}
                      </div>

                      {!newProductHasNoSizes && (
                        <RapidScanIntakeMatrix
                          productName={newProduct.name || 'New Product'}
                          category={newProduct.category}
                          existingVariants={createdProductVariants}
                          productColors={(newProduct.colors || []).map((c: any) => c.name)}
                          onRegisterVariant={async (ageGroup, size, barcode, quantity, color) => {
                            const payload = {
                              id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                              age_group: ageGroup,
                              size: size,
                              barcode: barcode,
                              stock_quantity: quantity,
                              color: color || null
                            };
                            setCreatedProductVariants(prev => [...prev, payload]);
                          }}
                          onSuccessFinished={() => {
                          }}
                        />
                      )}

                      {/* Created Variants list preview */}
                      <div className="mt-5 mb-8">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">
                          Pending Variants Queue ({createdProductVariants.length})
                        </label>
                        
                        {createdProductVariants.length === 0 ? (
                          <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-6 text-center text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                            No variants registered in matrix queue yet. Enter quantities and lock sheet above to start scanning barcodes.
                          </div>
                        ) : (
                          <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-xs bg-white">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-zinc-50 uppercase tracking-wider text-zinc-500 border-b border-zinc-150">
                                  <th className="p-3 font-bold">Age Group</th>
                                  <th className="p-3 font-bold">Size</th>
                                  <th className="p-3 font-bold">Color</th>
                                  <th className="p-3 font-bold">Barcode</th>
                                  <th className="p-3 font-bold">Stock</th>
                                  <th className="p-3 font-bold text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {createdProductVariants.map((v) => (
                                  <tr key={v.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                    <td className="p-3 font-bold uppercase text-zinc-900">{v.age_group}</td>
                                    <td className="p-3 font-mono font-bold text-zinc-700 bg-zinc-50">{v.size === null ? '(no size)' : v.size}</td>
                                    <td className="p-3">
                                      <select
                                        value={v.color || ''}
                                        onChange={(e) => {
                                          const newColor = e.target.value || null;
                                          setCreatedProductVariants(prev => prev.map(x => x.id === v.id ? { ...x, color: newColor } : x));
                                        }}
                                        className="text-[10px] font-bold border border-zinc-200 rounded p-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                      >
                                        <option value="">- None -</option>
                                        {(newProduct.colors || []).map((c: any) => (
                                          <option key={c.name} value={c.name}>{c.name}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-3 font-mono font-bold text-[var(--primary-color)]">{v.barcode}</td>
                                    <td className="p-3 font-semibold text-zinc-650">{v.stock_quantity} units</td>
                                    <td className="p-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCreatedProductVariant(v.id)}
                                        className="text-red-600 hover:text-red-800 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full-Width Button at Bottom */}
                  <div className="border-t border-zinc-200 p-8 bg-zinc-50">
                    <button
                      className={`w-full p-4 rounded-xl font-headline font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 text-lg ${
                        addStatus === 'success' ? 'bg-green-600 text-white' :
                        addStatus === 'error' ? 'bg-red-600 text-white' :
                        addStatus === 'syncing' || isUploading ? 'bg-zinc-700 text-white' :
                        'bg-[var(--primary-color)] text-white hover:bg-red-800 shadow-lg shadow-red-900/20'
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
                    {addStatus === 'error' && addErrorMessage && (addErrorMessage.includes('RLS') || addErrorMessage.toLowerCase().includes('row-level security')) && (
                      <div className="mt-4 p-5 bg-red-50 rounded-xl border border-red-200 text-left space-y-3.5 shadow-sm">
                        <div className="flex items-start gap-2.5 text-red-800">
                          <AlertTriangle className="text-red-600 shrink-0 mt-0.5 animate-bounce" size={16} />
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider">How to Fix Row-Level Security (RLS) Block</p>
                            <p className="text-xs mt-1 text-red-700/90 leading-relaxed font-semibold">
                              This happens because your Supabase table has Row-Level Security enabled and you are running on an unauthenticated client connection. To allow administrative uploads securely, please add your service_role key to the environment.
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-[10px] space-y-2 text-red-950 font-bold leading-normal uppercase tracking-wider pl-6 select-all">
                          <p className="text-[var(--primary-color)] font-black underline">Tip: Fix: Check Supabase RLS Policy</p>
                          <ol className="list-decimal pl-4 space-y-1 text-[9.5px]">
                            <li>Go to your <span className="font-extrabold text-[var(--primary-color)]">Supabase Dashboard</span> and navigate to the products table.</li>
                            <li>Check the <span className="underline font-black text-[var(--primary-color)]">RLS (Row Level Security)</span> policies.</li>
                            <li>Ensure policies allow authenticated or public access for UPDATE operations.</li>
                            <li>If RLS is disabled, the issue may be elsewhere - check browser console for details.</li>
                          </ol>
                        </div>
                      </div>
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
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[var(--primary-color)] transition-colors" size={14} />
                          <input 
                            type="text" 
                            placeholder="Find products..."
                            value={adminSearchTerm}
                            onChange={(e) => setAdminSearchTerm(e.target.value)}
                            className="pl-9 pr-12 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition-all w-[260px]"
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
                          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-[var(--primary-color)] transition-all disabled:opacity-50 shadow-sm relative overflow-hidden"
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
                            onClick={() => setConfirmMarkAllOnline(true)}
                            disabled={isMarkingAllOnline}
                            className="text-[10px] font-bold text-zinc-400 hover:text-[var(--primary-color)] uppercase tracking-widest disabled:opacity-50"
                          >
                            {isMarkingAllOnline ? 'Marking...' : markAllOnlineStatus === 'success' ? 'All Online' : 'Mark All Online'}
                          </button>
                          {confirmMarkAllOnline && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-zinc-200 rounded-lg shadow-xl p-4 z-50">
                              <p className="text-[10px] font-bold text-zinc-900 mb-3 text-left normal-case">Mark all products as available in the online store?</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={async () => {
                                    setConfirmMarkAllOnline(false);
                                    setIsMarkingAllOnline(true);
                                    setMarkAllOnlineStatus('idle');
                                    try {
                                      await markAllProductsOnline();
                                      setMarkAllOnlineStatus('success');
                                      setTimeout(() => setMarkAllOnlineStatus('idle'), 3000);
                                    } catch (e) {
                                      setMarkAllOnlineStatus('error');
                                      setTimeout(() => setMarkAllOnlineStatus('idle'), 5000);
                                    } finally {
                                      setIsMarkingAllOnline(false);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 bg-[var(--primary-color)] text-white text-[8px] font-black uppercase rounded tracking-widest text-center"
                                >
                                  Yes, Do It
                                </button>
                                <button 
                                  onClick={() => setConfirmMarkAllOnline(false)}
                                  className="flex-1 px-2 py-1 bg-zinc-100 text-zinc-600 text-[8px] font-black uppercase rounded tracking-widest text-center"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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
                        .filter(cat => !['CUSTOM KITS', 'KIT ORDERS'].includes(cat.toUpperCase()))
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

                    {/* Bulk Brand Assignment Section */}
                    {selectedProductIds.size > 0 && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-2">
                            {selectedProductIds.size} product{selectedProductIds.size !== 1 ? 's' : ''} selected
                          </p>
                          <div className="flex gap-2 items-center flex-wrap">
                            <select
                              value={bulkBrandAssignBrand}
                              onChange={(e) => setBulkBrandAssignBrand(e.target.value)}
                              className="px-3 py-2 bg-white border border-blue-200 rounded text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                            >
                              <option value="">Choose brand...</option>
                              {availableBrands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleBulkBrandAssign}
                              disabled={isBulkBrandAssigning || !bulkBrandAssignBrand}
                              className={`px-4 py-2 rounded font-bold uppercase tracking-widest text-[10px] transition-all ${
                                bulkBrandStatus === 'success' ? 'bg-green-600 text-white' :
                                bulkBrandStatus === 'error' ? 'bg-red-600 text-white' :
                                'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                              }`}
                            >
                              {isBulkBrandAssigning ? 'Assigning...' : bulkBrandStatus === 'success' ? 'Done!' : 'Assign Brand'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProductIds(new Set());
                                setBulkBrandAssignBrand('');
                              }}
                              className="px-3 py-2 bg-white border border-blue-200 text-blue-600 rounded text-[10px] font-bold uppercase hover:bg-blue-50 transition-colors"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-zinc-100 relative">
                    {isLoading && products.length === 0 && (
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-zinc-200 border-t-[var(--primary-color)] rounded-full animate-spin mb-3" />
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
                          className="mt-6 text-[var(--primary-color)] text-[10px] font-black uppercase tracking-widest hover:underline"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      paginatedProducts.map(product => (
                        <div key={product.id} className="p-3 sm:p-6 flex items-center gap-3 sm:gap-6 hover:bg-zinc-50 transition-colors group border-b border-zinc-100 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(product.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedProductIds);
                              if (e.target.checked) {
                                newSelected.add(product.id);
                              } else {
                                newSelected.delete(product.id);
                              }
                              setSelectedProductIds(newSelected);
                            }}
                            className="w-5 h-5 rounded border-zinc-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)] cursor-pointer flex-shrink-0"
                          />
                          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                            <img src={product.image || `https://picsum.photos/seed/${product.id}/80`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <h3 className="font-bold text-zinc-900 text-sm truncate">{product.name}</h3>
                              {product.is_online ? (
                                <span className="px-2 py-0.5 bg-zinc-900 text-white text-[8px] font-black uppercase rounded tracking-widest shadow-xs">Online</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-black uppercase rounded tracking-widest">In-Store Only</span>
                              )}
                              {product.isNewArrival && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded tracking-widest">New</span>}
                              {product.isOnSale && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase rounded tracking-widest">Sale</span>}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                              {product.category}
                              {product.isOnSale && product.salePrice ? (
                                <span className="ml-1">&bull; <span className="line-through opacity-50">${product.price}</span> <span className="text-[var(--primary-color)] font-bold">${product.salePrice}</span></span>
                              ) : (
                                <span className="ml-1">&bull; ${product.price}</span>
                              )}
                            </p>
                            <StockBadge productId={product.id} productStockCache={productStockCache} />
                            {!product.brand && (
                              <p className="text-[9px] text-amber-600 mt-0.5 font-medium">Missing Brand</p>
                            )}
                          </div>
                          {/* Buttons: always visible on mobile, hover-only on desktop */}
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={async () => {
                                const fullProduct = await fetchProductById(product.id);
                                if (fullProduct) {
                                  setEditingProduct(fullProduct);
                                  setOriginalProduct(fullProduct);
                                }
                              }}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-white rounded-lg border border-zinc-200 sm:border-transparent hover:border-zinc-200 transition-all"
                              title="Edit product"
                            >
                              <Edit2 size={16} />
                            </button>
                            {confirmClear === product.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { handleDelete(product.id); setConfirmClear(false); }}
                                  className="px-2 py-1 bg-red-600 text-white text-[8px] font-black uppercase rounded tracking-widest min-h-[44px]"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmClear(false)}
                                  className="px-2 py-1 bg-zinc-200 text-zinc-600 text-[8px] font-black uppercase rounded tracking-widest min-h-[44px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmClear(product.id)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-zinc-200 sm:border-transparent hover:border-red-100 transition-all"
                                title="Delete product"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* High Quality Pagination Controls bar */}
                  {filteredProducts.length > adminItemsPerPage && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-50/50 p-6 border-b border-zinc-100 text-xs font-sans">
                      <div className="text-zinc-500 font-medium font-sans">
                        Showing <span className="font-bold text-zinc-900">{(adminCurrentPage - 1) * adminItemsPerPage + 1}</span> to <span className="font-bold text-zinc-900">{Math.min(filteredProducts.length, adminCurrentPage * adminItemsPerPage)}</span> of <span className="font-bold text-[var(--primary-color)]">{filteredProducts.length}</span> matching products
                      </div>
                      <div className="flex gap-2 items-center font-sans">
                        <button
                          type="button"
                          disabled={adminCurrentPage === 1}
                          onClick={() => setAdminCurrentPage(prev => Math.max(1, prev - 1))}
                          className="px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 disabled:opacity-40 disabled:hover:bg-white rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="font-bold text-zinc-650 bg-white border border-zinc-200 px-3.5 py-2 rounded-lg text-[10px]">
                          Page <span className="text-zinc-900">{adminCurrentPage}</span> of {Math.ceil(filteredProducts.length / adminItemsPerPage)}
                        </span>
                        <button
                          type="button"
                          disabled={adminCurrentPage >= Math.ceil(filteredProducts.length / adminItemsPerPage)}
                          onClick={() => setAdminCurrentPage(prev => Math.min(Math.ceil(filteredProducts.length / adminItemsPerPage), prev + 1))}
                          className="px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 disabled:opacity-40 disabled:hover:bg-white rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {hasMoreProducts && (
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
                            Load More Products
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
                               <span className={`font-mono font-black text-[var(--primary-color)]`}>
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
                             className="w-full py-1 bg-[var(--primary-color)] text-white text-[8px] font-black uppercase rounded tracking-widest hover:opacity-90"
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
                               <span className="font-mono text-[var(--primary-color)] font-black">ADMIN</span>
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
                            className="text-[var(--primary-color)] hover:underline"
                         >
                            Re-Sync Trace
                         </button>
                      </p>
                      <div className="max-h-40 overflow-y-auto text-[9px] font-mono text-zinc-500 leading-relaxed">
                        {products.length === 0 ? (
                           <div className="py-4 text-center text-zinc-400 italic">No products currently loaded in memory.</div>
                        ) : products.map(p => (
                          <div key={p.id} className="mb-1 border-b border-zinc-50 pb-1 flex justify-between">
                            <span>ID: {p.id} | NAME: {(p.name || '').substring(0, 30)}...</span>
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
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Category</label>
                      <select
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none appearance-none cursor-pointer"
                        value={availableCategories.find(c => c.toLowerCase() === (editingProduct.category || '').toLowerCase()) || editingProduct.category}
                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value, submenu: '', submenus: []})}
                      >
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Brand</label>
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none" placeholder="e.g. Nike, Adidas, Puma" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Product Code <span className="text-zinc-400">(Optional)</span></label>
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none" placeholder="e.g. NK-DV9237, ADI-HG6164" value={editingProduct.product_code || ''} onChange={e => setEditingProduct({...editingProduct, product_code: e.target.value})} />
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
                                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none appearance-none cursor-pointer pr-10" 
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
                      <input className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none" type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                    </div>
                    <div className="flex flex-col gap-4 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)]" checked={editingProduct.is_online} onChange={e => setEditingProduct({...editingProduct, is_online: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700">Available in Online Store</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)]" checked={editingProduct.showSizes || false} onChange={e => setEditingProduct({...editingProduct, showSizes: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700">Show Sizes on Product Page</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)]" checked={editingProduct.isNewArrival} onChange={e => setEditingProduct({...editingProduct, isNewArrival: e.target.checked})} />
                        <span className="text-sm font-medium text-zinc-700">New Arrival</span>
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)]" checked={editingProduct.isFeatured} onChange={e => setEditingProduct({...editingProduct, isFeatured: e.target.checked})} />
                          <span className="text-sm font-medium text-zinc-700">Featured on Home Page</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-[var(--primary-color)]" checked={editingProduct.isOnSale} onChange={e => setEditingProduct({...editingProduct, isOnSale: e.target.checked, salePrice: e.target.checked ? (editingProduct.salePrice || 0) : 0})} />
                          <span className="text-sm font-medium text-zinc-700">On Sale</span>
                        </label>
                        {editingProduct.isOnSale && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Sale Price ($)</label>
                            <input 
                              className="w-full p-2 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none font-bold text-[var(--primary-color)]" 
                              type="number" 
                              value={editingProduct.salePrice || ''} 
                              onChange={e => setEditingProduct({...editingProduct, salePrice: parseFloat(e.target.value)})} 
                            />
                          </div>
                        )}
                      </div>
                      <div className="pt-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                          Release Date (optional - hides sizes until this date)
                        </label>
                        <input
                          type="datetime-local"
                          value={editingProduct.release_date ? new Date(editingProduct.release_date).toISOString().slice(0, 16) : ''}
                          onChange={e => setEditingProduct({...editingProduct, release_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
                          className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                        />
                        {editingProduct.release_date && (
                          <button
                            type="button"
                            onClick={() => setEditingProduct({...editingProduct, release_date: null})}
                            className="mt-1 text-[9px] text-red-500 hover:underline uppercase tracking-widest font-bold cursor-pointer"
                          >
                            Clear release date
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Product Images <span className="text-zinc-400 normal-case font-normal">(first image is the main one)</span>
                    </label>
                    <div className="space-y-3">
                      {(() => {
                        const allImgs = [editingProduct.image, ...(editingProduct.images || [])]
                          .filter(img => img !== null && img !== undefined)
                          .map(i => String(i || ''));
                        return allImgs.map((img_safe, idx) => {
                          const isMain = idx === 0;
                          return (
                            <div key={idx} className="flex gap-2 items-center">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const imgs = [editingProduct.image, ...(editingProduct.images || [])];
                                    [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
                                    setEditingProduct({...editingProduct, image: imgs[0], images: imgs.slice(1)});
                                  }}
                                  className="w-5 h-5 bg-zinc-100 hover:bg-zinc-200 rounded flex items-center justify-center text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                ><ChevronUp size={12} /></button>
                                <button
                                  type="button"
                                  disabled={idx === allImgs.length - 1}
                                  onClick={() => {
                                    const imgs = [editingProduct.image, ...(editingProduct.images || [])];
                                    [imgs[idx + 1], imgs[idx]] = [imgs[idx], imgs[idx + 1]];
                                    setEditingProduct({...editingProduct, image: imgs[0], images: imgs.slice(1)});
                                  }}
                                  className="w-5 h-5 bg-zinc-100 hover:bg-zinc-200 rounded flex items-center justify-center text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                ><ChevronDown size={12} /></button>
                              </div>
                              <div className="relative w-10 h-10 rounded bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0">
                                {img_safe ? (
                                  <img src={img_safe} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                    <ImageIcon size={14} />
                                  </div>
                                )}
                                {isMain && (
                                  <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 text-white text-[6px] font-black uppercase text-center tracking-widest py-0.5">Main</span>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col gap-2">
                                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded font-bold uppercase tracking-widest text-[8px] cursor-pointer hover:bg-zinc-200 transition-colors w-fit">
                                  <Upload size={12} /> Upload
                                  <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setIsUploading(true);
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      try {
                                        const resized = await resizeImage(reader.result as string, 1000, 1250, 0.8);
                                        const path = `products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                                        const publicUrl = await uploadImage(resized, path);
                                        const imgs = [editingProduct.image, ...(editingProduct.images || [])];
                                        imgs[idx] = publicUrl;
                                        setEditingProduct({...editingProduct, image: imgs[0], images: imgs.slice(1)});
                                      } catch (err) {
                                        console.error("Image upload failed:", err);
                                      } finally {
                                        setIsUploading(false);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }} />
                                </label>
                                <input
                                  className="flex-1 p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                                  placeholder="Or paste image URL..."
                                  value={img_safe || ''}
                                  onChange={e => {
                                    const imgs = [editingProduct.image, ...(editingProduct.images || [])];
                                    imgs[idx] = e.target.value;
                                    setEditingProduct({...editingProduct, image: imgs[0], images: imgs.slice(1)});
                                  }}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const imgs = [editingProduct.image, ...(editingProduct.images || [])].filter((_, i) => i !== idx);
                                  setEditingProduct({...editingProduct, image: imgs[0] || '', images: imgs.slice(1)});
                                }}
                                className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        });
                      })()}
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
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none min-h-[120px] resize-none" 
                      value={editingProduct.description} 
                      onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                    />
                  </div>

                  {/* PRODUCT SIZING & AGE GROUP VARIANT ENGINE (RAPID INTENSIVE) */}
                  <div className="mt-8 border-t border-zinc-200 pt-8" id="product-variants-section">
                    {/* Simple Quick-Add Variant Form */}
                    <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-700">Quick Add Size Variant</h4>
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                          <input
                            type="checkbox"
                            checked={editingProductHasNoSizes}
                            onChange={e => setEditingProductHasNoSizes(e.target.checked)}
                            className="w-4 h-4 accent-[var(--primary-color)] cursor-pointer rounded"
                          />
                          <span>This product has no sizes (one size only)</span>
                        </label>
                      </div>
                      <div className={`grid gap-3 ${editingProductHasNoSizes ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Age Group</label>
                          <select
                            value={newVariantAgeGroup}
                            onChange={e => setNewVariantAgeGroup(e.target.value as any)}
                            className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                          >
                            <option value="Adult">Adult</option>
                            <option value="Youth">Youth</option>
                            <option value="Balls">Balls</option>
                            <option value="Gloves">Gloves</option>
                            <option value="One Size">One Size</option>
                            <option value="Adult Footwear">Adult Footwear</option>
                            <option value="Youth Footwear">Youth Footwear</option>
                            <option value="Toddler">Toddler</option>
                          </select>
                        </div>
                        {!editingProductHasNoSizes && (
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Size</label>
                            <input
                              type="text"
                              value={newVariantSize}
                              onChange={e => setNewVariantSize(e.target.value)}
                              placeholder="e.g. 9, XL, 4Y"
                              className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Color</label>
                          <select
                            value={newVariantBarcode.split(' - ')[0] || ''}
                            onChange={(e) => {
                              const color = e.target.value;
                              if (color) {
                                setNewVariantBarcode(`${color} - ${newVariantSize || 'One Size'}`);
                              }
                            }}
                            className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                          >
                            <option value="">None</option>
                            {(editingProduct?.colors || []).map((c: any) => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-full">
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Barcode</label>
                          <div className="flex gap-2">
                            <input
                              ref={newVariantBarcodeRef}
                              type="text"
                              inputMode="text"
                              value={newVariantBarcode}
                              onChange={e => setNewVariantBarcode(e.target.value)}
                              placeholder="Scan or type barcode"
                              className="flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                            />
                            <button
                              type="button"
                              onClick={() => newVariantBarcodeRef.current?.focus()}
                              className="px-3 py-2 bg-zinc-900 text-white rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary-color)] transition-colors"
                              title="Focus barcode input to scan"
                            >
                              <ScanLine size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Stock Qty</label>
                          <input
                            type="number"
                            value={newVariantQuantity}
                            onChange={e => setNewVariantQuantity(parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-[var(--primary-color)] transition-all"
                      >
                        + Add Variant to Database
                      </button>
                    </div>
                    {editingProduct && !editingProductHasNoSizes && (
                      <RapidScanIntakeMatrix
                        productId={editingProduct.id}
                        productName={editingProduct.name}
                        category={editingProduct.category}
                        existingVariants={editingProductVariants}
                        productColors={(editingProduct.colors || []).map((c: any) => c.name)}
                        onRegisterVariant={async (ageGroup, size, barcode, quantity, color) => {
                          const { error } = await supabase
                            .from('product_variants')
                            .upsert([{
                              product_id: editingProduct.id,
                              age_group: ageGroup,
                              size: size,
                              barcode: barcode.toUpperCase(),
                              stock_quantity: quantity,
                              color: color || null
                            }], { onConflict: 'barcode' });

                          if (error) throw new Error(error.message);
                        }}
                        onSuccessFinished={async () => {
                          if (editingProduct && editingProduct.id) {
                            setVariantsLoading(true);
                            const { data } = await supabase
                              .from('product_variants')
                              .select('*')
                              .eq('product_id', editingProduct.id)
                              .order('age_group');
                            setEditingProductVariants(data || []);
                            setVariantsLoading(false);
                          }
                        }}
                      />
                    )}

                    {/* Active Variants list table */}
                    <div className="mt-5">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">
                        Registered Master Variants ({editingProductVariants.length})
                      </label>
                      
                      {variantsLoading ? (
                        <div className="text-zinc-500 font-bold uppercase italic text-[10px] py-4">Loading variants database...</div>
                      ) : editingProductVariants.length === 0 ? (
                        <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-6 text-center text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                          No variants registered in the database for this product yet. Use the tool above to add variants.
                        </div>
                      ) : (
                        <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-xs bg-white">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-zinc-50 uppercase tracking-wider text-zinc-500 border-b border-zinc-150">
                                <th className="p-3 font-bold">Age Group</th>
                                <th className="p-3 font-bold">Size</th>
                                <th className="p-3 font-bold">Color</th>
                                <th className="p-3 font-bold">Barcode</th>
                                <th className="p-3 font-bold">Stock</th>
                                <th className="p-3 font-bold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {editingProductVariants.map((v) => (
                                <tr key={v.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                  <td className="p-3 font-bold uppercase text-zinc-900">{v.age_group}</td>
                                  <td className="p-3 font-mono font-bold text-zinc-700 bg-zinc-50">{v.size === null ? '(no size)' : v.size}</td>
                                  <td className="p-3">
                                    <select
                                      value={v.color || ''}
                                      onChange={async (e) => {
                                        const newColor = e.target.value || null;
                                        await supabase.from('product_variants').update({ color: newColor }).eq('id', v.id);
                                        setEditingProductVariants(prev => prev.map(x => x.id === v.id ? { ...x, color: newColor } : x));
                                      }}
                                      className="text-[10px] font-bold border border-zinc-200 rounded p-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                    >
                                      <option value="">- None -</option>
                                      {(editingProduct.colors || []).map((c: any) => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-[var(--primary-color)]">{v.barcode}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const newQty = Math.max(0, (v.stock_quantity || 0) - 1);
                                          await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', v.id);
                                          setEditingProductVariants(prev => prev.map(x => x.id === v.id ? { ...x, stock_quantity: newQty } : x));
                                        }}
                                        className="w-6 h-6 bg-zinc-200 hover:bg-zinc-300 rounded font-bold text-zinc-700 flex items-center justify-center text-sm cursor-pointer"
                                      >-</button>
                                      <input
                                        type="number"
                                        value={v.stock_quantity || 0}
                                        onChange={async (e) => {
                                          const newQty = Math.max(0, parseInt(e.target.value) || 0);
                                          setEditingProductVariants(prev => prev.map(x => x.id === v.id ? { ...x, stock_quantity: newQty } : x));
                                        }}
                                        onBlur={async (e) => {
                                          const newQty = Math.max(0, parseInt(e.target.value) || 0);
                                          await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', v.id);
                                        }}
                                        className="w-16 text-center p-1 border border-zinc-200 rounded text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const newQty = (v.stock_quantity || 0) + 1;
                                          await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', v.id);
                                          setEditingProductVariants(prev => prev.map(x => x.id === v.id ? { ...x, stock_quantity: newQty } : x));
                                        }}
                                        className="w-6 h-6 bg-zinc-200 hover:bg-zinc-300 rounded font-bold text-zinc-700 flex items-center justify-center text-sm cursor-pointer"
                                      >+</button>
                                      <span className="text-[9px] text-zinc-400 uppercase tracking-widest">units</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVariant(v.id)}
                                      className="text-red-600 hover:text-red-800 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left flex-1">
                    {editStatus === 'error' && editErrorMessage && (
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                        ERROR: {editErrorMessage}
                      </p>
                    )}
                    {editStatus === 'success' && (
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                        Product updated successfully!
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 justify-end">
                    <button 
                      onClick={() => { setEditingProduct(null); setOriginalProduct(null); setEditStatus('idle'); setEditErrorMessage(null); }}
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
                      disabled={isUploading || editStatus === 'saving'}
                      className={`px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[var(--primary-color)] transition-all shadow-lg shadow-zinc-900/10 flex items-center gap-2 ${(isUploading || editStatus === 'saving') ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isUploading || editStatus === 'saving' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'gift-cards' && (
            <motion.div
              key="gift-cards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <GiftCardsAdmin />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ReportsPage />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

