import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

export interface ColorVariant {
  name: string;
  images: string[];
  price?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  submenu?: string;
  submenus?: string[];
  image: string;
  images?: string[];
  description: string;
  isNewArrival: boolean;
  isOnSale: boolean;
  isFeatured?: boolean;
  salePrice?: number;
  colors?: ColorVariant[];
  is_online?: boolean;
  showSizes?: boolean;
  release_date?: string | null;
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  hasMoreProducts: boolean;
  fetchProductsByCategory: (category?: string, submenu?: string) => Promise<void>;
  fetchAdminProducts: () => Promise<void>;
  fetchProducts: () => Promise<void>; // Alias for admin products fetch
  loadMoreAdminProducts: () => Promise<void>;
  fetchFeaturedProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product | undefined>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  resetProducts: () => Promise<void>;
  markAllProductsOnline: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const mapProductFromDb = (p: any): Product => {
  if (!p) return p;
  
  let sub: string[] = [];
  if (Array.isArray(p.submenus)) {
    sub = p.submenus;
  } else if (typeof p.submenus === 'string' && p.submenus) {
    try {
      sub = JSON.parse(p.submenus);
    } catch (_) {
      try {
        sub = p.submenus.replace(/[{}]/g, '').split(',').map((s: string) => s.trim());
      } catch (_) {
        sub = [];
      }
    }
  }

  const isOnlineValue = p.is_online !== false && p.is_online !== 0 && p.is_online !== 'false';

  let rawPrice = p.price;
  if (typeof rawPrice === 'string') {
    const parsed = parseFloat(rawPrice);
    if (!isNaN(parsed)) rawPrice = parsed;
  }
  
  let rawSalePrice = p.salePrice;
  if (typeof rawSalePrice === 'string') {
    const parsed = parseFloat(rawSalePrice);
    if (!isNaN(parsed)) rawSalePrice = parsed;
  }

  return {
    ...p,
    price: rawPrice,
    salePrice: rawSalePrice,
    submenus: sub,
    is_online: isOnlineValue,
    showSizes: p.show_sizes === true || p.show_sizes === 'true' || p.show_sizes === 1 || p.showSizes === true,
    release_date: p.release_date || null
  };
};

export const mapProductToDb = (p: any): any => {
  if (!p) return p;
  const dbProduct = { ...p };
  if (p.showSizes !== undefined) {
    dbProduct.show_sizes = p.showSizes;
  }
  return dbProduct;
};

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);

  const { user } = useAuth();
  const PAGE_SIZE = 500;

  const mergeProducts = (newProducts: Product[]) => {
    const mapped = newProducts.map(mapProductFromDb);
    setProducts(prev => {
      const productMap = new Map(prev.map(p => [p.id, p]));
      mapped.forEach(p => productMap.set(p.id, p));
      return Array.from(productMap.values());
    });
  };

  useEffect(() => {
    // Pre-fetch some initial products to speed up first interactions
    const init = async () => {
      console.log('ProductContext: Initializing products...');
      try {
        await fetchFeaturedProducts();
      } catch (e) {
        console.error('Initial featured products fetch failed:', e);
      }
    };
    init();
  }, [user]);

  const LIST_FIELDS = '*';
  const ADMIN_LIST_FIELDS = '*';

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('isFeatured', true)
        .limit(8);

      if (error) throw error;
      if (data && data.length > 0) {
        mergeProducts(data);
      }
    } catch (e) {
      console.warn('Featured fetch from API failed, trying direct Supabase:', e);
      try {
        const { data, error } = await supabase
          .from('products')
          .select(LIST_FIELDS === '*' ? '*' : LIST_FIELDS)
          .eq('isFeatured', true)
          .limit(8);
        
        if (error) throw error;
        if (data) mergeProducts(data as any);
      } catch (supabaseErr) {
        console.error('Direct Supabase featured fetch also failed:', supabaseErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdminProducts = async () => {
    setIsLoading(true);
    try {
      console.log('ProductContext: Fetching all admin products directly from Supabase...');
      
      const { data, error } = await supabase
        .from('products')
        .select('id,name,price,category,submenu,submenus,isNewArrival,isOnSale,isFeatured,salePrice,description,image,is_online,show_sizes')
        .order('name', { ascending: true })
        .limit(1000);

      console.log('ProductContext: Supabase fetch results', { dataLength: data?.length, error });

      if (error) throw error;

      if (data) {
        setProducts((data as any[] as Product[]).map(mapProductFromDb));
        setHasMoreProducts(data.length === 1000);
      }
    } catch (e) {
      console.warn('Direct Supabase admin fetch failed, falling back to API:', e);
      try {
        const response = await fetch(`/api/products?limit=5000&fields=${ADMIN_LIST_FIELDS}`);
        const result = await response.json();
        console.log('ProductContext: API fetch results', { resultDataLength: result.data?.length });
        if (result.data) {
          setProducts((result.data as Product[]).map(mapProductFromDb));
          setHasMoreProducts(result.data.length === PAGE_SIZE);
        }
      } catch (apiErr) {
        console.error('API admin fetch also failed:', apiErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = fetchAdminProducts;

  const loadMoreAdminProducts = async () => {
    if (isLoading || !hasMoreProducts) return;
    setIsLoading(true);
    try {
      const offset = products.length;
      console.log(`ProductContext: Loading next batch of products (Offset: ${offset})...`);
      
      const { data, error } = await supabase
        .from('products')
        .select(ADMIN_LIST_FIELDS === '*' ? '*' : ADMIN_LIST_FIELDS)
        .order('name', { ascending: true })
        .range(offset, offset + 99);
      
      if (error) throw error;
      
      if (data) {
        mergeProducts(data as any[] as Product[]);
        setHasMoreProducts(data.length === PAGE_SIZE);
      }
    } catch (e) {
      console.error('Failed to load more products:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductsByCategory = async (category?: string, submenu?: string) => {
    setIsLoading(true);
    try {
      console.log(`ProductContext: Fetching directly from database for category=${category}, submenu=${submenu}`);

      // Normalize the same way ProductGridPage does
      const normalize = (s: string) => s.trim().toLowerCase().replace(/-/g, ' ');
      const normalizedCategory = category ? normalize(category) : null;
      const normalizedSubmenu = submenu ? normalize(submenu) : null;

      // Fetch ALL products without filters, then filter client-side with proper normalization
      const { data, error } = await supabase.from('products').select('*').order('name');

      if (error) throw error;

      if (data) {
        console.log(`🔍 ProductContext: Fetched ${data.length} total products from Supabase`);
        let filtered = data;

        // Apply category filter client-side with proper normalization
        if (normalizedCategory && normalizedCategory !== 'all') {
          const beforeCategory = filtered.length;
          filtered = filtered.filter(p => {
            const productCat = (p.category || '').trim().toLowerCase().replace(/-/g, ' ');
            const matches = productCat === normalizedCategory;
            if (matches) console.log(`  ✅ Product "${p.name}" matches category "${normalizedCategory}"`);
            return matches;
          });
          console.log(`📁 ProductContext: Filtered by category="${category}" (normalized: "${normalizedCategory}"), ${beforeCategory} → ${filtered.length} products`);
        }

        // Apply submenu filter client-side with proper normalization
        if (normalizedSubmenu) {
          const beforeSubmenu = filtered.length;
          filtered = filtered.filter(p => {
            const productSubmenu = p.submenu ? normalize(p.submenu) : null;
            const hasLegacyMatch = productSubmenu === normalizedSubmenu;
            const hasArrayMatch = Array.isArray(p.submenus) && p.submenus.some(s => normalize(s) === normalizedSubmenu);
            const matches = hasLegacyMatch || hasArrayMatch;
            if (matches) console.log(`  ✅ Product "${p.name}" matches submenu "${normalizedSubmenu}" (submenu: "${p.submenu}", submenus: ${JSON.stringify(p.submenus)})`);
            return matches;
          });
          console.log(`🏷️ ProductContext: Filtered by submenu="${submenu}" (normalized: "${normalizedSubmenu}"), ${beforeSubmenu} → ${filtered.length} products`);
        }

        console.log(`✨ ProductContext: Final result: ${filtered.length} products to display`);

        const freshMapped = filtered.map(mapProductFromDb);
        setProducts(prev => {
          const productMap = new Map(prev.map(p => [p.id, p]));
          freshMapped.forEach(p => productMap.set(p.id, p));
          return Array.from(productMap.values());
        });
      } else {
        console.log(`⚠️ ProductContext: No data returned from Supabase!`);
      }
    } catch (e) {
      console.error('Failed to fetch products from Supabase:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductById = async (id: string): Promise<Product | null> => {
    try {
      console.log(`ProductContext: Fetching product by id=${id} directly from Supabase`);
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (data && !error) {
        const mapped = mapProductFromDb(data as Product);
        // update local state
        setProducts(prev => {
          const filtered = prev.filter(p => p.id !== id);
          return [...filtered, mapped];
        });
        return mapped;
      }
      if (error) throw error;
    } catch (e) {
      console.error('Failed to fetch product from Supabase:', e);
    }
    return products.find(p => p.id === id) || null;
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    const normalizePath = (p: string | undefined) => {
      if (!p) return p;
      let val = (p + '').trim();
      if (val.startsWith('http') || val.startsWith('data:')) return val;
      let normalized = val.toLowerCase();
      if (!normalized.startsWith('/')) normalized = '/' + normalized;
      return normalized;
    };
    const normalizeString = (s: string | undefined) => {
      if (!s) return s;
      return (s + '').trim().toLowerCase();
    };

    const normalizedData = {
      ...productData,
      image: normalizePath(productData.image),
      images: productData.images?.map(img => normalizePath(img)),
      category: productData.category ? (productData.category + '').trim() : '',
      submenu: normalizeString(productData.submenu),
      submenus: productData.submenus?.map(s => normalizeString(s))
    };

    const payload = mapProductToDb(normalizedData);

    try {
      const { data, error } = await supabase.from('products').insert([payload]).select().single();
      if (error) throw error;
      const mapped = mapProductFromDb(data);
      setProducts(prev => [...prev, mapped]);
      await fetchAdminProducts();
      return mapped;
    } catch (e: any) {
      console.error('Add product failed:', e);
      throw e;
    }
  };

  const clearProductCache = () => {
    // Safely clear any product search or filtration state/cache
  };

  const updateProduct = async (product: Product) => {
    const { id, ...rest } = product as any;

    const payload: any = {
      name: rest.name,
      price: rest.price,
      category: rest.category,
      submenu: rest.submenu,
      submenus: rest.submenus,
      image: rest.image,
      images: rest.images,
      description: rest.description,
      isNewArrival: rest.isNewArrival,
      isOnSale: rest.isOnSale,
      isFeatured: rest.isFeatured,
      salePrice: rest.salePrice,
      colors: rest.colors,
      show_sizes: rest.showSizes,
      is_online: rest.is_online,
      release_date: rest.release_date || null
    };

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      const { data, error } = await supabase.from('products').update(payload).eq('id', id).select('*');
      if (error) throw error;
      const updatedData = data[0];
      const mapped = mapProductFromDb(updatedData);
      setProducts(prev => prev.map(p => p.id === id ? mapped : p));
      clearProductCache();
      return mapped;
    } catch (err: any) {
      console.error('Update product failed:', err);
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    // Optimistically remove from UI immediately
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      console.log(`Product ${id} deleted successfully via Supabase`);
    } catch (e: any) {
      console.error('Delete product failed:', e);
      // Restore product list on failure
      await fetchAdminProducts();
      throw e;
    }
  };

  const resetProducts = async () => {
    setProducts([]);
    await fetchAdminProducts();
  };

  const markAllProductsOnline = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('products').update({ is_online: true }).neq('is_online', true);
      if (error) throw error;
      await fetchAdminProducts();
    } catch (err) {
      console.error('Failed to mark all online, falling back to sequential batch updating in-app:', err);
      // Fallback: update local / in-state items sequential batch updating
      for (const p of products) {
        if (!p.is_online) {
          const updated = { ...p, is_online: true };
          await updateProduct(updated);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProductContext.Provider value={{ 
      products, 
      isLoading,
      hasMoreProducts,
      fetchProductsByCategory,
      fetchAdminProducts,
      fetchProducts,
      loadMoreAdminProducts,
      fetchFeaturedProducts,
      fetchProductById,
      addProduct, 
      updateProduct, 
      deleteProduct, 
      resetProducts,
      markAllProductsOnline
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within a ProductProvider');
  return context;
};
