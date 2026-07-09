import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { ArrowDown, Bolt, Palette, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CustomizationPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Target-based scroll tracking is best for sticky parallax sections
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Parallax transforms for steps - Spread out to give more space
  const introOpacity = useTransform(smoothProgress, [0, 0.05, 0.1], [1, 1, 0]);
  const introY = useTransform(smoothProgress, [0, 0.1], [0, -40]);

  const step1Opacity = useTransform(smoothProgress, [0.1, 0.15, 0.25, 0.3], [0, 1, 1, 0]);
  const step1Y = useTransform(smoothProgress, [0.1, 0.15, 0.25, 0.3], [30, 0, 0, -30]);
  
  const step2Opacity = useTransform(smoothProgress, [0.3, 0.35, 0.45, 0.5], [0, 1, 1, 0]);
  const step2Y = useTransform(smoothProgress, [0.3, 0.35, 0.45, 0.5], [30, 0, 0, -30]);
  
  const step3Opacity = useTransform(smoothProgress, [0.5, 0.55, 0.65, 0.7], [0, 1, 1, 0]);
  const step3Y = useTransform(smoothProgress, [0.5, 0.55, 0.65, 0.7], [30, 0, 0, -30]);
  
  // Step 4 (The Lab) now appears earlier and stays visible for the remainder of the scroll
  const step4Opacity = useTransform(smoothProgress, [0.7, 0.75, 1], [0, 1, 1]);
  const step4Y = useTransform(smoothProgress, [0.7, 0.75], [30, 0]);

  // Pointer events management
  const step4PointerEvents = useTransform(smoothProgress, [0, 0.7, 0.75], ["none", "none", "auto"]);

  const bgScale = useTransform(smoothProgress, [0, 1], [1, 1.1]);
  const bgOpacity = useTransform(smoothProgress, [0, 0.7, 1], [0.4, 0.2, 0.1]);

  const handleSkip = () => {
    if (containerRef.current) {
      // Scroll to the point where the lab is fully visible (around 75% of the way down)
      const targetY = containerRef.current.offsetTop + (containerRef.current.scrollHeight * 0.8);
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div ref={containerRef} className="relative h-[800vh] bg-[#050508] text-white">
      {/* â”€â”€ STICKY VIEWPORT â”€â”€ */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#050508]">
        
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0">
          <motion.img 
            style={{ scale: bgScale, opacity: bgOpacity }}
            src="https://images.unsplash.com/photo-1511886929837-354d827aae26?q=80&w=2000&auto=format&fit=crop" 
            className="w-full h-full object-cover grayscale"
            alt="Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-transparent to-[#050508]" />
        </div>

        {/* Progress Indicator (Vertical Line) */}
        <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 h-48 md:h-64 w-[1px] bg-white/10 z-50 hidden md:block">
          <motion.div 
            style={{ scaleY: smoothProgress, originY: 0 }}
            className="w-full h-full bg-[var(--primary-color)] shadow-[0_0_15px_#b90014]"
          />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Start</div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest text-[var(--primary-color)]">Lab</div>
        </div>

        {/* â”€â”€ STEPS â”€â”€ */}
        <div className="relative h-full w-full flex items-center justify-center px-6">
          
          {/* INTRO */}
          <motion.div 
            style={{ opacity: introOpacity, y: introY }}
            className="text-center space-y-4 md:space-y-6 z-10 pointer-events-none"
          >
            <h1 className="text-5xl md:text-9xl font-black uppercase italic tracking-tighter leading-none">
              THE <span className="text-[var(--primary-color)]">FORGE</span>
            </h1>
            <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] text-[10px] md:text-xs">Scroll to begin your engineering journey</p>
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex justify-center pt-8 md:pt-12"
            >
              <ArrowDown className="text-[var(--primary-color)]" size={24} />
            </motion.div>
          </motion.div>

          {/* STEP 1: THE TEMPLATE */}
          <motion.div 
            style={{ opacity: step1Opacity, y: step1Y }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 max-w-4xl mx-auto px-6 pointer-events-none z-20"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 flex items-center justify-center mb-2 md:mb-4">
              <Bolt size={32} className="text-[var(--primary-color)] md:hidden" />
              <Bolt size={40} className="text-[var(--primary-color)] hidden md:block" />
            </div>
            <span className="text-[var(--primary-color)] text-[10px] md:text-xs font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">Step 01</span>
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
              SELECT YOUR <span className="text-transparent stroke-white stroke-2" style={{ WebkitTextStroke: '2px white' }}>BASE</span>
            </h2>
            <p className="text-zinc-400 text-base md:text-xl font-medium max-w-xl leading-relaxed">
              Choose from our elite performance templates. Each engineered for maximum breathability and movement.
            </p>
          </motion.div>

          {/* STEP 2: THE PALETTE */}
          <motion.div 
            style={{ opacity: step2Opacity, y: step2Y }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 max-w-4xl mx-auto px-6 pointer-events-none z-20"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 flex items-center justify-center mb-2 md:mb-4">
              <Palette size={32} className="text-[var(--primary-color)] md:hidden" />
              <Palette size={40} className="text-[var(--primary-color)] hidden md:block" />
            </div>
            <span className="text-[var(--primary-color)] text-[10px] md:text-xs font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">Step 02</span>
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
              INJECT YOUR <span className="text-transparent stroke-white stroke-2" style={{ WebkitTextStroke: '2px white' }}>DNA</span>
            </h2>
            <p className="text-zinc-400 text-base md:text-xl font-medium max-w-xl leading-relaxed">
              Define your team's visual identity. Infinite color combinations to ensure you stand out on the pitch.
            </p>
          </motion.div>

          {/* STEP 3: THE IDENTITY */}
          <motion.div 
            style={{ opacity: step3Opacity, y: step3Y }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 max-w-4xl mx-auto px-6 pointer-events-none z-20"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 flex items-center justify-center mb-2 md:mb-4">
              <Shield size={32} className="text-[var(--primary-color)] md:hidden" />
              <Shield size={40} className="text-[var(--primary-color)] hidden md:block" />
            </div>
            <span className="text-[var(--primary-color)] text-[10px] md:text-xs font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">Step 03</span>
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
              BRAND YOUR <span className="text-transparent stroke-white stroke-2" style={{ WebkitTextStroke: '2px white' }}>LEGACY</span>
            </h2>
            <p className="text-zinc-400 text-base md:text-xl font-medium max-w-xl leading-relaxed">
              Upload your crest, add sponsor logos, and define player numbers with precision placement.
            </p>
          </motion.div>

          {/* STEP 4: THE LAB REVEAL */}
          <motion.div 
            style={{ opacity: step4Opacity, y: step4Y, pointerEvents: step4PointerEvents }}
            className="absolute inset-0 flex flex-col items-center justify-center px-4 md:px-6 z-30"
          >
            <div className="w-full max-w-4xl p-8 md:p-12 bg-[#0D0D14] rounded-2xl md:rounded-[32px] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden text-center space-y-8 md:space-y-12">
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary-color)]/10 to-transparent pointer-events-none" />
              
              <div className="relative z-10 space-y-4 md:space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-[var(--primary-color)] flex items-center justify-center shadow-[0_0_50px_rgba(185,0,20,0.4)]">
                    <CheckCircle2 size={32} className="text-white md:hidden" />
                    <CheckCircle2 size={48} className="text-white hidden md:block" />
                  </div>
                </div>
                
                <h2 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter">
                  SYSTEM <span className="text-[var(--primary-color)]">READY</span>
                </h2>
                
                <p className="text-zinc-400 text-sm md:text-xl font-medium max-w-xl mx-auto leading-relaxed">
                  The Forge has completed your initialization. You are now ready to enter the 3D Customization Lab and build your legacy.
                </p>

                <div className="pt-4 md:pt-8">
                  <Link 
                    to="/custom-lab"
                    className="inline-flex items-center gap-3 md:gap-4 px-8 md:px-12 py-4 md:py-6 bg-[var(--primary-color)] text-white rounded-xl md:rounded-2xl font-black uppercase tracking-[0.2em] text-xs md:text-sm hover:bg-white hover:text-black transition-all shadow-[0_0_40px_rgba(185,0,20,0.3)] group"
                  >
                    Enter 3D Lab <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--primary-color)] to-transparent opacity-50" />
            </div>
          </motion.div>

        </div>
      </div>

      {/* Skip Button */}
      <motion.button
        onClick={handleSkip}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-20 md:top-24 right-4 md:right-8 z-[100] px-4 md:px-5 py-2 md:py-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
      >
        Skip to Lab
      </motion.button>
    </div>
  );
}
