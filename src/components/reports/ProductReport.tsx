import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { getTodayEastern, shiftEasternDate, getEasternRangeUTC } from '../../utils/timezoneUtils';

interface ProductReportProps {
  logo?: string;
}

type SortBy = 'revenue' | 'quantity' | 'name';

export const ProductReport: React.FC<ProductReportProps> = ({ logo }) => {
  const [dateFrom, setDateFrom] = useState<string>(shiftEasternDate(getTodayEastern(), -30));
  const [dateTo, setDateTo] = useState<string>(getTodayEastern());
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [returnsData, setReturnsData] = useState<Array<{ transaction_id: string; items: any[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fallback categories - combine with dynamic ones
  const fallbackCategories = [
    'Footwear',
    'Clubs',
    'National Teams',
    'Apparel',
    'Equipment',
    'Training',
    'Soccer Balls',
    'Shin Guards',
    'Gloves',
    'Accessories',
  ];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert Eastern time range to UTC
      const { start, end } = getEasternRangeUTC(dateFrom, dateTo);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .neq('status', 'voided')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) throw error;
      setTransactions(data || []);

      const { data: rtnTableData } = await supabase
        .from('returns')
        .select('transaction_id, items')
        .gte('created_at', start)
        .lte('created_at', end);
      setReturnsData(rtnTableData || []);
    } catch (error) {
      console.error('Error fetching product data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  // Combine dynamic categories from data with fallback categories
  const availableCategories = useMemo(() => {
    const cats = new Set(['All']);

    // Add fallback categories
    fallbackCategories.forEach(cat => cats.add(cat));

    // Add any categories found in actual data
    transactions.forEach(t => {
      (t.items || []).forEach((item: any) => {
        if (item.category) {
          cats.add(item.category);
        } else {
          cats.add('Uncategorized');
        }
      });
    });

    return Array.from(cats).sort();
  }, [transactions]);

  const productData = useMemo(() => {
    const products: Record<
      string,
      { name: string; category: string; quantity: number; revenue: number; price: number }
    > = {};

    // sold quantities per transaction per variantId — used to guard and cap returns
    const soldByTx: Record<string, Record<string, { name: string; category: string; qty: number; price: number }>> = {};
    const saleTxIds = new Set<string>();

    const saleTxs = transactions.filter(
      t =>
        t.status === 'completed' &&
        !t.invoice_number?.startsWith('RTN-') &&
        !t.invoice_number?.startsWith('EXC-')
    );

    saleTxs.forEach(t => {
      saleTxIds.add(t.id);
      (t.items || []).forEach((item: any) => {
        const key = `${item.name}`;
        if (!products[key]) {
          products[key] = {
            name: item.name,
            category: item.category || 'Uncategorized',
            quantity: 0,
            revenue: 0,
            price: 0,
          };
        }
        const qty = item.quantity || 1;
        const price = item.price || 0;
        products[key].quantity += qty;
        products[key].revenue += price * qty;
        products[key].price = price;
        if (item.variantId) {
          if (!soldByTx[t.id]) soldByTx[t.id] = {};
          if (!soldByTx[t.id][item.variantId]) {
            soldByTx[t.id][item.variantId] = {
              name: item.name,
              category: item.category || 'Uncategorized',
              qty: 0,
              price,
            };
          }
          soldByTx[t.id][item.variantId].qty += qty;
        }
      });
    });

    // Subtract returned items:
    // - only if the return's transaction_id is an original sale in this date range
    // - only if variantId matches a sold item in that specific transaction
    // - capped at that transaction's sold qty (never goes negative)
    returnsData.forEach(r => {
      if (!saleTxIds.has(r.transaction_id)) return;
      const txSold = soldByTx[r.transaction_id] || {};
      (r.items || []).forEach((item: any) => {
        if (!item.variantId) return;
        const sold = txSold[item.variantId];
        if (!sold) return;
        const returnQty = Math.min(item.returnQuantity || 1, sold.qty);
        products[sold.name].quantity -= returnQty;
        products[sold.name].revenue -= (item.pricePerUnit || sold.price) * returnQty;
      });
    });

    let filtered = Object.values(products).filter(p => p.quantity > 0);

    if (categoryFilter !== 'All') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.revenue - a.revenue;
        case 'quantity':
          return b.quantity - a.quantity;
        case 'name':
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [transactions, categoryFilter, sortBy, returnsData]);

  const handleExportCSV = () => {
    const data = [
      ['Product Report', dateFrom, 'to', dateTo],
      [],
      ['Product', 'Category', 'Qty Sold', 'Revenue', 'Avg Price'],
      ...productData.map(p => [
        p.name,
        p.category,
        p.quantity,
        `$${p.revenue.toFixed(2)}`,
        `$${(p.revenue / p.quantity).toFixed(2)}`,
      ]),
    ];
    downloadCSV(data, `product-report-${dateFrom}.csv`);
  };

  const handlePrint = () => {
    generatePDF({
      title: `Product Report - ${dateFrom} to ${dateTo}`,
      sections: [
        {
          type: 'table',
          title: 'Products Sold',
          headers: ['Product', 'Category', 'Qty', 'Revenue', 'Avg Price'],
          rows: productData.map(p => [
            p.name,
            p.category,
            p.quantity.toString(),
            `$${p.revenue.toFixed(2)}`,
            `$${(p.revenue / p.quantity).toFixed(2)}`,
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
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

        <div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Category</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="px-3 py-1.5 border border-zinc-200 rounded text-sm"
          >
            <option value="revenue">Revenue (High to Low)</option>
            <option value="quantity">Quantity (High to Low)</option>
            <option value="name">Name (A to Z)</option>
          </select>
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

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Products Sold ({productData.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Product</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Category</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Qty Sold</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Revenue</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {productData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400 text-xs">
                    No products found for the selected period
                  </td>
                </tr>
              ) : (
                productData.map((product, idx) => (
                  <tr key={product.name} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-bold text-zinc-900">{product.name}</td>
                    <td className="py-2 px-3 text-zinc-600">{product.category}</td>
                    <td className="text-right py-2 px-3 text-zinc-700">{product.quantity}</td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">
                      ${product.revenue.toFixed(2)}
                    </td>
                    <td className="text-right py-2 px-3 text-zinc-700">
                      ${(product.revenue / product.quantity).toFixed(2)}
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
