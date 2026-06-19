import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, Menu, User, Heart, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onMenuClick: () => void;
}

import { DEFAULT_NAV } from '../constants/navigation';

export function Header({ onMenuClick }: Props) {
  const { logo, navigationMenus } = useSettings();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Reset active submenu when main menu changes
  useEffect(() => {
    if (activeMenu) {
      const menu = navigationMenus.find(m => m.label === activeMenu);
      if (menu && menu.submenus.length > 0) {
        setActiveSubmenu(menu.submenus[0].heading);
      } else {
        setActiveSubmenu(null);
      }
    }
  }, [activeMenu, navigationMenus]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="bg-white border-b border-zinc-100 fixed top-0 w-full z-50" onMouseLeave={() => setActiveMenu(null)}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6 flex justify-between items-center">
        {/* Left Section: Logo & Mobile Menu */}
        <div className="flex items-center flex-1 gap-4">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-1 text-zinc-900 hover:text-[#b90014] transition-colors"
          >
            <Menu size={24} strokeWidth={1.5} />
          </button>
          <Link to="/" className="flex items-center">
            <img src={logo} alt="ABSOLUTE SOCCER" className="h-10 md:h-16 w-auto" />
          </Link>
        </div>

        {/* Center Section: Nav */}
        <div className="hidden lg:flex items-center justify-center flex-[3]">
          <nav className="flex items-center gap-8">
            {navigationMenus.map((menu) => (
              <div
                key={menu.label}
                className="relative h-full flex items-center"
                onMouseEnter={() => setActiveMenu(menu.label)}
              >
                <Link
                  to={menu.path}
                  className={`text-[11px] font-black uppercase tracking-tight transition-all py-2 border-b-2 ${activeMenu === menu.label ? 'text-[#b90014] border-[#b90014]' : 'text-zinc-900 border-transparent hover:text-[#b90014]'}`}
                >
                  {menu.label}
                </Link>
              </div>
            ))}
            <div className="relative h-full flex items-center" onMouseEnter={() => setActiveMenu(null)}>
              <Link
                to="/custom-apparel"
                className="text-[11px] font-black uppercase tracking-tight transition-all py-2 border-b-2 text-zinc-900 border-transparent hover:text-[#b90014]"
              >
                Custom Apparel
              </Link>
            </div>
          </nav>
        </div>

        {/* Right Section: Icons */}
        <div className="flex items-center justify-end gap-6 flex-1">
          <button className="p-1 text-zinc-900 hover:text-[#b90014] transition-colors relative">
            <Heart size={24} strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 bg-black text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">0</span>
          </button>
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="p-1 text-zinc-900 hover:text-[#b90014] transition-colors"
          >
            <Search size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-x-0 top-0 bg-white z-[60] border-b border-zinc-200 shadow-2xl"
          >
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 flex items-center gap-6">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-4">
                <Search size={24} className="text-zinc-400" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Search products, categories, teams..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-medium placeholder:text-zinc-300"
                />
              </form>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={24} className="text-zinc-900" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mega Menu Overlay */}
      <AnimatePresence>
        {activeMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 w-full bg-white border-b border-zinc-200 shadow-xl z-40 overflow-hidden"
            onMouseEnter={() => setActiveMenu(activeMenu)}
          >
            {(() => {
              const menu = navigationMenus.find(m => m.label === activeMenu);
              if (!menu || menu.submenus.length === 0) return null;

              return (
                <div className="max-w-[1600px] mx-auto flex min-h-[400px]">
                  {/* Left Column: Submenu Headings */}
                  <div className="w-80 border-r border-zinc-100 py-8">
                    {menu.submenus.map((submenu, idx) => (
                      <div 
                        key={idx}
                        onMouseEnter={() => setActiveSubmenu(submenu.heading)}
                        className={`px-12 py-4 cursor-pointer transition-all border-l-4 ${activeSubmenu === submenu.heading ? 'bg-zinc-50 border-[#b90014] text-[#b90014]' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
                      >
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                          {submenu.heading}
                        </h3>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Submenu Items */}
                  <div className="flex-1 p-12 bg-zinc-50/30">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSubmenu}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-12 gap-y-4"
                      >
                        {menu.submenus.find(s => s.heading === activeSubmenu)?.items.map((item, itemIdx) => (
                          <Link 
                            key={itemIdx}
                            to={item.path} 
                            className="group flex items-center gap-3"
                            onClick={() => setActiveMenu(null)}
                          >
                            {item.logo && (
                              <div className="w-8 h-8 bg-white rounded-lg border border-zinc-100 flex items-center justify-center p-1 overflow-hidden">
                                <img src={item.logo} alt="" className="max-w-full max-h-full object-contain grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <span className="text-[13px] font-bold text-zinc-600 group-hover:text-[#b90014] transition-colors">
                              {item.label}
                            </span>
                          </Link>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
