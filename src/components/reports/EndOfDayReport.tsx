import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw, X } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { useSettings } from '../../context/SettingsContext';
import { generateThermalReceiptHTML } from '../../utils/thermalReceipt';
import { getEasternDayRange, getTodayEastern } from '../../utils/timezoneUtils';
import { computeReturnSubtractions } from '../../utils/reportUtils';

interface EndOfDayReportProps {
  logo?: string;
}

interface Transaction {
  id: string;
  invoice_number?: string;
  related_transaction_id?: string;
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
  const [originalSaleInvoices, setOriginalSaleInvoices] = useState<Record<string, string>>({});
  const [storeCreditData, setStoreCreditData] = useState<{
    issued: Array<{ id: string; card_number: string; amount: number; customerName: string }>;
    redeemedCount: number;
    redeemedTotal: number;
  } | null>(null);
  const [returnsData, setReturnsData] = useState<Array<{ transaction_id: string; items: any[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEODPreview, setShowEODPreview] = useState(false);
  const [eodPreviewHTML, setEODPreviewHTML] = useState<string>('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert Eastern time day to UTC range
      const { start, end } = getEasternDayRange(selectedDate);


      // Fetch transactions in Eastern day range (converted to UTC).
      // 'Other' is a separate off-books tender type (see the Cash Report tab) - it never
      // appears in the regular EOD report or counts toward its totals.
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('status', 'voided')
        .neq('method', 'Other');

      if (txError) throw txError;
      setTransactions(txData || []);

      // For RTN-/EXC- entries, fetch the original sale's invoice number for the Returns section
      const refundEntries = (txData || []).filter((t: any) =>
        t.invoice_number?.startsWith('RTN-') || t.invoice_number?.startsWith('EXC-')
      );
      const origIds = [...new Set(
        refundEntries.map((t: any) => t.related_transaction_id).filter(Boolean) as string[]
      )];
      if (origIds.length > 0) {
        const { data: origTxs } = await supabase
          .from('transactions')
          .select('id, invoice_number')
          .in('id', origIds);
        const map: Record<string, string> = {};
        (origTxs || []).forEach((t: any) => {
          map[t.id] = t.invoice_number || t.id.slice(0, 8).toUpperCase();
        });
        setOriginalSaleInvoices(map);
      } else {
        setOriginalSaleInvoices({});
      }

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

      // Fetch store credits issued today (from store_credits.created_at)
      const { data: scIssuedData } = await supabase
        .from('store_credits')
        .select('id, card_number, amount, customer_id')
        .gte('created_at', start)
        .lte('created_at', end);

      const customerIds = [...new Set(
        (scIssuedData || []).filter((s: any) => s.customer_id).map((s: any) => s.customer_id as string)
      )];
      const custMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: custs } = await supabase
          .from('customers')
          .select('id, first_name, last_name')
          .in('id', customerIds);
        (custs || []).forEach((c: any) => {
          custMap[c.id] = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        });
      }

      // Fetch store credit redemptions today (from store_credit_transactions)
      const { data: scRedeemedData } = await supabase
        .from('store_credit_transactions')
        .select('id, amount, transaction_type')
        .eq('transaction_type', 'redeemed')
        .gte('created_at', start)
        .lte('created_at', end);

      setStoreCreditData({
        issued: (scIssuedData || []).map((s: any) => ({
          id: s.id,
          card_number: s.card_number,
          amount: Number(s.amount),
          customerName: s.customer_id ? (custMap[s.customer_id] || 'Unknown') : 'Walk-in',
        })),
        redeemedCount: (scRedeemedData || []).length,
        redeemedTotal: (scRedeemedData || []).reduce(
          (sum: number, r: any) => sum + Math.abs(Number(r.amount)),
          0
        ),
      });

      // Fetch returns records created today (items have returnQuantity and pricePerUnit)
      const { data: rtnTableData } = await supabase
        .from('returns')
        .select('transaction_id, items')
        .gte('created_at', start)
        .lte('created_at', end);
      setReturnsData(rtnTableData || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Handle Escape key to close EOD preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEODPreview(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed');
    const voided = transactions.filter(t => t.status === 'voided');
    const refunded = transactions.filter(t => t.status === 'refunded');

    // RTN- and EXC- entries are excluded from "Total Sales" and transaction count
    const saleTxs = completed.filter(t =>
      !t.invoice_number?.startsWith('RTN-') && !t.invoice_number?.startsWith('EXC-')
    );
    const refundTxs = completed.filter(t =>
      t.invoice_number?.startsWith('RTN-') || t.invoice_number?.startsWith('EXC-')
    );

    const grossSales = saleTxs.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const totalRefundsCredits = refundTxs.reduce((sum, t) => sum + Math.abs(Number(t.total_amount)), 0);
    const netTotal = grossSales - totalRefundsCredits;

    const totalVoided = voided.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const totalRefunded = refunded.reduce((sum, t) => sum + Number(t.total_amount), 0);

    const netSaleBeforeTax = grossSales / 1.13;
    const hstCollected = grossSales - netSaleBeforeTax;

    return {
      totalSales: grossSales,
      totalTransactions: saleTxs.length,
      totalRefundsCredits,
      netTotal,
      hstCollected,
      netSales: netSaleBeforeTax,
      voidedCount: voided.length,
      voidedAmount: Math.abs(totalVoided),
      refundedCount: refunded.length,
      refundedAmount: Math.abs(totalRefunded),
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
          breakdown[method].amount += Number(split.amount || 0);
          // Increment count only once per transaction (not per split)
          breakdown[method].txIds?.add(t.id);
        });
      } else {
        // Single payment method
        const method = t.method || 'Other';
        if (!breakdown[method]) breakdown[method] = { method, count: 0, amount: 0 };
        breakdown[method].count += 1;
        breakdown[method].amount += Number(t.total_amount);
      }
    });

    // Set count from unique transaction IDs for split payments
    Object.values(breakdown).forEach(item => {
      if (item.txIds && item.txIds.size > 0) {
        item.count = item.txIds.size;
      }
    });

    // Only real payment methods; Exchange (even-swap) and Store Credit move to Returns section
    return Object.values(breakdown)
      .filter(item => item.amount !== 0 && item.method !== 'Exchange' && item.method !== 'Store Credit')
      .map(({ txIds, ...item }) => item) // Remove txIds before returning
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const moneyCollected = useMemo(() => {
    const realMethods = new Set(['Cash', 'Debit', 'Visa', 'Mastercard', 'MC', 'Amex', 'Cheque']);
    return paymentBreakdown
      .filter(p => realMethods.has(p.method))
      .reduce((s, p) => s + p.amount, 0);
  }, [paymentBreakdown]);

  // Top products: only regular sales (no RTN-/EXC-); subtract returns via shared helper
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; size: string; qty: number; revenue: number }> = {};

    const saleTxs = transactions.filter(
      t =>
        t.status === 'completed' &&
        !t.invoice_number?.startsWith('RTN-') &&
        !t.invoice_number?.startsWith('EXC-')
    );

    saleTxs.forEach(t => {
      (t.items || []).forEach((item: any) => {
        const key = `${item.name}|${item.size || 'One Size'}`;
        if (!productSales[key]) {
          productSales[key] = { name: item.name, size: item.size || 'One Size', qty: 0, revenue: 0 };
        }
        productSales[key].qty += item.quantity || 1;
        productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });

    // Subtract returns: only when transaction_id is a sale in this range and variantId matches
    const subtractions = computeReturnSubtractions(saleTxs, returnsData);
    Object.values(subtractions).forEach(sub => {
      const key = `${sub.name}|${sub.size}`;
      if (productSales[key]) {
        productSales[key].qty -= sub.qty;
        productSales[key].revenue -= sub.revenue;
      }
    });

    return Object.values(productSales)
      .filter(p => p.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [transactions, returnsData]);

  const refundTransactions = useMemo(() =>
    transactions.filter(t =>
      t.status === 'completed' &&
      (t.invoice_number?.startsWith('RTN-') || t.invoice_number?.startsWith('EXC-'))
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [transactions]
  );

  // Generate clean EOD receipt HTML
  const generateEODReceiptHTML = () => {
    const receiptDate = new Date(selectedDate);
    const dateStr = receiptDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = receiptDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // Get store info
    const storeInfo = {
      name: 'Absolute Soccer Mississauga',
      address: '5600 Rose Cherry Place',
      city: 'Mississauga, ON L4Z 4B6',
      phone: '905-593-3600',
    };

    const paymentRows = paymentBreakdown
      .map(p => `<tr><td style="padding: 3px 4mm; font-family: monospace; font-weight: 700;">${p.method}:</td><td style="text-align: right; padding: 3px 4mm; font-family: monospace; font-weight: 700;">$${p.amount.toFixed(2)}</td></tr>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>End of Day Report</title>
  <style>
    * { margin: 0; padding: 0; font-weight: 700; }
    body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 0; }
    @page { size: 80mm auto; margin: 0; }
    @media print {
      body { width: 80mm; margin: 0; padding: 0; }
    }
    .receipt { width: 72mm; margin: 4mm auto; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 4mm; }
    .logo { max-width: 50mm; height: auto; margin-bottom: 2mm; }
    .store-name { font-size: 12px; margin-bottom: 2mm; }
    .store-info { font-size: 10px; line-height: 1.3; margin-bottom: 4mm; }
    .divider { border-top: 1px solid #000; margin: 3mm 0; }
    .title { font-size: 12px; text-align: center; margin: 4mm 0; }
    .date-time { font-size: 10px; text-align: center; margin-bottom: 4mm; }
    .section-title { font-size: 11px; margin-top: 3mm; margin-bottom: 2mm; text-transform: uppercase; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; font-family: monospace; }
    .label { text-align: left; }
    .amount { text-align: right; }
    .total-row { font-size: 12px; font-weight: 700; }
    .footer { font-size: 10px; text-align: center; margin-top: 4mm; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${logo ? `<img src="${logo}" class="logo" alt="Logo">` : ''}
      <div class="store-name">ABSOLUTE SOCCER MISSISSAUGA</div>
    </div>

    <div class="store-info">
      ${storeInfo.address}<br>
      ${storeInfo.city}<br>
      Tel: ${storeInfo.phone}
    </div>

    <div class="divider"></div>

    <div class="title">END OF DAY REPORT</div>
    <div class="date-time">
      Date: ${dateStr}<br>
      Time: ${timeStr}
    </div>

    <div class="divider"></div>

    <div class="section-title">PAYMENT BREAKDOWN</div>
    <table>
      ${paymentRows}
    </table>

    <div class="divider"></div>

    <table style="margin: 3mm 0;">
      <tr>
        <td class="label">Subtotal:</td>
        <td class="amount">$${metrics.netSales.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label">HST (13%):</td>
        <td class="amount">$${metrics.hstCollected.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td class="label">TOTAL:</td>
        <td class="amount">$${metrics.totalSales.toFixed(2)}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <table style="margin: 3mm 0;">
      <tr>
        <td class="label">Transactions:</td>
        <td class="amount">${metrics.totalTransactions}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <div class="footer">
      Thank you for your business!<br>
      Absolute Soccer
    </div>
  </div>
</body>
</html>
    `;
  };

  const handleExportCSV = () => {
    const data: (string | number)[][] = [
      ['End of Day Report', selectedDate],
      [],
      ['Summary'],
      ['Total Sales (Gross)', `$${metrics.totalSales.toFixed(2)}`],
      ['Total Transactions', metrics.totalTransactions],
      ['Net Sales (before tax)', `$${metrics.netSales.toFixed(2)}`],
      ['HST Collected (13%)', `$${metrics.hstCollected.toFixed(2)}`],
      ...(refundTransactions.length > 0 ? [
        ['Refunds / Credits Issued', `-$${metrics.totalRefundsCredits.toFixed(2)}`],
        ['Net sales after returns', `$${metrics.netTotal.toFixed(2)}`],
      ] : []),
      ['Money collected (Cash/Debit/Card)', `$${moneyCollected.toFixed(2)}`],
      [],
      ['Payment Breakdown'],
      ['Payment Method', 'Transactions', 'Amount'],
      ...paymentBreakdown.map(p => [p.method, p.count, `$${p.amount.toFixed(2)}`]),
      [],
      ['Voids & Refunds'],
      ['Voided Transactions', metrics.voidedCount, `$${metrics.voidedAmount.toFixed(2)}`],
      ['Refunded Transactions', metrics.refundedCount, `$${metrics.refundedAmount.toFixed(2)}`],
      ...(refundTransactions.length > 0 ? [
        [],
        ['Returns & Exchanges'],
        ['Invoice', 'Original Sale', 'Method', 'Amount'],
        ...refundTransactions.map(t => [
          t.invoice_number || '—',
          t.related_transaction_id ? (originalSaleInvoices[t.related_transaction_id] || '—') : '—',
          t.method,
          `-$${Math.abs(Number(t.total_amount)).toFixed(2)}`,
        ]),
      ] : []),
      [],
      ['Top 10 Products Sold'],
      ['Product', 'Size', 'Quantity', 'Revenue'],
      ...topProducts.map(p => [p.name, p.size, p.qty, `$${p.revenue.toFixed(2)}`]),
    ];

    downloadCSV(data, `eod-report-${selectedDate}.csv`);
  };

  const printEODReport = (receiptHTML: string) => {
    // Create hidden iframe for printing (avoids print dialog popup in Firefox fullscreen)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    iframe.contentDocument?.open();
    iframe.contentDocument?.write(receiptHTML);
    iframe.contentDocument?.close();

    iframe.onload = () => {
      iframe.contentWindow?.print();
      // Remove iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  const handlePrintThermal = () => {
    const html = generateEODReceiptHTML();
    setEODPreviewHTML(html);
    setShowEODPreview(true);
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

      {/* Returns / Net / Money collected */}
      {(refundTransactions.length > 0 || metrics.totalTransactions > 0) && (
        <div className="flex gap-4 flex-wrap">
          {refundTransactions.length > 0 && (
            <div className="bg-red-50 rounded-lg border border-red-200 px-5 py-3 flex items-center gap-4">
              <p className="text-[10px] font-bold uppercase text-red-600 whitespace-nowrap">Refunds / Credits Issued</p>
              <p className="text-xl font-black text-red-700">-${metrics.totalRefundsCredits.toFixed(2)}</p>
            </div>
          )}
          {refundTransactions.length > 0 && (
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 px-5 py-3 flex items-center gap-4">
              <p className="text-[10px] font-bold uppercase text-emerald-700 whitespace-nowrap">Net sales after returns</p>
              <p className="text-xl font-black text-emerald-900">${metrics.netTotal.toFixed(2)}</p>
            </div>
          )}
          <div className="bg-blue-50 rounded-lg border border-blue-200 px-5 py-3 flex items-center gap-4">
            <p className="text-[10px] font-bold uppercase text-blue-700 whitespace-nowrap">Money collected</p>
            <p className="text-xl font-black text-blue-900">${moneyCollected.toFixed(2)}</p>
          </div>
        </div>
      )}

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

      {/* Returns & Exchanges */}
      {refundTransactions.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-red-900 mb-4">
            Returns & Exchanges ({refundTransactions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left py-2 px-3 font-bold text-red-700">Invoice</th>
                  <th className="text-left py-2 px-3 font-bold text-red-700">Original Sale</th>
                  <th className="text-left py-2 px-3 font-bold text-red-700">Method</th>
                  <th className="text-right py-2 px-3 font-bold text-red-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refundTransactions.map((t, idx) => {
                  const origInvoice = t.related_transaction_id
                    ? (originalSaleInvoices[t.related_transaction_id] || '—')
                    : '—';
                  return (
                    <tr key={t.id} className={idx % 2 === 0 ? 'bg-red-50' : 'bg-white'}>
                      <td className="py-2 px-3 font-mono font-bold text-xs text-zinc-900">{t.invoice_number || '—'}</td>
                      <td className="py-2 px-3 text-zinc-600 text-xs">{origInvoice}</td>
                      <td className="py-2 px-3 text-zinc-700">{t.method}</td>
                      <td className="py-2 px-3 text-right font-bold text-red-700">
                        -${Math.abs(Number(t.total_amount)).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-red-200">
                  <td colSpan={3} className="py-2 px-3 font-bold text-red-900">Total</td>
                  <td className="py-2 px-3 text-right font-bold text-red-900">
                    -${refundTransactions.reduce((s, t) => s + Math.abs(Number(t.total_amount)), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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

      {/* Store Credits */}
      {storeCreditData && (storeCreditData.issued.length > 0 || storeCreditData.redeemedCount > 0) && (
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-900 mb-4">
            Store Credits
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-indigo-700 font-bold uppercase mb-2">Issued Today</p>
              <p className="text-2xl font-black text-indigo-900">{storeCreditData.issued.length}</p>
              <p className="text-xs text-indigo-700 mt-1">
                ${storeCreditData.issued.reduce((s, i) => s + i.amount, 0).toFixed(2)} total value
              </p>
              {storeCreditData.issued.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {storeCreditData.issued.map(sc => (
                    <div key={sc.id} className="text-xs flex justify-between gap-2 bg-white rounded px-2 py-1.5 border border-indigo-100">
                      <div>
                        <span className="font-mono font-bold text-zinc-900">{sc.card_number}</span>
                        <span className="text-zinc-500 ml-2">{sc.customerName}</span>
                      </div>
                      <span className="font-bold text-indigo-700 shrink-0">${sc.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] text-indigo-700 font-bold uppercase mb-2">Redeemed Today</p>
              <p className="text-2xl font-black text-indigo-900">{storeCreditData.redeemedCount}</p>
              <p className="text-xs text-indigo-700 mt-1">
                ${storeCreditData.redeemedTotal.toFixed(2)} value
              </p>
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

      {/* EOD Receipt Preview Modal */}
      {showEODPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEODPreview(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <div className="sticky top-0 flex items-center justify-between bg-white border-b border-zinc-200 px-6 py-4 z-10">
              <h3 className="text-lg font-bold text-zinc-900">EOD Receipt Preview</h3>
              <button
                onClick={() => setShowEODPreview(false)}
                className="p-2 hover:bg-zinc-100 rounded transition-colors"
                title="Close (ESC)"
              >
                <X size={20} className="text-zinc-600 hover:text-zinc-900" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="p-4">
              <iframe
                srcDoc={eodPreviewHTML}
                style={{
                  width: '100%',
                  height: '600px',
                  border: '1px solid #e4e4e7',
                  borderRadius: '0.5rem',
                }}
                title="EOD Receipt Preview"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
              <button
                onClick={() => {
                  printEODReport(eodPreviewHTML);
                  setShowEODPreview(false);
                }}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded font-bold hover:bg-zinc-800 transition-colors"
              >
                Print
              </button>
              <button
                onClick={() => setShowEODPreview(false)}
                className="px-4 py-2 bg-zinc-200 text-zinc-900 rounded font-bold hover:bg-zinc-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
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
