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
  const menuCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleMenuMouseLeave = () => {
    menuCloseTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handleMenuMouseEnter = (menuLabel: string) => {
    if (menuCloseTimeoutRef.current) {
      clearTimeout(menuCloseTimeoutRef.current);
      menuCloseTimeoutRef.current = null;
    }
    setActiveMenu(menuLabel);
  };

  return (
    <header className="bg-white border-b border-zinc-100 fixed top-0 w-full z-50" onMouseLeave={handleMenuMouseLeave}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center">
        {/* Left Section: Logo & Mobile Menu */}
        <div className="flex items-center shrink-0 gap-4">
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

        {/* Center Section: Nav — fills all space between logo and icons */}
        <div className="hidden lg:flex flex-1 items-center px-6">
          <nav className="flex w-full items-center justify-center gap-5">
            {navigationMenus.map((menu) => (
              <div
                key={menu.label}
                className="relative flex items-center"
                onMouseEnter={() => handleMenuMouseEnter(menu.label)}
              >
                <Link
                  to={menu.path}
                  className={`text-[11px] font-black uppercase tracking-normal whitespace-nowrap transition-all py-2 border-b-2 ${activeMenu === menu.label ? 'text-[#b90014] border-[#b90014]' : 'text-zinc-900 border-transparent hover:text-[#b90014]'}`}
                >
                  {menu.label}
                </Link>
              </div>
            ))}
            <div className="relative flex items-center" onMouseEnter={() => setActiveMenu(null)}>
              <Link
                to="/custom-apparel"
                className="text-[11px] font-black uppercase tracking-normal whitespace-nowrap transition-all py-2 border-b-2 text-zinc-900 border-transparent hover:text-[#b90014]"
              >
                Custom Apparel
              </Link>
            </div>
          </nav>
        </div>

        {/* Right Section: Icons */}
        <div className="flex items-center gap-6 shrink-0">
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
            onMouseEnter={() => {
              if (menuCloseTimeoutRef.current) {
                clearTimeout(menuCloseTimeoutRef.current);
                menuCloseTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMenuMouseLeave}
          >
            {(() => {
              const menu = navigationMenus.find(m => m.label === activeMenu);
              if (!menu || menu.submenus.length === 0) return null;

              return (
                <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex min-h-[400px]">
                  {/* Left Column: Submenu Headings */}
                  <div className="w-80 border-r border-zinc-100 py-8 relative z-50">
                    {menu.submenus.map((submenu, idx) => {
                      const headingClass = `w-full text-left px-12 py-4 cursor-pointer transition-all border-l-4 ${activeSubmenu === submenu.heading ? 'bg-zinc-50 border-[#b90014] text-[#b90014]' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`;
                      const h3 = <h3 className="text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap">{submenu.heading}</h3>;
                      return submenu.path ? (
                        <Link
                          key={idx}
                          to={submenu.path}
                          onMouseEnter={() => setActiveSubmenu(submenu.heading)}
                          onClick={() => setActiveMenu(null)}
                          className={`block ${headingClass}`}
                        >
                          {h3}
                        </Link>
                      ) : (
                        <button
                          key={idx}
                          type="button"
                          onMouseEnter={() => setActiveSubmenu(submenu.heading)}
                          onClick={() => setActiveSubmenu(submenu.heading)}
                          className={headingClass}
                        >
                          {h3}
                        </button>
                      );
                    })}

                  </div>

                  {/* Right Column: Submenu Items */}
                  <div className="flex-1 p-12 bg-zinc-50/30 relative z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSubmenu}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
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
