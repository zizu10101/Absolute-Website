import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { getEasternRangeUTC } from '../../utils/timezoneUtils';

interface VoidRefundReportProps {
  logo?: string;
}

interface Transaction {
  id: string;
  total_amount: number;
  method: string;
  status: string;
  items: any[];
  created_at: string;
  customer_id?: string;
  customers?: { first_name: string; last_name: string } | null;
}

export const VoidRefundReport: React.FC<VoidRefundReportProps> = ({ logo }) => {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert Eastern time range to UTC
      const { start, end } = getEasternRangeUTC(dateFrom, dateTo);

      console.log('🔄 VOID/REFUND REPORT: Fetching from', start, 'to', end);

      const { data, error } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name)')
        .or(`status.eq.voided,status.eq.refunded`)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('🔄 Void/Refund transactions found:', data?.length || 0);
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching void/refund data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const voided = transactions.filter(t => t.status === 'voided');
    const refunded = transactions.filter(t => t.status === 'refunded');

    return {
      voidedCount: voided.length,
      voidedAmount: voided.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0),
      refundedCount: refunded.length,
      refundedAmount: refunded.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0),
      totalCount: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0),
    };
  }, [transactions]);

  const getCustomerName = (t: Transaction) => {
    if (!t.customer_id || !t.customers) return 'Walk-in';
    return `${t.customers.first_name} ${t.customers.last_name}`;
  };

  const handleExportCSV = () => {
    const data = [
      ['Void & Refund Report', dateFrom, 'to', dateTo],
      [],
      ['Summary'],
      ['Voided Transactions', metrics.voidedCount, `$${metrics.voidedAmount.toFixed(2)}`],
      ['Refunded Transactions', metrics.refundedCount, `$${metrics.refundedAmount.toFixed(2)}`],
      ['Total', metrics.totalCount, `$${metrics.totalAmount.toFixed(2)}`],
      [],
      ['Transactions'],
      ['Date', 'Customer', 'Amount', 'Status', 'Items', 'Payment Method'],
      ...transactions.map(t => [
        t.created_at.split('T')[0],
        getCustomerName(t),
        `$${Math.abs(Number(t.total_amount)).toFixed(2)}`,
        t.status.toUpperCase(),
        t.items?.length || 0,
        t.method || '-',
      ]),
    ];
    downloadCSV(data, `void-refund-report-${dateFrom}.csv`);
  };

  const handlePrint = () => {
    generatePDF({
      title: `Void & Refund Report - ${dateFrom} to ${dateTo}`,
      sections: [
        {
          type: 'summary-cards',
          cards: [
            { label: 'Voided', value: `${metrics.voidedCount} × $${metrics.voidedAmount.toFixed(2)}`, icon: '❌' },
            { label: 'Refunded', value: `${metrics.refundedCount} × $${metrics.refundedAmount.toFixed(2)}`, icon: '↩️' },
          ],
        },
        {
          type: 'table',
          title: 'Void & Refund Transactions',
          headers: ['Date', 'Customer', 'Amount', 'Status', 'Items', 'Method'],
          rows: transactions.map(t => [
            t.created_at.split('T')[0],
            getCustomerName(t),
            `$${Math.abs(Number(t.total_amount)).toFixed(2)}`,
            t.status.toUpperCase(),
            (t.items?.length || 0).toString(),
            t.method || '-',
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 rounded bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          label="Voided"
          value={`${metrics.voidedCount}`}
          icon="❌"
          subtext={`$${metrics.voidedAmount.toFixed(2)}`}
        />
        <MetricCard
          label="Refunded"
          value={`${metrics.refundedCount}`}
          icon="↩️"
          subtext={`$${metrics.refundedAmount.toFixed(2)}`}
        />
        <MetricCard
          label="Total"
          value={`${metrics.totalCount}`}
          icon="📊"
          subtext={`$${metrics.totalAmount.toFixed(2)}`}
        />
      </div>

      {/* Void & Refund Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Void & Refund Transactions ({transactions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Date</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Customer</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Amount</th>
                <th className="text-center py-2 px-3 font-bold text-zinc-600">Status</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Items</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Method</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                    No void/refund transactions found for the selected period
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={tx.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-bold text-zinc-900">{tx.created_at.split('T')[0]}</td>
                    <td className="py-2 px-3 text-zinc-600">{getCustomerName(tx)}</td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">
                      ${Math.abs(Number(tx.total_amount)).toFixed(2)}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[9px] font-bold uppercase ${
                          tx.status === 'voided'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 text-zinc-700">{tx.items?.length || 0}</td>
                    <td className="py-2 px-3 text-zinc-600">{tx.method || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800"
        >
          <Download size={14} />
          Print / Save PDF
        </button>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; icon: string; subtext?: string }> = ({
  label,
  value,
  icon,
  subtext,
}) => (
  <div className="bg-white rounded-lg border border-zinc-200 p-4">
    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-2xl font-black text-zinc-900">{value}</p>
      <span className="text-2xl">{icon}</span>
    </div>
    {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
  </div>
);
