import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from 'react';
import { DEFAULT_NAV, NavMenu, NavSubmenu, NavSubmenuItem } from '../constants/navigation';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

export type { NavMenu, NavSubmenu, NavSubmenuItem };

export interface FooterLink {
  label: string;
  path: string;
}

interface HomeCategory {
  name: string;
  description: string;
  image: string;
  path: string;
}

export interface SliderImage {
  url: string;
  title?: string;
  link?: string;
}

export interface SEO {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
  twitterCard: 'summary' | 'summary_large_image';
  canonicalUrl: string;
}

interface SettingsContextType {
  sliderImages: SliderImage[];
  setSliderImages: (images: SliderImage[]) => Promise<void>;
  logo: string;
  setLogo: (logo: string) => Promise<void>;
  landingLogo: string;
  setLandingLogo: (logo: string) => Promise<void>;
  labBackgroundImage: string;
  setLabBackgroundImage: (image: string) => Promise<void>;
  footerLogo: string;
  setFooterLogo: (logo: string) => Promise<void>;
  homeCategories: HomeCategory[];
  setHomeCategories: (categories: HomeCategory[]) => Promise<void>;
  navigationMenus: NavMenu[];
  setNavigationMenus: (menus: NavMenu[]) => Promise<void>;
  footerLinks: FooterLink[];
  setFooterLinks: (links: FooterLink[]) => Promise<void>;
  seoSettings: SEO;
  setSeoSettings: (seo: SEO) => Promise<void>;
  isLoading: boolean;
  setGlobalSettings: (settings: { logo?: string; landingLogo?: string; labBackgroundImage?: string; footerLogo?: string }) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [sliderImages, setSliderImagesState] = useState<SliderImage[]>([]);
  const [logo, setLogoState] = useState<string>('/logo.svg');
  const [landingLogo, setLandingLogoState] = useState<string>('/logo.svg');
  const [labBackgroundImage, setLabBackgroundImageState] = useState<string>('https://images.unsplash.com/photo-1551854838-212c50b4c184?q=80&w=2000&auto=format&fit=crop');
  const [footerLogo, setFooterLogoState] = useState<string>('/logo.svg');
  const [homeCategories, setHomeCategoriesState] = useState<HomeCategory[]>([]);
  const [footerLinks, setFooterLinksState] = useState<FooterLink[]>([]);
  const [navigationMenus, setNavigationMenusState] = useState<NavMenu[]>(DEFAULT_NAV);
  const [seoSettings, setSeoSettingsState] = useState<SEO>({
    title: 'Absolute Soccer | Mississauga\'s Premier Soccer Destination',
    description: 'Elite soccer footwear, apparel, and equipment. Professional uniform engineering and custom team gear.',
    keywords: 'soccer, mississauga, soccer shop, custom uniforms, soccer cleats, jerseys',
    ogImage: 'https://assets.cdn.filesafe.space/By2ouDwVDtWabLH4FJkE/media/69d71beda7dcb4cff069ed87.png',
    ogTitle: 'Absolute Soccer',
    ogDescription: 'Elite performance soccer gear and custom uniform engineering.',
    twitterCard: 'summary_large_image',
    canonicalUrl: 'https://absolutesoccer.ca'
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchAllSettings = async () => {
      console.log('SettingsContext: Fetching all settings...');
      setIsLoading(true);
      
      let results: any = null;
      let mode = 'unknown';

      try {
        const response = await fetch('/api/settings/bulk');
        const contentType = response.headers.get('content-type');
        
        if (!response.ok || (contentType && contentType.includes('text/html'))) {
          throw new Error('API unavailable or returned HTML');
        }
        
        results = await response.json();
        mode = response.headers.get('X-Data-Mode') || 'supabase-proxy';
      } catch (err) {
        console.warn('SettingsContext: API fetch failed, trying direct Supabase:', err);
        try {
          const { data, error } = await supabase.from('settings').select('key, data');
          if (error) throw error;
          if (data && data.length > 0) {
            results = data.reduce((acc: any, curr: any) => {
              acc[curr.key] = curr.data;
              return acc;
            }, {});
            mode = 'direct-supabase';
          }
        } catch (supabaseErr) {
          console.error('Direct Supabase settings fetch also failed:', supabaseErr);
        }
      }

      if (results) {
        console.log(`SettingsContext: Loaded settings successfully (Mode: ${mode})`);
        
        const global = results.global;
        const slider = results.slider;
        const home = results.homeCategories;
        const nav = results.navigation;
        const foot = results.footer;
        const seoData = results.seo;

        if (global?.logo) setLogoState(global.logo);
        if (global?.landingLogo) setLandingLogoState(global.landingLogo);
        if (global?.labBackgroundImage) setLabBackgroundImageState(global.labBackgroundImage);
        if (global?.footerLogo) setFooterLogoState(global.footerLogo);

        if (slider?.sliderImages) setSliderImagesState(slider.sliderImages);
        if (home?.homeCategories) setHomeCategoriesState(home.homeCategories);
        
        if (nav?.navigationMenus) {
          if (nav.navigationMenus.length > 0) {
            const merged = DEFAULT_NAV.map(defaultItem => {
              const serverItem = nav.navigationMenus.find((s: any) => s.label.toUpperCase() === defaultItem.label.toUpperCase());
              if (serverItem) {
                const submenus = (serverItem.submenus && serverItem.submenus.length > 0) 
                  ? serverItem.submenus 
                  : defaultItem.submenus;
                return { ...defaultItem, ...serverItem, submenus };
              }
              return defaultItem;
            });

            nav.navigationMenus.forEach((serverItem: any) => {
              if (!merged.find(m => m.label.toUpperCase() === serverItem.label.toUpperCase())) {
                merged.push(serverItem);
              }
            });

            setNavigationMenusState(merged);
          } else {
            setNavigationMenusState(DEFAULT_NAV);
          }
        }
        
        if (foot?.footerLinks) setFooterLinksState(foot.footerLinks);
        if (seoData && Object.keys(seoData).length > 0) setSeoSettingsState(prev => ({ ...prev, ...seoData }));
      }

      setIsLoading(false);
    };

    fetchAllSettings();
  }, [user]);

  const updateSettings = async (key: string, updates: any) => {
    try {
      const response = await fetch(`/api/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }
      
      const newData = await response.json();
      
      // Sync local state
      updateLocalState(key, newData);
    } catch (err) {
      console.warn(`API update for settings ${key} failed, trying direct Supabase fallback:`, err);
      try {
        const { data: existing } = await supabase.from('settings').select('data').eq('key', key).single();
        const newData = { ...(existing?.data || {}), ...updates };
        const { error: supError } = await supabase.from('settings').upsert({ key, data: newData }).select().single();
        if (supError) throw supError;
        updateLocalState(key, newData);
      } catch (supErr) {
        console.error(`Direct Supabase fallback for ${key} also failed:`, supErr);
        throw supErr;
      }
    }
  };

  const updateLocalState = (key: string, updates: any) => {
    if (key === 'global') {
      if (updates.logo) setLogoState(updates.logo);
      if (updates.landingLogo) setLandingLogoState(updates.landingLogo);
      if (updates.labBackgroundImage) setLabBackgroundImageState(updates.labBackgroundImage);
      if (updates.footerLogo) setFooterLogoState(updates.footerLogo);
    } else if (key === 'slider') {
      if (updates.sliderImages) setSliderImagesState(updates.sliderImages);
    } else if (key === 'homeCategories') {
      if (updates.homeCategories) setHomeCategoriesState(updates.homeCategories);
    } else if (key === 'navigation') {
      if (updates.navigationMenus) setNavigationMenusState(updates.navigationMenus);
    } else if (key === 'footer') {
      if (updates.footerLinks) setFooterLinksState(updates.footerLinks);
    } else if (key === 'seo') {
      setSeoSettingsState(prev => ({ ...prev, ...updates }));
    }
  };

  const setGlobalSettings = async (settings: { logo?: string; landingLogo?: string; labBackgroundImage?: string; footerLogo?: string }) => {
    await updateSettings('global', settings);
  };

  const setSliderImages = async (images: SliderImage[]) => {
    await updateSettings('slider', { sliderImages: images });
  };

  const setLogo = async (newLogo: string) => {
    await updateSettings('global', { logo: newLogo });
  };

  const setLandingLogo = async (newLogo: string) => {
    await updateSettings('global', { landingLogo: newLogo });
  };

  const setLabBackgroundImage = async (image: string) => {
    await updateSettings('global', { labBackgroundImage: image });
  };

  const setFooterLogo = async (newLogo: string) => {
    await updateSettings('global', { footerLogo: newLogo });
  };

  const setHomeCategories = async (categories: HomeCategory[]) => {
    await updateSettings('homeCategories', { homeCategories: categories });
  };

  const setFooterLinks = async (links: FooterLink[]) => {
    await updateSettings('footer', { footerLinks: links });
  };

  const setNavigationMenus = async (menus: NavMenu[]) => {
    await updateSettings('navigation', { navigationMenus: menus });
  };

  const setSeoSettings = async (seo: SEO) => {
    await updateSettings('seo', seo);
  };

  const resetSettings = async () => {
    window.location.reload(); 
  };

  const value = useMemo(() => ({ 
    sliderImages, 
    setSliderImages, 
    logo, 
    setLogo, 
    landingLogo,
    setLandingLogo,
    labBackgroundImage,
    setLabBackgroundImage,
    footerLogo,
    setFooterLogo,
    homeCategories, 
    setHomeCategories,
    footerLinks,
    setFooterLinks,
    navigationMenus,
    setNavigationMenus,
    seoSettings,
    setSeoSettings,
    resetSettings,
    setGlobalSettings,
    isLoading
  }), [sliderImages, logo, landingLogo, labBackgroundImage, footerLogo, homeCategories, navigationMenus, footerLinks, seoSettings, isLoading]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
