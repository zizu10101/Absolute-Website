import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const CATEGORIES = [
  { key: 'cleats', label: 'Cleats', emoji: '⚽', path: '/category/footwear' },
  { key: 'jerseys', label: 'Jerseys', emoji: '👕', path: '/category/national-teams' },
  { key: 'gloves', label: 'Gloves', emoji: '🥊', path: '/category/equipment?type=goalkeeper' },
  { key: 'balls', label: 'Balls', emoji: '⚽', path: '/category/equipment?type=balls' },
  { key: 'training', label: 'Training', emoji: '💪', path: '/category/training-apparel' },
  { key: 'accessories', label: 'Accessories', emoji: '🎽', path: '/category/accessories' },
];

export function CategoryQuickLinks() {
  const { categoryImages } = useSettings();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">SHOP BY CATEGORY</h2>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Find exactly what you need</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {CATEGORIES.map((cat, idx) => {
          const catData = categoryImages[cat.key];
          const imgUrl = catData?.image;
          const linkTo = catData?.link || cat.path;
          const displayTitle = catData?.title || cat.label;
          return (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              viewport={{ once: true }}
            >
              <Link
                to={linkTo}
                className="group relative flex flex-col items-center justify-center gap-2 border border-zinc-100 hover:border-[var(--primary-color)] hover:shadow-md transition-all duration-200 rounded-sm aspect-square overflow-hidden"
              >
                {imgUrl ? (
                  <>
                    <img
                      src={imgUrl}
                      alt={displayTitle}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 z-10 p-2 sm:p-3 flex items-center justify-between gap-1">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-white leading-tight">
                        {displayTitle}
                      </span>
                      <ArrowRight className="text-white shrink-0" size={14} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 w-full h-full p-4 bg-white">
                    <span className="text-2xl sm:text-3xl leading-none" role="img" aria-label={displayTitle}>
                      {cat.emoji}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-[var(--primary-color)] transition-colors text-center leading-tight">
                      {displayTitle}
                    </span>
                  </div>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
