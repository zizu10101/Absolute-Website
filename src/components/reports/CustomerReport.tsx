import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import { Download, RefreshCw } from 'lucide-react';
import { downloadCSV, generatePDF } from '../../utils/reportExport';
import { getEasternRangeUTC } from '../../utils/timezoneUtils';

interface CustomerReportProps {
  logo?: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  totalPurchases: number;
  totalSpent: number;
  lastVisit: string | null;
  preferredPayment: string;
}

export const CustomerReport: React.FC<CustomerReportProps> = ({ logo }) => {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Convert Eastern time range to UTC
      const { start, end } = getEasternRangeUTC(dateFrom, dateTo);

      // Get all customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // Get transactions in Eastern date range (converted to UTC) - exclude voided
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .neq('status', 'voided')
        .gte('created_at', start)
        .lte('created_at', end);

      if (transactionsError) throw transactionsError;

      // Aggregate customer data
      const customerMap: Record<string, Customer> = {};

      (customersData || []).forEach(c => {
        customerMap[c.id] = {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          created_at: c.created_at,
          totalPurchases: 0,
          totalSpent: 0,
          lastVisit: null,
          preferredPayment: '',
        };
      });

      // Aggregate transaction data
      const paymentMethods: Record<string, string[]> = {};

      (transactionsData || []).forEach(t => {
        if (t.customer_id && customerMap[t.customer_id]) {
          const customer = customerMap[t.customer_id];
          customer.totalPurchases += 1;
          customer.totalSpent += Math.abs(Number(t.total_amount));
          customer.lastVisit = new Date(t.created_at) > new Date(customer.lastVisit || 0)
            ? t.created_at
            : customer.lastVisit;

          if (t.method) {
            if (!paymentMethods[t.customer_id]) paymentMethods[t.customer_id] = [];
            paymentMethods[t.customer_id].push(t.method);
          }
        }
      });

      // Calculate preferred payment method
      Object.keys(paymentMethods).forEach(customerId => {
        const methods = paymentMethods[customerId];
        const frequency: Record<string, number> = {};
        methods.forEach(m => {
          frequency[m] = (frequency[m] || 0) + 1;
        });
        const preferred = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
        if (preferred && customerMap[customerId]) {
          customerMap[customerId].preferredPayment = preferred[0];
        }
      });

      // Filter to only customers with activity in range
      const activeCustomers = Object.values(customerMap).filter(c => c.totalPurchases > 0);

      setCustomers(activeCustomers);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);

    return {
      totalCustomers,
      totalSpent,
      totalPurchases,
      avgCustomerValue: totalCustomers > 0 ? totalSpent / totalCustomers : 0,
      avgTransactionValue: totalPurchases > 0 ? totalSpent / totalPurchases : 0,
    };
  }, [customers]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers]);

  const handleExportCSV = () => {
    const data = [
      ['Customer Report', dateFrom, 'to', dateTo],
      [],
      ['Summary'],
      ['Total Customers', metrics.totalCustomers],
      ['Total Spent', `$${metrics.totalSpent.toFixed(2)}`],
      ['Total Purchases', metrics.totalPurchases],
      ['Avg Customer Value', `$${metrics.avgCustomerValue.toFixed(2)}`],
      [],
      ['Customers'],
      ['Customer Name', 'Email', 'Phone', 'Total Purchases', 'Total Spent', 'Last Visit', 'Preferred Payment'],
      ...sortedCustomers.map(c => [
        `${c.first_name} ${c.last_name}`,
        c.email,
        c.phone,
        c.totalPurchases,
        `$${c.totalSpent.toFixed(2)}`,
        c.lastVisit ? c.lastVisit.split('T')[0] : 'N/A',
        c.preferredPayment,
      ]),
    ];
    downloadCSV(data, `customer-report-${dateFrom}.csv`);
  };

  const handlePrint = () => {
    generatePDF({
      title: `Customer Report - ${dateFrom} to ${dateTo}`,
      sections: [
        {
          type: 'summary-cards',
          cards: [
            { label: 'Total Customers', value: metrics.totalCustomers.toString(), icon: '👥' },
            { label: 'Total Spent', value: `$${metrics.totalSpent.toFixed(2)}`, icon: '💰' },
            { label: 'Total Purchases', value: metrics.totalPurchases.toString(), icon: '🛍️' },
            { label: 'Avg Customer Value', value: `$${metrics.avgCustomerValue.toFixed(2)}`, icon: '📊' },
          ],
        },
        {
          type: 'table',
          title: 'Customers',
          headers: ['Name', 'Email', 'Purchases', 'Total Spent', 'Last Visit', 'Preferred'],
          rows: sortedCustomers.slice(0, 50).map(c => [
            `${c.first_name} ${c.last_name}`,
            c.email,
            c.totalPurchases.toString(),
            `$${c.totalSpent.toFixed(2)}`,
            c.lastVisit ? c.lastVisit.split('T')[0] : 'N/A',
            c.preferredPayment,
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
        <MetricCard label="Customers" value={metrics.totalCustomers.toString()} icon="👥" />
        <MetricCard label="Total Spent" value={`$${metrics.totalSpent.toFixed(2)}`} icon="💰" />
        <MetricCard label="Avg Customer Value" value={`$${metrics.avgCustomerValue.toFixed(2)}`} icon="📊" />
        <MetricCard label="Total Purchases" value={metrics.totalPurchases.toString()} icon="🛍️" />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Customers ({sortedCustomers.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Name</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Email</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Phone</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Purchases</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Total Spent</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Last Visit</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Preferred</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 text-xs">
                    No customers found for the selected period
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer, idx) => (
                  <tr key={customer.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-bold text-zinc-900">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td className="py-2 px-3 text-zinc-600 text-[11px]">{customer.email}</td>
                    <td className="py-2 px-3 text-zinc-600 text-[11px]">{customer.phone}</td>
                    <td className="text-right py-2 px-3 text-zinc-700">{customer.totalPurchases}</td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">
                      ${customer.totalSpent.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-zinc-600">
                      {customer.lastVisit ? customer.lastVisit.split('T')[0] : '-'}
                    </td>
                    <td className="py-2 px-3 text-zinc-600">{customer.preferredPayment}</td>
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
