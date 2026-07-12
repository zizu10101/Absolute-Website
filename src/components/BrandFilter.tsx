import { motion } from 'motion/react';

interface BrandFilterProps {
  brands: string[];
  selectedBrands: string[];
  onBrandsChange: (brands: string[]) => void;
}

export function BrandFilter({ brands, selectedBrands, onBrandsChange }: BrandFilterProps) {
  if (brands.length === 0) return null;

  const toggleBrand = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      onBrandsChange(selectedBrands.filter(b => b !== brand));
    } else {
      onBrandsChange([...selectedBrands, brand]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {brands.map((brand) => (
        <motion.button
          key={brand}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => toggleBrand(brand)}
          className={`px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all ${
            selectedBrands.includes(brand)
              ? 'bg-[var(--primary-color)] text-white shadow-lg'
              : 'bg-white border border-zinc-200 text-zinc-900 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
          }`}
        >
          {brand}
        </motion.button>
      ))}
    </div>
  );
}
