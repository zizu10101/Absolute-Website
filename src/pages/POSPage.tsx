import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Moon, Sun, LogOut, Search, Users, Percent, FileText, Trash2,
  Barcode as BarcodeIcon, DollarSign, Home, AlertCircle, X, Check,
  Receipt, RotateCcw, RefreshCw, Plus, Printer, ScanLine, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { PosTransactionHistory } from '../components/PosTransactionHistory';
import { PosCustomerManager } from '../components/PosCustomerManager';
import { POSPinEntry } from '../components/POSPinEntry';
import { PosDiscountModal } from '../components/PosDiscountModal';
import { usePOSCart, CartItem } from '../hooks/usePOSCart';
import { useCustomers, Customer } from '../context/CustomerContext';
import { supabase } from '../supabase';
import { mapProductFromDb } from '../context/ProductContext';

type CategoryTab = 'ALL' | 'FOOTWEAR' | 'KITS' | 'BALLS' | 'EQUIPMENT' | 'TEAMWEAR' | 'GLOVES';

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
}

export function POSPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Panels
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showCustomersPanel, setShowCustomersPanel] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // POS State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierName] = useState('Cashier');

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showOnlineOnly, setShowOnlineOnly] = useState(() => {
    const saved = localStorage.getItem('pos_show_online_only');
    return saved ? JSON.parse(saved) : false;
  });

  // Barcode scanner
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeSuccess, setBarcodeSuccess] = useState<string | null>(null);

  // Customer management
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' });
  const [formError, setFormError] = useState<string | null>(null);

  // Checkout
  const [isConfirming, setIsConfirming] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Void/Refund
  const [showVoidRefundModal, setShowVoidRefundModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [selectedTransactionForVoid, setSelectedTransactionForVoid] = useState<any | null>(null);

  // Hooks
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

  const { customers, fetchCustomers } = useCustomers();
  const safeCustomers = Array.isArray(customers) ? customers : [];

  // Auth
  useEffect(() => {
    const stored = sessionStorage.getItem('pos_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('pos_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('pos_show_online_only', JSON.stringify(showOnlineOnly));
  }, [showOnlineOnly]);

  // Fetch recent transactions for void/refund
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/transactions?limit=20');
        const result = await res.json();
        if (result.data) {
          setRecentTransactions(result.data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      }
    };
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [isAuthenticated]);

  // Fetch products
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .limit(1000);
        if (error) throw error;
        if (data) setProducts(data.map(mapProductFromDb));
      } catch {
        try {
          const res = await fetch('/api/products?limit=1000');
          if (res.ok) {
            const result = await res.json();
            if (result.data) setProducts(result.data.map(mapProductFromDb));
          }
        } catch (err) {
          console.error('Failed to fetch products:', err);
        }
      } finally {
        setProductsLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  // Auto-focus barcode input
  useEffect(() => {
    if (!showCheckout && !showCustomersPanel && !showDiscountModal) {
      barcodeInputRef.current?.focus();
    }
  }, [showCheckout, showCustomersPanel, showDiscountModal]);

  // Barcode scanning
  const handleBarcodeScan = async (rawBarcode: string) => {
    const barcode = rawBarcode.trim().toUpperCase();
    if (!barcode) return;
    setBarcodeError(null);
    setBarcodeSuccess(null);

    try {
      const { data: exact } = await supabase
        .from('product_variants')
        .select('*, products(*)')
        .eq('barcode', barcode)
        .maybeSingle();

      let variantData = exact;
      if (!variantData) {
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
        setBarcodeError(`OUT OF STOCK — ${product.name} · Size ${variant.size}`);
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
        quantity: 1,
      };

      const addError = addItem(cartItem);
      if (addError) {
        setBarcodeError(addError);
        setTimeout(() => setBarcodeError(null), 4000);
      } else {
        setBarcodeSuccess(`Added: ${product.name} · Sz ${variant.size}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
      }
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      setBarcodeError('Error looking up barcode');
      setTimeout(() => setBarcodeError(null), 4000);
    } finally {
      setBarcodeInput('');
      if (!showCheckout && !showCustomersPanel && !showDiscountModal) {
        setTimeout(() => barcodeInputRef.current?.focus(), 60);
      }
    }
  };

  // Category matching
  const matchesCategory = (p: any, tab: CategoryTab): boolean => {
    if (tab === 'ALL') return true;
    const cat = (p.category || '').trim().toLowerCase();
    const sub = (p.submenu || '').trim().toLowerCase();
    const name = (p.name || '').trim().toLowerCase();
    const subs: string[] = Array.isArray(p.submenus) ? p.submenus.map((s: string) => s.toLowerCase()) : [];

    if (tab === 'FOOTWEAR') return cat === 'footwear' || cat === 'footwear / boots' || sub === 'boots';
    if (tab === 'KITS') return cat === 'national teams' || cat === 'clubs' || sub === 'jerseys';
    if (tab === 'BALLS') return cat === 'soccer balls' || cat.includes('ball') || sub.includes('ball');
    if (tab === 'EQUIPMENT') return cat === 'equipment' || cat === 'shin guards' || cat === 'accessories';
    if (tab === 'TEAMWEAR') return cat === 'apparel' || cat === 'training' || ['training', 'teamwear', 'tops', 'shorts'].includes(sub);
    if (tab === 'GLOVES') return sub === 'gloves' || sub.includes('glove') || name.includes('glove');
    return true;
  };

  // Void/Refund handler
  const handleVoidRefund = async (transactionId: string, action: 'void' | 'refund') => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Failed to process request');

      alert(`Transaction ${action === 'void' ? 'voided' : 'refunded'} successfully`);
      setShowVoidRefundModal(false);

      // Refresh transactions
      const txRes = await fetch('/api/transactions?limit=20');
      const txResult = await txRes.json();
      if (txResult.data) {
        setRecentTransactions(txResult.data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (showOnlineOnly && p.is_online !== true) return false;
      if (!matchesCategory(p, activeCategory)) return false;
      const q = searchQuery.toLowerCase();
      return !q || p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    });
  }, [products, activeCategory, searchQuery, showOnlineOnly]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return safeCustomers.filter(c =>
      `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [safeCustomers, customerSearchTerm]);

  // Checkout handler
  const handleConfirmSale = async (method: string) => {
    setIsConfirming(true);
    const cartItemsPayload = cart.map(item => ({
      ...item,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice),
    }));

    try {
      const payload = {
        total_amount: Number(grandTotal.toFixed(2)),
        method,
        items: cartItemsPayload,
        customer_id: selectedCustomerId?.trim() || null,
        created_at: new Date().toISOString(),
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Failed to save transaction');

      // Deduct stock
      for (const item of cart) {
        const variantId = item.variantId || (item.id.startsWith('var-') ? item.id.replace('var-', '') : null);
        if (variantId) {
          try {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', variantId)
              .single();
            if (variant) {
              const newQty = Math.max(0, (variant.stock_quantity || 0) - (item.quantity || 1));
              await supabase.from('product_variants').update({ stock_quantity: newQty }).eq('id', variantId);
            }
          } catch (err) {
            console.error('Stock deduction error:', err);
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
      });
    } catch (e: any) {
      console.error('Checkout error:', e);
      alert('Checkout failed: ' + e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // New transaction
  const handleNewTransaction = () => {
    clearCart();
    setSelectedCustomerId('');
    setCustomerSearchTerm('');
    setShowCheckout(false);
    setReceipt(null);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Add customer
  const handleAddCustomer = async () => {
    setFormError(null);
    if (!customerForm.first_name || !customerForm.last_name) {
      setFormError('First and Last name are required.');
      return;
    }
    setIsAddingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: customerForm.first_name.trim(),
          last_name: customerForm.last_name.trim(),
          email: customerForm.email.trim() || null,
          phone: customerForm.phone.trim() || null,
          club_affinity: customerForm.club_affinity.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error);
      await fetchCustomers();
      if (result?.data?.[0]) {
        const newCustomer = result.data[0];
        setSelectedCustomerId(newCustomer.id);
        setCustomerSearchTerm(`${newCustomer.first_name} ${newCustomer.last_name}`);
      }
      setCustomerForm({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' });
      setShowCustomerModal(false);
    } catch (e: any) {
      setFormError('Failed to register customer: ' + e.message);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // Select customer
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCustomersPanel(false);
  };

  if (!isAuthenticated) {
    return <POSPinEntry onPinSubmit={() => { sessionStorage.setItem('pos_authenticated', 'true'); setIsAuthenticated(true); }} isDarkMode={isDarkMode} />;
  }

  const selectedCustomer = safeCustomers.find(c => c.id === selectedCustomerId);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f1117] text-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1a2236] border-b border-[#2d3547] px-6 py-3 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#b90014] rounded flex items-center justify-center">
            <span className="text-white font-black text-xs">AS</span>
          </div>
          <div>
            <h1 className="text-sm font-bold">Absolute Soccer</h1>
            <p className="text-[10px] text-gray-400">Mississauga</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300">{cashierName}</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-[10px] text-gray-400">Online</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 hover:bg-[#2d3547] rounded transition-colors">
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => { sessionStorage.removeItem('pos_authenticated'); setIsAuthenticated(false); }} className="p-1.5 hover:bg-[#2d3547] rounded transition-colors text-red-400">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Barcode Scanner */}
      <div className="bg-[#1a2236] border-b border-[#2d3547] px-6 py-3">
        <div className={`flex items-center gap-3 rounded-lg border-2 px-4 py-2 transition-all ${
          barcodeError ? 'border-red-500 bg-red-50/10' :
          barcodeSuccess ? 'border-green-500 bg-green-50/10' :
          'border-[#2d3547] bg-[#0f1117]'
        }`}>
          <ScanLine size={16} className={barcodeError ? 'text-red-400' : barcodeSuccess ? 'text-green-400' : 'text-gray-500'} />
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !showCheckout && !showCustomersPanel && !showDiscountModal) {
                handleBarcodeScan(barcodeInput);
              }
            }}
            placeholder="SCAN BARCODE OR TYPE AND PRESS ENTER..."
            className={`flex-1 bg-transparent text-sm font-bold uppercase focus:outline-none placeholder:text-gray-500 ${
              barcodeError ? 'text-red-400' : barcodeSuccess ? 'text-green-400' : 'text-white'
            }`}
          />
          {barcodeError && <span className="text-red-400 text-xs font-bold">{barcodeError}</span>}
          {barcodeSuccess && <span className="text-green-400 text-xs font-bold">{barcodeSuccess}</span>}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-0">
        {/* LEFT PANEL */}
        <div className="w-1/2 bg-[#0f1117] border-r border-[#2d3547] flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-[#2d3547] space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a2236] border border-[#2d3547] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#b90014]"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'ALL' as CategoryTab, label: 'ALL', icon: '🏪' },
                { id: 'FOOTWEAR' as CategoryTab, label: 'FOOTWEAR', icon: '👟' },
                { id: 'KITS' as CategoryTab, label: 'KITS', icon: '👕' },
                { id: 'BALLS' as CategoryTab, label: 'BALLS', icon: '⚽' },
                { id: 'EQUIPMENT' as CategoryTab, label: 'EQUIPMENT', icon: '🛡️' },
                { id: 'TEAMWEAR' as CategoryTab, label: 'TEAMWEAR', icon: '🎽' },
                { id: 'GLOVES' as CategoryTab, label: 'GLOVES', icon: '🧤' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                    activeCategory === tab.id
                      ? 'bg-[#b90014] text-white'
                      : 'bg-[#1a2236] text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Online Items Toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#1a2236] p-2 rounded">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={e => setShowOnlineOnly(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-300">Show Online Items Only</span>
            </label>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No products found</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredProducts.slice(0, 30).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addItem(product)}
                    className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#b90014] rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-colors group text-center min-h-28"
                  >
                    {product.image && (
                      <img src={product.image} alt={product.name} className="w-14 h-14 object-cover rounded bg-[#0f1117]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="text-[10px] font-semibold text-gray-300 group-hover:text-white line-clamp-2">
                      {product.name}
                    </span>
                    <span className="text-[10px] text-[#b90014]">${product.price?.toFixed(2) || '0.00'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Cart */}
        <div className="w-1/2 bg-[#1a2236] flex flex-col overflow-hidden">
          {/* Customer Tag */}
          {selectedCustomer && (
            <div className="px-4 py-3 border-b border-[#2d3547] bg-[#2d3547]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#b90014] rounded-full"></div>
                <div>
                  <p className="text-sm font-semibold">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  <p className="text-xs text-gray-400">Returning customer</p>
                </div>
              </div>
            </div>
          )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertCircle size={32} className="mb-2" />
                <p className="text-sm">No items in cart</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-[#0f1117] rounded-lg p-3 border border-[#2d3547] group">
                  <div className="flex gap-3">
                    {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover bg-[#2d3547]" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-semibold truncate flex-1">{item.name}</p>
                        <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-400 p-1 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="w-5 h-5 rounded border border-[#2d3547] text-xs hover:bg-[#2d3547] flex items-center justify-center">−</button>
                        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="w-5 h-5 rounded border border-[#2d3547] text-xs hover:bg-[#2d3547] flex items-center justify-center">+</button>
                      </div>
                      <p className="text-xs font-bold text-[#b90014]">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Buttons */}
          <div className="border-t border-[#2d3547] p-4 space-y-3 bg-[#0f1117]">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Item Discount</span>
                  <span>−${totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Order Discount</span>
                  <span>−${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400">
                <span>HST {isTaxExempt ? '(Exempt)' : '(13%)'}</span>
                <span>${hst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#2d3547]">
                <span>Total Due</span>
                <span className="text-lg text-[#b90014]">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowDiscountModal(true)} className="flex-1 px-3 py-2 bg-[#2d3547] hover:bg-[#3d4557] border border-[#2d3547] rounded text-[10px] font-bold text-white flex items-center justify-center gap-1">
                <Percent size={14} /> Discount
              </button>
              <button onClick={() => { if (confirm('Clear all items?')) clearCart(); }} disabled={cart.length === 0} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded text-[10px] font-bold text-white">
                Clear
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isTaxExempt} onChange={e => setIsTaxExempt(e.target.checked)} />
              <span className="text-[10px] font-bold text-gray-400">Tax Exempt</span>
            </label>

            <button
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-[#b90014] hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm uppercase"
            >
              Checkout ({totalCartItems})
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowVoidRefundModal(true)} className="py-2 bg-[#b90014] hover:bg-red-700 text-white rounded text-[10px] font-bold uppercase">
                Void/Refund
              </button>
              <button onClick={() => setShowHistoryPanel(true)} className="py-2 border border-[#2d3547] text-gray-300 hover:text-white rounded text-[10px] font-bold uppercase">
                History
              </button>
            </div>

            <button onClick={() => setShowCustomersPanel(true)} className="w-full py-2 border border-[#2d3547] text-gray-300 hover:text-white rounded text-[10px] font-bold uppercase">
              Customers
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <div className="absolute inset-0 bg-black/60 z-50 flex justify-end">
            <div className="flex-1" onClick={() => { if (!receipt) setShowCheckout(false); }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="w-96 bg-[#1a2236] h-full flex flex-col border-l border-[#2d3547]">
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between bg-[#0f1117]">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Receipt size={16} /> {receipt ? 'RECEIPT' : 'CHECKOUT'}
                </h2>
                {!receipt && <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>}
              </div>

              {receipt ? (
                /* Receipt View */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 bg-green-900/30 border-b border-green-700">
                    <p className="text-xs font-bold text-green-400">Sale Complete</p>
                    <p className="text-[10px] text-gray-400">{receipt.time} · {receipt.method}</p>
                  </div>
                  {receipt.transactionId && (
                    <div className="px-4 py-3 bg-[#0f1117] flex justify-center">
                      <Barcode value={receipt.transactionId} width={1} height={30} fontSize={10} />
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[10px]">
                    {receipt.items.map((item, i) => (
                      <div key={i} className="border-b border-[#2d3547] pb-2">
                        <p className="font-bold text-white">{item.name}</p>
                        <p className="text-gray-400">Qty {item.quantity} × ${Number(item.price).toFixed(2)}</p>
                        <p className="text-[#b90014] font-bold">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-[#2d3547] space-y-2 text-[10px]">
                    <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Discount</span><span>−${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between"><span>HST</span><span>${receipt.hst.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t border-[#2d3547] pt-2">
                      <span>TOTAL</span><span>${receipt.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="p-4 border-t border-[#2d3547] flex gap-2">
                    <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 border border-[#2d3547] rounded py-2 text-[10px] font-bold hover:bg-[#2d3547]">
                      <Printer size={12} /> Print
                    </button>
                    <button onClick={handleNewTransaction} className="flex-1 bg-[#b90014] hover:bg-red-700 rounded py-2 text-[10px] font-bold text-white">
                      New Transaction
                    </button>
                  </div>
                </div>
              ) : (
                /* Checkout Form */
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[10px]">
                    <div>
                      <p className="font-bold text-gray-400 mb-1">Customer</p>
                      <p className="text-white">{selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Anonymous'}</p>
                    </div>
                    {cart.map(item => (
                      <div key={item.id} className="border border-[#2d3547] rounded p-2">
                        <p className="font-bold text-white">{item.name}</p>
                        <p className="text-gray-400">Qty {item.quantity} × ${Number(item.price).toFixed(2)}</p>
                        <p className="text-[#b90014] font-bold">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-t border-[#2d3547] space-y-3">
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Discount</span><span>−${discountAmount.toFixed(2)}</span></div>}
                      <div className="flex justify-between"><span>HST</span><span>${hst.toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-sm border-t border-[#2d3547] pt-1"><span>Total Due</span><span>${grandTotal.toFixed(2)}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Store Credit'].map(method => (
                        <button
                          key={method}
                          disabled={isConfirming}
                          onClick={() => handleConfirmSale(method)}
                          className="bg-[#b90014] hover:bg-red-700 disabled:opacity-50 text-white p-2 rounded font-bold text-[9px] uppercase"
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Panel */}
      <AnimatePresence>
        {showHistoryPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistoryPanel(false)} className="absolute inset-0 bg-black/50 z-40" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute right-0 top-0 bottom-0 w-96 bg-[#1a2236] border-l border-[#2d3547] z-50 flex flex-col">
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between">
                <h2 className="text-sm font-bold">Order History</h2>
                <button onClick={() => setShowHistoryPanel(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-hidden"><PosTransactionHistory /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Customers Panel */}
      <AnimatePresence>
        {showCustomersPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCustomersPanel(false)} className="absolute inset-0 bg-black/50 z-40" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute right-0 top-0 bottom-0 w-96 bg-[#1a2236] border-l border-[#2d3547] z-50 flex flex-col">
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between">
                <h2 className="text-sm font-bold">Customers</h2>
                <button onClick={() => setShowCustomersPanel(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-hidden"><PosCustomerManager onSelectCustomer={handleSelectCustomer} /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Discount Modal */}
      <PosDiscountModal isOpen={showDiscountModal} onClose={() => setShowDiscountModal(false)} onApply={applyDiscount} currentDiscount={discount} subtotal={subtotal} />

      {/* Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#1a2236] p-6 rounded-lg w-full max-w-sm space-y-4 border border-[#2d3547]">
              <h2 className="text-sm font-bold text-white uppercase">Add New Customer</h2>
              {formError && <p className="text-red-400 text-[10px] font-bold">{formError}</p>}
              {(['first_name', 'last_name', 'email', 'phone', 'club_affinity'] as const).map(field => (
                <input
                  key={field}
                  type="text"
                  placeholder={`${field.replace(/_/g, ' ')}${field === 'first_name' || field === 'last_name' ? ' *' : ''}`}
                  value={customerForm[field]}
                  onChange={e => setCustomerForm(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full bg-[#0f1117] p-2 text-xs border border-[#2d3547] rounded text-white placeholder-gray-500"
                />
              ))}
              <div className="flex gap-2">
                <button onClick={() => { setShowCustomerModal(false); setCustomerForm({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' }); }} className="flex-1 p-2 bg-[#2d3547] rounded text-xs text-white">Cancel</button>
                <button disabled={isAddingCustomer} onClick={handleAddCustomer} className="flex-1 p-2 bg-[#b90014] hover:bg-red-700 disabled:opacity-50 rounded text-xs font-bold text-white uppercase">
                  {isAddingCustomer ? 'Adding...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void/Refund Modal */}
      <AnimatePresence>
        {showVoidRefundModal && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#1a2236] p-6 rounded-lg w-full max-w-2xl space-y-4 border border-[#2d3547] max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase">Void or Refund Transaction</h2>
                <button onClick={() => setShowVoidRefundModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>

              {recentTransactions.length === 0 ? (
                <p className="text-gray-400 text-sm">No recent transactions to void/refund</p>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="bg-[#0f1117] border border-[#2d3547] p-3 rounded flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{tx.method} · ${Number(tx.total_amount).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                        {tx.customer_id && (
                          <p className="text-[10px] text-gray-400">
                            Customer: {tx.customer_id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { handleVoidRefund(tx.id, 'void'); }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold uppercase"
                        >
                          Void
                        </button>
                        <button
                          onClick={() => { handleVoidRefund(tx.id, 'refund'); }}
                          className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] font-bold uppercase"
                        >
                          Refund
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => setShowVoidRefundModal(false)} className="px-4 py-2 bg-[#2d3547] hover:bg-[#3d4557] text-white rounded text-xs font-bold uppercase">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Bar */}
      <div className="bg-[#1a2236] border-t border-[#2d3547] h-12 px-6 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2"><Home size={14} /><span>Dashboard</span></div>
        <span>{cashierName}</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
