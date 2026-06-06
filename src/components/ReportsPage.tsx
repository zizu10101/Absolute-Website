import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useSettings } from '../context/SettingsContext';
import {
  Download, Calendar, TrendingUp, Package, Gift, Users,
  BarChart3, DollarSign, RefreshCw, Printer, RotateCcw
} from 'lucide-react';
import { EndOfDayReport } from './reports/EndOfDayReport';
import { SalesReport } from './reports/SalesReport';
import { ProductReport } from './reports/ProductReport';
import { GiftCardReport } from './reports/GiftCardReport';
import { CustomerReport } from './reports/CustomerReport';
import { VoidRefundReport } from './reports/VoidRefundReport';
import { StoreCreditReport } from './reports/StoreCreditReport';

type ReportTab = 'eod' | 'sales' | 'product' | 'gift-card' | 'customer' | 'void-refund' | 'store-credit';

export const ReportsPage: React.FC = () => {
  const { logo } = useSettings();
  const [activeTab, setActiveTab] = useState<ReportTab>('eod');
  const [isLoading, setIsLoading] = useState(false);

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
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-900">Reports</h1>
            <p className="text-xs text-zinc-400 font-bold mt-1">Financial summaries and detailed analytics</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
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
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'eod' && <EndOfDayReport logo={logo} />}
        {activeTab === 'sales' && <SalesReport logo={logo} />}
        {activeTab === 'product' && <ProductReport logo={logo} />}
        {activeTab === 'gift-card' && <GiftCardReport logo={logo} />}
        {activeTab === 'store-credit' && <StoreCreditReport />}
        {activeTab === 'void-refund' && <VoidRefundReport logo={logo} />}
        {activeTab === 'customer' && <CustomerReport logo={logo} />}
      </div>
    </div>
  );
};
