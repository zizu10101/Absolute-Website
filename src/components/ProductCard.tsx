import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../context/ProductContext';

interface ProductCardProps {
  product: Product;
  isSoldOut?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isSoldOut = false }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [activeColorIdx, setActiveColorIdx] = React.useState<number | null>(null);

  if (product.colors && product.colors.length > 0) {
  }

  // Find the first image in the gallery that isn't the primary image
  const hoverImage = product.images?.find(img => img && img !== product.image);
  const displayImage = activeImage || (isHovered && hoverImage ? hoverImage : product.image);

  return (
    <div className={`bg-white group cursor-pointer border border-zinc-100 relative flex flex-col h-full${isSoldOut ? ' opacity-70' : ''}`}>
      <Link 
        to={`/product/${product.id}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`} 
        className="block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {product.isOnSale && product.salePrice && (
          <div className="absolute top-4 left-4 z-10 bg-[var(--primary-color)] text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic">
            SALE {Math.round((1 - product.salePrice / product.price) * 100)}% OFF
          </div>
        )}
        {product.isFeatured && (
          <div className="absolute top-4 right-4 z-10 bg-zinc-950 text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic shadow-md">
            FEATURED
          </div>
        )}
        <div className="aspect-[4/5] overflow-hidden relative flex items-center justify-center bg-white">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`${product.name} Soccer Cleats & Gear - Absolute Soccer Mississauga`}
              className={`w-full h-full object-contain transition-all duration-500 group-hover:scale-105 p-2${isSoldOut ? ' grayscale' : ''}`}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-zinc-200" />
          )}
          {isSoldOut && (
            <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none z-10">
              <span className="bg-zinc-900 text-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest">
                SOLD OUT
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Color Thumbnails */}
      {product.colors && product.colors.length > 0 && typeof product.colors[0] === 'object' && (
        <div className="px-6 pb-4 flex gap-2 overflow-x-auto no-scrollbar relative z-20">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveImage(null);
              setActiveColorIdx(null);
            }}
            onMouseEnter={() => setActiveImage(null)}
            className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === null ? 'border-[var(--primary-color)]' : 'border-zinc-100 hover:border-zinc-200'}`}
            aria-label="Show default product image"
          >
            <img src={product.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="Default" />
          </button>
          {product.colors.map((color, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImage(color.images[0] || null);
                setActiveColorIdx(idx);
              }}
              onMouseEnter={() => setActiveImage(color.images[0] || null)}
              className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === (color.images[0] || '___none___') ? 'border-[var(--primary-color)]' : 'border-zinc-100 hover:border-zinc-200'}`}
              title={color.name}
              aria-label={`Show ${color.name} color`}
            >
              {color.images[0] ? (
                <img src={color.images[0]} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={color.name} />
              ) : (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-400 uppercase">N/A</div>
              )}
            </button>
          ))}
        </div>
      )}

      <Link to={`/product/${product.id}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`} className="flex flex-col flex-1 p-3">
        {product.brand && (
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
            {product.brand}
          </span>
        )}
        <h4 className="text-[14px] font-semibold text-zinc-900 leading-tight flex-1">{product.name}</h4>
        <div className="mt-auto pt-2 flex items-center gap-2">
          {product.isOnSale && product.salePrice ? (
            <>
              <span className="text-sm font-bold text-[var(--primary-color)]">${product.salePrice}</span>
              <span className="text-[10px] text-zinc-400 line-through">${product.price}</span>
            </>
          ) : (
            <span className="text-sm font-bold text-[var(--primary-color)]">${product.price}</span>
          )}
        </div>
      </Link>
    </div>
  );
}
