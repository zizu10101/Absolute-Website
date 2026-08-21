import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useProducts, mapProductFromDb } from '../context/ProductContext';
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../supabase';
import { ShoppingBag, ChevronRight, ChevronLeft, ShieldCheck, Store, RotateCcw, ChevronDown, CheckCircle2, AlertTriangle, Phone, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isUUID, buildProductUrl } from '../utils/slugify';
import { ProductCard } from '../components/ProductCard';

const isYouthProduct = (name: string) =>
  /kids|junior|youth|jr\.|children/i.test(name || '');

const getSurfaceType = (product: any): string => {
  const name = (product.name || '').toLowerCase();
  const submenus = (product.submenus || []).join(' ').toLowerCase();
  const combined = `${name} ${submenus}`;

  if (combined.includes('firm ground') || combined.includes(' fg')) return 'fg';
  if (combined.includes('artificial grass') || combined.includes(' ag')) return 'ag';
  if (combined.includes('multi ground') || combined.includes(' mg')) return 'mg';
  if (combined.includes('turf') || combined.includes(' tf')) return 'turf';
  if (combined.includes('indoor') || combined.includes('futsal')) return 'indoor';
  if (combined.includes('soft ground') || combined.includes(' sg')) return 'sg';
  return 'unknown';
};

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchProductById, products } = useProducts();
  const [product, setProduct] = useState<any>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [id, setId] = useState<string | null>(null);

  // Variant States
  const [variants, setVariants] = useState<any[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Buy Box States
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);

  // Image zoom states
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [imageMousePos, setImageMousePos] = useState({ x: 0, y: 0 });

  const colorParam = searchParams.get('color');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Track last fetched id so StrictMode's second effect run skips the loading flash
  const lastFetchedIdRef = useRef<string | null>(null);
  const lastResolvedSlugRef = useRef<string | null>(null);

  // Resolve the URL slug to a real product id.
  // - Legacy `/product/<uuid>` links are looked up and redirected to the new slug URL.
  // - New `/product/<name>-<code>--<shortId>` links resolve via a uuid-prefix range query
  //   (PostgREST's `ilike` doesn't work against a native uuid column, so a `gte`/`lte`
  //   bound on the first 8 hex chars is used instead).
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const isNewSlug = lastResolvedSlugRef.current !== slug;
    if (isNewSlug) {
      setIsPageLoading(true);
      setId(null);
    }
    lastResolvedSlugRef.current = slug;

    (async () => {
      if (isUUID(slug)) {
        const { data } = await supabase
          .from('products')
          .select('id, name, product_code')
          .eq('id', slug)
          .single();

        if (cancelled) return;

        if (data) {
          navigate(buildProductUrl(data), { replace: true });
        } else {
          setId(null);
          setIsPageLoading(false);
        }
        return;
      }

      const parts = slug.split('--');
      const shortId = parts[parts.length - 1];

      if (!/^[0-9a-f]{8}$/i.test(shortId)) {
        if (!cancelled) {
          setId(null);
          setIsPageLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('id')
        .gte('id', `${shortId}-0000-0000-0000-000000000000`)
        .lte('id', `${shortId}-ffff-ffff-ffff-ffffffffffff`)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setId(data.id);
      } else {
        setId(null);
        setIsPageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Reset stale variant/color state when navigating to a different product
  useEffect(() => {
    if (id && id !== lastFetchedIdRef.current) {
      setVariants([]);
      setSelectedAgeGroup(null);
      setSelectedSize(null);
      setSelectedColor(null);
      setSelectedImage(0);
    }
  }, [id]);

  // Fetch Product
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Only show the loading spinner when this is genuinely a new product (not a
    // StrictMode re-run for the same id, which would cause a brief spinner flash).
    const isNewProduct = lastFetchedIdRef.current !== id;
    if (isNewProduct) {
      setIsPageLoading(true);
    }
    lastFetchedIdRef.current = id;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled) return;

        if (!error && data) {
          setProduct({
            ...data,
            showSizes: data.show_sizes === true || data.show_sizes === 'true',
            is_online: data.is_online !== false
          });
        } else {
          // Fallback to context
          const existingProduct = products.find(p => p.id === id);
          if (existingProduct) {
            setProduct(existingProduct);
          } else {
            const res = await fetchProductById(id);
            if (!cancelled && res) setProduct(res);
          }
        }
      } catch (err) {
        if (!cancelled) console.error("Error fetching product:", err);
      } finally {
        if (!cancelled) setIsPageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch Variants for Single Product Item
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    setVariantsLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', product.id)
          .order('age_group')
          .order('size');

        if (cancelled) return;

        if (!error && Array.isArray(data) && data.length > 0) {
          setVariants(data);
          const ageGroups = Array.from(new Set(data.map((v: any) => v.age_group)));
          if (ageGroups.length > 0) {
            setSelectedAgeGroup(ageGroups[0] as string);
          }
        } else if (error) {
          console.error("Error loading product variants:", error);
        }
      } catch (err) {
        if (!cancelled) console.error("Error loading product variants:", err);
      } finally {
        if (!cancelled) setVariantsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  // Related Products, priority order:
  // 1. Same category + same brand + same surface + same age group
  // 2. Same category + same surface + same age group (any brand)
  // Surface type is never mixed, even if that leaves fewer than 4 results
  // for low-inventory surfaces (e.g. turf/artificial-grass).
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!product?.id || !product?.category) {
      setRelatedProducts([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const currentIsYouth = isYouthProduct(product.name);
        const currentSurface = getSurfaceType(product);
        const matchesAgeGroup = (p: any) => isYouthProduct(p.name) === currentIsYouth;
        const matchesSurface = (p: any) => currentSurface === 'unknown' || getSurfaceType(p) === currentSurface;

        const usedIds = new Set<string>([product.id]);
        const combined: any[] = [];
        const addCandidates = (candidates: any[]) => {
          for (const p of candidates) {
            if (combined.length >= 4) break;
            if (usedIds.has(p.id)) continue;
            combined.push(p);
            usedIds.add(p.id);
          }
        };

        // Tier 1: same brand + same category (over-fetched, filtered client-side)
        if (product.brand) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('category', product.category)
            .eq('brand', product.brand)
            .eq('is_online', true)
            .neq('id', product.id)
            .limit(40);

          if (error) throw error;
          addCandidates((data || []).filter((p: any) => matchesAgeGroup(p) && matchesSurface(p)));
        }

        // Tiers 2 & 3 draw from one broader same-category pool (any brand)
        if (combined.length < 4) {
          const existingIds = [...usedIds];
          const { data: pool, error: poolError } = await supabase
            .from('products')
            .select('*')
            .eq('category', product.category)
            .eq('is_online', true)
            .not('id', 'in', `(${existingIds.join(',')})`)
            .limit(100);

          if (poolError) throw poolError;
          const poolData = pool || [];

          // Tier 2: same surface + same age group, any brand
          // (no further fallback: surface type is never mixed, even if this
          // leaves fewer than 4 related products for low-inventory surfaces)
          addCandidates(poolData.filter((p: any) => matchesAgeGroup(p) && matchesSurface(p)));
        }

        if (!cancelled) {
          setRelatedProducts(combined.map(mapProductFromDb));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching related products:", err);
          setRelatedProducts([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category, product?.brand, product?.name, product?.submenus]);

  // Look up the matching product.colors entry for price/images
  const selectedColorEntry = product?.colors?.find((c: any) => c.name === selectedColor) ?? null;

  // Compute display price and original price (for strikethrough) based on color selection
  let displayPrice = 0;
  let displayOriginalPrice: number | null = null;
  if (product) {
    const colorSalePrice: number | null = selectedColorEntry?.salePrice ?? null;
    const colorPriceOverride: number | null = selectedColorEntry?.price ?? null;
    if (selectedColor) {
      if (colorSalePrice) {
        displayPrice = colorSalePrice;
        displayOriginalPrice = colorPriceOverride || product.price;
      } else if (colorPriceOverride) {
        displayPrice = colorPriceOverride;
      } else if (product.isOnSale && product.salePrice) {
        displayPrice = product.salePrice;
        displayOriginalPrice = product.price;
      } else {
        displayPrice = product.price;
      }
    } else {
      // No color selected — show lowest available price
      const colorSalePrices = (product.colors || []).filter((c: any) => c.salePrice).map((c: any) => c.salePrice as number);
      const effectiveBase = product.isOnSale && product.salePrice ? product.salePrice : product.price;
      if (colorSalePrices.length > 0) {
        const lowestColorSale = Math.min(...colorSalePrices);
        displayPrice = Math.min(effectiveBase, lowestColorSale);
        displayOriginalPrice = product.price;
      } else if (product.isOnSale && product.salePrice) {
        displayPrice = product.salePrice;
        displayOriginalPrice = product.price;
      } else {
        displayPrice = product.price;
      }
    }
  }

  const currentVariantImages = product ? (selectedColorEntry?.images?.length
    ? selectedColorEntry.images
    : [product.image, ...(product.images || [])]) : [];

  const allImages = currentVariantImages;

  useEffect(() => {
    setSelectedImage(0);
  }, [selectedColor]);

  // Convert legacy numeric colorParam (URL ?color=0) to color name once product loads
  useEffect(() => {
    if (colorParam !== null && product?.colors) {
      const idx = parseInt(colorParam);
      const colorName = product.colors[idx]?.name;
      if (colorName) setSelectedColor(colorName);
    }
  }, [product?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!product) return;

    const existing = document.getElementById('product-schema-markup');
    if (existing) existing.remove();

    const getAbsoluteUrl = (url: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      if (url.startsWith('//')) return `https:${url}`;
      return `https://torontosoccershop.com${url}`;
    };

    const productImages = (product.images && product.images.length > 0)
      ? product.images.map((img: string) => getAbsoluteUrl(img))
      : [getAbsoluteUrl(product.image)];

    const price = product.isOnSale && product.salePrice ? product.salePrice : product.price;

    const selectedColorCode = selectedColor
      ? (product.colors || []).find((c: any) => c.name === selectedColor)?.product_code || null
      : null;
    const skuCode = selectedColorCode || product.product_code || '';

    const schema: any = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name,
      "image": productImages.filter(Boolean),
      "description": product.description || '',
      "sku": skuCode,
      "mpn": skuCode,
      "brand": {
        "@type": "Brand",
        "name": product.brand || "Absolute Soccer"
      },
      "offers": {
        "@type": "Offer",
        "url": `https://torontosoccershop.com${buildProductUrl(product)}`,
        "priceCurrency": "CAD",
        "price": price,
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "Absolute Soccer Mississauga"
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "CA",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 14,
          "returnMethod": "https://schema.org/ReturnInStore",
          "returnFees": "https://schema.org/FreeReturn"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0.00",
            "currency": "CAD"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "CA"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 2,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 2,
              "maxValue": 5,
              "unitCode": "DAY"
            }
          }
        }
      }
    };

    // aggregateRating and review fields intentionally omitted when no reviews exist.
    // Google Search Console prefers omitting these fields over empty/zero values.

    const script = document.createElement('script');
    script.id = 'product-schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('product-schema-markup')?.remove();
    };
  }, [product, selectedColor]);

  useEffect(() => {
    if (product && product.images) {
      // Preload images
      product.images.forEach((img: string) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = img;
        document.head.appendChild(link);
      });
    }
  }, [product]);

  // Handle Age Group change
  const handleAgeGroupChange = (group: string) => {
    setSelectedAgeGroup(group);
    setSelectedSize(null); // Reset size selection when tier changes
  };

  // Handle image zoom on hover
  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setImageMousePos({ x, y });
  };

  if (isPageLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Loading Squad Gear...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">Product Not Found</h1>
        <Link to="/" className="text-[var(--primary-color)] font-bold uppercase tracking-widest text-sm hover:underline">Back to Home</Link>
      </div>
    );
  }

  // Grouping sizes
  const uniqueAgeGroups = Array.from(new Set(variants.map(v => v.age_group))) as string[];

  // Derive all available color names: from product.colors JSONB + from variant color field
  const INVALID_COLOR_VALUES = new Set(['NA', 'N/A', 'none', 'null', 'undefined']);
  const jsonbColorNames = (product.colors || [])
    .map((c: any) => c.name as string)
    .filter((n: string) => n && n.trim() !== '' && !INVALID_COLOR_VALUES.has(n));
  const variantColorNames = Array.from(new Set(
    variants
      .filter((v: any) => v.color && !INVALID_COLOR_VALUES.has(v.color))
      .map((v: any) => v.color as string)
  ));
  const allColorNames = Array.from(new Set([...jsonbColorNames, ...variantColorNames]));

  // Sizes list based on active/fallback structures
  const shoeSizes = ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'];
  const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

  let displayedSizesList: string[] = [];

  if (variants.length > 0) {
    // Use actual variant sizes from database, filtered by selected color when available
    displayedSizesList = Array.from(new Set(
      variants
        .filter((v: any) => {
          const ageGroupMatch = !selectedAgeGroup || v.age_group === selectedAgeGroup;
          const colorMatch = !selectedColor || v.color === selectedColor;
          return ageGroupMatch && colorMatch;
        })
        .map(v => v.size)
    ));

    const sizeOrder = [
      '8K', '8.5K', '9K', '9.5K', '10K', '10.5K',
      '11K', '11.5K', '12K', '12.5K', '13K', '13.5K',
      '1Y', '1.5Y', '2Y', '2.5Y', '3Y', '3.5Y',
      '4Y', '4.5Y', '5Y', '5.5Y', '6Y', '6.5Y', '7Y',
      '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5',
      '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '15',
      'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL',
      'YXS', 'YS', 'YM', 'YL', 'YXL',
    ];
    displayedSizesList.sort((a, b) => {
      const ia = sizeOrder.indexOf(a), ib = sizeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  } else {
    // Fallback to default lists when no variants exist
    displayedSizesList = product.category === 'Footwear' ? shoeSizes : apparelSizes;
  }

  // Get stock level for currently selected size, age group, and color
  const activeVariant = variants.find((v: any) => {
    const ageGroupMatch = !selectedAgeGroup || v.age_group === selectedAgeGroup;
    const sizeMatch = !selectedSize || v.size === selectedSize;
    const colorMatch = !selectedColor || v.color === selectedColor;
    return ageGroupMatch && sizeMatch && colorMatch;
  });

  const isStockDefined = variants.length > 0;
  const currentStock = activeVariant ? (activeVariant.stock_quantity ?? 0) : null;
  const isOutOfStock = currentStock !== null && currentStock <= 0;
  const isSoldOut = !variantsLoading && product.showSizes &&
    (variants.length === 0 || variants.every((v: any) => (v.stock_quantity ?? 0) === 0));

  // Render stock alert
  const renderStockStatus = () => {
    if (!isStockDefined) return null;
    if (!selectedSize) return (
      <span className="text-xs text-zinc-500">Please select a size to check live availability</span>
    );

    const variant = variants.find((v: any) =>
      v.size === selectedSize &&
      v.age_group === selectedAgeGroup &&
      (!selectedColor || !v.color || v.color === selectedColor)
    );
    const qty = variant?.stock_quantity || 0;
    return (
      <span className={`text-xs font-bold uppercase tracking-widest ${qty === 0 ? 'text-red-500' : qty <= 3 ? 'text-amber-500' : 'text-green-600'}`}>
        {qty === 0 ? 'Out of Stock' : qty <= 3 ? `Only ${qty} left!` : `${qty} in stock`}
      </span>
    );
  };

  const handleAddToCart = () => {
    if (displayedSizesList.length > 0 && !selectedSize) {
      // Prompt selection
      alert("Please choose a size first.");
      return;
    }

    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 3500);
    }, 850);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-12" id="storefront-product-detail-container">
      <Helmet>
        <title>{product.name} | Absolute Soccer Mississauga</title>
        <meta name="description" content={`Buy the ${product.name} at Absolute Soccer in Mississauga. In stock now. Shop online or visit us. Call 905-593-3600`} />
        <link rel="canonical" href={`https://torontosoccershop.com${buildProductUrl(product)}`} />
      </Helmet>
      {/* Toast Notice */}
      <AnimatePresence>
        {isAdded && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 bg-[var(--primary-color)] text-white p-5 shadow-2xl flex items-center gap-4 border border-red-700/50"
          >
            <div className="bg-white/10 p-2 rounded-full">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">ADDED TO SQUAD BAG</p>
              <p className="text-[10px] text-red-100 uppercase tracking-tight">
                {product.name} ({selectedAgeGroup ? `${selectedAgeGroup} • ` : ''}size {selectedSize}) x {quantity}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left: Image Gallery */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-4">
          <div
            className="relative h-[400px] md:h-[500px] overflow-hidden rounded-xl border border-zinc-100 group cursor-zoom-in bg-white"
            onMouseEnter={() => setIsImageHovered(true)}
            onMouseLeave={() => setIsImageHovered(false)}
            onMouseMove={handleImageMouseMove}
          >
            {allImages[selectedImage] ? (
              <img
                src={allImages[selectedImage]}
                alt={product.name}
                style={{
                  transform: isImageHovered ? 'scale(2)' : 'scale(1)',
                  transformOrigin: `${imageMousePos.x}% ${imageMousePos.y}%`,
                  transition: isImageHovered ? 'none' : 'transform 0.3s ease',
                }}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
                <div className="w-full h-full bg-zinc-200" />
            )}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage(prev => (prev - 1 + allImages.length) % allImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 min-w-[48px] min-h-[48px] flex items-center justify-center bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-zinc-900 border border-zinc-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setSelectedImage(prev => (prev + 1) % allImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 min-w-[48px] min-h-[48px] flex items-center justify-center bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-zinc-900 border border-zinc-100"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
          
          {allImages.length > 1 && (
            <div className="grid grid-cols-5 gap-4">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`aspect-[4/5] overflow-hidden border-2 transition-all bg-white ${selectedImage === idx ? 'border-[var(--primary-color)]' : 'border-transparent hover:border-zinc-200'}`}
                  aria-label={`View image ${idx + 1} of ${allImages.length}`}
                >
                  {img ? (
                    <img src={img} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-zinc-200" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info & Buy Box */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-8">
          <div>
            <p className="text-zinc-600 text-xs font-black uppercase tracking-[0.2em] mb-2">{product.category}</p>
            <h1 className="text-4xl font-black font-headline uppercase italic tracking-tighter text-zinc-900 leading-none mb-4">
              {product.name}
            </h1>
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-black font-headline text-zinc-900">${displayPrice.toFixed(2)}</span>
              {displayOriginalPrice && displayOriginalPrice !== displayPrice && (
                <span className="text-xl text-zinc-400 line-through font-bold">${displayOriginalPrice.toFixed(2)}</span>
              )}
            </div>
            {(selectedColorEntry?.product_code || product.product_code) && (
              <p className="text-xs text-zinc-400 mt-2">
                Style: {selectedColorEntry?.product_code || product.product_code}
              </p>
            )}
          </div>

          {/* Color Selection */}
          {allColorNames.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Select Color</span>
                {selectedColor && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary-color)] animate-pulse">
                    {selectedColor}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {variants.some((v: any) => !v.color || v.color === '' || INVALID_COLOR_VALUES.has(v.color)) && (
                  <button
                    onClick={() => setSelectedColor(null)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedColor === null ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5 text-[var(--primary-color)]' : 'border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}
                  >
                    Default
                  </button>
                )}
                {allColorNames.map((colorName: string) => (
                  <button
                    key={colorName}
                    onClick={() => setSelectedColor(selectedColor === colorName ? null : colorName)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedColor === colorName ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/5 text-[var(--primary-color)]' : 'border-zinc-100 text-zinc-600 hover:border-zinc-200'}`}
                  >
                    {colorName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Age Tiers Selector (If variants has age groups defined) */}
          {uniqueAgeGroups.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block">Select Category Level</span>
              <div className="flex gap-2.5">
                {uniqueAgeGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => handleAgeGroupChange(group)}
                    className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedAgeGroup === group ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200 bg-white'}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sizing grid and Buy Box conditional layout */}
          {(product.release_date && new Date(product.release_date) > new Date()) ? (
            <div className="p-6 bg-[var(--primary-color)] rounded-xl text-center my-6 shadow-lg shadow-red-900/20">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="text-sm font-black uppercase tracking-widest text-white">
                  Coming Soon
                </p>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
              {product.release_date && new Date(product.release_date) > new Date() && (
                <p className="text-[10px] text-red-200 mt-1 uppercase tracking-widest font-bold">
                  Available {new Date(product.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          ) : (
            <>
              {!product.showSizes ? (
                <div className="my-6 rounded-xl border-2 border-[var(--primary-color)] bg-[#0d0d0d] p-6 text-center shadow-lg shadow-red-900/20">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">
                    Available In Store
                  </p>
                  <a
                    href="tel:9055933600"
                    className="inline-flex items-center gap-2 bg-[var(--primary-color)] hover:bg-[#d4001a] text-white font-black text-lg px-6 py-3 rounded-lg transition-colors shadow-md shadow-red-900/30"
                  >
                    Call: 905-593-3600
                  </a>
                  <p className="text-[11px] text-zinc-500 mt-3 uppercase tracking-widest">
                    Call to order or visit us in store
                  </p>
                </div>
              ) : (
                <>
                  {isSoldOut ? (
                    <div className="my-6 space-y-3">
                      <div className="inline-flex items-center bg-red-600 text-white px-5 py-3 font-black uppercase tracking-widest text-base">
                        SOLD OUT
                      </div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest">
                        This product is currently out of stock
                      </p>
                    </div>
                  ) : (
                    /* Dynamic Size Picker Grid (Disables SOLD OUT size variants) */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Select Size</span>
                        {renderStockStatus()}
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {displayedSizesList.map((size) => {
                          const isItemOutOfStock = variants.length > 0
                            ? (() => {
                                const optVariant = variants.find((v: any) =>
                                  (!selectedAgeGroup || v.age_group === selectedAgeGroup) &&
                                  v.size === size &&
                                  (!selectedColor || !v.color || v.color === selectedColor)
                                );
                                return optVariant ? (optVariant.stock_quantity ?? 0) <= 0 : true;
                              })()
                            : true;

                          const isSelected = selectedSize === size;

                          return (
                            <button
                              key={size}
                              disabled={isItemOutOfStock}
                              onClick={() => setSelectedSize(isSelected ? null : size)}
                              className={`h-12 flex flex-col justify-center items-center border transition-all relative rounded-lg ${
                                isItemOutOfStock
                                  ? 'border-zinc-200 text-zinc-600 cursor-not-allowed bg-zinc-50'
                                  : isSelected
                                    ? 'border-2 border-zinc-900 bg-zinc-900 text-white font-extrabold shadow-sm'
                                    : 'border-zinc-300 text-zinc-900 hover:border-zinc-900 font-bold bg-white'
                              }`}
                            >
                              <span className={`text-xs tracking-wider ${isItemOutOfStock ? 'font-medium line-through decoration-zinc-400' : 'font-black'}`}>{size}</span>
                              {isItemOutOfStock && (
                                <svg className="absolute inset-0 w-full h-full text-zinc-300 pointer-events-none" preserveAspectRatio="none">
                                  <line x1="0" y1="100%" x2="100%" y2="0" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">
                        Available sizes shown — styles sell out and are not restocked
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Reserve by Phone */}
          <a
            href="tel:9055933600"
            className="w-full flex items-center justify-center gap-3 bg-[#b90014] hover:bg-red-700 text-white font-bold uppercase tracking-widest py-4 px-6 rounded-lg transition-colors duration-200 text-sm mt-4"
          >
            <Phone size={18} />
            Reserve by Phone — 905-593-3600
          </a>

          {/* Visit Us In Store */}
          <div className="mt-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-[#b90014] mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-sm text-zinc-900">Visit Us In Store</p>
                <p className="text-xs text-zinc-500 mt-1">5600 Rose Cherry Place, Mississauga, ON L4Z 4B6</p>
                <p className="text-xs text-zinc-500">Mon-Fri: 10am-7pm | Sat: 10am-6pm | Sun: 11am-5pm</p>
              </div>
            </div>
            <a
              href="https://maps.google.com/?q=5600+Rose+Cherry+Place+Mississauga+ON"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-zinc-900 font-medium text-xs uppercase tracking-widest py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Get Directions →
            </a>
          </div>

          {/* Shipping & Certifications bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-zinc-500 font-medium">
            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
              <div className="text-[var(--primary-color)]">
                <Store size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">
                  In-Store Pickup
                </p>
                <p className="text-xs text-zinc-500">
                  Available at Mississauga location
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[var(--primary-color)] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800 leading-none mb-1">Easy Returns</p>
                <p className="text-[9px] text-zinc-600 leading-none">14 day return policy</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[var(--primary-color)] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800 leading-none mb-1">100% Authentic</p>
                <p className="text-[9px] text-zinc-600 leading-none">Official licensed gear</p>
              </div>
            </div>
          </div>

          {/* Product Details Accordion */}
          <div className="border-t border-zinc-100 pt-8 animate-fade-in">
            <button 
              onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
              className="w-full flex items-center justify-between bg-[var(--primary-color)] text-white p-4 font-black uppercase tracking-widest text-xs italic"
            >
              Product Details
              <motion.div
                animate={{ rotate: isDescriptionOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown size={18} />
              </motion.div>
            </button>
            <AnimatePresence>
              {isDescriptionOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden bg-zinc-50 border-x border-b border-zinc-100"
                >
                  <div className="p-6 space-y-4 text-xs text-zinc-600 leading-relaxed">
                    <p className="font-bold text-zinc-900 uppercase tracking-tight">{product.name}</p>
                    <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-zinc-200 pt-8">
          <h2 className="text-lg font-bold uppercase tracking-widest text-zinc-900 mb-6">
            You Might Also Like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
