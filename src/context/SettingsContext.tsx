import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_NAV, NavMenu, NavSubmenu, NavSubmenuItem } from '../constants/navigation';
import { supabase, uploadImage } from '../supabase';
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
  setGlobalSettings: (settings: { logo?: string; landingLogo?: string; labBackgroundImage?: string; footerLogo?: string; show_sizes_online?: boolean }) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
  showSizesOnline: boolean;
  setShowSizesOnline: (show: boolean) => Promise<void>;
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
    canonicalUrl: 'https://torontosoccershop.com'
  });
  const [showSizesOnline, setShowSizesOnlineState] = useState<boolean>(() => {
    const cached = localStorage.getItem('show_sizes_online');
    return cached !== null ? cached === 'true' : false;
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isSavingRef = useRef(false);

  const location = useLocation();

  const fetchSettings = async () => {
      setIsLoading(true);

      try {
        let results: any = {};
        let mode = 'unknown';

        try {
          // Explicitly clear query caches from browser client request headers
          const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('*');

          if (settingsError) throw settingsError;

          if (settingsData) {
            results = settingsData.reduce((acc: any, curr: any) => {
              // Bugfix: Prioritize strict unique keys to prevent duplicate index overrides
              const k = curr.key || curr.id;
              const d = (curr.data !== undefined && curr.data !== null) ? curr.data : curr.config;
              if (k) acc[k] = d;
              return acc;
            }, {});
          }

          // Fetch relational navigation data (only if tables have content)
          const { data: menus, error: menusError } = await supabase.from('navigation_menus').select('*').order('order_index');
          const { data: items, error: itemsError } = await supabase.from('navigation_items').select('*').order('order_index');

          // Use relational tables only if they have data
          if (!menusError && !itemsError && menus && menus.length > 0 && items && items.length > 0) {
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
          }

          mode = 'direct-supabase';
        } catch (err) {
          console.warn('SettingsContext: Supabase fetch failed:', err);
        }

        if (results) {
          const global = results.global;
          const slider = results.slider;
          const home = results.homeCategories;
          const nav = results.navigation;
          const foot = results.footer;
          const seoData = results.seo;

          if (global?.logo) {
            setLogoState(global.logo);
          }
          if (global?.landingLogo) setLandingLogoState(global.landingLogo);
          if (global?.labBackgroundImage) setLabBackgroundImageState(global.labBackgroundImage);
          if (global?.footerLogo) setFooterLogoState(global.footerLogo);
          if (global?.show_sizes_online !== undefined) setShowSizesOnlineState(global.show_sizes_online);

          if (slider) {
            let imgs: any[] = [];
            if (Array.isArray(slider)) {
              imgs = slider;
            } else if (slider.sliderImages && Array.isArray(slider.sliderImages)) {
              imgs = slider.sliderImages;
            } else if (Array.isArray(slider.config)) {
              imgs = slider.config;
            }
            setSliderImagesState(imgs);
          }
          if (home?.homeCategories) setHomeCategoriesState(home.homeCategories);
          
          if (nav?.navigationMenus) {
            if (nav.navigationMenus.length > 0) {
              const merged = DEFAULT_NAV.map(defaultItem => {
                const serverItem = nav.navigationMenus.find((s: any) => s.label.toUpperCase() === defaultItem.label.toUpperCase());
                if (serverItem) {
                  // Use server submenus if they exist, otherwise fall back to defaults
                  const submenus = (serverItem.submenus && serverItem.submenus.length > 0)
                    ? serverItem.submenus
                    : defaultItem.submenus;
                  // Spread serverItem FIRST to prioritize DB data, then add any missing defaults
                  return { ...serverItem, submenus };
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
      } catch (criticalErr) {
        console.error('Critical context collection fault:', criticalErr);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchSettings();
  }, [user, location.pathname]);

  const autoUploadBase64 = async (obj: any, pathPrefix: string = 'media'): Promise<any> => {
    if (!obj) return obj;

    if (typeof obj === 'string') {
      if (obj.startsWith('data:image/')) {
        try {
          let ext = 'jpg';
          const match = obj.match(/data:image\/(.*?);base64/);
          if (match && match[1]) {
            ext = match[1];
          }
          const path = `${pathPrefix}/auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
          const publicUrl = await uploadImage(obj, path);
          return publicUrl;
        } catch (err) {
          console.error('Base64 automatic image convert fallback error:', err);
          throw err;
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      const newArr = [];
      for (const item of obj) {
        newArr.push(await autoUploadBase64(item, pathPrefix));
      }
      return newArr;
    }

    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const k of Object.keys(obj)) {
        newObj[k] = await autoUploadBase64(obj[k], `${pathPrefix}_${k}`);
      }
      return newObj;
    }

    return obj;
  };

  const updateSettings = async (key: string, updates: any) => {
    isSavingRef.current = true;
    updateLocalState(key, updates);
    
    try {
      const cleanUpdates = await autoUploadBase64(updates, key);
      const payload = JSON.stringify(cleanUpdates);
      const payloadSize = payload.length;

      if (payload.includes('data:image')) {
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
        
        const paths = findPath(cleanUpdates);
        const errorMsg = `Payload validation alert: Unsaved processing assets remain at: ${paths.join(', ')}. Clear processing arrays before pushing layout changes.`;
        alert(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Step 1: Force target cell save by running a precise update statement mapping key row directly
      const { data: updateData, error: errUpdate } = await supabase
        .from('settings')
        .update({ data: cleanUpdates })
        .eq('key', key)
        .select();

      if (!errUpdate && updateData && updateData.length > 0) {
        updateLocalState(key, cleanUpdates);
        return;
      }

      const { error: err1 } = await supabase
        .from('settings')
        .upsert(
          { key, data: cleanUpdates },
          { onConflict: 'key' }
        );

      if (!err1) {
        updateLocalState(key, cleanUpdates);
        return;
      }

      if (payloadSize > 4000000) {
        throw new Error(`Data frame limits exceeded size parameters (${(payloadSize / 1024 / 1024).toFixed(2)}MB). Clear file directories.`);
      }

      const response = await fetch(`/api/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      if (!response.ok) {
        if (response.status === 413 || text.toUpperCase().includes('TOO LARGE')) {
          throw new Error('Payload constraints processing limit error (Max threshold 4.5MB). Optimize file configurations.');
        }
        throw new Error(`Proxy error code (${response.status}): ${text.substring(0, 100)}`);
      }

      let result: any;
      if (contentType && contentType.includes('application/json')) {
        result = JSON.parse(text);
      } else {
        result = cleanUpdates;
      }
      
      updateLocalState(key, result);
    } catch (err: any) {
      console.error(`Settings collection modification fault for key ${key}:`, err);
      throw err;
    } finally {
      isSavingRef.current = false;
    }
  };

  const updateLocalState = (key: string, updates: any) => {    
    if (key === 'global') {
      if (updates.logo) setLogoState(updates.logo);
      if (updates.landingLogo) setLandingLogoState(updates.landingLogo);
      if (updates.labBackgroundImage) setLabBackgroundImageState(updates.labBackgroundImage);
      if (updates.footerLogo) setFooterLogoState(updates.footerLogo);
      if (updates.show_sizes_online !== undefined) setShowSizesOnlineState(updates.show_sizes_online);
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

  const setGlobalSettings = async (settings: { logo?: string; landingLogo?: string; labBackgroundImage?: string; footerLogo?: string; show_sizes_online?: boolean }) => {
    await updateSettings('global', settings);
  };

  const setShowSizesOnline = async (value: boolean) => {
    setShowSizesOnlineState(value);
    await updateSettings('global', { 
      logo: logo,
      show_sizes_online: value 
    });
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

  const updateNavigationItem = async (itemId: string, updates: Record<string, any>, logoFile?: File) => {
    let finalUpdates = { ...updates };

    if (logoFile) {
      try {
        const path = `nav/item_${Date.now()}_${logoFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const publicUrl = await uploadImage(logoFile, path, 'navigation_logos');
        finalUpdates.logo_url = publicUrl;
      } catch (err: any) {
        delete finalUpdates.logo_url;
      }
    }

    try {
      const { error } = await supabase.from('navigation_items').update(finalUpdates).eq('id', itemId);
      if (error) throw error;
      
      await fetchSettings();
    } catch (err: any) {
      console.warn('Navigation item table update failed, falling back to in-memory/key-value updates:', err);
      
      let updated = false;
      const newMenus = navigationMenus.map(menu => {
        const newSubmenus = menu.submenus.map(sub => {
          if (sub.id === itemId) {
            updated = true;
            return {
              ...sub,
              heading: updates.label !== undefined ? updates.label : (updates.heading !== undefined ? updates.heading : sub.heading),
              path: updates.path !== undefined ? updates.path : sub.path,
              logo: finalUpdates.logo_url !== undefined ? finalUpdates.logo_url : (updates.logo_url !== undefined ? updates.logo_url : sub.logo),
            };
          }
          const newItems = sub.items.map(item => {
            if (item.id === itemId) {
              updated = true;
              return {
                ...item,
                label: updates.label !== undefined ? updates.label : item.label,
                path: updates.path !== undefined ? updates.path : item.path,
                logo: finalUpdates.logo_url !== undefined ? finalUpdates.logo_url : (updates.logo_url !== undefined ? updates.logo_url : item.logo),
              };
            }
            return item;
          });
          return { ...sub, items: newItems };
        });
        return { ...menu, submenus: newSubmenus };
      });

      if (updated) {
        await saveNavigation(newMenus);
      } else {
        console.error("Item with id not found in navigation menus:", itemId);
        throw new Error(`Item ${itemId} not found in current navigation menus tree.`);
      }
    }
  };

  const saveNavigation = async (menus: NavMenu[]) => {
    const normalizePath = (p: string | null | undefined) => {
      if (!p) return null;
      let normalized = p.trim().toLowerCase();
      if (!normalized.startsWith('http') && !normalized.startsWith('data:') && !normalized.startsWith('/')) {
        normalized = '/' + normalized;
      }
      return normalized;
    };

    try {
      // Delete items before menus (items have FK reference to menus)
      const { error: delItemsErr } = await supabase.from('navigation_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delItemsErr) throw delItemsErr;
      const { error: delMenusErr } = await supabase.from('navigation_menus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delMenusErr) throw delMenusErr;

      for (let m = 0; m < menus.length; m++) {
        const menu = menus[m];
        const { data: insertedMenu, error: menuErr } = await supabase
          .from('navigation_menus')
          .insert({
            label: menu.label,
            path: normalizePath(menu.path) || '#',
            order_index: m
          })
          .select()
          .single();
        if (menuErr) throw menuErr;

        for (let s = 0; s < menu.submenus.length; s++) {
          const sub = menu.submenus[s];
          const { data: insertedSub, error: subErr } = await supabase
            .from('navigation_items')
            .insert({
              menu_id: insertedMenu.id,
              label: sub.heading,
              path: normalizePath(sub.path) || '',
              logo_url: normalizePath(sub.logo),
              order_index: s
            })
            .select()
            .single();
          if (subErr) throw subErr;

          for (let i = 0; i < sub.items.length; i++) {
            const item = sub.items[i];
            const { error: itemErr } = await supabase
              .from('navigation_items')
              .insert({
                menu_id: insertedMenu.id,
                parent_id: insertedSub.id,
                label: item.label,
                path: normalizePath(item.path) || '#',
                logo_url: normalizePath(item.logo),
                order_index: i
              });
            if (itemErr) throw itemErr;
          }
        }
      }
      await fetchSettings();
    } catch (err: any) {
      console.warn('Relational navigation tables are unavailable in database. Falling back to Saving XML/JSON layout directly in key-value settings table:', err);
      try {
        await updateSettings('navigation', { navigationMenus: menus });
        await fetchSettings();
      } catch (fallbackErr: any) {
        console.error('Settings backup save also failed:', fallbackErr);
        throw fallbackErr;
      }
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
    saveNavigation,
    seoSettings,
    setSeoSettings,
    resetSettings,
    setGlobalSettings,
    isLoading,
    showSizesOnline,
    setShowSizesOnline
  }), [sliderImages, logo, landingLogo, labBackgroundImage, footerLogo, homeCategories, navigationMenus, footerLinks, seoSettings, isLoading, showSizesOnline]);

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

export async function forceManualNavigationMigration() {
  try {
    const { data: settingsRow, error: fetchError } = await supabase
      .from('settings')
      .select('data')
      .eq('key', 'navigation')
      .single();

    if (fetchError || !settingsRow?.data) {
      alert("Error reading legacy settings row.");
      return;
    }

    const rawJSON = JSON.parse(JSON.stringify(settingsRow.data));
    const menusArray = rawJSON.navigationMenus || [];
    
    if (menusArray.length === 0) {
      alert("No data found inside navigationMenus layout array.");
      return;
    }

    // 1. Clear out any failed structural records first
    await supabase.from('navigation_items').delete().neq('id', '0');
    await supabase.from('navigation_menus').delete().neq('id', '0');

    // 2. Map the parent menus
    for (let m = 0; m < menusArray.length; m++) {
      const menu = menusArray[m];
      
      const { data: insertedMenu, error: menuErr } = await supabase
        .from('navigation_menus')
        .insert({
          label: menu.name || menu.label,
          path: menu.path || '#',
          order_index: m
        })
        .select()
        .single();

      if (menuErr || !insertedMenu) {
        console.error("Failed inserting menu row:", menuErr);
        continue;
      }

      // 3. Extract columns under this parent menu
      const columns = menu.columns || [];
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        
        // Create a subcategory parent node if it has individual links
        const { data: parentNode, error: parentNodeErr } = await supabase
          .from('navigation_items')
          .insert({
            menu_id: insertedMenu.id,
            label: col.name || col.heading || col.label,
            path: col.path || '',
            order_index: c
          })
          .select()
          .single();

        if (parentNodeErr || !parentNode) continue;

        // 4. Extract individual target items/links inside that column group
        const links = col.links || col.items || [];
        for (let l = 0; l < links.length; l++) {
          const link = links[l];
          
          const { error: itemErr } = await supabase
            .from('navigation_items')
            .insert({
              menu_id: insertedMenu.id,
              parent_id: parentNode.id, // Links are children of the column header node
              label: link.label || link.name,
              path: link.path || '#',
              logo_url: link.logo_url || link.icon || null,
              order_index: l
            });

          if (itemErr) console.error("Failed inserting link item:", itemErr);
        }
      }
    }

    alert("Database sync successful! Structural rows populated.");
    window.location.reload();
  } catch (err: any) {
    alert("Migration block exception: " + err.message);
  }
}
