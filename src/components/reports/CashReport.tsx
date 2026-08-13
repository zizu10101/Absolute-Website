import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabase';
import { RefreshCw, X, Copy, Save } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { getEasternDayRange, getTodayEastern } from '../../utils/timezoneUtils';
import { downloadCSV } from '../../utils/reportExport';

interface CashReportProps {
  logo?: string;
}

interface Denomination {
  value: number;
  label: string;
}

const DENOMINATIONS: Denomination[] = [
  { value: 0.05, label: '$0.05' },
  { value: 0.10, label: '$0.10' },
  { value: 0.25, label: '$0.25' },
  { value: 1.00, label: '$1.00' },
  { value: 2.00, label: '$2.00' },
  { value: 5.00, label: '$5.00' },
  { value: 10.00, label: '$10.00' },
  { value: 20.00, label: '$20.00' },
  { value: 50.00, label: '$50.00' },
  { value: 100.00, label: '$100.00' },
];

type DenomCounts = Record<string, number>;

const emptyCounts = (): DenomCounts =>
  DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.value]: 0 }), {} as DenomCounts);

interface Transaction {
  id: string;
  total_amount: number;
  method: string;
  status: string;
  payment_splits?: Array<{ method: string; amount: number }>;
}

interface PaymentRow {
  method: string;
  amount: number;
}

// Payment method names as they actually appear in `transactions.method` / `payment_splits[].method`
// (see POSPage.tsx payment method lists) mapped to the fixed cash_reports columns.
const KNOWN_METHOD_COLUMNS: Record<string, 'pos_cash' | 'pos_debit' | 'pos_visa' | 'pos_mc' | 'pos_amex' | 'pos_cheque'> = {
  Cash: 'pos_cash',
  Debit: 'pos_debit',
  Visa: 'pos_visa',
  Mastercard: 'pos_mc',
  MC: 'pos_mc',
  Amex: 'pos_amex',
  Cheque: 'pos_cheque',
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// report_date is stored as a plain YYYY-MM-DD date (no time component), so this formats it
// directly rather than going through Date parsing - avoids the host machine's timezone
// shifting the displayed calendar day.
const formatDateDisplay = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
};

export const CashReport: React.FC<CashReportProps> = ({ logo: logoFromProps }) => {
  const { logo: logoFromSettings, storeInfo } = useSettings();
  const logo = logoFromProps || logoFromSettings;

  const [selectedDate, setSelectedDate] = useState<string>(getTodayEastern());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);

  const [openingCounts, setOpeningCounts] = useState<DenomCounts>(emptyCounts());
  const [closingCounts, setClosingCounts] = useState<DenomCounts>(emptyCounts());
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentRow[]>([]);
  const [actualCash, setActualCash] = useState<string>('');
  const [deposit, setDeposit] = useState<string>('');
  const [other, setOther] = useState<number>(0);
  // Sum of today's transactions.method === 'Other' - used to auto-fill `other` below, but only
  // for a date that hasn't been saved yet (existingReportChecked gates the race between this
  // and fetchExistingReport so a saved/edited `other` value is never clobbered on reload).
  const [autoOtherFromPOS, setAutoOtherFromPOS] = useState<number>(0);
  const [existingReportChecked, setExistingReportChecked] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [recentReports, setRecentReports] = useState<any[]>([]);

  const [showPreview, setShowPreview] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');

  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getEasternDayRange(selectedDate);
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total_amount, method, status, payment_splits')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('status', 'completed');

      if (error) throw error;

      const breakdown: Record<string, number> = {};
      (data || []).forEach((t: Transaction) => {
        if (t.payment_splits && Array.isArray(t.payment_splits) && t.payment_splits.length > 0) {
          t.payment_splits.forEach(split => {
            const method = split.method || 'Other';
            breakdown[method] = (breakdown[method] || 0) + Math.abs(Number(split.amount || 0));
          });
        } else {
          const method = t.method || 'Other';
          breakdown[method] = (breakdown[method] || 0) + Math.abs(Number(t.total_amount || 0));
        }
      });

      // 'Other' gets pulled out of the generic per-method breakdown - it has its own
      // dedicated line below (auto-filled here, but editable/savable independently), so
      // leaving it in `paymentBreakdown` too would show it twice and double-count the total.
      const otherFromPOS = breakdown['Other'] || 0;
      delete breakdown['Other'];

      setPaymentBreakdown(
        Object.entries(breakdown)
          .filter(([, amount]) => amount > 0)
          .map(([method, amount]) => ({ method, amount }))
          .sort((a, b) => b.amount - a.amount)
      );
      setAutoOtherFromPOS(otherFromPOS);
    } catch (err) {
      console.error('Error fetching sales for cash report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  const fetchExistingReport = useCallback(async () => {
    setExistingReportChecked(false);
    try {
      const { data, error } = await supabase
        .from('cash_reports')
        .select('*')
        .eq('report_date', selectedDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingReportId(data.id);
        setOpeningCounts({ ...emptyCounts(), ...(data.opening_counts || {}) });
        setClosingCounts({ ...emptyCounts(), ...(data.closing_counts || {}) });
        setActualCash(data.actual_cash != null ? String(data.actual_cash) : '');
        setDeposit(data.deposit != null ? String(data.deposit) : '');
        setOther(Number(data.other) || 0);
        setNotes(data.notes || '');
      } else {
        setExistingReportId(null);
        setOpeningCounts(emptyCounts());
        setClosingCounts(emptyCounts());
        setActualCash('');
        setDeposit('');
        setOther(0);
        setNotes('');
      }
    } catch (err) {
      console.error('Error fetching existing cash report:', err);
    } finally {
      setExistingReportChecked(true);
    }
  }, [selectedDate]);

  const fetchRecentReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cash_reports')
        .select('id, report_date, opening_total, closing_total, actual_cash, over_short')
        .order('report_date', { ascending: false })
        .limit(14);

      if (error) throw error;
      setRecentReports(data || []);
    } catch (err) {
      console.error('Error fetching recent cash reports:', err);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    fetchExistingReport();
  }, [fetchSales, fetchExistingReport]);

  useEffect(() => {
    fetchRecentReports();
  }, [fetchRecentReports]);

  // Auto-fill Other from today's 'Other'-method POS transactions, but only when this date
  // has no saved report yet - once a report exists, its saved (possibly staff-edited) value
  // takes precedence and this effect stays out of the way.
  useEffect(() => {
    if (existingReportChecked && !existingReportId) {
      setOther(autoOtherFromPOS);
    }
  }, [autoOtherFromPOS, existingReportChecked, existingReportId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPreview(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openingTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d.value * (Number(openingCounts[d.value]) || 0), 0),
    [openingCounts]
  );
  const closingTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d.value * (Number(closingCounts[d.value]) || 0), 0),
    [closingCounts]
  );
  const posTotal = useMemo(() => paymentBreakdown.reduce((s, p) => s + p.amount, 0), [paymentBreakdown]);
  // Total Sales = POS Sales + Other. Deliberately kept separate from posTotal (which stays
  // pure auto-POS) and from the Over/Short calc below, which only ever uses posCashSales -
  // Other is a manual, non-cash entry and must not affect the cash reconciliation.
  const totalSalesWithOther = posTotal + other;
  const posCashSales = useMemo(
    () => paymentBreakdown.find(p => p.method === 'Cash')?.amount || 0,
    [paymentBreakdown]
  );

  const expectedCash = openingTotal + posCashSales;
  const hasActualCash = actualCash !== '';
  const actualCashNum = Number(actualCash) || 0;
  const overShort = hasActualCash ? actualCashNum - expectedCash : 0;
  const netCashChange = closingTotal - openingTotal;

  const handleOpeningChange = (denom: number, value: string) => {
    const n = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setOpeningCounts(prev => ({ ...prev, [denom]: n }));
  };
  const handleClosingChange = (denom: number, value: string) => {
    const n = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setClosingCounts(prev => ({ ...prev, [denom]: n }));
  };

  const generateCashReportHTML = () => {
    const dateObj = new Date(`${selectedDate}T12:00:00`);
    const dateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const denomRows = DENOMINATIONS.map(d => {
      const openCount = Number(openingCounts[d.value]) || 0;
      const closeCount = Number(closingCounts[d.value]) || 0;
      return `
        <tr>
          <td>${d.label}</td>
          <td style="text-align:center;">${openCount}</td>
          <td style="text-align:right;">$${(openCount * d.value).toFixed(2)}</td>
          <td style="text-align:center;">${closeCount}</td>
          <td style="text-align:right;">$${(closeCount * d.value).toFixed(2)}</td>
        </tr>`;
    }).join('');

    const paymentRows = paymentBreakdown.map(p => `
        <tr>
          <td>${escapeHtml(p.method)} (auto)</td>
          <td style="text-align:right;">$${p.amount.toFixed(2)}</td>
        </tr>`).join('');
    const otherRow = `
        <tr>
          <td>Other (auto-fill, editable)</td>
          <td style="text-align:right;">$${other.toFixed(2)}</td>
        </tr>`;

    const overShortLabel = !hasActualCash
      ? 'Not yet counted'
      : Math.abs(overShort) < 0.005
        ? '$0.00 (Balanced)'
        : `${overShort > 0 ? '+' : '-'}$${Math.abs(overShort).toFixed(2)} (${overShort > 0 ? 'Over' : 'Short'})`;
    const overShortColor = !hasActualCash ? '#6b7280' : Math.abs(overShort) < 0.005 ? '#15803d' : '#b91c1c';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cash Report - ${selectedDate}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  @page { size: auto; margin: 12mm; }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { max-height: 60px; margin-bottom: 8px; }
  .store-name { font-size: 18px; font-weight: 700; }
  .store-info { font-size: 11px; color: #555; margin-top: 4px; }
  .title { font-size: 16px; font-weight: 700; text-align: center; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .date { text-align: center; font-size: 12px; color: #555; margin-bottom: 16px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 6px 8px; background: #f4f4f5; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .calc-table td { padding: 6px 8px; }
  .calc-table .label { color: #333; }
  .calc-table .value { text-align: right; font-weight: 700; }
  .over-short-row td { font-size: 14px; font-weight: 700; border-top: 2px solid #111; padding-top: 10px; }
  .notes-box { border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 12px; min-height: 40px; white-space: pre-wrap; }
  .footer { text-align: center; font-size: 10px; color: #888; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    ${logo ? `<img src="${logo}" class="logo" alt="Logo">` : ''}
    <div class="store-name">${escapeHtml(storeInfo.name || 'Absolute Soccer Mississauga')}</div>
    <div class="store-info">${escapeHtml(storeInfo.address || '')} &nbsp;|&nbsp; ${escapeHtml(storeInfo.phone || '')}</div>
  </div>

  <div class="title">End of Day Cash Report</div>
  <div class="date">${dateStr}</div>

  <div class="section-title">Cash Denomination Count</div>
  <table>
    <thead>
      <tr>
        <th>Denomination</th>
        <th style="text-align:center;">Opening Count</th>
        <th style="text-align:right;">Opening Total</th>
        <th style="text-align:center;">Closing Count</th>
        <th style="text-align:right;">Closing Total</th>
      </tr>
    </thead>
    <tbody>
      ${denomRows}
      <tr class="total-row">
        <td>TOTAL</td>
        <td></td>
        <td style="text-align:right;">$${openingTotal.toFixed(2)}</td>
        <td></td>
        <td style="text-align:right;">$${closingTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Sales Breakdown</div>
  <table>
    <thead><tr><th>Payment Method</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>
      ${paymentRows || '<tr><td colspan="2" style="text-align:center; color:#888;">No completed sales for this date</td></tr>'}
      ${otherRow}
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right;">$${totalSalesWithOther.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Cash Reconciliation</div>
  <table class="calc-table">
    <tr><td class="label">POS Cash Sales</td><td class="value">$${posCashSales.toFixed(2)}</td></tr>
    <tr><td class="label">Opening Cash (from denomination count)</td><td class="value">$${openingTotal.toFixed(2)}</td></tr>
    <tr><td class="label">Expected Cash (Opening + POS Cash)</td><td class="value">$${expectedCash.toFixed(2)}</td></tr>
    <tr><td class="label">Actual Cash Count (manual)</td><td class="value">${hasActualCash ? `$${actualCashNum.toFixed(2)}` : 'Not counted'}</td></tr>
    <tr class="over-short-row"><td style="color:${overShortColor};">OVER / SHORT</td><td class="value" style="color:${overShortColor}; text-align:right;">${overShortLabel}</td></tr>
  </table>

  <div class="section-title">Deposit</div>
  <table class="calc-table">
    <tr><td class="label">Deposit Amount</td><td class="value">${deposit !== '' ? `$${Number(deposit).toFixed(2)}` : '-'}</td></tr>
  </table>

  <div class="section-title">Notes / Description</div>
  <div class="notes-box">${escapeHtml(notes) || '-'}</div>

  <div class="footer">Generated ${new Date().toLocaleString('en-US')} &middot; Absolute Soccer Mississauga</div>
</body>
</html>`;
  };

  const printCashReport = (html: string) => {
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
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();

    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  const handlePreview = () => {
    setPreviewHTML(generateCashReportHTML());
    setShowPreview(true);
  };

  const handleExportCSV = () => {
    const data: (string | number)[][] = [
      ['End of Day Cash Report', selectedDate],
      [],
      ['Denomination', 'Opening Count', 'Opening Total', 'Closing Count', 'Closing Total'],
      ...DENOMINATIONS.map(d => [
        d.label,
        Number(openingCounts[d.value]) || 0,
        `$${((Number(openingCounts[d.value]) || 0) * d.value).toFixed(2)}`,
        Number(closingCounts[d.value]) || 0,
        `$${((Number(closingCounts[d.value]) || 0) * d.value).toFixed(2)}`,
      ]),
      ['TOTAL', '', `$${openingTotal.toFixed(2)}`, '', `$${closingTotal.toFixed(2)}`],
      [],
      ['Sales Breakdown'],
      ['Payment Method', 'Amount'],
      ...paymentBreakdown.map(p => [`${p.method} (auto)`, `$${p.amount.toFixed(2)}`]),
      ['Other (auto-fill, editable)', `$${other.toFixed(2)}`],
      ['TOTAL', `$${totalSalesWithOther.toFixed(2)}`],
      [],
      ['Cash Reconciliation'],
      ['POS Cash Sales', `$${posCashSales.toFixed(2)}`],
      ['Opening Cash', `$${openingTotal.toFixed(2)}`],
      ['Expected Cash', `$${expectedCash.toFixed(2)}`],
      ['Actual Cash Count', hasActualCash ? `$${actualCashNum.toFixed(2)}` : 'Not counted'],
      ['Over/Short', hasActualCash ? `$${overShort.toFixed(2)}` : ''],
      [],
      ['Deposit Amount', deposit !== '' ? `$${Number(deposit).toFixed(2)}` : ''],
      [],
      ['Notes', notes],
    ];

    downloadCSV(data, `cash-report-${selectedDate}.csv`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const getMethodAmount = (names: string[]) =>
        paymentBreakdown.filter(p => names.includes(p.method)).reduce((s, p) => s + p.amount, 0);

      const posCash = getMethodAmount(['Cash']);
      const posDebit = getMethodAmount(['Debit']);
      const posVisa = getMethodAmount(['Visa']);
      const posMc = getMethodAmount(['Mastercard', 'MC']);
      const posAmex = getMethodAmount(['Amex']);
      const posCheque = getMethodAmount(['Cheque']);
      const knownMethods = Object.keys(KNOWN_METHOD_COLUMNS);
      const posOther = paymentBreakdown
        .filter(p => !knownMethods.includes(p.method))
        .reduce((s, p) => s + p.amount, 0);

      const payload = {
        report_date: selectedDate,
        opening_counts: openingCounts,
        closing_counts: closingCounts,
        opening_total: Number(openingTotal.toFixed(2)),
        closing_total: Number(closingTotal.toFixed(2)),
        pos_cash: Number(posCash.toFixed(2)),
        pos_debit: Number(posDebit.toFixed(2)),
        pos_visa: Number(posVisa.toFixed(2)),
        pos_mc: Number(posMc.toFixed(2)),
        pos_amex: Number(posAmex.toFixed(2)),
        pos_cheque: Number(posCheque.toFixed(2)),
        pos_other: Number(posOther.toFixed(2)),
        pos_total: Number(posTotal.toFixed(2)),
        pos_breakdown: paymentBreakdown,
        actual_cash: hasActualCash ? actualCashNum : null,
        expected_cash: Number(expectedCash.toFixed(2)),
        over_short: hasActualCash ? Number(overShort.toFixed(2)) : null,
        deposit: deposit !== '' ? Number(deposit) : null,
        other: Number(other.toFixed(2)),
        notes: notes || null,
      };

      if (existingReportId) {
        const { error } = await supabase.from('cash_reports').update(payload).eq('id', existingReportId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('cash_reports').insert(payload).select('id').single();
        if (error) throw error;
        setExistingReportId(data.id);
      }

      setSaveMessage({ type: 'success', text: 'Cash report saved.' });
      fetchRecentReports();
    } catch (err: any) {
      console.error('Error saving cash report:', err);
      setSaveMessage({ type: 'error', text: err?.message?.includes('relation "cash_reports" does not exist')
        ? 'Table "cash_reports" not found. Run docs/cash-report-migration.sql in Supabase first.'
        : 'Error saving cash report. See console for details.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 6000);
    }
  };

  const inputClass = 'w-16 px-2 py-1 border border-zinc-200 rounded text-sm text-right text-zinc-900';

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">Report Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => { fetchSales(); fetchExistingReport(); }}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
        {existingReportId && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
            Existing report loaded for this date - saving will update it
          </span>
        )}
      </div>

      {/* Cash Denomination Counter */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
          Cash Denomination Count
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Denomination</th>
                <th className="text-center py-2 px-3 font-bold text-zinc-600">Opening Count</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Opening Total</th>
                <th className="text-center py-2 px-3 font-bold text-zinc-600">Closing Count</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Closing Total</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINATIONS.map((d, idx) => {
                const openCount = Number(openingCounts[d.value]) || 0;
                const closeCount = Number(closingCounts[d.value]) || 0;
                return (
                  <tr key={d.value} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-bold text-zinc-900">{d.label}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={openingCounts[d.value] || ''}
                        onChange={e => handleOpeningChange(d.value, e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">${(openCount * d.value).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={closingCounts[d.value] || ''}
                        onChange={e => handleClosingChange(d.value, e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </td>
                    <td className="text-right py-2 px-3 font-bold text-zinc-900">${(closeCount * d.value).toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                <td className="py-2 px-3 text-zinc-900">TOTAL</td>
                <td></td>
                <td className="text-right py-2 px-3 text-zinc-900">${openingTotal.toFixed(2)}</td>
                <td></td>
                <td className="text-right py-2 px-3 text-zinc-900">${closingTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Breakdown (auto) */}
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">
            Sales Breakdown
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 rounded-full px-2 py-1">
            Auto from POS
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Payment Method</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentBreakdown.length === 0 && (
                <tr><td colSpan={2} className="text-center py-4 text-zinc-400">No completed sales for this date</td></tr>
              )}
              {paymentBreakdown.map((p, idx) => (
                <tr key={p.method} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{p.method} <span className="font-normal text-zinc-400 text-xs">(auto)</span></td>
                  <td className="text-right py-2 px-3 font-bold text-zinc-900">${p.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className={paymentBreakdown.length % 2 === 0 ? 'bg-zinc-50' : ''}>
                <td className="py-2 px-3 font-bold text-zinc-900">Other <span className="font-normal text-zinc-400 text-xs">(auto-fill, editable)</span></td>
                <td className="text-right py-2 px-3 font-bold text-zinc-900">${other.toFixed(2)}</td>
              </tr>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                <td className="py-2 px-3 text-zinc-900">TOTAL</td>
                <td className="text-right py-2 px-3 text-zinc-900">${totalSalesWithOther.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actual Cash + Reconciliation */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-zinc-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
            Actual Cash Count
          </h3>
          <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">
            Actual Cash in Drawer
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900"
              />
            </div>
            <button
              onClick={() => setActualCash(closingTotal.toFixed(2))}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 whitespace-nowrap"
              title="Copy the Closing Count total from the denomination table above"
            >
              <Copy size={12} />
              From Closing Count
            </button>
          </div>

          <label className="block text-[10px] font-black uppercase text-zinc-500 mt-4 mb-2">
            Deposit Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900"
            />
          </div>

          <div className="mt-3">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Other
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={other}
              onChange={(e) => setOther(parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm mt-1 border-zinc-200 text-zinc-900"
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Auto-filled from today's "Other" payment method sales in POS - editable if needed.
            </p>
          </div>

          <label className="block text-[10px] font-black uppercase text-zinc-500 mt-4 mb-2">
            Notes / Description
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about today's count, discrepancies, deposit, etc."
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900"
          />
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
            Cash Reconciliation
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">POS Cash Sales</span>
              <span className="font-bold text-zinc-900">${posCashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Opening Cash</span>
              <span className="font-bold text-zinc-900">${openingTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2">
              <span className="text-zinc-600">Expected Cash (Opening + POS Cash)</span>
              <span className="font-bold text-zinc-900">${expectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Actual Cash Count</span>
              <span className="font-bold text-zinc-900">{hasActualCash ? `$${actualCashNum.toFixed(2)}` : '-'}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400 pt-1">
              <span>Net Cash Change (Closing - Opening)</span>
              <span>${netCashChange.toFixed(2)}</span>
            </div>
          </div>

          <div
            className={`mt-4 rounded-lg border p-4 text-center ${
              !hasActualCash
                ? 'bg-zinc-50 border-zinc-200'
                : Math.abs(overShort) < 0.005
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Over / Short</p>
            <p
              className={`text-2xl font-black ${
                !hasActualCash
                  ? 'text-zinc-400'
                  : Math.abs(overShort) < 0.005
                    ? 'text-emerald-700'
                    : 'text-red-700'
              }`}
            >
              {!hasActualCash
                ? 'Enter actual cash count'
                : `${overShort > 0 ? '+' : overShort < 0 ? '-' : ''}$${Math.abs(overShort).toFixed(2)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={handlePreview}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
        >
          Print Report
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--primary-color)] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : existingReportId ? 'Update Report' : 'Save Report'}
        </button>
        {saveMessage && (
          <span className={`text-xs font-bold ${saveMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
            {saveMessage.text}
          </span>
        )}
      </div>

      {/* Recent Saved Reports */}
      {recentReports.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">
            Recent Cash Reports
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 px-3 font-bold text-zinc-600">Date</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-600">Opening</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-600">Closing</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-600">Actual Cash</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-600">Over/Short</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                    <td className="py-2 px-3 font-bold text-zinc-900">{formatDateDisplay(r.report_date)}</td>
                    <td className="text-right py-2 px-3 text-zinc-700">${Number(r.opening_total || 0).toFixed(2)}</td>
                    <td className="text-right py-2 px-3 text-zinc-700">${Number(r.closing_total || 0).toFixed(2)}</td>
                    <td className="text-right py-2 px-3 text-zinc-700">{r.actual_cash != null ? `$${Number(r.actual_cash).toFixed(2)}` : '-'}</td>
                    <td className={`text-right py-2 px-3 font-bold ${
                      r.over_short == null ? 'text-zinc-400' : Math.abs(Number(r.over_short)) < 0.005 ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {r.over_short != null ? `$${Number(r.over_short).toFixed(2)}` : '-'}
                    </td>
                    <td className="text-right py-2 px-3">
                      <button
                        onClick={() => setSelectedDate(r.report_date)}
                        className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-white border-b border-zinc-200 px-6 py-4 z-10">
              <h3 className="text-lg font-bold text-zinc-900">Cash Report Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-zinc-100 rounded transition-colors"
                title="Close (ESC)"
              >
                <X size={20} className="text-zinc-600 hover:text-zinc-900" />
              </button>
            </div>

            <div className="p-4">
              <iframe
                srcDoc={previewHTML}
                style={{ width: '100%', height: '600px', border: '1px solid #e4e4e7', borderRadius: '0.5rem' }}
                title="Cash Report Preview"
              />
            </div>

            <div className="flex gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
              <button
                onClick={() => {
                  printCashReport(previewHTML);
                  setShowPreview(false);
                }}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded font-bold hover:bg-zinc-800 transition-colors"
              >
                Print
              </button>
              <button
                onClick={() => setShowPreview(false)}
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
