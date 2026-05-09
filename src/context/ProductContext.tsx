import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

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
      await fetchFeaturedProducts();
      // Also fetch a small batch of all products to have some local cache
      try {
        const response = await fetch(`/api/products?limit=20&fields=${LIST_FIELDS}`);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const result = await response.json();
        if (result.data) mergeProducts(result.data);
      } catch (e) {
        console.error('Initial product fetch error:', e);
      }
    };
    init();
  }, []);

  const LIST_FIELDS = 'id,name,price,category,submenu,submenus,image,images,isNewArrival,isOnSale,isFeatured,salePrice,colors';

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products?isFeatured=true&limit=8&fields=${LIST_FIELDS}`);
      if (!response.ok) throw new Error(`Featured fetch failed: ${response.statusText}`);
      const result = await response.json();
      const featuredData = result.data || [];
      
      if (featuredData.length > 0) {
        mergeProducts(featuredData);
      }
    } catch (e) {
      console.error('Featured fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdminProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/products?limit=1000');
      if (!response.ok) throw new Error(`Admin fetch failed: ${response.statusText}`);
      const result = await response.json();
      const data = result.data || [];
      
      if (data && Array.isArray(data)) {
        mergeProducts(data);
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
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
      
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error(`Category fetch failed: ${response.statusText}`);
      const result = await response.json();
      const allFetched = result.data || [];
      
      mergeProducts(allFetched);
    } catch (e) {
      console.error('Categorized fetch error:', e);
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
      if (!response.ok) throw new Error('Not found');
      return await response.json();
    } catch (e) {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add product');
      }
      const newProduct = await response.json();
      setProducts(prev => [...prev, { ...productData as any, ...newProduct }]);
    } catch (e) {
      console.error('Failed to add product', e);
      throw e;
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }
      const data = await response.json();
      setProducts(prev => prev.map(p => p.id === (data.id || updatedProduct.id) ? { ...updatedProduct, ...data } : p));
    } catch (e) {
      console.error('Failed to update product', e);
      throw e;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Failed to delete product', e);
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
