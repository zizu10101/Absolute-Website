import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabase';
import { useClub } from '../../hooks/useClub';
import { ClubPortalLayout } from '../../components/portal/ClubPortalLayout';
import { ClubItem, MatrixRow, SponsorEntry, PrintAddon } from '../../types/clubPortal';
import { generateOrderNumber } from '../../utils/clubOrderNumber';

const ALL_SIZES = [
  'XS','S','M','L','XL','XXL','2XL','3XL',
  '8K','9K','10K','11K','12K','13K',
  '1Y','2Y','3Y','4Y','5Y','6Y','7Y',
];

const HST_RATE = 0.13;

// ─── helpers ─────────────────────────────────────────────────────────────────

function getDiscountedBase(item: ClubItem): number {
  const base = Number(item.price || 0);
  const val = Number(item.discount_value || 0);
  if (val <= 0) return base;
  if (item.discount_type === '$') return Math.max(0, base - val);
  return Math.max(0, base * (1 - val / 100));
}

function getItemTotalPrice(item: ClubItem): number {
  const printCost = (item.print_addons || []).reduce((s, a) => s + Number(a.cost_per_unit || 0), 0);
  return getDiscountedBase(item) + printCost;
}

function getTotalQty(quantities: Record<string, Record<string, number>>, itemId: string): number {
  return Object.values(quantities[itemId] || {}).reduce((s, q) => s + (q || 0), 0);
}

function generateMatrix(
  items: ClubItem[],
  quantities: Record<string, Record<string, number>>,
  sponsors: SponsorEntry[],
): MatrixRow[] {
  const rows: MatrixRow[] = [];
  items.forEach(item => {
    const itemQty = quantities[item.id] || {};
    ALL_SIZES.forEach(size => {
      const qty = itemQty[size] || 0;
      for (let i = 0; i < qty; i++) {
        rows.push({
          id: `${item.id}_${size}_${i}`,
          itemId: item.id,
          itemName: item.name,
          size,
          playerName: '',
          playerNumber: '',
          initials: '',
          sponsorName: '',
          allowName: !item.name.toLowerCase().includes('bag'),
          allowNumber: true,
          allowInitials: true,
          allowSponsor: sponsors.length > 0,
        });
      }
    });
  });
  return rows;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ step: number; primaryColor: string }> = ({ step, primaryColor }) => {
  const steps = ['Quantities & Sponsors', 'Customize Roster', 'Review & Submit'];
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => {
        const num = i + 1;
        const active = num === step;
        const done = num < step;
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all"
                style={{
                  backgroundColor: done || active ? primaryColor : 'transparent',
                  borderColor: done || active ? primaryColor : '#d4d4d8',
                  color: done || active ? '#fff' : '#a1a1aa',
                }}
              >
                {done ? '✓' : num}
              </div>
              <span className={`text-[10px] font-bold mt-1 hidden sm:block ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: num < step ? primaryColor : '#e4e4e7' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Step 1 ──────────────────────────────────────────────────────────────────

const Step1: React.FC<{
  items: ClubItem[];
  quantities: Record<string, Record<string, number>>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  sponsors: SponsorEntry[];
  setSponsors: React.Dispatch<React.SetStateAction<SponsorEntry[]>>;
  primaryColor: string;
  preselectItemId?: string;
}> = ({ items, quantities, setQuantities, sponsors, setSponsors, primaryColor, preselectItemId }) => {

  const updateQty = (itemId: string, size: string, value: string) => {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    setQuantities(prev => ({ ...prev, [itemId]: { ...prev[itemId], [size]: qty } }));
  };

  const regularItems = items.filter(i => !i.is_suggested);
  const suggestedItems = items.filter(i => i.is_suggested && (i.id === preselectItemId || getTotalQty(quantities, i.id) > 0));

  const renderItem = (item: ClubItem, suggested = false) => {
    const unitPrice = getItemTotalPrice(item);
    const totalQty = getTotalQty(quantities, item.id);
    return (
      <div key={item.id} className="border border-zinc-200 rounded-xl p-4 mb-4 bg-white">
        <div className="flex gap-4">
          <div className="w-24 h-24 bg-[#f6f6f6] rounded-lg shrink-0 overflow-hidden">
            <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-zinc-900">{item.name}</h3>
              {suggested && (
                <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Optional Add-on</span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5 text-sm">
              {(item.discount_value || 0) > 0 ? (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Base price:</span>
                    <span className="line-through">${(Number(item.price) || 0).toFixed(2)}/unit</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>
                      {item.discount_type === '$'
                        ? `-$${(Number(item.discount_value) || 0).toFixed(2)}`
                        : `-${Number(item.discount_value)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-700">
                    <span>Discounted price:</span>
                    <span>${getDiscountedBase(item).toFixed(2)}/unit</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-zinc-600">
                  <span>Base price:</span>
                  <span>${(Number(item.price) || 0).toFixed(2)}/unit</span>
                </div>
              )}
              {(item.print_addons || []).map(a => (
                <div key={a.print_type_id} className="flex justify-between text-zinc-400 text-xs">
                  <span>+ {a.print_type_name}:</span>
                  <span>${(Number(a.cost_per_unit) || 0).toFixed(2)}/unit</span>
                </div>
              ))}
              {((item.discount_value || 0) > 0 || (item.print_addons || []).length > 0) && (
                <div className="flex justify-between font-bold border-t border-zinc-100 pt-1 text-zinc-900">
                  <span>Unit Total:</span>
                  <span>${unitPrice.toFixed(2)}/unit</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
              {(item.sizes_available || []).map(size => (
                <div key={size} className="text-center">
                  <label className="text-[10px] text-zinc-500 font-bold">{size}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quantities[item.id]?.[size] || ''}
                    onChange={e => updateQty(item.id, size, e.target.value)}
                    className="w-full border border-zinc-200 rounded text-center p-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              ))}
            </div>
            {totalQty > 0 && (
              <div className="mt-2 text-xs text-zinc-500">
                {totalQty} unit{totalQty !== 1 ? 's' : ''} · <span className="font-bold text-zinc-800">${(unitPrice * totalQty).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {regularItems.map(i => renderItem(i, false))}
      {suggestedItems.length > 0 && (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Optional Add-ons</p>
          {suggestedItems.map(i => renderItem(i, true))}
        </>
      )}

      {/* Sponsors */}
      <div className="mt-6 border-t border-zinc-200 pt-6">
        <h3 className="font-bold text-zinc-900 mb-1">Sponsor Logos</h3>
        <p className="text-sm text-zinc-500 mb-3">Add any sponsor logos to include on this order</p>
        {sponsors.map((s, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Sponsor name e.g. Apex Logistics"
              value={s.name}
              onChange={e => setSponsors(prev => prev.map((sp, idx) => idx === i ? { ...sp, name: e.target.value } : sp))}
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <button onClick={() => setSponsors(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-red-500 px-2">✕</button>
          </div>
        ))}
        <button
          onClick={() => setSponsors(prev => [...prev, { name: '' }])}
          className="text-sm font-bold text-blue-600 hover:text-blue-800"
        >
          + Add Sponsor
        </button>
      </div>
    </div>
  );
};

// ─── Step 2 ──────────────────────────────────────────────────────────────────

const Step2: React.FC<{
  matrix: MatrixRow[];
  setMatrix: React.Dispatch<React.SetStateAction<MatrixRow[]>>;
  sponsors: SponsorEntry[];
  primaryColor: string;
}> = ({ matrix, setMatrix, sponsors, primaryColor }) => {
  const [viewMode, setViewMode] = useState<'flat' | 'player'>('flat');

  const updateRow = (id: string, field: keyof MatrixRow, value: string) => {
    setMatrix(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const autoUppercase = () => setMatrix(prev => prev.map(r => ({ ...r, playerName: r.playerName.toUpperCase() })));

  const autoInitials = () => setMatrix(prev => prev.map(r => ({
    ...r,
    initials: r.playerName.trim()
      ? r.playerName.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('')
      : r.initials,
  })));

  const bulkApplySponsor = (name: string) => {
    if (!name) return;
    setMatrix(prev => prev.map(r => r.allowSponsor ? { ...r, sponsorName: name } : r));
  };

  const duplicateNumbers = matrix
    .filter(r => r.playerNumber)
    .reduce((acc, r) => {
      const key = `${r.itemId}_${r.playerNumber}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = (ev.target?.result as string).split('\n').slice(1);
      setMatrix(prev => {
        const updated = [...prev];
        lines.forEach((line, i) => {
          if (updated[i]) {
            const [name, number, initials] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (updated[i].allowName) updated[i] = { ...updated[i], playerName: name || '' };
            updated[i] = { ...updated[i], playerNumber: number || '', initials: initials || '' };
          }
        });
        return updated;
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderTable = (rows: MatrixRow[], showIndex = true) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {showIndex && <th className="py-2 px-2 text-left w-8">#</th>}
            <th className="py-2 px-2 text-left">Item</th>
            <th className="py-2 px-2 text-left">Size</th>
            <th className="py-2 px-2 text-left">Player Name</th>
            <th className="py-2 px-2 text-left">Number</th>
            <th className="py-2 px-2 text-left">Initials</th>
            {sponsors.length > 0 && <th className="py-2 px-2 text-left">Sponsor</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isDup = duplicateNumbers[`${row.itemId}_${row.playerNumber}`] > 1;
            return (
              <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                {showIndex && <td className="py-1.5 px-2 text-zinc-400">{idx + 1}</td>}
                <td className="py-1.5 px-2 text-zinc-600 max-w-[120px] truncate">{row.itemName}</td>
                <td className="py-1.5 px-2">
                  <span className="bg-zinc-100 text-zinc-700 text-[10px] font-bold px-2 py-0.5 rounded">{row.size}</span>
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="text"
                    value={row.playerName}
                    disabled={!row.allowName}
                    onChange={e => updateRow(row.id, 'playerName', e.target.value.toUpperCase())}
                    placeholder={row.allowName ? 'LASTNAME' : 'N/A'}
                    className={`w-full border rounded px-2 py-1 text-xs uppercase focus:outline-none focus:border-zinc-400 ${!row.allowName ? 'opacity-40 bg-zinc-50' : 'border-zinc-200'}`}
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="text"
                    value={row.playerNumber}
                    onChange={e => updateRow(row.id, 'playerNumber', e.target.value)}
                    className={`w-14 border rounded px-2 py-1 text-xs text-center focus:outline-none ${isDup && row.playerNumber ? 'border-red-500 bg-red-50 text-red-600' : 'border-zinc-200 focus:border-zinc-400'}`}
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="text"
                    value={row.initials}
                    onChange={e => updateRow(row.id, 'initials', e.target.value.toUpperCase())}
                    className="w-14 border border-zinc-200 rounded px-2 py-1 text-xs text-center uppercase focus:outline-none focus:border-zinc-400"
                  />
                </td>
                {sponsors.length > 0 && (
                  <td className="py-1.5 px-2">
                    <select
                      value={row.sponsorName}
                      onChange={e => updateRow(row.id, 'sponsorName', e.target.value)}
                      className="border border-zinc-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="">None</option>
                      {sponsors.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const hasDuplicates = Object.values(duplicateNumbers).some(v => v > 1);

  return (
    <div>
      {hasDuplicates && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">
          <AlertTriangle size={14} /> Duplicate player numbers detected — highlighted in red below.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setViewMode(v => v === 'flat' ? 'player' : 'flat')}
          className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
        >
          {viewMode === 'flat' ? 'By Player' : 'Flat List'}
        </button>
        <button onClick={autoUppercase} className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50">
          Auto UPPERCASE
        </button>
        <button onClick={autoInitials} className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50">
          Generate Initials
        </button>
        {sponsors.length > 0 && (
          <select
            onChange={e => bulkApplySponsor(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600"
            defaultValue=""
          >
            <option value="">Apply Sponsor to All...</option>
            {sponsors.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <label className="cursor-pointer border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-1">
          📥 Import CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
        </label>
      </div>

      <div className="text-xs text-zinc-400 mb-2 font-bold">{matrix.length} garment{matrix.length !== 1 ? 's' : ''}</div>

      {viewMode === 'flat' ? (
        renderTable(matrix)
      ) : (
        (() => {
          // Group by player index across items — player i gets one entry from each item
          const itemIds = [...new Set(matrix.map(r => r.itemId))];
          const playerCount = Math.max(...itemIds.map(id => matrix.filter(r => r.itemId === id).length), 0);
          const groups: MatrixRow[][] = [];
          for (let p = 0; p < playerCount; p++) {
            const playerRows = itemIds.flatMap(id => {
              const itemRows = matrix.filter(r => r.itemId === id);
              return itemRows[p] ? [itemRows[p]] : [];
            });
            if (playerRows.length) groups.push(playerRows);
          }
          return (
            <div className="space-y-4">
              {groups.map((group, gi) => (
                <div key={gi} className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Player {gi + 1}</span>
                    {group[0]?.playerName && <span className="ml-2 text-sm font-bold text-zinc-800">{group[0].playerName}</span>}
                  </div>
                  {renderTable(group, false)}
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
};

// ─── Step 3 ──────────────────────────────────────────────────────────────────

const Step3: React.FC<{
  items: ClubItem[];
  quantities: Record<string, Record<string, number>>;
  matrix: MatrixRow[];
  sponsors: SponsorEntry[];
  notes: string;
  setNotes: (v: string) => void;
  primaryColor: string;
  secondaryColor: string;
  orderNumber: string;
  clubName: string;
}> = ({ items, quantities, matrix, sponsors, notes, setNotes, primaryColor, secondaryColor, orderNumber, clubName }) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const selectedRow = matrix.find(r => r.id === selectedRowId) || matrix[0] || null;

  const subtotal = items.reduce((sum, item) => {
    const qty = getTotalQty(quantities, item.id);
    return sum + getItemTotalPrice(item) * qty;
  }, 0);
  const hst = subtotal * HST_RATE;
  const total = subtotal + hst;

  const namesAssigned = matrix.filter(r => r.playerName.trim()).length;
  const numbersAssigned = matrix.filter(r => r.playerNumber.trim()).length;

  const exportCSV = () => {
    const headers = ['Club', 'Order#', 'Item', 'Size', 'Player Name', 'Number', 'Initials', 'Sponsor', 'Print Types', 'Unit Cost'];
    const rows = matrix.map(row => {
      const item = items.find(i => i.id === row.itemId);
      const prints = (item?.print_addons || []).map(a => a.print_type_name).join('+');
      const unitCost = item ? getItemTotalPrice(item).toFixed(2) : '0.00';
      return [clubName, orderNumber, row.itemName, row.size, row.playerName, row.playerNumber, row.initials, row.sponsorName, prints, unitCost];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clubName}_${orderNumber}_Production.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printProof = () => {
    const itemsHtml = items
      .filter(item => getTotalQty(quantities, item.id) > 0)
      .map(item => {
        const qty = getTotalQty(quantities, item.id);
        const unitPrice = getItemTotalPrice(item);
        const rawBase = Number(item.price || 0);
        const discountVal = Number(item.discount_value || 0);
        const discBase = getDiscountedBase(item);
        const discLabel = discountVal > 0
          ? (item.discount_type === '$' ? `-$${discountVal.toFixed(2)}` : `-${discountVal}%`)
          : '';
        let linesHtml = discountVal > 0
          ? `<p style="margin:4px 0;text-decoration:line-through;color:#aaa">Base: $${rawBase.toFixed(2)}</p><p style="margin:4px 0;color:#16a34a">${discLabel} discount → $${discBase.toFixed(2)} × ${qty} = $${(discBase * qty).toFixed(2)}</p>`
          : `<p style="margin:4px 0">Base: $${rawBase.toFixed(2)} × ${qty} = $${(rawBase * qty).toFixed(2)}</p>`;
        (item.print_addons || []).forEach(a => {
          linesHtml += `<p style="margin:4px 0;color:#666">${a.print_type_name}: $${(Number(a.cost_per_unit) || 0).toFixed(2)} × ${qty} = $${((Number(a.cost_per_unit) || 0) * qty).toFixed(2)}</p>`;
        });
        linesHtml += `<p style="margin:4px 0;font-weight:bold">Item Total: $${(unitPrice * qty).toFixed(2)}</p>`;
        return `<div style="margin-bottom:16px"><p style="font-weight:bold;margin-bottom:4px">${item.name} ×${qty}</p>${linesHtml}</div>`;
      })
      .join('');

    const tableRows = matrix.map((row, i) =>
      `<tr style="border-bottom:1px solid #eee"><td style="padding:4px 8px">${i + 1}</td><td style="padding:4px 8px">${row.itemName}</td><td style="padding:4px 8px">${row.size}</td><td style="padding:4px 8px">${row.playerName}</td><td style="padding:4px 8px;text-align:center">${row.playerNumber}</td><td style="padding:4px 8px;text-align:center">${row.initials}</td><td style="padding:4px 8px">${row.sponsorName}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><title>${clubName} Order Proof</title><style>body{font-family:sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}th{text-align:left;padding:6px 8px;border-bottom:2px solid #333;font-size:11px;text-transform:uppercase}td{font-size:12px}@media print{button{display:none}}</style></head><body>
      <h1 style="font-size:20px;margin-bottom:4px">${clubName}</h1>
      <p style="color:#666;margin-bottom:2px">Order: ${orderNumber}</p>
      <p style="color:#666;margin-bottom:20px">Date: ${new Date().toLocaleDateString()}</p>
      <h2 style="font-size:14px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:12px">Cost Breakdown</h2>
      ${itemsHtml}
      <div style="border-top:2px solid #333;padding-top:12px;margin-top:8px">
        <p>Subtotal: $${subtotal.toFixed(2)}</p>
        <p>HST (13%): $${hst.toFixed(2)}</p>
        <p style="font-size:18px;font-weight:bold">TOTAL: $${total.toFixed(2)}</p>
        <p style="font-size:11px;color:#888">* Final price confirmed by Absolute Soccer</p>
      </div>
      <h2 style="font-size:14px;border-bottom:2px solid #333;padding-bottom:6px;margin-top:24px;margin-bottom:12px">Roster</h2>
      <table><thead><tr><th>#</th><th>Item</th><th>Size</th><th>Name</th><th>Number</th><th>Initials</th><th>Sponsor</th></tr></thead><tbody>${tableRows}</tbody></table>
      <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:16px">
        <p>I confirm all details are correct: _______________________________</p>
        <p style="margin-top:12px">Date: _______________________________</p>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Jersey mockup */}
      <div className="lg:w-56 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Preview</p>
        <div className="flex justify-center">
          <div className="relative w-48">
            <svg viewBox="0 0 200 220" className="w-full drop-shadow-xl">
              <path
                d="M 50,30 L 80,10 L 120,10 L 150,30 L 190,60 L 165,95 L 150,80 L 150,200 L 50,200 L 50,80 L 35,95 L 10,60 Z"
                fill={primaryColor}
                stroke={secondaryColor || '#ffffff'}
                strokeWidth="3"
              />
              <path d="M 80,10 C 90,30 110,30 120,10" fill="none" stroke={secondaryColor || '#ffffff'} strokeWidth="4" />
            </svg>
            {selectedRow && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {selectedRow.playerName && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {selectedRow.playerName}
                  </span>
                )}
                {selectedRow.playerNumber && (
                  <span className="text-4xl font-black text-white leading-none drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    {selectedRow.playerNumber}
                  </span>
                )}
                {selectedRow.initials && (
                  <span className="text-[10px] text-white/80 drop-shadow">{selectedRow.initials}</span>
                )}
                {selectedRow.sponsorName && (
                  <span className="text-[9px] text-white/70 mt-1">{selectedRow.sponsorName}</span>
                )}
              </div>
            )}
          </div>
        </div>
        {sponsors.length > 0 && (
          <div className="mt-3 text-xs text-zinc-500">
            <p className="font-bold mb-1">Sponsors:</p>
            {sponsors.map(s => <p key={s.name} className="text-zinc-600">{s.name}</p>)}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex-1 min-w-0">
        {/* Stats */}
        <div className="flex gap-4 mb-4 text-xs text-zinc-500">
          <span>Total garments: <strong className="text-zinc-900">{matrix.length}</strong></span>
          <span>Names: <strong className="text-zinc-900">{namesAssigned}/{matrix.length}</strong></span>
          <span>Numbers: <strong className="text-zinc-900">{numbersAssigned}/{matrix.length}</strong></span>
        </div>

        {/* Roster summary table */}
        <div className="overflow-x-auto max-h-64 border border-zinc-200 rounded-xl mb-4">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-50">
              <tr className="border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <th className="py-2 px-3 text-left">Item</th>
                <th className="py-2 px-3 text-left">Size</th>
                <th className="py-2 px-3 text-left">Name</th>
                <th className="py-2 px-3 text-left">#</th>
                <th className="py-2 px-3 text-left">Init.</th>
                {sponsors.length > 0 && <th className="py-2 px-3 text-left">Sponsor</th>}
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRowId(row.id)}
                  className={`border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 ${selectedRowId === row.id ? 'bg-zinc-100' : ''}`}
                >
                  <td className="py-1.5 px-3 text-zinc-600 max-w-[100px] truncate">{row.itemName}</td>
                  <td className="py-1.5 px-3"><span className="bg-zinc-100 text-zinc-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{row.size}</span></td>
                  <td className="py-1.5 px-3 font-medium text-zinc-800">{row.playerName || <span className="text-zinc-300">—</span>}</td>
                  <td className="py-1.5 px-3 text-zinc-700">{row.playerNumber || <span className="text-zinc-300">—</span>}</td>
                  <td className="py-1.5 px-3 text-zinc-500">{row.initials || <span className="text-zinc-300">—</span>}</td>
                  {sponsors.length > 0 && <td className="py-1.5 px-3 text-zinc-500">{row.sponsorName || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Print cost breakdown */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Cost Breakdown</p>
          {items.filter(item => getTotalQty(quantities, item.id) > 0).map(item => {
            const qty = getTotalQty(quantities, item.id);
            const rawBase = Number(item.price || 0);
            const discountVal = Number(item.discount_value || 0);
            const discountedBase = getDiscountedBase(item);
            const discountLabel = discountVal > 0
              ? (item.discount_type === '$' ? `-$${discountVal.toFixed(2)}` : `-${discountVal}%`)
              : '';
            return (
              <div key={item.id} className="mb-3">
                <p className="font-bold text-sm text-zinc-800">{item.name} ×{qty}</p>
                <div className="ml-2 space-y-0.5 text-xs text-zinc-500">
                  {discountVal > 0 ? (
                    <>
                      <p className="line-through text-zinc-300">Base: ${rawBase.toFixed(2)}</p>
                      <p className="text-emerald-600">{discountLabel} discount → ${discountedBase.toFixed(2)} × {qty} = ${(discountedBase * qty).toFixed(2)}</p>
                    </>
                  ) : (
                    <p>Base: ${rawBase.toFixed(2)} × {qty} = ${(rawBase * qty).toFixed(2)}</p>
                  )}
                  {(item.print_addons || []).map(a => (
                    <p key={a.print_type_id} className="text-zinc-400">+ {a.print_type_name}: ${(Number(a.cost_per_unit) || 0).toFixed(2)} × {qty} = ${((Number(a.cost_per_unit) || 0) * qty).toFixed(2)}</p>
                  ))}
                  <p className="font-bold text-zinc-700">Item Total: ${(getItemTotalPrice(item) * qty).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
          <div className="border-t border-zinc-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-zinc-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-zinc-500"><span>HST (13%)</span><span>${hst.toFixed(2)}</span></div>
            <div className="flex justify-between font-black text-zinc-900 text-base border-t border-zinc-200 pt-2 mt-2"><span>TOTAL</span><span>${total.toFixed(2)}</span></div>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">* Final price confirmed by Absolute Soccer</p>
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any special instructions for this order..."
          className="w-full border border-zinc-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none mb-4"
          rows={3}
        />

        {/* Export buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
          >
            📥 Download CSV
          </button>
          <button
            onClick={printProof}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
          >
            🖨 Print Proof
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const ClubOrderPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const preselectItemId = (location.state as { preselectItemId?: string } | null)?.preselectItemId;
  const { club, isLoading, error } = useClub(slug);

  const [items, setItems] = useState<ClubItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [sponsors, setSponsors] = useState<SponsorEntry[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [pendingOrderNumber, setPendingOrderNumber] = useState('');
  const [showDupeWarning, setShowDupeWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const didPreselect = useRef(false);

  useEffect(() => {
    if (!club) return;
    supabase
      .from('club_items')
      .select('*')
      .eq('club_id', club.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setItems((data || []) as unknown as ClubItem[]);
        setItemsLoading(false);
      });
  }, [club]);

  useEffect(() => {
    if (didPreselect.current || !preselectItemId || items.length === 0) return;
    const item = items.find(i => i.id === preselectItemId);
    const firstSize = item?.sizes_available?.[0];
    if (item && firstSize) setQuantities(prev => ({ ...prev, [item.id]: { ...prev[item.id], [firstSize]: 1 } }));
    didPreselect.current = true;
  }, [items, preselectItemId]);

  // Pre-generate order number when entering step 3
  useEffect(() => {
    if (currentStep === 3 && !pendingOrderNumber) {
      generateOrderNumber().then(setPendingOrderNumber);
    }
  }, [currentStep, pendingOrderNumber]);

  const displayedItems = useCallback(() => {
    const regular = items.filter(i => !i.is_suggested);
    const preselected = items.find(i => i.id === preselectItemId && i.is_suggested);
    return preselected ? [...regular, preselected] : regular;
  }, [items, preselectItemId]);

  const hasAnyQty = displayedItems().some(i => getTotalQty(quantities, i.id) > 0);

  const goToStep2 = () => {
    if (!hasAnyQty) return;
    const newMatrix = generateMatrix(displayedItems(), quantities, sponsors);
    setMatrix(prev => {
      // Preserve existing data for matching rows
      return newMatrix.map(row => {
        const existing = prev.find(r => r.id === row.id);
        return existing ? { ...row, playerName: existing.playerName, playerNumber: existing.playerNumber, initials: existing.initials, sponsorName: existing.sponsorName } : row;
      });
    });
    setCurrentStep(2);
  };

  const checkDupesAndGoStep3 = () => {
    const dups = matrix
      .filter(r => r.playerNumber)
      .reduce((acc, r) => { const k = `${r.itemId}_${r.playerNumber}`; acc[k] = (acc[k] || 0) + 1; return acc; }, {} as Record<string, number>);
    if (Object.values(dups).some(v => v > 1)) {
      setShowDupeWarning(true);
    } else {
      setCurrentStep(3);
    }
  };

  const submitOrder = async () => {
    if (!club) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const allItems = displayedItems();
      const subtotal = allItems.reduce((sum, item) => sum + getItemTotalPrice(item) * getTotalQty(quantities, item.id), 0);
      const hst = subtotal * HST_RATE;
      const total = subtotal + hst;

      const orderItems = allItems
        .filter(item => getTotalQty(quantities, item.id) > 0)
        .map(item => ({
          name: item.name,
          image_url: item.image_url,
          sizes: quantities[item.id],
          quantity: getTotalQty(quantities, item.id),
          base_price: item.price,
          print_addons: item.print_addons || [],
          unit_total: getItemTotalPrice(item),
          item_total: getItemTotalPrice(item) * getTotalQty(quantities, item.id),
        }));

      const { error } = await supabase.from('club_orders').insert([{
        club_id: club.id,
        order_number: pendingOrderNumber,
        status: 'pending',
        items: orderItems,
        customization_matrix: matrix,
        sponsors,
        notes: notes.trim() || null,
        total_amount: total,
        deposit_paid: 0,
        balance_owing: total,
      }]);
      if (error) throw error;
      setConfirmedOrderNumber(pendingOrderNumber);
    } catch (err: any) {
      console.error('Error submitting club order:', err);
      setSubmitError(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm font-bold uppercase tracking-widest">Loading...</div>;
  if (error || !club) return <div className="min-h-screen flex items-center justify-center text-zinc-600 font-bold">Club not found.</div>;

  if (confirmedOrderNumber) {
    return (
      <ClubPortalLayout club={club} activeNav="order">
        {() => (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-black text-zinc-900 mb-2">Order Submitted!</h2>
            <p className="text-zinc-500 mb-2">Order Number: <span className="font-bold text-zinc-900">{confirmedOrderNumber}</span></p>
            <p className="text-sm text-zinc-400 mb-8">
              We'll review your order and confirm within 24 hours.<br />
              You can track your order status in the History tab.
            </p>
            <button
              onClick={() => navigate(`/portal/${club.slug}/dashboard`)}
              className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-white"
              style={{ backgroundColor: club.primary_color }}
            >
              Back to Portal →
            </button>
          </div>
        )}
      </ClubPortalLayout>
    );
  }

  return (
    <ClubPortalLayout club={club} activeNav="order">
      {() => (
        <div className="pb-32">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-4">New Order</h2>

          <StepIndicator step={currentStep} primaryColor={club.primary_color} />

          {itemsLoading ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Loading items...</p>
          ) : (
            <>
              {currentStep === 1 && (
                <Step1
                  items={displayedItems()}
                  quantities={quantities}
                  setQuantities={setQuantities}
                  sponsors={sponsors}
                  setSponsors={setSponsors}
                  primaryColor={club.primary_color}
                  preselectItemId={preselectItemId}
                />
              )}
              {currentStep === 2 && (
                <Step2
                  matrix={matrix}
                  setMatrix={setMatrix}
                  sponsors={sponsors}
                  primaryColor={club.primary_color}
                />
              )}
              {currentStep === 3 && (
                <Step3
                  items={displayedItems()}
                  quantities={quantities}
                  matrix={matrix}
                  sponsors={sponsors}
                  notes={notes}
                  setNotes={setNotes}
                  primaryColor={club.primary_color}
                  secondaryColor={club.secondary_color || '#ffffff'}
                  orderNumber={pendingOrderNumber}
                  clubName={club.name}
                />
              )}
            </>
          )}

          {/* Running total sidebar — Step 1 only */}
          {currentStep === 1 && hasAnyQty && (
            <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Order Summary</p>
              {displayedItems().map(item => {
                const qty = getTotalQty(quantities, item.id);
                if (!qty) return null;
                const unitPrice = getItemTotalPrice(item);
                return (
                  <div key={item.id} className="mb-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700">{item.name} ×{qty}</span>
                      <span className="font-bold text-zinc-900">${(unitPrice * qty).toFixed(2)}</span>
                    </div>
                    {(item.print_addons || []).map(a => (
                      <div key={a.print_type_id} className="text-xs text-zinc-400 ml-3">
                        + {a.print_type_name}: ${(Number(a.cost_per_unit) || 0).toFixed(2)}/unit
                      </div>
                    ))}
                  </div>
                );
              })}
              {(() => {
                const sub = displayedItems().reduce((s, item) => s + getItemTotalPrice(item) * getTotalQty(quantities, item.id), 0);
                const hst = sub * HST_RATE;
                return (
                  <div className="border-t border-zinc-200 pt-2 mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>${sub.toFixed(2)}</span></div>
                    <div className="flex justify-between text-zinc-400"><span>HST (13%)</span><span>${hst.toFixed(2)}</span></div>
                    <div className="flex justify-between font-black text-zinc-900"><span>Total</span><span>${(sub + hst).toFixed(2)}</span></div>
                  </div>
                );
              })()}
            </div>
          )}

          {submitError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">{submitError}</div>
          )}

          {/* Navigation footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 z-30">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
              {currentStep > 1 ? (
                <button
                  onClick={() => setCurrentStep(s => s - 1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              ) : <div />}

              {currentStep === 1 && (
                <button
                  onClick={goToStep2}
                  disabled={!hasAnyQty}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-white disabled:opacity-40"
                  style={{ backgroundColor: club.primary_color }}
                >
                  Next: Customize Roster <ChevronRight size={16} />
                </button>
              )}
              {currentStep === 2 && (
                <button
                  onClick={checkDupesAndGoStep3}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-white"
                  style={{ backgroundColor: club.primary_color }}
                >
                  Next: Review & Submit <ChevronRight size={16} />
                </button>
              )}
              {currentStep === 3 && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={isSubmitting || !pendingOrderNumber}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-white disabled:opacity-40"
                  style={{ backgroundColor: club.primary_color }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Order'}
                </button>
              )}
            </div>
          </div>

          {/* Duplicate warning modal */}
          {showDupeWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
                <h3 className="font-black text-zinc-900 mb-2">Duplicate Numbers Detected</h3>
                <p className="text-sm text-zinc-500 mb-6">Some jersey numbers appear more than once. Are you sure you want to continue?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDupeWarning(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 font-bold text-sm text-zinc-700 hover:bg-zinc-50">
                    Fix Numbers
                  </button>
                  <button
                    onClick={() => { setShowDupeWarning(false); setCurrentStep(3); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white"
                    style={{ backgroundColor: club.primary_color }}
                  >
                    Continue Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit confirm modal */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <h3 className="font-black text-zinc-900 mb-2">Submit this order?</h3>
                <p className="text-sm text-zinc-500 mb-6">Submit this order to Absolute Soccer for review?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 font-bold text-sm text-zinc-700 hover:bg-zinc-50">
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowSubmitConfirm(false); submitOrder(); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white"
                    style={{ backgroundColor: club.primary_color }}
                  >
                    Submit Order
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ClubPortalLayout>
  );
};
