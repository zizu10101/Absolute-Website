import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

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
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API - Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "supabase" });
  });

  // API - Products
  app.get("/api/products", async (req, res) => {
    try {
      const cacheKey = req.url;
      const cachedResponse = apiCache.get(cacheKey);
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
        return res.json(cachedResponse.data);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // Default limit
      const category = req.query.category as string;
      const isFeatured = req.query.isFeatured === 'true';
      const fields = (req.query.fields as string) || '*';
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      console.log(`Fetching products: page=${page}, limit=${limit}, category=${category}, isFeatured=${isFeatured}`);
      
      // Optimize: Only request count if it's the first page or explicitly asked
      const shouldCount = page === 1;
      let query = supabase.from('products').select(fields, { 
        count: shouldCount ? 'estimated' : undefined 
      });

      if (category && category !== 'all' && category !== 'All') {
        // Use ilike for case-insensitive matching in Supabase
        query = query.ilike('category', category);
      }
      
      if (isFeatured) {
        query = query.eq('isFeatured', true);
      }

      // Add pagination
      query = query.range(from, to).order('id', { ascending: true });

      // Apply timeout to the query (increased to 10s to reduce false positives)
      let { data, count, error } = await withTimeout<any>(query, 10000);
      let mode = 'supabase';
      
      if (error || !data || data.length === 0) {
        if (error) {
          console.error("Supabase Query Error, falling back to local data:", JSON.stringify(error, null, 2));
        } else if (!data || data.length === 0) {
          console.log("Supabase returned no data, checking if products exist in DB...");
        }
        
        const localProducts = await getLocalProducts();
        
        if (localProducts && localProducts.length > 0) {
          // Filter local products to match parameters as best as possible
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

      // Only cache if we actually have data to show
      if (resultData.data && resultData.data.length > 0) {
        apiCache.set(cacheKey, { data: resultData, timestamp: Date.now() });
      }

      // Return the live data from Supabase
      res.setHeader('Cache-Control', 'public, max-age=300');
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
      console.error(`Error fetching product ${req.params.id}:`, error);
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.post("/api/products", async (req, res) => {
    const productData = req.body;
    console.log('Inserting product:', productData.name);
    const { data, error } = await supabase.from('products').insert([productData]).select().single();
    if (error) {
      console.error('Supabase Insert Error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  app.put("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    const productData = req.body;
    console.log('Updating product:', id, productData.name);
    const { data, error } = await supabase.from('products').update(productData).eq('id', id).select().single();
    if (error) {
      console.error('Supabase Update Error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  app.delete("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // API - Settings
  app.get("/api/settings/bulk", async (req, res) => {
    try {
      const cacheKey = req.url;
      const cachedResponse = apiCache.get(cacheKey);
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
        return res.json(cachedResponse.data);
      }

      // Try to fetch all settings in one go
      let { data, error } = await withTimeout<any>(
        supabase.from('settings').select('key, data'),
        10000
      ).catch(e => ({ data: null, error: e }));
      
      let settingsMap: any = null;
      let mode = 'supabase';
      
      if (!error && data && data.length > 0) {
        settingsMap = data.reduce((acc: any, curr: any) => {
          acc[curr.key] = curr.data;
          return acc;
        }, {});
      } else {
        console.error("Bulk settings fetch error or empty, falling back to local data:", error?.message || error);
        settingsMap = await getLocalSettings();
        mode = 'local-fallback';
      }
        
      if (settingsMap && Object.keys(settingsMap).length > 0) {
        apiCache.set(cacheKey, { data: settingsMap, timestamp: Date.now() });
        
        res.setHeader('Cache-Control', 'public, max-age=1800');
        res.setHeader('X-Data-Mode', mode);
        return res.json(settingsMap);
      }

      return res.json({});
    } catch (error: any) {
      console.error("Bulk settings fetch error:", error.message || error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    const key = req.params.key;
    try {
      // Apply longer timeout to settings fetch
      const { data, error } = await withTimeout<any>(
        supabase.from('settings').select('data').eq('key', key).single(),
        5000
      );
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      res.setHeader('Cache-Control', 'public, max-age=1800');
      return res.json(data?.data || {});
    } catch (error: any) {
      console.error(`Error fetching setting "${key}":`, error.message || error);
      res.status(500).json({ error: error.message });
    }
  });


  app.post("/api/settings/:key", async (req, res) => {
    const key = req.params.key;
    const updateData = req.body;
    
    // First try to get existing data
    const { data: existing } = await supabase.from('settings').select('data').eq('key', key).single();
    const newData = { ...(existing?.data || {}), ...updateData };

    const { data, error } = await supabase.from('settings').upsert({ key, data: newData }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data.data);
  });

  // Admin Tools - Sync local data files to Supabase
  app.post("/api/admin/sync-local", async (req, res) => {
    try {
      let { products, settings, clearExisting } = req.body;
      console.log(`Migration triggered. Products in body: ${products?.length || 0}, Clear existing: ${clearExisting}`);

      if (clearExisting) {
        console.log("Clearing existing products from Supabase before migration...");
        
        // Fetch all IDs to delete in small pages to avoid timeouts
        let allIds: string[] = [];
        let hasMore = true;
        let lastId = null;

        while (hasMore) {
          let query = supabase.from('products').select('id').limit(1000);
          if (lastId) query = query.gt('id', lastId);
          
          const { data: rows, error: idError } = await withTimeout(query.order('id'), 10000);
          
          if (idError) {
            console.error("Error fetching IDs for delete:", idError);
            break;
          }
          
          if (!rows || rows.length === 0) {
            hasMore = false;
          } else {
            allIds.push(...rows.map(r => r.id));
            lastId = rows[rows.length - 1].id;
            if (rows.length < 1000) hasMore = false;
          }
        }

        if (allIds.length > 0) {
          const deleteBatchSize = 50; // Smaller batch for deletion
          for (let i = 0; i < allIds.length; i += deleteBatchSize) {
            const batchIds = allIds.slice(i, i + deleteBatchSize);
            console.log(`Deleting product batch ${i / deleteBatchSize + 1} of ${Math.ceil(allIds.length / deleteBatchSize)}...`);
            const { error: dError } = await withTimeout(
              supabase.from('products').delete().in('id', batchIds),
              15000
            );
            if (dError) {
              console.error("Batch delete error:", dError);
              throw dError;
            }
          }
          console.log(`Successfully deleted ${allIds.length} products.`);
        }
      }

      // If no data provided in body, try reading from local files
      if (!products || products.length === 0) {
        try {
          // Try exported data first as it likely contains real Firebase data
          const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
          console.log(`Checking for exported data at: ${exportedPath}`);
          const productsContent = await fs.readFile(exportedPath, 'utf-8');
          products = JSON.parse(productsContent);
          console.log(`Found ${products.length} products in products_exported.json`);
        } catch (e) {
          console.log("products_exported.json not found or invalid, trying products.json");
          try {
            const productsContent = await fs.readFile(path.join(process.cwd(), 'data', 'products.json'), 'utf-8');
            products = JSON.parse(productsContent);
            console.log(`Found ${products.length} products in products.json`);
          } catch (e2) {
            console.log("No local products found at all");
          }
        }
      }

      if (!settings || Object.keys(settings).length === 0) {
        try {
          // Try exported settings first
          const exportedPath = path.join(process.cwd(), 'data', 'settings_exported.json');
          const settingsContent = await fs.readFile(exportedPath, 'utf-8');
          settings = JSON.parse(settingsContent);
          console.log("Using exported settings for migration");
        } catch (e) {
          try {
            const settingsContent = await fs.readFile(path.join(process.cwd(), 'data', 'settings.json'), 'utf-8');
            settings = JSON.parse(settingsContent);
            console.log("Using default settings for migration");
          } catch (e2) {
            console.log("No local settings found");
          }
        }
      }

      const results = [];

      if (products && products.length > 0) {
        console.log(`Processing ${products.length} products for Supabase...`);
        // Sanitize IDs for Supabase UUID compatibility
        const sanitizedProducts = products.map((p: any) => {
          const product = { ...p };
          if (product.id) {
            const idStr = String(product.id);
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(idStr)) {
              // Convert any ID to a valid UUID format
              // We'll pad with zeros and use a consistent prefix to ensure it's valid
              const sanitized = idStr.replace(/[^0-9a-f]/gi, '0').toLowerCase();
              const padded = sanitized.padEnd(32, '0').slice(0, 32);
              product.id = `${padded.slice(0,8)}-${padded.slice(8,12)}-${padded.slice(12,16)}-${padded.slice(16,20)}-${padded.slice(20,32)}`;
              // console.log(`Converted ID "${idStr}" to UUID "${product.id}"`);
            }
          }
          return product;
        });

        console.log(`Upserting ${sanitizedProducts.length} sanitized products to Supabase...`);
        
        // Batch upsert to avoid large payload errors
        const batchSize = 10; // Reduced from 25
        for (let i = 0; i < sanitizedProducts.length; i += batchSize) {
          const batch = sanitizedProducts.slice(i, i + batchSize);
          console.log(`Upserting products batch ${i / batchSize + 1} of ${Math.ceil(sanitizedProducts.length / batchSize)}...`);
          const { error } = await withTimeout(
            supabase.from('products').upsert(batch, { onConflict: 'id' }),
            45000 // Increased timeout
          );
          if (error) {
            console.error(`Supabase upsert error at batch ${i}:`, JSON.stringify(error, null, 2));
            throw new Error(`Batch upsert failed: ${error.message}`);
          }
          // Small delay between batches to let the DB breathe
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        results.push(`Synced ${products.length} products`);
      }

      if (settings && Object.keys(settings).length > 0) {
        const settingsToUpsert = Object.entries(settings).map(([key, data]) => ({ key, data }));
        console.log(`Upserting ${settingsToUpsert.length} setting groups to Supabase in batches...`);
        
        const sBatchSize = 1; // Process settings one by one as they can be very large
        for (let i = 0; i < settingsToUpsert.length; i += sBatchSize) {
          const sBatch = settingsToUpsert.slice(i, i + sBatchSize);
          console.log(`Upserting setting "${sBatch[0].key}" (${i+1}/${settingsToUpsert.length})...`);
          const { error } = await withTimeout(
            supabase.from('settings').upsert(sBatch),
            45000 // Increased timeout
          );
          if (error) {
            console.error(`Supabase settings upsert error for "${sBatch[0].key}":`, JSON.stringify(error, null, 2));
            throw new Error(`Settings upsert failed for ${sBatch[0].key}: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        results.push(`Synced ${settingsToUpsert.length} setting groups`);
      }

      // Clear caches
      localProductsCache = null;
      localSettingsCache = null;

      res.json({ 
        success: true, 
        message: results.length > 0 ? results.join(", ") : "No data found to sync" 
      });
    } catch (error: any) {
      console.error("Migration error:", error);
      res.status(500).json({ error: error.message || "Failed to sync local data to Supabase" });
    }
  });

  app.post("/api/admin/pull-from-cloud", async (req, res) => {
    try {
      console.log("Pulling data from Supabase to local files in batches...");
      
      let allProducts: any[] = [];
      let fetchMoreProducts = true;
      let pRangeStart = 0;
      const batchSize = 50;

      while (fetchMoreProducts) {
        console.log(`Fetching products range ${pRangeStart} to ${pRangeStart + batchSize - 1}...`);
        const { data: batch, error: pError } = await withTimeout(
          supabase
            .from('products')
            .select('*')
            .range(pRangeStart, pRangeStart + batchSize - 1)
            .order('id', { ascending: true }),
          30000
        );

        if (pError) {
          console.error("Product batch pull error:", pError);
          throw pError;
        }

        if (batch && batch.length > 0) {
          allProducts = [...allProducts, ...batch];
          pRangeStart += batchSize;
          if (batch.length < batchSize) fetchMoreProducts = false;
        } else {
          fetchMoreProducts = false;
        }
      }

      console.log(`Successfully fetched ${allProducts.length} products. Fetching settings in batches...`);

      let allSettingsRows: any[] = [];
      let fetchMoreSettings = true;
      let sRangeStart = 0;

      while (fetchMoreSettings) {
        console.log(`Fetching settings range ${sRangeStart} to ${sRangeStart + batchSize - 1}...`);
        const { data: sBatch, error: sError } = await withTimeout(
          supabase
            .from('settings')
            .select('*')
            .range(sRangeStart, sRangeStart + batchSize - 1)
            .order('id', { ascending: true }),
          30000
        );

        if (sError) {
          // If sorting by ID fails (maybe id doesn't exist), try without order
          const { data: sBatchRetry, error: sError2 } = await withTimeout(
            supabase
              .from('settings')
              .select('*')
              .range(sRangeStart, sRangeStart + batchSize - 1),
            30000
          );
            
          if (sError2) {
            console.error("Settings batch pull error:", sError2);
            throw sError2;
          }
          
          if (sBatchRetry && sBatchRetry.length > 0) {
            allSettingsRows = [...allSettingsRows, ...sBatchRetry];
            sRangeStart += batchSize;
            if (sBatchRetry.length < batchSize) fetchMoreSettings = false;
          } else {
            fetchMoreSettings = false;
          }
        } else if (sBatch && sBatch.length > 0) {
          allSettingsRows = [...allSettingsRows, ...sBatch];
          sRangeStart += batchSize;
          if (sBatch.length < batchSize) fetchMoreSettings = false;
        } else {
          fetchMoreSettings = false;
        }
      }

      const settings = allSettingsRows.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.data;
        return acc;
      }, {});

      // Write to local files
      const productsPath = path.join(process.cwd(), 'data', 'products_exported.json');
      const settingsPath = path.join(process.cwd(), 'data', 'settings_exported.json');

      await fs.writeFile(productsPath, JSON.stringify(allProducts, null, 2));
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

      // Clear caches so next fetch loads the new data
      localProductsCache = null;
      localSettingsCache = null;

      console.log(`Successfully pulled ${allProducts.length} products and ${Object.keys(settings).length} settings from Supabase.`);

      res.json({ 
        success: true, 
        message: `Successfully pulled ${allProducts.length} products and ${Object.keys(settings).length} settings.`,
        count: allProducts.length
      });
    } catch (error: any) {
      console.error("Pull error:", error);
      res.status(500).json({ error: error.message || "Failed to pull data from Supabase" });
    }
  });

  app.get("/api/admin/local-backup", async (req, res) => {
    try {
      const { data: products } = await supabase.from('products').select('*');
      const { data: settingsData } = await supabase.from('settings').select('*');
      const settings = (settingsData || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.data;
        return acc;
      }, {});
      res.json({ products, settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch backup from Supabase" });
    }
  });

  // Vite/Static setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
