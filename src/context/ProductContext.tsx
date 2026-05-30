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
    showSizes: p.show_sizes === true || p.show_sizes === 'true' || p.show_sizes === 1 || p.showSizes === true
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
  const PAGE_SIZE = 1000;

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
      
      // Also fetch a small batch of all products to have some local cache
      try {
        const response = await fetch(`/api/products?limit=1000&fields=${LIST_FIELDS}`);
        const contentType = response.headers.get('content-type');
        if (!response.ok || (contentType && contentType.includes('text/html'))) {
          console.warn(`Initial product batch fetch failed: ${response.status} ${response.statusText}`);
          return;
        }
        const result = await response.json();
        console.log(`ProductContext: Fetched ${result.data?.length || 0} initial products (Mode: ${result.mode || 'unknown'})`);
        if (result.data) mergeProducts(result.data);
      } catch (e) {
        console.error('Initial product batch fetch error:', e);
      }
    };
    init();
  }, [user]);

  const LIST_FIELDS = '*';
  const ADMIN_LIST_FIELDS = '*';

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products?isFeatured=true&limit=8&fields=${LIST_FIELDS}`);
      
      // If we get index.html (SPA fallback), handle it
      const contentType = response.headers.get('content-type');
      if (!response.ok || (contentType && contentType.includes('text/html'))) {
        throw new Error('API unavailable or returned HTML');
      }
      
      const result = await response.json();
      const featuredData = result.data || [];
      
      if (featuredData.length > 0) {
        mergeProducts(featuredData);
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
        .select(ADMIN_LIST_FIELDS === '*' ? '*' : ADMIN_LIST_FIELDS)
        .order('name', { ascending: true })
        .range(0, PAGE_SIZE - 1);
      
      console.log('ProductContext: Supabase fetch results', { dataLength: data?.length, error });
      
      if (error) throw error;
      
      if (data) {
        setProducts((data as any[] as Product[]).map(mapProductFromDb));
        setHasMoreProducts(data.length === PAGE_SIZE);
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
        .range(offset, offset + PAGE_SIZE - 1);
      
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
      let query = supabase.from('products').select('*');
      if (category && category.toLowerCase() !== 'all') {
        query = query.ilike('category', category);
      }
      if (submenu) {
        query = query.or(`submenu.ilike.${submenu},submenus.cs.{${submenu}}`);
      }
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      if (data) {
        const freshMapped = data.map(mapProductFromDb);
        setProducts(prev => {
          const productMap = new Map(prev.map(p => [p.id, p]));
          freshMapped.forEach(p => productMap.set(p.id, p));
          return Array.from(productMap.values());
        });
      }
    } catch (e) {
      console.warn('Direct Supabase fetch failed, trying API route as fallback:', e);
      try {
        const params = new URLSearchParams();
        if (category && category.toLowerCase() !== 'all') params.append('category', category);
        if (submenu) params.append('submenu', submenu);
        params.append('fields', LIST_FIELDS);
        
        const response = await fetch(`/api/products?${params.toString()}`);
        
        const contentType = response.headers.get('content-type');
        if (!response.ok || (contentType && contentType.includes('text/html'))) {
          throw new Error('API unavailable');
        }
        
        const result = await response.json();
        const allFetched = result.data || [];
        
        mergeProducts(allFetched);
      } catch (fallbackErr) {
        console.error('API categorized lookup also failed:', fallbackErr);
      }
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
      console.warn('API GET product by id failed, falling back to API:', e);
      try {
        const response = await fetch(`/api/products/${id}`);
        if (!response.ok || (response.headers.get('content-type') && response.headers.get('content-type')!.includes('text/html'))) {
          throw new Error('API unavailable or returned HTML');
        }
        const raw = await response.json();
        const mapped = mapProductFromDb(raw);
        setProducts(prev => {
          const filtered = prev.filter(p => p.id !== id);
          return [...filtered, mapped];
        });
        return mapped;
      } catch (err) {
        console.error('Direct Supabase and API GET product also failed:', err);
      }
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

    // Serialize is_online to submenus properly and strip it out for table schema safety
    const payload = mapProductToDb(normalizedData);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || errPayload.error || `API failed: ${response.status}`);
      }
      const newProduct = await response.json();
      const mapped = mapProductFromDb({ ...productData as any, ...newProduct });
      setProducts(prev => [...prev, mapped]);
      await fetchAdminProducts();
      return mapped;
    } catch (e: any) {
      console.warn('API add product failed:', e);
      if (e.message?.includes('RLS') || e.message?.includes('row-level security')) {
        throw e;
      }
      try {
        console.log('Trying direct Supabase fallback...');
        const allowedColumns = [
          'name', 'price', 'category', 'submenu', 'submenus', 'image', 'images', 
          'description', 'isNewArrival', 'isOnSale', 'isFeatured', 'salePrice', 'colors', 'is_online', 'show_sizes'
        ];
        const cleanPayload: any = {};
        for (const col of allowedColumns) {
          if (payload[col] !== undefined) {
            cleanPayload[col] = payload[col];
          }
        }
        const { data, error } = await supabase.from('products').insert([cleanPayload]).select();
        if (error) throw error;
        const insertedProduct = data && data.length > 0 ? data[0] : null;
        if (insertedProduct) {
          const mapped = mapProductFromDb(insertedProduct as Product);
          setProducts(prev => [...prev, mapped]);
          await fetchAdminProducts();
          return mapped;
        }
      } catch (supErr: any) {
        console.error('Direct Supabase add product also failed:', supErr);
        throw supErr;
      }
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
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
      ...updatedProduct,
      image: normalizePath(updatedProduct.image),
      images: updatedProduct.images?.map(img => normalizePath(img)),
      category: updatedProduct.category ? (updatedProduct.category + '').trim() : '',
      submenu: normalizeString(updatedProduct.submenu),
      submenus: updatedProduct.submenus?.map(s => normalizeString(s))
    };

    // Serialize is_online to submenus and strip column for table schema compatibility
    const payload = mapProductToDb(normalizedData);

    try {
      const response = await fetch(`/api/products/${updatedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || errPayload.error || `API failed: ${response.status}`);
      }
      const data = await response.json();
      setProducts(prev => prev.map(p => p.id === (data?.id || updatedProduct.id) ? mapProductFromDb({ ...updatedProduct, ...data }) : p));
      await fetchAdminProducts();
    } catch (e: any) {
      console.warn('API update product failed:', e);
      if (e.message?.includes('RLS') || e.message?.includes('row-level security')) {
        throw e;
      }
      try {
        console.log('Trying direct Supabase fallback...');
        const { id } = payload;
        const allowedColumns = [
          'name', 'price', 'category', 'submenu', 'submenus', 'image', 'images', 
          'description', 'isNewArrival', 'isOnSale', 'isFeatured', 'salePrice', 'colors', 'is_online', 'show_sizes'
        ];
        const cleanPayload: any = {};
        for (const col of allowedColumns) {
          if (payload[col] !== undefined) {
            cleanPayload[col] = payload[col];
          }
        }
        const { data, error } = await supabase.from('products').update(cleanPayload).eq('id', id).select();
        if (error) throw error;
        const updatedProduct = data && data.length > 0 ? data[0] : null;
        setProducts(prev => prev.map(p => p.id === id ? mapProductFromDb({ ...updatedProduct, ...(updatedProduct || {}) }) : p));
        await fetchAdminProducts();
      } catch (supErr: any) {
        console.error('Direct Supabase update product also failed:', supErr);
        throw supErr;
      }
    }
  };

  const deleteProduct = async (id: string) => {
    // Optimistically remove from UI immediately
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || errPayload.error || `API failed: ${response.status}`);
      }
      console.log(`Product ${id} deleted successfully via API`);
    } catch (e: any) {
      console.warn('API delete product failed:', e);
      if (e.message?.includes('RLS') || e.message?.includes('row-level security')) {
        // Restore product list if we can't delete due to permissions
        await fetchAdminProducts();
        throw e;
      }
      try {
        console.log('Trying direct Supabase fallback...');
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
      } catch (supErr: any) {
        console.error('Direct Supabase delete product also failed:', supErr);
        await fetchAdminProducts();
        throw supErr;
      }
    }
  };

  const resetProducts = async () => {
    setProducts([]);
    await fetchAdminProducts();
  };

  const markAllProductsOnline = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/products-mark-all-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`);
      }
      await fetchAdminProducts();
    } catch (err) {
      console.error('Failed to mark all online via API, falling back to sequential batch updating in-app:', err);
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
