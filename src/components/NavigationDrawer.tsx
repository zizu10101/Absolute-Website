import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Footprints, Flag, CircleDot, Shirt, Dumbbell, Star, Sparkles, Tag, Bolt, ClipboardList, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { BrandNavigation } from './BrandNavigation';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NavigationDrawer({ isOpen, onClose }: Props) {
  const { logo, navigationMenus } = useSettings();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSubmenu = (heading: string) => {
    setExpandedSubmenus(prev => ({ ...prev, [heading]: !prev[heading] }));
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.aside 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-[60] w-80 bg-white shadow-2xl flex flex-col"
          >
            <div className="p-6 flex flex-col gap-2 overflow-y-auto flex-grow scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <Link to="/" onClick={onClose} className="flex items-center">
                  <img src={logo} alt="ABSOLUTE SOCCER" className="h-12 w-auto" />
                </Link>
                <button onClick={onClose} className="min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-zinc-100 rounded-full transition-colors" aria-label="Close menu">
                  <X size={24} className="text-zinc-500" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                <Link
                  to="/"
                  onClick={onClose}
                  className="flex items-center gap-4 px-4 py-3 min-h-[48px] text-zinc-900 hover:bg-zinc-50 transition-colors font-headline uppercase font-black text-base border-l-4 border-transparent hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                >
                  Home
                </Link>

                <Link
                  to="/custom-apparel"
                  onClick={onClose}
                  className="flex items-center gap-4 px-4 py-3 min-h-[48px] text-zinc-900 hover:bg-zinc-50 transition-colors font-headline uppercase font-black text-base border-l-4 border-transparent hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                >
                  Custom Apparel
                </Link>

                <Link
                  to="/blog"
                  onClick={onClose}
                  className="flex items-center gap-4 px-4 py-3 min-h-[48px] text-zinc-900 hover:bg-zinc-50 transition-colors font-headline uppercase font-black text-base border-l-4 border-transparent hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                >
                  Gear Guides
                </Link>

                {/* Brand Navigation Section */}
                <BrandNavigation onNavigate={onClose} />

                {navigationMenus.map((menu) => (
                  <div key={menu.label} className="flex flex-col">
                    <div className="flex items-center justify-between pr-4">
                      <Link
                        to={menu.path}
                        onClick={onClose}
                        className="flex-1 flex items-center gap-4 px-4 py-3 min-h-[48px] text-zinc-900 hover:bg-zinc-50 transition-colors font-headline uppercase font-black text-base border-l-4 border-transparent hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                      >
                        {menu.label}
                      </Link>
                      {menu.submenus.length > 0 && (
                        <button
                          onClick={() => toggleMenu(menu.label)}
                          className="min-w-[48px] min-h-[48px] flex items-center justify-center text-zinc-600 hover:text-[var(--primary-color)]"
                          aria-label={expandedMenus[menu.label] ? `Collapse ${menu.label} menu` : `Expand ${menu.label} menu`}
                        >
                          <ChevronDown size={18} className={`transition-transform duration-300 ${expandedMenus[menu.label] ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {expandedMenus[menu.label] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-zinc-50/50"
                        >
                          {menu.submenus.map(sub => (
                            <div key={sub.heading} className="flex flex-col">
                              <button 
                                onClick={() => toggleSubmenu(sub.heading)}
                                className="flex items-center justify-between px-8 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                              >
                                <span>{sub.heading}</span>
                                <ChevronRight size={14} className={`transition-transform duration-300 ${expandedSubmenus[sub.heading] ? 'rotate-90' : ''}`} />
                              </button>
                              
                              <AnimatePresence>
                                {expandedSubmenus[sub.heading] && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden flex flex-col bg-white"
                                  >
                                    {sub.items.map(item => (
                                      <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className="px-12 py-2.5 text-xs font-bold text-zinc-600 hover:text-[var(--primary-color)] transition-colors border-l-2 border-transparent hover:border-[var(--primary-color)]"
                                      >
                                        {item.label}
                                      </Link>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </nav>
            </div>
            <div className="p-6 bg-zinc-50 text-zinc-600 text-[10px] font-bold uppercase tracking-widest border-t border-zinc-100">
              Â© 2024 ABSOLUTE SOCCER. ALL RIGHTS RESERVED.
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
