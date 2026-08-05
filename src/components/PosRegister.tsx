import React, { useState, useEffect, useMemo, useRef } from 'react';
import Barcode from 'react-barcode';
import { useProducts, mapProductFromDb } from '../context/ProductContext';
import { useCustomers } from '../context/CustomerContext';
import { usePOSCart, CartItem, Discount } from '../hooks/usePOSCart';
import { supabase } from '../supabase';
import { PosDiscountModal } from './PosDiscountModal';
import {
  Search,
  Trash2,
  Receipt,
  RotateCcw,
  X,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Plus,
  AlertTriangle,
  ScanLine,
  Printer,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Receipt {
  transactionId?: string;
  method: string;
  items: CartItem[];
  subtotal: number;
  hst: number;
  total: number;
  isTaxExempt: boolean;
  customer?: any;
  time: string;
  tenderedAmount?: number;
  changeGiven?: number;
}

type PosTab = 'register' | 'history' | 'customers';

interface PosRegisterProps {
  posTab?: PosTab;
  setPosTab?: (tab: PosTab) => void;
}

export const PosRegister: React.FC<PosRegisterProps> = ({ posTab = 'register', setPosTab }) => {
  const {
    products: contextProducts,
    loadMoreAdminProducts,
    hasMoreProducts,
    isLoading: isContextLoading,
  } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    club_affinity: '',
  });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Barcode scanner
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeSuccess, setBarcodeSuccess] = useState<string | null>(null);

  // Receipt after checkout
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Cash calculator state
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);

  const resetCustomerForm = () => {
    setCustomerForm({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' });
    setFormError(null);
  };

  const handleAddCustomer = async () => {
    setFormError(null);
    if (!customerForm.first_name || !customerForm.last_name) {
      setFormError('First and Last name are required.');
      return;
    }
    setIsAddingCustomer(true);
    try {
      const payload = {
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        club_affinity: customerForm.club_affinity.trim() || null,
      };
      const result = await apiPost('/api/customers', payload);
      await fetchCustomers();
      if (result?.data && result.data[0]) {
        const newCustomer = result.data[0];
        setSelectedCustomerId(newCustomer.id);
        setCustomerSearchTerm(`${newCustomer.first_name} ${newCustomer.last_name}`);
      }
      resetCustomerForm();
      setIsCustomerModalOpen(false);
    } catch (e: any) {
      setFormError('Failed to register customer: ' + e.message);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const filteredCustomers = safeCustomers.filter(c =>
    `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`
      .toLowerCase()
      .includes(customerSearchTerm.toLowerCase())
  );

  const {
    cart,
    addItem,
    removeItem,
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
  } = usePOSCart();

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  type TabId = 'ALL' | 'FOOTWEAR' | 'KITS' | 'BALLS' | 'EQUIPMENT' | 'TEAMWEAR' | 'GLOVES';
  const [activeTab, setActiveTab] = useState<TabId>('ALL');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchAllPosProducts = async () => {
      setIsLoadingAll(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .limit(1000);
        if (error) throw error;
        if (data && data.length > 0) {
          if (active) setAllProducts(data.map(mapProductFromDb));
        } else {
          throw new Error('No products from Supabase');
        }
      } catch {
        if (active && contextProducts.length > 0) setAllProducts(contextProducts);
      } finally {
        if (active) setIsLoadingAll(false);
      }
    };
    fetchAllPosProducts();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (contextProducts && contextProducts.length > 0) {
      setAllProducts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        contextProducts.forEach(p => map.set(p.id, p));
        return Array.from(map.values());
      });
    }
  }, [contextProducts]);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-focus barcode input on mount, unless modals are open
  useEffect(() => {
    if (!isCheckoutOpen && !isCustomerModalOpen && !isDiscountModalOpen) {
      barcodeInputRef.current?.focus();
    }
  }, [isCheckoutOpen, isCustomerModalOpen, isDiscountModalOpen]);

  // â”€â”€ Barcode scanner handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBarcodeScan = async (rawBarcode: string) => {
    const barcode = rawBarcode.trim().toUpperCase();
    if (!barcode) return;
    setBarcodeError(null);
    setBarcodeSuccess(null);

    try {
      // Try exact match first, fall back to case-insensitive
      let variantData: any = null;
      const { data: exact } = await supabase
        .from('product_variants')
        .select('*, products(*)')
        .eq('barcode', barcode)
        .maybeSingle();

      if (exact) {
        variantData = exact;
      } else {
        const { data: fuzzy } = await supabase
          .from('product_variants')
          .select('*, products(*)')
          .ilike('barcode', barcode)
          .maybeSingle();
        variantData = fuzzy;
      }

      if (!variantData) {
        setBarcodeError(`No product found for barcode: ${barcode}`);
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      const variant = variantData;
      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      if (!product) {
        setBarcodeError('Product data missing for this barcode');
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      const stock = variant.stock_quantity ?? 0;
      if (stock <= 0) {
        const sizeText = variant.size ? ` - Size ${variant.size}` : '';
        setBarcodeError(
          `OUT OF STOCK - ${product.name}${sizeText}`
        );
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      const cartItem = {
        id: `var-${variant.id}`,
        variantId: variant.id,
        name: product.name,
        price: product.isOnSale && product.salePrice ? product.salePrice : (product.price ?? 0),
        originalPrice: product.price ?? 0,
        category: product.category || '',
        isOnSale: product.isOnSale,
        salePrice: product.salePrice,
        image: product.image,
        size: variant.size,
        ageGroup: variant.age_group,
        stockQuantity: stock,
        barcode: variant.barcode,
      };

      const addError = addItem(cartItem);
      if (addError) {
        setBarcodeError(addError);
        setTimeout(() => setBarcodeError(null), 4000);
      } else {
        const sizeText = variant.size ? ` - Sz ${variant.size}` : '';
        setBarcodeSuccess(`Added: ${product.name}${sizeText}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
      }
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      setBarcodeError('Error looking up barcode - check connection');
      setTimeout(() => setBarcodeError(null), 4000);
    } finally {
      setBarcodeInput('');
      // Only re-focus barcode input if no modals are open
      if (!isCheckoutOpen && !isCustomerModalOpen && !isDiscountModalOpen) {
        setTimeout(() => barcodeInputRef.current?.focus(), 60);
      }
    }
  };


  const apiPost = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch {
      throw new Error(`Server error (${res.status}): unexpected response`);
    }
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  };

  const getStockCount = (product: any) => {
    if (product.stock !== undefined) return product.stock;
    if (product.inventory_quantity !== undefined) return product.inventory_quantity;
    return '-';
  };

  const matchesCategory = (p: any, tab: TabId) => {
    if (tab === 'ALL') return true;
    const cat = (p.category || '').trim().toLowerCase();
    const sub = (p.submenu || '').trim().toLowerCase();
    const name = (p.name || '').trim().toLowerCase();
    const subs: string[] = Array.isArray(p.submenus) ? p.submenus.map((s: string) => s.toLowerCase()) : [];

    if (tab === 'FOOTWEAR')
      return cat === 'footwear' || cat === 'footwear / boots' || sub === 'boots' || sub === 'footwear';
    if (tab === 'KITS')
      return cat === 'national teams' || cat === 'clubs' || cat === 'national team kits' || sub === 'jerseys' || sub === 'kits';
    if (tab === 'BALLS')
      return cat === 'soccer balls' || cat.includes('ball') || sub.includes('ball') || subs.some(s => s.includes('ball'));
    if (tab === 'EQUIPMENT')
      return cat === 'equipment' || cat === 'shin guards' || cat === 'accessories' || sub === 'shin guards' || sub === 'equipment' || sub === 'accessories' || sub === 'bags';
    if (tab === 'TEAMWEAR')
      return cat === 'apparel' || cat === 'training' || cat === 'teams' || ['training', 'teamwear', 'tops', 'shorts', 'hoodies', 'jackets', 'pants', 'socks', 't-shirts'].includes(sub);
    if (tab === 'GLOVES')
      return sub === 'gloves' || sub.includes('glove') || name.includes('glove') || cat.includes('glove');
    return true;
  };

  const activeProductSource = allProducts.length > 0 ? allProducts : contextProducts;
  const filteredProducts = activeProductSource.filter(p => {
    if (showOnlineOnly && p.is_online !== true) return false;
    if (!matchesCategory(p, activeTab)) return false;
    const s = searchQuery.trim().toLowerCase();
    return (
      !s ||
      (p.name || '').toLowerCase().includes(s) ||
      (p.category || '').toLowerCase().includes(s) ||
      (p.submenu || '').toLowerCase().includes(s)
    );
  });

  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // â”€â”€ Checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleConfirmSale = async (method: string) => {

    // For cash, show calculator instead of confirming immediately
    if (method === 'Cash') {
      setShowCashCalculator(true);
      setPendingPaymentMethod(method);
      setCashTendered('');
      return;
    }

    // Non-cash payment methods proceed directly
    await processPayment(method);
  };

  const processPayment = async (method: string, tenderedAmount?: number, changeGiven?: number) => {
    setIsConfirming(true);
    const cartItemsPayload = cart.map(item => ({
      ...item,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice),
    }));

    try {
      const finalTotal = Number(grandTotal.toFixed(2));
      const customerId = selectedCustomerId && selectedCustomerId.trim() !== '' ? selectedCustomerId.trim() : null;

      const payload: any = {
        customer_id: customerId,
        total_amount: finalTotal,
        total_price: finalTotal,
        method,
        payment_method: method,
        status: 'completed',
        items: cartItemsPayload,
        created_at: new Date().toISOString(),
        discount: discount ? { type: discount.type, value: discount.value } : null,
        discount_amount: discountAmount > 0 ? Number(discountAmount.toFixed(2)) : 0,
      };

      // Add cash-specific fields
      if (method === 'Cash' && tenderedAmount !== undefined) {
        payload.tendered_amount = Number(tenderedAmount.toFixed(2));
        payload.change_given = Number((changeGiven || 0).toFixed(2));
      }

      // Save transaction via API (RLS blocks direct anon insert)
      const result = await apiPost('/api/transactions', payload);

      // Deduct stock for each variant-tracked cart item
      for (const item of cart) {
        const variantId =
          item.variantId ||
          (item.id.startsWith('var-') ? item.id.replace('var-', '') : null);
        if (variantId) {
          try {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', variantId)
              .single();
            if (variant) {
              const newQty = Math.max(0, (variant.stock_quantity || 0) - (item.quantity || 1));
              await supabase
                .from('product_variants')
                .update({ stock_quantity: newQty })
                .eq('id', variantId);
            }
          } catch (err) {
            console.error('Stock deduction error for variant', variantId, err);
          }
        }
      }

      setReceipt({
        transactionId: result?.data?.[0]?.id,
        method,
        items: [...cart],
        subtotal,
        hst,
        total: grandTotal,
        isTaxExempt,
        customer: safeCustomers.find(c => c.id === selectedCustomerId),
        time: new Date().toLocaleString(),
        tenderedAmount,
        changeGiven,
      });

      // Close cash calculator if it was open
      setShowCashCalculator(false);
      setCashTendered('');
      setPendingPaymentMethod(null);
    } catch (e: any) {
      console.error('Failed to confirm sale:', e);
      alert('Sale failed: ' + e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleNewTransaction = () => {
    clearCart();
    setSelectedCustomerId('');
    setCustomerSearchTerm('');
    setIsCheckoutOpen(false);
    setReceipt(null);
    setIsDiscountModalOpen(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#f9f9f9] relative select-none rounded-xl overflow-hidden shadow-inner border border-zinc-200">

      {/* â”€â”€ Top controls â”€â”€ */}
      <div className="p-6 bg-white border-b border-zinc-200 space-y-4">

        {/* Barcode scanner input */}
        <div className="relative">
          <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
            barcodeError ? 'border-red-500 bg-red-50' :
            barcodeSuccess ? 'border-emerald-500 bg-emerald-50' :
            'border-zinc-900 bg-zinc-950'
          }`}>
            <ScanLine size={18} className={barcodeError ? 'text-red-500' : barcodeSuccess ? 'text-emerald-500' : 'text-[var(--primary-color)]'} />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                // Only scan on Enter if no modals are open
                if (e.key === 'Enter' && !isCheckoutOpen && !isCustomerModalOpen && !isDiscountModalOpen) {
                  handleBarcodeScan(barcodeInput);
                }
                // Allow normal text input behavior when discount modal is open
                if (isDiscountModalOpen) {
                  e.preventDefault();
                }
              }}
              onFocus={() => {
                // Don't auto-focus barcode if a modal is open
                if (isCheckoutOpen || isCustomerModalOpen || isDiscountModalOpen) {
                  barcodeInputRef.current?.blur();
                }
              }}
              placeholder="SCAN BARCODE OR TYPE AND PRESS ENTER..."
              className={`flex-1 bg-transparent text-sm font-bold tracking-widest uppercase focus:outline-none placeholder:tracking-wider placeholder:font-normal ${
                barcodeError ? 'text-red-700 placeholder:text-red-400' :
                barcodeSuccess ? 'text-emerald-700 placeholder:text-emerald-400' :
                'text-white placeholder:text-zinc-500'
              }`}
            />
            {barcodeError && (
              <span className="text-red-600 text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shrink-0">
                <AlertTriangle size={12} /> {barcodeError}
              </span>
            )}
            {barcodeSuccess && (
              <span className="text-emerald-600 text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shrink-0">
                <CheckCircle2 size={12} /> {barcodeSuccess}
              </span>
            )}
          </div>
        </div>

        {/* Customer + Search row */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Customer</label>
            <div className="flex gap-2 relative">
              <input
                type="text"
                value={customerSearchTerm}
                onChange={e => {
                  setCustomerSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  if (e.target.value === '') setSelectedCustomerId('');
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
                placeholder="Search or Select Customer..."
                className="w-full bg-zinc-50 border border-zinc-200 p-2.5 text-xs rounded font-bold uppercase tracking-wide"
              />
              {isDropdownOpen && (
                <ul className="absolute top-full left-0 right-0 bg-white border border-zinc-200 mt-1 rounded shadow-lg z-60 max-h-40 overflow-y-auto">
                  <li
                    onClick={() => { setSelectedCustomerId(''); setCustomerSearchTerm(''); setIsDropdownOpen(false); }}
                    className="p-2 text-xs cursor-pointer hover:bg-zinc-100 font-bold uppercase"
                  >
                    Guest (Anonymous)
                  </li>
                  {filteredCustomers.map(c => (
                    <li
                      key={c.id}
                      onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchTerm(`${c.first_name} ${c.last_name}`); setIsDropdownOpen(false); }}
                      className="p-2 text-xs cursor-pointer hover:bg-zinc-100"
                    >
                      {c.first_name} {c.last_name} ({c.email || 'No Email'})
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="bg-zinc-950 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary-color)] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Search Inventory</label>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="SKU or Product Name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg pl-11 pr-4 py-3 text-xs font-semibold tracking-wide focus:outline-none focus:ring-1 focus:ring-zinc-800 transition-all uppercase"
              />
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Browse Categories</label>
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <span className="text-[9.5px] font-black text-zinc-500 group-hover:text-zinc-900 transition-colors uppercase tracking-wider">Online Store Items Only</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={showOnlineOnly} onChange={e => setShowOnlineOnly(e.target.checked)} />
                <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${showOnlineOnly ? 'bg-[var(--primary-color)]' : 'bg-zinc-200'}`} />
                <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-xs transition-transform duration-200 ${showOnlineOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { id: 'ALL',       label: 'ALL',       desc: 'Entire inventory',       icon: '🏪' },
              { id: 'FOOTWEAR',  label: 'FOOTWEAR',  desc: 'Boots & cleats',         icon: '👟' },
              { id: 'KITS',      label: 'KITS',      desc: 'Jerseys & licensed',     icon: '👕' },
              { id: 'BALLS',     label: 'BALLS',     desc: 'Soccer, futsal & more',  icon: '⚽' },
              { id: 'EQUIPMENT', label: 'EQUIPMENT', desc: 'Shin guards & bags',     icon: '🛡️' },
              { id: 'TEAMWEAR',  label: 'TEAM WEAR', desc: 'Training & apparel',     icon: '🎽' },
              { id: 'GLOVES',    label: 'GLOVES',    desc: 'Goalkeeper gloves',      icon: '🧤' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all active:scale-[0.98] shrink-0 w-28 ${
                    isActive
                      ? 'bg-zinc-950 border-[var(--primary-color)] text-white shadow-md'
                      : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-base">{tab.icon}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-[var(--primary-color)] rounded-full animate-pulse" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                  <span className={`text-[8px] mt-0.5 ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>{tab.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* â”€â”€ Product grid â”€â”€ */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filteredProducts.map(p => {
            const stock = getStockCount(p);
            return (
              <div
                key={p.id}
                onClick={() => addItem(p)}
                className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between hover:border-zinc-400 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
              >
                <div className="relative aspect-[16/10] bg-zinc-50 border-b border-zinc-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1 right-1 space-y-1">
                    {p.isOnSale && p.salePrice ? (
                      <div className="bg-red-600 text-white rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide leading-none select-none shadow-xs border border-red-500">
                        <span className="line-through text-white/75 text-[7.5px]">${p.price?.toFixed(2)}</span>
                        {' '}${p.salePrice?.toFixed(2)}
                      </div>
                    ) : (
                      <div className="bg-zinc-900/90 text-white rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide leading-none select-none">
                        ${p.price?.toFixed(2)}
                      </div>
                    )}
                    {p.cost_price && (
                      <div className="bg-zinc-700/80 text-zinc-100 rounded px-1 py-0.5 text-[7px] font-bold tracking-wide leading-none select-none">
                        Cost: ${p.cost_price.toFixed(2)} | Margin: {(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between bg-zinc-50/50">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wide leading-snug line-clamp-2 min-h-[28px]">{p.name}</h3>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-block bg-zinc-200/60 text-zinc-700 px-1.5 py-0.5 rounded-[3px] text-[7px] font-bold tracking-wider uppercase">
                        QTY: {stock}
                      </span>
                      {p.isOnSale && p.salePrice && (
                        <span className="inline-block bg-red-100 text-[var(--primary-color)] border border-red-200 px-1 py-0.5 rounded-[3px] text-[7px] font-black tracking-wider uppercase">SALE</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); addItem(p); }}
                    className="w-full bg-[var(--primary-color)] text-white text-[8px] font-black py-1 rounded uppercase tracking-wider hover:bg-red-700 transition-all flex items-center justify-center gap-1 mt-2 shadow-xs active:scale-95"
                  >
                    + ADD UNIT
                  </button>
                </div>
              </div>
            );
          })}
          {hasMoreProducts && (
            <div className="col-span-full py-6 flex justify-center">
              <button
                type="button"
                onClick={async () => await loadMoreAdminProducts()}
                disabled={isContextLoading || isLoadingAll}
                className="flex items-center gap-2.5 px-8 py-3.5 bg-zinc-950 border border-zinc-800 hover:bg-black text-white rounded-lg font-black uppercase tracking-widest text-[9px] shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isContextLoading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><RefreshCw size={11} className="text-[var(--primary-color)]" /> LOAD MORE ({activeProductSource.length} loaded)</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Bottom bar â”€â”€ */}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex justify-between items-center z-30 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-0.5">ITEMS: {totalCartItemsCount}</span>
          <span className="text-xl font-black text-white tracking-wide">${grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPosTab?.('history')} className="flex items-center gap-2 px-4 py-3 border border-zinc-700 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all text-xs font-bold uppercase tracking-widest"><RotateCcw size={16} /> History</button>
          <button disabled={totalCartItemsCount === 0} onClick={() => setIsCheckoutOpen(true)} className="p-3 border border-zinc-800 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all" title="View Order"><Receipt size={18} /></button>
          <button disabled={totalCartItemsCount === 0} onClick={() => { if (confirm('Clear the active POS ticket?')) clearCart(); }} className="p-3 border border-zinc-800 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all" title="Clear Ticket"><Trash2 size={18} /></button>
          <button disabled={totalCartItemsCount === 0} onClick={() => setIsCheckoutOpen(true)} className="bg-[var(--primary-color)] hover:bg-red-700 active:scale-[0.98] text-white px-8 py-3 rounded-md text-[11px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-nowrap">
            PROCESS CHECKOUT <ArrowRight size={13} className="stroke-[3px]" />
          </button>
        </div>
      </div>

      {/* â”€â”€ Checkout drawer â”€â”€ */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-55 flex justify-end">
            <div className="flex-1" onClick={() => { if (!receipt) setIsCheckoutOpen(false); }} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative"
            >
              <div className="p-6 border-b border-zinc-150 flex justify-between items-center bg-zinc-950 text-white">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[var(--primary-color)]" />
                  <h2 className="text-xs font-black uppercase tracking-widest">
                    {receipt ? 'RECEIPT' : 'POS CHECKOUT'}
                  </h2>
                </div>
                {!receipt && (
                  <button onClick={() => setIsCheckoutOpen(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                )}
              </div>

              {receipt ? (
                /* â”€â”€ Receipt view â”€â”€ */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
                    <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-800">Sale Complete</p>
                      <p className="text-[10px] text-emerald-600 font-bold">{receipt.time} - {receipt.method}</p>
                    </div>
                  </div>

                  {receipt.transactionId && (
                    <div className="px-6 py-3 bg-white border-b border-zinc-100 flex justify-center">
                      <Barcode value={receipt.transactionId} width={1.5} height={36} fontSize={10} />
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {receipt.transactionId && (
                      <p className="text-[10px] font-mono text-zinc-500 text-center">
                        TXN: {receipt.transactionId.slice(0, 8).toUpperCase()}
                      </p>
                    )}
                    {receipt.customer && (
                      <p className="text-[10px] font-bold text-zinc-600 uppercase">
                        Customer: {receipt.customer.first_name} {receipt.customer.last_name}
                      </p>
                    )}

                    <div className="border-t border-dashed border-zinc-300 pt-3 space-y-2">
                      {receipt.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                          <div className="flex-1 pr-3">
                            <p className="font-bold text-zinc-900 uppercase leading-tight">{item.name}</p>
                            {item.size && (
                              <p className="text-zinc-400 font-medium">
                                {item.ageGroup && `${item.ageGroup} - `}Size {item.size}
                              </p>
                            )}
                            <p className="text-zinc-500">Qty {item.quantity} x ${Number(item.price).toFixed(2)}</p>
                          </div>
                          <p className="font-black text-zinc-900 shrink-0">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed border-zinc-300 pt-3 space-y-1 text-[10px] font-bold text-zinc-600">
                      <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-red-600"><span>Discount</span><span>−${discountAmount.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between"><span>HST {receipt.isTaxExempt ? '(Exempt)' : '(13%)'}</span><span>${receipt.hst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm font-black text-zinc-950 pt-1 border-t border-zinc-200">
                        <span>TOTAL</span><span>${receipt.total.toFixed(2)}</span>
                      </div>
                      {receipt.method === 'Cash' && receipt.tenderedAmount !== undefined && (
                        <>
                          <div className="flex justify-between pt-1"><span>Cash Received</span><span>${receipt.tenderedAmount.toFixed(2)}</span></div>
                          <div className="flex justify-between text-emerald-600 font-black pt-1 border-t border-emerald-200">
                            <span>Change Due</span><span>${receipt.changeGiven?.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border-t border-zinc-200 flex gap-3">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 rounded-lg py-3 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                    >
                      <Printer size={14} /> Print
                    </button>
                    <button
                      onClick={handleNewTransaction}
                      className="flex-1 bg-[var(--primary-color)] text-white rounded-lg py-3 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                    >
                      New Transaction
                    </button>
                  </div>
                </div>
              ) : (
                /* â”€â”€ Checkout form â”€â”€ */
                <>
                  <div className="p-5 border-b border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Customer</p>
                    <p className="text-xs font-bold text-zinc-800">
                      {safeCustomers.find(c => c.id === selectedCustomerId)
                        ? `${safeCustomers.find(c => c.id === selectedCustomerId)?.first_name} ${safeCustomers.find(c => c.id === selectedCustomerId)?.last_name}`
                        : 'Anonymous Walk-in'}
                    </p>
                  </div>

                  {/* Cart items */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {cart.map(item => {
                      const isLowStock = item.stockQuantity !== undefined && item.stockQuantity <= 5;
                      return (
                        <div key={item.id} className="border border-zinc-100 rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 pr-3">
                              <p className="text-[11px] font-black uppercase text-zinc-900 leading-snug">{item.name}</p>
                              {item.size && (
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
                                  {item.ageGroup && `${item.ageGroup} - `}Size {item.size}
                                </p>
                              )}
                              {item.stockQuantity !== undefined && (
                                <p className={`text-[9px] font-bold uppercase tracking-wide ${isLowStock ? 'text-amber-600' : 'text-zinc-400'}`}>
                                  {isLowStock && <AlertTriangle size={9} className="inline mr-0.5" />}
                                  Stock: {item.stockQuantity}
                                  {isLowStock && ' - LOW STOCK'}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-zinc-900 text-xs">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                              <button onClick={() => removeItem(item.id)} className="text-zinc-300 hover:text-red-600 p-1 rounded transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded border border-zinc-200 text-xs font-black hover:bg-zinc-100 flex items-center justify-center">−</button>
                            <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => {
                                if (item.stockQuantity !== undefined && item.quantity + 1 > item.stockQuantity) return;
                                updateItemQuantity(item.id, item.quantity + 1);
                              }}
                              disabled={item.stockQuantity !== undefined && item.quantity >= item.stockQuantity}
                              className="w-6 h-6 rounded border border-zinc-200 text-xs font-black hover:bg-zinc-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                            <span className="text-[9px] text-zinc-400 font-bold">x ${Number(item.price).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals + payment */}
                  <div className="p-5 bg-zinc-50 border-t border-zinc-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tax-exempt"
                        checked={isTaxExempt}
                        onChange={e => setIsTaxExempt(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="tax-exempt" className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest cursor-pointer">Tax Exempt</label>
                    </div>

                    <button
                      onClick={() => setIsDiscountModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded text-[10px] font-bold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <Percent size={14} /> {discount ? 'Edit Discount' : 'Add Discount'}
                    </button>

                    <div className="space-y-1.5 text-xs font-bold text-zinc-600">
                      <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {totalDiscount > 0 && <div className="flex justify-between text-red-600"><span>Item Discount</span><span>−${totalDiscount.toFixed(2)}</span></div>}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <button
                            onClick={removeDiscount}
                            className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1"
                          >
                            Order Discount <X size={12} />
                          </button>
                          <span>−${discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between"><span>HST {isTaxExempt ? '(Exempt)' : '(13%)'}</span><span>${hst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-200">
                        <span>Total Due</span><span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Store Credit', 'Gift Card'].map(method => {
                        return (
                        <button
                          key={method}
                          disabled={isConfirming}
                          onClick={() => {
                            handleConfirmSale(method);
                          }}
                          className="bg-white border border-zinc-200 hover:bg-zinc-100 active:scale-[0.99] text-zinc-900 p-2 rounded font-black uppercase text-[9px] flex justify-center items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                        >
                          {isConfirming ? <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" /> : method}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* â”€â”€ Cash Calculator Modal (INSIDE checkout) â”€â”€ */}
              <AnimatePresence>
                {showCashCalculator && (() => {
                  return (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6 rounded-lg">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm space-y-6">
                      <div className="text-center">
                        <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900 mb-2">Cash Payment</h2>
                        <p className="text-sm text-zinc-600 font-bold">Total Due: <span className="text-[var(--primary-color)] text-lg">${grandTotal.toFixed(2)}</span></p>
                      </div>

                      {/* Amount Tendered Input */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount Tendered</label>
                        <input
                          type="number"
                          value={cashTendered}
                          onChange={e => setCashTendered(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full p-4 text-3xl font-black text-center bg-zinc-50 border-2 border-zinc-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                          autoFocus
                        />
                      </div>

                      {/* Preset Buttons */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Quick Select</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Exact', amount: grandTotal },
                            { label: '+$5', amount: Math.ceil(grandTotal / 5) * 5 },
                            { label: '+$10', amount: Math.ceil(grandTotal / 10) * 10 },
                            { label: '+$20', amount: Math.ceil(grandTotal / 20) * 20 },
                            { label: '+$50', amount: Math.ceil(grandTotal / 50) * 50 },
                            { label: '+$100', amount: Math.ceil(grandTotal / 100) * 100 },
                          ].map(btn => (
                            <button
                              key={btn.label}
                              onClick={() => setCashTendered(btn.amount)}
                              className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded text-xs font-bold uppercase transition-colors"
                            >
                              {btn.label}
                              {btn.label !== 'Exact' && <div className="text-[9px] text-zinc-600">${btn.amount.toFixed(2)}</div>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Change Due / Amount Short Display */}
                      {cashTendered !== '' && (
                        <div className="p-4 rounded-lg text-center bg-zinc-50 border-2 border-zinc-200">
                          {cashTendered >= grandTotal ? (
                            <div>
                              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Change Due</p>
                              <p className="text-3xl font-black text-emerald-600">${(cashTendered - grandTotal).toFixed(2)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Amount Short</p>
                              <p className="text-3xl font-black text-red-600">${(grandTotal - cashTendered).toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowCashCalculator(false);
                            setCashTendered('');
                            setPendingPaymentMethod(null);
                          }}
                          className="flex-1 p-3 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold uppercase transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={cashTendered === '' || (typeof cashTendered === 'number' && cashTendered < grandTotal) || isConfirming}
                          onClick={() => {
                            if (typeof cashTendered === 'number' && pendingPaymentMethod) {
                              processPayment(pendingPaymentMethod, cashTendered, cashTendered - grandTotal);
                            }
                          }}
                          className="flex-1 p-3 bg-[var(--primary-color)] text-white rounded-lg text-xs font-bold uppercase hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {isConfirming ? 'Processing...' : 'Complete Sale'}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                  );
                })()}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Discount Modal â”€â”€ */}
      <PosDiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onApply={applyDiscount}
        currentDiscount={discount}
        subtotal={subtotal}
      />

      {/* â”€â”€ Add Customer modal â”€â”€ */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="absolute inset-0 bg-black/50 z-60 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Add New Customer</h2>
              {formError && <p className="text-red-600 text-[10px] font-bold">{formError}</p>}
              {(['first_name', 'last_name', 'email', 'phone', 'club_affinity'] as const).map(field => (
                <input
                  key={field}
                  type="text"
                  placeholder={`${field.replace('_', ' ')}${field === 'first_name' || field === 'last_name' ? ' *' : ''}`}
                  value={customerForm[field]}
                  onChange={e => setCustomerForm(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full bg-zinc-50 p-2 text-xs border rounded capitalize"
                />
              ))}
              <div className="flex gap-2">
                <button onClick={() => { setIsCustomerModalOpen(false); resetCustomerForm(); }} className="flex-1 p-2 bg-zinc-100 rounded text-xs">Cancel</button>
                <button disabled={isAddingCustomer} onClick={handleAddCustomer} className="flex-1 p-2 bg-[var(--primary-color)] text-white rounded text-xs font-bold uppercase">
                  {isAddingCustomer ? 'Adding...' : 'Save Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
