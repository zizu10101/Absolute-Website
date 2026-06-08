import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { motion } from 'motion/react';

interface Brand {
  name: string;
  count: number;
}

export function BrandShowcase() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('brand')
          .eq('is_online', true)
          .not('brand', 'is', null);

        if (!error && data) {
          // Count products per brand
          const brandCounts = data.reduce((acc: Record<string, number>, p: any) => {
            if (p.brand) {
              acc[p.brand] = (acc[p.brand] || 0) + 1;
            }
            return acc;
          }, {});

          // Convert to array and sort by name
          const brandList = Object.entries(brandCounts)
            .map(([name, count]) => ({ name, count: count as number }))
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

  if (isLoading || brands.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-8 py-20">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">
            SHOP BY BRAND
          </h2>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">
            {brands.length} Premium Brands Available
          </p>
        </div>
        <Link
          to="/brands"
          className="text-zinc-900 font-bold uppercase tracking-widest text-[10px] hover:text-[#b90014] transition-colors border-b-2 border-zinc-900 hover:border-[#b90014] pb-1"
        >
          View All Brands
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {brands.map((brand, idx) => (
          <motion.div
            key={brand.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            viewport={{ once: true }}
          >
            <Link
              to={`/products?brand=${encodeURIComponent(brand.name)}`}
              className="group block bg-white border border-zinc-100 rounded-lg p-4 text-center transition-all hover:border-[#b90014] hover:shadow-lg hover:shadow-red-900/5 hover:-translate-y-1 h-full flex flex-col items-center justify-center"
            >
              <h3 className="text-sm font-bold uppercase tracking-tight text-zinc-900 group-hover:text-[#b90014] transition-colors mb-2">
                {brand.name}
              </h3>
              <p className="text-[10px] text-zinc-400 group-hover:text-zinc-600 transition-colors">
                {brand.count} {brand.count === 1 ? 'Product' : 'Products'}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
