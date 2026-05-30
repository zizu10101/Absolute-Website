import React, { useState, useEffect, useMemo, useRef } from 'react';
import Barcode from 'react-barcode';
import { useProducts, mapProductFromDb } from '../context/ProductContext';
import { useCustomers } from '../context/CustomerContext';
import { usePOSCart } from '../hooks/usePOSCart';
import { supabase } from '../supabase';
import { 
  Search, 
  Trash2, 
  Receipt, 
  UserPlus, 
  DollarSign, 
  CreditCard, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PosRegister: React.FC = () => {
  const { 
    products: contextProducts,
    loadMoreAdminProducts,
    hasMoreProducts,
    isLoading: isContextLoading
  } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const safeCustomers = Array.isArray(customers) ? customers : [];
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [posMode, setPosMode] = useState<"history" | "void" | "refund" | null>(null);

  useEffect(() => {
    const handleBarcodeScanner = (e: KeyboardEvent) => {
      // Very simple barcode listener: listen for Enter key if posMode is void or refund
      if ((posMode === 'void' || posMode === 'refund') && e.key === 'Enter') {
        // Assume barSearch is updated via onScan/onChange event listeners
      }
    };
    window.addEventListener('keydown', handleBarcodeScanner);
    return () => window.removeEventListener('keydown', handleBarcodeScanner);
  }, [posMode]);

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
        club_affinity: customerForm.club_affinity.trim() || null
      };

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to register customer');
      
      await fetchCustomers();
      // Set the newly created customer as selected
      if (result.data && result.data[0]) {
        const newCustomer = result.data[0];
        setSelectedCustomerId(newCustomer.id);
        setCustomerSearchTerm(`${newCustomer.first_name} ${newCustomer.last_name}`);
      }
      
      resetCustomerForm();
      setIsCustomerModalOpen(false);
    } catch (e: any) {
      console.error('Add customer failed:', e);
      setFormError('Failed to register customer: ' + e.message);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  console.log("POS Search Available Customers:", safeCustomers);
  const filteredCustomers = safeCustomers.filter(c => 
    `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  const { 
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
  } = usePOSCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'FOOTWEAR' | 'KITS'>('ALL');
  
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
          throw new Error('No products returned from Supabase directly');
        }
      } catch (err) {
        try {
          const response = await fetch('/api/products?limit=1000');
          if (response.ok) {
            const result = await response.json();
            if (result.data && result.data.length > 0) {
              if (active) setAllProducts(result.data.map(mapProductFromDb));
            } else {
              throw new Error('API results are empty');
            }
          } else {
            throw new Error(`API status: ${response.status}`);
          }
        } catch (apiErr) {
          if (active && contextProducts && contextProducts.length > 0) setAllProducts(contextProducts);
        }
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'LAST' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('DAY');
  const [historyPage, setHistoryPage] = useState(0);
  
  const [barSearch, setBarSearch] = useState("");

  // Barcode Scanner Listener
  useEffect(() => {
    let buffer = "";
    let timeout: NodeJS.Timeout;
    
    const handleKey = (e: KeyboardEvent) => {
      // Clear previous timeout
      clearTimeout(timeout);
      
      if (e.key === "Enter") {
        const scannedCode = buffer.trim().toUpperCase();
        if (scannedCode.length > 2) {
          // Check if it matches a product variant barcode first
          fetch(`/api/variants/barcode/${scannedCode}`)
            .then(res => res.json())
            .then(payload => {
              if (payload.success && payload.data && payload.data.product) {
                const v = payload.data;
                const formattedCartItem = {
                  id: `var-${v.id}`,
                  name: `${v.product.name} [${v.age_group} - ${v.size}]`,
                  price: v.product.isOnSale && v.product.salePrice ? v.product.salePrice : v.product.price,
                  category: v.product.category,
                  isOnSale: v.product.isOnSale,
                  salePrice: v.product.salePrice,
                  image: v.product.image
                };
                addItem(formattedCartItem as any);
              } else {
                // Fall back: Treat as transaction check for Void / Refund
                const found = transactionHistory.find(tx => tx.id === buffer.trim());
                if (found) {
                  setBarSearch(buffer.trim());
                  
                  // Check if it's today's transaction
                  const isToday = new Date(found.created_at).toDateString() === new Date().toDateString();
                  if (isToday) {
                    setPosMode('void');
                    setIsHistoryOpen(true);
                    
                    // Automatically focus or alert after drawer opens
                    setTimeout(() => {
                      const btn = document.getElementById(`void-btn-${found.id}`);
                      if (btn) btn.focus();
                    }, 150);
                  } else {
                    setPosMode('refund');
                    setIsHistoryOpen(true);
                    
                    setTimeout(() => {
                      const btn = document.getElementById(`refund-btn-${found.id}`);
                      if (btn) btn.focus();
                    }, 150);
                  }
                }
              }
            })
            .catch(err => {
              console.error("Barcode matching search error:", err);
            });
        }
        buffer = "";
      } else {
        if (e.key.length === 1) {
          buffer += e.key;
        }
        // Timeout to reset buffer if scan is too slow
        timeout = setTimeout(() => { buffer = ""; }, 500);
      }
    };
    
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timeout);
    };
  }, [transactionHistory, addItem]);


  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch history');
      setTransactionHistory(result.data || []);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  };

  useEffect(() => {
    if (isHistoryOpen) fetchHistory();
  }, [isHistoryOpen]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    let filtered = [...transactionHistory];
    
    if (posMode === 'void') {
      // Displaying ONLY today's transactions
      filtered = filtered.filter(t => {
        const d = new Date(t.created_at);
        return d.toDateString() === now.toDateString() && t.status !== 'voided';
      });
    } else if (posMode === 'refund') {
      // Displaying past transactions (not today's)
      filtered = filtered.filter(t => {
        const d = new Date(t.created_at);
        return d.toDateString() !== now.toDateString() && t.status !== 'voided' && t.status !== 'refunded' && t.total_amount > 0;
      });
    } else {
      // Standard history mode
      if (historyFilter === 'LAST') return filtered.slice(0, 1);
      
      filtered = filtered.filter(t => {
        const d = new Date(t.created_at);
        if (historyFilter === 'DAY') return d.toDateString() === now.toDateString();
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (historyFilter === 'WEEK') return d >= weekAgo;
        if (historyFilter === 'MONTH') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (historyFilter === 'YEAR') return d.getFullYear() === now.getFullYear();
        return true;
      });
    }

    // Apply receipt barcode filter search
    if (barSearch.trim() !== "") {
      const searchVal = barSearch.trim().toLowerCase();
      filtered = filtered.filter(t => t.id.toLowerCase().includes(searchVal));
    }

    return filtered;
  }, [transactionHistory, historyFilter, posMode, barSearch]);

  const pagedHistory = useMemo(() => {
    const start = historyPage * 10;
    return filteredHistory.slice(start, start + 10);
  }, [filteredHistory, historyPage]);

  const handleVoid = async (tx: any) => {
    if (!confirm(`Are you sure you want to void this transaction?`)) return;
    try {
      const response = await fetch('/api/transactions/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: tx.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMessage('TRANSACTION SUCCESSFULLY VOIDED');
      fetchHistory();
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (e: any) {
      console.error('Void failed:', e);
      alert("Server Error: " + e.message);
    }
  };

  const handleRefund = async (tx: any) => {
    if (!confirm(`Are you sure you want to issue a refund for this transaction?`)) return;
    try {
      const response = await fetch('/api/transactions/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: tx.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMessage('REFUND SUCCESSFULLY ISSUED');
      fetchHistory();
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (e: any) {
      console.error('Refund failed:', e);
      alert("Server Error: " + e.message);
    }
  };

  const getStockCount = (product: any) => {
    if (product.stock !== undefined) return product.stock;
    if (product.inventory_quantity !== undefined) return product.inventory_quantity;
    return Math.abs((product.name || '').charCodeAt(0) + (product.name || '').length) % 18 + 2;
  };

  const matchesCategory = (p: any, tab: 'ALL' | 'FOOTWEAR' | 'KITS') => {
    if (tab === 'ALL') return true;
    const cat = (p.category || '').trim().toLowerCase();
    const sub = (p.submenu || '').trim().toLowerCase();
    if (tab === 'FOOTWEAR') return cat === 'footwear' || cat === 'footwear / boots' || sub === 'boots' || sub === 'footwear';
    if (tab === 'KITS') return cat === 'national team kits' || cat === 'national teams' || cat === 'clubs' || cat === 'apparel / jerseys' || cat === 'kits' || sub === 'jerseys' || sub === 'kits';
    return true;
  };

  const activeProductSource = allProducts.length > 0 ? allProducts : contextProducts;
  const filteredProducts = activeProductSource.filter(p => {
    if (showOnlineOnly && p.is_online !== true) return false;
    if (!matchesCategory(p, activeTab)) return false;
    const searchLower = searchQuery.trim().toLowerCase();
    return !searchLower || (p.name || '').toLowerCase().includes(searchLower) || (p.category || '').toLowerCase().includes(searchLower) || (p.submenu || '').toLowerCase().includes(searchLower);
  });

  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmSale = async (method: string) => {
    setIsConfirming(true);
    const cartItemsPayload = cart.map(item => ({
      ...item,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice)
    }));

    try {
      const payload = {
        total_amount: Number(grandTotal.toFixed(2)),
        method: method,
        items: cartItemsPayload,
        customer_id: selectedCustomerId && selectedCustomerId.trim() !== '' ? selectedCustomerId.trim() : null,
        created_at: new Date().toISOString()
      };
      
      console.log("POS Finalizing Transaction Payload:", payload);
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save transaction');

      setCheckoutSuccess({
        method,
        items: [...cart],
        subtotal,
        hst,
        total: grandTotal,
        isTaxExempt,
        time: new Date().toLocaleTimeString(),
      });
      
      // Delay reset to show success
      setTimeout(() => {
        clearCart();
        setSelectedCustomerId('');
        setCustomerSearchTerm('');
        setIsCheckoutOpen(false);
        setCheckoutSuccess(null);
      }, 2000);
    } catch (e: any) {
      console.error('Failed to confirm sale:', e);
      alert('Sale failed: ' + e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#f9f9f9] relative select-none rounded-xl overflow-hidden shadow-inner border border-zinc-200">
      
      <div className="p-6 bg-white border-b border-zinc-200 space-y-5">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Customer</label>
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  if (e.target.value === '') setSelectedCustomerId('');
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search or Select Customer..."
                className="w-full bg-zinc-50 border border-zinc-200 p-2.5 text-xs rounded font-bold uppercase tracking-wide"
              />
              {isDropdownOpen && (
                <ul className="absolute top-full left-0 right-0 bg-white border border-zinc-200 mt-1 rounded shadow-lg z-60 max-h-40 overflow-y-auto">
                  <li onClick={() => { setSelectedCustomerId(''); setCustomerSearchTerm(''); setIsDropdownOpen(false); }} className="p-2 text-xs cursor-pointer hover:bg-zinc-100 font-bold uppercase">Guest (Anonymous)</li>
                  {filteredCustomers.map(c => (
                    <li key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchTerm(`${c.first_name} ${c.last_name}`); setIsDropdownOpen(false); }} className="p-2 text-xs cursor-pointer hover:bg-zinc-100">
                      {c.first_name} {c.last_name} ({c.email || 'No Email'})
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setIsCustomerModalOpen(true)} className="bg-zinc-950 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-[#b90014] transition-colors"><Plus size={14}/></button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Search Inventory</label>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-400" />
              <input 
                type="text"
                placeholder="SKU OR PRODUCT NAME..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    try {
                      const response = await fetch(`/api/variants/barcode/${searchQuery.trim().toUpperCase()}`);
                      if (response.ok) {
                        const payload = await response.json();
                        if (payload.success && payload.data && payload.data.product) {
                          const v = payload.data;
                          const formattedCartItem = {
                            id: `var-${v.id}`,
                            name: `${v.product.name} [${v.age_group} - ${v.size}]`,
                            price: v.product.isOnSale && v.product.salePrice ? v.product.salePrice : v.product.price,
                            category: v.product.category,
                            isOnSale: v.product.isOnSale,
                            salePrice: v.product.salePrice,
                            image: v.product.image
                          };
                          addItem(formattedCartItem as any);
                          setSearchQuery('');
                          e.preventDefault();
                        }
                      }
                    } catch (err) {
                      console.error("Manual search lookup error:", err);
                    }
                  }
                }}
                className="w-full text-zinc-800 placeholder-zinc-455 bg-zinc-50 border border-zinc-200 rounded-lg pl-11 pr-4 py-3 text-xs font-semibold tracking-wide focus:outline-none focus:ring-1 focus:ring-zinc-800 transition-all uppercase"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Browse Categories</label>
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <span className="text-[9.5px] font-black text-zinc-500 group-hover:text-zinc-900 transition-colors uppercase tracking-wider">Show Online Store Items Only</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={showOnlineOnly} onChange={(e) => setShowOnlineOnly(e.target.checked)} />
                <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${showOnlineOnly ? 'bg-[#b90014]' : 'bg-zinc-200'}`} />
                <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-xs transition-transform duration-200 ${showOnlineOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'ALL', label: 'ALL ITEMS', desc: 'Show entire live inventory', icon: '⚽' },
              { id: 'FOOTWEAR', label: 'FOOTWEAR', desc: 'Boots, lifestyle & indoor', icon: '👟' },
              { id: 'KITS', label: 'KITS', desc: 'Jerseys, clubs & national teams', icon: '👕' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all relative overflow-hidden group select-none active:scale-[0.98] ${
                    isActive 
                      ? 'bg-zinc-950 border-[#b90014] text-white shadow-md' 
                      : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-base">{tab.icon}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-[#b90014] rounded-full animate-pulse" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                  <span className={`text-[8px] mt-0.5 ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>{tab.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filteredProducts.map((p) => {
            const stock = getStockCount(p);
            return (
              <div 
                key={p.id}
                onClick={() => addItem(p)}
                className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between hover:border-zinc-400 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
              >
                <div className="relative aspect-[16/10] bg-zinc-50 border-b border-zinc-100 flex items-center justify-center overflow-hidden">
                  <img src={p.image} alt={p.name} className="h-full w-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                  {p.isOnSale && p.salePrice ? (
                    <div className="absolute top-1 right-1 bg-red-600 text-white rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide leading-none select-none flex items-center gap-1 shadow-xs border border-red-500">
                      <span className="line-through text-white/75 text-[7.5px]">${p.price.toFixed(2)}</span>
                      <span>${p.salePrice.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="absolute top-1 right-1 bg-zinc-900/90 text-white rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide leading-none select-none">
                      ${p.price.toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between bg-zinc-50/50">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wide leading-snug line-clamp-2 min-h-[28px]">{p.name}</h3>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-block bg-zinc-200/60 text-zinc-700 px-1.5 py-0.5 rounded-[3px] text-[7px] font-bold tracking-wider uppercase">QTY: {stock}</span>
                      {p.isOnSale && p.salePrice && (
                        <span className="inline-block bg-red-100 text-[#b90014] border border-red-200 px-1 py-0.5 rounded-[3px] text-[7px] font-black tracking-wider uppercase">SALE</span>
                      )}
                    </div>
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); addItem(p); }} className="w-full bg-[#b90014] text-white text-[8px] font-black py-1 rounded uppercase tracking-wider hover:bg-red-700 transition-all flex items-center justify-center gap-1 mt-2 shadow-xs active:scale-95">
                    + ADD UNIT
                  </button>
                </div>
              </div>
            );
          })}

          {hasMoreProducts && (
            <div className="col-span-full py-6 flex justify-center">
              <button type="button" onClick={async () => await loadMoreAdminProducts()} disabled={isContextLoading || isLoadingAll} className="flex items-center gap-2.5 px-8 py-3.5 bg-zinc-950 border border-zinc-800 hover:bg-black text-white hover:text-white rounded-lg font-black uppercase tracking-widest text-[9px] shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer">
                {isContextLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><RefreshCw size={11} className="text-[#b90014]" /> LOAD MORE PRODUCTS ({activeProductSource.length} LOADED)</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex justify-between items-center z-30 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-0.5">ITEMS: {totalCartItemsCount}</span>
          <span className="text-xl font-black text-white tracking-wide">${grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setPosMode('void'); setIsHistoryOpen(true); }} className="flex items-center gap-2 px-4 py-3 border border-zinc-700 rounded-lg bg-red-900 hover:bg-red-800 text-white transition-all text-xs font-bold uppercase tracking-widest"><RotateCcw size={16} /> Quick Void Mode</button>
          <button onClick={() => { setPosMode('refund'); setIsHistoryOpen(true); }} className="flex items-center gap-2 px-4 py-3 border border-zinc-700 rounded-lg bg-amber-800 hover:bg-amber-700 text-white transition-all text-xs font-bold uppercase tracking-widest"><RotateCcw size={16} /> Quick Refund Mode</button>
          <button onClick={() => { setPosMode('history'); setIsHistoryOpen(true); }} className="flex items-center gap-2 px-4 py-3 border border-zinc-700 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all text-xs font-bold uppercase tracking-widest"><RotateCcw size={16} /> History</button>
          <button disabled={totalCartItemsCount === 0} onClick={() => setIsCheckoutOpen(true)} className="p-3 border border-zinc-800 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-700 transition-all" title="View Current Order Summary"><Receipt size={18} /></button>
          <button disabled={totalCartItemsCount === 0} onClick={() => { if (confirm('Are you sure you want to clear the active POS ticket?')) clearCart(); }} className="p-3 border border-zinc-800 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-700 transition-all" title="Clear Active Ticket"><Trash2 size={18} /></button>
          <button disabled={totalCartItemsCount === 0} onClick={() => setIsCheckoutOpen(true)} className="bg-[#b90014] hover:bg-red-700 active:scale-[0.98] text-white px-8 py-3 rounded-md text-[11px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-nowrap">PROCESS CHECKOUT <ArrowRight size={13} className="stroke-[3px]" /></button>
        </div>
      </div>

      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-55 flex justify-end">
            <div className="flex-1" onClick={() => setIsCheckoutOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 220 }} className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl relative">
              <div className="p-6 border-b border-zinc-150 flex justify-between items-center bg-zinc-950 text-white">
                <div className="flex items-center gap-2"><Receipt size={18} className="text-[#b90014]" /><h2 className="text-xs font-black uppercase tracking-widest">POS CHECKOUT TAPE</h2></div>
                <button onClick={() => { setIsCheckoutOpen(false); setCheckoutSuccess(null); }} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"><X size={18} /></button>
              </div>

              {checkoutSuccess ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-800">TRANSACTION SUCCESSFULLY SECURED & LOGGED</h3>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-zinc-150">
                    <div className="flex justify-between items-center mb-2">
                       <label className="block text-[10px] uppercase font-bold text-zinc-400">Transaction Details</label>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded text-[10px] font-bold text-zinc-800">
                      Customer: {safeCustomers.find(c => c.id === selectedCustomerId)?.first_name 
                        ? `${safeCustomers.find(c => c.id === selectedCustomerId)?.first_name} ${safeCustomers.find(c => c.id === selectedCustomerId)?.last_name}` 
                        : "Anonymous Walk-in"}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="border-b border-zinc-100 pb-4 pt-1 space-y-2">
                        <div className="flex justify-between items-start text-xs">
                          <div className="space-y-1 pr-4">
                            <p className="font-extrabold uppercase tracking-wide text-zinc-900 leading-tight">{item.name}</p>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 select-none">
                            <span className="font-extrabold text-zinc-950 text-xs">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                            <button onClick={() => removeItem(item.id)} className="text-zinc-300 hover:text-red-650 p-1 hover:bg-zinc-50 rounded transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-zinc-50 border-t border-zinc-200 space-y-4">
                    <div className="space-y-2 text-xs font-bold text-zinc-600">
                      <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-red-600"><span>Discount</span><span>-${totalDiscount.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between"><span>Tax (HST)</span><span>${hst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-200"><span>Total Due</span><span>${grandTotal.toFixed(2)}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Store Credit', 'Gift Card'].map(method => (
                        <button 
                          key={method}
                          disabled={isConfirming} 
                          onClick={() => handleConfirmSale(method)} 
                          className="bg-white border border-zinc-200 hover:bg-zinc-100 active:scale-[0.99] text-zinc-900 p-2 rounded font-black uppercase text-[9px] flex justify-center items-center gap-1 shadow-sm transition-all disabled:opacity-50"
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

      <AnimatePresence>
        {isHistoryOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-55 flex justify-end animate-fade-in">
            <div className="flex-1" onClick={() => { setIsHistoryOpen(false); setBarSearch(''); }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 220 }} className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl relative">
              <div className="p-6 border-b border-zinc-150 flex justify-between items-center bg-zinc-950 text-white">
                <div className="flex items-center gap-2">
                  <RotateCcw size={18} className="text-[#b90014]" />
                  <h2 className="text-xs font-black uppercase tracking-widest">
                    {posMode === 'void' ? 'VOID TRANSACTION MANAGER' :
                     posMode === 'refund' ? 'PRODUCT REFUND MANAGER' :
                     'TRANSACTION HISTORY'}
                  </h2>
                </div>
                <button onClick={() => { setIsHistoryOpen(false); setBarSearch(''); }} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"><X size={18} /></button>
              </div>
              
              {posMode === 'history' ? (
                <div className="p-4 bg-zinc-100 flex gap-2 overflow-x-auto text-[10px] font-bold">
                   {(['LAST', 'DAY', 'WEEK', 'MONTH', 'YEAR'] as const).map(f => (
                     <button key={f} onClick={() => { setHistoryFilter(f); setHistoryPage(0); }} className={`px-3 py-1.5 rounded ${historyFilter === f ? 'bg-zinc-900 text-white' : 'bg-white'}`}>{f}</button>
                   ))}
                </div>
              ) : (
                <div className="p-4 bg-zinc-900 border-b border-zinc-800 space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scan or Enter Receipt ID</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={barSearch} 
                      onChange={(e) => setBarSearch(e.target.value)} 
                      placeholder="Scan Receipt Barcode..." 
                      autoFocus
                      className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-white rounded-md text-xs font-mono focus:outline-none focus:border-red-500 transition-colors"
                    />
                    {barSearch.trim() && (
                      <button 
                        onClick={() => setBarSearch('')} 
                        className="absolute right-2 top-1.5 p-1 text-[10px] text-zinc-450 hover:text-white font-bold uppercase transition-colors"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {successMessage ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto h-full">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#15803d]" id="success-banner">{successMessage}</h3>
                  </div>
                 ) : pagedHistory.length === 0 ? (
                   <div className="flex flex-col items-center justify-center p-12 text-zinc-400 text-center space-y-2">
                     <p className="text-xs font-bold uppercase tracking-widest">No matching transactions found</p>
                     <p className="text-[10px] text-zinc-500">Wait for scanning or adjust filter values.</p>
                   </div>
                 ) : pagedHistory.map(tx => {
                   return (
                     <div key={tx.id} className="bg-white border rounded p-4 text-[10px] space-y-2 focus-within:ring-2 focus-within:ring-red-500 outline-none transition-all">
                       <div className="flex justify-between font-bold">
                         <span>ID: {tx.id.slice(0, 8)}</span>
                         <span className={tx.total_amount < 0 || tx.status === 'voided' ? 'text-red-600 line-through' : 'text-emerald-600'}>
                           ${tx.total_amount.toFixed(2)}
                         </span>
                       </div>
                       <div className="flex justify-between text-zinc-500">
                         <span>{new Date(tx.created_at).toLocaleString()}</span>
                         <span className="font-semibold uppercase">{tx.method}</span>
                       </div>
                       <div className="my-2 flex justify-center bg-white p-2 border rounded">
                         <Barcode value={tx.id} width={1.5} height={30} fontSize={10} />
                       </div>
                       
                       {tx.status && (
                        <div className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <span>Status:</span>
                          <span className={tx.status === 'voided' ? 'text-red-500' : tx.status === 'refunded' ? 'text-amber-500' : 'text-emerald-500'}>
                            {tx.status.toUpperCase()}
                          </span>
                        </div>
                       )}

                       <div className="flex gap-2 pt-1 border-t border-zinc-100 mt-2">
                         {posMode === 'void' && (
                           <button 
                             id={`void-btn-${tx.id}`}
                             onClick={() => handleVoid(tx)} 
                             className="w-full py-2 rounded font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm text-center"
                           >
                             Confirm Void
                           </button>
                         )}
                         {posMode === 'refund' && (
                           <button 
                             id={`refund-btn-${tx.id}`}
                             onClick={() => handleRefund(tx)} 
                             className="w-full py-2 rounded font-black text-[10px] uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.99] transition-all cursor-pointer shadow-sm text-center"
                           >
                             Issue Refund
                           </button>
                         )}
                       </div>
                     </div>
                   );
                 })}
              </div>
 
              <div className="p-4 border-t flex justify-between items-center text-[10px] font-black uppercase text-zinc-500">
                <button 
                  disabled={historyPage === 0} 
                  onClick={() => setHistoryPage(p => p - 1)} 
                  className="px-3 py-1 cursor-pointer hover:bg-zinc-100 border rounded disabled:opacity-40"
                >
                  ◀ Prev
                </button>
                <span>Page {historyPage + 1}</span>
                <button 
                  disabled={pagedHistory.length < 10}
                  onClick={() => setHistoryPage(p => p + 1)} 
                  className="px-3 py-1 cursor-pointer hover:bg-zinc-100 border rounded disabled:opacity-40"
                >
                  Next ▶
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="absolute inset-0 bg-black/50 z-60 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">Add New Customer</h2>
              {formError && <p className="text-red-600 text-[10px] font-bold">{formError}</p>}
              <input type="text" placeholder="First Name *" value={customerForm.first_name} onChange={e => setCustomerForm(prev => ({...prev, first_name: e.target.value}))} className="w-full bg-zinc-50 p-2 text-xs border rounded" />
              <input type="text" placeholder="Last Name *" value={customerForm.last_name} onChange={e => setCustomerForm(prev => ({...prev, last_name: e.target.value}))} className="w-full bg-zinc-50 p-2 text-xs border rounded" />
              <input type="text" placeholder="Email" value={customerForm.email} onChange={e => setCustomerForm(prev => ({...prev, email: e.target.value}))} className="w-full bg-zinc-50 p-2 text-xs border rounded" />
              <input type="text" placeholder="Phone" value={customerForm.phone} onChange={e => setCustomerForm(prev => ({...prev, phone: e.target.value}))} className="w-full bg-zinc-50 p-2 text-xs border rounded" />
              <input type="text" placeholder="Club Affinity" value={customerForm.club_affinity} onChange={e => setCustomerForm(prev => ({...prev, club_affinity: e.target.value}))} className="w-full bg-zinc-50 p-2 text-xs border rounded" />
              <div className="flex gap-2">
                <button onClick={() => setIsCustomerModalOpen(false)} className="flex-1 p-2 bg-zinc-100 rounded text-xs">Cancel</button>
                <button disabled={isAddingCustomer} onClick={handleAddCustomer} className="flex-1 p-2 bg-[#b90014] text-white rounded text-xs font-bold uppercase">{isAddingCustomer ? 'Adding...' : 'Save Customer'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
