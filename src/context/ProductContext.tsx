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
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  hasMoreProducts: boolean;
  fetchProductsByCategory: (category?: string, submenu?: string) => Promise<void>;
  fetchAdminProducts: () => Promise<void>;
  loadMoreAdminProducts: () => Promise<void>;
  fetchFeaturedProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  resetProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);

  const { user } = useAuth();
  const PAGE_SIZE = 50;

  const mergeProducts = (newProducts: Product[]) => {
    setProducts(prev => {
      const productMap = new Map(prev.map(p => [p.id, p]));
      newProducts.forEach(p => productMap.set(p.id, p));
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
        const response = await fetch(`/api/products?limit=20&fields=${LIST_FIELDS}`);
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

  const LIST_FIELDS = 'id,name,price,category,submenu,submenus,image,images,isNewArrival,isOnSale,isFeatured,salePrice,colors';

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
          .select(LIST_FIELDS)
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
      console.log('ProductContext: Fetching first batch of admin products directly from Supabase...');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      
      if (error) throw error;
      
      if (data) {
        mergeProducts(data as Product[]);
        setHasMoreProducts(data.length === PAGE_SIZE);
      }
    } catch (e) {
      console.warn('Direct Supabase admin fetch failed, falling back to API:', e);
      try {
        const response = await fetch(`/api/products?limit=${PAGE_SIZE}`);
        const result = await response.json();
        if (result.data) {
          mergeProducts(result.data);
          setHasMoreProducts(result.data.length === PAGE_SIZE);
        }
      } catch (apiErr) {
        console.error('API admin fetch also failed:', apiErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreAdminProducts = async () => {
    if (isLoading || !hasMoreProducts) return;
    setIsLoading(true);
    try {
      const offset = products.length;
      console.log(`ProductContext: Loading next batch of products (Offset: ${offset})...`);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      if (data) {
        mergeProducts(data as Product[]);
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
      const params = new URLSearchParams();
      if (category && category.toLowerCase() !== 'all') params.append('category', category);
      if (submenu) params.append('submenu', submenu);
      params.append('fields', LIST_FIELDS);
      params.append('limit', '40');
      
      const response = await fetch(`/api/products?${params.toString()}`);
      
      const contentType = response.headers.get('content-type');
      if (!response.ok || (contentType && contentType.includes('text/html'))) {
        throw new Error('API unavailable');
      }
      
      const result = await response.json();
      const allFetched = result.data || [];
      
      mergeProducts(allFetched);
    } catch (e) {
      console.warn('Categorized fetch from API failed, trying direct Supabase:', e);
      try {
        let query = supabase.from('products').select(LIST_FIELDS);
        if (category && category.toLowerCase() !== 'all') {
          query = query.ilike('category', category);
        }
        const { data, error } = await query.limit(40);
        
        if (error) throw error;
        if (data) mergeProducts(data as any);
      } catch (supabaseErr) {
        console.error('Direct Supabase categorized fetch also failed:', supabaseErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductById = async (id: string): Promise<Product | null> => {
    try {
      // First check local state
      const local = products.find(p => p.id === id);
      if (local && local.description) return local;

      const response = await fetch(`/api/products/${id}`);
      if (!response.ok || (response.headers.get('content-type') && response.headers.get('content-type')!.includes('text/html'))) {
        throw new Error('API unavailable or returned HTML');
      }
      return await response.json();
    } catch (e) {
      console.warn('API GET product by id failed, falling back to direct Supabase:', e);
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (data && !error) return data as Product;
      } catch (err) {
        console.error('Direct Supabase GET product also failed:', err);
      }
      return products.find(p => p.id === id) || null;
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }
      const newProduct = await response.json();
      setProducts(prev => [...prev, { ...productData as any, ...newProduct }]);
    } catch (e) {
      console.warn('API add product failed, trying direct Supabase:', e);
      try {
        const { data, error } = await supabase.from('products').insert([productData]).select().single();
        if (error) throw error;
        if (data) setProducts(prev => [...prev, data as Product]);
      } catch (supErr) {
        console.error('Direct Supabase add product also failed:', supErr);
        throw supErr;
      }
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const response = await fetch(`/api/products/${updatedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });
      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }
      const data = await response.json();
      setProducts(prev => prev.map(p => p.id === (data?.id || updatedProduct.id) ? { ...updatedProduct, ...data } : p));
    } catch (e) {
      console.warn('API update product failed, trying direct Supabase:', e);
      try {
        const { id, ...rest } = updatedProduct;
        const { data, error } = await supabase.from('products').update(rest).eq('id', id).select().single();
        if (error) throw error;
        setProducts(prev => prev.map(p => p.id === id ? { ...updatedProduct, ...(data || {}) } : p));
      } catch (supErr) {
        console.error('Direct Supabase update product also failed:', supErr);
        throw supErr;
      }
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.warn('API delete product failed, trying direct Supabase:', e);
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        setProducts(prev => prev.filter(p => p.id !== id));
      } catch (supErr) {
        console.error('Direct Supabase delete product also failed:', supErr);
        throw supErr;
      }
    }
  };

  const resetProducts = async () => {
    setProducts([]);
    await fetchAdminProducts();
  };

  return (
    <ProductContext.Provider value={{ 
      products, 
      isLoading,
      hasMoreProducts,
      fetchProductsByCategory,
      fetchAdminProducts,
      loadMoreAdminProducts,
      fetchFeaturedProducts,
      fetchProductById,
      addProduct, 
      updateProduct, 
      deleteProduct, 
      resetProducts
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
