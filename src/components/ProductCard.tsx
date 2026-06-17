import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../context/ProductContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [activeColorIdx, setActiveColorIdx] = React.useState<number | null>(null);
  
  if (product.colors && product.colors.length > 0) {
  }

  // Find the first image in the gallery that isn't the primary image
  const hoverImage = product.images?.find(img => img && img !== product.image);
  const displayImage = activeImage || (isHovered && hoverImage ? hoverImage : product.image);

  return (
    <div className="bg-white group cursor-pointer border border-zinc-100 relative block">
      <Link 
        to={`/product/${product.id}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`} 
        className="block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {product.isOnSale && product.salePrice && (
          <div className="absolute top-4 left-4 z-10 bg-[#b90014] text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic">
            SALE {Math.round((1 - product.salePrice / product.price) * 100)}% OFF
          </div>
        )}
        {product.isFeatured && (
          <div className="absolute top-4 right-4 z-10 bg-zinc-950 text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic shadow-md">
            FEATURED
          </div>
        )}
        <div className="aspect-[4/5] overflow-hidden bg-white relative flex items-center justify-center">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={`${product.name} Soccer Cleats & Gear - Absolute Soccer Mississauga`}
              className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105 p-2"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-zinc-200" />
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
            className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === null ? 'border-[#b90014]' : 'border-zinc-100 hover:border-zinc-200'}`}
          >
            <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Default" />
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
              className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === (color.images[0] || '___none___') ? 'border-[#b90014]' : 'border-zinc-100 hover:border-zinc-200'}`}
              title={color.name}
            >
              {color.images[0] ? (
                <img src={color.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={color.name} />
              ) : (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-400 uppercase">N/A</div>
              )}
            </button>
          ))}
        </div>
      )}

      <Link to={`/product/${product.id}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`} className="p-6 block">
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">
          {product.category} {product.submenu && `• ${product.submenu}`}
          {!product.submenu && product.submenus && product.submenus.length > 0 && `• ${product.submenus.join(', ')}`}
        </p>
        <h4 className="font-headline text-lg font-bold uppercase text-zinc-900">{product.name}</h4>
        <div className="mt-4">
          <div className="flex flex-col">
            {product.isOnSale && product.salePrice ? (
              <>
                <span className="text-zinc-400 line-through text-xs font-bold">${product.price}</span>
                <span className="font-headline font-black text-xl text-[#b90014]">${product.salePrice}</span>
              </>
            ) : (
              <span className="font-headline font-black text-xl text-[#b90014]">${product.price}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
