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
  fetchProductsByCategory: (category?: string, submenu?: string) => Promise<void>;
  fetchAdminProducts: () => Promise<void>;
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

  const { user } = useAuth();

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
        const response = await fetch(`${process.env.APP_URL || ''}/api/products?limit=20&fields=${LIST_FIELDS}`);
        if (!response.ok) {
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
      const response = await fetch(`${process.env.APP_URL || ''}/api/products?isFeatured=true&limit=8&fields=${LIST_FIELDS}`);
      
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
      const response = await fetch(`${process.env.APP_URL || ''}/api/products?limit=1000`);
      
      const contentType = response.headers.get('content-type');
      if (!response.ok || (contentType && contentType.includes('text/html'))) {
        throw new Error('API unavailable');
      }
      
      const result = await response.json();
      const data = result.data || [];
      
      if (data && Array.isArray(data)) {
        mergeProducts(data);
      }
    } catch (e) {
      console.warn('Admin fetch from API failed, trying direct Supabase:', e);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .limit(1000);
        
        if (error) throw error;
        if (data) mergeProducts(data as any);
      } catch (supabaseErr) {
        console.error('Direct Supabase admin fetch also failed:', supabaseErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductsByCategory = async (category?: string, submenu?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category.toLowerCase() !== 'all') params.append('category', category);
      params.append('fields', LIST_FIELDS);
      params.append('limit', '40');
      
      const response = await fetch(`${process.env.APP_URL || ''}/api/products?${params.toString()}`);
      
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

      const response = await fetch(`${process.env.APP_URL || ''}/api/products/${id}`);
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
      const response = await fetch(`${process.env.APP_URL || ''}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        console.error(`API POST request failed with status ${response.status} ${response.statusText}`);
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to add product';
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } else {
          errorMessage = await response.text();
        }
        throw new Error(errorMessage);
      }
      const newProduct = await response.json();
      setProducts(prev => [...prev, { ...productData as any, ...newProduct }]);
    } catch (e) {
      console.error('API POST failed:', e);
      throw e;
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const response = await fetch(`${process.env.APP_URL || ''}/api/products/${updatedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });
      if (!response.ok) {
        console.error(`API PUT request failed with status ${response.status} ${response.statusText}`);
        const contentType = response.headers.get('content-type');
        let errorMessage = `Failed to update product (Status: ${response.status})`;
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } else {
          errorMessage = await response.text();
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setProducts(prev => prev.map(p => p.id === (data?.id || updatedProduct.id) ? { ...updatedProduct, ...data } : p));
    } catch (e) {
      console.error('API PUT failed:', e);
      throw e;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`${process.env.APP_URL || ''}/api/products/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        console.error(`API DELETE request failed with status ${response.status} ${response.statusText}`);
        const contentType = response.headers.get('content-type');
        let errorMessage = `Failed to delete product (Status: ${response.status})`;
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } else {
          errorMessage = await response.text();
        }
        throw new Error(errorMessage);
      }
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('API DELETE failed:', e);
      throw e;
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
      fetchProductsByCategory,
      fetchAdminProducts,
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
