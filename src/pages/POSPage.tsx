import React, { useState, useEffect, useRef } from 'react';
import {
  Moon, Sun, LogOut, Search, Users, Percent, FileText, Trash2,
  Barcode, DollarSign, Home, AlertCircle, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PosRegister } from '../components/PosRegister';
import { PosTransactionHistory } from '../components/PosTransactionHistory';
import { PosCustomerManager } from '../components/PosCustomerManager';
import { POSPinEntry } from '../components/POSPinEntry';
import { PosDiscountModal } from '../components/PosDiscountModal';
import { usePOSCart } from '../hooks/usePOSCart';
import { useCustomers, Customer } from '../context/CustomerContext';
import { Product } from '../context/ProductContext';

export function POSPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode for Shopify look
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showCustomersPanel, setShowCustomersPanel] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierName] = useState('Cashier');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const { cart, clearCart, discount, addItem, applyDiscount, subtotal } = usePOSCart();
  const { customers } = useCustomers();

  // Check authentication on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('pos_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data.data || []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('pos_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const handlePinSubmit = () => {
    sessionStorage.setItem('pos_authenticated', 'true');
    setIsAuthenticated(true);
  };

  const handleLockPOS = () => {
    sessionStorage.removeItem('pos_authenticated');
    setIsAuthenticated(false);
    setShowHistoryPanel(false);
    setShowCustomersPanel(false);
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCustomersPanel(false);
  };

  const handleApplyDiscount = (discountData: any) => {
    applyDiscount(discountData);
  };

  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const nameMatch = p.name && p.name.toLowerCase().includes(query);
    const categoryMatch = p.category && p.category.toLowerCase().includes(query);
    return nameMatch || categoryMatch;
  });

  if (!isAuthenticated) {
    return <POSPinEntry onPinSubmit={handlePinSubmit} isDarkMode={isDarkMode} />;
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f1117] text-white font-sans">
      {/* Top Bar - Shopify POS Style */}
      <div className="bg-[#1a2236] border-b border-[#2d3547] px-6 py-3 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2563eb] rounded flex items-center justify-center">
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
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 hover:bg-[#2d3547] rounded transition-colors"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleLockPOS}
            className="p-1.5 hover:bg-[#2d3547] rounded transition-colors text-red-400"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Main Content - Two Column */}
      <div className="flex-1 flex overflow-hidden gap-0">
        {/* LEFT PANEL - Action Tiles & Search */}
        <div className="w-1/2 bg-[#0f1117] border-r border-[#2d3547] flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-[#2d3547]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a2236] border border-[#2d3547] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
              />
            </div>
          </div>

          {/* Action Tiles Grid */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Add Customer */}
              <button
                onClick={() => setShowCustomersPanel(true)}
                className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <Users size={24} className="text-[#2563eb] group-hover:text-[#60a5fa]" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Add Customer</span>
              </button>

              {/* Add Discount */}
              <button
                onClick={() => setShowDiscountModal(true)}
                className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <Percent size={24} className="text-[#2563eb] group-hover:text-[#60a5fa]" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Add Discount</span>
              </button>

              {/* Add Note */}
              <button className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group">
                <FileText size={24} className="text-[#2563eb] group-hover:text-[#60a5fa]" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Add Note</span>
              </button>

              {/* Clear Cart */}
              <button
                onClick={() => {
                  if (confirm('Clear all items from cart?')) {
                    clearCart();
                  }
                }}
                className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-red-600 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <Trash2 size={24} className="text-red-500 group-hover:text-red-400" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Clear Cart</span>
              </button>

              {/* Custom Sale */}
              <button className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group">
                <DollarSign size={24} className="text-[#2563eb] group-hover:text-[#60a5fa]" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Custom Sale</span>
              </button>

              {/* Barcode Scan */}
              <button className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group">
                <Barcode size={24} className="text-[#2563eb] group-hover:text-[#60a5fa]" />
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white">Barcode Scan</span>
              </button>
            </div>

            {/* Product Grid */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Products</h3>
              {productsLoading ? (
                <div className="text-center py-4 text-gray-500 text-sm">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">No products found</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredProducts.slice(0, 12).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        const result = addItem(product);
                        if (result) {
                          alert(result);
                        }
                      }}
                      className="bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[#2563eb] rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-colors group text-center min-h-24"
                    >
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded bg-[#0f1117]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <span className="text-[10px] font-semibold text-gray-300 group-hover:text-white line-clamp-2">
                        {product.name}
                      </span>
                      <span className="text-[10px] text-[#2563eb]">${product.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Cart & Checkout */}
        <div className="w-1/2 bg-[#1a2236] flex flex-col overflow-hidden">
          {/* Customer Tag */}
          {selectedCustomer && (
            <div className="px-4 py-3 border-b border-[#2d3547] bg-[#2d3547]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#2563eb] rounded-full"></div>
                <div>
                  <p className="text-sm font-semibold">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  <p className="text-xs text-gray-400">Returning customer</p>
                </div>
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertCircle size={32} className="mb-2" />
                <p className="text-sm">No items in cart</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-[#0f1117] rounded-lg p-3 border border-[#2d3547]">
                  <div className="flex gap-3">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover bg-[#2d3547]" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                      <p className="text-xs font-bold text-[#2563eb] mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Checkout */}
          <div className="border-t border-[#2d3547] p-4 space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              {discount && (
                <div className="flex justify-between text-red-400">
                  <span>Discount</span>
                  <span>-${(cartTotal * (discount.type === 'percentage' ? discount.value / 100 : discount.value)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t border-[#2d3547]">
                <span>Total</span>
                <span className="text-lg text-[#2563eb]">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              className="w-full py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm uppercase tracking-wide"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* History Panel (Slide-over) */}
      <AnimatePresence>
        {showHistoryPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryPanel(false)}
              className="absolute inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-[#1a2236] border-l border-[#2d3547] z-50 flex flex-col"
            >
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between">
                <h2 className="text-sm font-bold">Order History</h2>
                <button onClick={() => setShowHistoryPanel(false)} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PosTransactionHistory />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Customers Panel (Slide-over) */}
      <AnimatePresence>
        {showCustomersPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomersPanel(false)}
              className="absolute inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-[#1a2236] border-l border-[#2d3547] z-50 flex flex-col"
            >
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between">
                <h2 className="text-sm font-bold">Customers</h2>
                <button onClick={() => setShowCustomersPanel(false)} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PosCustomerManager onSelectCustomer={handleSelectCustomer} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Discount Modal */}
      <AnimatePresence>
        <PosDiscountModal
          isOpen={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          onApply={handleApplyDiscount}
          currentDiscount={discount}
          subtotal={subtotal}
        />
      </AnimatePresence>

      {/* Bottom Bar */}
      <div className="bg-[#1a2236] border-t border-[#2d3547] h-12 px-6 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <Home size={14} />
          <span>Dashboard</span>
        </div>
        <span>{cashierName}</span>
        <span>v1.0.0</span>
      </div>

      {/* Keyboard shortcut for lock */}
      <KeyboardShortcuts onLock={handleLockPOS} />
    </div>
  );
}

function KeyboardShortcuts({ onLock }: { onLock: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        onLock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onLock]);

  return null;
}
