import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useSettings } from '../context/SettingsContext';
import { downloadCSV } from '../utils/reportExport';
import { RefreshCw, X, Eye, Printer, Download } from 'lucide-react';

interface AdjustmentRow {
  variant_id: string;
  barcode: string | null;
  product_name: string;
  color: string | null;
  size: string | null;
  system_qty: number;
  counted_qty: number;
  diff: number;
  status: 'match' | 'discrepancy' | 'new';
}

interface InventoryCountRecord {
  id: string;
  count_date: string;
  counted_by: string | null;
  total_variants_counted: number;
  total_discrepancies: number;
  adjustments: AdjustmentRow[] | null;
  created_at: string;
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// count_date is stored as a plain YYYY-MM-DD date (no time component), so this formats it
// directly rather than going through Date parsing - avoids the host machine's timezone
// shifting the displayed calendar day.
const formatDateDisplay = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
};

const diffLabel = (row: AdjustmentRow) => {
  if (row.status === 'match') return { text: 'MATCH', color: '#15803d' };
  if (row.status === 'new') return { text: `${row.diff > 0 ? '+' : ''}${row.diff} NEW`, color: '#b45309' };
  return { text: `${row.diff > 0 ? '+' : ''}${row.diff}`, color: row.diff > 0 ? '#15803d' : '#b91c1c' };
};

export const InventoryCountsAdmin: React.FC = () => {
  const { logo, storeInfo } = useSettings();
  const [records, setRecords] = useState<InventoryCountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<InventoryCountRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('inventory_counts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      setError(
        err?.message?.includes('relation "inventory_counts" does not exist')
          ? 'Table "inventory_counts" not found. Run docs/inventory-count-migration.sql in Supabase first.'
          : (err?.message || 'Failed to load inventory counts')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const generateReportHTML = (r: InventoryCountRecord) => {
    const rows = r.adjustments || [];
    const rowsHtml = rows.map(row => {
      const label = diffLabel(row);
      return `
        <tr>
          <td>${escapeHtml(row.product_name)}</td>
          <td>${escapeHtml(row.size || '-')}</td>
          <td>${escapeHtml(row.color || '-')}</td>
          <td>${escapeHtml(row.barcode || '-')}</td>
          <td style="text-align:center;">${row.system_qty}</td>
          <td style="text-align:center;">${row.counted_qty}</td>
          <td style="text-align:right;"><span style="color:${label.color};font-weight:700;">${label.text}</span></td>
        </tr>`;
    }).join('');

    const matched = rows.filter(x => x.status === 'match').length;
    const newCount = rows.filter(x => x.status === 'new').length;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Inventory Count Report - ${r.count_date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 900px; margin: 0 auto; }
  @page { size: auto; margin: 12mm; }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { max-height: 60px; margin-bottom: 8px; }
  .store-name { font-size: 18px; font-weight: 700; }
  .store-info { font-size: 11px; color: #555; margin-top: 4px; }
  .title { font-size: 16px; font-weight: 700; text-align: center; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .meta { text-align: center; font-size: 12px; color: #555; margin-bottom: 4px; }
  .banner { text-align: center; font-size: 13px; font-weight: 700; margin: 16px 0; padding: 8px; background: #fef2f2; color: #b91c1c; border-radius: 6px; }
  .banner.clean { background: #f0fdf4; color: #15803d; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { text-align: left; padding: 6px 8px; background: #f4f4f5; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .summary-table td { padding: 6px 8px; }
  .summary-table .label { color: #333; }
  .summary-table .value { text-align: right; font-weight: 700; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  .footer { text-align: center; font-size: 10px; color: #888; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    ${logo ? `<img src="${logo}" class="logo" alt="Logo">` : ''}
    <div class="store-name">${escapeHtml(storeInfo.name || 'Absolute Soccer Mississauga')}</div>
    <div class="store-info">${escapeHtml(storeInfo.address || '')} &nbsp;|&nbsp; ${escapeHtml(storeInfo.phone || '')}</div>
  </div>

  <div class="title">Inventory Count Report</div>
  <div class="meta">Date: ${formatDateDisplay(r.count_date)}</div>
  <div class="meta">Counted by: ${escapeHtml(r.counted_by || 'Staff')}</div>

  <div class="banner ${r.total_discrepancies === 0 ? 'clean' : ''}">
    ${r.total_discrepancies === 0 ? 'NO DISCREPANCIES - ALL COUNTS MATCHED' : `DISCREPANCIES FOUND: ${r.total_discrepancies} item${r.total_discrepancies === 1 ? '' : 's'}`}
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th><th>Sz</th><th>Color</th><th>Barcode</th>
        <th style="text-align:center;">Sys</th><th style="text-align:center;">Count</th><th style="text-align:right;">Diff</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center; color:#888;">No item-level detail saved for this count</td></tr>'}</tbody>
  </table>

  <div class="section-title">Summary</div>
  <table class="summary-table">
    <tr><td class="label">Total variants counted</td><td class="value">${r.total_variants_counted}</td></tr>
    <tr><td class="label">Matched</td><td class="value">${matched}</td></tr>
    <tr><td class="label">Discrepancies</td><td class="value">${r.total_discrepancies}</td></tr>
    <tr><td class="label">New items added</td><td class="value">${newCount}</td></tr>
  </table>

  <div class="section-title">Adjustments</div>
  <table class="summary-table">
    <tr><td class="label">Adjustments applied</td><td class="value">Yes</td></tr>
    <tr><td class="label">Saved at</td><td class="value">${new Date(r.created_at).toLocaleString('en-US')}</td></tr>
  </table>

  <div class="footer">Generated ${new Date().toLocaleString('en-US')} &middot; ${escapeHtml(storeInfo.name || 'Absolute Soccer Mississauga')}</div>
</body>
</html>`;
  };

  const printReport = (r: InventoryCountRecord) => {
    const html = generateReportHTML(r);
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
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    };
  };

  const exportCSV = (r: InventoryCountRecord) => {
    const rows = r.adjustments || [];
    const data: (string | number)[][] = [
      ['Date', 'Product', 'Size', 'Color', 'Barcode', 'System Qty', 'Physical Count', 'Difference', 'Status'],
      ...rows.map(row => [
        r.count_date,
        row.product_name,
        row.size || '',
        row.color || '',
        row.barcode || '',
        row.system_qty,
        row.counted_qty,
        row.diff,
        row.status === 'new' ? 'New' : row.status === 'match' ? 'Match' : 'Discrepancy',
      ]),
    ];
    downloadCSV(data, `inventory-count-${r.count_date}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Inventory Count History</h3>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm font-bold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Date</th>
                <th className="text-left py-2 px-3 font-bold text-zinc-600">Counted By</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Total Items</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Discrepancies</th>
                <th className="text-right py-2 px-3 font-bold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-400">No inventory counts recorded yet</td></tr>
              )}
              {records.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? 'bg-zinc-50' : ''}>
                  <td className="py-2 px-3 font-bold text-zinc-900">{formatDateDisplay(r.count_date)}</td>
                  <td className="py-2 px-3 text-zinc-700">{r.counted_by || '-'}</td>
                  <td className="text-right py-2 px-3 text-zinc-700">{r.total_variants_counted}</td>
                  <td className={`text-right py-2 px-3 font-bold ${r.total_discrepancies > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {r.total_discrepancies}
                  </td>
                  <td className="text-right py-2 px-3">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setViewing(r)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1">
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => printReport(r)} className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1">
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-white border-b border-zinc-200 px-6 py-4 z-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Inventory Count — {formatDateDisplay(viewing.count_date)}</h3>
                <p className="text-xs text-zinc-500">
                  Counted by {viewing.counted_by || 'Staff'} &middot; {new Date(viewing.created_at).toLocaleString('en-US')}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="p-2 hover:bg-zinc-100 rounded transition-colors"
                title="Close"
              >
                <X size={20} className="text-zinc-600 hover:text-zinc-900" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-zinc-400 font-bold">Total Counted</div>
                  <div className="text-xl font-black text-zinc-900">{viewing.total_variants_counted}</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-zinc-400 font-bold">Matched</div>
                  <div className="text-xl font-black text-emerald-700">
                    {(viewing.adjustments || []).filter(r => r.status === 'match').length}
                  </div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-zinc-400 font-bold">Discrepancies</div>
                  <div className="text-xl font-black text-red-600">{viewing.total_discrepancies}</div>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-bold text-zinc-600">Product</th>
                      <th className="text-left py-2 px-3 font-bold text-zinc-600">Size / Color</th>
                      <th className="text-left py-2 px-3 font-bold text-zinc-600">Barcode</th>
                      <th className="text-right py-2 px-3 font-bold text-zinc-600">Sys</th>
                      <th className="text-right py-2 px-3 font-bold text-zinc-600">Count</th>
                      <th className="text-right py-2 px-3 font-bold text-zinc-600">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(viewing.adjustments || []).map((row, i) => {
                      const label = diffLabel(row);
                      return (
                        <tr key={i} className={row.status !== 'match' ? 'bg-red-50/40' : ''}>
                          <td className="py-2 px-3 font-bold text-zinc-900">{row.product_name}</td>
                          <td className="py-2 px-3 text-zinc-600">{[row.size, row.color].filter(Boolean).join(' · ') || '-'}</td>
                          <td className="py-2 px-3 text-zinc-500">{row.barcode || '-'}</td>
                          <td className="py-2 px-3 text-right text-zinc-700">{row.system_qty}</td>
                          <td className="py-2 px-3 text-right text-zinc-700">{row.counted_qty}</td>
                          <td className="py-2 px-3 text-right font-bold" style={{ color: label.color }}>{label.text}</td>
                        </tr>
                      );
                    })}
                    {(!viewing.adjustments || viewing.adjustments.length === 0) && (
                      <tr><td colSpan={6} className="text-center py-6 text-zinc-400">No item-level detail saved for this count</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
              <button
                onClick={() => exportCSV(viewing)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => printReport(viewing)}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded font-bold hover:bg-zinc-800 transition-colors"
              >
                Print
              </button>
              <button
                onClick={() => setViewing(null)}
                className="px-4 py-2 bg-zinc-200 text-zinc-900 rounded font-bold hover:bg-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
