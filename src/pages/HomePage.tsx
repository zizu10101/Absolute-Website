import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useSettings } from '../context/SettingsContext';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductCard } from '../components/ProductCard';

export function HomePage() {
  const { products, fetchFeaturedProducts } = useProducts();
  const { sliderImages, homeCategories } = useSettings();
  
  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const featuredProducts = products.filter(p => p.isFeatured).length > 0 
    ? products.filter(p => p.isFeatured).slice().reverse().slice(0, 4)
    : products.slice().reverse().slice(0, 4);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    console.log("HOMEPAGE: sliderImages length is:", sliderImages.length);
    setTick(t => t + 1);
  }, [sliderImages]);

  useEffect(() => {
    if (currentIndex >= sliderImages.length) {
      setCurrentIndex(0);
    }
  }, [sliderImages, currentIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (sliderImages.length || 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [sliderImages]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % sliderImages.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + sliderImages.length) % sliderImages.length);
  const currentSlide = sliderImages[currentIndex];

  return (
    <div className="space-y-20">
      {sliderImages.length > 0 && currentSlide && (
        <section className="relative w-full h-[350px] sm:h-[450px] md:h-[500px] lg:h-[550px] overflow-hidden bg-zinc-900 flex items-center px-8 md:px-20">
          <AnimatePresence mode="wait">
            <div key={currentIndex} className="absolute inset-0 w-full h-full">
              {currentSlide.link ? (
                currentSlide.link.startsWith('http') ? (
                  <a href={currentSlide.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="w-full h-full object-cover cursor-pointer"
                      src={currentSlide.url}
                      alt={currentSlide.title || "Hero"}
                      referrerPolicy="no-referrer"
                    />
                  </a>
                ) : (
                  <Link to={currentSlide.link} className="block w-full h-full">
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="w-full h-full object-cover cursor-pointer"
                      src={currentSlide.url}
                      alt={currentSlide.title || "Hero"}
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                )
              ) : (
                <motion.img
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="w-full h-full object-cover"
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
      )}

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
                    {category.description} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-4xl font-black font-headline uppercase italic tracking-tighter">FEATURED GEAR</h2>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Our top picks for this season</p>
            </div>
            <Link to="/footwear" className="text-zinc-900 font-bold uppercase tracking-widest text-[10px] hover:text-[#b90014] transition-colors border-b-2 border-zinc-900 hover:border-[#b90014] pb-1">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map(product => (
              <ProductCard key={`featured-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="bg-zinc-950 text-white py-20 px-8 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Visit info */}
            <div className="space-y-6 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black font-headline uppercase italic tracking-tighter text-[#b90014]">VISIT US</h2>
              <div className="space-y-2">
                <p className="text-xl font-bold uppercase tracking-widest">Absolute Soccer</p>
                <p className="text-zinc-400 font-medium">5600 Rose Cherry Place, Mississauga, Ontario</p>
                <p className="text-zinc-400 font-medium">Phone: 905-593-3600</p>
              </div>
              <div className="pt-4">
                <a 
                  href="https://www.instagram.com/absolutemississauga?igsh=MXNrOW15Mmhna2Q5ZA==" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-[#b90014] text-white px-8 py-3.5 font-headline font-bold uppercase tracking-widest hover:bg-white hover:text-zinc-950 transition-colors"
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
