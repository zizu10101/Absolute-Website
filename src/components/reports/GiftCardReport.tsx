import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { getTodayEastern, shiftEasternDate, getEasternRangeUTC, formatEasternDate } from '../../utils/timezoneUtils';

interface GiftCardReportProps {
  logo?: string;
}

interface GiftCard {
  id: string;
  card_number: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  customer_id: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
}

export const GiftCardReport: React.FC<GiftCardReportProps> = ({ logo }) => {
  const [dateFrom, setDateFrom] = useState<string>(shiftEasternDate(getTodayEastern(), -90));
  const [dateTo, setDateTo] = useState<string>(getTodayEastern());
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert the Eastern calendar range to UTC for the Supabase query
      const { start, end } = getEasternRangeUTC(dateFrom, dateTo);

      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, customers(first_name, last_name)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGiftCards(data || []);
    } catch (error) {
      console.error('Error fetching gift card data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const totalIssued = giftCards.reduce((sum, gc) => sum + (gc.initial_balance || 0), 0);
    const totalRedeemed = giftCards.reduce(
      (sum, gc) => sum + ((gc.initial_balance || 0) - (gc.current_balance || 0)),
      0
    );
    const totalOutstanding = giftCards.reduce((sum, gc) => sum + (gc.current_balance || 0), 0);

    return {
      count: giftCards.length,
      totalIssued,
      totalRedeemed,
      totalOutstanding,
      activeCount: giftCards.filter(gc => gc.is_active).length,
      depletedCount: giftCards.filter(gc => gc.current_balance === 0).length,
    };
  }, [giftCards]);

  const getCustomerName = (gc: GiftCard) => {
    if (!gc.customer_id || !gc.customers) return 'No Customer';
    return `${gc.customers.first_name} ${gc.customers.last_name}`;
  };

  const handleExportCSV = () => {
    const data = [
      ['Gift Card Report', dateFrom, 'to', dateTo],
      [],
      ['Summary'],
      ['Total Gift Cards', metrics.count],
      ['Total Value Issued', `$${metrics.totalIssued.toFixed(2)}`],
      ['Total Redeemed', `$${metrics.totalRedeemed.toFixed(2)}`],
      ['Outstanding Balance', `$${metrics.totalOutstanding.toFixed(2)}`],
      ['Active Cards', metrics.activeCount],
      ['Depleted Cards', metrics.depletedCount],
      [],
      ['Gift Cards'],
      ['Card Number', 'Customer', 'Issued Date', 'Initial Balance', 'Current Balance', 'Redeemed', 'Status', 'Last Used'],
      ...giftCards.map(gc => [
        gc.card_number,
        getCustomerName(gc),
        formatEasternDate(gc.created_at),
        `$${(gc.initial_balance || 0).toFixed(2)}`,
        `$${(gc.current_balance || 0).toFixed(2)}`,
        `$${((gc.initial_balance || 0) - (gc.current_balance || 0)).toFixed(2)}`,
        gc.is_active ? 'Active' : 'Inactive',
        '-',
      ]),
    ];
    downloadCSV(data, `gift-card-report-${dateFrom}.csv`);
  };

  const handlePrint = () => {
    generatePDF({
      title: `Gift Card Report - ${dateFrom} to ${dateTo}`,
      sections: [
        {
          type: 'summary-cards',
          cards: [
            { label: 'Cards Issued', value: metrics.count.toString(),icon: '' },
            { label: 'Total Value', value: `$${metrics.totalIssued.toFixed(2)}`,icon: '' },
            { label: 'Total Redeemed', value: `$${metrics.totalRedeemed.toFixed(2)}`,icon: '' },
            { label: 'Outstanding', value: `$${metrics.totalOutstanding.toFixed(2)}`, icon: '⏳' },
          ],
        },
        {
          type: 'table',
          title: 'Gift Cards',
          headers: ['Card #', 'Customer', 'Issued', 'Initial', 'Current', 'Redeemed', 'Status'],
          rows: giftCards.map(gc => [
            gc.card_number.slice(-8),
            getCustomerName(gc),
            formatEasternDate(gc.created_at),
            `$${(gc.initial_balance || 0).toFixed(2)}`,
            `$${(gc.current_balance || 0).toFixed(2)}`,
            `$${((gc.initial_balance || 0) - (gc.current_balance || 0)).toFixed(2)}`,
            gc.is_active ? 'Active' : 'Inactive',
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Gift Cards" value={metrics.count.toString()} icon="" />
        <MetricCard label="Total Issued" value={`$${metrics.totalIssued.toFixed(2)}`} icon="" />
        <MetricCard label="Total Redeemed" value={`$${metrics.totalRedeemed.toFixed(2)}`} icon="" />
        <MetricCard label="Outstanding" value={`$${metrics.totalOutstanding.toFixed(2)}`} icon="⏳" />
      </div>

      {/* Status Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900 mb-4">
            Active Cards
          </h3>
          <p className="text-3xl font-black text-emerald-900">{metrics.activeCount}</p>
          <p className="text-xs text-emerald-700 mt-2">Cards with balance remaining</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-red-900 mb-4">
            Depleted Cards
          </h3>
          <p className="text-3xl font-black text-red-900">{metrics.depletedCount}</p>
          <p className="text-xs text-red-700 mt-2">Cards with $0 balance</p>
        </div>
      </div>

      {/* Gift Cards Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Gift Cards ({giftCards.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Card Number</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Customer</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Issued</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Initial</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Current</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Redeemed</th>
                <th className="text-center py-2 px-3 font-bold text-zinc-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {giftCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 text-xs">
                    No gift cards found for the selected period
                  </td>
                </tr>
              ) : (
                giftCards.map((gc, idx) => (
                  <tr key={gc.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-mono text-zinc-600">{gc.card_number.slice(-8)}</td>
                    <td className="py-2 px-3 text-zinc-900">{getCustomerName(gc)}</td>
                    <td className="py-2 px-3 text-zinc-600">{formatEasternDate(gc.created_at)}</td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">
                      ${(gc.initial_balance || 0).toFixed(2)}
                    </td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">
                      ${(gc.current_balance || 0).toFixed(2)}
                    </td>
                    <td className="text-right py-2 px-3 text-zinc-700">
                      ${((gc.initial_balance || 0) - (gc.current_balance || 0)).toFixed(2)}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[9px] font-bold uppercase ${
                          gc.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {gc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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
