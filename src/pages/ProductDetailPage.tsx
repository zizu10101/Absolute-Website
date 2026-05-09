import { useParams, Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useState, useEffect } from 'react';
import { ShoppingBag, Heart, ChevronRight, ChevronLeft, Minus, Plus, ShieldCheck, Truck, RotateCcw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchProductById, products } = useProducts();
  const [product, setProduct] = useState<any>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  useEffect(() => {
    if (id) {
      const existingProduct = products.find(p => p.id === id);
      if (existingProduct) {
        setProduct(existingProduct);
        setIsPageLoading(false);
      } else {
        setIsPageLoading(true);
        fetchProductById(id).then(res => {
          setProduct(res);
          setIsPageLoading(false);
        });
      }
    }
  }, [id, products]);
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const displayPrice = product ? (selectedColor !== null && product.colors?.[selectedColor]?.price 
    ? product.colors[selectedColor].price 
    : (product.isOnSale && product.salePrice ? product.salePrice : product.price)) : 0;

  const currentVariantImages = product ? (selectedColor !== null && product.colors?.[selectedColor]?.images?.length 
    ? product.colors[selectedColor].images 
    : [product.image, ...(product.images || [])]) : [];

  const allImages = currentVariantImages;

  useEffect(() => {
    setSelectedImage(0);
  }, [selectedColor]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

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

  const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left: Image Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/5] bg-zinc-50 overflow-hidden relative group">
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => setSelectedImage(prev => (prev + 1) % allImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
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

        {/* Right: Product Info */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">{product.category}</p>
            <h1 className="text-4xl font-black font-headline uppercase italic tracking-tighter text-zinc-900 leading-none mb-4">
              {product.name}
            </h1>
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-black font-headline text-zinc-900">${displayPrice.toFixed(2)}</span>
              {product.isOnSale && !product.colors?.[selectedColor ?? -1]?.price && (
                <span className="text-xl text-zinc-400 line-through font-bold">${product.price.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Select Color</span>
                {selectedColor !== null && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#b90014] animate-pulse">
                    {product.colors[selectedColor].name}
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
                {product.colors.map((color: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedColor(idx)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedColor === idx ? 'border-[#b90014] bg-[#b90014]/5 text-[#b90014]' : 'border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Details Accordion */}
          <div className="border-t border-zinc-100 pt-8">
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
                  className="overflow-hidden"
                >
                  <div className="py-6 space-y-4 text-sm text-zinc-600 leading-relaxed">
                    <p className="font-bold text-zinc-900 uppercase tracking-tight">{product.name}</p>
                    <p className="whitespace-pre-line">{product.description}</p>
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
