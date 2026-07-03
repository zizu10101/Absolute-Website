import { useParams } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useSettings } from '../context/SettingsContext';
import { ProductCard } from '../components/ProductCard';
import { BrandFilter } from '../components/BrandFilter';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown } from 'lucide-react';

const ITEMS_PER_PAGE = 4;

export function BrandPage() {
  const { brandName } = useParams<{ brandName: string }>();
  const { products, isLoading, fetchProductsByCategory } = useProducts();
  const { navigationMenus } = useSettings();

  // On direct navigation, context may only have featured products (8).
  // Fetch all products so the brand filter has the full catalogue.
  useEffect(() => {
    fetchProductsByCategory();
  }, [brandName]);

  const [localSearch, setLocalSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Decode brand name from URL (e.g., "nike" -> "Nike")
  const displayBrand = useMemo(() => {
    if (!brandName) return '';
    return brandName.charAt(0).toUpperCase() + brandName.slice(1);
  }, [brandName]);

  // Get all categories available for this brand
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    products
      .filter(p => p.brand?.toLowerCase() === brandName?.toLowerCase() && p.is_online)
      .forEach(p => {
        if (p.category) {
          categories.add(p.category);
        }
      });
    return Array.from(categories).sort();
  }, [products, brandName]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by brand
    filtered = filtered.filter(
      p => p.brand?.toLowerCase() === brandName?.toLowerCase() && p.is_online
    );

    // Filter by category if selected
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search term
    const searchTerm = localSearch.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(searchTerm) ||
        (p.category || '').toLowerCase().includes(searchTerm) ||
        (p.description || '').toLowerCase().includes(searchTerm)
      );
    }

    // Sorting
    if (sortBy === 'newest') {
      filtered.reverse();
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    }

    return filtered;
  }, [products, brandName, selectedCategory, localSearch, sortBy]);

  const paginatedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none">
            {displayBrand}
          </h1>
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">
            {`Showing ${Math.min(visibleCount, filteredProducts.length)} of ${filteredProducts.length} Products`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Search Input */}
          <div className="relative group min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#b90014] transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#b90014] focus:border-transparent outline-none transition-all font-medium text-sm"
            />
          </div>

          {/* Sort Dropdown */}
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
        </div>
      </div>

      {/* Category Filter */}
      {availableCategories.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em]">
              Filter by Category
            </h3>
            <div className="h-px bg-zinc-100 flex-1" />
          </div>

          <div className="flex flex-wrap gap-3">
            <AnimatePresence mode="popLayout">
              <motion.button
                key="all"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${
                  selectedCategory === null
                    ? 'bg-[#b90014] text-white shadow-lg'
                    : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[#b90014] hover:text-[#b90014]'
                }`}
              >
                All
              </motion.button>
              {availableCategories.map((category) => (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${
                    selectedCategory === category
                      ? 'bg-[#b90014] text-white shadow-lg'
                      : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[#b90014] hover:text-[#b90014]'
                  }`}
                >
                  {category}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-12">
            <AnimatePresence mode="popLayout">
              {paginatedProducts.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-8 py-4 bg-white border border-zinc-200 text-zinc-900 font-bold uppercase tracking-widest text-xs hover:border-[#b90014] hover:text-[#b90014] transition-all rounded-lg"
              >
                Load More
              </button>
            </div>
          )}
        </>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-[#b90014] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Loading products...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-50 rounded-xl">
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mb-2">No products found</p>
          <p className="text-zinc-500 text-sm">Try adjusting your filters or search term.</p>
        </div>
      )}
    </div>
  );
}
