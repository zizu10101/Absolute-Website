import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { POSPinEntry } from '../components/POSPinEntry';
import { useSettings } from '../context/SettingsContext';
import { downloadCSV } from '../utils/reportExport';
import {
  Search, X, Check, AlertTriangle, Loader2, ClipboardList, Trash2, ChevronLeft, RotateCcw, Plus, Printer, Download
} from 'lucide-react';

interface CountVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  age_group: string | null;
  stock_quantity: number;
}

interface CountProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
}

interface VariantGroup {
  key: string;
  productId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  color: string | null;
  variants: CountVariant[];
}

interface CountedRow {
  variant_id: string;
  barcode: string | null;
  product_name: string;
  color: string | null;
  size: string | null;
  system_qty: number;
  counted_qty: number;
  diff: number;
  isNew: boolean;
  matched: boolean;
}

interface ReportMeta {
  countDate: string;
  countedBy: string;
  totalCounted: number;
  matched: number;
  discrepancyCount: number;
  newCount: number;
  applied: boolean;
  appliedAt: Date | null;
}

interface AddVariantTarget {
  productId: string;
  productName: string;
  defaultColor: string;
  // true when the product is fixed (opened from a product card's "Add Missing Size"),
  // false when it must be searched for (opened from an unmatched barcode scan).
  locked: boolean;
}

const GROUPS_PER_PAGE = 25;

// Local date (not UTC) — a count done at 8pm Toronto time belongs to that day, not the next.
const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DRAFT_KEY = `inventory_count_draft_${todayLocalISO()}`;

// Sizes are text ("8", "8.5", "M", "One Size") — sort numerics numerically, then the rest A-Z.
const compareSizes = (a: string | null, b: string | null) => {
  const na = parseFloat(a || '');
  const nb = parseFloat(b || '');
  const aNum = !isNaN(na) && /^[\d.]+$/.test((a || '').trim());
  const bNum = !isNaN(nb) && /^[\d.]+$/.test((b || '').trim());
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return (a || '').localeCompare(b || '');
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Fetches every row of a table, working around PostgREST's hard 1000-row cap per request.
async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const batchSize = 1000;
  let from = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data) break;
    all.push(...(data as unknown as T[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

export function InventoryCountPage() {
  const { logo, storeInfo } = useSettings();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [variants, setVariants] = useState<CountVariant[]>([]);
  const [products, setProducts] = useState<CountProduct[]>([]);

  // variantId -> raw input string (kept as a string so a cleared field means "not counted")
  const [counts, setCounts] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(GROUPS_PER_PAGE);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<{ text: string; ok: boolean; barcode?: string } | null>(null);

  const [showSubmit, setShowSubmit] = useState(false);
  const [countedBy, setCountedBy] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ adjusted: number; counted: number } | null>(null);
  const [lastAppliedReport, setLastAppliedReport] = useState<{ rows: CountedRow[]; meta: ReportMeta } | null>(null);

  // Variants created mid-count via "Add Missing Item" / "Add Missing Size", so they're always
  // flagged in the discrepancy report even if their physical count happens to be entered as 0.
  const [newVariantIds, setNewVariantIds] = useState<Set<string>>(new Set());

  const [addVariantTarget, setAddVariantTarget] = useState<AddVariantTarget | null>(null);
  const [avProduct, setAvProduct] = useState<CountProduct | null>(null);
  const [avProductSearch, setAvProductSearch] = useState('');
  const [avSize, setAvSize] = useState('');
  const [avColor, setAvColor] = useState('');
  const [avBarcode, setAvBarcode] = useState('');
  const [avCount, setAvCount] = useState('');
  const [avSaving, setAvSaving] = useState(false);
  const [avError, setAvError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (sessionStorage.getItem('pos_authenticated') === 'true') setIsAuthenticated(true);
  }, []);

  const handlePinSubmit = () => {
    sessionStorage.setItem('pos_authenticated', 'true');
    setIsAuthenticated(true);
  };

  // Restore an in-progress count so a phone refresh (or accidental back swipe) doesn't lose work.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setCounts(JSON.parse(saved));
    } catch {
      /* corrupt draft — start clean */
    }
  }, []);

  useEffect(() => {
    try {
      if (Object.keys(counts).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(counts));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage full / private mode — counting still works in memory */
    }
  }, [counts]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [prods, vars] = await Promise.all([
          fetchAllRows<CountProduct>('products', 'id,name,brand,category'),
          fetchAllRows<CountVariant>('product_variants', 'id,product_id,size,color,barcode,age_group,stock_quantity'),
        ]);
        if (!active) return;
        setProducts(prods);
        setVariants(vars);
      } catch (err: any) {
        if (active) setLoadError(err?.message || 'Failed to load inventory');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isAuthenticated]);

  const productMap = useMemo(() => {
    const m = new Map<string, CountProduct>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const variantMap = useMemo(() => {
    const m = new Map<string, CountVariant>();
    variants.forEach(v => m.set(v.id, v));
    return m;
  }, [variants]);

  const barcodeMap = useMemo(() => {
    const m = new Map<string, CountVariant>();
    variants.forEach(v => { if (v.barcode) m.set(v.barcode.trim().toUpperCase(), v); });
    return m;
  }, [variants]);

  // One card per product + color, so the same boot in two colourways never gets merged.
  const allGroups = useMemo<VariantGroup[]>(() => {
    const map = new Map<string, VariantGroup>();
    variants.forEach(v => {
      const product = productMap.get(v.product_id);
      if (!product) return; // orphaned variant — product deleted
      const color = v.color || null;
      const key = `${v.product_id}::${color || ''}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          productId: product.id,
          productName: product.name,
          brand: product.brand || null,
          category: product.category || null,
          color,
          variants: [],
        };
        map.set(key, group);
      }
      group.variants.push(v);
    });
    const groups = Array.from(map.values());
    groups.forEach(g => g.variants.sort((a, b) => compareSizes(a.size, b.size)));
    groups.sort((a, b) =>
      a.productName.localeCompare(b.productName) || (a.color || '').localeCompare(b.color || '')
    );
    return groups;
  }, [variants, productMap]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allGroups.forEach(g => { if (g.category) set.add(g.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allGroups]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allGroups.filter(g => {
      if (category !== 'all' && (g.category || '') !== category) return false;
      if (!term) return true;
      const haystack = `${g.productName} ${g.brand || ''} ${g.color || ''}`.toLowerCase();
      if (haystack.includes(term)) return true;
      return g.variants.some(v =>
        (v.barcode || '').toLowerCase().includes(term) || (v.size || '').toLowerCase().includes(term)
      );
    });
  }, [allGroups, search, category]);

  useEffect(() => { setVisibleCount(GROUPS_PER_PAGE); }, [search, category]);

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount]
  );

  const visibleVariantTotal = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.variants.length, 0),
    [filteredGroups]
  );

  const isCounted = useCallback((id: string) => (counts[id] ?? '').trim() !== '', [counts]);

  const countedInFilter = useMemo(() => {
    let n = 0;
    filteredGroups.forEach(g => g.variants.forEach(v => { if (isCounted(v.id)) n++; }));
    return n;
  }, [filteredGroups, isCounted]);

  // Every counted variant this session — matched, mismatched, and newly added. Print/CSV need
  // the full list per spec; the on-screen Review modal filters this down to mismatches below.
  const sessionRows = useMemo<CountedRow[]>(() => {
    const list: CountedRow[] = [];
    Object.entries(counts).forEach(([variantId, raw]) => {
      if ((raw ?? '').trim() === '') return;
      const variant = variantMap.get(variantId);
      if (!variant) return;
      const counted = parseInt(raw, 10);
      if (isNaN(counted)) return;
      const system = variant.stock_quantity ?? 0;
      const isNew = newVariantIds.has(variantId);
      const product = productMap.get(variant.product_id);
      list.push({
        variant_id: variantId,
        barcode: variant.barcode,
        product_name: product?.name || 'Unknown product',
        color: variant.color,
        size: variant.size,
        system_qty: system,
        counted_qty: counted,
        diff: counted - system,
        isNew,
        matched: counted === system && !isNew,
      });
    });
    list.sort((a, b) =>
      a.product_name.localeCompare(b.product_name) || compareSizes(a.size, b.size)
    );
    return list;
  }, [counts, variantMap, productMap, newVariantIds]);

  // Mismatches plus every newly-added variant, even one counted at exactly 0 — a brand new
  // barcode is inherently worth flagging regardless of what its physical count came out to.
  const discrepancies = useMemo(() => sessionRows.filter(r => !r.matched), [sessionRows]);

  const totalCounted = useMemo(
    () => Object.values(counts).filter(v => (v ?? '').trim() !== '').length,
    [counts]
  );

  // Infinite scroll — the full list is 2000+ rows, far too many to mount at once on a phone.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(c => (c < filteredGroups.length ? c + GROUPS_PER_PAGE : c));
      }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredGroups.length]);

  // Grow the render window until the scanned variant is mounted. This must run after the
  // "reset window on filter change" effect above, because clearing the search on a scan
  // re-triggers that reset in the same commit and would otherwise undo the expansion.
  useEffect(() => {
    if (!pendingScrollId) return;
    const index = filteredGroups.findIndex(g => g.variants.some(v => v.id === pendingScrollId));
    if (index >= 0 && index + 1 > visibleCount) setVisibleCount(index + 1 + 5);
  }, [pendingScrollId, filteredGroups, visibleCount]);

  // Scroll to the scanned variant once it's actually in the DOM.
  useEffect(() => {
    if (!pendingScrollId) return;
    const row = rowRefs.current[pendingScrollId];
    if (!row) return; // still outside the rendered window; the effect above will widen it
    const input = inputRefs.current[pendingScrollId];
    setPendingScrollId(null);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (input) {
      // preventScroll matters: a plain focus() cancels the smooth scroll above and re-scrolls
      // to "nearest", which ignores the sticky header and parks the row behind it. The rows
      // also carry scroll-margin as a fallback for browsers that re-scroll on keyboard open.
      setTimeout(() => { input.focus({ preventScroll: true }); input.select(); }, 400);
    }
  }, [pendingScrollId, visibleGroups]);

  const jumpToVariant = (variant: CountVariant) => {
    setSearch('');
    setCategory('all');
    setHighlightId(variant.id);
    setPendingScrollId(variant.id);
    const product = productMap.get(variant.product_id);
    setScanMessage({
      text: `${product?.name || 'Product'}${variant.color ? ` · ${variant.color}` : ''}${variant.size ? ` · Size ${variant.size}` : ''}`,
      ok: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = search.trim();
    if (!raw) return;
    const variant = barcodeMap.get(raw.toUpperCase());
    if (variant) {
      jumpToVariant(variant);
    } else {
      // Not a known barcode — leave the text in place, it still filters the list below.
      setScanMessage({ text: `No barcode match for "${raw}" — showing text matches`, ok: false, barcode: raw });
    }
  };

  useEffect(() => {
    // "Not found" messages carry the Add Missing Item button — they stay up until the user
    // acts (new search, new scan, or add) instead of vanishing before staff can tap it.
    if (!scanMessage || !scanMessage.ok) return;
    const t = setTimeout(() => setScanMessage(null), 4000);
    return () => clearTimeout(t);
  }, [scanMessage]);

  const setCount = (variantId: string, value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    // The scan highlight has served its purpose once this row is actually being counted.
    setHighlightId(current => (current === variantId ? null : current));
    setCounts(prev => {
      const next = { ...prev };
      if (cleaned === '') delete next[variantId];
      else next[variantId] = cleaned;
      return next;
    });
  };

  const clearAllCounts = () => {
    if (totalCounted === 0) return;
    if (!confirm(`Clear all ${totalCounted} counted entries? This cannot be undone.`)) return;
    setCounts({});
    setHighlightId(null);
  };

  // Most-common age_group among a product's existing variants, so a manually added size lands
  // in the same bucket as its siblings without asking staff to pick one on a phone screen.
  // product_variants.age_group is NOT NULL with no default, so something must always be sent.
  const inferAgeGroup = (productId: string): string => {
    const tally = new Map<string, number>();
    variants.forEach(v => {
      if (v.product_id === productId && v.age_group) tally.set(v.age_group, (tally.get(v.age_group) || 0) + 1);
    });
    let best = 'Adult';
    let bestCount = 0;
    tally.forEach((count, ageGroup) => { if (count > bestCount) { best = ageGroup; bestCount = count; } });
    return best;
  };

  const openAddVariant = (target: AddVariantTarget, prefillBarcode = '') => {
    setAddVariantTarget(target);
    setAvProduct(target.locked ? { id: target.productId, name: target.productName, brand: null, category: null } : null);
    setAvProductSearch('');
    setAvSize('');
    setAvColor(target.defaultColor);
    setAvBarcode(prefillBarcode);
    setAvCount('');
    setAvError(null);
  };

  const closeAddVariant = () => {
    setAddVariantTarget(null);
    setAvProduct(null);
  };

  const productMatches = useMemo(() => {
    const term = avProductSearch.trim().toLowerCase();
    if (!term) return [];
    return products.filter(p => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [avProductSearch, products]);

  const handleAddVariant = async () => {
    const product = avProduct;
    if (!product) { setAvError('Select a product first.'); return; }
    const size = avSize.trim();
    const color = avColor.trim();
    const barcode = avBarcode.trim();
    if (!barcode) { setAvError('Barcode is required.'); return; }
    if (barcodeMap.has(barcode.toUpperCase())) { setAvError(`Barcode "${barcode}" is already assigned to another variant.`); return; }
    const countNum = avCount.trim() === '' ? NaN : parseInt(avCount, 10);
    if (isNaN(countNum) || countNum < 0) { setAvError('Enter a valid physical count (0 or more).'); return; }

    setAvSaving(true);
    setAvError(null);
    try {
      const { data: dup } = await supabase.from('product_variants').select('id').eq('barcode', barcode).maybeSingle();
      if (dup) { setAvError(`Barcode "${barcode}" already exists in the system.`); return; }

      const ageGroup = inferAgeGroup(product.id);
      const { data, error } = await supabase
        .from('product_variants')
        .insert({ product_id: product.id, age_group: ageGroup, size: size || null, color: color || null, barcode, stock_quantity: countNum })
        .select()
        .single();
      if (error) throw error;

      const newVariant: CountVariant = {
        id: data.id,
        product_id: product.id,
        size: size || null,
        color: color || null,
        barcode,
        age_group: ageGroup,
        // Kept at 0 locally (even though the DB row was inserted with the real count already) so
        // this reads as a genuine "0 -> counted" new-item discrepancy through the existing
        // system-vs-counted machinery instead of needing a separate code path.
        stock_quantity: 0,
      };
      setVariants(prev => [...prev, newVariant]);
      setNewVariantIds(prev => { const next = new Set(prev); next.add(newVariant.id); return next; });
      setCounts(prev => ({ ...prev, [newVariant.id]: String(countNum) }));
      setSearch('');
      setHighlightId(newVariant.id);
      setPendingScrollId(newVariant.id);
      setScanMessage({ text: `Added ${product.name}${color ? ` · ${color}` : ''}${size ? ` · Size ${size}` : ''} to the count`, ok: true });
      closeAddVariant();
    } catch (err: any) {
      setAvError(err?.message || 'Failed to add variant');
    } finally {
      setAvSaving(false);
    }
  };

  const buildReportMeta = (rows: CountedRow[], applied: boolean, appliedAt: Date | null): ReportMeta => ({
    countDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    countedBy: countedBy.trim() || 'Staff',
    totalCounted: rows.length,
    matched: rows.filter(r => r.matched).length,
    discrepancyCount: rows.filter(r => !r.matched).length,
    newCount: rows.filter(r => r.isNew).length,
    applied,
    appliedAt,
  });

  const generateInventoryReportHTML = (rows: CountedRow[], meta: ReportMeta) => {
    const rowsHtml = rows.map(r => {
      const label = r.matched
        ? '<span style="color:#15803d;font-weight:700;">MATCH</span>'
        : r.isNew
        ? `<span style="color:#b45309;font-weight:700;">${r.diff > 0 ? '+' : ''}${r.diff} NEW</span>`
        : `<span style="color:${r.diff > 0 ? '#15803d' : '#b91c1c'};font-weight:700;">${r.diff > 0 ? '+' : ''}${r.diff}</span>`;
      return `
        <tr>
          <td>${escapeHtml(r.product_name)}</td>
          <td>${escapeHtml(r.size || '-')}</td>
          <td>${escapeHtml(r.color || '-')}</td>
          <td>${escapeHtml(r.barcode || '-')}</td>
          <td style="text-align:center;">${r.system_qty}</td>
          <td style="text-align:center;">${r.counted_qty}</td>
          <td style="text-align:right;">${label}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Inventory Count Report - ${meta.countDate}</title>
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
  <div class="meta">Date: ${meta.countDate}</div>
  <div class="meta">Time: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
  <div class="meta">Counted by: ${escapeHtml(meta.countedBy)}</div>

  <div class="banner ${meta.discrepancyCount === 0 ? 'clean' : ''}">
    ${meta.discrepancyCount === 0 ? 'NO DISCREPANCIES - ALL COUNTS MATCHED' : `DISCREPANCIES FOUND: ${meta.discrepancyCount} item${meta.discrepancyCount === 1 ? '' : 's'}`}
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th><th>Sz</th><th>Color</th><th>Barcode</th>
        <th style="text-align:center;">Sys</th><th style="text-align:center;">Count</th><th style="text-align:right;">Diff</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center; color:#888;">No items counted</td></tr>'}</tbody>
  </table>

  <div class="section-title">Summary</div>
  <table class="summary-table">
    <tr><td class="label">Total variants counted</td><td class="value">${meta.totalCounted}</td></tr>
    <tr><td class="label">Matched</td><td class="value">${meta.matched}</td></tr>
    <tr><td class="label">Discrepancies</td><td class="value">${meta.discrepancyCount}</td></tr>
    <tr><td class="label">New items added</td><td class="value">${meta.newCount}</td></tr>
  </table>

  <div class="section-title">Adjustments</div>
  <table class="summary-table">
    <tr><td class="label">Adjustments applied</td><td class="value">${meta.applied ? 'Yes' : 'No'}</td></tr>
    <tr><td class="label">Applied at</td><td class="value">${meta.appliedAt ? meta.appliedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'}</td></tr>
  </table>

  <div class="footer">Generated ${new Date().toLocaleString('en-US')} &middot; ${escapeHtml(storeInfo.name || 'Absolute Soccer Mississauga')}</div>
</body>
</html>`;
  };

  const printInventoryReport = (html: string) => {
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

  const handleExportCSV = (rows: CountedRow[], meta: ReportMeta) => {
    const data: (string | number)[][] = [
      ['Date', 'Product', 'Size', 'Color', 'Barcode', 'System Qty', 'Physical Count', 'Difference', 'Status'],
      ...rows.map(r => [
        meta.countDate,
        r.product_name,
        r.size || '',
        r.color || '',
        r.barcode || '',
        r.system_qty,
        r.counted_qty,
        r.diff,
        r.isNew ? 'New' : r.matched ? 'Match' : 'Discrepancy',
      ]),
    ];
    downloadCSV(data, `inventory-count-${todayLocalISO()}.csv`);
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      // Chunked so a large count doesn't fire 200 requests at once from a phone.
      const chunkSize = 20;
      for (let i = 0; i < discrepancies.length; i += chunkSize) {
        const chunk = discrepancies.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map(d =>
            supabase.from('product_variants').update({ stock_quantity: d.counted_qty }).eq('id', d.variant_id)
          )
        );
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
      }

      // adjustments stores the FULL session (matches included, not just discrepancies) so the
      // Admin > Inventory Counts "View" screen can show everything that was counted, not only
      // what changed.
      const adjustments = sessionRows.map(r => ({
        variant_id: r.variant_id,
        barcode: r.barcode,
        product_name: r.product_name,
        color: r.color,
        size: r.size,
        system_qty: r.system_qty,
        counted_qty: r.counted_qty,
        diff: r.diff,
        status: r.isNew ? 'new' : r.matched ? 'match' : 'discrepancy',
      }));

      const { error: logError } = await supabase.from('inventory_counts').insert({
        count_date: todayLocalISO(),
        counted_by: countedBy.trim() || null,
        total_variants_counted: totalCounted,
        total_discrepancies: discrepancies.length,
        adjustments,
      });
      if (logError) throw logError;

      // Reflect the new system quantities locally so the list is accurate without a reload.
      const appliedMap = new Map(discrepancies.map(d => [d.variant_id, d.counted_qty]));
      setVariants(prev =>
        prev.map(v => (appliedMap.has(v.id) ? { ...v, stock_quantity: appliedMap.get(v.id)! } : v))
      );

      // Snapshot the session for the success screen's Print/Export — counts get cleared below.
      setLastAppliedReport({ rows: sessionRows, meta: buildReportMeta(sessionRows, true, new Date()) });

      setApplyResult({ adjusted: discrepancies.length, counted: totalCounted });
      setCounts({});
      setHighlightId(null);
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to apply adjustments');
    } finally {
      setApplying(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <POSPinEntry
        onPinSubmit={handlePinSubmit}
        isDarkMode={false}
        title="Inventory Count"
        subtitle="Enter your PIN to start counting"
        maxLength={4}
      />
    );
  }

  const countDateLabel = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 py-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
                <ClipboardList size={22} className="text-[var(--primary-color)]" />
                Inventory Count
              </h1>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">{countDateLabel}</p>
            </div>
            <a
              href="/pos"
              className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 min-h-[48px] px-2"
            >
              <ChevronLeft size={16} /> POS
            </a>
          </div>

          {/* Search / scan */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Scan barcode or search product..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full h-14 pl-11 pr-11 rounded-xl border-2 border-zinc-300 bg-white text-base font-medium focus:outline-none focus:border-[var(--primary-color)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-zinc-400"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </form>

          {scanMessage && (
            <div
              className={`flex items-center justify-between gap-3 text-xs font-bold rounded-lg px-3 py-2 ${
                scanMessage.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <span>{scanMessage.ok ? 'Jumped to: ' : ''}{scanMessage.text}</span>
              {!scanMessage.ok && (
                <button
                  type="button"
                  onClick={() => openAddVariant({ productId: '', productName: '', defaultColor: '', locked: false }, scanMessage.barcode || '')}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white uppercase tracking-wider"
                >
                  <Plus size={12} /> Add Missing Item
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="flex-1 h-12 px-3 rounded-xl border-2 border-zinc-300 bg-white text-sm font-bold focus:outline-none focus:border-[var(--primary-color)]"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-right">
              <div className="text-sm font-black tabular-nums">
                {countedInFilter} <span className="text-zinc-400">of</span> {visibleVariantTotal}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">counted</div>
            </div>
            <button
              type="button"
              onClick={clearAllCounts}
              disabled={totalCounted === 0}
              className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-zinc-300 text-zinc-400 disabled:opacity-40 enabled:hover:text-red-600 enabled:hover:border-red-300"
              aria-label="Clear all counts"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* List */}
      <main className="max-w-3xl mx-auto px-3 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500">
            <Loader2 size={32} className="animate-spin" />
            <p className="font-bold">Loading inventory...</p>
          </div>
        )}

        {loadError && !loading && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
            <p className="font-black mb-1">Could not load inventory</p>
            <p className="text-sm">{loadError}</p>
          </div>
        )}

        {!loading && !loadError && filteredGroups.length === 0 && (
          <div className="text-center py-24 text-zinc-500 font-bold">No products match this filter.</div>
        )}

        <div className="space-y-3">
          {visibleGroups.map(group => (
            <div key={group.key} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-zinc-100">
                <h2 className="font-black leading-tight">{group.productName}</h2>
                {(group.color || group.brand) && (
                  <p className="text-xs font-bold text-zinc-500 mt-0.5">
                    {[group.color, group.brand].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="divide-y divide-zinc-100">
                {group.variants.map(variant => {
                  const raw = counts[variant.id] ?? '';
                  const counted = raw.trim() === '' ? null : parseInt(raw, 10);
                  const system = variant.stock_quantity ?? 0;
                  const match = counted !== null && counted === system;
                  const mismatch = counted !== null && counted !== system;
                  return (
                    <div
                      key={variant.id}
                      ref={el => { rowRefs.current[variant.id] = el; }}
                      className={`flex items-center gap-3 px-4 py-2.5 min-h-[56px] scroll-mt-64 scroll-mb-32 transition-colors ${
                        highlightId === variant.id
                          ? 'bg-yellow-100 ring-2 ring-inset ring-yellow-400'
                          : mismatch
                          ? 'bg-red-50'
                          : match
                          ? 'bg-green-50'
                          : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">
                          {variant.size ? `Size ${variant.size}` : 'One Size'}
                          {variant.age_group && variant.age_group !== 'Adult' && (
                            <span className="ml-1.5 text-[10px] uppercase font-black text-zinc-400">{variant.age_group}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-medium truncate">
                          System: <span className="font-black text-zinc-600">{system}</span>
                          {variant.barcode ? ` · ${variant.barcode}` : ''}
                        </div>
                      </div>
                      <input
                        ref={el => { inputRefs.current[variant.id] = el; }}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        value={raw}
                        onChange={e => setCount(variant.id, e.target.value)}
                        placeholder="—"
                        aria-label={`Physical count for ${group.productName} size ${variant.size || 'one size'}`}
                        className={`w-20 h-12 text-center text-xl font-black rounded-lg border-2 bg-white focus:outline-none focus:border-[var(--primary-color)] ${
                          mismatch ? 'border-red-400' : match ? 'border-green-500' : 'border-zinc-300'
                        }`}
                      />
                      <div className="w-7 flex items-center justify-center">
                        {match && <Check size={24} className="text-green-600" strokeWidth={3} />}
                        {mismatch && <AlertTriangle size={22} className="text-red-600" strokeWidth={2.5} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => openAddVariant({ productId: group.productId, productName: group.productName, defaultColor: group.color || '', locked: true })}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-black uppercase tracking-wider text-[var(--primary-color)] hover:bg-red-50 border-t border-zinc-100"
              >
                <Plus size={14} /> Add Missing Size
              </button>
            </div>
          ))}
        </div>

        <div ref={sentinelRef} className="h-px" />

        {!loading && visibleCount < filteredGroups.length && (
          <div className="py-6 text-center text-sm font-bold text-zinc-400">
            Showing {visibleGroups.length} of {filteredGroups.length} products — scroll for more
          </div>
        )}
      </main>

      {/* Sticky summary */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-zinc-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Counted</div>
              <div className="text-xl font-black tabular-nums">{totalCounted}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Discrepancies</div>
              <div className={`text-xl font-black tabular-nums ${discrepancies.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {discrepancies.length}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setApplyError(null); setApplyResult(null); setShowSubmit(true); }}
            disabled={totalCounted === 0}
            className="h-14 px-6 rounded-xl bg-[var(--primary-color)] text-white font-black uppercase tracking-wider disabled:bg-zinc-300 disabled:text-zinc-500 active:scale-95 transition-transform"
          >
            Submit Count
          </button>
        </div>
      </div>

      {/* Submit / review modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
            <div className="px-4 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide">
                {applyResult ? 'Count Applied' : 'Review Count'}
              </h2>
              <button
                onClick={() => setShowSubmit(false)}
                className="h-12 w-12 flex items-center justify-center text-zinc-400"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {applyResult ? (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex p-4 rounded-full bg-green-50">
                    <Check size={40} className="text-green-600" strokeWidth={3} />
                  </div>
                  <p className="font-black text-lg">Stock updated</p>
                  <p className="text-sm text-zinc-500 font-medium">
                    {applyResult.adjusted} variant{applyResult.adjusted === 1 ? '' : 's'} adjusted
                    out of {applyResult.counted} counted. The count was saved to the inventory log.
                  </p>
                  {lastAppliedReport && (
                    <div className="flex gap-2 max-w-xs mx-auto pt-2">
                      <button
                        type="button"
                        onClick={() => printInventoryReport(generateInventoryReportHTML(lastAppliedReport.rows, lastAppliedReport.meta))}
                        className="flex-1 h-11 rounded-lg border-2 border-zinc-300 text-xs font-black uppercase tracking-wider text-zinc-600 flex items-center justify-center gap-1.5"
                      >
                        <Printer size={14} /> Print Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCSV(lastAppliedReport.rows, lastAppliedReport.meta)}
                        className="flex-1 h-11 rounded-lg border-2 border-zinc-300 text-xs font-black uppercase tracking-wider text-zinc-600 flex items-center justify-center gap-1.5"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Variants counted</div>
                      <div className="text-2xl font-black tabular-nums">{totalCounted}</div>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Discrepancies</div>
                      <div className={`text-2xl font-black tabular-nums ${discrepancies.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {discrepancies.length}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => printInventoryReport(generateInventoryReportHTML(sessionRows, buildReportMeta(sessionRows, false, null)))}
                      className="flex-1 h-11 rounded-lg border-2 border-zinc-300 text-xs font-black uppercase tracking-wider text-zinc-600 flex items-center justify-center gap-1.5"
                    >
                      <Printer size={14} /> Print Report
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportCSV(sessionRows, buildReportMeta(sessionRows, false, null))}
                      className="flex-1 h-11 rounded-lg border-2 border-zinc-300 text-xs font-black uppercase tracking-wider text-zinc-600 flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} /> Export CSV
                    </button>
                  </div>

                  <label className="block mb-4">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Counted by (optional)</span>
                    <input
                      type="text"
                      value={countedBy}
                      onChange={e => setCountedBy(e.target.value)}
                      placeholder="Name"
                      className="mt-1 w-full h-12 px-3 rounded-xl border-2 border-zinc-300 font-bold focus:outline-none focus:border-[var(--primary-color)]"
                    />
                  </label>

                  {discrepancies.length === 0 ? (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-green-700 font-bold text-center">
                      Everything counted matches the system. Nothing to adjust.
                    </div>
                  ) : (
                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50">
                          <tr className="text-[10px] uppercase tracking-wider text-zinc-400 font-black">
                            <th className="text-left px-3 py-2">Product</th>
                            <th className="text-right px-2 py-2">System</th>
                            <th className="text-right px-2 py-2">Counted</th>
                            <th className="text-right px-3 py-2">Diff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {discrepancies.map(d => (
                            <tr key={d.variant_id}>
                              <td className="px-3 py-2">
                                <div className="font-bold leading-tight flex items-center gap-1.5">
                                  {d.product_name}
                                  {d.isNew && (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">New</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-medium">
                                  {[d.color, d.size ? `Size ${d.size}` : 'One Size'].filter(Boolean).join(' · ')}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums font-bold">{d.system_qty}</td>
                              <td className="px-2 py-2 text-right tabular-nums font-bold">{d.counted_qty}</td>
                              <td className={`px-3 py-2 text-right tabular-nums font-black ${d.diff > 0 ? 'text-green-600' : d.diff < 0 ? 'text-red-600' : 'text-zinc-500'}`}>
                                {d.diff > 0 ? `+${d.diff}` : d.diff}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {applyError && (
                    <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm font-bold">
                      {applyError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-4 border-t border-zinc-200 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {applyResult ? (
                <button
                  onClick={() => { setShowSubmit(false); setApplyResult(null); }}
                  className="flex-1 h-14 rounded-xl bg-[var(--primary-color)] text-white font-black uppercase tracking-wider active:scale-95 transition-transform"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowSubmit(false)}
                    disabled={applying}
                    className="flex-1 h-14 rounded-xl border-2 border-zinc-300 font-black uppercase tracking-wider text-zinc-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applying || discrepancies.length === 0}
                    className="flex-1 h-14 rounded-xl bg-[var(--primary-color)] text-white text-sm font-black uppercase tracking-wide whitespace-nowrap disabled:bg-zinc-300 disabled:text-zinc-500 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    {applying ? <><Loader2 size={18} className="animate-spin" /> Applying</> : <><RotateCcw size={16} /> Apply Adjustments</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Missing Variant modal */}
      {addVariantTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={closeAddVariant}>
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide">Add Missing Variant</h2>
              <button
                onClick={closeAddVariant}
                className="h-12 w-12 flex items-center justify-center text-zinc-400"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {addVariantTarget.locked ? (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Product</span>
                  <p className="font-black">{addVariantTarget.productName}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Product</label>
                  {avProduct ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-zinc-300 px-3 h-12">
                      <span className="font-bold truncate">{avProduct.name}</span>
                      <button
                        type="button"
                        onClick={() => setAvProduct(null)}
                        className="text-xs font-bold text-zinc-400 hover:text-zinc-900 shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={avProductSearch}
                        onChange={e => setAvProductSearch(e.target.value)}
                        placeholder="Search product name..."
                        autoFocus
                        className="w-full h-12 px-3 rounded-xl border-2 border-zinc-300 font-medium focus:outline-none focus:border-[var(--primary-color)]"
                      />
                      {avProductSearch.trim() && (
                        <div className="mt-2 max-h-48 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100">
                          {productMatches.length === 0 && (
                            <div className="p-3 text-sm text-zinc-400 font-medium">No products match</div>
                          )}
                          {productMatches.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setAvProduct(p); setAvProductSearch(''); }}
                              className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-zinc-50"
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Size</label>
                <input
                  type="text"
                  value={avSize}
                  onChange={e => setAvSize(e.target.value)}
                  placeholder="e.g. M, 9, One Size"
                  className="w-full h-12 px-3 rounded-xl border-2 border-zinc-300 font-bold focus:outline-none focus:border-[var(--primary-color)]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Color</label>
                <input
                  type="text"
                  value={avColor}
                  onChange={e => setAvColor(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-12 px-3 rounded-xl border-2 border-zinc-300 font-bold focus:outline-none focus:border-[var(--primary-color)]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Barcode</label>
                <input
                  type="text"
                  value={avBarcode}
                  onChange={e => setAvBarcode(e.target.value)}
                  placeholder="Scan or type barcode"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full h-12 px-3 rounded-xl border-2 border-zinc-300 font-bold focus:outline-none focus:border-[var(--primary-color)]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Physical Count</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={avCount}
                  onChange={e => setAvCount(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 px-3 rounded-xl border-2 border-zinc-300 text-xl font-black focus:outline-none focus:border-[var(--primary-color)]"
                />
              </div>

              {avError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm font-bold">
                  {avError}
                </div>
              )}
            </div>

            <div className="px-4 py-4 border-t border-zinc-200 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={closeAddVariant}
                disabled={avSaving}
                className="flex-1 h-14 rounded-xl border-2 border-zinc-300 font-black uppercase tracking-wider text-zinc-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVariant}
                disabled={avSaving}
                className="flex-1 h-14 rounded-xl bg-[var(--primary-color)] text-white font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {avSaving ? <><Loader2 size={18} className="animate-spin" /> Adding</> : 'Add to Count'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
