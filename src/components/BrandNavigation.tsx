import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onNavigate?: () => void;
}

export function BrandNavigation({ onNavigate }: Props) {
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('brand')
          .not('brand', 'is', null)
          .eq('is_online', true);

        if (!error && data) {
          const uniqueBrands = [...new Set(data.map(p => p.brand).filter(Boolean))]
            .sort((a, b) => (a || '').localeCompare(b || '')) as string[];
          setBrands(uniqueBrands);
        }
      } catch (err) {
        console.error('Error fetching brands for navigation:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrands();
  }, []);

  if (isLoading || brands.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pr-4">
        <Link
          to="/brands"
          onClick={onNavigate}
          className="flex-1 flex items-center gap-4 px-4 py-3 text-zinc-900 hover:bg-zinc-50 transition-colors font-headline uppercase font-black text-base border-l-4 border-transparent hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
        >
          Shop by Brand
        </Link>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-zinc-400 hover:text-[var(--primary-color)]"
          aria-label={isExpanded ? 'Collapse Shop by Brand menu' : 'Expand Shop by Brand menu'}
        >
          <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-zinc-50/50"
          >
            <div className="px-4 py-2 space-y-1">
              {brands.map((brand) => (
                <Link
                  key={brand}
                  to={`/brand/${brand.toLowerCase()}`}
                  onClick={onNavigate}
                  className="flex items-center justify-between px-8 py-2.5 text-xs font-bold text-zinc-600 uppercase tracking-widest hover:text-[var(--primary-color)] transition-colors"
                >
                  <span>{brand}</span>
                  <ChevronRight size={14} />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
