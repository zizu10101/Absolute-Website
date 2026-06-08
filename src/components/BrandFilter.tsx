import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BrandFilterProps {
  category?: string;
  selectedBrand?: string;
  onBrandSelect: (brand: string | null) => void;
  isLoading?: boolean;
}

export function BrandFilter({ category, selectedBrand, onBrandSelect, isLoading }: BrandFilterProps) {
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      setIsLoadingBrands(true);
      try {
        let query = supabase
          .from('products')
          .select('brand', { count: 'exact' })
          .not('brand', 'is', null)
          .eq('is_online', true);

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (!error && data) {
          // Get unique brands and sort
          const uniqueBrands = [...new Set(data.map(p => p.brand).filter(Boolean))]
            .sort((a, b) => (a || '').localeCompare(b || ''));
          setBrands(uniqueBrands);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      } finally {
        setIsLoadingBrands(false);
      }
    };

    fetchBrands();
  }, [category]);

  if (isLoadingBrands || brands.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-[0.3em]">
          Filter by Brand
        </h3>
        <div className="h-px bg-zinc-100 flex-1" />
      </div>

      <div className="flex flex-wrap gap-3">
        <AnimatePresence mode="popLayout">
          {brands.map((brand) => (
            <motion.button
              key={brand}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => onBrandSelect(selectedBrand === brand ? null : brand)}
              className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${
                selectedBrand === brand
                  ? 'bg-[#b90014] text-white shadow-lg'
                  : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[#b90014] hover:text-[#b90014]'
              }`}
            >
              {brand}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {selectedBrand && (
        <div className="mt-4 flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          <span>Showing products from {selectedBrand}</span>
          <button
            onClick={() => onBrandSelect(null)}
            className="ml-2 p-1 hover:bg-zinc-100 rounded transition-colors"
            title="Clear filter"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
