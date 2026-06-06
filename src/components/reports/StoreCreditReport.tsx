import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { CreditCard, Download, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

interface StoreCredit {
  id: string;
  customer_id: string;
  amount: number;
  remaining_balance: number;
  reason: string;
  is_active: boolean;
  created_at: string;
  customers?: { first_name: string; last_name: string; email?: string; phone?: string } | null;
  store_credit_transactions?: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    created_at: string;
  }>;
}

interface SummaryCard {
  title: string;
  value: string;
  color: string;
}

export function StoreCreditReport() {
  const [storeCredits, setStoreCredits] = useState<StoreCredit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreCredits();
  }, [dateRange]);

  const fetchStoreCredits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_credits')
        .select(`
          *,
          customers (first_name, last_name, email, phone),
          store_credit_transactions (*)
        `)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStoreCredits(data || []);
    } catch (err) {
      console.error('Error fetching store credits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary metrics
  const summary = useMemo(() => {
    const metrics = {
      totalIssued: 0,
      totalAmount: 0,
      totalRedeemed: 0,
      outstandingBalance: 0,
    };

    storeCredits.forEach((credit) => {
      metrics.totalIssued += 1;
      metrics.totalAmount += credit.amount;
      metrics.outstandingBalance += credit.remaining_balance;

      if (credit.store_credit_transactions) {
        credit.store_credit_transactions.forEach((tx) => {
          if (tx.transaction_type === 'redeemed') {
            metrics.totalRedeemed += Math.abs(tx.amount);
          }
        });
      }
    });

    return metrics;
  }, [storeCredits]);

  const summaryCards: SummaryCard[] = [
    {
      title: 'Credits Issued',
      value: summary.totalIssued.toString(),
      color: 'bg-blue-50 border-blue-200 text-blue-900',
    },
    {
      title: 'Value Issued',
      value: `$${summary.totalAmount.toFixed(2)}`,
      color: 'bg-blue-50 border-blue-200 text-blue-900',
    },
    {
      title: 'Total Redeemed',
      value: `$${summary.totalRedeemed.toFixed(2)}`,
      color: 'bg-green-50 border-green-200 text-green-900',
    },
    {
      title: 'Outstanding Balance',
      value: `$${summary.outstandingBalance.toFixed(2)}`,
      color: 'bg-amber-50 border-amber-200 text-amber-900',
    },
  ];

  // Export functions
  const handleExportCSV = () => {
    const data = storeCredits.map((credit) => ({
      'Credit ID': credit.id.slice(0, 8),
      Customer: credit.customers
        ? `${credit.customers.first_name} ${credit.customers.last_name}`
        : 'Unknown',
      'Issued Date': new Date(credit.created_at).toLocaleDateString(),
      'Amount': credit.amount.toFixed(2),
      'Redeemed': (credit.amount - credit.remaining_balance).toFixed(2),
      'Remaining': credit.remaining_balance.toFixed(2),
      Status: credit.is_active ? 'Active' : 'Depleted',
      Reason: credit.reason,
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `store-credit-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Store Credit Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { display: flex; gap: 20px; margin-bottom: 30px; }
            .summary-card { flex: 1; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .summary-card h3 { margin: 0 0 10px 0; font-size: 12px; color: #666; }
            .summary-card .value { font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            table th { background: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; }
            table td { padding: 10px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Store Credit Report</h1>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
            <p>Date Range: ${dateRange.start} to ${dateRange.end}</p>
          </div>

          <div class="summary">
            ${summaryCards
              .map(
                (card) => `
              <div class="summary-card">
                <h3>${card.title}</h3>
                <div class="value">${card.value}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <table>
            <thead>
              <tr>
                <th>Credit ID</th>
                <th>Customer</th>
                <th>Issued Date</th>
                <th>Amount</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${storeCredits
                .map(
                  (credit) => `
                <tr>
                  <td>${credit.id.slice(0, 8)}</td>
                  <td>${
                    credit.customers
                      ? `${credit.customers.first_name} ${credit.customers.last_name}`
                      : 'Unknown'
                  }</td>
                  <td>${new Date(credit.created_at).toLocaleDateString()}</td>
                  <td>$${credit.amount.toFixed(2)}</td>
                  <td>$${credit.remaining_balance.toFixed(2)}</td>
                  <td>${credit.is_active ? 'Active' : 'Depleted'}</td>
                  <td>${credit.reason}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-bold text-zinc-700 block mb-2">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="w-full px-4 py-2 border border-zinc-300 rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-bold text-zinc-700 block mb-2">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="w-full px-4 py-2 border border-zinc-300 rounded-lg"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-6 rounded-2xl border-2 ${card.color}`}
          >
            <h3 className="text-xs font-bold uppercase tracking-widest mb-2 opacity-75">
              {card.title}
            </h3>
            <p className="text-3xl font-black">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm"
        >
          <Download size={16} /> Export CSV
        </button>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm"
        >
          <Download size={16} /> Export PDF
        </button>
      </div>

      {/* Credits Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : storeCredits.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No store credits found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left font-bold">ID</th>
                  <th className="px-6 py-3 text-left font-bold">Customer</th>
                  <th className="px-6 py-3 text-right font-bold">Amount</th>
                  <th className="px-6 py-3 text-right font-bold">Remaining</th>
                  <th className="px-6 py-3 text-left font-bold">Reason</th>
                  <th className="px-6 py-3 text-left font-bold">Issued</th>
                  <th className="px-6 py-3 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {storeCredits.map((credit, idx) => (
                  <motion.tr
                    key={credit.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() =>
                      setExpandedCreditId(
                        expandedCreditId === credit.id ? null : credit.id
                      )
                    }
                    className="border-b border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-xs">
                      {credit.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-bold">
                        {credit.customers
                          ? `${credit.customers.first_name} ${credit.customers.last_name}`
                          : 'Unknown'}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {credit.customers?.phone || credit.customers?.email || ''}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-bold">
                      ${credit.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-blue-600">
                      ${credit.remaining_balance.toFixed(2)}
                    </td>
                    <td className="px-6 py-3">{credit.reason}</td>
                    <td className="px-6 py-3 text-xs text-zinc-600">
                      {new Date(credit.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          credit.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {credit.is_active ? 'Active' : 'Depleted'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded Transaction Details */}
      <AnimatePresence>
        {expandedCreditId && (
          <motion.div
            key={expandedCreditId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-zinc-50 rounded-lg border border-zinc-200 p-6"
          >
            <h3 className="font-bold mb-4">
              Transaction History - Credit #{expandedCreditId.slice(0, 8)}
            </h3>
            {storeCredits
              .find((c) => c.id === expandedCreditId)
              ?.store_credit_transactions?.length === 0 ? (
              <p className="text-zinc-500 text-sm">No transactions</p>
            ) : (
              <div className="space-y-2">
                {storeCredits
                  .find((c) => c.id === expandedCreditId)
                  ?.store_credit_transactions?.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex justify-between p-3 bg-white rounded border border-zinc-200"
                    >
                      <div>
                        <p className="font-bold capitalize text-sm">
                          {tx.transaction_type === 'redeemed' ? 'Redeemed' : 'Issued'}
                        </p>
                        <p className="text-xs text-zinc-600">
                          {new Date(tx.created_at).toLocaleDateString()}{' '}
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <p
                        className={`font-bold text-sm ${
                          tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
