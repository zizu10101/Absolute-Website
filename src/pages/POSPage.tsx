import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Moon, Sun, LogOut, Search, Users, Percent, FileText, Trash2,
  Barcode as BarcodeIcon, DollarSign, Home, AlertCircle, X, Check,
  Receipt, RotateCcw, RefreshCw, Plus, Printer, ScanLine, CheckCircle2, BarChart3, Undo2,
  UserPlus, Gift, Tag, CreditCard, ChevronDown, BarChart2, Menu
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
import { generateThermalReceiptHTML } from '../utils/thermalReceipt';

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
  storeCreditCardNumber?: string;
  barcodeValue?: string;
}

export function POSPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [posTab, setPosTab] = useState<'register' | 'history' | 'customers' | 'gc' | 'sc' | 'returns'>('register');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedGiftCard, setSelectedGiftCard] = useState<{ cardNumber: string; amount: number } | null>(null);
  const [selectedStoreCredit, setSelectedStoreCredit] = useState<{ id: string; amount: number; balance: number; cardNumber?: string } | null>(null);
  const [availableStoreCredits, setAvailableStoreCredits] = useState<any[]>([]);
  const [showStoreCreditModal, setShowStoreCreditModal] = useState(false);
  const [storeCreditError, setStoreCreditError] = useState<string | null>(null);
  const [scModalTab, setScModalTab] = useState<'customer' | 'scan' | 'search'>('customer');
  const [scScanInput, setScScanInput] = useState('');
  const [scSearchInput, setScSearchInput] = useState('');
  const [scSearchResults, setScSearchResults] = useState<any[]>([]);
  const [scLookupLoading, setScLookupLoading] = useState(false);
  const [scRemainingBalance, setScRemainingBalance] = useState(0);
  const [scSecondPaymentMethod, setScSecondPaymentMethod] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierName] = useState('Cashier');
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showOnlineOnly, setShowOnlineOnly] = useState(() => {
    const saved = localStorage.getItem('pos_show_online_only');
    return saved ? JSON.parse(saved) : false;
  });
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeSuccess, setBarcodeSuccess] = useState<string | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ first_name: '', last_name: '', email: '', phone: '', club_affinity: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);
  const [showVoidRefundModal, setShowVoidRefundModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [selectedTransactionForVoid, setSelectedTransactionForVoid] = useState<any | null>(null);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [returnsInvoiceInput, setReturnsInvoiceInput] = useState('');
  const [returnsFoundTransaction, setReturnsFoundTransaction] = useState<any | null>(null);
  const [returnsLookupError, setReturnsLookupError] = useState<string | null>(null);
  const returnsInvoiceInputRef = useRef<HTMLInputElement>(null);

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
  const { logo } = useSettings();
  const safeCustomers = Array.isArray(customers) ? customers : [];

  // AUTH
  useEffect(() => {
    const stored = sessionStorage.getItem('pos_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pos_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('pos_show_online_only', JSON.stringify(showOnlineOnly));
  }, [showOnlineOnly]);

  // FETCH TRANSACTIONS
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

  // FETCH PRODUCTS
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
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  // AUTO-FOCUS BARCODE
  useEffect(() => {
    if (!showCheckout && !showDiscountModal && posTab === 'register') {
      barcodeInputRef.current?.focus();
    }
  }, [showCheckout, showDiscountModal, posTab]);

  // ===== BARCODE SCANNING LOGIC (KEEP INTACT) =====
  const handleBarcodeScan = async (rawBarcode: string) => {
    const barcode = rawBarcode.trim().toUpperCase();
    if (!barcode) return;
    setBarcodeError(null);
    setBarcodeSuccess(null);

    try {
      // STORE CREDIT BARCODE
      if (barcode.startsWith('SC-')) {
        setShowStoreCreditModal(true);
        setScModalTab('scan');
        setScScanInput(barcode);
        setBarcodeSuccess(`Opening Store Credit lookup for: ${barcode}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
        setBarcodeInput('');
        return;
      }

      // INVOICE/TRANSACTION BARCODE
      if (barcode.startsWith('INV-') || /^INV-\d+$/.test(barcode)) {
        setShowReturnsModal(true);
        setReturnsInvoiceInput(barcode);
        setBarcodeSuccess(`Opening Returns for invoice: ${barcode}`);
        setTimeout(() => setBarcodeSuccess(null), 2000);
        setBarcodeInput('');
        return;
      }

      // UUID DETECTION
      const isUUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(barcode);
      if (isUUID) {
        setBarcodeError('❌ That appears to be a transaction UUID. Please scan the invoice barcode (INV-XXXXX) instead.');
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
          ageGroup: variant.age_group,
          stockQuantity: stock,
          barcode: variant.barcode,
          quantity: 1,
        };
      } else if (productByCode) {
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
        const sizeText = cartItem.size ? ` · Sz ${cartItem.size}` : '';
        setBarcodeSuccess(`Added: ${cartItem.name}${sizeText}`);
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

  // CATEGORY MATCHING
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

  // VOID/REFUND/RETURN
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
      console.error('Error:', e.message);
      alert(`Error: ${e.message}`);
    }
  };

  // RETURNS INVOICE LOOKUP
  const handleReturnsInvoiceLookup = async (invoiceId: string) => {
    const input = invoiceId.trim();
    if (!input) {
      setReturnsLookupError('Please enter invoice number or scan barcode');
      return;
    }

    try {
      setReturnsLookupError(null);

      const isUUID = input.length === 36 && input.includes('-') && !input.startsWith('INV-');
      if (isUUID) {
        setReturnsLookupError('❌ Please scan the invoice barcode, not the transaction UUID');
        return;
      }

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

  // FILTER PRODUCTS
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (showOnlineOnly && p.is_online !== true) return false;
      if (!matchesCategory(p, activeCategory)) return false;
      const q = searchQuery.toLowerCase();
      return !q || p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    });
  }, [products, activeCategory, searchQuery, showOnlineOnly]);

  // FILTER CUSTOMERS
  const filteredCustomers = useMemo(() => {
    return safeCustomers.filter(c =>
      `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [safeCustomers, customerSearchTerm]);

  // CONFIRM SALE
  const handleConfirmSale = async (method: string) => {
    if (method === 'Cash') {
      setShowCashCalculator(true);
      setPendingPaymentMethod(method);
      setCashTendered('');
      return;
    }

    if (method === 'Store Credit') {
      let hasCustomerCredits = false;

      if (selectedCustomerId) {
        try {
          const { data: credits, error } = await supabase
            .from('store_credits')
            .select('*')
            .eq('customer_id', selectedCustomerId)
            .eq('is_active', true);

          if (error) throw error;

          const filteredCredits = (credits || []).filter(
            (c: any) => c.is_active && c.remaining_balance > 0
          );

          setAvailableStoreCredits(filteredCredits);
          hasCustomerCredits = filteredCredits.length > 0;
        } catch (err: any) {
          console.error('Error fetching customer store credits:', err);
          setAvailableStoreCredits([]);
        }
      } else {
        setAvailableStoreCredits([]);
      }

      setScModalTab(hasCustomerCredits ? 'customer' : 'scan');
      setScScanInput('');
      setScSearchInput('');
      setScSearchResults([]);
      setStoreCreditError(null);
      setShowStoreCreditModal(true);
      return;
    }

    await processPayment(method);
  };

  // STORE CREDIT SCAN
  const handleScScan = async (code: string) => {
    if (!code.trim()) return;

    setScLookupLoading(true);
    setStoreCreditError(null);

    try {
      const searchCode = code.trim();

      if (searchCode.startsWith('INV-') || /^INV-\d+$/.test(searchCode)) {
        setStoreCreditError(
          '⛔ This is an invoice barcode, not a store credit.\n\n' +
          'Invoice codes are in format: INV-XXXXX\n\n' +
          'To process a return or look up a transaction, use the Returns tab instead.'
        );
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(searchCode)) {
        setStoreCreditError(
          '❌ This is a transaction receipt barcode, not a store credit.\n\n' +
          'Store Credit codes are in format: SC-XXXXXXXXXXXX\n\n' +
          'Please scan the STORE CREDIT receipt instead.'
        );
        return;
      }

      const { data: byCardNumber, error: cardError } = await supabase
        .from('store_credits')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('card_number', searchCode)
        .eq('is_active', true)
        .gt('remaining_balance', 0)
        .single();

      let data = byCardNumber;

      if (!byCardNumber && cardError?.code === 'PGRST116') {
        const { data: byCustomer, error: customerError } = await supabase
          .from('store_credits')
          .select('*, customers(first_name, last_name, email, phone)')
          .eq('is_active', true)
          .gt('remaining_balance', 0);

        if (!customerError && byCustomer) {
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

      const amount = Math.min(data.remaining_balance, grandTotal);
      const storeCreditData = { id: data.id, amount, balance: data.remaining_balance, cardNumber: data.card_number };
      setSelectedStoreCredit(storeCreditData);

      if (!selectedCustomerId && data.customer_id) {
        setSelectedCustomerId(data.customer_id);
      }

      setShowStoreCreditModal(false);
      setScScanInput('');
    } catch (err: any) {
      console.error('SC SCAN ERROR:', err);
      setStoreCreditError('Error scanning store credit: ' + err.message);
    } finally {
      setScLookupLoading(false);
    }
  };

  // STORE CREDIT SEARCH
  const handleScSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setScSearchResults([]);
      return;
    }

    setScLookupLoading(true);
    setStoreCreditError(null);

    try {
      const searchLower = searchTerm.trim().toLowerCase();

      const { data: allCredits, error } = await supabase
        .from('store_credits')
        .select('*, customers(first_name, last_name, email, phone)')
        .eq('is_active', true)
        .gt('remaining_balance', 0);

      if (error) throw error;

      const results = (allCredits || []).filter(credit =>
        credit.customers?.first_name?.toLowerCase().includes(searchLower) ||
        credit.customers?.last_name?.toLowerCase().includes(searchLower) ||
        credit.card_number?.toLowerCase().includes(searchLower) ||
        credit.customers?.email?.toLowerCase().includes(searchLower) ||
        credit.customers?.phone?.includes(searchTerm)
      );

      setScSearchResults(results);
    } catch (err: any) {
      console.error('SC SEARCH ERROR:', err);
      setStoreCreditError('Error searching store credits: ' + err.message);
    } finally {
      setScLookupLoading(false);
    }
  };

  // SELECT STORE CREDIT FROM SEARCH
  const handleSelectStoreCreditFromSearch = (credit: any) => {
    const amount = Math.min(credit.remaining_balance, grandTotal);
    const storeCreditData = { id: credit.id, amount, balance: credit.remaining_balance, cardNumber: credit.card_number };
    setSelectedStoreCredit(storeCreditData);

    if (!selectedCustomerId && credit.customer_id) {
      setSelectedCustomerId(credit.customer_id);
    }

    setShowStoreCreditModal(false);
    setScSearchInput('');
    setScSearchResults([]);
  };

  // PROCESS PAYMENT
  const processPayment = async (method: string, tenderedAmount?: number) => {
    setIsConfirming(true);

    try {
      const capturedStoreCredit = selectedStoreCredit || null;
      const capturedGiftCard = selectedGiftCard || null;

      setIsConfirming(true);
      const cartItemsPayload = cart.map(item => ({
        ...item,
        price: Number(item.price),
        originalPrice: Number(item.originalPrice),
      }));

      try {
        let amountAfterGiftCard = capturedGiftCard
          ? Math.max(0, grandTotal - capturedGiftCard.amount)
          : grandTotal;

        let amountAfterStoreCredit = amountAfterGiftCard;
        let storeCreditUsed = 0;

        if (capturedStoreCredit) {
          storeCreditUsed = Math.min(capturedStoreCredit.amount, amountAfterGiftCard);
          amountAfterStoreCredit = amountAfterGiftCard - storeCreditUsed;
          setScRemainingBalance(amountAfterStoreCredit);
        } else {
          setScRemainingBalance(0);
        }

        const amountToCharge = method === 'Store Credit' ? 0 : amountAfterStoreCredit;
        const changeGiven = method === 'Cash' && tenderedAmount ? Math.max(0, tenderedAmount - amountToCharge) : 0;

        const selectedCustomer = selectedCustomerId
          ? safeCustomers.find(c => c.id === selectedCustomerId)
          : null;

        const { data: result, error: insertErr } = await supabase
          .from('transactions')
          .insert([
            {
              customer_id: selectedCustomerId || null,
              items: cartItemsPayload,
              total_amount: grandTotal,
              method: method,
              status: 'completed',
              tendered_amount: method === 'Cash' ? tenderedAmount : null,
              change_given: changeGiven,
            },
          ])
          .select();

        if (insertErr) throw insertErr;

        if (method === 'Store Credit' && capturedStoreCredit && amountAfterStoreCredit === 0) {
          const redeemAmount = Math.min(capturedStoreCredit.amount, grandTotal);
          const { error: redeemErr } = await fetch('/api/store-credits/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creditId: capturedStoreCredit.id,
              amount: redeemAmount,
              transactionId: result?.[0]?.id,
            }),
          }).then(r => r.json());
        }

        if (selectedGiftCard) {
          const newBalance = Math.max(0, selectedGiftCard.amount - (grandTotal - (capturedStoreCredit ? capturedStoreCredit.amount : 0)));

          const { error: updateErr } = await supabase
            .from('gift_cards')
            .update({
              current_balance: newBalance,
              is_active: newBalance > 0,
            })
            .eq('card_number', selectedGiftCard.cardNumber);

          if (updateErr) throw updateErr;
        }

        const receiptData: Receipt = {
          transactionId: result?.[0]?.id,
          invoiceNumber: result?.[0]?.invoice_number,
          method: method,
          items: cartItemsPayload,
          subtotal: subtotal,
          hst: hst,
          total: grandTotal,
          isTaxExempt: isTaxExempt,
          customer: selectedCustomer,
          time: new Date().toLocaleTimeString(),
          tenderedAmount: method === 'Cash' ? tenderedAmount : undefined,
          changeGiven: changeGiven,
          giftCardAmount: capturedGiftCard?.amount,
          giftCardNumber: capturedGiftCard?.cardNumber,
          storeCreditAmount: capturedStoreCredit?.amount,
          storeCreditId: capturedStoreCredit?.id,
          storeCreditCardNumber: capturedStoreCredit?.cardNumber,
          barcodeValue: result?.[0]?.invoice_number,
        };

        setReceipt(receiptData);
        setShowCheckout(false);

        clearCart();
        setSelectedCustomerId('');
        setSelectedGiftCard(null);
        setSelectedStoreCredit(null);
        setShowCashCalculator(false);

        setTimeout(() => {
          handlePrintReceipt(receiptData);
        }, 500);
      } catch (err: any) {
        console.error('Payment processing error:', err);
        alert('Error processing payment: ' + err.message);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  // PRINT RECEIPT
  const handlePrintReceipt = (receiptData: Receipt = receipt!) => {
    if (!receiptData) return;

    const html = generateThermalReceiptHTML({
      transactionId: receiptData.transactionId,
      invoiceNumber: receiptData.invoiceNumber,
      customerName: receiptData.customer ? `${receiptData.customer.first_name} ${receiptData.customer.last_name}` : 'Walk-in Customer',
      items: receiptData.items,
      subtotal: receiptData.subtotal,
      hst: receiptData.hst,
      total: receiptData.total,
      paymentMethod: receiptData.method,
      createdAt: new Date(),
      status: 'completed',
      logoUrl: logo,
      isTaxExempt: receiptData.isTaxExempt,
      tenderedAmount: receiptData.tenderedAmount,
      changeGiven: receiptData.changeGiven,
      giftCardAmount: receiptData.giftCardAmount,
      giftCardNumber: receiptData.giftCardNumber,
      storeCreditAmount: receiptData.storeCreditAmount,
      storeCreditCardNumber: receiptData.storeCreditCardNumber,
      barcodeValue: receiptData.barcodeValue,
    });

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  const handleNewTransaction = () => {
    setReceipt(null);
    setShowCheckout(false);
    clearCart();
    setSelectedCustomerId('');
    setSelectedGiftCard(null);
    setSelectedStoreCredit(null);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const selectedCustomer = selectedCustomerId ? safeCustomers.find(c => c.id === selectedCustomerId) : null;

  // ===== SHOPIFY POS REDESIGN JSX =====
  if (!isAuthenticated) {
    return <POSPinEntry onAuthenticate={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f1117] text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* TOP HEADER BAR */}
      <header className="h-16 bg-[#1a2236] border-b border-[#2d3547] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#2563eb] flex items-center justify-center text-xs font-bold">AS</div>
          <div>
            <p className="text-sm font-bold">Absolute Soccer</p>
            <p className="text-xs text-[#94a3b8]">Mississauga</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
          <span>Cashier</span>
          <span>•</span>
          <span>Online</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-[#2d3547] rounded transition-colors" title="Reports">
            <BarChart2 size={18} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-[#2d3547] rounded transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => { sessionStorage.removeItem('pos_authenticated'); window.location.reload(); }} className="p-2 hover:bg-[#2d3547] rounded transition-colors text-red-500" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT - TWO COLUMN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL (55%) - PRODUCTS & ACTIONS */}
        {posTab === 'register' && !showCheckout && (
          <div className="w-[55%] flex flex-col bg-[#0f1117] border-r border-[#2d3547] overflow-hidden">
            {/* SEARCH BAR */}
            <div className="p-4 border-b border-[#2d3547] flex-shrink-0">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-3 text-[#94a3b8]" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBarcodeScan(barcodeInput)}
                  placeholder="Scan barcode or search..."
                  className="w-full bg-[#1a2236] border border-[#2d3547] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>
              {barcodeError && <p className="text-red-400 text-xs mt-2">{barcodeError}</p>}
              {barcodeSuccess && <p className="text-green-400 text-xs mt-2">{barcodeSuccess}</p>}
            </div>

            {/* ACTION TILES - 2x3 GRID */}
            <div className="p-4 grid grid-cols-2 gap-3 flex-shrink-0">
              <button onClick={() => setShowCustomerModal(true)} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <UserPlus size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Add Customer</span>
              </button>
              <button onClick={() => { setPosTab('gc'); }} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <Gift size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Gift Card</span>
              </button>
              <button onClick={() => setShowDiscountModal(true)} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <Tag size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Add Discount</span>
              </button>
              <button onClick={() => { setPosTab('sc'); }} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <CreditCard size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Store Credit</span>
              </button>
              <button onClick={() => { setPosTab('returns'); }} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <RotateCcw size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Returns</span>
              </button>
              <button onClick={() => clearCart()} className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1e2d45] hover:bg-[#2d3d55] rounded-lg transition-colors border border-[#2d3547]">
                <Trash2 size={24} className="text-[#94a3b8]" />
                <span className="text-xs font-bold text-center">Clear Cart</span>
              </button>
            </div>

            {/* PRODUCTS GRID */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProducts.slice(0, 30).map(product => (
                <div
                  key={product.id}
                  onClick={() => addItem({ ...product, quantity: 1, id: product.id, price: product.isOnSale && product.salePrice ? product.salePrice : product.price, originalPrice: product.price })}
                  className="p-3 bg-[#1a2236] hover:bg-[#2a3246] border border-[#2d3547] rounded cursor-pointer transition-colors"
                >
                  <p className="text-sm font-bold truncate">{product.name}</p>
                  <p className="text-xs text-[#94a3b8]">${(product.isOnSale && product.salePrice ? product.salePrice : product.price).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT PANEL (45%) - CART & CHECKOUT */}
        <div className={`${posTab === 'register' && !showCheckout ? 'w-[45%]' : 'w-full'} flex flex-col bg-[#1a2236] overflow-hidden`}>
          {/* CUSTOMER INFO */}
          <div className="p-4 border-b border-[#2d3547] flex-shrink-0">
            <p className="text-[#94a3b8] text-xs font-bold mb-2">CUSTOMER</p>
            <p className="text-lg font-bold">
              {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Walk-in Customer'}
            </p>
            {selectedCustomer && (
              <button onClick={() => setSelectedCustomerId('')} className="text-xs text-[#2563eb] hover:underline mt-2">
                Change customer
              </button>
            )}
          </div>

          {!showCheckout ? (
            <>
              {/* CART ITEMS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-center text-[#94a3b8] text-sm py-8">No items in cart</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="p-3 bg-[#0f1117] border border-[#2d3547] rounded flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.name}</p>
                        {item.size && <p className="text-xs text-[#94a3b8]">Size: {item.size}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-[#2d3547] hover:bg-[#3d4557] flex items-center justify-center text-xs font-bold">−</button>
                          <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                          <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-[#2d3547] hover:bg-[#3d4557] flex items-center justify-center text-xs font-bold">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${(item.price * item.quantity).toFixed(2)}</p>
                        <button onClick={() => removeItem(item.id)} className="text-[#94a3b8] hover:text-white text-xs mt-2">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* TOTALS */}
              <div className="p-4 border-t border-[#2d3547] space-y-2 flex-shrink-0">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-sm text-green-400"><span>Discount</span><span>−${discountAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between text-sm"><span>HST (13%)</span><span>${hst.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold border-t border-[#2d3547] pt-2"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>

                {selectedGiftCard && (
                  <div className="mt-3 p-2 bg-[#1e2d45] border border-amber-500/30 rounded text-xs"><span className="text-amber-400">💳 GC: ${selectedGiftCard.amount.toFixed(2)}</span></div>
                )}
                {selectedStoreCredit && (
                  <div className="mt-3 p-2 bg-[#1e2d45] border border-blue-500/30 rounded text-xs"><span className="text-blue-400">🎟 SC: ${selectedStoreCredit.amount.toFixed(2)}</span></div>
                )}

                <button
                  disabled={cart.length === 0}
                  onClick={() => setShowCheckout(true)}
                  className="w-full mt-4 py-4 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm uppercase transition-colors"
                >
                  CHECKOUT
                </button>
              </div>
            </>
          ) : (
            /* CHECKOUT SCREEN */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} {item.size ? `(${item.size})` : ''} x{item.quantity}</span>
                    <span className="font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-[#2d3547] space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>−${discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span>HST</span><span>${hst.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-[#2d3547] pt-2"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Store Credit'].map(method => (
                    <button
                      key={method}
                      disabled={isConfirming}
                      onClick={() => handleConfirmSale(method)}
                      className="py-2 px-2 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-bold uppercase transition-colors"
                    >
                      {method}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowCheckout(false)}
                  className="w-full py-2 bg-[#2d3547] hover:bg-[#3d4557] rounded text-xs font-bold uppercase transition-colors"
                >
                  Back to Cart
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OTHER TABS */}
        {posTab !== 'register' && (
          <div className="flex-1 overflow-auto bg-[#1a2236]">
            {posTab === 'history' && <PosTransactionHistory onVoidRefund={() => setShowVoidRefundModal(true)} />}
            {posTab === 'customers' && <PosCustomerManager />}
            {posTab === 'gc' && <GiftCardTab />}
            {posTab === 'sc' && <StoreCreditsTab />}
            {posTab === 'returns' && (
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-bold">Process Return</h2>
                <input
                  ref={returnsInvoiceInputRef}
                  type="text"
                  value={returnsInvoiceInput}
                  onChange={e => setReturnsInvoiceInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReturnsInvoiceLookup(returnsInvoiceInput)}
                  placeholder="Enter invoice number or scan barcode..."
                  className="w-full p-3 bg-[#0f1117] border border-[#2d3547] rounded text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#2563eb]"
                />
                <button
                  onClick={() => handleReturnsInvoiceLookup(returnsInvoiceInput)}
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-700 rounded font-bold text-sm uppercase"
                >
                  Look Up Invoice
                </button>
                {returnsLookupError && <p className="text-red-400 text-sm">{returnsLookupError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM TAB BAR */}
      <nav className="h-12 bg-[#1a2236] border-t border-[#2d3547] flex items-center px-4 gap-2 flex-shrink-0">
        {['REGISTER', 'HISTORY', 'CUSTOMERS', 'GIFT CARDS', 'STORE CREDIT'].map(tab => (
          <button
            key={tab}
            onClick={() => setPosTab(tab === 'REGISTER' ? 'register' : tab === 'HISTORY' ? 'history' : tab === 'CUSTOMERS' ? 'customers' : tab === 'GIFT CARDS' ? 'gc' : 'sc')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${
              (tab === 'REGISTER' && posTab === 'register') ||
              (tab === 'HISTORY' && posTab === 'history') ||
              (tab === 'CUSTOMERS' && posTab === 'customers') ||
              (tab === 'GIFT CARDS' && posTab === 'gc') ||
              (tab === 'STORE CREDIT' && posTab === 'sc')
                ? 'bg-[#2563eb] text-white'
                : 'bg-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* MODALS - KEEP ALL EXISTING (Not shown in redesign, just preserved) */}
      <AnimatePresence>
        {receipt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1a2236] p-6 rounded-lg shadow-2xl w-full max-w-sm space-y-4 border border-[#2d3547]">
              <h2 className="text-lg font-bold">Sale Complete!</h2>
              <p className="text-[#94a3b8]">Invoice: {receipt.invoiceNumber}</p>
              <p className="text-2xl font-bold text-green-400">${receipt.total.toFixed(2)}</p>
              <div className="flex gap-2">
                <button onClick={handleNewTransaction} className="flex-1 py-2 bg-[#2563eb] hover:bg-blue-700 rounded text-sm font-bold uppercase">New Transaction</button>
                <button onClick={() => handlePrintReceipt(receipt)} className="flex-1 py-2 bg-[#2d3547] hover:bg-[#3d4557] rounded text-sm font-bold uppercase">Print</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DISCOUNT MODAL - PRESERVED */}
      <AnimatePresence>
        {showDiscountModal && <PosDiscountModal isOpen={showDiscountModal} onClose={() => setShowDiscountModal(false)} />}
      </AnimatePresence>

      {/* RETURNS MODAL - PRESERVED */}
      {returnsFoundTransaction && (
        <ReturnsModal
          isOpen={showReturnsModal}
          onClose={handleReturnsComplete}
          prefilledTransactionId={returnsFoundTransaction.id}
          prefilledCustomerId={returnsFoundTransaction.customer_id || undefined}
          onComplete={handleReturnsComplete}
        />
      )}
    </div>
  );
}
