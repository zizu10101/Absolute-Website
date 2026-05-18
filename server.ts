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

// File paths
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_PRODUCTS_PATH = path.join(DATA_DIR, 'products_exported.json');
const LOCAL_SETTINGS_PATH = path.join(DATA_DIR, 'settings_exported.json');

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
        let query = supabase.from('products').select('*');
        const { data, error } = await query.order('name');
        if (error) throw error;
        
        const responseData = { data: data || [], mode: 'supabase' };
        apiCache.set(cacheKey, { data: responseData, expires: Date.now() + CACHE_TTL });
        return res.json(responseData);
      } else {
        const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
        let data;
        try {
          data = JSON.parse(fileContent);
        } catch (e) {
          console.error("Failed to parse local products JSON, returning empty list");
          data = [];
        }
        return res.json({ data, mode: 'local' });
      }
    } catch (err) {
      console.warn("Supabase products fetch failed, using local fallback");
      const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
      let data;
      try {
        data = JSON.parse(fileContent);
      } catch (e) {
        console.error("Failed to parse local products JSON fallback, returning empty list");
        data = [];
      }
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
        const { data, error } = await supabase.from('products').insert([productData]).select().single();
        if (error) throw error;
        clearCache('products');
        return res.json(data);
      } else {
        const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
        const products = JSON.parse(fileContent);
        const newProduct = { ...productData, id: Date.now().toString() };
        products.push(newProduct);
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json(newProduct);
      }
    } catch (err: any) {
      console.error("Error adding product:", err);
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
        const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
        const products = JSON.parse(fileContent);
        const product = products.find((p: any) => p.id === id);
        if (!product) return res.status(404).json({ error: "Product not found" });
        return res.json(product);
      }
    } catch (err: any) {
      console.error("Error fetching product:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Product PUT (Update)
  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    try {
      if (supabase) {
        const { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        clearCache('products');
        return res.json(data);
      } else {
        const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
        let products = JSON.parse(fileContent);
        const index = products.findIndex((p: any) => p.id === id);
        if (index === -1) return res.status(404).json({ error: "Product not found" });
        
        products[index] = { ...products[index], ...updateData };
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json(products[index]);
      }
    } catch (err: any) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Product DELETE
  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (supabase) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        clearCache('products');
        return res.json({ success: true });
      } else {
        const fileContent = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
        let products = JSON.parse(fileContent);
        const initialLength = products.length;
        products = products.filter((p: any) => p.id !== id);
        
        if (products.length === initialLength) return res.status(404).json({ error: "Product not found" });
        
        await fs.writeFile(LOCAL_PRODUCTS_PATH, JSON.stringify(products, null, 2));
        clearCache('products');
        return res.json({ success: true });
      }
    } catch (err: any) {
      console.error("Error deleting product:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Settings GET (Bulk or Key)
  app.get("/api/settings/bulk", async (req, res) => {
    try {
      if (supabase) {
        console.log("Fetching bulk settings from Supabase...");
        const { data, error } = await supabase.from('settings').select('*');
        if (error) {
          console.error("Supabase settings fetch error:", error);
          throw error;
        }
        
        // Handle both key/data and id/config schemas if they exist
        const results = data.reduce((acc: any, curr: any) => {
          const k = curr.key || curr.id;
          const d = curr.data || curr.config;
          if (k) acc[k] = d;
          return acc;
        }, {});
        
        res.header('X-Data-Mode', 'supabase');
        return res.json(results);
      } else {
        const fileContent = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
        const data = JSON.parse(fileContent);
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
        const upsertPayload: any = { key, data: newData, updated_at: new Date() };
        
        const { data, error } = await supabase
          .from('settings')
          .upsert(upsertPayload, { onConflict: 'key' })
          .select()
          .single();

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

          // Try fallback to config column if data column fails
          const secondTryPayload = { key, config: newData, updated_at: new Date() };
          const { data: data2, error: error2 } = await supabase
            .from('settings')
            .upsert(secondTryPayload, { onConflict: 'key' })
            .select()
            .single();
            
          if (error2) {
            console.error(`Supabase upsert error (config) for ${key}:`, error2);
            // Last ditch effort: try using 'id' as the key column if 'key' fails
            const thirdTryPayload = { id: key, config: newData, updated_at: new Date() };
            const { data: data3, error: error3 } = await supabase
              .from('settings')
              .upsert(thirdTryPayload, { onConflict: 'id' })
              .select()
              .single();
              
            if (error3) {
              throw error3;
            }
            return res.json(data3.config || data3.data || data3);
          }
          return res.json(data2.config || data2.data || data2);
        }
        
        return res.json(data.data || data.config || data);
      } else {
        const fileContent = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
        const settings = JSON.parse(fileContent);
        const existing = settings[key] || {};
        const newData = (typeof existing === 'object' && typeof updates === 'object')
          ? { ...existing, ...updates }
          : updates;
          
        settings[key] = newData;
        await fs.writeFile(LOCAL_SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return res.json(newData);
      }
    } catch (err: any) {
      console.error(`Error saving settings for ${key}:`, err);
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
        const fileContent = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
        return res.json(JSON.parse(fileContent));
      }
    } catch (err) {
      const fileContent = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
      return res.json(JSON.parse(fileContent));
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

      const pRaw = await fs.readFile(LOCAL_PRODUCTS_PATH, 'utf-8').catch(() => '[]');
      stats.localProducts = JSON.parse(pRaw).length;
      
      const sRaw = await fs.readFile(LOCAL_SETTINGS_PATH, 'utf-8').catch(() => '{}');
      stats.localSettings = Object.keys(JSON.parse(sRaw)).length > 0;

      if (supabase) {
        const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
        if (!error) stats.supabaseProducts = count || 0;
      }

      res.json(stats);
    } catch (err: any) {
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
