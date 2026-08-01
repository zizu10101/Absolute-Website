import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Barcode, CheckCircle2, QrCode, Sparkles, Volume2, AlertTriangle, Play, HelpCircle, Lock, RefreshCcw } from 'lucide-react';

interface RapidScanIntakeMatrixProps {
  productId?: string;
  productName: string;
  category: string;
  existingVariants?: any[];
  productColors?: string[];
  onRegisterVariant: (ageGroup: 'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Sleeves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size', size: string, barcode: string, quantity: number, color?: string) => Promise<void>;
  onSuccessFinished: () => void;
}

export const RapidScanIntakeMatrix: React.FC<RapidScanIntakeMatrixProps> = ({
  productId,
  productName,
  category,
  existingVariants = [],
  productColors = [],
  onRegisterVariant,
  onSuccessFinished
}) => {
  // Main states
  const [ageGroup, setAgeGroup] = useState<'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Sleeves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size'>('Adult');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  
  // Scanning phase states
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedResults, setScannedResults] = useState<{ size: string; quantity: number; barcode: string; color?: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Feedback and success indicators
  const [showOverlay, setShowOverlay] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [flashCard, setFlashCard] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Suggested sizes mapping
  const getSuggestedSizes = (catName: string = '', productName: string = '', age: 'Toddler' | 'Youth' | 'Adult' | 'Balls' | 'Gloves' | 'Sleeves' | 'Adult Footwear' | 'Youth Footwear' | 'One Size') => {
    if (age === 'Balls') {
      return ['Size 1', 'Size 2', 'Size 3', 'Size 4', 'Size 5'];
    }

    if (age === 'Gloves') {
      return ['3', '4', '5', '6', '7', '8', '9', '10', '11'];
    }

    if (age === 'Sleeves') {
      return ['S/M', 'L/XL'];
    }

    if (age === 'One Size') {
      return ['One Size'];
    }

    if (age === 'Adult Footwear') {
      const sizes = [];
      for (let s = 3; s <= 13; s += 0.5) {
        sizes.push(s % 1 === 0 ? s.toString() : s.toFixed(1));
      }
      return sizes;
    }

    if (age === 'Youth Footwear') {
      const sizes = [];
      for (let s = 1; s <= 6; s += 0.5) {
        sizes.push(s % 1 === 0 ? `${s}Y` : `${s.toFixed(1)}Y`);
      }
      return sizes;
    }

    const cat = catName.toLowerCase();
    const isShoes = cat.includes('shoe') || cat.includes('footwear') || cat.includes('cleats');

    if (isShoes) {
      if (age === 'Toddler') {
        const toddlerShoeSizes = [];
        for (let s = 4; s <= 13; s += 0.5) {
          toddlerShoeSizes.push(`${s}C`);
        }
        return toddlerShoeSizes;
      }
      if (age === 'Youth') {
        const youthShoeSizes = [];
        for (let s = 1; s <= 7; s += 0.5) {
          youthShoeSizes.push(`${s}Y`);
        }
        return youthShoeSizes;
      }
      const adultShoeSizes = [];
      for (let s = 4; s <= 13; s += 0.5) {
        adultShoeSizes.push(s.toString());
      }
      return adultShoeSizes;
    }

    if (age === 'Toddler') {
      return ['12M', '18M', '24M', '2T', '3T', '4T'];
    }
    if (age === 'Youth') {
      return ['YXXS', 'YXS', 'YS', 'YM', 'YL', 'YXL'];
    }
    return ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  };

  // Build full size list
  const suggestedSizesList = useMemo(() => {
    const base = getSuggestedSizes(category, productName, ageGroup);
    return [...base, ...customSizes];
  }, [category, productName, ageGroup, customSizes]);

  // Clean quantities on age group shift
  useEffect(() => {
    setQuantities({});
    setCustomSizes([]);
  }, [ageGroup]);

  // Build scan queue (only sizes with Qty > 0)
  const scanQueue = useMemo(() => {
    return suggestedSizesList
      .map(size => ({ size, qty: quantities[size] || 0 }))
      .filter(item => item.qty > 0);
  }, [suggestedSizesList, quantities]);

  const activeItem = scanQueue[activeQueueIndex] || null;

  // Track scanning focus
  useEffect(() => {
    if (isScanningActive && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScanningActive, activeQueueIndex]);

  // Global keydown listener for hardware scanner redirection and focus protection
  useEffect(() => {
    if (!isScanningActive) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Avoid hijacking native inputs if user clicked outside into another input element
      if (document.activeElement && 
          document.activeElement !== document.body && 
          document.activeElement !== barcodeInputRef.current &&
          (document.activeElement.tagName === 'INPUT' || 
           document.activeElement.tagName === 'TEXTAREA' || 
           document.activeElement.tagName === 'SELECT')) {
        return;
      }

      // If barcode input is not focused, grab focus and let the character pass
      if (document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current?.focus();
        
        // If it's a typing key, append it directly to prevent losing the first character of the barcode
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setBarcodeInput(prev => prev + e.key);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isScanningActive]);

  // Periodically force focus to scanner listener input during barcode phase
  useEffect(() => {
    if (!isScanningActive) return;
    const interval = setInterval(() => {
      if (document.activeElement !== barcodeInputRef.current) {
        // Only grab focus if user is not actively typing in some outer tool/confirm box
        setIsFocused(false);
      } else {
        setIsFocused(true);
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [isScanningActive]);

  const forceRefocus = () => {
    barcodeInputRef.current?.focus();
    setIsFocused(true);
  };

  // Play synthetic audio chime using browser Web Audio API
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      // Pleasant double-tone scan chime
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1380, audioCtx.currentTime + 0.06);
      
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (err) {
      console.warn("Chime blocked or audio context unsupported:", err);
    }
  };

  const handleCustomSizeAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customSizeInput.trim().toUpperCase();
    if (!cleaned) return;
    if (suggestedSizesList.includes(cleaned)) {
      alert("This size is already in the sheet.");
      return;
    }
    setCustomSizes(prev => [...prev, cleaned]);
    setCustomSizeInput('');
  };

  const startScanningMode = () => {
    if (scanQueue.length === 0) {
      alert("Please enter a stock quantity (> 0) for at least one size before locking the sheet.");
      return;
    }
    setIsScanningActive(true);
    setActiveQueueIndex(0);
    setBarcodeInput('');
    setScannedResults([]);
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || isSaving) return;

    const code = barcodeInput.trim().toUpperCase();
    if (!code) return;

    // Check bar cache duplication in database or current list
    const isDuplicateInSession = scannedResults.some(r => r.barcode === code);
    const isDuplicateInDb = existingVariants.some(v => v.barcode?.toUpperCase() === code);

    if (isDuplicateInSession) {
      alert(`ERROR: Barcode "${code}" was already scanned in this session for another size. Please scan a different barcode.`);
      setBarcodeInput('');
      return;
    }

    if (isDuplicateInDb) {
      alert(`ERROR: Barcode "${code}" already exists in the database for this product. Please scan a different barcode.`);
      setBarcodeInput('');
      return;
    }

    setIsSaving(true);
    try {
      // Save variant via the callback (Db or local)
      await onRegisterVariant(ageGroup, activeItem.size, code, activeItem.qty, selectedColor || undefined);
      
      // Successfully registered
      playChime();
      setFlashCard(activeItem.size);
      setTimeout(() => setFlashCard(null), 800);

      // Append to results display
      setScannedResults(prev => [...prev, { size: activeItem.size, quantity: activeItem.qty, barcode: code, color: selectedColor || undefined }]);
      
      // Setup next step
      setBarcodeInput('');
      
      if (activeQueueIndex + 1 >= scanQueue.length) {
        // REACHED THE END!
        setIsScanningActive(false);
        setShowOverlay(true);
        // Clear matrix values
        setQuantities({});
        setCustomSizes([]);
      } else {
        // Proceed next
        setActiveQueueIndex(prev => prev + 1);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to register scan variant.");
    } finally {
      setIsSaving(false);
    }
  };

  const exitScanningMode = () => {
    if (confirm("Are you sure you want to stop and unlock the quantities grid? Completed scans will be preserved, but current tracking is reset.")) {
      setIsScanningActive(false);
      setBarcodeInput('');
    }
  };

  const handleFinishSuccess = () => {
    setShowOverlay(false);
    onSuccessFinished();
  };

  return (
    <div className="w-full bg-white border border-zinc-200 rounded-2xl shadow-sm text-zinc-900 overflow-hidden font-sans">
      {/* Title Header */}
      <div className="bg-zinc-900 p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-805">
        <div>
          <span className="bg-[var(--primary-color)] text-[9px] text-white px-2 py-0.5 rounded font-black uppercase tracking-widest inline-block mb-1.5 animate-pulse">
            HIGH-SPEED INVENTORY INTAKE
          </span>
          <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Barcode className="w-4 h-4 text-[var(--primary-color)]" /> RAPID-SCAN INTAKE MATRIX
          </h4>
          <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">
            Modeled after physical size sheets. Lock counts first, then rapid scan serial barcodes.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hidden md:inline">
              Active Age Tier:
            </label>
            <select
              disabled={isScanningActive}
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as any)}
              className="p-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] disabled:opacity-50 cursor-pointer"
            >
              <option value="Adult">👨 Adult (S, M, L, XXS–XXXL)</option>
              <option value="Youth">👦 Youth (YXXS–YXL)</option>
              <option value="Balls">⚽ Balls (Size 1–5)</option>
              <option value="Gloves">🧤 Gloves (3–11)</option>
              <option value="Sleeves">Sleeves (S/M, L/XL)</option>
              <option value="One Size">One Size (Accessories)</option>
              <option value="Adult Footwear">👟 Adult Footwear (3–13)</option>
              <option value="Youth Footwear">👟 Youth Footwear (1Y–6Y)</option>
              <option value="Toddler">🧒 Toddler (2T, 3T, 4T)</option>
            </select>
          </div>
          {productColors.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hidden md:inline">
                Color:
              </label>
              <select
                disabled={isScanningActive}
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="p-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] disabled:opacity-50 cursor-pointer"
              >
                <option value="">â€” No Color â€”</option>
                {productColors.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* PHASE 1: Grid matrix layout */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-zinc-500">
            <span> Sizing Sheet ({ageGroup} sizes)</span>
            {!isScanningActive && (
              <span className="text-[10px] text-zinc-400 font-medium">Use Tab keys to navigate fields fast</span>
            )}
          </div>

          {/* Sizing sheet Matrix Grid wrapper */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {suggestedSizesList.map((size) => {
              const qty = quantities[size] || 0;
              const hasQty = qty > 0;
              const isActiveTarget = isScanningActive && activeItem?.size === size;
              const isFinishedInQueue = isScanningActive && scanQueue.some((q, idx) => q.size === size && idx < activeQueueIndex);
              const isUnusedInScan = isScanningActive && !hasQty;
              const isFlashing = flashCard === size;

              return (
                <motion.div
                  key={size}
                  animate={
                    isActiveTarget 
                      ? { scale: [1, 1.03, 1], boxShadow: "0 0 15px rgba(59,130,246,0.3)" } 
                      : isFlashing 
                      ? { scale: [1, 1.05, 1], borderColor: "#22c55e" }
                      : {}
                  }
                  transition={{ duration: 0.5, repeat: isActiveTarget ? Infinity : 0 }}
                  className={`relative p-4 border-2 rounded-2xl flex flex-col gap-3 transition-all min-h-[100px] ${
                    isActiveTarget 
                      ? 'border-blue-500 bg-blue-50/75 ring-2 ring-blue-500'
                      : isFlashing
                      ? 'border-green-500 bg-green-50/75'
                      : isFinishedInQueue
                      ? 'border-zinc-200 bg-zinc-50/40 opacity-70'
                      : isUnusedInScan
                      ? 'border-zinc-100 bg-zinc-50/30 opacity-40'
                      : hasQty 
                      ? 'border-zinc-900 bg-zinc-50 shadow-sm' 
                      : 'border-zinc-200 bg-white hover:border-zinc-400'
                  }`}
                >
                  {/* Size Label */}
                  <div className="text-center font-mono font-black text-lg tracking-tight text-zinc-900 border-b border-zinc-100 pb-2 uppercase">
                    {size}
                  </div>

                  {/* Quantity input box */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">
                      Qty
                    </label>
                    <input
                      type="number"
                      disabled={isScanningActive}
                      value={quantities[size] || ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setQuantities(prev => ({ ...prev, [size]: val }));
                      }}
                      placeholder="0"
                      style={{ MozAppearance: 'textfield' }}
                      className={`w-full text-center py-2.5 px-2 border-2 rounded-xl text-base font-black focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        hasQty 
                          ? 'border-zinc-900 bg-white text-zinc-900' 
                          : 'border-zinc-200 bg-zinc-50 text-zinc-400'
                      } ${isScanningActive ? 'bg-zinc-100 border-transparent text-zinc-800 cursor-not-allowed' : ''}`}
                    />
                  </div>

                  {/* Active target feedback badge */}
                  {isActiveTarget && (
                    <span className="absolute -top-2.5 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 text-white items-center justify-center text-[8px] font-bold">🎯</span>
                    </span>
                  )}

                  {isFinishedInQueue && (
                    <span className="absolute -top-2 -right-1 bg-green-500 text-white rounded-full p-0.5 text-[8px] font-bold shadow-xs">
                      âœ”
                    </span>
                  )}
                </motion.div>
              );
            })}

            {/* Manual Size Extension Block */}
            {!isScanningActive && (
              <form onSubmit={handleCustomSizeAdd} className="p-4 border-2 border-dashed border-zinc-300 rounded-2xl flex flex-col gap-3 bg-zinc-50/30 hover:bg-zinc-50 transition-colors min-h-[100px]">
                <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest text-center mb-1">
                  ï¼‹ Custom Size
                </label>
                <div className="space-y-1.5 mt-1.5">
                  <input
                    type="text"
                    placeholder="e.g. 5.5Y"
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    className="w-full text-center uppercase font-mono py-1 px-1 text-[11px] font-semibold border border-zinc-200 bg-white rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                  />
                  <button
                    type="submit"
                    className="w-full py-1 bg-zinc-800 hover:bg-zinc-950 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all"
                  >
                    Add Size
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* PHASE 1 TO PHASE 2 TRANSITIONS */}
        {!isScanningActive ? (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-zinc-100 bg-zinc-50/50 p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-full bg-amber-50 text-amber-600 block">
                <QrCode className="w-5 h-5 text-[var(--primary-color)]" />
              </span>
              <div>
                <p className="text-[11px] font-extrabold uppercase text-zinc-800 tracking-wider">
                  Queued Size Variants: {scanQueue.length}
                </p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                  Total Bulk Stock Quantity: {scanQueue.reduce((acc, q) => acc + q.qty, 0)} units scheduled
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={startScanningMode}
              className="px-6 py-3 bg-zinc-900 text-white hover:bg-blue-600 rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> LOCK QUANTITIES & START SCANNING â–¶
            </button>
          </div>
        ) : (
          /* SEQUENCE INTEGRATIONS: SEQUENTIAL SCANNER PANEL */
          <div className="space-y-4 pt-4 border-t border-zinc-200">
            {/* active targeted sequence card banner */}
            {activeItem && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      ACTIVE SCAN TARGET ({activeQueueIndex + 1} of {scanQueue.length})
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-zinc-900 font-sans tracking-tight">
                    AWAITING SCAN FOR SIZE: <span className="text-[var(--primary-color)] font-mono font-extrabold border-b-2 border-[var(--primary-color)] px-1 md:text-2xl">{activeItem.size}</span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    Input stock is locked at <span className="text-zinc-950 font-black">{activeItem.qty} units</span>. Aim hardware scanner and click play/trigger.
                  </p>
                </div>

                {/* Hardware input listeners form */}
                <form onSubmit={handleBarcodeSubmit} className="flex-1 max-w-md w-full">
                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      className={`w-full p-4 pr-16 bg-white border-2 rounded-xl text-md font-mono font-bold tracking-widest focus:outline-none focus:ring-4 transition-all uppercase ${
                        isFocused 
                          ? 'border-blue-500 focus:ring-blue-100' 
                          : 'border-yellow-500 focus:ring-yellow-100 animate-pulse'
                      }`}
                      placeholder="SCAN BARCODE NOW..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      disabled={isSaving}
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {isSaving ? (
                        <div className="w-5 h-5 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Barcode className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Refocus helper alerts */}
                  {!isFocused && (
                    <button
                      type="button"
                      onClick={forceRefocus}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 p-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-yellow-100 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 animate-bounce" /> FOCUS LOST! CLICK HERE TO REFOCUS SCANNER RECEIVER
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Quick scanning controller options */}
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-[var(--primary-color)] bg-zinc-50 px-4 py-2 rounded-lg">
              <span className="flex items-center gap-1 text-slate-500">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" /> Synthetic audio chime status: ACTIVE beep
              </span>
              <button
                type="button"
                onClick={exitScanningMode}
                className="text-zinc-600 hover:text-zinc-950 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCcw className="w-3 h-3" /> Unlock quantities sheet / Cancel scan
              </button>
            </div>
            
            {/* Scanned history log tracker */}
            {scannedResults.length > 0 && (
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-2">
                  Scanned in current sequence ({scannedResults.length})
                </span>
                <div className="flex flex-wrap gap-2 text-[10px] max-h-24 overflow-y-auto">
                  {scannedResults.map((res, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white border border-green-200 text-zinc-800 px-2 py-1 rounded shadow-3xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="font-extrabold uppercase font-sans">Size {res.size}</span>
                      {res.color && <><span className="text-zinc-400">Â·</span><span className="font-bold text-[var(--primary-color)] text-[9px] uppercase">{res.color}</span></>}
                      <span className="text-zinc-400">|</span>
                      <span className="font-mono text-[9px] font-bold text-[var(--primary-color)]">{res.barcode}</span>
                      <span className="text-zinc-400">|</span>
                      <span className="text-zinc-500 font-semibold">{res.quantity}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FINAL FULL-PAGE GREEN SUCCESS CHECKMARK OVERLAY */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              className="max-w-xl w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-white space-y-6"
            >
              {/* Spinning success indicator */}
              <motion.div
                initial={{ rotate: -45, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 text-white"
              >
                <CheckCircle2 className="w-12 h-12" />
              </motion.div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-green-400 tracking-widest block">
                  TRANSACTION INVENTORY COMPLETED
                </span>
                <h2 className="text-2xl font-black font-sans uppercase tracking-tight">
                  ALL VARIANTS SECURELY REGISTERED
                </h2>
                <div className="w-16 h-1.5 bg-[var(--primary-color)] mx-auto rounded-full mt-2"></div>
              </div>

              <div className="w-full bg-zinc-950/80 border border-zinc-805 rounded-xl p-4 text-xs font-mono max-h-36 overflow-y-auto text-left style-scrollbar space-y-2">
                <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-805 pb-1">
                  SECURE BARCODE LEDGER INGEST REPORT:
                </div>
                {scannedResults.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] border-b border-zinc-900/45 pb-1 text-zinc-350">
                    <span>SIZE {item.size} ({item.quantity} QTY)</span>
                    <span className="text-green-400 font-bold">{item.barcode}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleFinishSuccess}
                className="w-full py-4 bg-[var(--primary-color)] hover:bg-red-705 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-[var(--primary-color)]/25 cursor-pointer"
              >
                CLOSE SECTIONS & REFRESH SYSTEM
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
