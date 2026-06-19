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
  brand?: string;
  product_code?: string;
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
  const { showSizes, ...rest } = p;
  const dbProduct = { ...rest };
  if (showSizes !== undefined) {
    dbProduct.show_sizes = showSizes;
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
      const productMap = new Map<string, Product>(prev.map(p => [p.id, p] as [string, Product]));
      mapped.forEach(p => {
        const existing = productMap.get(p.id);
        // Preserve cached colors if fresh data has none (prevents race-condition wipe)
        if (existing?.colors && existing.colors.length > 0 && !p.colors) {
          productMap.set(p.id, { ...p, colors: existing.colors });
        } else {
          productMap.set(p.id, p);
        }
      });
      return Array.from(productMap.values());
    });
  };

  useEffect(() => {
    // Pre-fetch some initial products to speed up first interactions
    const init = async () => {
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
            
      const { data, error } = await supabase
        .from('products')
        .select('id,name,price,category,submenu,submenus,isNewArrival,isOnSale,isFeatured,salePrice,description,image,is_online,show_sizes,colors')
        .order('name', { ascending: true })
        .limit(1000);


      if (error) throw error;

      if (data) {
        setProducts((data as any[] as Product[]).map(mapProductFromDb));
        setHasMoreProducts(data.length === 1000);
      }
    } catch (e) {
      console.warn('Direct Supabase admin fetch failed:', e);
      // No /api/ fallback - use direct Supabase only for Vercel compatibility
      throw e;
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

      // Normalize the same way ProductGridPage does
      const normalize = (s: string) => s.trim().toLowerCase().replace(/-/g, ' ');
      const normalizedCategory = category ? normalize(category) : null;
      const normalizedSubmenu = submenu ? normalize(submenu) : null;

      // Fetch ALL products without filters, then filter client-side with proper normalization
      const { data, error } = await supabase.from('products').select('*').order('name');

      if (error) throw error;

      if (data) {
        let filtered = data;

        // Apply category filter client-side with proper normalization
        if (normalizedCategory && normalizedCategory !== 'all') {
          const beforeCategory = filtered.length;
          filtered = filtered.filter(p => {
            const productCat = (p.category || '').trim().toLowerCase().replace(/-/g, ' ');
            const matches = productCat === normalizedCategory;
            return matches;
          });
        }

        // Apply submenu filter client-side with proper normalization
        if (normalizedSubmenu) {
          const beforeSubmenu = filtered.length;
          filtered = filtered.filter(p => {
            const productSubmenu = p.submenu ? normalize(p.submenu) : null;
            const hasLegacyMatch = productSubmenu === normalizedSubmenu;
            const hasArrayMatch = Array.isArray(p.submenus) && p.submenus.some(s => normalize(s) === normalizedSubmenu);
            const matches = hasLegacyMatch || hasArrayMatch;
            return matches;
          });
        }


        const freshMapped = filtered.map(mapProductFromDb);
        setProducts(prev => {
          const productMap = new Map<string, Product>(prev.map(p => [p.id, p] as [string, Product]));
          freshMapped.forEach(p => {
            const existing = productMap.get(p.id);
            // Preserve cached colors if fresh data has none (prevents race-condition wipe)
            if (existing?.colors && existing.colors.length > 0 && !p.colors) {
              productMap.set(p.id, { ...p, colors: existing.colors });
            } else {
              productMap.set(p.id, p);
            }
          });
          return Array.from(productMap.values());
        });
      } else {
      }
    } catch (e) {
      console.error('Failed to fetch products from Supabase:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductById = async (id: string): Promise<Product | null> => {
    try {
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
      // Check for duplicate by product code first (if provided)
      if (payload.product_code?.trim()) {
        const { data: codeExists, error: codeCheckErr } = await supabase
          .from('products')
          .select('id, name, product_code')
          .eq('product_code', payload.product_code.trim())
          .maybeSingle();

        if (!codeCheckErr && codeExists) {
          const error = new Error(
            `Product code "${payload.product_code}" is already used by "${codeExists.name}". ` +
            `Please use a different code or edit the existing product.`
          );
          (error as any).isDuplicate = true;
          throw error;
        }
      }

      // Check for duplicate product (same name + category)
      const { data: existing, error: checkErr } = await supabase
        .from('products')
        .select('id, name, category')
        .ilike('name', payload.name.trim())
        .eq('category', payload.category)
        .maybeSingle();

      if (checkErr) {
        console.error('Duplicate check failed:', checkErr);
      } else if (existing) {
        const error = new Error(
          `A product named "${payload.name}" already exists in the "${payload.category}" category. ` +
          `Please edit the existing product instead.`
        );
        (error as any).isDuplicate = true;
        throw error;
      }

      // Insert new product
      const { data, error } = await supabase.from('products').insert([payload]).select().single();

      // Handle unique constraint error
      if (error?.code === '23505') {
        const err = new Error('A product with this name and category already exists.');
        (err as any).isDuplicate = true;
        throw err;
      }

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
      brand: rest.brand,
      product_code: rest.product_code,
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
      // Check for duplicate product code on update (if code changed)
      if (payload.product_code?.trim()) {
        const { data: codeExists } = await supabase
          .from('products')
          .select('id, name, product_code')
          .eq('product_code', payload.product_code.trim())
          .neq('id', id)
          .maybeSingle();

        if (codeExists) {
          const error = new Error(
            `Product code "${payload.product_code}" is already used by "${codeExists.name}". ` +
            `Please use a different code or edit that product.`
          );
          (error as any).isDuplicate = true;
          throw error;
        }
      }

      // Direct Supabase call - works on Vercel where /api/ endpoints don't exist
      const { data, error } = await supabase
        .from('products')
        .update({
          name: payload.name,
          price: payload.price,
          category: payload.category,
          brand: payload.brand,
          product_code: payload.product_code,
          description: payload.description,
          image: payload.image,
          images: payload.images,
          is_online: payload.is_online,
          isFeatured: payload.isFeatured,
          isNewArrival: payload.isNewArrival,
          isOnSale: payload.isOnSale,
          salePrice: payload.salePrice,
          submenu: payload.submenu,
          submenus: payload.submenus,
          show_sizes: payload.show_sizes,
          release_date: payload.release_date,
          colors: payload.colors
        })
        .eq('id', id)
        .select();


      if (error) {
        console.error('UPDATE FAILED:', error);
        throw error;
      }

      const updatedData = data && data.length > 0 ? data[0] : null;
      if (!updatedData) {
        console.error('UPDATE ERROR: No data returned after update');
        throw new Error('Update returned no data - may be RLS policy issue');
      }

      const mapped = mapProductFromDb(updatedData);

      setProducts(prev => {
        const updated = prev.map(p => p.id === id ? mapped : p);
        return updated;
      });

      clearProductCache();
      return mapped;
    } catch (err: any) {
      console.error('=== UPDATE PRODUCT FAILED ===');
      console.error('Error:', err);
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    // Optimistically remove from UI immediately
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
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
