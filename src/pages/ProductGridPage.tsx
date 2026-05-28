import { useProducts } from '../context/ProductContext';
import { useSettings } from '../context/SettingsContext';
import { Search, ChevronDown } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  title: string;
  category?: string;
  submenu?: string;
}

const ITEMS_PER_PAGE = 4;

export function ProductGridPage({ title, category, submenu }: Props) {
  const { products, fetchProductsByCategory, isLoading } = useProducts();
  const { navigationMenus } = useSettings();
  
  useEffect(() => {
    fetchProductsByCategory(category, submenu);
  }, [category, submenu]);
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  
  const [localSearch, setLocalSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  // Sync local search with URL query if on search page
  useEffect(() => {
    if (urlQuery) setLocalSearch(urlQuery);
  }, [urlQuery]);

  const filteredProducts = useMemo(() => {
    // Only show products that are available in the online store (is_online === true)
    let filtered = products.filter(p => p.is_online === true);
    
    const isSalePage = title.toLowerCase() === 'sale' || submenu?.toLowerCase() === 'sale';
    const isNewArrivalsPage = title.toLowerCase() === 'new arrivals' || submenu?.toLowerCase() === 'new arrivals';
    const isClubsPage = category?.toLowerCase() === 'clubs' || title.toLowerCase() === 'clubs';

    // 1. Handle Special Collection Filtering (Sale / New Arrivals)
    if (isSalePage) {
      filtered = filtered.filter(p => p.isOnSale);
    } else if (isNewArrivalsPage) {
      filtered = filtered.filter(p => p.isNewArrival);
    }

    // 2. Handle Category Filtering
    if (category && category.toLowerCase() !== 'sale' && category.toLowerCase() !== 'new arrivals' && !urlQuery) {
      const targetCat = category.trim().toLowerCase();
      filtered = filtered.filter(p => 
        (p.category || '').trim().toLowerCase() === targetCat
      );
    }

    // 3. Strict Clubs Rule
    // Only filter out Clubs if we are NOT on a Clubs-specific page, Sale page, New Arrivals page, OR a Search page
    if (!isClubsPage && !isSalePage && !isNewArrivalsPage && !urlQuery) {
      filtered = filtered.filter(p => (p.category || '').toLowerCase() !== 'clubs');
    }
    
    // 4. Handle Submenu Filtering
    if (submenu && !isSalePage && !isNewArrivalsPage && submenu.toLowerCase() !== 'all footwear') {
      const normalize = (s: string) => s.trim().toLowerCase().replace(/-/g, ' ');
      const target = normalize(submenu);
      
      filtered = filtered.filter(p => {
        const hasLegacyMatch = p.submenu && normalize(p.submenu) === target;
        const hasArrayMatch = p.submenus?.some(s => normalize(s) === target);
        return hasLegacyMatch || hasArrayMatch;
      });
    }

    // 5. Handle Search Filtering
    const searchTerm = localSearch.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(searchTerm) || 
        (p.category || '').toLowerCase().includes(searchTerm) ||
        (p.description || '').toLowerCase().includes(searchTerm) ||
        p.submenu?.toLowerCase().includes(searchTerm) ||
        p.submenus?.some(s => s.toLowerCase().includes(searchTerm))
      );
    }

    // 6. Sorting
    if (sortBy === 'newest') {
      filtered.reverse(); // Assuming original order is chronological
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    }
    
    return filtered;
  }, [products, title, category, submenu, localSearch, sortBy]);

  const paginatedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  // Find submenus for the current category to show the logo grid
  const currentMenu = useMemo(() => {
    const target = (category || title || '').toLowerCase().trim();
    return navigationMenus.find(m => m.label.toLowerCase().trim() === target);
  }, [navigationMenus, category, title]);

  const groupedSubmenuItems = useMemo(() => {
    if (!currentMenu) return [];
    
    if (submenu) {
      // We are in a specific submenu (e.g., "LIGA"), show logos for its items
      const targetSub = currentMenu.submenus.find(s => s.heading.toLowerCase().trim() === submenu.toLowerCase().trim());
      if (targetSub) {
        const items = targetSub.items
          .filter(item => item.logo)
          .map(item => ({ label: item.label, path: item.path, logo: item.logo! }));
        
        if (items.length > 0) {
          return [{ heading: targetSub.heading, items }];
        }
      }
    } else {
      // We are in a main category (e.g., "Footwear"), group by submenu heading
      return currentMenu.submenus.map(sub => {
        const items: { label: string; path: string; logo: string }[] = [];
        
        // Add column heading if it has a logo
        if (sub.logo && sub.path) {
          items.push({ label: sub.heading, path: sub.path, logo: sub.logo });
        }
        
        // Add items if they have logos
        sub.items.forEach(item => {
          if (item.logo) {
            items.push({ label: item.label, path: item.path, logo: item.logo });
          }
        });
        
        return { heading: sub.heading, items };
      }).filter(group => group.items.length > 0);
    }
    
    return [];
  }, [currentMenu, submenu]);

  const [showAllProducts, setShowAllProducts] = useState(false);

  // Reset showAllProducts when category/submenu changes
  useEffect(() => {
    setShowAllProducts(false);
  }, [category, submenu]);

  const shouldShowGrid = useMemo(() => {
    // Always show if searching
    if (localSearch || urlQuery) return true;
    // Always show if we are in a specific submenu
    if (submenu) return true;
    // Always show if the user explicitly requested it
    if (showAllProducts) return true;
    // Always show if there are no submenus to pick from
    if (groupedSubmenuItems.length === 0) return true;
    
    return false;
  }, [localSearch, urlQuery, submenu, showAllProducts, groupedSubmenuItems]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none">
            {urlQuery ? `Results for "${urlQuery}"` : title}
          </h1>
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">
            {shouldShowGrid 
              ? `Showing ${Math.min(visibleCount, filteredProducts.length)} of ${filteredProducts.length} Products`
              : `${groupedSubmenuItems.reduce((acc, g) => acc + g.items.length, 0)} Categories Available`
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Search Input */}
          <div className="relative group min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#b90014] transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search in this category..." 
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setVisibleCount(ITEMS_PER_PAGE); // Reset pagination on search
              }}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#b90014] focus:border-transparent outline-none transition-all font-medium text-sm"
            />
          </div>

          {/* Sort Dropdown */}
          {shouldShowGrid && (
            <div className="relative group">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#b90014] outline-none cursor-pointer font-bold uppercase tracking-widest text-[10px] transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
            </div>
          )}
        </div>
      </div>
      
      {/* Submenu Logo Grid - Grouped by Category */}
      {groupedSubmenuItems.length > 0 && !urlQuery && (
        <div className="mb-24 space-y-16">
          {groupedSubmenuItems.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-8">
              <div className="flex items-center gap-4">
                <h2 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em] whitespace-nowrap">
                  {group.heading}
                </h2>
                <div className="h-px bg-zinc-100 flex-1" />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                {group.items.map((item, idx) => (
                  <motion.div
                    key={item.path + idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Link 
                      to={item.path}
                      className="group block bg-white border border-zinc-100 rounded-2xl p-4 text-center transition-all hover:border-[#b90014] hover:shadow-xl hover:shadow-red-900/5 hover:-translate-y-1"
                    >
                      <div className="aspect-square mb-3 flex items-center justify-center relative overflow-hidden">
                        <img 
                          src={item.logo} 
                          alt={item.label}
                          className="max-w-[85%] max-h-[85%] object-contain transition-all duration-500 grayscale group-hover:grayscale-0 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h3 className="text-[9px] font-black uppercase tracking-tight text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        {item.label}
                      </h3>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
          
          {!shouldShowGrid && (
            <div className="mt-24 text-center">
              <button 
                onClick={() => setShowAllProducts(true)}
                className="px-10 py-4 border-2 border-zinc-900 text-zinc-900 font-headline font-black uppercase italic tracking-widest hover:bg-zinc-900 hover:text-white transition-all rounded-xl"
              >
                View All {title} Products
              </button>
            </div>
          )}

          {shouldShowGrid && (
            <div className="mt-16 flex items-center gap-4">
              <div className="h-px flex-1 bg-zinc-100" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">
                All {title} Products
              </h2>
              <div className="h-px flex-1 bg-zinc-100" />
            </div>
          )}
        </div>
      )}

      {shouldShowGrid && (
        <>
          {isLoading && paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-10 h-10 border-4 border-zinc-200 border-t-[#b90014] rounded-full animate-spin mb-4" />
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
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-32 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <div className="max-w-xs mx-auto space-y-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                  <Search className="text-zinc-300" size={32} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">No products found</h3>
                <p className="text-zinc-500 text-sm">Try adjusting your search or filters to find what you're looking for.</p>
                <button 
                  onClick={() => setLocalSearch('')}
                  className="text-[#b90014] font-bold uppercase tracking-widest text-[10px] hover:underline"
                >
                  Clear Search
                </button>
              </div>
            </div>
          )}

          {hasMore && (
            <div className="mt-20 text-center">
              <button 
                onClick={handleLoadMore}
                className="px-12 py-5 bg-zinc-900 text-white rounded-2xl font-headline font-black uppercase italic tracking-widest hover:bg-[#b90014] transition-all shadow-xl shadow-zinc-900/10 hover:shadow-red-900/20 active:scale-95"
              >
                Load More Products
              </button>
              <p className="mt-4 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                Showing {visibleCount} of {filteredProducts.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
