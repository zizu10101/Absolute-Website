import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product, ColorVariant } from '../context/ProductContext';
import { buildProductUrl } from '../utils/slugify';
import { useCart } from '../context/CartContext';
import { supabase } from '../supabase';
import { SizeSelector, SizeOption } from './SizeSelector';
import { ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  isSoldOut?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isSoldOut = false }) => {
  const { addToCart } = useCart();
  const [isHovered, setIsHovered] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [activeColorIdx, setActiveColorIdx] = React.useState<number | null>(null);
  const [hoveredColor, setHoveredColor] = React.useState<ColorVariant | null>(null);
  const [variants, setVariants] = useState<SizeOption[]>([]);
  const [showSizeSelector, setShowSizeSelector] = useState(false);

  useEffect(() => {
    const fetchVariants = async () => {
      try {
        const { data, error } = await supabase
          .from('product_variants')
          .select('size, stock_quantity')
          .eq('product_id', product.id);
        if (!error && Array.isArray(data)) setVariants(data);
      } catch (err) {
        console.error('Error fetching variants:', err);
      }
    };
    if (product.id) fetchVariants();
    const subscription = supabase
      .channel(`product_variants:${product.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${product.id}` }, fetchVariants)
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [product.id]);

  const inStockVariants = variants.filter(v => v.stock_quantity > 0);
  const hasInStockVariants = inStockVariants.length > 0;
  const shouldShowSizes = product.showSizes && variants.length > 0;
  const isOutOfStock = variants.length > 0 && !hasInStockVariants;

  // Get minimum stock across all variants for display
  const minStock = variants.length > 0
    ? Math.min(...variants.map(v => v.stock_quantity))
    : null;

  const getStockStatus = () => {
    if (isOutOfStock) return 'Out of Stock';
    if (minStock !== null && minStock > 0 && minStock <= 3) return `Only ${minStock} left!`;
    return null;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (shouldShowSizes) {
      setShowSizeSelector(true);
    } else {
      // Add without size
      addToCart({
        productId: product.id,
        name: product.name,
        price: product.isOnSale && product.salePrice ? product.salePrice : product.price,
        image: product.image,
        quantity: 1,
      });
    }
  };

  const handleSizeSelect = (size: string) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.isOnSale && product.salePrice ? product.salePrice : product.price,
      image: product.image,
      quantity: 1,
      size,
    });
    setShowSizeSelector(false);
  };

  // Find the first image in the gallery that isn't the primary image
  const hoverImage = product.images?.find(img => img && img !== product.image);
  const nonDefaultColors = (product.colors || []).filter(c => typeof c === 'object' && !(c as any).isDefault);
  const displayImage = activeImage || (isHovered && hoverImage ? hoverImage : product.image);
  const productUrl = buildProductUrl(product);

  // Compute lowest price, considering color-specific sale prices
  const colorSalePrices = (product.colors || []).filter(c => c.salePrice).map(c => c.salePrice!);
  const hasColorSale = colorSalePrices.length > 0;
  const productEffectivePrice = product.isOnSale && product.salePrice ? product.salePrice : product.price;
  const lowestPrice = hasColorSale
    ? Math.min(productEffectivePrice, ...colorSalePrices)
    : productEffectivePrice;
  const isOnSaleAny = (product.isOnSale && !!product.salePrice) || hasColorSale;

  return (
    <div className={`bg-white group cursor-pointer border border-zinc-100 relative flex flex-col h-full${isSoldOut ? ' opacity-70' : ''}`}>
      <Link
        to={`${productUrl}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`}
        className="block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isOnSaleAny && (
          <div className="absolute top-4 left-4 z-10 bg-[var(--primary-color)] text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic">
            SALE {Math.round((1 - lowestPrice / product.price) * 100)}% OFF
          </div>
        )}
        {product.isFeatured && (
          <div className="absolute top-4 right-4 z-10 bg-zinc-950 text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest italic shadow-md">
            FEATURED
          </div>
        )}
        <div className="w-full aspect-square bg-[#f6f6f6] overflow-hidden relative flex items-center justify-center rounded-lg">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`${product.name} Soccer Cleats & Gear - Absolute Soccer Mississauga`}
              className={`w-full h-full object-contain object-center transition-all duration-500 group-hover:scale-105 p-2${isSoldOut ? ' grayscale' : ''}`}
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
      {product.colors && product.colors.length > 0 && typeof product.colors[0] === 'object' && nonDefaultColors.length > 0 && (
        <div className="px-6 pb-4 flex gap-2 overflow-x-auto no-scrollbar relative z-20">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveImage(null);
              setActiveColorIdx(null);
            }}
            onMouseEnter={() => { setActiveImage(null); setHoveredColor(null); }}
            onMouseLeave={() => setHoveredColor(null)}
            className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === null ? 'border-[var(--primary-color)]' : 'border-zinc-100 hover:border-zinc-200'}`}
            aria-label="Show default product image"
          >
            <img src={product.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="Default" />
          </button>
          {nonDefaultColors.map((color, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImage(color.images[0] || null);
                setActiveColorIdx(idx);
              }}
              onMouseEnter={() => { setActiveImage(color.images[0] || null); setHoveredColor(color); }}
              onMouseLeave={() => setHoveredColor(null)}
              className={`w-10 h-10 flex-shrink-0 border-2 transition-all p-0.5 rounded-sm ${activeImage === (color.images[0] || '___none___') ? 'border-[var(--primary-color)]' : 'border-zinc-100 hover:border-zinc-200'}`}
              title={color.name}
              aria-label={`Show ${color.name} color`}
            >
              {color.images[0] ? (
                <img src={color.images[0]} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={color.name} />
              ) : (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-600 uppercase">N/A</div>
              )}
            </button>
          ))}
        </div>
      )}

      <Link to={`${productUrl}${activeColorIdx !== null ? `?color=${activeColorIdx}` : ''}`} className="flex flex-col flex-1 p-3">
        {product.brand && (
          <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide mb-1">
            {product.brand}
          </span>
        )}
        <h3 className="text-[14px] font-semibold text-zinc-900 leading-tight flex-1">{product.name}</h3>
        <div className="mt-auto pt-2 flex items-center gap-2">
          {hoveredColor ? (
            hoveredColor.salePrice ? (
              <>
                <span className="text-sm font-bold text-[var(--primary-color)]">${hoveredColor.salePrice.toFixed(2)}</span>
                <span className="text-[10px] text-zinc-400 line-through">${product.price.toFixed(2)}</span>
              </>
            ) : (
              <span className="text-sm font-bold text-[var(--primary-color)]">
                ${(hoveredColor.price ?? product.price).toFixed(2)}
              </span>
            )
          ) : isOnSaleAny ? (
            <>
              <span className="text-sm font-bold text-[var(--primary-color)]">
                {hasColorSale ? 'From ' : ''}${lowestPrice.toFixed(2)}
              </span>
              <span className="text-[10px] text-zinc-400 line-through">${product.price.toFixed(2)}</span>
            </>
          ) : (
            <span className="text-sm font-bold text-[var(--primary-color)]">${product.price.toFixed(2)}</span>
          )}
        </div>
      </Link>

      {getStockStatus() && (
        <div className={`mx-3 mb-1 text-xs font-bold uppercase text-center ${isOutOfStock ? 'text-red-600' : 'text-amber-600'}`}>
          {getStockStatus()}
        </div>
      )}

      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`mx-3 mb-3 py-2 px-4 font-bold uppercase text-xs transition-all flex items-center justify-center gap-2 rounded ${
          isOutOfStock
            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            : 'bg-[var(--primary-color)] text-white hover:opacity-90'
        }`}
      >
        <ShoppingBag size={14} />
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>

      {shouldShowSizes && (
        <SizeSelector
          isOpen={showSizeSelector}
          sizes={inStockVariants}
          productName={product.name}
          onSelect={handleSizeSelect}
          onClose={() => setShowSizeSelector(false)}
        />
      )}
    </div>
  );
}
