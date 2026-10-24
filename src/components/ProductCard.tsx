import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product, ColorVariant } from '../context/ProductContext';
import { buildProductUrl } from '../utils/slugify';

interface ProductCardProps {
  product: Product;
  isSoldOut?: boolean;
  filteredSize?: string;
  sizeVariants?: Array<{ color: string; size: string }>;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isSoldOut = false, filteredSize, sizeVariants }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [activeColorIdx, setActiveColorIdx] = React.useState<number | null>(null);
  const [hoveredColor, setHoveredColor] = React.useState<ColorVariant | null>(null);

  const INVALID_COLORS = new Set(['NA', 'N/A', 'none', 'null', 'undefined']);
  const jsonbColors = ((product.colors || []) as any[]).filter((c: any) => typeof c === 'object' && c.name);
  const variantColorNames = [...new Set(
    (sizeVariants || [])
      .map((v: any) => v.color as string)
      .filter((c: string) => c && c.trim() !== '' && !INVALID_COLORS.has(c))
  )];
  // JSONB colors (with images) take priority; fall back to variant color names as text swatches
  const allColors = jsonbColors.length > 0
    ? jsonbColors
    : variantColorNames.map((name: string) => ({ name, images: [] as string[] }));

  const defaultColor = allColors.find((c: any) => c.isDefault) ?? allColors[0] ?? null;
  const getSwatchImage = (color: any): string | null => {
    if (color.images?.[0]) return color.images[0];
    if (color.name === defaultColor?.name && product.image) return product.image;
    return null;
  };

  const sizeFilteredColors = allColors.filter((c: any) =>
    !filteredSize || sizeVariants?.some((v: any) => v.color === c.name && v.size === filteredSize)
  );
  const visibleColors = sizeFilteredColors.length > 1 ? sizeFilteredColors : [];

  const cardImage = (() => {
    if (!filteredSize || !sizeVariants) return product.image;
    const match = allColors.find((c: any) =>
      sizeVariants.some((v: any) => v.color === c.name && v.size === filteredSize) && c.images?.length > 0
    );
    return match?.images?.[0] || product.image;
  })();

  // Find the first image in the gallery that isn't the primary image
  const hoverImage = product.images?.find(img => img && img !== product.image);
  const displayImage = activeImage || (isHovered && hoverImage ? hoverImage : cardImage);
  const productUrl = buildProductUrl(product);
  const productLinkParams = new URLSearchParams();
  if (activeColorIdx !== null) productLinkParams.set('color', String(activeColorIdx));
  if (filteredSize) productLinkParams.set('size', filteredSize);
  const productLinkQs = productLinkParams.toString();
  const productLink = `${productUrl}${productLinkQs ? `?${productLinkQs}` : ''}`;

  const navigateToColor = (color: any) => {
    const colorIndex = (product.colors || []).findIndex((c: any) => c.name === color.name);
    const params = new URLSearchParams();
    if (colorIndex >= 0) params.set('color', String(colorIndex));
    if (filteredSize) params.set('size', filteredSize);
    const qs = params.toString();
    navigate(`${productUrl}${qs ? `?${qs}` : ''}`);
  };

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
        to={productLink}
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
        <div className="aspect-square overflow-hidden relative flex items-center justify-center bg-[#efefef] rounded-lg p-3">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`${product.name} Soccer Cleats & Gear - Absolute Soccer Mississauga`}
              className={`w-full h-full object-contain max-w-full max-h-full transition-all duration-500 group-hover:scale-105${isSoldOut ? ' grayscale' : ''}`}
              style={{ mixBlendMode: 'multiply' }}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-zinc-200 rounded-lg" />
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

      {/* Always-rendered swatch area — fixed h-8 keeps all card titles aligned */}
      <div className="px-3 h-8 flex items-center relative z-20">
        {visibleColors.length > 1 ? (
          <div className="flex gap-1 flex-wrap overflow-x-auto no-scrollbar w-full items-center">
            {visibleColors.map((color: any) => {
              const swatchImage = getSwatchImage(color);
              const isActive = hoveredColor?.name === color.name || activeImage === swatchImage;
              return swatchImage ? (
                <img
                  key={color.name}
                  src={swatchImage}
                  alt={color.name}
                  onMouseEnter={() => { setActiveImage(swatchImage); setHoveredColor(color); }}
                  onMouseLeave={() => { setActiveImage(null); setHoveredColor(null); }}
                  onClick={() => navigateToColor(color)}
                  className={`w-7 h-7 object-contain rounded border p-0.5 cursor-pointer transition-all ${isActive ? 'border-zinc-800' : 'border-zinc-200 bg-[#f6f6f6]'}`}
                  title={color.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  key={color.name}
                  onMouseEnter={() => setHoveredColor(color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  onClick={() => navigateToColor(color)}
                  className={`text-[10px] border rounded px-1.5 py-0.5 whitespace-nowrap cursor-pointer transition-all leading-none ${isActive ? 'border-zinc-800 bg-zinc-100 text-zinc-900' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}
                  title={color.name}
                >
                  {color.name}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="h-7" />
        )}
      </div>

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
    </div>
  );
}
