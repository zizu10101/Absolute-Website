import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw, Printer } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';

interface SalesReportProps {
  logo?: string;
}

interface Transaction {
  id: string;
  total_amount: number;
  method: string;
  status: string;
  items: any[];
  created_at: string;
}

interface PaymentMethodData {
  count: number;
  amount: number;
  percentage: number;
}

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export const SalesReport: React.FC<SalesReportProps> = ({ logo }) => {
  const [filterType, setFilterType] = useState<FilterType>('monthly');
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [customTo, setCustomTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let from = new Date();

    switch (filterType) {
      case 'daily':
        from.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        from.setMonth(from.getMonth() - 1);
        from.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        from.setFullYear(from.getFullYear() - 1);
        from.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        const [fromYear, fromMonth, fromDay] = customFrom.split('-').map(Number);
        from = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
        const [toYear, toMonth, toDay] = customTo.split('-').map(Number);
        const customEnd = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);
        return { from: from.toISOString(), to: customEnd.toISOString() };
    }

    return { from: from.toISOString(), to: now.toISOString() };
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { from, to } = getDateRange();
      console.log('💰 SALES REPORT: Fetching from', from, 'to', to);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', from)
        .lte('created_at', to)
        .neq('status', 'voided');

      if (error) throw error;
      console.log('💰 Transactions fetched:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('💰 All transactions payment methods:', data.map(t => ({
          id: t.id.slice(0, 8),
          status: t.status,
          method: `"${t.method}"`,
          methodType: typeof t.method,
          amount: t.total_amount
        })));
      }
      console.log('📊 Completed:', data?.filter(t => t.status === 'completed').length);
      console.log('📊 Refunded:', data?.filter(t => t.status === 'refunded').length);
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [filterType, customFrom, customTo]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed');
    const totalRevenue = completed.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);
    const netSales = totalRevenue / 1.13;
    const hstCollected = totalRevenue - netSales;

    return {
      totalRevenue,
      totalTransactions: completed.length,
      hstCollected,
      netSales,
      avgTransaction: completed.length > 0 ? totalRevenue / completed.length : 0,
      voidedCount: transactions.filter(t => t.status === 'voided').length,
      voidedAmount: transactions
        .filter(t => t.status === 'voided')
        .reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0),
    };
  }, [transactions]);

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    const breakdown: Record<string, PaymentMethodData> = {};
    const completed = transactions.filter(t => t.status === 'completed');
    const total = completed.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);

    completed.forEach(t => {
      const method = t.method || 'Other';
      if (!breakdown[method]) breakdown[method] = { count: 0, amount: 0, percentage: 0 };
      breakdown[method].count += 1;
      breakdown[method].amount += Math.abs(Number(t.total_amount));
    });

    Object.entries(breakdown).forEach(([_, data]) => {
      data.percentage = total > 0 ? (data.amount / total) * 100 : 0;
    });

    return breakdown;
  }, [transactions]) as Record<string, PaymentMethodData>;

  // Daily breakdown for table
  const dailyBreakdown = useMemo(() => {
    const breakdown: Record<string, Record<string, number>> = {};
    const methods = ['Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Gift Card', 'Other'];

    transactions
      .filter(t => t.status === 'completed')
      .forEach(t => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        if (!breakdown[date]) {
          breakdown[date] = {
            transactions: 0,
            total: 0,
          };
          methods.forEach(m => (breakdown[date][m] = 0));
        }
        breakdown[date].transactions += 1;
        breakdown[date].total += Math.abs(Number(t.total_amount));
        const method = t.method || 'Other';
        breakdown[date][method] = (breakdown[date][method] || 0) + Math.abs(Number(t.total_amount));
      });

    return Object.entries(breakdown)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, data]) => ({ date, ...data }));
  }, [transactions]);

  // Simple bar chart data for sales over time
  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.status === 'completed')
      .forEach(t => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        data[date] = (data[date] || 0) + Math.abs(Number(t.total_amount));
      });

    return Object.entries(data)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-30) // Last 30 days for chart
      .map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  const handleExportCSV = () => {
    const data = [
      ['Sales Report', getDateRange().from.split('T')[0], 'to', getDateRange().to.split('T')[0]],
      [],
      ['Summary'],
      ['Total Revenue', `$${metrics.totalRevenue.toFixed(2)}`],
      ['Total Transactions', metrics.totalTransactions],
      ['Average Transaction', `$${metrics.avgTransaction.toFixed(2)}`],
      ['Net Sales', `$${metrics.netSales.toFixed(2)}`],
      ['HST Collected', `$${metrics.hstCollected.toFixed(2)}`],
      [],
      ['Payment Method Breakdown'],
      ['Method', 'Transactions', 'Amount', 'Percentage'],
      ...Object.entries(paymentBreakdown).map(([method, data]) => [
        method,
        data.count,
        `$${data.amount.toFixed(2)}`,
        `${data.percentage.toFixed(1)}%`,
      ]),
      [],
      ['Daily Breakdown'],
      ['Date', 'Transactions', 'Cash', 'Debit', 'Visa', 'Mastercard', 'Amex', 'Gift Card', 'Total'],
      ...dailyBreakdown.map(d => [
        d.date,
        d.transactions,
        `$${(d.Cash || 0).toFixed(2)}`,
        `$${(d.Debit || 0).toFixed(2)}`,
        `$${(d.Visa || 0).toFixed(2)}`,
        `$${(d.Mastercard || 0).toFixed(2)}`,
        `$${(d.Amex || 0).toFixed(2)}`,
        `$${(d['Gift Card'] || 0).toFixed(2)}`,
        `$${(d.total || 0).toFixed(2)}`,
      ]),
    ];

    downloadCSV(data, `sales-report-${getDateRange().from.split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    const { from, to } = getDateRange();
    generatePDF({
      title: `Sales Report - ${from.split('T')[0]} to ${to.split('T')[0]}`,
      sections: [
        {
          type: 'summary-cards',
          cards: [
            { label: 'Total Revenue', value: `$${metrics.totalRevenue.toFixed(2)}`, icon: '💰' },
            { label: 'Transactions', value: metrics.totalTransactions.toString(), icon: '📊' },
            { label: 'Avg Transaction', value: `$${metrics.avgTransaction.toFixed(2)}`, icon: '📈' },
            { label: 'HST Collected', value: `$${metrics.hstCollected.toFixed(2)}`, icon: '🧮' },
          ],
        },
        {
          type: 'table',
          title: 'Payment Method Breakdown',
          headers: ['Method', 'Transactions', 'Amount', '%'],
          rows: Object.entries(paymentBreakdown).map(([method, data]) => [
            method,
            data.count.toString(),
            `$${data.amount.toFixed(2)}`,
            `${data.percentage.toFixed(1)}%`,
          ]),
        },
        {
          type: 'table',
          title: 'Daily Breakdown',
          headers: ['Date', 'Txns', 'Cash', 'Debit', 'Visa', 'MC', 'Amex', 'GC', 'Total'],
          rows: dailyBreakdown.slice(0, 30).map(d => [
            d.date,
            d.transactions.toString(),
            `$${(d.Cash || 0).toFixed(2)}`,
            `$${(d.Debit || 0).toFixed(2)}`,
            `$${(d.Visa || 0).toFixed(2)}`,
            `$${(d.Mastercard || 0).toFixed(2)}`,
            `$${(d.Amex || 0).toFixed(2)}`,
            `$${(d['Gift Card'] || 0).toFixed(2)}`,
            `$${(d.total || 0).toFixed(2)}`,
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Period</label>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase ${
                  filterType === f
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filterType === 'custom' && (
          <>
            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">To</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
              />
            </div>
          </>
        )}

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={`$${metrics.totalRevenue.toFixed(2)}`} icon="💰" />
        <MetricCard label="Transactions" value={metrics.totalTransactions.toString()} icon="📊" />
        <MetricCard label="Avg Transaction" value={`$${metrics.avgTransaction.toFixed(2)}`} icon="📈" />
        <MetricCard label="HST Collected" value={`$${metrics.hstCollected.toFixed(2)}`} icon="🧮" />
      </div>

      {/* Payment Breakdown */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Payment Method Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Method</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Transactions</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Amount</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(paymentBreakdown).map(([method, data], idx) => (
                <tr key={method} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{method}</td>
                  <td className="text-right py-2 px-3 text-zinc-700">{data.count}</td>
                  <td className="text-right py-2 px-3 font-bold text-zinc-900">${data.amount.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 text-zinc-700">{data.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Daily Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-2 font-bold text-zinc-600">Date</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Txns</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Cash</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Debit</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Visa</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">MC</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Amex</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">GC</th>
                <th className="text-right py-2 px-2 font-bold text-zinc-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {dailyBreakdown.map((day, idx) => (
                <tr key={day.date} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-2 font-bold text-zinc-900">{day.date}</td>
                  <td className="text-right py-2 px-2">{day.transactions}</td>
                  <td className="text-right py-2 px-2">${(day.Cash || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2">${(day.Debit || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2">${(day.Visa || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2">${(day.Mastercard || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2">${(day.Amex || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2">${(day['Gift Card'] || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-2 font-bold">${day.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Sales Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
            Sales Trend
          </h3>
          <SimpleBarChart data={chartData} />
        </div>
      )}

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
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
        >
          <Download size={14} />
          Print / Save PDF
        </button>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; icon: string }> = ({
  label,
  value,
  icon,
}) => (
  <div className="bg-white rounded-lg border border-zinc-200 p-4">
    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-2xl font-black text-zinc-900">{value}</p>
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);

const SimpleBarChart: React.FC<{ data: Array<{ date: string; amount: number }> }> = ({ data }) => {
  const maxAmount = Math.max(...data.map(d => d.amount));
  const width = 600;
  const height = 300;
  const padding = 40;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line
            x1={padding}
            y1={height - padding - (height - 2 * padding) * pct}
            x2={width - padding}
            y2={height - padding - (height - 2 * padding) * pct}
            stroke="#e4e4e7"
            strokeDasharray="4"
          />
          <text
            x={padding - 5}
            y={height - padding - (height - 2 * padding) * pct + 3}
            textAnchor="end"
            fontSize="11"
            fill="#a1a1aa"
          >
            ${((maxAmount * pct) / 1000).toFixed(1)}k
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barWidth = (width - 2 * padding) / data.length;
        const barHeight = ((d.amount / maxAmount) * (height - 2 * padding)) || 1;
        const x = padding + i * barWidth + barWidth * 0.1;
        const y = height - padding - barHeight;

        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barWidth * 0.8} height={barHeight} fill="#09090b" rx="2" />
            <text
              x={x + (barWidth * 0.8) / 2}
              y={height - padding + 15}
              textAnchor="middle"
              fontSize="10"
              fill="#52525b"
            >
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#09090b" strokeWidth="2" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#09090b" strokeWidth="2" />
    </svg>
  );
};

