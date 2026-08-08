#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env
config();

// Supabase config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mirrors src/utils/slugify.ts — kept in sync manually since this script runs
// standalone under plain Node (not through the Vite/TS build).
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

function buildProductUrl(product) {
  const nameSlug = slugify(product.name);
  const codeSlug = product.product_code ? `-${slugify(product.product_code)}` : '';
  const shortId = product.id.substring(0, 8);
  return `/product/${nameSlug}${codeSlug}--${shortId}`;
}

// Helper function to make Supabase API calls
async function supabaseRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const requestPath = `/rest/v1${endpoint}`;

    const options = {
      hostname: url.hostname,
      path: requestPath,
      method: method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '[]'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function generateSitemap() {
  try {
    console.log('Generating sitemap...');

    // Fetch products
    console.log('Fetching products from Supabase...');
    const products = await supabaseRequest('/products?is_online=eq.true&select=id,name,category,product_code');
    console.log(`Found ${products.length} online products`);

    // Fetch published blog posts
    console.log('Fetching published blog posts from Supabase...');
    let blogPosts = [];
    try {
      blogPosts = await supabaseRequest('/blog_posts?is_published=eq.true&select=slug');
      console.log(`Found ${blogPosts.length} published blog posts`);
    } catch (err) {
      console.warn('Could not fetch blog_posts (table may not exist yet):', err.message);
    }

    // Get unique category slugs (deduplicate after slug conversion to handle case variations)
    const rawCategories = products.map(p => p.category).filter(Boolean);
    const categoryMap = new Map();
    rawCategories.forEach(cat => {
      const slug = cat.toLowerCase().replace(/\s+/g, '-');
      if (!categoryMap.has(slug)) {
        categoryMap.set(slug, cat);
      }
    });
    const uniqueCategories = Array.from(categoryMap.keys()).sort();
    console.log(`Found ${uniqueCategories.length} unique categories:`, uniqueCategories);

    // Build sitemap XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Main pages
    const mainPages = [
      { url: 'https://torontosoccershop.com', changefreq: 'weekly', priority: 1.0 },
      { url: 'https://torontosoccershop.com/products', changefreq: 'daily', priority: 0.9 },
      { url: 'https://torontosoccershop.com/brands', changefreq: 'weekly', priority: 0.8 },
      { url: 'https://torontosoccershop.com/blog', changefreq: 'weekly', priority: 0.8 },
      { url: 'https://torontosoccershop.com/custom-apparel', changefreq: 'monthly', priority: 0.8 },
      { url: 'https://torontosoccershop.com/brampton-soccer-uniforms', changefreq: 'monthly', priority: 0.8 },
      { url: 'https://torontosoccershop.com/mississauga-soccer-store', changefreq: 'monthly', priority: 0.9 },
    ];

    xml += '  <!-- Main Pages -->\n';
    mainPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Category pages (deduplicated)
    xml += '\n  <!-- Category Pages -->\n';
    uniqueCategories.forEach(categorySlug => {
      xml += '  <url>\n';
      xml += `    <loc>https://torontosoccershop.com/category/${categorySlug}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    // Product pages
    xml += '\n  <!-- Product Pages -->\n';
    products.forEach(product => {
      xml += '  <url>\n';
      xml += `    <loc>https://torontosoccershop.com${buildProductUrl(product)}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    });

    // Blog post pages
    xml += '\n  <!-- Blog Pages -->\n';
    blogPosts.forEach(post => {
      xml += '  <url>\n';
      xml += `    <loc>https://torontosoccershop.com/blog/${post.slug}</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    });

    // Brand pages
    xml += '\n  <!-- Brand Pages -->\n';
    xml += '  <url>\n';
    xml += '    <loc>https://torontosoccershop.com/brand/nike</loc>\n';
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
    xml += '  <url>\n';
    xml += '    <loc>https://torontosoccershop.com/brand/adidas</loc>\n';
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';

    xml += '</urlset>\n';

    // Write to file
    const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    fs.mkdirSync(path.dirname(sitemapPath), { recursive: true });
    fs.writeFileSync(sitemapPath, xml);

    console.log(`✅ Sitemap generated successfully: ${sitemapPath}`);
    console.log(`   - ${mainPages.length} main pages`);
    console.log(`   - ${uniqueCategories.length} category pages`);
    console.log(`   - ${products.length} product pages`);
    console.log(`   - ${blogPosts.length} blog pages`);
    console.log(`   - Total: ${mainPages.length + uniqueCategories.length + products.length + blogPosts.length + 2} URLs`);

  } catch (error) {
    console.error('Error generating sitemap:', error.message);
    process.exit(1);
  }
}

generateSitemap();
