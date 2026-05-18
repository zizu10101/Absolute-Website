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
  setGlobalSettings: (settings: { logo?: string; landingLogo?: string; labBackgroundImage?: string; footerLogo?: string }) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
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

  const fetchSettings = async () => {
      console.log('SettingsContext: Fetching all settings...');
      setIsLoading(true);
      
      let results: any = null;
      let mode = 'unknown';

      try {
        const { data: settingsData, error: settingsError } = await supabase.from('settings').select('key, data');
        if (settingsError) throw settingsError;

        if (settingsData) {
          results = settingsData.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.data;
            return acc;
          }, {});
        }

        // Fetch relational navigation data
        const { data: menus, error: menusError } = await supabase.from('navigation_menus').select('*').order('order_index');
        const { data: items, error: itemsError } = await supabase.from('navigation_items').select('*').order('order_index');

        if (!menusError && !itemsError && menus && items) {
          const reconstructedMenus = menus.map(menu => ({
            id: menu.id,
            label: menu.label,
            path: menu.path,
            submenus: items
              .filter(item => item.menu_id === menu.id && !item.parent_id)
              .map(submenuItem => ({
                id: submenuItem.id,
                heading: submenuItem.label,
                path: submenuItem.path,
                logo: submenuItem.logo_url,
                items: items
                  .filter(subItem => subItem.parent_id === submenuItem.id)
                  .map(subItem => ({
                    id: subItem.id,
                    label: subItem.label,
                    path: subItem.path,
                    logo: subItem.logo_url
                  }))
              }))
          }));
          
          if (!results) results = {};
          results.navigation = { navigationMenus: reconstructedMenus };
          console.log(`SettingsContext: Reconstructed ${reconstructedMenus.length} menus from navigation tables`);
        }

        mode = 'direct-supabase';
      } catch (err) {
        console.warn('SettingsContext: Direct Supabase fetch failed, trying API proxy:', err);
        try {
          const response = await fetch('/api/settings/bulk');
          const contentType = response.headers.get('content-type');
          if (response.ok && contentType?.includes('application/json')) {
            results = await response.json();
            mode = 'api-proxy';
          }
        } catch (apiErr) {
          console.error('API fetch also failed:', apiErr);
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

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const updateSettings = async (key: string, updates: any) => {
    try {
      const payload = JSON.stringify(updates);
      const payloadSize = payload.length;
      
      console.log(`ACTUAL RAW PAYLOAD SIZE FOR ${key.toUpperCase()}:`, payloadSize, "bytes");

      // Safety check: Block if payload contains base64/data:image strings
      if (payload.includes('data:image')) {
        console.error(`BLOCKING NETWORK EXECUTION: Base64 detected in ${key} payload!`);
        
        // Find the exact path for better debugging
        const findPath = (obj: any, path: string = ''): string[] => {
          let results: string[] = [];
          if (!obj) return results;
          if (typeof obj === 'string' && obj.includes('data:image')) {
            results.push(path);
          } else if (Array.isArray(obj)) {
            obj.forEach((item, i) => {
              results = [...results, ...findPath(item, `${path}[${i}]`)];
            });
          } else if (typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
              results = [...results, ...findPath(obj[key], path ? `${path}.${key}` : key)];
            });
          }
          return results;
        };
        
        const paths = findPath(updates);
        const errorMsg = `CRITICAL ERROR: Unsaved image data (base64) detected in ${key} payload at: ${paths.join(', ')}. The request was blocked to prevent server errors. Please ensure all images are uploaded before saving.`;
        alert(errorMsg);
        throw new Error(errorMsg);
      }
      
      // 1. Try Direct Supabase Upsert FIRST (Bypasses Vercel Payload Limits)
      console.log(`SettingsContext: Attempting direct Supabase upsert for ${key}...`);
      const { data: upsertData, error: upsertError } = await supabase
        .from('settings')
        .upsert({ 
          key, 
          data: updates,
          updated_at: new Date()
        }, { onConflict: 'key' })
        .select();

      if (!upsertError) {
        console.log(`SettingsContext: Direct Supabase save successful for ${key}`);
        updateLocalState(key, updates);
        return;
      }

      console.warn(`SettingsContext: Direct Supabase upsert failed for ${key}, falling back to API:`, upsertError);

      // 2. Fallback to API if RLS or other issues prevent direct write
      // Vercel limit is 4.5MB, we check at 4MB to be safe
      if (payloadSize > 4000000) {
        throw new Error(`THE DATA YOU ARE TRYING TO SAVE IS TOO LARGE (${(payloadSize / 1024 / 1024).toFixed(2)}MB). Please remove some images or simplify your menus to stay under the 4MB limit.`);
      }

      const response = await fetch(`/api/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      if (!response.ok) {
        console.error(`Status ${response.status} from server for ${key}:`, text.substring(0, 200));
        
        // Handle common proxy errors like 413 or Vercel's FUNCTION_PAYLOAD_TOO_LARGE
        if (response.status === 413 || 
            text.toUpperCase().includes('ENTITY TOO LARGE') || 
            text.toUpperCase().includes('TOO LARGE') ||
            text.toUpperCase().includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
          throw new Error('THE DATA YOU ARE TRYING TO SAVE IS TOO LARGE for the server (limit is 4.5MB). Please reduce the size of your images or submenus.');
        }
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorResult = JSON.parse(text);
            throw new Error(errorResult.error || `Server Error: ${response.statusText}`);
          }
        } catch (e) {
          // Fallback if not JSON or parsing fails
        }
        
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 100) || response.statusText}`);
      }

      let result: any;
      try {
        if (contentType && contentType.includes('application/json')) {
          result = JSON.parse(text);
        } else {
          // If 200 OK but not JSON, we assume success for safety
          console.warn(`Success but non-JSON response for ${key}:`, text.substring(0, 50));
          result = updates;
        }
      } catch (parseErr: any) {
        console.error(`Failed to parse response for ${key}:`, text.substring(0, 200));
        throw new Error("The server saved your changes but returned an invalid response. Please refresh the page.");
      }
      
      // Sync local state
      updateLocalState(key, result);
    } catch (err: any) {
      console.error(`Settings update for ${key} failed:`, err);
      throw err;
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

  const updateNavigationItem = async (itemId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase.from('navigation_items').update(updates).eq('id', itemId);
      if (error) throw error;
      
      // Update local state by forcing a re-fetch or updating local array
      // Re-fetch is safer for now
      await fetchSettings();
    } catch (err: any) {
      console.error('SettingsContext: Failed to update navigation item:', err);
      throw err;
    }
  };

  const updateNavigationMenu = async (menuId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase.from('navigation_menus').update(updates).eq('id', menuId);
      if (error) throw error;
      await fetchSettings();
    } catch (err: any) {
      console.error('SettingsContext: Failed to update navigation menu:', err);
      throw err;
    }
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
    updateNavigationItem,
    updateNavigationMenu,
    seoSettings,
    setSeoSettings,
    resetSettings,
    setGlobalSettings,
    isLoading
  }), [sliderImages, logo, landingLogo, labBackgroundImage, footerLogo, homeCategories, navigationMenus, updateNavigationItem, updateNavigationMenu, footerLinks, seoSettings, isLoading]);

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
