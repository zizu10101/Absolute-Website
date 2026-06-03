import { useState, useMemo } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  quantity: number;
  category: string;
  discountPercent?: number;
  isOnSale?: boolean;
  salePrice?: number;
  variantId?: string;
  size?: string;
  ageGroup?: string;
  stockQuantity?: number;
  barcode?: string;
  image?: string;
}

export interface Discount {
  type: 'percentage' | 'custom';
  value: number; // percentage (0-100) or custom amount
}

export function usePOSCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [discount, setDiscount] = useState<Discount | null>(null);

  // Returns an error string if the item cannot be added, null on success
  const addItem = (product: any): string | null => {
    const stockQty: number | undefined =
      product.stockQuantity !== undefined ? product.stockQuantity :
      product.stock_quantity !== undefined ? product.stock_quantity :
      undefined;

    const existing = cart.find(item => item.id === product.id);

    if (existing) {
      if (stockQty !== undefined && existing.quantity + 1 > stockQty) {
        return `Only ${stockQty} in stock`;
      }
      setCart(prev =>
        prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
      return null;
    }

    if (stockQty !== undefined && stockQty <= 0) {
      return 'Out of stock';
    }

    const activePrice =
      product.isOnSale && product.salePrice ? product.salePrice : product.price;

    setCart(prev => [
      ...prev,
      {
        id: product.id,
        variantId:
          product.variantId ||
          (product.id?.startsWith?.('var-') ? product.id.replace('var-', '') : undefined),
        name: product.name,
        price: activePrice,
        originalPrice: product.price,
        quantity: 1,
        category: product.category || '',
        discountPercent: 0,
        isOnSale: product.isOnSale,
        salePrice: product.salePrice,
        size: product.size,
        ageGroup: product.ageGroup || product.age_group,
        stockQuantity: stockQty,
        barcode: product.barcode,
        image: product.image,
      },
    ]);
    return null;
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateItemPrice = (id: string, newPrice: number) => {
    setCart(prev =>
      prev.map(item => (item.id === id ? { ...item, price: Math.max(0, newPrice) } : item))
    );
  };

  const updateItemDiscount = (id: string, discountPercent: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, discountPercent: Math.max(0, Math.min(100, discountPercent)) }
          : item
      )
    );
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setIsTaxExempt(false);
    setDiscount(null);
  };

  const applyDiscount = (discountData: Discount) => {
    setDiscount(discountData);
  };

  const removeDiscount = () => {
    setDiscount(null);
  };

  const totalDiscount = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const discount = (item.price * (item.discountPercent || 0) / 100) * item.quantity;
        return sum + discount;
      }, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const discountedPrice = item.price * (1 - (item.discountPercent || 0) / 100);
        return sum + discountedPrice * item.quantity;
      }, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    if (!discount) return 0;
    if (discount.type === 'percentage') {
      return subtotal * (discount.value / 100);
    }
    // For custom type: discount.value is the NEW TOTAL price, not the discount amount
    return Math.max(0, subtotal - discount.value);
  }, [subtotal, discount]);

  const subtotalAfterDiscount = subtotal - discountAmount;
  const hst = isTaxExempt ? 0 : subtotalAfterDiscount * 0.13;
  const grandTotal = subtotalAfterDiscount + hst;

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
    setIsTaxExempt,
    discount,
    discountAmount,
    applyDiscount,
    removeDiscount,
  };
}
