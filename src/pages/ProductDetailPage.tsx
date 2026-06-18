import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../supabase';
import { ShoppingBag, ChevronRight, ChevronLeft, ShieldCheck, Truck, RotateCcw, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { fetchProductById, products } = useProducts();
  const [product, setProduct] = useState<any>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

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

  const colorParam = searchParams.get('color');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Fetch Product
  useEffect(() => {
    if (id) {
      setIsPageLoading(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

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
              if (res) setProduct(res);
            }
          }
        } catch (err) {
          console.error("Error fetching product:", err);
        } finally {
          setIsPageLoading(false);
        }
      })();
    }
  }, [id]);

  // Fetch Variants for Single Product Item
  useEffect(() => {
    if (product?.id) {
      setVariantsLoading(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', product.id)
            .order('age_group')
            .order('size');
            
          if (!error && Array.isArray(data)) {
            setVariants(data);
            const ageGroups = Array.from(new Set(data.map((v: any) => v.age_group)));
            if (ageGroups.length > 0) {
              setSelectedAgeGroup(ageGroups[0] as string);
            }
          } else if (error) {
            console.error("Error loading product variants:", error);
          }
        } catch (err) {
          console.error("Error loading product variants:", err);
        } finally {
          setVariantsLoading(false);
        }
      })();
    }
  }, [product?.id]);

  // Look up the matching product.colors entry for price/images
  const selectedColorEntry = product?.colors?.find((c: any) => c.name === selectedColor) ?? null;

  const displayPrice = product ? (selectedColorEntry?.price
    ? selectedColorEntry.price
    : (product.isOnSale && product.salePrice ? product.salePrice : product.price)) : 0;

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

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "image": product.image,
      "description": product.description,
      "brand": {
        "@type": "Brand",
        "name": product.brand || "Absolute Soccer"
      },
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "CAD",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "Absolute Soccer Mississauga"
        }
      }
    };

    const script = document.createElement('script');
    script.id = 'product-schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('product-schema-markup')?.remove();
    };
  }, [product]);

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

  if (isPageLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#b90014] border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Loading Squad Gear...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Product Not Found</h2>
        <Link to="/" className="text-[#b90014] font-bold uppercase tracking-widest text-sm hover:underline">Back to Home</Link>
      </div>
    );
  }

  // Grouping sizes
  const uniqueAgeGroups = Array.from(new Set(variants.map(v => v.age_group))) as string[];

  // Derive all available color names: from product.colors JSONB + from variant color field
  const jsonbColorNames = (product.colors || []).map((c: any) => c.name as string);
  const variantColorNames = Array.from(new Set(variants.filter((v: any) => v.color).map((v: any) => v.color as string)));
  const allColorNames = Array.from(new Set([...jsonbColorNames, ...variantColorNames]));

  // Sizes list based on active/fallback structures
  const shoeSizes = ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'];
  const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

  let displayedSizesList: string[] = [];

  if (variants.length > 0) {
    // Use actual variant sizes from database, filtered by selected color when available
    displayedSizesList = Array.from(new Set(
      variants
        .filter((v: any) =>
          (!selectedAgeGroup || v.age_group === selectedAgeGroup) &&
          (!selectedColor || !v.color || v.color === selectedColor)
        )
        .map(v => v.size)
    ));

    // Sort shoe sizes numerically, apparel sizes by standard order
    if (product.category === 'Footwear') {
      displayedSizesList.sort((a, b) => parseFloat(a) - parseFloat(b));
    }
  } else {
    // Fallback to default lists when no variants exist
    displayedSizesList = product.category === 'Footwear' ? shoeSizes : apparelSizes;
  }

  // Get stock level for currently selected size, age group, and color
  const activeVariant = variants.find((v: any) =>
    (!selectedAgeGroup || v.age_group === selectedAgeGroup) &&
    (!selectedSize || v.size === selectedSize) &&
    (!selectedColor || !v.color || v.color === selectedColor)
  );

  const isStockDefined = variants.length > 0;
  const currentStock = activeVariant ? (activeVariant.stock_quantity ?? 0) : null;
  const isOutOfStock = currentStock !== null && currentStock <= 0;

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
      </Helmet>
      {/* Toast Notice */}
      <AnimatePresence>
        {isAdded && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 bg-[#b90014] text-white p-5 shadow-2xl flex items-center gap-4 border border-red-700/50"
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
          <div className="aspect-[4/5] bg-zinc-50 overflow-hidden relative group border border-zinc-100">
            {allImages[selectedImage] ? (
              <img 
                src={allImages[selectedImage]} 
                alt={product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
                <div className="w-full h-full bg-zinc-200" />
            )}
            {allImages.length > 1 && (
              <>
                <button 
                  onClick={() => setSelectedImage(prev => (prev - 1 + allImages.length) % allImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-zinc-900 border border-zinc-100"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => setSelectedImage(prev => (prev + 1) % allImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-zinc-900 border border-zinc-100"
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
                  className={`aspect-[4/5] bg-zinc-50 overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-[#b90014]' : 'border-transparent hover:border-zinc-200'}`}
                >
                  {img ? (
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            <p className="text-zinc-400 text-xs font-black uppercase tracking-[0.2em] mb-2">{product.category}</p>
            <h1 className="text-4xl font-black font-headline uppercase italic tracking-tighter text-zinc-900 leading-none mb-4">
              {product.name}
            </h1>
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-black font-headline text-zinc-900">${displayPrice.toFixed(2)}</span>
              {product.isOnSale && !selectedColorEntry?.price && (
                <span className="text-xl text-zinc-400 line-through font-bold">${product.price.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Color Selection */}
          {allColorNames.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Select Color</span>
                {selectedColor && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#b90014] animate-pulse">
                    {selectedColor}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedColor(null)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedColor === null ? 'border-[#b90014] bg-[#b90014]/5 text-[#b90014]' : 'border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}
                >
                  Default
                </button>
                {allColorNames.map((colorName: string) => (
                  <button
                    key={colorName}
                    onClick={() => setSelectedColor(colorName)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedColor === colorName ? 'border-[#b90014] bg-[#b90014]/5 text-[#b90014]' : 'border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}
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
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Select Category Level</span>
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
            <div className="p-6 bg-[#b90014] rounded-xl text-center my-6 shadow-lg shadow-red-900/20">
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
                <div className="my-6 rounded-xl border-2 border-[#b90014] bg-[#0d0d0d] p-6 text-center shadow-lg shadow-red-900/20">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">
                    Available In Store
                  </p>
                  <a
                    href="tel:9055933600"
                    className="inline-flex items-center gap-2 bg-[#b90014] hover:bg-[#d4001a] text-white font-black text-lg px-6 py-3 rounded-lg transition-colors shadow-md shadow-red-900/30"
                  >
                    📞 905-593-3600
                  </a>
                  <p className="text-[11px] text-zinc-500 mt-3 uppercase tracking-widest">
                    Call to order or visit us in store
                  </p>
                </div>
              ) : (
                <>
                  {/* Dynamic Size Picker Grid (Disables SOLD OUT size variants) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Select Size</span>
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
                                ? 'border-zinc-200 text-zinc-400 cursor-not-allowed bg-zinc-50'
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
                  </div>

                  {/* Call to Order CTA */}
                  <div className="my-6 rounded-xl border-2 border-[#b90014] bg-[#0d0d0d] p-6 text-center shadow-lg shadow-red-900/20">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">
                      Available In Store
                    </p>
                    <a
                      href="tel:9055933600"
                      className="inline-flex items-center gap-2 bg-[#b90014] hover:bg-[#d4001a] text-white font-black text-lg px-6 py-3 rounded-lg transition-colors shadow-md shadow-red-900/30"
                    >
                      📞 905-593-3600
                    </a>
                    <p className="text-[11px] text-zinc-500 mt-3 uppercase tracking-widest">
                      Call to order or visit us in store
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {/* Shipping & Certifications bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-zinc-500 font-medium">
            <div className="flex items-center gap-3">
              <Truck size={18} className="text-[#b90014] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800 leading-none mb-1">Free Delivery</p>
                <p className="text-[9px] text-zinc-400 leading-none">On all club orders over $150</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[#b90014] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800 leading-none mb-1">Easy Returns</p>
                <p className="text-[9px] text-zinc-400 leading-none">30 days custom refund policy</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[#b90014] flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-800 leading-none mb-1">100% Authentic</p>
                <p className="text-[9px] text-zinc-400 leading-none">Official tournament licensed gear</p>
              </div>
            </div>
          </div>

          {/* Product Details Accordion */}
          <div className="border-t border-zinc-100 pt-8 animate-fade-in">
            <button 
              onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
              className="w-full flex items-center justify-between bg-[#b90014] text-white p-4 font-black uppercase tracking-widest text-xs italic"
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
    </div>
  );
}
