import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useSettings } from '../context/SettingsContext';
import {
  Download, Calendar, TrendingUp, Package, Gift, Users,
  BarChart3, DollarSign, RefreshCw, Printer, RotateCcw, ArrowLeft, Calculator, Lock
} from 'lucide-react';
import { EndOfDayReport } from './reports/EndOfDayReport';
import { SalesReport } from './reports/SalesReport';
import { ProductReport } from './reports/ProductReport';
import { GiftCardReport } from './reports/GiftCardReport';
import { CustomerReport } from './reports/CustomerReport';
import { VoidRefundReport } from './reports/VoidRefundReport';
import { StoreCreditReport } from './reports/StoreCreditReport';
import { CashReport } from './reports/CashReport';
import { ManagerPinModal } from './ManagerPinModal';

type ReportTab = 'eod' | 'cash' | 'sales' | 'product' | 'gift-card' | 'customer' | 'void-refund' | 'store-credit';

const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_MS = 30000;

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logo } = useSettings();
  const [activeTab, setActiveTab] = useState<ReportTab>('eod');
  const [isLoading, setIsLoading] = useState(false);

  // Cash Report is gated behind a separate manager PIN - deliberately NOT persisted anywhere
  // (no sessionStorage, no "remembered" flag). It re-locks the instant staff navigates to any
  // other tab, so the PIN must be re-entered every single time Cash Report is opened.
  const [cashReportUnlocked, setCashReportUnlocked] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState<number | null>(null);

  // Handle Escape key: closes the PIN modal if open, otherwise returns to POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showManagerPinModal) {
        setShowManagerPinModal(false);
      } else {
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, showManagerPinModal]);

  const handleWrongPin = () => {
    setPinAttempts(prev => {
      const next = prev + 1;
      if (next >= MAX_PIN_ATTEMPTS) {
        setPinLockedUntil(Date.now() + PIN_LOCKOUT_MS);
        return 0;
      }
      return next;
    });
  };

  const handlePinSuccess = () => {
    setCashReportUnlocked(true);
    setShowManagerPinModal(false);
    setPinAttempts(0);
    setPinLockedUntil(null);
    setActiveTab('cash');
  };

  // Always prompts for the PIN - no shortcut for "already unlocked", since access must never
  // be remembered between clicks.
  const handleLockIconClick = () => {
    setShowManagerPinModal(true);
  };

  // Switching to any other tab immediately re-locks Cash Report.
  const handleTabClick = (id: ReportTab) => {
    setActiveTab(id);
    setCashReportUnlocked(false);
  };

  const tabs = [
    { id: 'eod', label: 'End of Day', icon: Calendar },
    { id: 'sales', label: 'Sales Report', icon: TrendingUp },
    { id: 'product', label: 'Products', icon: Package },
    { id: 'gift-card', label: 'Gift Cards', icon: Gift },
    { id: 'store-credit', label: 'Store Credit', icon: DollarSign },
    { id: 'void-refund', label: 'Voids/Refunds', icon: RotateCcw },
    { id: 'customer', label: 'Customers', icon: Users },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Back Button */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3">
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to POS
        </button>
      </div>

      {/* Header */}
      <div className="relative bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-900">Reports</h1>
            <p className="text-xs text-zinc-400 font-bold mt-1">Financial summaries and detailed analytics</p>
          </div>
        </div>
        <button
          onClick={handleLockIconClick}
          className="absolute top-4 right-4 text-zinc-400
                     hover:text-zinc-600 transition-colors"
        >
          <Lock size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}

        {cashReportUnlocked && (
          <button
            onClick={() => setActiveTab('cash')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all whitespace-nowrap ${
              activeTab === 'cash'
                ? 'bg-zinc-900 text-white shadow-md'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200'
            }`}
          >
            <Calculator size={14} />
            Cash Report
          </button>
        )}
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'eod' && <EndOfDayReport logo={logo} />}
        {activeTab === 'cash' && cashReportUnlocked && <CashReport logo={logo} />}
        {activeTab === 'sales' && <SalesReport logo={logo} />}
        {activeTab === 'product' && <ProductReport logo={logo} />}
        {activeTab === 'gift-card' && <GiftCardReport logo={logo} />}
        {activeTab === 'store-credit' && <StoreCreditReport />}
        {activeTab === 'void-refund' && <VoidRefundReport logo={logo} />}
        {activeTab === 'customer' && <CustomerReport logo={logo} />}
      </div>

      {showManagerPinModal && (
        <ManagerPinModal
          onSuccess={handlePinSuccess}
          onCancel={() => setShowManagerPinModal(false)}
          attemptsRemaining={MAX_PIN_ATTEMPTS - pinAttempts}
          lockedUntil={pinLockedUntil}
          onWrongPin={handleWrongPin}
        />
      )}
    </div>
  );
};
