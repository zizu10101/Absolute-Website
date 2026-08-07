import { useState, useMemo } from 'react';

export interface ItemDiscount {
  type: 'percent' | 'fixed' | 'newprice';
  value: number; // percent (0-100), a flat $ amount off the unit price, or the new unit price when type is 'newprice'
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  quantity: number;
  category: string;
  discount?: ItemDiscount; // per-item discount, applied to this line only
  isOnSale?: boolean;
  salePrice?: number;
  variantId?: string;
  size?: string;
  color?: string;
  ageGroup?: string;
  stockQuantity?: number;
  barcode?: string;
  image?: string;
  type?: string; // 'product' | 'gift_card'
  taxable?: boolean; // if false, excluded from HST calculation
}

// Per-unit $ amount removed by an item's discount (never exceeds the unit price)
export const getItemUnitDiscount = (item: CartItem): number => {
  if (!item.discount || (!item.discount.value && item.discount.type !== 'newprice')) return 0;
  const raw =
    item.discount.type === 'percent'
      ? item.price * (item.discount.value / 100)
      : item.discount.type === 'newprice'
      ? item.price - item.discount.value
      : item.discount.value;
  return Math.max(0, Math.min(item.price, raw));
};

// Human-readable label for an item's discount, e.g. "20%", "$10.00", "New Price: $190.00"
export const formatItemDiscountLabel = (discount: ItemDiscount): string => {
  if (discount.type === 'percent') return `${discount.value}%`;
  if (discount.type === 'newprice') return `New Price: $${discount.value.toFixed(2)}`;
  return `$${discount.value.toFixed(2)}`;
};

// Final per-unit price after the item's discount is applied
export const getItemDiscountedPrice = (item: CartItem): number =>
  Math.max(0, item.price - getItemUnitDiscount(item));

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
        originalPrice: product.originalPrice || product.price,
        quantity: 1,
        category: product.category || '',
        discount: undefined,
        isOnSale: product.isOnSale,
        salePrice: product.salePrice,
        size: product.size,
        color: product.color,
        ageGroup: product.ageGroup || product.age_group,
        stockQuantity: stockQty,
        barcode: product.barcode,
        image: product.image,
        type: product.type, // Preserve type (e.g., 'gift_card')
        taxable: product.taxable !== false, // Preserve taxable flag, default to true
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

  const updateItemDiscount = (id: string, itemDiscount: ItemDiscount | null) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (!itemDiscount) return { ...item, discount: undefined };
        const value =
          itemDiscount.type === 'percent'
            ? Math.max(0, Math.min(100, itemDiscount.value))
            : itemDiscount.type === 'newprice'
            ? Math.max(0, Math.min(item.price, itemDiscount.value))
            : Math.max(0, itemDiscount.value);
        return { ...item, discount: { type: itemDiscount.type, value } };
      })
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
      cart.reduce((sum, item) => sum + getItemUnitDiscount(item) * item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, item) => sum + getItemDiscountedPrice(item) * item.quantity, 0),
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

  // Calculate taxable subtotal (exclude non-taxable items like gift cards)
  const taxableSubtotal = useMemo(
    () => {
      const taxableItems = cart.filter(item => item.taxable !== false);
      if (taxableItems.length < cart.length) {
      }
      return cart.reduce((sum, item) => {
        const isTaxable = item.taxable !== false; // Default to taxable if not specified
        if (!isTaxable) return sum; // Skip non-taxable items
        return sum + getItemDiscountedPrice(item) * item.quantity;
      }, 0);
    },
    [cart]
  );

  // Only apply discount to taxable portion
  const taxableDiscountAmount = useMemo(() => {
    if (!discount || taxableSubtotal === 0) return 0;
    if (discount.type === 'percentage') {
      return taxableSubtotal * (discount.value / 100);
    }
    return Math.max(0, taxableSubtotal - discount.value);
  }, [taxableSubtotal, discount]);

  const taxableSubtotalAfterDiscount = taxableSubtotal - taxableDiscountAmount;
  const hst = isTaxExempt ? 0 : taxableSubtotalAfterDiscount * 0.13;
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
