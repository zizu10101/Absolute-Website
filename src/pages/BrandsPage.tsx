import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface BrandWithCount {
  name: string;
  productCount: number;
}

export function BrandsPage() {
  const [brands, setBrands] = useState<BrandWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('brand')
          .not('brand', 'is', null)
          .eq('is_online', true);

        if (!error && data) {
          const brandMap = new Map<string, number>();
          data.forEach(p => {
            if (p.brand) {
              brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + 1);
            }
          });

          const brandList = Array.from(brandMap.entries())
            .map(([name, count]) => ({ name, productCount: count }))
            .sort((a, b) => a.name.localeCompare(b.name));

          setBrands(brandList);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrands();
  }, []);

  // Get unique first letters
  const letters = useMemo(() => {
    const set = new Set(brands.map(b => b.name.charAt(0).toUpperCase()));
    return Array.from(set).sort();
  }, [brands]);

  // Filter brands by selected letter
  const filteredBrands = useMemo(() => {
    if (!selectedLetter) return brands;
    return brands.filter(b => b.name.charAt(0).toUpperCase() === selectedLetter);
  }, [brands, selectedLetter]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none mb-4">
          Shop by Brand
        </h1>
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">
          Browse {brands.length} brands and find your favorite soccer gear
        </p>
      </div>

      {/* Alphabet Filter */}
      {letters.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em]">
              Filter by Letter
            </h3>
            <div className="h-px bg-zinc-100 flex-1" />
          </div>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              <motion.button
                key="all"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSelectedLetter(null)}
                className={`w-10 h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center ${
                  selectedLetter === null
                    ? 'bg-[#b90014] text-white shadow-lg'
                    : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[#b90014] hover:text-[#b90014]'
                }`}
              >
                All
              </motion.button>
              {letters.map((letter) => (
                <motion.button
                  key={letter}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                  className={`w-10 h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center ${
                    selectedLetter === letter
                      ? 'bg-[#b90014] text-white shadow-lg'
                      : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[#b90014] hover:text-[#b90014]'
                  }`}
                >
                  {letter}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Brands Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Loading brands...</div>
        </div>
      ) : filteredBrands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredBrands.map((brand) => (
              <motion.div
                key={brand.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Link
                  to={`/brand/${brand.name.toLowerCase()}`}
                  className="group block p-6 bg-white border border-zinc-200 rounded-xl hover:shadow-lg transition-all hover:border-[#b90014]"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-headline font-black uppercase text-zinc-900 group-hover:text-[#b90014] transition-colors">
                      {brand.name}
                    </h3>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      {brand.productCount} {brand.productCount === 1 ? 'Product' : 'Products'}
                    </p>
                    <div className="pt-2 border-t border-zinc-100">
                      <p className="text-[10px] font-bold text-[#b90014] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                        Shop {brand.name} →
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-50 rounded-xl">
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mb-2">No brands found</p>
          <p className="text-zinc-500 text-sm">Try adjusting your filter.</p>
        </div>
      )}
    </div>
  );
}
