import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductCard } from '../components/ProductCard';
import { BrandShowcase } from '../components/BrandShowcase';
import { BrandBanners } from '../components/BrandBanners';
import { CategoryQuickLinks } from '../components/CategoryQuickLinks';
import { supabase } from '../supabase';
import { mapProductFromDb, Product } from '../context/ProductContext';

export function HomePage() {
  const { sliderImages, homeCategories, storeInfo } = useSettings();
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      // Try ordering by created_at; fall back to isNewArrival flag if column absent
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_online', true)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error || !data || data.length === 0) {
        const res = await supabase
          .from('products')
          .select('*')
          .eq('is_online', true)
          .eq('isNewArrival', true)
          .limit(6);
        data = res.data;
      }
      if (data) setNewArrivals(data.map(mapProductFromDb));
    };

    const fetchSaleProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_online', true)
        .eq('isOnSale', true)
        .not('salePrice', 'is', null)
        .limit(6);
      if (data) setSaleProducts(data.map(mapProductFromDb));
    };

    fetchNewArrivals();
    fetchSaleProducts();
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentIndex >= sliderImages.length) {
      setCurrentIndex(0);
    }
  }, [sliderImages, currentIndex]);

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (sliderImages.length || 1));
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sliderImages]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % sliderImages.length);
    resetTimer();
  };
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + sliderImages.length) % sliderImages.length);
    resetTimer();
  };
  const currentSlide = sliderImages[currentIndex];

  // Resolve link destination configurations safely to support same-window absolute/relative clicks
  let sliderLinkPath = currentSlide?.link || "";
  let isInternalLink = true;

  if (sliderLinkPath) {
    if (sliderLinkPath.startsWith('http://') || sliderLinkPath.startsWith('https://')) {
      try {
        const urlObj = new URL(sliderLinkPath);
        const currentHost = window.location.hostname;
        
        // Treat as internal if the hostname matches, is empty, is localhost, or points to the primary site domain/preview server
        if (
          urlObj.hostname === currentHost ||
          urlObj.hostname.includes('torontosoccershop.com') ||
          urlObj.hostname.includes('run.app') ||
          urlObj.hostname === 'localhost' ||
          urlObj.hostname === '127.0.0.1'
        ) {
          sliderLinkPath = urlObj.pathname + urlObj.search + urlObj.hash;
          isInternalLink = true;
        } else {
          isInternalLink = false;
        }
      } catch (e) {
        isInternalLink = false;
      }
    } else {
      isInternalLink = true;
    }
    
    // Normalize absolute routes for react-router-dom Link context
    if (isInternalLink && !sliderLinkPath.startsWith('/')) {
      sliderLinkPath = '/' + sliderLinkPath;
    }
  }

  return (
    <div className="space-y-20">
      {sliderImages.length > 0 && currentSlide && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <section className="relative w-full aspect-[21/9] md:aspect-[16/7] rounded-[2rem] overflow-hidden shadow-lg bg-zinc-900 flex items-center px-8 md:px-20">
            <AnimatePresence mode="wait">
              <div key={currentIndex} className="absolute inset-0 w-full h-full">
                {currentSlide.link ? (
                  isInternalLink ? (
                    <Link to={sliderLinkPath} className="block w-full h-full">
                      <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="w-full h-full object-cover object-center cursor-pointer"
                        src={currentSlide.url}
                        alt={currentSlide.title || "Hero"}
                        referrerPolicy="no-referrer"
                      />
                    </Link>
                  ) : (
                    <a href={sliderLinkPath} className="block w-full h-full">
                      <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="w-full h-full object-cover object-center cursor-pointer"
                        src={currentSlide.url}
                        alt={currentSlide.title || "Hero"}
                        referrerPolicy="no-referrer"
                      />
                    </a>
                  )
                ) : (
                  <motion.img
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="w-full h-full object-cover object-center"
                    src={currentSlide.url}
                    alt={currentSlide.title || "Hero"}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </AnimatePresence>
            
            {sliderImages.length > 1 && (
              <>
                <button onClick={prevSlide} className="absolute left-4 z-20 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors">
                  <ChevronLeft size={32} />
                </button>
                <button onClick={nextSlide} className="absolute right-4 z-20 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors">
                  <ChevronRight size={32} />
                </button>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 z-20">
                  {sliderImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentIndex(i); resetTimer(); }}
                      className={`rounded-sm transition-all duration-300 ${
                        i === currentIndex
                          ? 'w-6 h-2 bg-[var(--primary-color)]'
                          : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="relative z-10 max-w-3xl">
              {currentSlide.title && (
                <h1 className="font-headline text-6xl md:text-9xl font-black text-white leading-none tracking-tighter uppercase italic mb-6">
                  {currentSlide.title.includes('<br/>') ? (
                    <span dangerouslySetInnerHTML={{ __html: currentSlide.title.replace('<br/>', '<br/>') }} />
                  ) : (
                    currentSlide.title
                  )}
                </h1>
              )}
            </div>
          </section>
        </div>
      )}

      <BrandBanners />

      <CategoryQuickLinks />

      {homeCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-black font-headline uppercase italic tracking-tighter mb-4">SELECT YOUR SQUAD</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Pick a category to explore the collection</p>
          </div>
          <div className={`grid grid-cols-1 ${
            homeCategories.length === 1 ? 'max-w-3xl mx-auto' :
            homeCategories.length === 2 ? 'md:grid-cols-2' :
            homeCategories.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
            'md:grid-cols-3'
          } gap-8`}>
            {homeCategories.map((category, index) => (
              <Link key={category.name} to={category.path} className="group relative block aspect-[3/4] overflow-hidden bg-zinc-100">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  loading={index < 2 ? "eager" : "lazy"}
                  fetchPriority={index < 2 ? "high" : "auto"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8">
                  <h3 className="text-white text-4xl font-black uppercase tracking-widest font-headline italic leading-none">{category.name}</h3>
                  <span className="text-white font-bold text-sm uppercase tracking-widest mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0">
                    {category.description} &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">NEW ARRIVALS</h2>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Just dropped — fresh gear in stock</p>
            </div>
            <Link
              to="/new-arrivals"
              className="text-zinc-900 font-bold uppercase tracking-widest text-[10px] hover:text-[var(--primary-color)] transition-colors border-b-2 border-zinc-900 hover:border-[var(--primary-color)] pb-1"
            >
              View All New Arrivals &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {newArrivals.map(product => (
              <ProductCard key={`new-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      {saleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">ON SALE</h2>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Limited-time deals on top gear</p>
            </div>
            <Link
              to="/sale"
              className="text-zinc-900 font-bold uppercase tracking-widest text-[10px] hover:text-[var(--primary-color)] transition-colors border-b-2 border-zinc-900 hover:border-[var(--primary-color)] pb-1"
            >
              View All Sale Items &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {saleProducts.map(product => (
              <ProductCard key={`sale-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      <BrandShowcase />

      <section className="text-white py-20 px-8 border-t border-zinc-900" style={{ backgroundColor: 'var(--secondary-color)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Visit info */}
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-black font-headline uppercase italic tracking-tighter text-[var(--primary-color)] text-center md:text-left">VISIT US</h2>
              <div className="flex flex-col items-center md:items-start gap-1">
                <p className="text-xl font-bold uppercase tracking-widest">{storeInfo.name}</p>
                <p className="text-zinc-400 font-medium">{storeInfo.address}</p>
                <p className="text-zinc-400 font-medium">Phone: {storeInfo.phone}</p>
                {storeInfo.email && (
                  <p className="text-zinc-400 font-medium">Email: {storeInfo.email}</p>
                )}
              </div>
              <div className="flex flex-col items-center md:items-start gap-1 text-sm w-full">
                {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => (
                  <div key={day} className="flex justify-between w-full max-w-xs">
                    <span className="text-zinc-500 capitalize">{day}</span>
                    <span className="text-zinc-300">{storeInfo.hours[day]}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center md:justify-start w-full">
                <a
                  href="https://www.instagram.com/absolutemississauga?igsh=MXNrOW15Mmhna2Q5ZA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full max-w-xs text-center bg-[var(--primary-color)] text-white px-8 py-3.5 font-headline font-bold uppercase tracking-widest hover:bg-white hover:text-zinc-950 transition-colors"
                >
                  Follow on Instagram
                </a>
              </div>
            </div>

            {/* Google Map */}
            <div className="w-full h-[280px] rounded-lg overflow-hidden border-2 border-zinc-800 shadow-xl relative bg-zinc-900">
              <iframe
                title="Absolute Soccer Location Map"
                src="https://maps.google.com/maps?q=5600%20Rose%20Cherry%20Place,%20Mississauga%20Ontario&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=&amp;output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale opacity-75 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
