import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Moon, Sun, LogOut, Search, Users, Percent, FileText, Trash2,
  Barcode as BarcodeIcon, Archive, Home, AlertCircle, X, Check,
  Receipt, RotateCcw, RefreshCw, Plus, Printer, ScanLine, CheckCircle2, BarChart3, Undo2,
  UserPlus, Gift, Tag, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { PosTransactionHistory } from '../components/PosTransactionHistory';
import { PosCustomerManager } from '../components/PosCustomerManager';
import { POSPinEntry } from '../components/POSPinEntry';
import { PosDiscountModal } from '../components/PosDiscountModal';
import { GiftCardTab } from '../components/GiftCardTab';
import { StoreCreditsTab } from '../components/StoreCreditsTab';
import { ReturnsModal } from '../components/ReturnsModal';
import { usePOSCart, CartItem } from '../hooks/usePOSCart';
import { useCustomers, Customer } from '../context/CustomerContext';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../supabase';
import { mapProductFromDb } from '../context/ProductContext';
import { generateThermalReceiptHTML, generateGiftReceiptHTML } from '../utils/thermalReceipt';

type CategoryTab = 'ALL' | 'FOOTWEAR' | 'KITS' | 'BALLS' | 'EQUIPMENT' | 'TEAMWEAR' | 'GLOVES';

interface Receipt {
  transactionId?: string;
  invoiceNumber?: string;
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
  giftCardAmount?: number;
  giftCardNumber?: string;
  storeCreditAmount?: number;
  storeCreditId?: string;
  storeCreditNewBalance?: number;
  storeCreditCardNumber?: string; // SC card number for barcode on SC receipts
  barcodeValue?: string; // What to encode in barcode (transaction ID or SC card number)
}

export function POSPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Panels
  const [posTab, setPosTab] = useState<'register' | 'history' | 'customers' | 'gc' | 'sc' | 'returns'>('register');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Gift card payment tracking
  const [selectedGiftCard, setSelectedGiftCard] = useState<{ cardNumber: string; amount: number } | null>(null);

  // Store credit payment tracking
  const [selectedStoreCredit, setSelectedStoreCredit] = useState<{ id: string; amount: number; balance: number; cardNumber?: string } | null>(null);
  const [availableStoreCredits, setAvailableStoreCredits] = useState<any[]>([]);
  const [showStoreCreditModal, setShowStoreCreditModal] = useState(false);
  const [storeCreditError, setStoreCreditError] = useState<string | null>(null);
  const [scModalTab, setScModalTab] = useState<'customer' | 'scan' | 'search'>('customer'); // 'customer' = old flow, 'scan' = barcode, 'search' = search
  const [scScanInput, setScScanInput] = useState('');
  const [scSearchInput, setScSearchInput] = useState('');
  const [scSearchResults, setScSearchResults] = useState<any[]>([]);
  const [scLookupLoading, setScLookupLoading] = useState(false);
  const [scRemainingBalance, setScRemainingBalance] = useState(0); // Amount still owed after SC is applied
  const [scSecondPaymentMethod, setScSecondPaymentMethod] = useState<string | null>(null); // Cash, Debit, etc. for remaining balance

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

  // Gift receipt modal
  const [showGiftReceiptModal, setShowGiftReceiptModal] = useState(false);
  const [giftReceiptSelected, setGiftReceiptSelected] = useState<Set<number>>(new Set());

  // Cash Calculator
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);

  // Void/Refund
  const [showVoidRefundModal, setShowVoidRefundModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [selectedTransactionForVoid, setSelectedTransactionForVoid] = useState<any | null>(null);
  const [selectedTransactionForRefund, setSelectedTransactionForRefund] = useState<any | null>(null);

  // Returns
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [returnsInvoiceInput, setReturnsInvoiceInput] = useState('');
  const [returnsFoundTransaction, setReturnsFoundTransaction] = useState<any | null>(null);
  const [returnsLookupError, setReturnsLookupError] = useState<string | null>(null);
  const returnsInvoiceInputRef = useRef<HTMLInputElement>(null);

  // Size selector modal
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] = useState<any | null>(null);
  const [productVariants, setProductVariants] = useState<Map<string, any[]>>(new Map());

  // Stock map: productId -> total stock (fetched once on mount)
  const [productStockMap, setProductStockMap] = useState<Map<string, number>>(new Map());

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
  const { footerLogo } = useSettings();
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
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (data) {
          setRecentTransactions(data);
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      }
    };
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [isAuthenticated]);

  // Fetch products with variants
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .limit(1000);
        if (error) throw error;
        if (data) {
          const mappedProducts = data.map(mapProductFromDb);
          setProducts(mappedProducts);

          // Fetch ALL variants with pagination to bypass Supabase 1000-row cap
          const allVariants: any[] = [];
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data: batch } = await supabase
              .from('product_variants')
              .select('*')
              .range(from, from + batchSize - 1);
            if (!batch) break;
            allVariants.push(...batch);
            if (batch.length < batchSize) break;
            from += batchSize;
          }
          const variants = allVariants;

          if (variants) {
            // Build two maps: one for variant details, one for stock totals
            const variantMap = new Map<string, any[]>();
            const stockMap = new Map<string, number>();

            variants.forEach(v => {
              // Map for variant details (for size selector)
              if (!variantMap.has(v.product_id)) {
                variantMap.set(v.product_id, []);
              }
              variantMap.get(v.product_id)!.push(v);

              // Map for total stock (for quick lookup on card)
              const currentStock = stockMap.get(v.product_id) || 0;
              stockMap.set(v.product_id, currentStock + (v.stock_quantity || 0));
            });

            // Set both maps at once to avoid multiple re-renders
            setProductVariants(variantMap);
            setProductStockMap(stockMap);
          }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  // Auto-focus barcode input (disabled when modals are open)
  useEffect(() => {
    if (!showCheckout && !showDiscountModal && posTab === 'register') {
      barcodeInputRef.current?.focus();
    }
  }, [showCheckout, showDiscountModal, posTab]);

  // Barcode scanning
  const handleBarcodeScan = async (rawBarcode: string) => {
    const barcode = rawBarcode.trim().toUpperCase();
    if (!barcode) return;
    setBarcodeError(null);
    setBarcodeSuccess(null);

    try {
      // BARCODE ROUTING LOGIC

      // 1. STORE CREDIT BARCODE (SC-XXXXXXXXXXXX)
      if (barcode.startsWith('SC-')) {

        // Open store credit modal on scan tab with pre-filled barcode
        setShowStoreCreditModal(true);
        setScModalTab('scan');
        setScScanInput(barcode);
        setBarcodeSuccess(`Opening Store Credit lookup for: ${barcode}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
        setBarcodeInput('');
        return;
      }

      // 2. INVOICE/TRANSACTION BARCODE (INV-XXXXX)
      if (barcode.startsWith('INV-') || /^INV-\d+$/.test(barcode)) {

        // Open Returns modal with pre-filled invoice number
        setShowReturnsModal(true);
        setReturnsInvoiceInput(barcode);
        setBarcodeSuccess(`Opening Returns for invoice: ${barcode}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
        setBarcodeInput('');
        return;
      }

      // 3. CHECK IF THIS IS A TRANSACTION UUID (shouldn't happen but detect it)
      // UUID format: 8-4-4-4-12 hex digits (36 chars total with hyphens)
      const isUUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(barcode);
      if (isUUID) {
        setBarcodeError('âŒ That appears to be a transaction UUID. Please scan the invoice barcode (INV-XXXXX) instead.');
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      // PRODUCT BARCODE SCANNING
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

      // Fallback: Search by product code if no variant found
      let productByCode: any = null;
      if (!variantData) {
        const { data: codeMatch } = await supabase
          .from('products')
          .select('*')
          .eq('product_code', barcode)
          .maybeSingle();
        productByCode = codeMatch;
      }

      if (!variantData && !productByCode) {
        setBarcodeError(`No product found for barcode: ${barcode}`);
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      let cartItem: any;

      if (variantData) {
        // Product found via variant barcode
        const variant = variantData;
        const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
        if (!product) {
          setBarcodeError('Product data missing for this barcode');
          setTimeout(() => setBarcodeError(null), 4000);
          return;
        }

        const stock = variant.stock_quantity ?? 0;
        if (stock <= 0) {
          setBarcodeError(`OUT OF STOCK â€” ${product.name} Â· Size ${variant.size}`);
          setTimeout(() => setBarcodeError(null), 4000);
          return;
        }

        cartItem = {
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
          color: variant.color,
          ageGroup: variant.age_group,
          stockQuantity: stock,
          barcode: variant.barcode,
          quantity: 1,
        };
      } else if (productByCode) {
        // Product found via product code (no specific size/variant)
        const product = productByCode;
        cartItem = {
          id: product.id,
          name: product.name,
          price: product.isOnSale && product.salePrice ? product.salePrice : (product.price ?? 0),
          originalPrice: product.price ?? 0,
          category: product.category || '',
          isOnSale: product.isOnSale,
          salePrice: product.salePrice,
          image: product.image,
          barcode: product.product_code,
          quantity: 1,
        };
      } else {
        setBarcodeError('Product data missing');
        setTimeout(() => setBarcodeError(null), 4000);
        return;
      }

      const addError = addItem(cartItem);
      if (addError) {
        setBarcodeError(addError);
        setTimeout(() => setBarcodeError(null), 4000);
      } else {
        const colorText = cartItem.color ? ` Â· ${cartItem.color}` : '';
        const sizeText = cartItem.size ? ` Â· Sz ${cartItem.size}` : '';
        setBarcodeSuccess(`Added: ${cartItem.name}${colorText}${sizeText}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
      }
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      setBarcodeError('Error looking up barcode');
      setTimeout(() => setBarcodeError(null), 4000);
    } finally {
      setBarcodeInput('');
      if (!showCheckout && !showDiscountModal && posTab === 'register') {
        setTimeout(() => barcodeInputRef.current?.focus(), 60);
      }
    }
  };

  // Get stock from pre-built map (instant lookup, no calculations)
  const getTotalStock = (productId: string): number => {
    return productStockMap.get(productId) || 0;
  };

  // Get stock status display
  const getStockStatus = (productId: string): { text: string; color: string; isDisabled: boolean } => {
    const stock = getTotalStock(productId);
    if (stock === 0) {
      return { text: 'SOLD OUT', color: 'text-red-500 font-black tracking-widest', isDisabled: true };
    }
    if (stock <= 3) {
      return { text: `Only ${stock} left!`, color: 'text-amber-500', isDisabled: false };
    }
    if (stock <= 10) {
      return { text: `${stock} in stock`, color: 'text-gray-400', isDisabled: false };
    }
    return { text: '', color: '', isDisabled: false };
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

  // Void/Refund/Return handler
  const handleVoidRefundReturn = async (transactionId: string, action: 'void' | 'refund' | 'return') => {

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: action })
        .eq('id', transactionId);

      if (error) throw error;

      const actionText = action === 'void' ? 'voided' : action === 'refund' ? 'refunded' : 'returned';
      alert(`Transaction ${actionText} successfully`);
      setShowVoidRefundModal(false);

      // Refresh transactions
      const { data, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchErr) throw fetchErr;
      if (data) {
        setRecentTransactions(data);
      }
    } catch (e: any) {
      console.error(`âŒ STEP 8: Caught exception:`, e.message);
      alert(`Error: ${e.message}`);
    }
  };

  const handleRefundModalClose = async () => {
    setSelectedTransactionForRefund(null);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setRecentTransactions(data);
  };

  const handleReturnsInvoiceLookup = async (invoiceId: string) => {
    const input = invoiceId.trim();
    if (!input) {
      setReturnsLookupError('Please enter invoice number or scan barcode');
      return;
    }

    try {
      setReturnsLookupError(null);

      // Detect UUID format
      const isUUID = input.length === 36 && input.includes('-') && !input.startsWith('INV-');
      if (isUUID) {
        setReturnsLookupError('âŒ Please scan the invoice barcode, not the transaction UUID');
        return;
      }

      // Normalize invoice number
      const normalizedInvoice = input.startsWith('INV-')
        ? input
        : 'INV-' + input.padStart(5, '0');


      const { data, error } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('invoice_number', normalizedInvoice)
        .maybeSingle();


      if (!data) {
        setReturnsLookupError(`Invoice ${normalizedInvoice} not found`);
        return;
      }

      // Check status AFTER finding the record
      if (data.status === 'voided') {
        setReturnsLookupError('This transaction has been voided');
        return;
      }

      if (data.status === 'refunded') {
        setReturnsLookupError('This transaction has already been refunded');
        return;
      }

      if (data.status === 'returned') {
        setReturnsLookupError('This transaction has already been returned');
        return;
      }

      if (data.status === 'partial_return') {
        setReturnsLookupError('This transaction has already been partially returned');
        return;
      }

      if (data.status !== 'completed') {
        setReturnsLookupError(`This transaction cannot be returned (status: ${data.status})`);
        return;
      }

      setReturnsFoundTransaction(data);
      setShowReturnsModal(true);
    } catch (err) {
      setReturnsLookupError('Error looking up invoice');
      console.error(err);
    }
  };

  const handleReturnsComplete = () => {
    setShowReturnsModal(false);
    setReturnsFoundTransaction(null);
    setReturnsInvoiceInput('');
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

  // Open cash drawer via EpsonControl font
  const openCashDrawer = () => {
    const drawerHTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page {
      size: 80mm auto;
      margin: 0 !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      height: 0px;
      overflow: hidden;
    }
    @font-face {
      font-family: 'EpsonControl';
      src: local('Control');
    }
    .drawer-kick-container {
      display: block !important;
      font-family: 'EpsonControl', 'Control', monospace !important;
      font-size: 10pt !important;
      line-height: 0px !important;
      height: 0px !important;
      margin: 0 !important;
      padding: 0 !important;
      visibility: visible !important;
    }
  </style>
</head>
<body>
  <div class="drawer-kick-container">A</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1,height=1,left=-2000,top=-2000');
    if (win) {
      win.document.write(drawerHTML);
      win.document.close();
      win.onload = function() {
        win.print();
        win.onafterprint = function() { win.close(); };
      };
    }
  };

  // Checkout handler
  const handleConfirmSale = async (method: string) => {
    // For cash, show calculator instead of confirming immediately
    if (method === 'Cash') {
      setShowCashCalculator(true);
      setPendingPaymentMethod(method);
      setCashTendered('');
      return;
    }

    // For Store Credit, show modal with scan/search tabs (customer selection is optional now)
    if (method === 'Store Credit') {
      let hasCustomerCredits = false;


      // If customer is already selected, fetch their credits for the customer tab
      if (selectedCustomerId) {
        try {
          const { data: credits, error } = await supabase
            .from('store_credits')
            .select('*')
            .eq('customer_id', selectedCustomerId)
            .eq('is_active', true);

          if (error) throw error;


          // Filter for active credits with available balance
          const filteredCredits = (credits || []).filter(
            (c: any) => c.is_active && c.remaining_balance > 0
          );


          setAvailableStoreCredits(filteredCredits);
          hasCustomerCredits = filteredCredits.length > 0;
        } catch (err: any) {
          console.error('ðŸ”´ SC MODAL ERROR fetching customer store credits:', err);
          setAvailableStoreCredits([]);
        }
      } else {
        setAvailableStoreCredits([]);
      }

      // Open modal - start on customer tab if credits available, otherwise scan tab
      setScModalTab(hasCustomerCredits ? 'customer' : 'scan');
      setScScanInput('');
      setScSearchInput('');
      setScSearchResults([]);
      setStoreCreditError(null);
      setShowStoreCreditModal(true);
      return;
    }

    // Non-cash methods proceed directly to payment
    await processPayment(method);
  };

  // Scan/lookup store credit by code
  const handleScScan = async (code: string) => {
    if (!code.trim()) return;

    setScLookupLoading(true);
    setStoreCreditError(null);

    try {
      const searchCode = code.trim();

      // Detect if this is an invoice number (INV-XXXXX format)
      if (searchCode.startsWith('INV-') || /^INV-\d+$/.test(searchCode)) {
        setStoreCreditError(
          'â›” This is an invoice barcode, not a store credit.\n\n' +
          'Invoice codes are in format: INV-XXXXX\n\n' +
          'To process a return or look up a transaction, use the Returns tab instead.'
        );
        return;
      }

      // Detect if this looks like a UUID (transaction ID) - format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(searchCode)) {
        setStoreCreditError(
          'âŒ This is a transaction receipt barcode, not a store credit.\n\n' +
          'Store Credit codes are in format: SC-XXXXXXXXXXXX\n\n' +
          'Please scan the STORE CREDIT receipt instead.'
        );
        return;
      }

      // First try by card_number
      const { data: byCardNumber, error: cardError } = await supabase
        .from('store_credits')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('card_number', searchCode)
        .eq('is_active', true)
        .gt('remaining_balance', 0)
        .single();


      let data = byCardNumber;

      // If not found by card number, try by customer name or ID
      if (!byCardNumber && cardError?.code === 'PGRST116') { // not found

        const { data: byCustomer, error: customerError } = await supabase
          .from('store_credits')
          .select('*, customers(first_name, last_name, email, phone)')
          .eq('is_active', true)
          .gt('remaining_balance', 0);

        if (!customerError && byCustomer) {
          // Filter locally for first name or last name match
          const matches = byCustomer.filter(
            sc =>
              sc.customers?.first_name?.toLowerCase().includes(searchCode.toLowerCase()) ||
              sc.customers?.last_name?.toLowerCase().includes(searchCode.toLowerCase())
          );

          if (matches.length === 1) {
            data = matches[0];
          } else if (matches.length > 1) {
            setStoreCreditError(`Multiple credits found for "${searchCode}". Please use customer tab or search.`);
            return;
          }
        }
      }

      if (!data) {
        setStoreCreditError(
          `Store credit not found for: "${searchCode}"\n\n` +
          'Scan a store credit code (SC-XXXX...) or customer name.\n' +
          'Use Search tab for more options.'
        );
        return;
      }

      // Found a credit - apply it
      const amount = Math.min(data.remaining_balance, grandTotal);
      const storeCreditData = { id: data.id, amount, balance: data.remaining_balance, cardNumber: data.card_number };
      setSelectedStoreCredit(storeCreditData);

      // Auto-link customer if not already selected
      if (!selectedCustomerId && data.customer_id) {
        setSelectedCustomerId(data.customer_id);
      }


      setShowStoreCreditModal(false);
      setScScanInput('');
      // DO NOT call processPayment here - user will select payment method next
    } catch (err: any) {
      console.error('ðŸ”´ SC SCAN EXCEPTION:', err);
      setStoreCreditError('Error scanning store credit: ' + err.message);
    } finally {
      setScLookupLoading(false);
    }
  };

  // Search store credits by card number or customer name
  const handleScSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setScSearchResults([]);
      return;
    }

    setScLookupLoading(true);
    setStoreCreditError(null);

    try {
      const searchLower = searchTerm.trim().toLowerCase();

      // Fetch all active store credits with balances
      const { data: allCredits, error } = await supabase
        .from('store_credits')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('is_active', true)
        .gt('remaining_balance', 0);


      if (error) throw error;

      // Filter locally for matches on:
      // 1. Customer first name
      // 2. Customer last name
      // 3. Card number (if it exists)
      // 4. Customer email or phone
      const results = (allCredits || []).filter(credit =>
        credit.customers?.first_name?.toLowerCase().includes(searchLower) ||
        credit.customers?.last_name?.toLowerCase().includes(searchLower) ||
        credit.card_number?.toLowerCase().includes(searchLower) ||
        credit.customers?.email?.toLowerCase().includes(searchLower) ||
        credit.customers?.phone?.includes(searchTerm)
      );


      setScSearchResults(results);
      if (results.length === 0) {
        setStoreCreditError('No store credits found matching that search');
      }
    } catch (err: any) {
      console.error('ðŸ”´ SC SEARCH ERROR:', err);
      setStoreCreditError('Error searching store credits: ' + err.message);
      setScSearchResults([]);
    } finally {
      setScLookupLoading(false);
    }
  };

  // Apply selected store credit from search/scan
  const applyStoreCredit = (credit: any) => {
    const scAmount = Math.min(credit.remaining_balance, grandTotal);
    const remaining = grandTotal - scAmount;

    const storeCreditData = { id: credit.id, amount: scAmount, balance: credit.remaining_balance, cardNumber: credit.card_number };
    setSelectedStoreCredit(storeCreditData);
    setScRemainingBalance(remaining);
    setScSecondPaymentMethod(null); // Reset second payment method

    // Auto-link customer if not already selected
    if (!selectedCustomerId && credit.customer_id) {
      setSelectedCustomerId(credit.customer_id);
    }


    // Close modal - user will select payment method next
    // DO NOT call processPayment here - wait for payment method selection
    setShowStoreCreditModal(false);
    setScScanInput('');
    setScSearchInput('');
    setScSearchResults([]);
  };

  const processPayment = async (method: string, tenderedAmount?: number, storeCredit?: any, giftCard?: any) => {
    // CRITICAL: Capture state values BEFORE any awaits - state can change during async operations
    const capturedStoreCredit = storeCredit || selectedStoreCredit;
    const capturedGiftCard = giftCard || selectedGiftCard;

    setIsConfirming(true);
    const cartItemsPayload = cart.map(item => ({
      ...item,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice),
    }));

    try {
      // Calculate actual amount to charge after gift card and store credit are applied
      let amountAfterGiftCard = capturedGiftCard
        ? Math.max(0, grandTotal - capturedGiftCard.amount)
        : grandTotal;

      let amountAfterStoreCredit = capturedStoreCredit
        ? Math.max(0, amountAfterGiftCard - capturedStoreCredit.amount)
        : amountAfterGiftCard;

      const payload: any = {
        total_amount: Number(amountAfterStoreCredit.toFixed(2)),
        method,
        items: cartItemsPayload,
        customer_id: selectedCustomerId?.trim() || null,
        created_at: new Date().toISOString(),
      };

      // Add cash-specific fields (use amount after gift card and store credit)
      if (method === 'Cash' && tenderedAmount !== undefined) {
        payload.tendered_amount = Number(tenderedAmount.toFixed(2));
        payload.change_given = Number((tenderedAmount - amountAfterStoreCredit).toFixed(2));
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select();

      if (error) throw error;


      const result = { data };

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

      // BUG FIX: Calculate actualAmountUsed (was missing before!)
      const actualAmountUsed = amountAfterGiftCard - amountAfterStoreCredit;

      // UPDATE STORE CREDIT BALANCE DIRECTLY (not via API)
      let storeCreditNewBalance = capturedStoreCredit?.balance;


      if (capturedStoreCredit?.id && actualAmountUsed > 0) {
        try {
          const newBalance = Number(capturedStoreCredit.balance) - Number(actualAmountUsed);


          const { data: scData, error: scError } = await supabase
            .from('store_credits')
            .update({
              remaining_balance: newBalance,
              is_active: newBalance > 0,
            })
            .eq('id', capturedStoreCredit.id)
            .select();


          if (scError) {
            console.error('ðŸ”´ SC UPDATE FAILED:', scError);
          } else {
            storeCreditNewBalance = newBalance;

            // Create transaction record for audit trail
            const { error: txError } = await supabase
              .from('store_credit_transactions')
              .insert({
                store_credit_id: capturedStoreCredit.id,
                amount: -Number(actualAmountUsed),
                transaction_type: 'redeemed',
              });

            if (txError) {
              console.error('ðŸ”´ Transaction record failed:', txError);
            } else {
            }
          }
        } catch (err) {
          console.error('ðŸ”´ Error updating store credit balance:', err);
        }
      } else {
      }

      setReceipt({
        transactionId: result?.data?.[0]?.id,
        invoiceNumber: result?.data?.[0]?.invoice_number,
        method,
        items: [...cart],
        subtotal,
        hst,
        total: amountAfterStoreCredit,
        isTaxExempt,
        customer: safeCustomers.find(c => c.id === selectedCustomerId),
        time: new Date().toLocaleString(),
        tenderedAmount,
        changeGiven: tenderedAmount !== undefined ? tenderedAmount - amountAfterStoreCredit : undefined,
        giftCardAmount: capturedGiftCard?.amount,
        giftCardNumber: capturedGiftCard?.cardNumber,
        storeCreditAmount: capturedStoreCredit?.amount,
        storeCreditId: capturedStoreCredit?.id,
        storeCreditNewBalance: storeCreditNewBalance,
      });

      // Close cash calculator if it was open
      setShowCashCalculator(false);
      setCashTendered('');
      setPendingPaymentMethod(null);

      // Process gift card redemption AFTER transaction is confirmed
      if (capturedGiftCard) {
        try {
          const newBalance = Math.max(0, capturedGiftCard.balance - capturedGiftCard.amount);
          const { error: updateErr } = await supabase
            .from('gift_cards')
            .update({
              current_balance: newBalance,
              is_active: newBalance > 0,
            })
            .eq('card_number', capturedGiftCard.cardNumber);

          if (updateErr) {
            console.error('âš ï¸ Gift card redemption warning:', updateErr);
          } else {
          }
        } catch (err) {
          console.error('âŒ Error processing gift card redemption:', err);
          // Don't fail the transaction if gift card redemption fails
        }
      }

      // Note: Store credit balance is now updated DIRECTLY above (in Supabase section)
      // No need for API call - everything is handled locally
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
    setSelectedGiftCard(null);
    setSelectedStoreCredit(null);
    setShowStoreCreditModal(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Handle gift card issuance
  const handleIssueGiftCard = (giftCard: any) => {
    addItem(giftCard);
  };

  // Handle gift card redemption (store selection, don't process yet)
  const handleRedeemGiftCard = async (cardNumber: string, amount: number) => {
    // Just store the gift card info, don't call API yet
    // The actual redemption happens after transaction is confirmed
    const giftCardData = { cardNumber, amount };
    setSelectedGiftCard(giftCardData);
    return Promise.resolve(); // Explicitly resolve for the async callback
  };

  // Print thermal receipt (copies: 1 = customer only, 2 = customer + merchant)
  const handlePrintReceipt = async (copies: 1 | 2 = 1) => {
    if (!receipt) return;

    const barcodeValue = receipt.storeCreditCardNumber || receipt.invoiceNumber || receipt.transactionId || 'N/A';

    const receiptHtml = generateThermalReceiptHTML({
      transactionId: receipt.transactionId || 'N/A',
      invoiceNumber: receipt.invoiceNumber,
      customerName: receipt.customer ? `${receipt.customer.first_name} ${receipt.customer.last_name}` : 'Walk-in',
      items: receipt.items,
      subtotal: receipt.subtotal,
      hst: receipt.hst,
      total: receipt.total,
      paymentMethod: receipt.method,
      createdAt: new Date(),
      logoUrl: footerLogo || '/logo.svg',
      barcodeValue: barcodeValue,
      copies,
    });

    // Browser print dialog
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = function() {
            printWindow.close();
          };
        }, 500);
      };
    }
  };

  // Open gift receipt modal (pre-select all items)
  const handleOpenGiftReceipt = () => {
    if (!receipt) return;
    setGiftReceiptSelected(new Set(receipt.items.map((_, i) => i)));
    setShowGiftReceiptModal(true);
  };

  // Print gift receipt for selected items
  const handlePrintGiftReceipt = () => {
    if (!receipt) return;
    const selectedItems = receipt.items.filter((_, i) => giftReceiptSelected.has(i));
    if (selectedItems.length === 0) return;

    const giftHtml = generateGiftReceiptHTML({
      transactionId: receipt.transactionId || 'N/A',
      invoiceNumber: receipt.invoiceNumber,
      customerName: receipt.customer ? `${receipt.customer.first_name} ${receipt.customer.last_name}` : 'Walk-in',
      items: selectedItems,
      subtotal: receipt.subtotal,
      hst: receipt.hst,
      total: receipt.total,
      paymentMethod: receipt.method,
      createdAt: new Date(),
      logoUrl: footerLogo || '/logo.svg',
      barcodeValue: receipt.invoiceNumber || receipt.transactionId || 'N/A',
    });

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(giftHtml);
      printWindow.document.close();
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = function() {
            printWindow.close();
          };
        }, 500);
      };
    }
    setShowGiftReceiptModal(false);
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
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          first_name: customerForm.first_name.trim(),
          last_name: customerForm.last_name.trim(),
          email: customerForm.email.trim() || null,
          phone: customerForm.phone.trim() || null,
          club_affinity: customerForm.club_affinity.trim() || null,
        }])
        .select();

      if (error) throw error;
      await fetchCustomers();
      if (data?.[0]) {
        const newCustomer = data[0];
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
    setPosTab('register');
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
          <img src={footerLogo || '/logo.svg'} alt="Absolute Soccer" className="h-8 w-auto object-contain" />
          <div>
            <h1 className="text-sm font-bold text-white">Absolute Soccer</h1>
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
            onClick={() => window.open('/reports', '_blank')}
            className="p-1.5 hover:bg-[#2d3547] rounded transition-colors text-amber-400 hover:text-amber-300"
            title="Open Reports (new tab)"
          >
            <BarChart3 size={16} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 hover:bg-[#2d3547] rounded transition-colors">
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => { sessionStorage.removeItem('pos_authenticated'); setIsAuthenticated(false); }} className="p-1.5 hover:bg-[#2d3547] rounded transition-colors text-red-400">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Register Tab Content */}
      {posTab === 'register' && (
        <>
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
              if (e.key === 'Enter' && !showCheckout && !showDiscountModal && posTab === 'register') {
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
                className="w-full pl-10 pr-4 py-2 bg-[#1a2236] border border-[#2d3547] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-color)]"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'ALL' as CategoryTab, label: 'ALL', icon: 'ðŸª' },
                { id: 'FOOTWEAR' as CategoryTab, label: 'FOOTWEAR', icon: 'ðŸ‘Ÿ' },
                { id: 'KITS' as CategoryTab, label: 'KITS', icon: 'ðŸ‘•' },
                { id: 'BALLS' as CategoryTab, label: 'BALLS', icon: 'âš½' },
                { id: 'EQUIPMENT' as CategoryTab, label: 'EQUIPMENT', icon: 'ðŸ›¡ï¸' },
                { id: 'TEAMWEAR' as CategoryTab, label: 'TEAMWEAR', icon: 'ðŸŽ½' },
                { id: 'GLOVES' as CategoryTab, label: 'GLOVES', icon: 'ðŸ§¤' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                    activeCategory === tab.id
                      ? 'bg-[var(--primary-color)] text-white'
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

          {/* Action Tiles */}
          <div className="px-2 py-1.5 border-b border-[#2d3547]">
            <div className="grid grid-cols-3 gap-1.5">
              {/* Add Customer */}
              <button
                onClick={() => setShowCustomerModal(true)}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Add customer to transaction"
              >
                <UserPlus size={16} className="text-blue-400" />
                <span className="text-xs font-semibold text-white leading-none">Add Customer</span>
              </button>

              {/* Gift Card */}
              <button
                onClick={() => setPosTab('gc')}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Issue or redeem gift card"
              >
                <Gift size={16} className="text-purple-400" />
                <span className="text-xs font-semibold text-white leading-none">Gift Card</span>
              </button>

              {/* Add Discount */}
              <button
                onClick={() => setShowDiscountModal(true)}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Apply discount to cart"
              >
                <Tag size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold text-white leading-none">Add Discount</span>
              </button>

              {/* Store Credit */}
              <button
                onClick={() => setPosTab('sc')}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Issue or redeem store credit"
              >
                <CreditCard size={16} className="text-amber-400" />
                <span className="text-xs font-semibold text-white leading-none">Store Credit</span>
              </button>

              {/* Returns */}
              <button
                onClick={() => setShowReturnsModal(true)}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Process product return"
              >
                <RotateCcw size={16} className="text-orange-400" />
                <span className="text-xs font-semibold text-white leading-none">Returns</span>
              </button>

              {/* Clear Cart */}
              <button
                onClick={() => clearCart()}
                className="bg-[#1e2d45] hover:bg-[#2a3954] rounded p-1.5 flex flex-col items-center gap-1 transition-colors h-14"
                title="Remove all items from cart"
              >
                <Trash2 size={16} className="text-red-400" />
                <span className="text-xs font-semibold text-white leading-none">Clear Cart</span>
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-2">
            {productsLoading ? (
              <div className="text-center py-4 text-gray-500 text-xs">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-xs">No products found</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.id);
                  const hasVariants = (productVariants.get(product.id) || []).length > 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        if (hasVariants) {
                          setSelectedProductForSize(product);
                          setShowSizeSelector(true);
                        } else {
                          addItem(product);
                        }
                      }}
                      disabled={stockStatus.isDisabled}
                      className={`rounded p-2 flex flex-col items-center justify-center gap-1 transition-colors group text-center ${
                        stockStatus.isDisabled
                          ? 'bg-[#0d1117] border border-[#1a1a1a] opacity-50 cursor-not-allowed'
                          : 'bg-[#1a2236] hover:bg-[#2d3547] border border-[#2d3547] hover:border-[var(--primary-color)]'
                      }`}
                    >
                      {product.image && (
                        <img src={product.image} alt={product.name} className="h-24 w-auto object-cover rounded bg-[#0f1117]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <span className="text-xs font-semibold text-gray-300 group-hover:text-white line-clamp-2">
                        {product.name}
                      </span>
                      <span className="text-sm font-bold text-[var(--primary-color)]">${product.price?.toFixed(2) || '0.00'}</span>
                      {stockStatus.text && (
                        <span className={`text-xs font-semibold ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Cart */}
        <div className="w-1/2 bg-[#1a2236] flex flex-col overflow-hidden">
          {/* Customer Tag */}
          {selectedCustomer && (
            <div className="px-4 py-3 border-b border-[#2d3547] bg-[#2d3547]">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[var(--primary-color)] rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    <p className="text-xs text-gray-400">Returning customer</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomerId('')}
                  className="p-1 hover:bg-[#1a2236] rounded transition-colors text-gray-400 hover:text-red-400"
                  title="Remove customer from transaction"
                >
                  <X size={16} />
                </button>
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
                        <div className="flex-1">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          {(item.color || item.size) && (
                            <p className="text-xs text-gray-400">
                              {item.color}{item.color && item.size ? ' Â· ' : ''}{item.size && `Size ${item.size}`}
                            </p>
                          )}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-400 p-1 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="w-5 h-5 rounded border border-[#2d3547] text-xs hover:bg-[#2d3547] flex items-center justify-center">âˆ’</button>
                        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="w-5 h-5 rounded border border-[#2d3547] text-xs hover:bg-[#2d3547] flex items-center justify-center">+</button>
                      </div>
                      <p className="text-xs font-bold text-[var(--primary-color)]">${(item.price * item.quantity).toFixed(2)}</p>
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
                  <span>âˆ’${totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Order Discount</span>
                  <span>âˆ’${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400">
                <span>HST {isTaxExempt ? '(Exempt)' : '(13%)'}</span>
                <span>${hst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#2d3547]">
                <span>Total Due</span>
                <span className="text-lg text-[var(--primary-color)]">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setPosTab('gc')} className="px-3 py-2 bg-[#2d3547] hover:bg-[#3d4557] border border-[#2d3547] rounded text-[10px] font-bold text-white flex items-center justify-center gap-1">
                ðŸ’³ GC
              </button>
              <button onClick={() => setPosTab('sc')} className="px-3 py-2 bg-[#2d3547] hover:bg-[#3d4557] border border-[#2d3547] rounded text-[10px] font-bold text-white flex items-center justify-center gap-1">
                ðŸŽŸ SC
              </button>
              <button onClick={() => setShowDiscountModal(true)} className="px-3 py-2 bg-[#2d3547] hover:bg-[#3d4557] border border-[#2d3547] rounded text-[10px] font-bold text-white flex items-center justify-center gap-1">
                <Percent size={14} /> Disc
              </button>
              <button onClick={() => { if (confirm('Clear all items?')) clearCart(); }} disabled={cart.length === 0} className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded text-[10px] font-bold text-white">
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
              className="w-full py-3 bg-[var(--primary-color)] hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm uppercase"
            >
              Checkout ({totalCartItems})
            </button>

            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setShowVoidRefundModal(true)} className="py-2 bg-[var(--primary-color)] hover:bg-red-700 text-white rounded text-[10px] font-bold uppercase">
                Void/Refund
              </button>
              <button onClick={() => setPosTab('returns')} className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                <Undo2 size={12} /> Return
              </button>
              <button onClick={() => setPosTab('history')} className="py-2 border border-[#2d3547] text-gray-300 hover:text-white rounded text-[10px] font-bold uppercase">
                History
              </button>
              <button onClick={openCashDrawer} className="py-2 border border-[#2d3547] text-amber-400 hover:text-amber-300 hover:border-amber-500 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                <Archive size={12} /> Drawer
              </button>
            </div>

            <button onClick={() => setPosTab('customers')} className="w-full py-2 border border-[#2d3547] text-gray-300 hover:text-white rounded text-[10px] font-bold uppercase">
              Customers
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {/* History Tab Content */}
      {posTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#2d3547] bg-[#0f1117]">
            <h2 className="text-sm font-bold text-white">Transaction History</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <PosTransactionHistory />
          </div>
        </div>
      )}

      {/* Returns Tab Content */}
      {posTab === 'returns' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1117]">
          <div className="p-4 border-b border-[#2d3547] bg-[#0f1117]">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Undo2 size={16} /> Process Return
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-300">
                Enter Invoice Number or Scan Barcode
              </label>
              <div className="flex gap-2">
                <input
                  ref={returnsInvoiceInputRef}
                  type="text"
                  placeholder="Invoice # or barcode..."
                  value={returnsInvoiceInput}
                  onChange={(e) => setReturnsInvoiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleReturnsInvoiceLookup(returnsInvoiceInput);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-[#1a2236] border border-[#2d3547] rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleReturnsInvoiceLookup(returnsInvoiceInput)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors"
                >
                  Search
                </button>
              </div>

              {returnsLookupError && (
                <div className="p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
                  {returnsLookupError}
                </div>
              )}

              {returnsFoundTransaction && !showReturnsModal && (
                <div className="p-4 bg-green-900/20 border border-green-500 rounded space-y-2">
                  <p className="text-green-400 font-bold">âœ“ Invoice Found</p>
                  <p className="text-gray-300 text-sm">
                    Invoice: {returnsFoundTransaction.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-gray-300 text-sm">
                    Amount: ${Number(returnsFoundTransaction.total_amount).toFixed(2)}
                  </p>
                  <button
                    onClick={() => setShowReturnsModal(true)}
                    className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors"
                  >
                    Continue to Return
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab Content */}
      {posTab === 'customers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#2d3547] bg-[#0f1117]">
            <h2 className="text-sm font-bold text-white">Customers</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <PosCustomerManager onSelectCustomer={handleSelectCustomer} />
          </div>
        </div>
      )}

      {/* Gift Card Tab Content */}
      {posTab === 'gc' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <GiftCardTab
              onIssueGiftCard={handleIssueGiftCard}
              onRedeemGiftCard={handleRedeemGiftCard}
              cartTotal={grandTotal}
              cartHasItems={cart.length > 0}
            />
          </div>
        </div>
      )}

      {/* Store Credits Tab Content */}
      {posTab === 'sc' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <StoreCreditsTab />
          </div>
        </div>
      )}

      {/* Size Selector Modal */}
      <AnimatePresence>
        {showSizeSelector && selectedProductForSize && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a2236] rounded-lg shadow-xl max-w-md w-full mx-4 border border-[#2d3547]"
            >
              <div className="p-4 border-b border-[#2d3547] flex items-center justify-between bg-[#0f1117]">
                <h2 className="text-sm font-bold">
                  {selectedProductForSize.name} - Select Size
                </h2>
                <button
                  onClick={() => setShowSizeSelector(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {(productVariants.get(selectedProductForSize.id) || [])
                  .sort((a, b) => {
                    const aNum = parseInt(a.size) || 0;
                    const bNum = parseInt(b.size) || 0;
                    return aNum - bNum;
                  })
                  .map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        const variantProduct = {
                          ...selectedProductForSize,
                          id: `var-${variant.id}`,
                          variantId: variant.id,
                          size: variant.size,
                          ageGroup: variant.age_group,
                          stockQuantity: variant.stock_quantity,
                          barcode: variant.barcode,
                        };
                        addItem(variantProduct);
                        setShowSizeSelector(false);
                      }}
                      disabled={variant.stock_quantity <= 0}
                      className={`w-full p-3 rounded flex items-center justify-between transition-colors ${
                        variant.stock_quantity <= 0
                          ? 'bg-[#0d1117] text-gray-500 opacity-50 cursor-not-allowed'
                          : 'bg-[#2d3547] hover:bg-[var(--primary-color)] hover:text-white text-gray-300'
                      }`}
                    >
                      <span className="font-semibold">
                        Size {variant.size || '(no size)'}
                        {variant.color && ` Â· ${variant.color}`}
                        {variant.age_group && ` (${variant.age_group})`}
                      </span>
                      <span className={`text-sm ${
                        variant.stock_quantity > 10
                          ? 'text-gray-400'
                          : variant.stock_quantity > 3
                          ? 'text-amber-400'
                          : variant.stock_quantity > 0
                          ? 'text-red-400'
                          : 'text-gray-500 line-through'
                      }`}>
                        {variant.stock_quantity > 0 ? `(${variant.stock_quantity} left)` : '(Out of Stock)'}
                      </span>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                /* Receipt View - Epson Printer Format */
                <div className="flex-1 flex flex-col overflow-hidden bg-white text-black">
                  <div className="p-4 bg-green-50 border-b border-green-200 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-green-800">Sale Complete</p>
                      <p className="text-[10px] text-green-600 font-bold">{receipt.time} Â· {receipt.method}</p>
                    </div>
                  </div>

                  {receipt.transactionId && (
                    <div className="px-4 py-3 bg-white border-b border-zinc-100 flex justify-center">
                      <Barcode value={receipt.transactionId} width={1.5} height={36} fontSize={10} />
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {receipt.transactionId && (
                      <p className="text-[10px] font-mono text-zinc-500 text-center">
                        TXN: {receipt.transactionId.slice(0, 8).toUpperCase()}
                      </p>
                    )}
                    {receipt.customer && (
                      <p className="text-[10px] font-bold text-black uppercase">
                        Customer: {receipt.customer.first_name} {receipt.customer.last_name}
                      </p>
                    )}

                    <div className="border-t border-dashed border-zinc-300 pt-3 space-y-2">
                      {receipt.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                          <div className="flex-1 pr-3">
                            <p className="font-bold text-black uppercase leading-tight">{item.name}</p>
                            {(item.color || item.size || item.ageGroup) && (
                              <p className="text-zinc-600 font-medium">
                                {item.color && `${item.color}`}{item.color && (item.size || item.ageGroup) ? ' Â· ' : ''}{item.ageGroup && `${item.ageGroup} Â· `}
                                {item.size && `Size ${item.size}`}
                              </p>
                            )}
                            <p className="text-zinc-600">Qty {item.quantity} Ã— ${Number(item.price).toFixed(2)}</p>
                          </div>
                          <p className="font-black text-black shrink-0">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed border-zinc-300 pt-3 space-y-1 text-[10px] font-bold text-zinc-700">
                      <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-red-600"><span>Discount</span><span>âˆ’${discountAmount.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between"><span>HST {receipt.isTaxExempt ? '(Exempt)' : '(13%)'}</span><span>${receipt.hst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm font-black text-black pt-1 border-t border-zinc-300">
                        <span>TOTAL</span><span>${receipt.total.toFixed(2)}</span>
                      </div>
                      {receipt.giftCardAmount && receipt.giftCardAmount > 0 && (
                        <div className="flex justify-between pt-2 border-t border-dashed border-zinc-300 text-amber-600"><span>ðŸ’³ Gift Card</span><span>âˆ’${receipt.giftCardAmount.toFixed(2)}</span></div>
                      )}
                      {receipt.storeCreditAmount && receipt.storeCreditAmount > 0 && (
                        <>
                          <div className="flex justify-between pt-2 border-t border-dashed border-zinc-300 text-blue-600"><span>ðŸŽŸ Store Credit</span><span>âˆ’${receipt.storeCreditAmount.toFixed(2)}</span></div>
                          {receipt.storeCreditNewBalance !== undefined && (
                            <div className="mt-3 p-4 bg-gradient-to-r from-blue-100 to-blue-50 border-4 border-blue-500 rounded-lg text-center space-y-2">
                              <div className="text-[9px] font-bold text-blue-700 uppercase tracking-widest">Store Credit Payment</div>
                              <div className="text-sm text-blue-600">Amount Used: âˆ’${receipt.storeCreditAmount.toFixed(2)}</div>
                              {receipt.storeCreditNewBalance === 0 ? (
                                <div className="text-[18px] font-black text-blue-900 py-2">â˜… STORE CREDIT FULLY REDEEMED â˜…</div>
                              ) : (
                                <div className="py-2 space-y-1">
                                  <div className="text-[18px] font-black text-blue-900">â˜… REMAINING BALANCE: ${receipt.storeCreditNewBalance.toFixed(2)} â˜…</div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {receipt.method === 'Cash' && receipt.tenderedAmount !== undefined && (
                        <>
                          <div className="flex justify-between pt-2 border-t border-dashed border-zinc-300"><span>Cash Received</span><span>${receipt.tenderedAmount.toFixed(2)}</span></div>
                          <div className="flex justify-between text-emerald-600 font-black pt-1"><span>Change Due</span><span>${receipt.changeGiven?.toFixed(2)}</span></div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-200 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePrintReceipt(1)}
                        className="flex-1 flex items-center justify-center gap-1 border border-zinc-200 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors text-black"
                      >
                        <Printer size={13} /> 1 Copy
                      </button>
                      <button
                        onClick={() => handlePrintReceipt(2)}
                        className="flex-1 flex items-center justify-center gap-1 border border-zinc-200 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors text-black"
                      >
                        <Printer size={13} /> 2 Copies
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleOpenGiftReceipt}
                        className="flex-1 flex items-center justify-center gap-1 border border-zinc-200 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors text-black"
                      >
                        <Gift size={13} /> Gift Receipt
                      </button>
                      <button
                        onClick={handleNewTransaction}
                        className="flex-1 bg-[var(--primary-color)] text-white rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                      >
                        New Sale
                      </button>
                    </div>
                  </div>

                  {/* Gift Receipt Modal */}
                  {showGiftReceiptModal && receipt && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-black">
                        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Gift size={16} /> Gift Receipt
                          </h3>
                          <button onClick={() => setShowGiftReceiptModal(false)} className="text-zinc-400 hover:text-zinc-700">
                            <X size={18} />
                          </button>
                        </div>
                        <div className="p-4">
                          <p className="text-[10px] text-zinc-500 mb-3 uppercase tracking-wide font-bold">Select items to include</p>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {receipt.items.map((item, i) => (
                              <label key={i} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-zinc-50">
                                <input
                                  type="checkbox"
                                  checked={giftReceiptSelected.has(i)}
                                  onChange={() => {
                                    const next = new Set(giftReceiptSelected);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    setGiftReceiptSelected(next);
                                  }}
                                  className="mt-0.5 accent-red-600"
                                />
                                <div className="flex-1 text-[11px]">
                                  <p className="font-bold leading-tight">{item.name}</p>
                                  {(item.size || item.ageGroup) && (
                                    <p className="text-zinc-500">{item.ageGroup ? `${item.ageGroup} Â· ` : ''}Size {item.size}</p>
                                  )}
                                  <p className="text-zinc-500">Qty {item.quantity}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 border-t border-zinc-200 flex gap-2">
                          <button
                            onClick={() => setShowGiftReceiptModal(false)}
                            className="flex-1 border border-zinc-200 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePrintGiftReceipt}
                            disabled={giftReceiptSelected.size === 0}
                            className="flex-1 bg-[var(--primary-color)] disabled:bg-zinc-300 text-white rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <Printer size={13} /> Print Gift
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                        <p className="text-gray-400">Qty {item.quantity} Ã— ${Number(item.price).toFixed(2)}</p>
                        <p className="text-[var(--primary-color)] font-bold">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-t border-[#2d3547] space-y-3">
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Discount</span><span>âˆ’${discountAmount.toFixed(2)}</span></div>}
                      <div className="flex justify-between"><span>HST</span><span>${hst.toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-sm border-t border-[#2d3547] pt-1"><span>Total Due</span><span>${grandTotal.toFixed(2)}</span></div>
                    </div>

                    {selectedGiftCard && (
                      <div className="bg-[#2d3547] p-3 rounded-lg border border-amber-500/30 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">ðŸ’³ Gift Card Payment</span>
                          <button
                            onClick={() => setSelectedGiftCard(null)}
                            className="text-amber-400 hover:text-amber-300 text-[11px] font-bold uppercase"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-300">Card: {selectedGiftCard.cardNumber.slice(-4).padStart(selectedGiftCard.cardNumber.length, '*')}</span>
                          <span className="text-amber-400 font-bold">${selectedGiftCard.amount.toFixed(2)}</span>
                        </div>
                        {selectedGiftCard.amount < grandTotal && (
                          <p className="text-[9px] text-amber-300">Remaining due: ${(grandTotal - selectedGiftCard.amount).toFixed(2)}</p>
                        )}
                      </div>
                    )}

                    {selectedStoreCredit && (
                      <div className="bg-[#2d3547] p-3 rounded-lg border border-blue-500/30 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">ðŸŽŸ Store Credit Payment</span>
                          <button
                            onClick={() => setSelectedStoreCredit(null)}
                            className="text-blue-400 hover:text-blue-300 text-[11px] font-bold uppercase"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-300">Credit: {selectedStoreCredit.id.slice(-4).padStart(8, '*')}</span>
                          <span className="text-blue-400 font-bold">${selectedStoreCredit.amount.toFixed(2)}</span>
                        </div>
                        {selectedStoreCredit.amount < grandTotal && (
                          <p className="text-[9px] text-blue-300">Remaining due: ${(grandTotal - selectedStoreCredit.amount).toFixed(2)}</p>
                        )}
                      </div>
                    )}

                    {/* Show message if SC is applied */}
                    {selectedStoreCredit && (
                      <div className={`border-2 rounded-lg p-3 mb-3 space-y-2 ${scRemainingBalance === 0 ? 'bg-green-900/30 border-green-500' : 'bg-blue-900/30 border-blue-500'}`}>
                        <div className={`text-[9px] font-bold uppercase ${scRemainingBalance === 0 ? 'text-green-300' : 'text-blue-300'}`}>
                          Store Credit Applied
                        </div>
                        <div className="flex justify-between text-[10px] text-white">
                          <span>SC Used:</span>
                          <span className="font-bold">-${selectedStoreCredit.amount.toFixed(2)}</span>
                        </div>
                        {scRemainingBalance > 0 && (
                          <>
                            <div className={`border-t ${scRemainingBalance === 0 ? 'border-green-500/30' : 'border-blue-500/30'} pt-2 flex justify-between text-[10px] font-bold`}>
                              <span className={scRemainingBalance === 0 ? 'text-green-300' : 'text-blue-300'}>Remaining to Pay:</span>
                              <span className={scRemainingBalance === 0 ? 'text-green-400' : 'text-blue-400'}>${scRemainingBalance.toFixed(2)}</span>
                            </div>
                            <div className="text-[9px] text-blue-300 italic">Select a payment method below to collect the remaining amount</div>
                          </>
                        )}
                        {scRemainingBalance === 0 && (
                          <div className="text-[9px] text-green-300 font-bold italic">âœ… Store credit fully covers this transaction. Click "Complete Sale" below.</div>
                        )}
                      </div>
                    )}

                    {/* If SC fully covers amount, show Complete Sale button instead of payment methods */}
                    {selectedStoreCredit && scRemainingBalance === 0 ? (
                      <button
                        onClick={() => handleConfirmSale('Store Credit')}
                        disabled={isConfirming}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white p-3 rounded font-bold text-sm uppercase mb-3"
                      >
                        âœ… Complete Sale (Store Credit)
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Store Credit'].map(method => (
                          <button
                            key={method}
                            disabled={isConfirming || (selectedStoreCredit && method === 'Store Credit')}
                            onClick={() => handleConfirmSale(method)}
                            className="bg-[var(--primary-color)] hover:bg-red-700 disabled:opacity-50 text-white p-2 rounded font-bold text-[9px] uppercase"
                            title={selectedStoreCredit && method === 'Store Credit' ? 'SC already applied' : ''}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowCheckout(false);
                        setPosTab('gc');
                      }}
                      disabled={isConfirming}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white p-2 rounded font-bold text-[9px] uppercase"
                    >
                      ðŸ’³ Redeem Gift Card
                    </button>

                    <button
                      onClick={() => {
                        setShowCheckout(false);
                        setPosTab('sc');
                      }}
                      disabled={isConfirming}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded font-bold text-[9px] uppercase"
                    >
                      ðŸŽŸ Redeem Store Credit
                    </button>
                  </div>

                  {/* Cash Calculator Modal */}
                  <AnimatePresence>
                    {showCashCalculator && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-lg">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1a2236] p-6 rounded-lg shadow-2xl w-full max-w-sm space-y-4 border border-[#2d3547]">
                          <div className="text-center">
                            <h2 className="text-sm font-black uppercase text-white mb-2">Cash Payment</h2>
                            <p className="text-xs text-gray-300">Total Due: <span className="text-[var(--primary-color)] text-base">${grandTotal.toFixed(2)}</span></p>
                          </div>

                          {/* Amount Tendered Input */}
                          <div className="space-y-2">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">Amount Tendered</label>
                            <input
                              type="number"
                              value={cashTendered}
                              onChange={e => setCashTendered(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full p-3 text-2xl font-black text-center bg-[#0f1117] border-2 border-[#2d3547] rounded text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                              autoFocus
                            />
                          </div>

                          {/* Preset Buttons */}
                          <div className="space-y-2">
                            <p className="text-[8px] font-bold text-gray-500 uppercase">Quick Select</p>
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
                                  className="p-2 bg-[#2d3547] hover:bg-[#3d4557] rounded text-xs font-bold uppercase text-white transition-colors"
                                >
                                  {btn.label}
                                  {btn.label !== 'Exact' && <div className="text-[8px] text-gray-400">${btn.amount.toFixed(2)}</div>}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Change Due / Amount Short Display */}
                          {cashTendered !== '' && (
                            <div className="p-3 rounded text-center bg-[#0f1117] border-2 border-[#2d3547]">
                              {cashTendered >= grandTotal ? (
                                <div>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Change Due</p>
                                  <p className="text-2xl font-black text-emerald-500">${(cashTendered - grandTotal).toFixed(2)}</p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Amount Short</p>
                                  <p className="text-2xl font-black text-red-500">${(grandTotal - cashTendered).toFixed(2)}</p>
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
                              className="flex-1 p-2 bg-[#2d3547] hover:bg-[#3d4557] rounded text-xs font-bold uppercase text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={cashTendered === '' || (typeof cashTendered === 'number' && cashTendered < grandTotal) || isConfirming}
                              onClick={() => {
                                if (typeof cashTendered === 'number' && pendingPaymentMethod) {
                                  processPayment(pendingPaymentMethod, cashTendered);
                                }
                              }}
                              className="flex-1 p-2 bg-[var(--primary-color)] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold uppercase text-white transition-colors"
                            >
                              {isConfirming ? 'Processing...' : 'Complete Sale'}
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Store Credit Selection Modal - With Scan/Search Tabs */}
                  <AnimatePresence>
                    {showStoreCreditModal && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-lg z-50">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1a2236] p-6 rounded-lg shadow-2xl w-full max-w-lg space-y-4 border border-[#2d3547] max-h-[90vh] overflow-y-auto">
                          <div className="text-center">
                            <h2 className="text-sm font-black uppercase text-white mb-2">Select Store Credit</h2>
                            <p className="text-xs text-gray-300">Total Due: <span className="text-[var(--primary-color)] text-base">${grandTotal.toFixed(2)}</span></p>
                          </div>

                          {storeCreditError && (
                            <div className="p-3 bg-red-900/20 border border-red-600 rounded text-red-400 text-[10px] font-bold">
                              {storeCreditError}
                            </div>
                          )}

                          {/* Tab Navigation */}
                          <div className="flex gap-2 border-b border-[#2d3547]">
                            <button
                              onClick={() => {
                                setScModalTab('customer');
                                setScScanInput('');
                                setScSearchInput('');
                                setScSearchResults([]);
                                setStoreCreditError(null);
                              }}
                              className={`flex-1 py-2 px-3 text-xs font-bold uppercase border-b-2 transition-colors ${
                                scModalTab === 'customer'
                                  ? 'border-blue-500 text-blue-400'
                                  : 'border-transparent text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              Customer
                            </button>
                            <button
                              onClick={() => {
                                setScModalTab('scan');
                                setScScanInput('');
                                setScSearchResults([]);
                                setStoreCreditError(null);
                              }}
                              className={`flex-1 py-2 px-3 text-xs font-bold uppercase border-b-2 transition-colors ${
                                scModalTab === 'scan'
                                  ? 'border-blue-500 text-blue-400'
                                  : 'border-transparent text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              Scan Code
                            </button>
                            <button
                              onClick={() => {
                                setScModalTab('search');
                                setScSearchInput('');
                                setScSearchResults([]);
                                setStoreCreditError(null);
                              }}
                              className={`flex-1 py-2 px-3 text-xs font-bold uppercase border-b-2 transition-colors ${
                                scModalTab === 'search'
                                  ? 'border-blue-500 text-blue-400'
                                  : 'border-transparent text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              Search
                            </button>
                          </div>

                          {/* TAB 1: CUSTOMER (Original Flow) */}
                          {scModalTab === 'customer' && (
                            <div className="space-y-3">
                              {selectedCustomerId ? (
                                <>
                                  <div className="text-xs text-blue-400 font-semibold">
                                    Credits for: {safeCustomers.find(c => c.id === selectedCustomerId)?.first_name} {safeCustomers.find(c => c.id === selectedCustomerId)?.last_name}
                                  </div>
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {availableStoreCredits.length > 0 ? (
                                      availableStoreCredits.map((credit) => (
                                        <button
                                          key={credit.id}
                                          onClick={() => applyStoreCredit(credit)}
                                          className="w-full p-3 bg-[#2d3547] hover:bg-[#3d4557] rounded text-left border border-[#3d4557] transition-colors"
                                        >
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <p className="text-white font-bold text-sm">Credit #{credit.id.slice(0, 8)}</p>
                                              <p className="text-gray-400 text-xs">{credit.reason}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-white font-bold">${credit.remaining_balance.toFixed(2)}</p>
                                              <p className="text-gray-400 text-xs">Available</p>
                                            </div>
                                          </div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="text-center py-6 text-gray-400 text-xs">
                                        No store credits available
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="text-center py-8 text-gray-400 text-xs space-y-2">
                                  <p>No customer selected</p>
                                  <p>Use "Scan Code" or "Search" tabs instead</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: SCAN CODE */}
                          {scModalTab === 'scan' && (
                            <div className="space-y-3">
                              <div className="text-xs text-gray-400 italic">Scan barcode code OR enter customer first/last name</div>
                              <input
                                type="text"
                                value={scScanInput}
                                onChange={(e) => setScScanInput(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') handleScScan(scScanInput);
                                }}
                                placeholder="e.g., SC-123456789012 or Diana"
                                autoFocus
                                className="w-full p-3 bg-[#0f1117] border-2 border-[#2d3547] rounded text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                              />
                              <button
                                onClick={() => handleScScan(scScanInput)}
                                disabled={scLookupLoading || !scScanInput.trim()}
                                className="w-full p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold uppercase text-white transition-colors"
                              >
                                {scLookupLoading ? 'Looking up...' : 'Lookup'}
                              </button>
                            </div>
                          )}

                          {/* TAB 3: SEARCH */}
                          {scModalTab === 'search' && (
                            <div className="space-y-3">
                              <div className="text-xs text-gray-400 italic">Search by customer name or credit code</div>
                              <input
                                type="text"
                                value={scSearchInput}
                                onChange={(e) => {
                                  setScSearchInput(e.target.value);
                                  handleScSearch(e.target.value);
                                }}
                                placeholder="Search..."
                                autoFocus
                                className="w-full p-3 bg-[#0f1117] border-2 border-[#2d3547] rounded text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                              />
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {scLookupLoading ? (
                                  <div className="text-center py-4 text-gray-400 text-xs">Searching...</div>
                                ) : scSearchResults.length > 0 ? (
                                  scSearchResults.map((credit) => (
                                    <button
                                      key={credit.id}
                                      onClick={() => applyStoreCredit(credit)}
                                      className="w-full p-3 bg-[#2d3547] hover:bg-[#3d4557] rounded text-left border border-[#3d4557] transition-colors"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="text-white font-bold text-sm">
                                            {credit.card_number ? `#${credit.card_number.slice(-6).padStart(8, '*')}` : `#${credit.id.slice(0, 8)}`}
                                          </p>
                                          {credit.customers && (
                                            <p className="text-blue-400 text-xs font-semibold">
                                              {credit.customers.first_name} {credit.customers.last_name}
                                            </p>
                                          )}
                                          {credit.created_at && (
                                            <p className="text-gray-500 text-xs">Issued: {new Date(credit.created_at).toLocaleDateString()}</p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <p className="text-white font-bold">${credit.remaining_balance.toFixed(2)}</p>
                                          <p className="text-gray-400 text-xs">Available</p>
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                ) : scSearchInput.trim() ? (
                                  <div className="text-center py-6 text-gray-400 text-xs">
                                    No store credits found
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-gray-400 text-xs">
                                    Type to search...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-4 border-t border-[#2d3547]">
                            <button
                              onClick={() => {
                                setShowStoreCreditModal(false);
                                setSelectedStoreCredit(null);
                                setScScanInput('');
                                setScSearchInput('');
                                setScSearchResults([]);
                                setScModalTab('customer');
                                setStoreCreditError(null);
                              }}
                              className="flex-1 p-2 bg-[#2d3547] hover:bg-[#3d4557] rounded text-xs font-bold uppercase text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </div>
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
                <button disabled={isAddingCustomer} onClick={handleAddCustomer} className="flex-1 p-2 bg-[var(--primary-color)] hover:bg-red-700 disabled:opacity-50 rounded text-xs font-bold text-white uppercase">
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
                <h2 className="text-sm font-bold text-white uppercase">Void, Refund, or Return Transaction</h2>
                <button onClick={() => setShowVoidRefundModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>

              {recentTransactions.length === 0 ? (
                <p className="text-gray-400 text-sm">No recent transactions to void/refund/return</p>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="bg-[#0f1117] border border-[#2d3547] p-3 rounded flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{tx.method} Â· ${Number(tx.total_amount).toFixed(2)} <span className="text-[10px] text-gray-400">({tx.status || 'completed'})</span></p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                        {tx.customer_id && (
                          <p className="text-[10px] text-gray-400">
                            Customer: {tx.customer_id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { handleVoidRefundReturn(tx.id, 'void'); }}
                          disabled={tx.status === 'voided' || tx.status === 'refunded' || tx.status === 'returned'}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[10px] font-bold uppercase"
                          title={tx.status === 'voided' ? 'Already voided' : tx.status === 'refunded' ? 'Already refunded' : tx.status === 'returned' ? 'Already returned' : 'Void this transaction'}
                        >
                          Void
                        </button>
                        <button
                          onClick={() => { setSelectedTransactionForRefund(tx); setShowVoidRefundModal(false); }}
                          disabled={tx.status === 'refunded' || tx.status === 'returned'}
                          className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[10px] font-bold uppercase"
                          title={tx.status === 'refunded' ? 'Already refunded' : tx.status === 'returned' ? 'Already returned' : 'Refund this transaction'}
                        >
                          Refund
                        </button>
                        <button
                          onClick={() => { handleVoidRefundReturn(tx.id, 'return'); }}
                          disabled={tx.status === 'returned'}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[10px] font-bold uppercase"
                          title={tx.status === 'returned' ? 'Already returned' : 'Return this transaction'}
                        >
                          Return
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

      {/* Returns Modal */}
      {showReturnsModal && (
        <ReturnsModal
          isOpen={showReturnsModal}
          onClose={handleReturnsComplete}
          prefilledTransactionId={returnsFoundTransaction?.id}
          prefilledCustomerId={returnsFoundTransaction?.customer_id || undefined}
          onComplete={handleReturnsComplete}
        />
      )}

      {/* Refund Modal (from Void/Refund history) */}
      {selectedTransactionForRefund && (
        <ReturnsModal
          mode="refund"
          isOpen={!!selectedTransactionForRefund}
          onClose={handleRefundModalClose}
          prefilledTransaction={selectedTransactionForRefund}
          onComplete={handleRefundModalClose}
        />
      )}

      {/* Bottom Tab Bar */}
      <div className="bg-[#1a2236] border-t border-[#2d3547] h-12 px-6 flex items-center justify-start gap-2">
        <button
          onClick={() => setPosTab('register')}
          className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
            posTab === 'register'
              ? 'bg-[var(--primary-color)] text-white'
              : 'bg-[#2d3547] text-gray-400 hover:text-white'
          }`}
        >
          Register
        </button>
        <button
          onClick={() => setPosTab('history')}
          className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
            posTab === 'history'
              ? 'bg-[var(--primary-color)] text-white'
              : 'bg-[#2d3547] text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setPosTab('customers')}
          className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
            posTab === 'customers'
              ? 'bg-[var(--primary-color)] text-white'
              : 'bg-[#2d3547] text-gray-400 hover:text-white'
          }`}
        >
          Customers
        </button>
        <button
          onClick={() => setPosTab('gc')}
          className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
            posTab === 'gc'
              ? 'bg-[var(--primary-color)] text-white'
              : 'bg-[#2d3547] text-gray-400 hover:text-white'
          }`}
        >
          ðŸ’³ Gift Cards
        </button>
        <button
          onClick={() => setPosTab('sc')}
          className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
            posTab === 'sc'
              ? 'bg-[var(--primary-color)] text-white'
              : 'bg-[#2d3547] text-gray-400 hover:text-white'
          }`}
        >
          ðŸŽŸ Store Credit
        </button>
      </div>
    </div>
  );
}
