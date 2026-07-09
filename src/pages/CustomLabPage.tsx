import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CustomLabPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col">
      {/* Header */}
      <nav className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 bg-[#050508]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <Link 
            to="/customization" 
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Back to Forge</span>
          </Link>

          <div className="flex md:hidden items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <CheckCircle2 size={10} className="text-[var(--primary-color)]" />
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Ready</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] animate-pulse" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white">3D Lab Active</span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
          <CheckCircle2 size={12} className="text-[var(--primary-color)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Onboarding Complete</span>
        </div>
      </nav>

      {/* Lab Interface */}
      <main className="flex-grow relative">
        <div className="absolute inset-0">
          <iframe 
            src="https://absolute-basic-jersey-customizer-930161668914.us-west1.run.app" 
            className="w-full h-full border-none"
            title="Advanced Jersey Customizer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="p-4 bg-[#050508] border-t border-white/5 text-center">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
          Absolute Soccer Elite Customization Engine v2.4
        </p>
      </footer>
    </div>
  );
}
