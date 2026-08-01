import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { motion } from 'motion/react';
import { useSettings } from '../context/SettingsContext';

const BRANDS = [
  {
    name: 'Nike',
    label: 'NIKE FUTBOL',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800',
    featured: true,
  },
  {
    name: 'Adidas',
    label: 'ADIDAS FUTBOL',
    image: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?auto=format&fit=crop&q=80&w=800',
    featured: true,
  },
  {
    name: 'Puma',
    label: 'PUMA FUTBOL',
    image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&q=80&w=800',
    featured: false,
  },
  {
    name: 'Joma',
    label: 'JOMA',
    image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&q=80&w=800',
    featured: false,
  },
  {
    name: 'New Balance',
    label: 'NEW BALANCE',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800',
    featured: false,
  },
];

export function BrandBanners() {
  const { brandImages } = useSettings();
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase
        .from('products')
        .select('brand')
        .eq('is_online', true)
        .not('brand', 'is', null);
      if (data) {
        const counts = data.reduce((acc: Record<string, number>, p: any) => {
          if (p.brand) acc[p.brand] = (acc[p.brand] || 0) + 1;
          return acc;
        }, {});
        setBrandCounts(counts);
      }
    };
    fetchCounts();
  }, []);

  const featured = BRANDS.filter(b => b.featured);
  const rest = BRANDS.filter(b => !b.featured);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">SHOP BY BRAND</h2>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Top football brands — all in one place</p>
        </div>
        <Link
          to="/brands"
          className="text-zinc-900 font-bold uppercase tracking-widest text-[10px] hover:text-[var(--primary-color)] transition-colors border-b-2 border-zinc-900 hover:border-[var(--primary-color)] pb-1"
        >
          View All Brands
        </Link>
      </div>

      {/* Row 1: Nike + Adidas — featured, taller */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {featured.map((brand, idx) => (
          <BrandCard key={brand.name} brand={{ ...brand, image: brandImages[brand.name]?.image || brand.image, label: brandImages[brand.name]?.title || brand.label }} count={brandCounts[brand.name] ?? 0} tall idx={idx} />
        ))}
      </div>

      {/* Row 2: Puma + Joma + New Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {rest.map((brand, idx) => (
          <BrandCard key={brand.name} brand={{ ...brand, image: brandImages[brand.name]?.image || brand.image, label: brandImages[brand.name]?.title || brand.label }} count={brandCounts[brand.name] ?? 0} tall={false} idx={idx + 2} />
        ))}
      </div>
    </section>
  );
}

interface BrandCardProps {
  brand: typeof BRANDS[0];
  count: number;
  tall: boolean;
  idx: number;
}

function BrandCard({ brand, count, tall, idx }: BrandCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07 }}
      viewport={{ once: true }}
      className={`relative overflow-hidden bg-zinc-900 group ${tall ? 'aspect-[4/3]' : 'aspect-[3/2]'}`}
    >
      <Link to={`/brand/${encodeURIComponent(brand.name)}`} className="block w-full h-full">
        {/* Background image with zoom on hover */}
        <img
          src={brand.image}
          alt={brand.label}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
          <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-1">
            {count > 0 ? `${count} Products` : 'Browse Collection'}
          </p>
          <h3 className="text-white font-black font-headline uppercase italic tracking-tight text-3xl sm:text-4xl leading-none mb-4">
            {brand.label}
          </h3>
          <span className="inline-flex items-center gap-2 bg-[var(--primary-color)] text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 self-start transition-all duration-300 group-hover:bg-white group-hover:text-zinc-950">
            Shop {brand.name} &rarr;
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
