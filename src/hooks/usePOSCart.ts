import { useState, useMemo } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number; // Current modified unit price
  originalPrice: number; // Original unit price
  quantity: number;
  category: string;
  discountPercent?: number; // percentage (0 - 100)
  isOnSale?: boolean;
  salePrice?: number;
}

export function usePOSCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isTaxExempt, setIsTaxExempt] = useState(false);

  const addItem = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      // If the product is on sale on the site, use the sale price as the default active unit price in POS
      const activePrice = product.isOnSale && product.salePrice ? product.salePrice : product.price;
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: activePrice, 
        originalPrice: product.price, 
        quantity: 1, 
        category: product.category,
        discountPercent: 0,
        isOnSale: product.isOnSale,
        salePrice: product.salePrice
      }];
    });
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateItemPrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, price: Math.max(0, newPrice) } : item));
  };

  const updateItemDiscount = (id: string, discountPercent: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, discountPercent: Math.max(0, Math.min(100, discountPercent)) } : item));
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item));
  };

  const clearCart = () => {
    setCart([]);
    setIsTaxExempt(false);
  };

  const totalDiscount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const discount = (item.price * (item.discountPercent || 0) / 100) * item.quantity;
      return sum + discount;
    }, 0);
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const discountedPrice = item.price * (1 - (item.discountPercent || 0) / 100);
      return sum + (discountedPrice * item.quantity);
    }, 0);
  }, [cart]);

  const hst = isTaxExempt ? 0 : subtotal * 0.13;
  const grandTotal = subtotal + hst;

  return { 
    cart, 
    addItem, 
    removeItem, 
    updateItemPrice, 
    updateItemDiscount, 
    updateItemQuantity,
    clearCart, 
    subtotal, 
    totalDiscount,
    hst, 
    grandTotal,
    isTaxExempt,
    setIsTaxExempt
  };
}

