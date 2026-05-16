import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("CRITICAL: VITE_SUPABASE_URL is missing in environment variables.");
}

if (!serviceRoleKey && !anonKey) {
  console.error("CRITICAL: Both SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_ANON_KEY are missing.");
}

const supabaseKey = serviceRoleKey || anonKey || '';
console.log(`Supabase Client: Initializing with URL: ${supabaseUrl ? 'Present' : 'MISSING'}, Key: ${serviceRoleKey ? 'SERVICE_ROLE' : (anonKey ? 'ANON' : 'MISSING')}`);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Cache for local fallback data to avoid repeated disk I/O
let localProductsCache: any[] | null = null;
let localSettingsCache: any | null = null;

// Cache for API responses to reduce Supabase load
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

async function getLocalProducts() {
  if (localProductsCache) return localProductsCache;
  try {
    const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
    const productsContent = await fs.readFile(exportedPath, 'utf-8');
    localProductsCache = JSON.parse(productsContent);
    return localProductsCache;
  } catch (e) {
    try {
      const productsContent = await fs.readFile(path.join(process.cwd(), 'data', 'products.json'), 'utf-8');
      localProductsCache = JSON.parse(productsContent);
      return localProductsCache;
    } catch (e2) {
      console.error("Failed to load local products:", e2);
      return [];
    }
  }
}

async function getLocalSettings() {
  if (localSettingsCache) return localSettingsCache;
  try {
    const exportedPath = path.join(process.cwd(), 'data', 'settings_exported.json');
    const settingsContent = await fs.readFile(exportedPath, 'utf-8');
    localSettingsCache = JSON.parse(settingsContent);
    return localSettingsCache;
  } catch (e) {
    try {
      const settingsContent = await fs.readFile(path.join(process.cwd(), 'data', 'settings.json'), 'utf-8');
      localSettingsCache = JSON.parse(settingsContent);
      return localSettingsCache;
    } catch (e2) {
      console.error("Failed to load local settings:", e2);
      return {};
    }
  }
}

// Helper to wrap Supabase calls with a timeout
async function withTimeout<T>(promise: Promise<T> | T, timeoutMs: number = 5000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Supabase request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise as Promise<T>, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function startServer() {
  console.log("Starting server process...");
  const app = express();
  // Parse bodies with error handling
  app.use((req, res, next) => {
    express.json({ limit: '50mb' })(req, res, (err) => {
      if (err) {
        console.error("JSON Parsing Error:", err);
        return res.status(400).json({ error: "Invalid JSON body", message: err.message });
      }
      next();
    });
  });

  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  app.use((req, res, next) => {
    console.log(`[>> RAW INCOMING >>] ${req.method} ${req.url}`);
    next();
  });
  
  app.get("/test", (req, res) => res.json({ test: "ok" }));
  app.get("/ping", (req, res) => { res.send("pong"); });

  // Products - Moved earlier
  app.post("/api/products", async (req, res) => {
    console.log('!!! POST /api/products HIT !!!');
    try {
      const productData = req.body;
      
      if (!productData) {
        return res.status(400).json({ error: "No data received" });
      }
      
      if (!productData.name) {
        return res.status(400).json({ error: "Product name is required" });
      }

      // Generate an ID if not present
      if (!productData.id) {
        productData.id = Date.now().toString();
      }
      
      // Try Supabase first if configured
      if (process.env.VITE_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)) {
        try {
          const { data, error } = await withTimeout(
            supabase.from('products').insert([productData]).select().single(),
            30000 // Increased to 30s
          );
          
          if (!error && data) {
            console.log('Product successfully inserted in Supabase');
            apiCache.clear(); // Important: clear cache on change
            return res.json(data);
          }
          
          console.warn('Supabase Insert failed, falling back to local:', error?.message);
        } catch (supabaseErr: any) {
          console.warn('Supabase Insert exception, falling back to local:', supabaseErr.message);
        }
      }

      // Local Fallback Persistence
      console.log('Using local fallback for product creation...');
      const products = await getLocalProducts();
      
      // Check if product with ID already exists
      const existingIndex = products.findIndex((p: any) => p.id === productData.id);
      if (existingIndex >= 0) {
        products[existingIndex] = { ...products[existingIndex], ...productData };
      } else {
        products.push(productData);
      }
      
      // Save to exported file
      const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
      await fs.writeFile(exportedPath, JSON.stringify(products, null, 2));
      
      // Update cache
      localProductsCache = products;
      apiCache.clear();
      
      console.log('Product successfully saved to local fallback file');
      return res.json(productData);
    } catch (err: any) {
      console.error('Exception in POST /api/products:', err);
      return res.status(500).json({ error: err.message || "Internal server error during product insertion" });
    }
  });

  // 1. Log all requests immediately
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`>>> INCOMING: ${req.method} ${req.url}`);
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`<<< OUTGOING: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      if (res.statusCode === 404) {
        console.warn(`[WARN] 404 Not Found for: ${req.method} ${req.url}`);
      }
    });

    next();
  });

  // API Route Definitions
  console.log("Defining API routes...");
  // Products
  
  app.get("/api/products", async (req, res) => {
    try {
      const cacheKey = req.url;
      const cachedResponse = apiCache.get(cacheKey);
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
        return res.json(cachedResponse.data);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const category = req.query.category as string;
      const isFeatured = req.query.isFeatured === 'true';
      const fields = (req.query.fields as string) || '*';
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase.from('products').select(fields, { count: page === 1 ? 'estimated' : undefined });
      if (category && category !== 'all' && category !== 'All') {
        query = query.ilike('category', category);
      }
      if (isFeatured) {
        query = query.eq('isFeatured', true);
      }
      query = query.range(from, to).order('id', { ascending: true });

      let { data, count, error } = await withTimeout<any>(query, 15000);
      let mode = 'supabase';
      
      if (error || !data || data.length === 0) {
        const localProducts = await getLocalProducts();
        if (localProducts && localProducts.length > 0) {
          let filtered = [...localProducts];
          if (category && category !== 'all' && category !== 'All') {
            filtered = filtered.filter(p => p.category?.toLowerCase() === category.toLowerCase());
          }
          if (isFeatured) {
            filtered = filtered.filter(p => p.isFeatured);
          }
          data = filtered.slice(from, from + limit);
          count = filtered.length;
          mode = 'local-fallback';
        }
      }
      
      const resultData = {
        data: data || [],
        total: count,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : (data ? Math.ceil(data.length / limit) : 0),
        mode
      };

      if (resultData.data && resultData.data.length > 0) {
        apiCache.set(cacheKey, { data: resultData, timestamp: Date.now() });
      }

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(resultData);
    } catch (error: any) {
      console.error("Error fetching products:", error.message || error);
      return res.status(500).json({ 
        error: error.message || "Internal server error",
        code: error.code || "UNKNOWN"
      });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;

    try {
      if (process.env.VITE_SUPABASE_URL) {
        const { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single();
        if (!error && data) {
           apiCache.clear();
           return res.json(data);
        }
        console.warn("Supabase update failed, trying local fallback:", error?.message);
      }

      // Local Fallback
      const products = await getLocalProducts();
      const index = products.findIndex((p: any) => p.id === id);
      if (index === -1) return res.status(404).json({ error: "Product not found" });

      products[index] = { ...products[index], ...updateData };
      const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
      await fs.writeFile(exportedPath, JSON.stringify(products, null, 2));
      
      localProductsCache = products;
      apiCache.clear();
      return res.json(products[index]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    try {
      if (process.env.VITE_SUPABASE_URL) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) {
          apiCache.clear();
          return res.json({ success: true });
        }
        console.warn("Supabase delete failed, trying local fallback:", error?.message);
      }

      // Local Fallback
      const products = await getLocalProducts();
      const filtered = products.filter((p: any) => p.id !== id);
      
      const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
      await fs.writeFile(exportedPath, JSON.stringify(filtered, null, 2));
      
      localProductsCache = filtered;
      apiCache.clear();
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Settings
  app.get("/api/settings/bulk", async (req, res) => {
    console.log("!!! ROUTE HIT: /api/settings/bulk");
    try {
      const cacheKey = req.url;
      const cachedResponse = apiCache.get(cacheKey);
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
        return res.json(cachedResponse.data);
      }

      let { data, error } = await withTimeout<any>(
        supabase.from('settings').select('key, data'),
        15000
      );
      
      let settingsMap: any = null;
      let mode = 'supabase';
      
      if (!error && data && data.length > 0) {
        settingsMap = data.reduce((acc: any, curr: any) => {
          acc[curr.key] = curr.data;
          return acc;
        }, {});
      } else {
        settingsMap = await getLocalSettings();
        mode = 'local-fallback';
      }
        
      if (settingsMap && Object.keys(settingsMap).length > 0) {
        apiCache.set(cacheKey, { data: settingsMap, timestamp: Date.now() });
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Data-Mode', mode);
        return res.json(settingsMap);
      }
      return res.json({});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const { data, error } = await withTimeout<any>(
        supabase.from('settings').select('data').eq('key', req.params.key).single(),
        10000
      );
      if (error && error.code !== 'PGRST116') throw error;
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(data?.data || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings/:key", async (req, res) => {
    const key = req.params.key;
    const incomingData = req.body;
    try {
      if (process.env.VITE_SUPABASE_URL) {
        try {
          const { data: existing } = await supabase.from('settings').select('data').eq('key', key).single();
          const newData = { ...(existing?.data || {}), ...incomingData };
          const { data, error } = await supabase.from('settings').upsert({ key, data: newData }).select().single();
          if (!error && data) {
            apiCache.clear();
            return res.json(data.data);
          }
          console.warn("Supabase settings save failed, trying local fallback:", error?.message);
        } catch (supabaseErr: any) {
          console.warn("Supabase settings exception, trying local fallback:", supabaseErr.message);
        }
      }

      // Local Fallback
      const settings = await getLocalSettings();
      const existingData = settings[key] || {};
      const mergedData = { ...existingData, ...incomingData };
      settings[key] = mergedData;

      const exportedPath = path.join(process.cwd(), 'data', 'settings_exported.json');
      await fs.writeFile(exportedPath, JSON.stringify(settings, null, 2));
      
      localSettingsCache = settings;
      apiCache.clear();
      return res.json(mergedData);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "supabase", env: process.env.NODE_ENV });
  });

  // Test route for POST
  app.post("/api/echo", (req, res) => {
    res.json({ body: req.body, method: req.method, url: req.url });
  });

  // Admin Tools - Sync local data files to Supabase
  app.post("/api/admin/sync-local", async (req, res) => {
    try {
      let { products: bodyProducts, settings: bodySettings, clearExisting } = req.body;
      console.log(`Migration triggered. Products in body: ${bodyProducts?.length || 0}, Clear existing: ${clearExisting}`);
      
      const results: string[] = [];

      // 1. Clear existing data if requested
      if (clearExisting) {
        console.log("Clearing existing data from Supabase...");
        const { error: pErr } = await supabase.from('products').delete().neq('id', '0');
        const { error: sErr } = await supabase.from('settings').delete().neq('key', 'none');
        if (pErr) console.warn("Error clearing products:", pErr);
        if (sErr) console.warn("Error clearing settings:", sErr);
        results.push("Cleared existing data");
      }

      // 2. Process Products
      let productsToMigrate = bodyProducts;
      if (!productsToMigrate || productsToMigrate.length === 0) {
        productsToMigrate = await getLocalProducts();
      }

      if (productsToMigrate && productsToMigrate.length > 0) {
        console.log(`Migrating ${productsToMigrate.length} products...`);
        // Batch products to avoid request size limits
        const BATCH_SIZE = 50;
        let pSuccess = 0;
        let pFail = 0;

        for (let i = 0; i < productsToMigrate.length; i += BATCH_SIZE) {
          const batch = productsToMigrate.slice(i, i + BATCH_SIZE).map((p: any) => {
            // Remove ID to let Supabase generate it if it's a new migration
            // Or keep it if we want to preserve IDs. 
            // Most projects want to preserve IDs from JSON.
            const { ...rest } = p;
            return rest;
          });

          const { error } = await supabase.from('products').upsert(batch);
          if (error) {
            console.error(`Batch ${i/BATCH_SIZE} failed:`, error);
            pFail += batch.length;
          } else {
            pSuccess += batch.length;
          }
        }
        results.push(`Products: ${pSuccess} success, ${pFail} failed`);
      }

      // 3. Process Settings
      let settingsToMigrate = bodySettings;
      if (!settingsToMigrate || Object.keys(settingsToMigrate).length === 0) {
        settingsToMigrate = await getLocalSettings();
      }

      if (settingsToMigrate && Object.keys(settingsToMigrate).length > 0) {
        console.log("Migrating settings...");
        const settingsEntries = Object.entries(settingsToMigrate).map(([key, data]) => ({
          key,
          data
        }));

        const { error } = await supabase.from('settings').upsert(settingsEntries);
        if (error) {
          console.error("Settings migration failed:", error);
          results.push(`Settings failed: ${error.message}`);
        } else {
          results.push("Settings migrated successfully");
        }
      }

      // Clear caches
      localProductsCache = null;
      localSettingsCache = null;
      apiCache.clear();

      res.json({ success: true, message: results.join(", ") });
    } catch (error: any) {
      console.error("Migration exception:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pull-from-cloud", async (req, res) => {
     res.json({ success: true, message: "Pull mock" });
  });

  app.get("/api/admin/local-backup", async (req, res) => {
     res.json({ products: [], settings: {} });
  });

  app.get("/debug", (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
  });

  console.log("API Routes defined.");

  const PORT = 3000;


  console.log("Configuring middlewares...");
  
  // Final static serving and SPA fallback
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      app.use(express.static(path.join(process.cwd(), 'dist')));
    }
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  // SPA Fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER READY AND LISTENING ON PORT ${PORT} <<<`);
  });
}

startServer().catch(err => {
  console.error("FATAL: Failed to start server:", err);
  process.exit(1);
});
