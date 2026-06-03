import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Moon, Sun, LogOut, History, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PosRegister } from '../components/PosRegister';
import { PosTransactionHistory } from '../components/PosTransactionHistory';
import { PosCustomerManager } from '../components/PosCustomerManager';
import { POSPinEntry } from '../components/POSPinEntry';

type PosTab = 'register' | 'history' | 'customers';

export function POSPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [posTab, setPosTab] = useState<PosTab>('register');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showCustomersPanel, setShowCustomersPanel] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('pos_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load dark mode preference
  useEffect(() => {
    const stored = localStorage.getItem('pos_dark_mode');
    if (stored !== null) {
      setIsDarkMode(stored === 'true');
    }
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

  if (!isAuthenticated) {
    return <POSPinEntry onPinSubmit={handlePinSubmit} isDarkMode={isDarkMode} />;
  }

  const bgClass = isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white';
  const textClass = isDarkMode ? 'text-white' : 'text-zinc-900';
  const borderClass = isDarkMode ? 'border-zinc-700' : 'border-zinc-200';

  return (
    <div className={`fixed inset-0 flex flex-col ${bgClass} ${textClass} font-sans`}>
      {/* Header */}
      <header className={`border-b ${borderClass} px-4 py-3 flex items-center justify-between bg-white ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#b90014] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs tracking-wider">AS</span>
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest">Absolute Soccer</h1>
            <p className={`text-[10px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Mississauga</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryPanel(true)}
            title="Order History"
            className={`p-2.5 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
            }`}
          >
            <History size={18} />
          </button>

          <button
            onClick={() => setShowCustomersPanel(true)}
            title="Customers"
            className={`p-2.5 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
            }`}
          >
            <Users size={18} />
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle dark mode"
            className={`p-2.5 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
            }`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={handleLockPOS}
            title="Lock POS (Ctrl+L)"
            className="p-2.5 rounded-lg bg-[#b90014] hover:bg-red-700 text-white transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - Product browser */}
        <div className={`flex-1 border-r ${borderClass} overflow-hidden flex flex-col`}>
          <PosRegister posTab={posTab} setPosTab={setPosTab} />
        </div>

        {/* Right column - History panel (slide-over) */}
        <AnimatePresence>
          {showHistoryPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistoryPanel(false)}
                className="absolute inset-0 bg-black/30 z-40"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-full max-w-md ${bgClass} ${isDarkMode ? 'bg-zinc-900 border-l border-zinc-800' : 'border-l border-zinc-200'} flex flex-col z-50 absolute right-0 top-0 bottom-0`}
              >
                <div className={`p-4 border-b ${borderClass} flex items-center justify-between bg-zinc-950 text-white`}>
                  <h2 className="text-xs font-black uppercase tracking-widest">Order History</h2>
                  <button
                    onClick={() => setShowHistoryPanel(false)}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PosTransactionHistory />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Customers panel (slide-over) */}
        <AnimatePresence>
          {showCustomersPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCustomersPanel(false)}
                className="absolute inset-0 bg-black/30 z-40"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-full max-w-md ${bgClass} ${isDarkMode ? 'bg-zinc-900 border-l border-zinc-800' : 'border-l border-zinc-200'} flex flex-col z-50 absolute right-0 top-0 bottom-0`}
              >
                <div className={`p-4 border-b ${borderClass} flex items-center justify-between bg-zinc-950 text-white`}>
                  <h2 className="text-xs font-black uppercase tracking-widest">Customers</h2>
                  <button
                    onClick={() => setShowCustomersPanel(false)}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PosCustomerManager />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
