import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const PORT = 3000;

// Initialize Supabase if credentials are provided
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = serviceRoleKey || anonKey || '';

if (supabaseUrl) {
  if (serviceRoleKey) {
    console.log("Supabase: Initializing with Service Role Key (Bypassing RLS)");
  } else if (anonKey) {
    console.log("Supabase: Initializing with Anon Key (RLS will be enforced!)");
    console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Settings updates may fail due to RLS.");
  }
}

export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
}) : null;

export const supabaseAdmin = supabase;

// File paths
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');
const LOCAL_SETTINGS_PATH = path.join(DATA_DIR, 'settings_exported.json');
const LOCAL_VARIANTS_PATH = path.join(DATA_DIR, 'product_variants.json');

// Helper for safe JSON reading
async function readSafeJson(filePath: string, defaultValue: any) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (e) {
    console.error(`Error reading/parsing JSON file ${filePath}:`, e);
    return defaultValue;
  }
}

// Cache to prevent too many Supabase hits
const apiCache = new Map<string, { data: any, expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function clearCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) apiCache.delete(key);
    }
  }
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data directory:", err);
  }
}

const app = express();

async function startServer() {
  await ensureDataDir();

  // Basic Middleware
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Debugging logger
  app.use((req, res, next) => {
    if (req.url !== '/api/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // --- API ROUTES ---

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: supabase ? "supabase" : "local",
      env: process.env.NODE_ENV,
      port: PORT
    });
  });

  // Products GET
  app.get("/api/products", async (req, res) => {
    const cacheKey = `products_${JSON.stringify(req.query)}`;
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    try {
      if (supabase) {
        const { category, submenu, isFeatured, isOnSale, isNewArrival, limit, offset, fields } = req.query;
        let query = supabase.from('products').select(typeof fields === 'string' && fields !== '*' ? fields : undefined);

        console.log("Supabase products query:", {
          category,
          submenu,
          isFeatured,
          isOnSale,
          isNewArrival,
          limit,
          offset,
          fields
        });

        if (category && category !== 'All' && category !== 'all') {
          query = query.ilike('category', category as string);
        }

        if (submenu) {
          const sub = submenu as string;
          // Filter by submenu (string) or submenus (array)
          query = query.or(`submenu.ilike.${sub},submenus.cs.{${sub}}`);
        }

        if (isFeatured === 'true') query = query.eq('isFeatured', true);
        if (isOnSale === 'true') query = query.eq('isOnSale', true);
        if (isNewArrival === 'true') query = query.eq('isNewArrival', true);

        const l = limit ? parseInt(limit as string) : 1000;
        const o = offset ? parseInt(offset as string) : 0;
        
        query = query.range(o, o + l - 1).order('name');

        const { data, error } = await query;
        if (error) {
          console.warn("Supabase products fetch with fields failed! Error:", JSON.stringify(error, null, 2));
          const { data: dataFallback, error: errorFallback } = await supabase.from('products').select('*').range(o, o + l - 1).order('name');
          if (errorFallback) {
            console.error("Fallback query also failed!", JSON.stringify(errorFallback, null, 2));
            throw errorFallback;
          }
          if (dataFallback && dataFallback.length > 0) {
            console.log("Fallback product keys are:", Object.keys(dataFallback[0]));
          } else {
            console.log("Fallback returned 0 products.");
          }
          const responseData = { data: dataFallback || [], mode: 'supabase' };
          apiCache.set(cacheKey, { data: responseData, expires: Date.now() + CACHE_TTL });
          return res.json(responseData);
        }
        
        const responseData = { data: data || [], mode: 'supabase' };
        apiCache.set(cacheKey, { data: responseData, expires: Date.now() + CACHE_TTL });
        return res.json(responseData);
      } else {
        const data = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        return res.json({ data, mode: 'local' });
      }
    } catch (err: any) {
      console.warn("Supabase products fetch failed:", JSON.stringify(err, null, 2));
      const data = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
      return res.json({ data, mode: 'local-fallback' });
    }
  });

  // Product POST (Individual Add)
  app.post("/api/products", async (req, res) => {
    const productData = req.body;
    if (!productData || !productData.name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    try {
      if (supabase) {
        const payload = { ...productData };
        if (!payload.category || (payload.category + '').trim() === '') {
          payload.category = 'Shoes';
        } else {
          payload.category = (payload.category + '').trim();
          if (payload.category.toLowerCase() === 'shoes' || payload.category.toLowerCase() === 'footwear') {
            payload.category = 'Shoes';
          }
        }
        if ('is_online' in payload) {
          let subs = Array.isArray(payload.submenus) ? [...payload.submenus] : [];
          if (payload.is_online) {
            const hasOnline = subs.some(s => s && s.toUpperCase() === 'ONLINE');
            if (!hasOnline) subs.push('online');
          } else {
            subs = subs.filter(s => s && s.toUpperCase() !== 'ONLINE');
            if (payload.submenu && payload.submenu.toUpperCase() === 'ONLINE') {
              payload.submenu = '';
            }
          }
          payload.submenus = subs;
          delete payload.is_online;
        }
        const { data, error } = await supabase.from('products').insert([payload]).select().single();
        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
        clearCache('products');
        return res.json(data);
      } else {
        const products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        const newProduct = { ...productData, id: Date.now().toString() };
        products.push(newProduct);
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json(newProduct);
      }
    } catch (err: any) {
      console.error("Error adding product:", err);
      if (err.message?.includes('row-level security') || err.message?.includes('RLS') || err.code === '42501') {
        return res.status(403).json({
          error: "Supabase RLS Policy Violation",
          message: "The server is being blocked by Supabase Row-Level Security (RLS). Please add the SUPABASE_SERVICE_ROLE_KEY to your environment variables to bypass RLS for admin actions."
        });
      }
      res.status(500).json({ error: err.message || "Failed to add product" });
    }
  });

  // Product GET (Individual)
  app.get("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (supabase) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) throw error;
        return res.json(data);
      } else {
        const products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        const product = products.find((p: any) => p.id === id);
        if (!product) return res.status(404).json({ error: "Product not found" });
        return res.json(product);
      }
    } catch (err: any) {
      console.error("Error fetching product:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API to mark all products available in the online store
  app.post("/api/products-mark-all-online", async (req, res) => {
    try {
      if (supabase) {
        // Fetch all products
        const { data: allProducts, error: fetchErr } = await supabase.from('products').select('*');
        if (fetchErr) throw fetchErr;

        if (allProducts && allProducts.length > 0) {
          // For each product, add 'online' mapping to its submenus
          for (const product of allProducts) {
            let subs: string[] = [];
            if (Array.isArray(product.submenus)) {
              subs = [...product.submenus];
            } else if (typeof product.submenus === 'string' && product.submenus) {
              try {
                subs = JSON.parse(product.submenus);
              } catch (_) {
                subs = (product.submenus as string).replace(/[{}]/g, '').split(',').map((s: string) => s.trim());
              }
            }
            
            // Normalize submenus to lowercase or check case-insensitively
            const lowerSubs = subs.map(s => String(s).toLowerCase());
            if (!lowerSubs.includes('online')) {
              subs.push('online');
            }

            await supabase.from('products').update({ submenus: subs }).eq('id', product.id);
          }
        }
        clearCache('products');
        return res.json({ success: true, count: allProducts?.length || 0 });
      } else {
        // Local fallback
        let products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        products = products.map((product: any) => {
          let subs = Array.isArray(product.submenus) ? [...product.submenus] : [];
          const lowerSubs = subs.map(s => String(s).toLowerCase());
          if (!lowerSubs.includes('online')) {
            subs.push('online');
          }
          return { ...product, submenus: subs };
        });
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json({ success: true, count: products.length });
      }
    } catch (err: any) {
      console.error("Error marking all online:", err);
      res.status(500).json({ error: err.message || "Failed to mark all products online" });
    }
  });

  // Product PUT (Update)
  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    try {
      if (supabase) {
        const payload = { ...updateData };
        delete payload.id; // Prevent updating primary key ID column in Supabase
        
        if (payload.category !== undefined) {
          if (!payload.category || (payload.category + '').trim() === '') {
            payload.category = 'Shoes';
          } else {
            payload.category = (payload.category + '').trim();
            if (payload.category.toLowerCase() === 'shoes' || payload.category.toLowerCase() === 'footwear') {
              payload.category = 'Shoes';
            }
          }
        }
        
        if ('is_online' in payload) {
          let subs = Array.isArray(payload.submenus) ? [...payload.submenus] : [];
          if (payload.is_online) {
            const hasOnline = subs.some(s => s && s.toUpperCase() === 'ONLINE');
            if (!hasOnline) subs.push('online');
          } else {
            subs = subs.filter(s => s && s.toUpperCase() !== 'ONLINE');
            if (payload.submenu && payload.submenu.toUpperCase() === 'ONLINE') {
              payload.submenu = '';
            }
          }
          payload.submenus = subs;
          delete payload.is_online;
        }

        const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single();
        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
        clearCache('products');
        return res.json(data);
      } else {
        let products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        const index = products.findIndex((p: any) => p.id === id);
        if (index === -1) return res.status(404).json({ error: "Product not found" });
        
        products[index] = { ...products[index], ...updateData };
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json(products[index]);
      }
    } catch (err: any) {
      console.error("Error updating product:", err);
      if (err.message?.includes('row-level security') || err.message?.includes('RLS') || err.code === '42501') {
        return res.status(403).json({
          error: "Supabase RLS Policy Violation",
          message: "The server is being blocked by Supabase Row-Level Security (RLS). Please add the SUPABASE_SERVICE_ROLE_KEY to your environment variables to bypass RLS for admin actions."
        });
      }
      res.status(500).json({ error: err.message || "Failed to update product" });
    }
  });

  // Product DELETE
  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete product with ID: ${id}`);
    try {
      if (supabase) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
          console.error(`Supabase delete error for ${id}:`, error);
          throw error;
        }
        clearCache('products');
        console.log(`Product ${id} deleted successfully from Supabase`);
        return res.json({ success: true });
      } else {
        let products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
        const initialLength = products.length;
        products = products.filter((p: any) => p.id !== id);
        
        if (products.length === initialLength) {
          console.log(`Product ${id} not found in local products`);
          return res.status(404).json({ error: "Product not found" });
        }
        
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        console.log(`Product ${id} deleted successfully from local storage`);
        return res.json({ success: true });
      }
    } catch (err: any) {
      console.error("Error deleting product:", err);
      if (err.message?.includes('row-level security') || err.message?.includes('RLS') || err.code === '42501') {
        return res.status(403).json({
          error: "Supabase RLS Policy Violation",
          message: "The server is being blocked by Supabase Row-Level Security (RLS). Please add the SUPABASE_SERVICE_ROLE_KEY to your environment variables to bypass RLS for admin actions."
        });
      }
      res.status(500).json({ error: err.message || "Failed to delete product" });
    }
  });

  // Standardize Database Assets and Fields
  app.post("/api/admin/standardize-db", async (req, res) => {
    console.log("POST /api/admin/standardize-db hit");
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!supabase) {
        return res.status(400).json({ error: "Supabase not connected. This feature requires Supabase." });
      }

      const results = {
        productsFixed: 0,
        navigationFixed: 0,
        errors: [] as string[]
      };

      const normalizePath = (p: string | null | undefined) => {
        if (!p) return null;
        let val = (p + '').trim(); // Coerce to string
        if (val.startsWith('http') || val.startsWith('data:')) return val;
        let normalized = val.toLowerCase();
        if (!normalized.startsWith('/')) normalized = '/' + normalized;
        return normalized;
      };

      const normalizeString = (s: string | null | undefined) => {
        if (!s) return null;
        return (s + '').trim().toLowerCase();
      };

      const normalizeCategory = (s: string | null | undefined) => {
        if (!s) return 'Shoes';
        const trimmed = (s + '').trim();
        const lower = trimmed.toLowerCase();
        if (lower === 'shoes' || lower === 'footwear') return 'Shoes';
        if (lower === 'accessories') return 'Accessories';
        if (lower === 'apparel') return 'Apparel';
        if (lower === 'clubs') return 'Clubs';
        if (lower === 'equipment') return 'Equipment';
        if (lower === 'teams') return 'Teams';
        if (lower === 'soccer balls') return 'Soccer Balls';
        if (lower === 'shin guards') return 'Shin Guards';
        if (lower === 'training') return 'Training';
        if (lower === 'custom lab') return 'Custom Lab';
        if (lower === 'uniform submission') return 'Uniform Submission';
        if (lower === 'national teams') return 'National Teams';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      };

      // 1. Standardize Products
      console.log("Standardizing products...");
      const { data: products, error: prodErr } = await supabase.from('products').select('*');
      if (prodErr) throw prodErr;

      const productUpdates: any[] = [];
      for (const p of (products || [])) {
        const updates: any = { id: p.id };
        let hasChanges = false;
        
        try {
          const normImage = normalizePath(p.image);
          if (normImage !== p.image) {
            updates.image = normImage;
            hasChanges = true;
          }

          if (Array.isArray(p.images)) {
            const normImages = p.images.map((img: any) => normalizePath(img));
            if (JSON.stringify(normImages) !== JSON.stringify(p.images)) {
              updates.images = normImages;
              hasChanges = true;
            }
          }

          const normCat = normalizeCategory(p.category);
          if (normCat !== p.category) {
            updates.category = normCat;
            hasChanges = true;
          }

          const normSub = normalizeString(p.submenu);
          if (normSub !== p.submenu) {
            updates.submenu = normSub;
            hasChanges = true;
          }

          if (Array.isArray(p.submenus)) {
            const normSubs = p.submenus.map((s: any) => normalizeString(s));
            if (JSON.stringify(normSubs) !== JSON.stringify(p.submenus)) {
              updates.submenus = normSubs;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            productUpdates.push(updates);
          }
        } catch (e: any) {
          results.errors.push(`Product ${p.id} processing fail: ${e.message}`);
        }
      }

      // Batch upsert products (using upsert with IDs behaves like an update)
      if (productUpdates.length > 0) {
        console.log(`Upserting ${productUpdates.length} products...`);
        // Split into chunks of 100 to be safe
        for (let i = 0; i < productUpdates.length; i += 100) {
          const chunk = productUpdates.slice(i, i + 100);
          const { error: upErr } = await supabase.from('products').upsert(chunk);
          if (upErr) {
            console.error("Product upsert error:", upErr);
            results.errors.push(`Product batch ${i}-${i+100} failed: ${upErr.message}`);
          } else {
            results.productsFixed += chunk.length;
          }
        }
      }

      // 2. Standardize Navigation
      console.log("Standardizing navigation...");
      const { data: items, error: itemErr } = await supabase.from('navigation_items').select('*');
      if (itemErr) throw itemErr;

      const itemUpdates: any[] = [];
      for (const item of (items || [])) {
        try {
          const navUpdates: any = { id: item.id };
          let hasChanges = false;
          const nLogo = normalizePath(item.logo_url);
          const nPath = normalizePath(item.path);

          if (nLogo !== item.logo_url) {
            navUpdates.logo_url = nLogo;
            hasChanges = true;
          }
          if (nPath !== item.path) {
            navUpdates.path = nPath;
            hasChanges = true;
          }

          if (hasChanges) {
            itemUpdates.push(navUpdates);
          }
        } catch (e: any) {
          results.errors.push(`NavItem ${item.id} processing fail: ${e.message}`);
        }
      }

      if (itemUpdates.length > 0) {
        console.log(`Upserting ${itemUpdates.length} navigation items...`);
        const { error: upErr } = await supabase.from('navigation_items').upsert(itemUpdates);
        if (upErr) {
          results.errors.push(`NavItems batch failed: ${upErr.message}`);
        } else {
          results.navigationFixed += itemUpdates.length;
        }
      }

      const { data: menus, error: menuErr } = await supabase.from('navigation_menus').select('*');
      if (!menuErr && menus) {
        const menuUpdates: any[] = [];
        for (const menu of menus) {
          try {
            const nPath = normalizePath(menu.path);
            if (nPath !== menu.path) {
              menuUpdates.push({ id: menu.id, path: nPath });
            }
          } catch (e: any) {
            results.errors.push(`NavMenu ${menu.id} processing fail: ${e.message}`);
          }
        }
        if (menuUpdates.length > 0) {
          const { error: upErr } = await supabase.from('navigation_menus').upsert(menuUpdates);
          if (!upErr) results.navigationFixed += menuUpdates.length;
        }
      }

      clearCache(); // Full clear
      console.log("Standardization complete successfully");
      return res.json({ success: true, message: "Standardization complete", results });
    } catch (error: any) {
      console.error("Standardization FATAL error:", error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || "An unknown error occurred during standardization" 
      });
    }
  });

  // Settings GET (Bulk or Key)
  app.get("/api/settings/bulk", async (req, res) => {
    try {
      if (supabase) {
        console.log("Fetching bulk settings from Supabase...");
        const { data: settings, error: settingsError } = await supabase.from('settings').select('*');
        const { data: menus, error: menusError } = await supabase.from('navigation_menus').select('*').order('order_index');
        const { data: items, error: itemsError } = await supabase.from('navigation_items').select('*').order('order_index');

        if (settingsError) {
          throw settingsError;
        }
        
        // Handle both key/data and id/config schemas if they exist
        const results = (settings || []).reduce((acc: any, curr: any) => {
          const k = curr.key || curr.id;
          const d = (curr.data !== undefined && curr.data !== null) ? curr.data : curr.config;
          if (k) acc[k] = d;
          return acc;
        }, {});

        // Helper to normalize paths (lowercase + leading slash if internal)
        const normalizePath = (p: string | null | undefined) => {
          if (!p) return null;
          let val = p.trim();
          
          const isAbsolute = val.startsWith('http') || val.startsWith('data:');
          
          if (isAbsolute) {
            return val; // Keep absolute URLs as is (case-sensitive)
          }

          let normalized = val.toLowerCase();
          // If it's an internal path and lacks leading slash, add it
          if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
          }
          return normalized;
        };

        // Reconstruct navigation to match the precise frontend NavMenu interface
        let reconstructedMenus = [];
        if (!menusError && !itemsError && menus && items) {
          reconstructedMenus = (menus || []).map((menu: any) => {
            const submenus = (items || [])
              .filter((item: any) => item.menu_id === menu.id && !item.parent_id)
              .map((col: any) => {
                const linkItems = (items || [])
                  .filter((subItem: any) => subItem.parent_id === col.id)
                  .map((link: any) => ({
                    id: link.id,
                    label: link.label || '',
                    path: normalizePath(link.path) || '#',
                    logo: normalizePath(link.logo_url)
                  }));

                return {
                  id: col.id,
                  heading: col.label || '',
                  path: normalizePath(col.path) || '',
                  logo: normalizePath(col.logo_url),
                  items: linkItems
                };
              });

            return {
              id: menu.id,
              label: menu.label || menu.name || '',
              path: normalizePath(menu.path) || '#',
              submenus: submenus
            };
          });
        }
        
        results.navigation = { navigationMenus: reconstructedMenus };
        
        res.header('X-Data-Mode', 'supabase');
        return res.json(results);
      } else {
        const data = await readSafeJson(LOCAL_SETTINGS_PATH, {});
        res.header('X-Data-Mode', 'local');
        return res.json(data);
      }
    } catch (err: any) {
      console.error("Error fetching settings:", err);
      const fileContent = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
      res.header('X-Data-Mode', 'local-fallback');
      return res.json(JSON.parse(fileContent));
    }
  });

  // Settings POST/PUT (Update specific key)
  app.post("/api/settings/:key", async (req, res) => {
    const { key } = req.params;
    const updates = req.body;
    
    console.log(`Updating setting for key: ${key}`);
    
    try {
      if (supabase) {
        // Fetch existing for merge if it's an object
        const { data: existingData, error: fetchError } = await supabase
          .from('settings')
          .select('*')
          .eq('key', key)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error(`Error fetching existing setting for ${key}:`, fetchError);
        }

        const existing = existingData?.data || existingData?.config || {};
        const newData = (existing && typeof existing === 'object' && typeof updates === 'object') 
          ? { ...existing, ...updates } 
          : updates;
          
        // Use upsert with key as the conflict target
        const upsertPayload: any = { key, data: newData };
        
        const { error } = await supabase
          .from('settings')
          .upsert(upsertPayload, { onConflict: 'key' });
 
        if (error) {
          console.error(`Supabase upsert error for ${key}:`, error);
          
          if (error.message.includes('row-level security') || error.code === '42501') {
            console.error("CRITICAL: RLS Violation detected. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment.");
            return res.status(403).json({ 
              error: "Supabase RLS Policy Violation", 
              message: "The server is being blocked by Supabase RLS. Please add the SUPABASE_SERVICE_ROLE_KEY to your environment variables to bypass RLS for admin actions.",
              details: error
            });
          }
          throw error;
        }
        
        return res.json(newData);
      } else {
        const settings = await readSafeJson(LOCAL_SETTINGS_PATH, {});
        const existing = settings[key] || {};
        const newData = (typeof existing === 'object' && typeof updates === 'object')
          ? { ...existing, ...updates }
          : updates;
          
        settings[key] = newData;
        await fs.writeFile(LOCAL_SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return res.json(newData);
      }
    } catch (err: any) {
      console.error(`Error save settings for ${key}:`, err);
      res.status(500).json({ error: err.message, details: err });
    }
  });

  // Legacy Settings GET
  app.get("/api/settings", async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('settings').select('*').single();
        if (error) throw error;
        return res.json(data.config);
      } else {
        const settings = await readSafeJson(LOCAL_SETTINGS_PATH, {});
        return res.json(settings);
      }
    } catch (err) {
      const settings = await readSafeJson(LOCAL_SETTINGS_PATH, {});
      return res.json(settings);
    }
  });

  // Admin Sync
  app.post("/api/admin/sync-local", async (req, res) => {
    if (!supabase) return res.status(400).json({ error: "Supabase not configured" });
    
    const { products, settings, clearExisting } = req.body;
    try {
      if (clearExisting) {
        await supabase.from('products').delete().neq('id', '0');
      }

      if (products && products.length > 0) {
        console.log(`Syncing ${products.length} products...`);
        const BATCH_SIZE = 50;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
          const batch = products.slice(i, i + BATCH_SIZE).map((p: any) => {
            const { id, ...rest } = p;
            return rest;
          });
          await supabase.from('products').insert(batch);
        }
      }

      if (settings) {
        // Try to sync settings to app_settings key
        await supabase.from('settings').upsert({ key: 'app_settings', data: settings, updated_at: new Date() }, { onConflict: 'key' });
        // Also try the old way just in case the schema is id/config
        try {
          await supabase.from('settings').upsert({ id: 'app_settings', config: settings, updated_at: new Date() }, { onConflict: 'id' });
        } catch (e) {
          console.warn("Legacy sync-local fallback failed (this is likely fine if you use key/data schema)");
        }
      }

      clearCache();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Sync failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/pull-from-cloud", async (req, res) => {
    if (!supabase) return res.status(400).json({ error: "Supabase not configured" });
    
    try {
      console.log("Pulling data from Supabase to local fallback...");
      const { data: products, error: pErr } = await supabase.from('products').select('*');
      if (pErr) throw pErr;

      const { data: settingsData, error: sErr } = await supabase.from('settings').select('*').single();
      
      if (products) {
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
      }
      
      if (settingsData) {
        await fs.writeFile(LOCAL_SETTINGS_PATH, JSON.stringify(settingsData.config, null, 2));
      }

      clearCache();
      res.json({ success: true, count: products?.length || 0 });
    } catch (err: any) {
      console.error("Pull failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/verify", async (req, res) => {
    try {
      const stats = {
        supabase: !!supabase,
        localProducts: 0,
        localSettings: false,
        supabaseProducts: 0
      };

      const localProducts = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
      stats.localProducts = localProducts.length;
      
      const localSettings = await readSafeJson(LOCAL_SETTINGS_PATH, {});
      stats.localSettings = Object.keys(localSettings).length > 0;

      if (supabase) {
        const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
        if (!error) stats.supabaseProducts = count || 0;
      }

      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Customer POST
  app.post("/api/customers", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    
    console.log("CRM Server Received Data:", req.body);
    
    try {
      const { data, error } = await supabase.from('customers').insert([req.body]).select();
      
      if (error) {
        if (error.code === '23505') {
          console.warn("Supabase CRM Conflict:", error);
          return res.status(409).json({ error: "A customer with this email already exists." });
        }
        console.error("Supabase CRM Write Error:", error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error adding customer:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Transaction POST
  app.post("/api/transactions", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    
    console.log("POS Server Received Transaction:", req.body);
    
    try {
      const { data, error } = await supabase.from('transactions').insert([req.body]).select();
      
      if (error) {
        console.error("Supabase Transaction Write Error:", error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error saving transaction:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Transaction GET
  app.get("/api/transactions", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase Transaction Fetch Error:", error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Transaction Refund POST
  app.post("/api/transactions/refund", async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured" });
    
    const { transactionId } = req.body;
    
    console.log("POS Server Received Refund Request for:", transactionId);
    
    try {
      // 1. Fetch original transaction
      const { data: original, error: fetchErr } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
        
      if (fetchErr) {
        console.error("Supabase Refund Fetch Error:", fetchErr);
        return res.status(500).json({ error: `Fetch error: ${fetchErr.message}` });
      }

      if (!original) {
        return res.status(444).json({ error: "Original transaction not found" });
      }

      // 2. Create balancing entry
      const payload = {
        total_amount: -Math.abs(Number(original.total_amount)),
        method: original.method,
        items: original.items,
        customer_id: original.customer_id,
        created_at: new Date().toISOString(),
        status: 'refunded'
      };
      
      console.log("Attempting to insert refund transaction:", payload);
      const { data, error } = await supabaseAdmin.from('transactions').insert([payload]).select();
      
      if (error) {
        console.error("Supabase Refund Write Error:", error);
        return res.status(500).json({ error: `Database error: ${error.message} - ${error.details || ''}` });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error processing refund:", err);
      res.status(500).json({ error: `Server error: ${err.message}` });
    }
  });

  // Transaction Void POST
  app.post("/api/transactions/void", async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured" });
    
    const { transactionId } = req.body;
    
    console.log("POS Server Received Void Request:", req.body);
    
    try {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'voided' })
        .eq('id', transactionId)
        .select();
      
      if (error) {
        console.error("Supabase Void Write Error:", error);
        return res.status(500).json({ error: `Database error: ${error.message} - ${error.details || ''}` });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error saving void:", err);
      res.status(500).json({ error: `Server error: ${err.message}` });
    }
  });

  // --- PRODUCT VARIANTS API ---

  const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  };

  // Get all variants for a product
  app.get("/api/products/:productId/variants", async (req, res) => {
    const { productId } = req.params;
    try {
      if (supabaseAdmin && isValidUUID(productId)) {
        const { data, error } = await supabaseAdmin
          .from('product_variants')
          .select('*')
          .eq('product_id', productId)
          .order('age_group', { ascending: true })
          .order('size', { ascending: true });
        if (!error) {
          return res.status(200).json({ success: true, data });
        }
        // Fallback if table doesn't exist yet but Supabase is configured
        console.log("Using local JSON file for product variants query.");
      }
      
      const variants = await readSafeJson(LOCAL_VARIANTS_PATH, []);
      const filtered = variants.filter((v: any) => v.product_id === productId);
      return res.status(200).json({ success: true, data: filtered });
    } catch (err: any) {
      console.error("Error getting product variants:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Save/Create a variant
  app.post("/api/products/:productId/variants", async (req, res) => {
    const { productId } = req.params;
    const variantData = req.body;
    
    if (!variantData.age_group || !variantData.size || !variantData.barcode) {
      return res.status(400).json({ error: "age_group, size, and barcode are required" });
    }
    
    try {
      const isProductUuid = isValidUUID(productId);
      const isVariantUuid = isValidUUID(variantData.id);
      
      const payload: any = {
        product_id: productId,
        age_group: variantData.age_group,
        size: variantData.size,
        barcode: variantData.barcode,
        stock_quantity: Number(variantData.stock_quantity || 0)
      };

      if (isVariantUuid) {
        payload.id = variantData.id;
      }

      if (supabaseAdmin && isProductUuid) {
        const { data, error } = await supabaseAdmin
          .from('product_variants')
          .upsert([payload], { onConflict: 'barcode' })
          .select();
          
        if (!error) {
          return res.status(200).json({ success: true, data });
        }
        console.log("Using local JSON file for product variants upsert.");
      }
      
      // Local fallback
      const variants = await readSafeJson(LOCAL_VARIANTS_PATH, []);
      const existingIndex = variants.findIndex((v: any) => v.barcode === payload.barcode);
      const newId = (isVariantUuid && variantData.id) ? variantData.id : `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const finalPayload = { ...payload, id: newId };
      
      if (existingIndex > -1) {
        variants[existingIndex] = { ...variants[existingIndex], ...finalPayload };
      } else {
        variants.push(finalPayload);
      }
      
      await fs.writeFile(LOCAL_VARIANTS_PATH, JSON.stringify(variants, null, 2));
      return res.status(200).json({ success: true, data: [finalPayload] });
    } catch (err: any) {
      console.error("Error creating variant:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a variant
  app.post("/api/products/:productId/variants/delete", async (req, res) => {
    const { variantId } = req.body;
    try {
      if (supabaseAdmin && isValidUUID(variantId)) {
        const { error } = await supabaseAdmin
          .from('product_variants')
          .delete()
          .eq('id', variantId);
        if (!error) {
          return res.status(200).json({ success: true });
        }
        console.log("Using local JSON file for product variants delete.");
      }
      
      const variants = await readSafeJson(LOCAL_VARIANTS_PATH, []);
      const filtered = variants.filter((v: any) => v.id !== variantId);
      await fs.writeFile(LOCAL_VARIANTS_PATH, JSON.stringify(filtered, null, 2));
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Error deleting variant:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Lookup variant by barcode
  app.get("/api/variants/barcode/:barcode", async (req, res) => {
    const { barcode } = req.params;
    try {
      if (supabaseAdmin) {
        const { data: variant, error } = await supabaseAdmin
          .from('product_variants')
          .select('*, products(*)')
          .eq('barcode', barcode)
          .single();
          
        if (!error && variant) {
          let product = variant.products;
          if (!product && variant.product_id) {
            const { data: prodData } = await supabaseAdmin.from('products').select('*').eq('id', variant.product_id).single();
            product = prodData;
          }
          const formatted = {
            id: variant.id,
            product_id: variant.product_id,
            age_group: variant.age_group,
            size: variant.size,
            barcode: variant.barcode,
            stock_quantity: variant.stock_quantity,
            product: product
          };
          return res.status(200).json({ success: true, data: formatted });
        }
        console.log("Using local JSON file for product variants barcode lookup.");
      }
      
      // Local fallback
      const variants = await readSafeJson(LOCAL_VARIANTS_PATH, []);
      const variant = variants.find((v: any) => v.barcode === barcode);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      
      const products = await readSafeJson(LOCAL_PRODUCTS_PATH, []);
      const product = products.find((p: any) => p.id === variant.product_id);
      
      return res.status(200).json({
        success: true,
        data: {
          ...variant,
          product
        }
      });
    } catch (err: any) {
      console.error("Error looking up barcode variant:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Customer GET
  app.get("/api/customers", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    
    try {
      const { data, error } = await supabase.from('customers').select('*').order('last_name', { ascending: true });
      
      if (error) {
        console.error("Supabase CRM Fetch Error:", error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error fetching customers:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE & STATIC ---

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) return res.status(404).json({ error: "API not found" });
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Final 404 for API
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
  });

  console.log("App setup complete");
  return app;
}

export { app };

// Initialize and start server
startServer().then((app) => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error("FATAL: Failed to start server:", err);
  const fallbackApp = express();
  fallbackApp.get('/', (req, res) => res.status(500).send(`Startup Error: ${err.message}`));
  fallbackApp.listen(PORT, "0.0.0.0");
});