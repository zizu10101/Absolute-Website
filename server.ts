import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
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

  // Migration route to fix product categories
  app.get("/api/migrate-categories", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .update({ category: 'Footwear' })
        .in('category', ['Shoes', 'shoes', 'SHOES']);
        
      if (error) throw error;
      res.json({ success: true, message: "Migration complete" });
    } catch (err) {
      res.status(500).json({ error: (err as any).message });
    }
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
        // Revert to * for now to avoid field selection errors
        let query = supabase.from('products').select('*');
        
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
          const sub = (submenu as string).toLowerCase();
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
          console.warn("Supabase products fetch failed! Error code:", error.code, "Message:", error.message, "Details:", error.details, "Hint:", error.hint);
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

  const cleanProductPayload = (rawPayload: any): any => {
    const allowedColumns = [
      'id', 'name', 'price', 'category', 'submenu', 'submenus',
      'image', 'images', 'description', 'isNewArrival', 'isOnSale',
      'isFeatured', 'salePrice', 'colors', 'show_sizes', 'is_online', 'release_date'
    ];
    const cleaned: any = {};
    for (const col of allowedColumns) {
      if (rawPayload[col] !== undefined) {
        cleaned[col] = rawPayload[col];
      }
    }
    return cleaned;
  };

  // Product POST (Individual Add)
  app.post("/api/products", async (req, res) => {
    const productData = req.body;
    if (!productData || !productData.name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    try {
      if (supabase) {
        let prepared = { ...productData };
        if (!prepared.category || (prepared.category + '').trim() === '') {
          prepared.category = 'Footwear';
        } else {
          prepared.category = (prepared.category + '').trim();
          if (prepared.category.toLowerCase() === 'shoes' || prepared.category.toLowerCase() === 'footwear') {
            prepared.category = 'Footwear';
          }
        }

        const payload = cleanProductPayload(prepared);
        const { data, error } = await supabase.from('products').insert([payload]).select();
        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
        const insertedProduct = data && data.length > 0 ? data[0] : null;
        clearCache('products');
        return res.json(insertedProduct);
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
        let prepared = { ...updateData };
        delete prepared.id; // Prevent updating primary key ID column in Supabase
        
        if (prepared.category !== undefined) {
          if (!prepared.category || (prepared.category + '').trim() === '') {
            prepared.category = 'Footwear';
          } else {
            prepared.category = (prepared.category + '').trim();
            if (prepared.category.toLowerCase() === 'shoes' || prepared.category.toLowerCase() === 'footwear') {
              prepared.category = 'Footwear';
            }
          }
        }

        const payload = cleanProductPayload(prepared);
        const { data, error } = await supabase.from('products').update(payload).eq('id', id).select();
        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
        const updatedProduct = data && data.length > 0 ? data[0] : null;
        clearCache('products');
        return res.json(updatedProduct);
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
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured" });

    console.log("POS Server Received Transaction:", req.body);

    try {
      const { data, error } = await supabaseAdmin.from('transactions').insert([req.body]).select();

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
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured" });

    try {
      console.log("📥 GET /api/transactions called");
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const customer_id = req.query.customer_id as string | undefined;

      console.log("📥 Query params - limit:", limit, "customer_id:", customer_id);

      let query = supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false });

      // Filter by customer_id if provided
      if (customer_id) {
        query = query.eq('customer_id', customer_id);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      console.log("📥 Query result - error:", error ? error.message : "none", "data count:", data ? data.length : 0);

      if (data && data.length > 0) {
        console.log("📥 First 3 transactions:", data.slice(0, 3).map((t: any) => ({
          id: t.id.slice(0, 8),
          status: t.status,
          created_at: t.created_at,
          total_amount: t.total_amount
        })));
      }

      if (error) {
        console.error("Supabase Transaction Fetch Error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Transaction Refund POST
  app.post("/api/transactions/refund", async (req, res) => {
    console.log("🟠 STEP 1: REFUND endpoint called");
    console.log("🟠 STEP 1a: Full request body:", JSON.stringify(req.body, null, 2));

    if (!supabaseAdmin) {
      console.error("❌ STEP 1b: Supabase not configured");
      return res.status(500).json({ error: "Supabase not configured" });
    }
    console.log("🟠 STEP 1c: Supabase admin client exists");

    const { transactionId } = req.body;
    console.log("🟠 STEP 2: Extracted transactionId:", transactionId);

    if (!transactionId) {
      console.error("❌ STEP 2a: transactionId is missing or null");
      return res.status(400).json({ error: "transactionId is required" });
    }

    try {
      // Fetch original transaction
      console.log("🟠 STEP 3: Fetching original transaction...");
      const { data: original, error: fetchErr } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      console.log("🟠 STEP 3a: Fetch result - error:", fetchErr ? fetchErr.message : "none", "data exists:", !!original);

      if (fetchErr || !original) {
        console.error("❌ STEP 3b: Transaction not found - error:", fetchErr);
        return res.status(404).json({ error: "Original transaction not found or fetch error" });
      }

      console.log("🟠 STEP 3c: Original transaction found - current status:", original.status);

      // Update original transaction status to 'refunded'
      console.log("🟠 STEP 4: Updating original transaction status to 'refunded'...");
      const { data: updateData, error: updateErr } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('id', transactionId)
        .select();

      console.log("🟠 STEP 4a: UPDATE response - error:", updateErr ? updateErr.message : "none");
      console.log("🟠 STEP 4b: UPDATE data:", updateData ? JSON.stringify(updateData, null, 2) : "null");

      if (updateErr) {
        console.error("❌ STEP 4c: Supabase UPDATE error:", updateErr.message, updateErr.details, updateErr.hint);
        return res.status(500).json({ error: `Database error: ${updateErr.message}` });
      }

      if (!updateData || updateData.length === 0) {
        console.warn("⚠️ STEP 4d: UPDATE succeeded but no rows returned (RLS or constraints issue?)");
      }

      // Also create a refund record for tracking
      const refundPayload = {
        total_amount: Number(original.total_amount) * -1,
        method: original.method,
        payment_method: original.payment_method || original.method,
        status: 'refunded',
        items: original.items,
        customer_id: original.customer_id,
        created_at: new Date().toISOString(),
        total_price: Math.abs(Number(original.total_amount || original.total_price) * -1)
      };

      console.log("🟠 STEP 5: Creating refund record (negative amount)...");
      console.log("🟠 STEP 5a: Refund payload:", JSON.stringify(refundPayload, null, 2));

      const { data, error } = await supabaseAdmin.from('transactions').insert([refundPayload]).select();

      console.log("🟠 STEP 5b: INSERT response - error:", error ? error.message : "none");
      console.log("🟠 STEP 5c: INSERT data:", data ? JSON.stringify(data, null, 2) : "null");

      if (error) {
        console.error("❌ STEP 5d: Supabase INSERT error:", error.message, error.details, error.hint);
        return res.status(500).json({ error: `Database error: ${error.message}` });
      }

      console.log("✅ STEP 6: Transaction marked as refunded successfully");
      console.log("✅ STEP 6a: Original transaction ID:", transactionId);
      console.log("✅ STEP 6b: Refund record created");

      return res.status(200).json({ success: true, data, message: "Refund processed successfully" });
    } catch (err: any) {
      console.error("❌ STEP 7: Caught exception:", err);
      console.error("   - Message:", err.message);
      console.error("   - Stack:", err.stack);
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }
  });

  // Transaction Void POST
  app.post("/api/transactions/void", async (req, res) => {
    console.log("🔵 STEP 1: VOID endpoint called");
    console.log("🔵 STEP 1a: Full request body:", JSON.stringify(req.body, null, 2));

    if (!supabaseAdmin) {
      console.error("❌ STEP 1b: Supabase not configured");
      return res.status(500).json({ error: "Supabase not configured" });
    }
    console.log("🔵 STEP 1c: Supabase admin client exists");

    const { transactionId } = req.body;
    console.log("🔵 STEP 2: Extracted transactionId:", transactionId);

    if (!transactionId) {
      console.error("❌ STEP 2a: transactionId is missing or null");
      return res.status(400).json({ error: "transactionId is required" });
    }
    console.log("🔵 STEP 2b: transactionId is valid:", typeof transactionId, "length:", transactionId.length);

    try {
      // Fetch transaction first to verify it exists
      console.log("🔵 STEP 3: Fetching transaction to verify it exists...");
      const { data: existingTx, error: fetchErr } = await supabaseAdmin
        .from('transactions')
        .select('id, status, created_at, total_amount, method')
        .eq('id', transactionId)
        .single();

      console.log("🔵 STEP 3a: Fetch result - error:", fetchErr, "data:", existingTx);

      if (fetchErr) {
        console.error("❌ STEP 3b: Could not fetch transaction:", fetchErr.message, fetchErr.details, fetchErr.hint);
        return res.status(404).json({ error: `Transaction not found: ${fetchErr.message}` });
      }

      if (!existingTx) {
        console.error("❌ STEP 3c: Transaction not found in database");
        return res.status(404).json({ error: "Transaction not found" });
      }

      console.log("🔵 STEP 3d: Transaction found - current status:", existingTx.status);

      // Update transaction status to 'voided' (don't delete, preserve the record)
      console.log("🔵 STEP 4: Starting UPDATE query...");
      console.log("🔵 STEP 4a: Updating transaction", transactionId, "to status='voided'");

      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'voided' })
        .eq('id', transactionId)
        .select();

      console.log("🔵 STEP 5: UPDATE response received");
      console.log("🔵 STEP 5a: Error object:", error ? JSON.stringify(error, null, 2) : "null");
      console.log("🔵 STEP 5b: Data object:", data ? JSON.stringify(data, null, 2) : "null");
      console.log("🔵 STEP 5c: Number of rows affected:", data ? data.length : 0);

      if (error) {
        console.error("❌ STEP 6: Supabase UPDATE error:");
        console.error("   - Message:", error.message);
        console.error("   - Details:", error.details);
        console.error("   - Hint:", error.hint);
        console.error("   - Code:", error.code);
        return res.status(500).json({ error: `Database error: ${error.message}` });
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ STEP 6a: UPDATE succeeded but no rows returned");
        console.warn("   This might indicate RLS policies or constraint issues");
      } else {
        console.log("🔵 STEP 6b: Verifying status update:");
        console.log("   - BEFORE:", existingTx.status);
        console.log("   - AFTER:", data[0].status);
        console.log("   - Status changed?", existingTx.status !== data[0].status);
      }

      console.log("✅ STEP 7: Transaction marked as voided successfully");
      console.log("✅ STEP 7a: Updated transaction ID:", transactionId);
      console.log("✅ STEP 7b: Rows updated:", data ? data.length : 0);

      return res.status(200).json({ success: true, data, message: "Transaction voided successfully" });
    } catch (err: any) {
      console.error("❌ STEP 8: Caught exception:", err);
      console.error("   - Message:", err.message);
      console.error("   - Stack:", err.stack);
      return res.status(500).json({ error: `Server error: ${err.message}` });
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

  // --- GIFT CARDS ---

  // Gift Cards GET - List all gift cards
  app.get("/api/gift-cards", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      console.log('📥 GET /api/gift-cards');
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, customers(first_name, last_name, email)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Gift cards fetch error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ Fetched', data?.length || 0, 'gift cards');
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error('❌ Error fetching gift cards:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Gift Cards POST - Issue a new gift card
  app.post("/api/gift-cards", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    try {
      const { initial_balance, customer_id, card_number: providedCardNumber } = req.body;

      console.log('🎁 POST /api/gift-cards - Request body:', req.body);

      if (!initial_balance || initial_balance <= 0) {
        console.error('❌ Invalid amount:', initial_balance);
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Generate card number if not provided
      const card_number = providedCardNumber || crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 16);
      console.log('🔢 Card number:', card_number, '(auto-generated:', !providedCardNumber, ')');

      const insertPayload = {
        card_number,
        initial_balance: Number(initial_balance),
        current_balance: Number(initial_balance),
        customer_id: customer_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      console.log('📦 Insert payload:', insertPayload);

      const { data, error } = await supabase
        .from('gift_cards')
        .insert([insertPayload])
        .select();

      console.log('📊 Supabase insert result:', { data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned from insert');
        return res.status(500).json({ error: 'Insert succeeded but no data returned' });
      }

      console.log('✅ Gift card created:', data[0]);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error('❌ Exception in POST /api/gift-cards:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Gift Cards Lookup - GET /api/gift-cards/lookup
  app.get("/api/gift-cards/lookup", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { card_number } = req.query;
    if (!card_number) return res.status(400).json({ error: 'card_number is required' });

    try {
      console.log('🔍 Looking up card:', card_number);
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('card_number', card_number)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Gift card not found' });
        }
        throw error;
      }

      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error('❌ Error looking up gift card:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Gift Cards Redeem - POST /api/gift-cards/redeem
  app.post("/api/gift-cards/redeem", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { card_number, amount } = req.body;
    if (!card_number || !amount) return res.status(400).json({ error: 'card_number and amount are required' });

    try {
      console.log('💳 Redeeming card:', card_number, 'amount:', amount);

      // Get current card
      const { data: card, error: lookupError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('card_number', card_number)
        .single();

      if (lookupError) throw lookupError;
      if (!card) return res.status(404).json({ error: 'Gift card not found' });

      const new_balance = card.current_balance - amount;
      const is_active = new_balance > 0;

      // Update balance
      const { data: updated, error: updateError } = await supabase
        .from('gift_cards')
        .update({ current_balance: new_balance, is_active })
        .eq('id', card.id)
        .select();

      if (updateError) throw updateError;

      // Record transaction
      const { error: txError } = await supabase
        .from('gift_card_transactions')
        .insert([{
          gift_card_id: card.id,
          amount: -amount,
          transaction_type: 'redeem',
          created_at: new Date().toISOString()
        }]);

      if (txError) console.error('⚠️ Transaction recording failed:', txError);

      return res.status(200).json({ success: true, data: updated?.[0] });
    } catch (err: any) {
      console.error('❌ Error redeeming gift card:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Gift Cards History - GET /api/gift-cards/history
  app.get("/api/gift-cards/history", async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { gift_card_id } = req.query;
    if (!gift_card_id) return res.status(400).json({ error: 'gift_card_id is required' });

    try {
      console.log('📊 Getting history for card:', gift_card_id);
      const { data, error } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('gift_card_id', gift_card_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error('❌ Error fetching history:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- RETURNS ---

  app.post("/api/returns", async (req, res) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { transactionId, returnItems, refundAmount, storeCreditAmount, originalPaymentMethod, customerId } = req.body;

    if (!transactionId || !Array.isArray(returnItems)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      console.log("🔄 Processing return:", { transactionId, refundAmount, storeCreditAmount });

      // 1. Create return record
      const { data: returnRecord, error: returnError } = await admin
        .from("returns")
        .insert({
          transaction_id: transactionId,
          refund_amount: refundAmount,
          store_credit_amount: storeCreditAmount,
          items: returnItems,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (returnError) throw returnError;
      console.log("✅ Return record created:", returnRecord.id);

      // 2. Restore inventory
      const { data: originalTx } = await admin
        .from("transactions")
        .select("items")
        .eq("id", transactionId)
        .single();

      if (originalTx?.items) {
        for (const returnItem of returnItems) {
          const origItem = originalTx.items.find((i: any) => i.name === returnItem.name);
          if (origItem?.variantId) {
            const { data: variant } = await admin
              .from("product_variants")
              .select("stock_quantity")
              .eq("id", origItem.variantId)
              .single();

            if (variant) {
              const newQty = (variant.stock_quantity || 0) + returnItem.quantity;
              await admin
                .from("product_variants")
                .update({ stock_quantity: newQty })
                .eq("id", origItem.variantId);

              console.log(`✅ Restored ${returnItem.quantity} units of ${returnItem.name}`);
            }
          }
        }
      }

      // 3. Issue store credit if needed
      if (storeCreditAmount > 0 && customerId) {
        const { data: scRecord } = await admin
          .from("store_credits")
          .insert({
            customer_id: customerId,
            amount: storeCreditAmount,
            remaining_balance: storeCreditAmount,
            reason: "Return",
            is_active: true,
            created_at: new Date().toISOString(),
            reference_transaction_id: transactionId,
          })
          .select()
          .single();

        if (scRecord) {
          await admin.from("store_credit_transactions").insert({
            store_credit_id: scRecord.id,
            type: "issued",
            amount: storeCreditAmount,
            created_at: new Date().toISOString(),
            reference_transaction_id: transactionId,
          });

          console.log(`✅ Store credit issued: $${storeCreditAmount}`);
        }
      }

      // 4. Create refund record for audit trail
      if (refundAmount > 0) {
        await admin.from("transactions").insert({
          type: "refund",
          original_transaction_id: transactionId,
          method: originalPaymentMethod,
          total_amount: refundAmount,
          customer_id: customerId,
          items: returnItems,
          created_at: new Date().toISOString(),
          status: "completed",
        });

        console.log(`✅ Refund record created: $${refundAmount} to ${originalPaymentMethod}`);
      }

      return res.status(200).json({
        success: true,
        returnId: returnRecord.id,
        refundAmount,
        storeCreditAmount,
        message: `Return processed. Refund: $${refundAmount.toFixed(2)}, Store Credit: $${storeCreditAmount.toFixed(2)}`,
      });
    } catch (err: any) {
      console.error("❌ Return processing error:", err);
      return res.status(500).json({ error: err.message || "Failed to process return" });
    }
  });

  // Create store credit (for returns processing)
  app.post("/api/store-credits", async (req, res) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { customerId, amount, reason } = req.body;

    if (!customerId || !amount || !reason) {
      return res.status(400).json({ error: "Missing customerId, amount, or reason" });
    }

    try {
      console.log(`🔄 Creating store credit: $${amount} for customer ${customerId.slice(0, 8)}`);

      const { data: scRecord, error: scError } = await admin
        .from("store_credits")
        .insert({
          customer_id: customerId,
          amount: amount,
          remaining_balance: amount,
          reason: reason,
          is_active: true,
        })
        .select()
        .single();

      if (scError) {
        console.error("❌ Error creating store credit:", scError);
        throw scError;
      }

      console.log(`✅ Store credit created: ${scRecord.id}`);

      // Create store credit transaction record
      const { error: txError } = await admin.from("store_credit_transactions").insert({
        store_credit_id: scRecord.id,
        amount: amount,
        transaction_type: "issued",
      });

      if (txError) {
        console.error("⚠️ Error creating SC transaction:", txError);
      }

      return res.status(200).json({
        success: true,
        creditId: scRecord.id,
        amount: amount,
      });
    } catch (err: any) {
      console.error("❌ Store credit creation error:", err);
      return res.status(500).json({ error: err.message || "Failed to create store credit" });
    }
  });

  // Get all store credits (for POS history and reports)
  app.get("/api/store-credits", async (req, res) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await admin
        .from("store_credits")
        .select(`
          *,
          customers (id, first_name, last_name, email, phone),
          store_credit_transactions (*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err: any) {
      console.error("❌ Error fetching store credits:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch store credits" });
    }
  });

  // Get store credits for a specific customer
  app.get("/api/store-credits/customer/:customerId", async (req, res) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    try {
      const { data, error } = await admin
        .from("store_credits")
        .select(`
          *,
          store_credit_transactions (*)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err: any) {
      console.error("❌ Error fetching customer store credits:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch store credits" });
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

// Exported so serverless handlers (api/index.ts) can await initialization
// before handling the first request, preventing the race where routes aren't
// registered yet when a cold-start request arrives.
export const appReady: Promise<typeof app> = startServer().catch((err: any) => {
  console.error("FATAL: Failed to initialize server:", err);
  return app;
});

// Local dev: also start the HTTP listener
if (process.env.NODE_ENV !== 'production') {
  appReady.then(a => {
    a.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  });
}