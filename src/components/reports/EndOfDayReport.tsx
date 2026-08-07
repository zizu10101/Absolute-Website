import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { useSettings } from '../../context/SettingsContext';
import { generateThermalReceiptHTML } from '../../utils/thermalReceipt';
import { getEasternDayRange, getTodayEastern } from '../../utils/timezoneUtils';

interface EndOfDayReportProps {
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
  payment_splits?: Array<{ method: string; amount: number }>;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  amount: number;
}

export const EndOfDayReport: React.FC<EndOfDayReportProps> = ({ logo: logoFromProps }) => {
  const { logo: logoFromSettings } = useSettings();
  const logo = logoFromProps || logoFromSettings;

  const [selectedDate, setSelectedDate] = useState<string>(getTodayEastern());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [giftCardData, setGiftCardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert Eastern time day to UTC range
      const { start, end } = getEasternDayRange(selectedDate);


      // Fetch transactions in Eastern day range (converted to UTC)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('status', 'voided');

      if (txError) throw txError;
      setTransactions(txData || []);

      // Fetch gift card data in Eastern day range (converted to UTC)
      const { data: gcData, error: gcError } = await supabase
        .from('gift_card_transactions')
        .select('*, gift_cards(*)')
        .gte('created_at', start)
        .lte('created_at', end);

      if (!gcError) {
        const sold = gcData?.filter(g => g.transaction_type === 'issue') || [];
        const redeemed = gcData?.filter(g => g.transaction_type === 'redeem') || [];
        setGiftCardData({
          sold: sold.length,
          soldValue: sold.reduce((sum, g) => sum + (g.amount || 0), 0),
          redeemed: redeemed.length,
          redeemedValue: redeemed.reduce((sum, g) => sum + (g.amount || 0), 0),
        });
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed');
    const voided = transactions.filter(t => t.status === 'voided');
    const refunded = transactions.filter(t => t.status === 'refunded');

    const totalCompleted = completed.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);
    const totalVoided = voided.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);
    const totalRefunded = refunded.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);

    const netSale = totalCompleted / 1.13;
    const hstCollected = totalCompleted - netSale;

    return {
      totalSales: totalCompleted,
      totalTransactions: completed.length,
      hstCollected,
      netSales: netSale,
      voidedCount: voided.length,
      voidedAmount: totalVoided,
      refundedCount: refunded.length,
      refundedAmount: totalRefunded,
    };
  }, [transactions]);

  // Payment breakdown - handles both single payment method and split payments
  const paymentBreakdown = useMemo(() => {
    interface BreakdownWithTxIds extends PaymentBreakdown {
      txIds?: Set<string>;
    }
    const breakdown: Record<string, BreakdownWithTxIds> = {};

    const completed = transactions.filter(t => t.status === 'completed');

    completed.forEach((t) => {
      // Check if transaction has split payments
      if (t.payment_splits && Array.isArray(t.payment_splits) && t.payment_splits.length > 0) {
        // Handle split payments - sum each method's amount
        t.payment_splits.forEach(split => {
          const method = split.method || 'Other';
          if (!breakdown[method]) breakdown[method] = { method, count: 0, amount: 0, txIds: new Set() };
          breakdown[method].amount += Math.abs(Number(split.amount || 0));
          // Increment count only once per transaction (not per split)
          breakdown[method].txIds?.add(t.id);
        });
      } else {
        // Single payment method
        const method = t.method || 'Other';
        if (!breakdown[method]) breakdown[method] = { method, count: 0, amount: 0 };
        breakdown[method].count += 1;
        breakdown[method].amount += Math.abs(Number(t.total_amount));
      }
    });

    // Set count from unique transaction IDs for split payments
    Object.values(breakdown).forEach(item => {
      if (item.txIds && item.txIds.size > 0) {
        item.count = item.txIds.size;
      }
    });

    // Filter to only include methods with amount > 0, sorted by amount descending
    return Object.values(breakdown)
      .filter(item => item.amount > 0)
      .map(({ txIds, ...item }) => item) // Remove txIds before returning
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Top products
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; size: string; qty: number; revenue: number }> = {};

    transactions
      .filter(t => t.status === 'completed')
      .forEach(t => {
        (t.items || []).forEach((item: any) => {
          const key = `${item.name}|${item.size || 'One Size'}`;
          if (!productSales[key]) {
            productSales[key] = {
              name: item.name,
              size: item.size || 'One Size',
              qty: 0,
              revenue: 0,
            };
          }
          productSales[key].qty += item.quantity || 1;
          productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });

    return Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [transactions]);

  const handleExportCSV = () => {
    const data = [
      ['End of Day Report', selectedDate],
      [],
      ['Summary'],
      ['Total Sales', `$${metrics.totalSales.toFixed(2)}`],
      ['Total Transactions', metrics.totalTransactions],
      ['Net Sales (before tax)', `$${metrics.netSales.toFixed(2)}`],
      ['HST Collected (13%)', `$${metrics.hstCollected.toFixed(2)}`],
      [],
      ['Payment Breakdown'],
      ['Payment Method', 'Transactions', 'Amount'],
      ...paymentBreakdown.map(p => [p.method, p.count, `$${p.amount.toFixed(2)}`]),
      [],
      ['Voids & Refunds'],
      ['Voided Transactions', metrics.voidedCount, `$${metrics.voidedAmount.toFixed(2)}`],
      ['Refunded Transactions', metrics.refundedCount, `$${metrics.refundedAmount.toFixed(2)}`],
      [],
      ['Top 10 Products Sold'],
      ['Product', 'Size', 'Quantity', 'Revenue'],
      ...topProducts.map(p => [p.name, p.size, p.qty, `$${p.revenue.toFixed(2)}`]),
    ];

    downloadCSV(data, `eod-report-${selectedDate}.csv`);
  };

  const handlePrintThermal = () => {
    const receiptDate = new Date(selectedDate);
    const html = generateThermalReceiptHTML({
      transactionId: `EOD-${selectedDate.replace(/-/g, '')}`,
      customerName: 'END OF DAY REPORT',
      items: [
        {
          name: '═══════════════════════',
          quantity: 1,
          price: 0,
          size: '',
          ageGroup: '',
        },
        ...paymentBreakdown.map(p => ({
          name: `${p.method}`,
          quantity: p.count,
          price: p.amount / p.count,
          size: '',
          ageGroup: `${p.count} x $${(p.amount / p.count).toFixed(2)}`,
        })),
        {
          name: '═══════════════════════',
          quantity: 1,
          price: 0,
          size: '',
          ageGroup: '',
        },
      ],
      subtotal: metrics.netSales,
      hst: metrics.hstCollected,
      total: metrics.totalSales,
      paymentMethod: `${metrics.totalTransactions} Transactions`,
      createdAt: receiptDate,
      status: 'completed',
      logoUrl: logo,
    });

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  const handlePrint = () => {
    generatePDF({
      title: `End of Day Report - ${selectedDate}`,
      sections: [
        {
          type: 'summary-cards',
          cards: [
            { label: 'Total Sales', value: `$${metrics.totalSales.toFixed(2)}`,icon: '' },
            { label: 'Transactions', value: metrics.totalTransactions.toString(),icon: '' },
            { label: 'Net Sales', value: `$${metrics.netSales.toFixed(2)}`, icon: '' },
            { label: 'HST Collected', value: `$${metrics.hstCollected.toFixed(2)}`, icon: '🧮' },
          ],
        },
        {
          type: 'table',
          title: 'Payment Breakdown',
          headers: ['Payment Method', '# Transactions', 'Amount'],
          rows: paymentBreakdown.map(p => [
            p.method,
            p.count.toString(),
            `$${p.amount.toFixed(2)}`,
          ]),
        },
        {
          type: 'table',
          title: 'Voids & Refunds',
          headers: ['Type', 'Count', 'Amount'],
          rows: [
            ['Voided', metrics.voidedCount.toString(), `$${metrics.voidedAmount.toFixed(2)}`],
            ['Refunded', metrics.refundedCount.toString(), `$${metrics.refundedAmount.toFixed(2)}`],
          ],
        },
        {
          type: 'table',
          title: 'Top 10 Products',
          headers: ['Product', 'Size', 'Qty', 'Revenue'],
          rows: topProducts.map(p => [p.name, p.size, p.qty.toString(), `$${p.revenue.toFixed(2)}`]),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Sales" value={`$${metrics.totalSales.toFixed(2)}`} icon="" />
        <SummaryCard label="Transactions" value={metrics.totalTransactions.toString()} icon="" />
        <SummaryCard label="Net Sales" value={`$${metrics.netSales.toFixed(2)}`} icon="" />
        <SummaryCard label="HST Collected" value={`$${metrics.hstCollected.toFixed(2)}`} icon="🧮" />
      </div>

      {/* Payment Breakdown Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Payment Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Payment Method</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600"># Transactions</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentBreakdown.map((payment, idx) => (
                <tr key={payment.method} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{payment.method}</td>
                  <td className="text-right py-2 px-3 text-zinc-700">{payment.count}</td>
                  <td className="text-right py-2 px-3 font-bold text-zinc-900">${payment.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                <td className="py-2 px-3 text-zinc-900">TOTAL</td>
                <td className="text-right py-2 px-3 text-zinc-900">{paymentBreakdown.reduce((s, p) => s + p.count, 0)}</td>
                <td className="text-right py-2 px-3 text-zinc-900">${paymentBreakdown.reduce((s, p) => s + p.amount, 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Voids & Refunds */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-red-900 mb-4">
            Voided Transactions
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-600">Count:</span>
              <span className="font-bold text-red-900">{metrics.voidedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Total Amount:</span>
              <span className="font-bold text-red-900">${metrics.voidedAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-900 mb-4">
            Refunded Transactions
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-600">Count:</span>
              <span className="font-bold text-amber-900">{metrics.refundedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Total Amount:</span>
              <span className="font-bold text-amber-900">${metrics.refundedAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gift Cards */}
      {giftCardData && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900 mb-4">
            Gift Cards
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-emerald-700 font-bold uppercase mb-2">Sold</p>
              <p className="text-2xl font-black text-emerald-900">{giftCardData.sold}</p>
              <p className="text-xs text-emerald-700 mt-1">${giftCardData.soldValue.toFixed(2)} value</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-700 font-bold uppercase mb-2">Redeemed</p>
              <p className="text-2xl font-black text-emerald-900">{giftCardData.redeemed}</p>
              <p className="text-xs text-emerald-700 mt-1">${giftCardData.redeemedValue.toFixed(2)} value</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Products */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Top 10 Products Sold Today
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Product</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Size</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Qty</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{product.name}</td>
                  <td className="py-2 px-3 text-zinc-600">{product.size}</td>
                  <td className="text-right py-2 px-3 text-zinc-700">{product.qty}</td>
                  <td className="text-right py-2 px-3 font-bold text-zinc-900">${product.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          onClick={handlePrintThermal}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
        >
          <Download size={14} />
          Print to Receipt Printer
        </button>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; icon: string }> = ({ label, value, icon }) => (
  <div className="bg-white rounded-lg border border-zinc-200 p-4">
    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-2xl font-black text-zinc-900">{value}</p>
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);
