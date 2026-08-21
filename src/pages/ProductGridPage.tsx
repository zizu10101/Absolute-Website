import { useProducts } from '../context/ProductContext';
import { useSettings } from '../context/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

interface Props {
  title: string;
  category?: string;
  submenu?: string;
}

type SortOption = 'newest' | 'price-low' | 'price-high' | 'sale-first';
type PriceRange = 'all' | 'under-50' | '50-100' | '100-150' | 'over-150';

const ITEMS_PER_PAGE = 4;

const PRICE_RANGES: { value: PriceRange; label: string }[] = [
  { value: 'all', label: 'All Prices' },
  { value: 'under-50', label: 'Under $50' },
  { value: '50-100', label: '$50–$100' },
  { value: '100-150', label: '$100–$150' },
  { value: 'over-150', label: 'Over $150' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'sale-first', label: 'On Sale First' },
];

function FilterSectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em] whitespace-nowrap">{label}</h3>
      <div className="h-px bg-zinc-100 flex-1" />
    </div>
  );
}

export function ProductGridPage({ title, category, submenu }: Props) {
  const { products, fetchProductsByCategory, isLoading } = useProducts();
  const { navigationMenus } = useSettings();

  useEffect(() => {
    fetchProductsByCategory(category, submenu);
  }, [category, submenu]);

  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const region = searchParams.get('region') || '';

  // Filter + sort state â€” lazy initializers read URL params synchronously on first render
  const [localSearch, setLocalSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const s = searchParams.get('sort');
    return (SORT_OPTIONS.some(o => o.value === s) ? s : 'newest') as SortOption;
  });
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => {
    const b = searchParams.get('brand');
    return b ? b.split(',') : [];
  });
  const [priceRange, setPriceRange] = useState<PriceRange>(() => {
    const p = searchParams.get('price');
    return (PRICE_RANGES.some(r => r.value === p) ? p : 'all') as PriceRange;
  });
  const [onSaleOnly, setOnSaleOnly] = useState(() => searchParams.get('sale') === 'true');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const s = searchParams.get('size');
    return s ? s.split(',') : [];
  });
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Data for filter option lists
  const [brands, setBrands] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [sizeToProductIds, setSizeToProductIds] = useState<Map<string, string[]>>(new Map());
  const [soldOutProductIds, setSoldOutProductIds] = useState<Set<string>>(new Set());

  // Sync local search with URL query on search page
  useEffect(() => {
    if (urlQuery) setLocalSearch(urlQuery);
  }, [urlQuery]);

  // Sync filters to URL without triggering React re-render cycle
  const filterSyncReady = useRef(false);
  useEffect(() => {
    if (!filterSyncReady.current) {
      filterSyncReady.current = true;
      return;
    }
    const params = new URLSearchParams(window.location.search);

    if (selectedBrands.length > 0) params.set('brand', selectedBrands.join(','));
    else params.delete('brand');

    if (sortBy !== 'newest') params.set('sort', sortBy);
    else params.delete('sort');

    if (priceRange !== 'all') params.set('price', priceRange);
    else params.delete('price');

    if (selectedSizes.length > 0) params.set('size', selectedSizes.join(','));
    else params.delete('size');

    if (onSaleOnly) params.set('sale', 'true');
    else params.delete('sale');

    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [selectedBrands, sortBy, priceRange, selectedSizes, onSaleOnly]);

  // Reset pagination when region changes
  const prevRegionRef = useRef(region);
  useEffect(() => {
    if (prevRegionRef.current === region) return;
    prevRegionRef.current = region;
    setVisibleCount(ITEMS_PER_PAGE);
  }, [region]);

  // Reset all filters only when category/submenu actually changes (not on initial mount or StrictMode re-run)
  const prevCategoryRef = useRef({ category, submenu });
  useEffect(() => {
    const prev = prevCategoryRef.current;
    prevCategoryRef.current = { category, submenu };
    if (prev.category === category && prev.submenu === submenu) return;
    setShowAllProducts(false);
    setSelectedBrands([]);
    setPriceRange('all');
    setOnSaleOnly(false);
    setSelectedSizes([]);
    setVisibleCount(ITEMS_PER_PAGE);
  }, [category, submenu]);

  // Fetch unique brands for the current category
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        let query = supabase
          .from('products')
          .select('brand')
          .not('brand', 'is', null)
          .eq('is_online', true);

        if (category && !['sale', 'new arrivals'].includes(category.toLowerCase())) {
          query = query.eq('category', category);
        }

        const { data } = await query;
        if (data) {
          const unique = [...new Set(data.map((p: any) => p.brand).filter(Boolean))]
            .sort((a: string, b: string) => a.localeCompare(b));
          setBrands(unique as string[]);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    };

    fetchBrands();
  }, [category]);

  // Fetch available footwear sizes with stock > 0
  useEffect(() => {
    if (category?.toLowerCase() !== 'footwear') {
      setAvailableSizes([]);
      setSizeToProductIds(new Map());
      return;
    }
    if (isLoading || products.length === 0) return;

    const footwearIds = products
      .filter(p => (p.category || '').toLowerCase() === 'footwear' && p.is_online !== false)
      .map(p => p.id);

    if (footwearIds.length === 0) return;

    const fetchSizes = async () => {
      const sizeMap = new Map<string, string[]>();
      const CHUNK = 200;

      for (let i = 0; i < footwearIds.length; i += CHUNK) {
        const chunk = footwearIds.slice(i, i + CHUNK);
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data } = await supabase
            .from('product_variants')
            .select('size, product_id')
            .in('product_id', chunk)
            .gt('stock_quantity', 0)
            .range(from, from + 999);

          if (!data || data.length === 0) { hasMore = false; break; }

          for (const { size, product_id } of data) {
            if (!size) continue;
            if (!sizeMap.has(size)) sizeMap.set(size, []);
            sizeMap.get(size)!.push(product_id);
          }

          hasMore = data.length === 1000;
          from += 1000;
        }
      }

      const sizeOrder = [
        '8K', '9K', '10K', '11K', '12K', '13K',
        '1Y', '1.5Y', '2Y', '2.5Y', '3Y', '3.5Y',
        '4Y', '4.5Y', '5Y', '5.5Y', '6Y', '6.5Y', '7Y',
        '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5',
        '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '15',
        'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL',
        'YXS', 'YS', 'YM', 'YL', 'YXL',
      ];
      const sorted = [...sizeMap.keys()].sort((a, b) => {
        const ia = sizeOrder.indexOf(a), ib = sizeOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });

      setAvailableSizes(sorted);
      setSizeToProductIds(sizeMap);
    };

    fetchSizes();
  }, [category, products.length, isLoading]);

  // Fetch which show_sizes products have zero stock
  useEffect(() => {
    if (isLoading || products.length === 0) return;

    const showSizesIds = products
      .filter(p => p.showSizes && p.is_online !== false)
      .map(p => p.id);

    if (showSizesIds.length === 0) {
      setSoldOutProductIds(new Set());
      return;
    }

    const fetchSoldOut = async () => {
      const inStockIds = new Set<string>();
      const CHUNK = 200;

      for (let i = 0; i < showSizesIds.length; i += CHUNK) {
        const chunk = showSizesIds.slice(i, i + CHUNK);
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data } = await supabase
            .from('product_variants')
            .select('product_id')
            .in('product_id', chunk)
            .gt('stock_quantity', 0)
            .range(from, from + 999);

          if (!data || data.length === 0) { hasMore = false; break; }
          for (const { product_id } of data) inStockIds.add(product_id);
          hasMore = data.length === 1000;
          from += 1000;
        }
      }

      setSoldOutProductIds(new Set(showSizesIds.filter(id => !inStockIds.has(id))));
    };

    fetchSoldOut();
  }, [products.length, isLoading]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    filtered = filtered.filter(p => p.is_online !== false);

    const isSalePage = title.toLowerCase() === 'sale' || submenu?.toLowerCase() === 'sale';
    const isNewArrivalsPage = title.toLowerCase() === 'new arrivals' || submenu?.toLowerCase() === 'new arrivals';
    const isClubsPage = category?.toLowerCase() === 'clubs' || title.toLowerCase() === 'clubs';

    if (isSalePage) {
      filtered = filtered.filter(p => p.isOnSale);
    } else if (isNewArrivalsPage) {
      filtered = filtered.filter(p => p.isNewArrival);
    }

    if (category && category.toLowerCase() !== 'sale' && category.toLowerCase() !== 'new arrivals' && !urlQuery) {
      const targetCat = category.trim().toLowerCase();
      filtered = filtered.filter(p => (p.category || '').trim().toLowerCase() === targetCat);
    }

    if (!isClubsPage && !isSalePage && !isNewArrivalsPage && !urlQuery) {
      filtered = filtered.filter(p => (p.category || '').toLowerCase() !== 'clubs');
    }

    if (submenu && !isSalePage && !isNewArrivalsPage && submenu.toLowerCase() !== 'all footwear') {
      const normalize = (s: string) => s.trim().toLowerCase().replace(/-/g, ' ');
      const target = normalize(submenu);
      filtered = filtered.filter(p => {
        const hasLegacyMatch = p.submenu && normalize(p.submenu) === target;
        const hasArrayMatch = p.submenus?.some(s => normalize(s) === target);
        return hasLegacyMatch || hasArrayMatch;
      });
    }

    // Region filter â€” e.g. /category/national-teams?region=europe
    if (region) {
      const norm = (s: string) => s.trim().toLowerCase().replace(/-/g, ' ');
      const regionNorm = norm(region);
      const catMenu = navigationMenus.find(m => norm(m.label) === norm(category || title || ''));
      const matchingSub = catMenu?.submenus.find(s => norm(s.heading) === regionNorm);
      if (matchingSub) {
        const teamNames = new Set(matchingSub.items.map(item => norm(item.label)));
        filtered = filtered.filter(p => {
          const legacyMatch = p.submenu && teamNames.has(norm(p.submenu));
          const arrayMatch = p.submenus?.some(s => teamNames.has(norm(s)));
          return legacyMatch || arrayMatch;
        });
      }
    }

    const searchTerm = localSearch.toLowerCase().trim();
    if (searchTerm) {
      // Strip hyphens from BOTH query and all text fields so "IB5300480" finds "IB5300-480"
      // and vice versa. Codes appear in description ("Style: IB5300-480") not just product_code.
      const searchTermNoHyphens = searchTerm.replace(/-/g, '');
      filtered = filtered.filter(p => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const code = (p.product_code || '').toLowerCase();
        return (
          name.includes(searchTerm) ||
          name.replace(/-/g, '').includes(searchTermNoHyphens) ||
          (p.category || '').toLowerCase().includes(searchTerm) ||
          desc.includes(searchTerm) ||
          desc.replace(/-/g, '').includes(searchTermNoHyphens) ||
          code.includes(searchTerm) ||
          code.replace(/-/g, '').includes(searchTermNoHyphens) ||
          (p.colors || []).some((c: any) => (c.product_code || '').toLowerCase().includes(searchTerm)) ||
          (p.brand || '').toLowerCase().includes(searchTerm) ||
          p.submenu?.toLowerCase().includes(searchTerm) ||
          p.submenus?.some(s => s.toLowerCase().includes(searchTerm))
        );
      });
    }

    // Brand filter (multi-select)
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(p => p.brand && selectedBrands.includes(p.brand));
    }

    // Price range filter
    if (priceRange !== 'all') {
      filtered = filtered.filter(p => {
        const price = p.salePrice ?? p.price;
        if (priceRange === 'under-50') return price < 50;
        if (priceRange === '50-100') return price >= 50 && price <= 100;
        if (priceRange === '100-150') return price > 100 && price <= 150;
        if (priceRange === 'over-150') return price > 150;
        return true;
      });
    }

    // On sale only filter
    if (onSaleOnly) {
      filtered = filtered.filter(p => p.isOnSale && p.salePrice != null);
    }

    // Size filter
    if (selectedSizes.length > 0 && sizeToProductIds.size > 0) {
      const validIds = new Set<string>();
      selectedSizes.forEach(size => {
        (sizeToProductIds.get(size) || []).forEach(id => validIds.add(id));
      });
      filtered = filtered.filter(p => validIds.has(p.id));
    }

    // Sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    } else if (sortBy === 'sale-first') {
      filtered.sort((a, b) => {
        const aS = a.isOnSale && a.salePrice != null ? 1 : 0;
        const bS = b.isOnSale && b.salePrice != null ? 1 : 0;
        return bS - aS;
      });
    }

    return filtered;
  }, [products, title, category, submenu, region, localSearch, sortBy, selectedBrands, priceRange, onSaleOnly, selectedSizes, sizeToProductIds, urlQuery, navigationMenus]);

  // Brand product counts (excluding brand filter so user sees totals per brand in current category)
  const brandProductCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let base = [...products].filter(p => p.is_online !== false);

    const isSalePage = title.toLowerCase() === 'sale' || submenu?.toLowerCase() === 'sale';
    const isNewArrivalsPage = title.toLowerCase() === 'new arrivals' || submenu?.toLowerCase() === 'new arrivals';
    if (isSalePage) base = base.filter(p => p.isOnSale);
    else if (isNewArrivalsPage) base = base.filter(p => p.isNewArrival);

    if (category && !['sale', 'new arrivals'].includes(category.toLowerCase()) && !urlQuery) {
      const t = category.trim().toLowerCase();
      base = base.filter(p => (p.category || '').trim().toLowerCase() === t);
    }

    base.forEach(p => {
      if (p.brand) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
    });
    return counts;
  }, [products, title, category, submenu, urlQuery]);

  const paginatedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const currentMenu = useMemo(() => {
    const target = (category || title || '').toLowerCase().trim();
    return navigationMenus.find(m => m.label.toLowerCase().trim() === target);
  }, [navigationMenus, category, title]);

  // Equipment subcategory tiles (Balls, Goalkeeper, Futsal, etc.) use full-bleed dark studio
  // photos, unlike National Teams/Clubs/Footwear which use transparent crest/flag/logo PNGs
  // that need the white card background to render correctly — so only Equipment gets the
  // full-bleed treatment, everything else keeps the white logo card.
  const isEquipmentCategory = (category || title || '').toLowerCase().trim() === 'equipment';

  const groupedSubmenuItems = useMemo(() => {
    if (!currentMenu) return [];

    if (submenu) {
      const targetSub = currentMenu.submenus.find(s => s.heading.toLowerCase().trim() === submenu.toLowerCase().trim());
      if (targetSub) {
        const items = targetSub.items
          .filter(item => item.logo)
          .map(item => ({ label: item.label, path: item.path, logo: item.logo! }));
        if (items.length > 0) return [{ heading: targetSub.heading, items }];
      }
    } else {
      return currentMenu.submenus.map(sub => {
        const items: { label: string; path: string; logo: string }[] = [];
        if (sub.logo && sub.path) items.push({ label: sub.heading, path: sub.path, logo: sub.logo });
        sub.items.forEach(item => {
          if (item.logo) items.push({ label: item.label, path: item.path, logo: item.logo });
        });
        return { heading: sub.heading, items };
      }).filter(group => group.items.length > 0);
    }

    return [];
  }, [currentMenu, submenu]);

  // For equipment category, reorganize into two groups: (1) 4-column main items, (2) 3-column apparel items
  const reorganizedGroups = useMemo(() => {
    if (!isEquipmentCategory || submenu) return groupedSubmenuItems;

    const group1Labels = ["balls", "goalkeeper", "goalkeeper gloves", "bags", "futsal", "futsal balls"];
    const group2Labels = ["socks", "shinguards", "shin guards", "accessories"];

    const group1Items: { label: string; path: string; logo: string }[] = [];
    const group2Items: { label: string; path: string; logo: string }[] = [];

    groupedSubmenuItems.forEach(group => {
      group.items.forEach(item => {
        const itemLabelLower = item.label.toLowerCase();
        if (group1Labels.some(l => itemLabelLower.includes(l))) {
          group1Items.push(item);
        } else if (group2Labels.some(l => itemLabelLower.includes(l))) {
          group2Items.push(item);
        }
      });
    });

    const result: Array<{ heading: string; items: Array<{ label: string; path: string; logo: string }>; gridClass: string }> = [];
    if (group1Items.length > 0) {
      result.push({ heading: "Main Equipment", items: group1Items, gridClass: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" });
    }
    if (group2Items.length > 0) {
      result.push({ heading: "Apparel & Accessories", items: group2Items, gridClass: "grid grid-cols-2 md:grid-cols-3 gap-4" });
    }

    return result.length > 0 ? result : groupedSubmenuItems;
  }, [groupedSubmenuItems, isEquipmentCategory, submenu]);

  // When submenu matches a heading (EUROPE, LIGAâ€¦), groupedSubmenuItems has logo items â†’ show ONLY the logo grid.
  // When submenu matches an item (PORTUGAL, ARSENALâ€¦), groupedSubmenuItems is empty â†’ show product grid.
  const isHeadingLandingPage = !!submenu && groupedSubmenuItems.length > 0;

  const shouldShowGrid = useMemo(() => {
    if (localSearch || urlQuery) return true;
    if (submenu && groupedSubmenuItems.length === 0) return true;
    if (region) return true;
    if (showAllProducts) return true;
    if (groupedSubmenuItems.length === 0) return true;
    return false;
  }, [localSearch, urlQuery, submenu, region, showAllProducts, groupedSubmenuItems]);

  const handleLoadMore = () => setVisibleCount(prev => prev + ITEMS_PER_PAGE);

  const clearAllFilters = () => {
    setSelectedBrands([]);
    setPriceRange('all');
    setOnSaleOnly(false);
    setSelectedSizes([]);
    setSortBy('newest');
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const activeFilterCount =
    selectedBrands.length +
    (priceRange !== 'all' ? 1 : 0) +
    selectedSizes.length +
    (onSaleOnly ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const tagClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white';

  return (
    <>
    <Helmet>
      <title>{title} | Soccer Store Mississauga | Absolute Soccer</title>
      <meta name="description" content={`Shop our wide collection of ${title} at Absolute Soccer in Mississauga. Premium selections from Nike, Adidas, PUMA and more available online or in store.`} />
    </Helmet>
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-12">

      {/* Header + controls row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none">
            {urlQuery ? `Results for "${urlQuery}"` : title}
          </h1>
          <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">
            {shouldShowGrid
              ? `Showing ${Math.min(visibleCount, filteredProducts.length)} of ${filteredProducts.length} Products`
              : isHeadingLandingPage
                ? `${groupedSubmenuItems.reduce((acc, g) => acc + g.items.length, 0)} Teams â€” Select one to browse products`
                : `${groupedSubmenuItems.reduce((acc, g) => acc + g.items.length, 0)} Categories Available`
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative group min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[var(--primary-color)] transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search in this category..."
              value={localSearch}
              onChange={(e) => { setLocalSearch(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none transition-all font-medium text-sm"
            />
          </div>

          {/* Filters button */}
          {shouldShowGrid && (
            <button
              onClick={() => setShowSidebar(true)}
              className="flex items-center gap-2 px-4 py-3 border border-zinc-200 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-white hover:border-zinc-400 transition-all text-zinc-900"
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-[var(--primary-color)] text-white rounded-full text-[9px] flex items-center justify-center font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Local SEO description â€” Footwear and National Teams category pages only */}
      {category?.toUpperCase() === 'FOOTWEAR' && !submenu && (
        <p className="text-zinc-500 text-xs leading-relaxed mb-6">
          Shop the latest Nike, Adidas and Puma soccer cleats at Absolute Soccer in Mississauga. Serving players across Brampton, Oakville, Toronto, Etobicoke and the GTA.
        </p>
      )}
      {category?.toUpperCase() === 'NATIONAL TEAMS' && !submenu && (
        <p className="text-zinc-500 text-xs leading-relaxed mb-6">
          Official licensed national team jerseys at Absolute Soccer Mississauga. Shop Canada, Portugal, France, Argentina and more. Serving the GTA including Brampton, Oakville and Toronto.
        </p>
      )}

      {/* Active filter tags */}
      {shouldShowGrid && hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {sortBy !== 'newest' && (
            <span className={`${tagClass} bg-zinc-700`}>
              {SORT_OPTIONS.find(o => o.value === sortBy)!.label}
              <button
                onClick={() => { setSortBy('newest'); setVisibleCount(ITEMS_PER_PAGE); }}
                className="hover:opacity-70 transition-opacity"
                aria-label="Remove sort filter"
              >
                <X size={11} />
              </button>
            </span>
          )}
          {selectedBrands.map(brand => (
            <span key={brand} className={`${tagClass} bg-zinc-900`}>
              {brand}
              <button
                onClick={() => { setSelectedBrands(prev => prev.filter(b => b !== brand)); setVisibleCount(ITEMS_PER_PAGE); }}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Remove ${brand} filter`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {priceRange !== 'all' && (
            <span className={`${tagClass} bg-zinc-900`}>
              {PRICE_RANGES.find(r => r.value === priceRange)!.label}
              <button
                onClick={() => { setPriceRange('all'); setVisibleCount(ITEMS_PER_PAGE); }}
                className="hover:opacity-70 transition-opacity"
                aria-label="Remove price filter"
              >
                <X size={11} />
              </button>
            </span>
          )}
          {selectedSizes.map(size => (
            <span key={size} className={`${tagClass} bg-zinc-900`}>
              Size {size}
              <button
                onClick={() => { setSelectedSizes(prev => prev.filter(s => s !== size)); setVisibleCount(ITEMS_PER_PAGE); }}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Remove size ${size} filter`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {onSaleOnly && (
            <span className={`${tagClass} bg-[var(--primary-color)]`}>
              On Sale
              <button
                onClick={() => { setOnSaleOnly(false); setVisibleCount(ITEMS_PER_PAGE); }}
                className="hover:opacity-70 transition-opacity"
                aria-label="Remove on sale filter"
              >
                <X size={11} />
              </button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="px-3 py-1.5 text-zinc-500 hover:text-zinc-900 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Submenu logo grid */}
      {groupedSubmenuItems.length > 0 && !urlQuery && !region && (
        <div className="mb-24 space-y-16">
          {reorganizedGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-8">
              <div className="flex items-center gap-4">
                <h2 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em] whitespace-nowrap">
                  {group.heading}
                </h2>
                <div className="h-px bg-zinc-100 flex-1" />
              </div>

              <div className={(group as any).gridClass || (isEquipmentCategory
                ? 'grid grid-cols-2 md:grid-cols-4 gap-4'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6')}>
                {group.items.map((item, idx) => (
                  <motion.div
                    key={item.path + idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    {isEquipmentCategory ? (
                      <Link
                        to={item.path}
                        className="relative overflow-hidden rounded-xl group cursor-pointer"
                        style={{ aspectRatio: '16/9', maxHeight: "200px" }}
                      >
                        <img
                          src={item.logo}
                          alt={item.label}
                          className="w-full h-full object-cover md:grayscale md:group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 md:bg-black/60 md:group-hover:bg-black/20 transition-all duration-500" />
                        <div className="absolute top-0 left-0 p-3 z-10">
                          <h3 className="text-white font-black uppercase text-[10px] md:text-xs tracking-widest mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                            {item.label}
                          </h3>
                          <span className="text-white/70 text-[9px] md:text-[10px] font-medium uppercase tracking-wider">
                            Explore &rarr;
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <Link
                        to={item.path}
                        className="group block bg-white border border-zinc-100 rounded-2xl p-4 text-center transition-all hover:border-[var(--primary-color)] hover:shadow-xl hover:shadow-red-900/5 hover:-translate-y-1"
                      >
                        <div className="aspect-square mb-3 flex items-center justify-center relative overflow-hidden">
                          <img
                            src={item.logo}
                            alt={item.label}
                            className="max-w-[85%] max-h-[85%] object-contain transition-all duration-500 grayscale group-hover:grayscale-0 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <h3 className="text-[9px] font-black uppercase tracking-tight text-zinc-600 group-hover:text-zinc-900 transition-colors">
                          {item.label}
                        </h3>
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {!shouldShowGrid && !isHeadingLandingPage && (
            <div className="mt-24 text-center">
              <button
                onClick={() => setShowAllProducts(true)}
                className="px-10 py-4 border-2 border-zinc-900 text-zinc-900 font-headline font-black uppercase italic tracking-widest hover:bg-zinc-900 hover:text-white transition-all rounded-xl"
              >
                View All {title} Products
              </button>
            </div>
          )}

        </div>
      )}

      {/* Heading that precedes the product grid — hoisted out of the submenu-logo-grid
          block above so it renders whenever the grid does, even on plain category pages
          with no logo grid (otherwise the h1 page title would be followed directly by
          ProductCard's h3, skipping a level). */}
      {shouldShowGrid && (
        <div className="mt-16 flex items-center gap-4">
          <div className="h-px flex-1 bg-zinc-100" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700">
            All {title} Products
          </h2>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>
      )}

      {/* Product grid */}
      {shouldShowGrid && (
        <>
          {isLoading && paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-10 h-10 border-4 border-zinc-200 border-t-[var(--primary-color)] rounded-full animate-spin mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Loading Products...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
              <AnimatePresence mode="popLayout">
                {paginatedProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (idx % ITEMS_PER_PAGE) * 0.05 }}
                    className="h-full"
                  >
                    <ProductCard product={product} isSoldOut={soldOutProductIds.has(product.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {filteredProducts.length === 0 && !isLoading && (
            <div className="text-center py-32 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <div className="max-w-xs mx-auto space-y-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                  <Search className="text-zinc-700" size={32} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">No products found</h3>
                <p className="text-zinc-500 text-sm">Try adjusting your search or filters.</p>
                <button
                  onClick={() => { setLocalSearch(''); clearAllFilters(); }}
                  className="text-[var(--primary-color)] font-bold uppercase tracking-widest text-[10px] hover:underline"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {hasMore && (
            <div className="mt-20 text-center">
              <button
                onClick={handleLoadMore}
                className="px-12 py-5 bg-zinc-900 text-white rounded-2xl font-headline font-black uppercase italic tracking-widest hover:bg-[var(--primary-color)] transition-all shadow-xl shadow-zinc-900/10 hover:shadow-red-900/20 active:scale-95"
              >
                Load More Products
              </button>
              <p className="mt-4 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                Showing {visibleCount} of {filteredProducts.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>

    {/* Left slide-out filter sidebar */}
    <AnimatePresence>
      {showSidebar && (
        <>
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSidebar(false)}
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-0 left-0 bottom-0 z-50 bg-white w-full md:w-[280px] flex flex-col shadow-2xl"
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900">Filter & Sort</h2>
                {hasActiveFilters && (
                  <p className="text-[10px] text-[var(--primary-color)] font-bold uppercase tracking-widest mt-0.5">
                    {activeFilterCount} active
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="min-w-[48px] min-h-[48px] rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sidebar body â€” scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

              {/* Sort */}
              <div>
                <FilterSectionHeader label="Sort By" />
                <div className="space-y-3">
                  {SORT_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="sidebar-sort"
                        value={opt.value}
                        checked={sortBy === opt.value}
                        onChange={() => { setSortBy(opt.value as SortOption); setVisibleCount(ITEMS_PER_PAGE); }}
                        className="w-4 h-4 accent-[var(--primary-color)] flex-shrink-0"
                      />
                      <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        sortBy === opt.value ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-700'
                      }`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Brand */}
              {brands.length > 0 && (
                <div>
                  <FilterSectionHeader label="Brand" />
                  <div className="space-y-3">
                    {brands.map(brand => {
                      const count = brandProductCounts.get(brand) || 0;
                      return (
                        <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() => {
                              setSelectedBrands(prev =>
                                prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
                              );
                              setVisibleCount(ITEMS_PER_PAGE);
                            }}
                            className="w-4 h-4 accent-[var(--primary-color)] flex-shrink-0 rounded"
                          />
                          <span className={`flex-1 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                            selectedBrands.includes(brand) ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-700'
                          }`}>
                            {brand}
                          </span>
                          {count > 0 && (
                            <span className="text-[10px] font-bold text-zinc-600">{count}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div>
                <FilterSectionHeader label="Price Range" />
                <div className="flex flex-wrap gap-2">
                  {PRICE_RANGES.map(range => (
                    <button
                      key={range.value}
                      onClick={() => { setPriceRange(range.value); setVisibleCount(ITEMS_PER_PAGE); }}
                      className={`px-3 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${
                        priceRange === range.value
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size (footwear only) */}
              {availableSizes.length > 0 && (
                <div>
                  <FilterSectionHeader label="Size" />
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map(size => (
                      <button
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={`min-w-[44px] px-2 py-2 rounded-lg font-bold text-[11px] transition-all text-center ${
                          selectedSizes.includes(size)
                            ? 'bg-zinc-900 text-white'
                            : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* On Sale toggle */}
              <div>
                <FilterSectionHeader label="Sale" />
                <label className="flex items-center justify-between cursor-pointer">
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${
                    onSaleOnly ? 'text-zinc-900' : 'text-zinc-500'
                  }`}>
                    On Sale Only
                  </span>
                  <div
                    role="switch"
                    aria-checked={onSaleOnly}
                    onClick={() => { setOnSaleOnly(!onSaleOnly); setVisibleCount(ITEMS_PER_PAGE); }}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      onSaleOnly ? 'bg-[var(--primary-color)]' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      onSaleOnly ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </label>
              </div>

            </div>

            {/* Sidebar footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex items-center gap-4">
              <button
                onClick={clearAllFilters}
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className="flex-1 py-3.5 bg-[var(--primary-color)] text-white rounded-xl font-headline font-black uppercase italic tracking-widest hover:bg-red-800 transition-all text-sm"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
