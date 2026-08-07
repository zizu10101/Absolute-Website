import { useState, useEffect, useRef, useMemo, TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductCard } from '../components/ProductCard';
import { BrandBanners } from '../components/BrandBanners';
import { CategoryQuickLinks } from '../components/CategoryQuickLinks';
import { supabase } from '../supabase';
import { mapProductFromDb, Product } from '../context/ProductContext';

export function HomePage() {
  const { sliderImages, homeCategories, storeInfo } = useSettings();
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [mapVisible, setMapVisible] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMapVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (mapRef.current) observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_online', true)
        .eq('isNewArrival', true)
        .order('created_at', { ascending: false })
        .limit(4);
      if (data) setNewArrivals(data.map(mapProductFromDb));
    };

    const fetchSaleProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_online', true)
        .eq('isOnSale', true)
        .not('salePrice', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4);
      if (data) setSaleProducts(data.map(mapProductFromDb));
    };

    fetchNewArrivals();
    fetchSaleProducts();
  }, []);

  // Infinite loop: clone the last slide before index 0 and the first slide after the end,
  // so there's always real slide content peeking on both sides instead of grey space.
  // currentIndex is a position into infiniteSlides (1 = first real slide).
  const infiniteSlides = useMemo(() => {
    if (sliderImages.length === 0) return [];
    return [sliderImages[sliderImages.length - 1], ...sliderImages, sliderImages[0]];
  }, [sliderImages]);

  const [currentIndex, setCurrentIndex] = useState(1);
  const [loopTransitionEnabled, setLoopTransitionEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Center slide is wide with a modest peek so existing wide banner graphics don't get cropped tight.
  // Mobile gets no peek at all - full width slide, edge-to-edge, so the whole slide is visible.
  const [slideWidthVw, setSlideWidthVw] = useState(84);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const updateDims = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSlideWidthVw(mobile ? 100 : 84);
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);
  const gapVw = isMobile ? 0 : 2;
  const peekVw = (100 - slideWidthVw) / 2;
  // Real banner images measure ~2.29-2.53:1 (landscape); tie frame height to width via
  // aspect-ratio instead of a fixed vh so the full image fits with minimal letterboxing
  // at any viewport size, rather than a height guessed independently of image proportions.
  const slideAspectRatio = '12 / 5';

  useEffect(() => {
    if (sliderImages.length > 0 && (currentIndex < 0 || currentIndex > sliderImages.length + 1)) {
      setCurrentIndex(1);
    }
  }, [sliderImages, currentIndex]);

  // Clamp to the clone bounds so a rapid click/tick can't outrun the pending silent jump
  // and index past the end of infiniteSlides before it resolves.
  const clampToLoopBounds = (idx: number) => Math.max(0, Math.min(idx, infiniteSlides.length - 1));

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => clampToLoopBounds(prev + 1));
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sliderImages]);

  // Landing on a cloned edge slide: let the transition play, then silently snap to the
  // matching real slide with the transition switched off so the jump is invisible.
  useEffect(() => {
    if (sliderImages.length === 0) return;
    if (currentIndex === 0) {
      const t = setTimeout(() => {
        setLoopTransitionEnabled(false);
        setCurrentIndex(sliderImages.length);
      }, 500);
      return () => clearTimeout(t);
    }
    if (currentIndex === sliderImages.length + 1) {
      const t = setTimeout(() => {
        setLoopTransitionEnabled(false);
        setCurrentIndex(1);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [currentIndex, sliderImages.length]);

  // Re-enable the transition on the next paint, after the transition-less jump has applied.
  const reenableRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!loopTransitionEnabled) {
      const raf1 = requestAnimationFrame(() => {
        reenableRafRef.current = requestAnimationFrame(() => setLoopTransitionEnabled(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (reenableRafRef.current !== null) cancelAnimationFrame(reenableRafRef.current);
      };
    }
  }, [loopTransitionEnabled]);

  const nextSlide = () => {
    setCurrentIndex((prev) => clampToLoopBounds(prev + 1));
    resetTimer();
  };
  const prevSlide = () => {
    setCurrentIndex((prev) => clampToLoopBounds(prev - 1));
    resetTimer();
  };
  const goToSlide = (realIndex: number) => {
    setCurrentIndex(realIndex + 1);
    resetTimer();
  };
  // Active dot for the real slide currently shown, wrapping correctly even while
  // briefly sitting on a cloned slide before the silent snap-back fires.
  const activeRealIndex = sliderImages.length > 0
    ? ((currentIndex - 1) % sliderImages.length + sliderImages.length) % sliderImages.length
    : 0;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) nextSlide(); else prevSlide();
    }
    touchStartX.current = null;
  };

  // Resolve link destination configurations safely to support same-window absolute/relative clicks
  const resolveSliderLink = (link?: string) => {
    let path = link || "";
    let isInternal = true;

    if (path) {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        try {
          const urlObj = new URL(path);
          const currentHost = window.location.hostname;

          // Treat as internal if the hostname matches, is empty, is localhost, or points to the primary site domain/preview server
          if (
            urlObj.hostname === currentHost ||
            urlObj.hostname.includes('torontosoccershop.com') ||
            urlObj.hostname.includes('run.app') ||
            urlObj.hostname === 'localhost' ||
            urlObj.hostname === '127.0.0.1'
          ) {
            path = urlObj.pathname + urlObj.search + urlObj.hash;
            isInternal = true;
          } else {
            isInternal = false;
          }
        } catch (e) {
          isInternal = false;
        }
      } else {
        isInternal = true;
      }

      // Normalize absolute routes for react-router-dom Link context
      if (isInternal && !path.startsWith('/')) {
        path = '/' + path;
      }
    }

    return { path, isInternal };
  };

  return (
    <div className="space-y-20">
      <h1 className="sr-only">
        Absolute Soccer - Premier Soccer Store in Mississauga & GTA
      </h1>
      <p className="sr-only">
        Toronto Soccer Shop (Absolute Soccer Mississauga, formerly Golazo Store) is a premier local soccer specialty store carrying Nike, Adidas, Puma, Joma, and New Balance soccer cleats, boots, jerseys, goalkeeper gloves, training gear, and team apparel. We offer custom kit printing and team uniform services for soccer clubs throughout Mississauga, Brampton, Oakville, Toronto, Etobicoke, Milton, and across the Greater Toronto Area. Visit our Mississauga showroom — Monday to Friday 1 PM to 7 PM, Saturday to Sunday 11 AM to 4 PM. Call us at 905-593-3600.
      </p>
      {sliderImages.length > 0 && (
        <section className="relative w-full overflow-hidden bg-zinc-900">
          <div
            className="flex"
            style={{
              transform: `translateX(calc(-${currentIndex * (slideWidthVw + gapVw)}vw + ${peekVw}vw))`,
              transition: loopTransitionEnabled ? 'transform 0.5s ease' : 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {infiniteSlides.map((slide, index) => {
              const isActive = index === currentIndex;
              const { path, isInternal } = resolveSliderLink(slide.link);

              const media = (
                <>
                  <img
                    src={slide.url}
                    alt={slide.title || 'Absolute Soccer Mississauga'}
                    className="absolute inset-0 w-full h-full object-contain object-center bg-black"
                    referrerPolicy="no-referrer"
                    draggable={false}
                    /* infiniteSlides[0] is a cloned copy of the last slide (off-screen, not
                       the LCP element) — the real, visible first slide sits at index 1 since
                       currentIndex starts at 1. Only that one gets eager/high priority. */
                    loading={index === 1 ? 'eager' : 'lazy'}
                    fetchPriority={index === 1 ? 'high' : 'low'}
                    decoding="async"
                  />
                  <div
                    className={`absolute inset-0 bg-black transition-opacity duration-500 ${
                      isActive ? 'opacity-0' : 'opacity-50'
                    }`}
                  />
                  {isActive && slide.title && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 pointer-events-none"
                      >
                        <h1 className="font-headline text-4xl sm:text-6xl md:text-8xl font-black text-white leading-none tracking-tighter uppercase italic mb-6 max-w-2xl">
                          {slide.title.includes('<br/>') ? (
                            <span dangerouslySetInnerHTML={{ __html: slide.title }} />
                          ) : (
                            slide.title
                          )}
                        </h1>
                        {slide.link && (
                          <span className="inline-flex w-fit items-center gap-2 bg-[var(--primary-color)] text-white text-xs font-black uppercase tracking-widest px-6 py-3">
                            Shop Now <ChevronRight size={14} />
                          </span>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </>
              );

              return (
                <div
                  key={index}
                  className={`relative flex-shrink-0 overflow-hidden ${isMobile ? '' : 'rounded-xl'}`}
                  style={{
                    width: `${slideWidthVw}vw`,
                    aspectRatio: slideAspectRatio,
                    marginRight: index < infiniteSlides.length - 1 ? `${gapVw}vw` : 0,
                  }}
                  onClick={!isActive ? () => { setCurrentIndex(index); resetTimer(); } : undefined}
                >
                  {isActive && slide.link ? (
                    isInternal ? (
                      <Link to={path} className="block w-full h-full">{media}</Link>
                    ) : (
                      <a href={path} className="block w-full h-full">{media}</a>
                    )
                  ) : (
                    <div className="w-full h-full cursor-pointer">{media}</div>
                  )}
                </div>
              );
            })}
          </div>

          {sliderImages.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 min-w-[48px] min-h-[48px] flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="text-white" size={24} />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 min-w-[48px] min-h-[48px] flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="text-white" size={24} />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex z-20">
                {sliderImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className="min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label={`Go to slide ${i + 1}`}
                  >
                    <span className={`block transition-all duration-300 rounded-full ${
                      i === activeRealIndex ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                    }`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
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
            {homeCategories.map((category) => (
              <Link key={category.name} to={category.path} className="group relative block aspect-[3/4] overflow-hidden bg-zinc-100">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {saleProducts.map(product => (
              <ProductCard key={`sale-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

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

            {/* Google Map — deferred until scrolled into view (embed script is ~400KB) */}
            <div ref={mapRef} className="w-full h-[280px] rounded-lg overflow-hidden border-2 border-zinc-800 shadow-xl relative bg-zinc-900">
              {mapVisible ? (
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
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-zinc-500 text-sm font-medium">Loading map...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
