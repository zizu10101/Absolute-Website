# Product Feed Setup for Google Merchant Center & Meta Commerce Manager

## Overview
The product feed is available at **https://torontosoccershop.com/product-feed.xml**

This feed is compatible with:
- ✅ Google Merchant Center (Merchant Account > Products > Primary feed)
- ✅ Meta Commerce Manager (Catalog > Data Sources)
- ✅ Any RSS/XML product feed aggregator

## Feed Details

### Endpoint
```
https://torontosoccershop.com/product-feed.xml
```

### Format
- **Standard:** Google RSS Product Feed (also called Atom/RSS with Google Extensions)
- **Content-Type:** application/rss+xml
- **Encoding:** UTF-8
- **Refresh Rate:** 1-hour server-side cache (recommended external checks: 2-4 hours)

### What's Included
- **Products:** All products where `is_online = true` in the database
- **Stock Status:** Real-time from `product_variants` table
  - `in_stock` if any variant has `stock_quantity > 0`
  - `out_of_stock` if all variants have `stock_quantity = 0`
- **Fields per Product:**
  - ID (UUID)
  - Title (product name)
  - Description (first 5000 chars from product.description)
  - Link (to product detail page)
  - Image (primary product image)
  - Availability (in_stock/out_of_stock)
  - Price (in CAD)
  - Sale Price (if isOnSale=true and salePrice is set)
  - Brand
  - Condition (always "new")
  - MPN (product_code if available)
  - Identifier Exists (yes if product_code, else no)
  - Google Product Category (Sporting Goods > Team Sports > Soccer)

---

## Google Merchant Center Setup

### 1. Add Primary Feed in Google Merchant Center
1. Go to [Google Merchant Center](https://merchants.google.com/)
2. Select your account
3. In the left sidebar, go **Products > Feeds**
4. Click **Create feed**
5. Name it: `Absolute Soccer Product Feed`
6. Scheduled upload: choose **Automatic (via URL)**
7. Feed URL: `https://torontosoccershop.com/product-feed.xml`
8. Fetch Schedule: Set to **Daily** (or 2-4 times daily if you update inventory frequently)
9. Click **Create**

### 2. Monitor Feed Status
- Go to **Products > Feeds** and click your feed
- Check **Status** tab to see:
  - ✅ Successful uploads
  - ⚠️ Warnings (missing recommended fields)
  - ❌ Errors (critical fields missing)
- Fix any errors reported by Google

### 3. Verify Products in Catalog
- Once the feed processes, go to **Products > Catalog**
- Search for a product to verify it imported correctly
- Check **Product Details** tab for any warnings

### 4. Set Up Shopping Campaigns
- Create a **Shopping campaign** in Google Ads
- Link it to this Merchant Center account
- Products should automatically populate in your ad campaigns

---

## Meta Commerce Manager Setup

### 1. Create Catalog Data Source
1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Commerce Manager > Catalogs**
3. Select your catalog (or create one: "Absolute Soccer Products")
4. Go to **Data Sources > Add Data Source**
5. Choose **Add Scheduled Feed**
6. Select **URL Feed**
7. Feed URL: `https://torontosoccershop.com/product-feed.xml`
8. Update Frequency: **Every 24 hours** (or 2-4x daily)
9. Provide your feed (continue)

### 2. Field Mapping
Meta will auto-detect most fields. Verify:
- ✅ **ID** → g:id (product UUID)
- ✅ **Title** → g:title
- ✅ **Description** → g:description
- ✅ **Link** → g:link
- ✅ **Image** → g:image_link
- ✅ **Availability** → g:availability
- ✅ **Price** → g:price
- ✅ **Sale Price** → g:sale_price (optional)
- ✅ **Brand** → g:brand

### 3. Connect to Commerce Platform
- Go to **Catalogs > Select your catalog**
- Go to **Shop tab**
- Configure your **Online Store** or **Facebook/Instagram Shop**
- Connect to Shopify, WooCommerce, etc. (if applicable)

### 4. Enable Dynamic Ads
- Go to **Commerce Manager > Catalogs > Select your catalog**
- Go to **Dynamic Ads Settings**
- Enable product recommendations for:
  - ✅ Facebook Ads
  - ✅ Instagram Ads
  - ✅ Audience Network

---

## Monitoring & Maintenance

### Check Feed Health (Monthly)
```bash
# From your server or local machine:
curl -I https://torontosoccershop.com/product-feed.xml

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: application/rss+xml; charset=utf-8
```

### Common Issues & Fixes

#### Feed Returns 500 Error
- Check Supabase connection (VITE_SUPABASE_URL in .env)
- Verify service role key is set (SUPABASE_SERVICE_ROLE_KEY)
- Check server logs: `npm run dev`

#### Products Not Showing in Google/Meta
1. Verify `is_online = true` in database for those products
2. Check that `price` and `image` fields are populated
3. Wait for next feed refresh (up to 1 hour + platform processing)
4. In Google Merchant Center, check **Products > Diagnostics** for errors

#### Stock Status Not Updating
- Feed caches for 1 hour (automatically refreshes)
- Verify `product_variants` table has correct `stock_quantity` values
- Restart server after bulk stock updates to clear cache immediately

#### Price/Sale Price Not Showing
- Ensure `price` field is a number (not string)
- `salePrice` only appears if `isOnSale = true` AND `salePrice > 0`
- Google/Meta may take a few hours to reflect price changes

### Manual Cache Clear (if needed)
The feed automatically caches for 1 hour. To force refresh:
1. **Restart the server:** `npm run dev` (development)
2. **Or redeploy to production:** This resets the cache
3. Next request will regenerate the feed from fresh database data

---

## Technical Details

### Feed Generation Process
1. Server receives request to `/product-feed.xml`
2. Checks 1-hour cache
   - If valid cache exists, return it (fast)
   - If cache expired, proceed
3. Query Supabase:
   - Fetch all products where `is_online = true`
   - Fetch all product_variants with stock > 0
4. Build stock map (product_id → total_stock)
5. Generate XML:
   - Escape special characters
   - Include all required fields
   - Set availability based on stock
6. Cache result for 1 hour
7. Return with `Content-Type: application/rss+xml`

### Cache Key
```typescript
// 1 hour TTL
cachedFeed = {
  xml: string,
  expires: Date.now() + (60 * 60 * 1000)
}
```

### Stock Calculation
```typescript
// Stock per product = sum of all variant stock_quantities
const productStock = new Map<string, number>();
for (const variant of allVariants) {
  const current = productStock.get(variant.product_id) || 0;
  productStock.set(variant.product_id, current + variant.stock_quantity);
}

// Availability
const availability = stock > 0 ? 'in_stock' : 'out_of_stock';
```

---

## Troubleshooting

### Feed Won't Load
```bash
# Test on localhost
npm run dev
curl http://localhost:3000/product-feed.xml

# Check for XML syntax errors
# Verify Supabase credentials in .env
```

### Google/Meta Not Fetching
1. Whitelist your server IP (if behind firewall)
2. Check feed URL is publicly accessible:
   ```bash
   curl -I https://torontosoccershop.com/product-feed.xml
   ```
3. Verify HTTP 200 response with XML content-type
4. Check both systems' crawler logs

### Partial Data in Feed
- Some products may not have `product_code` (MPN) - that's okay (identifier_exists = no)
- Description is limited to 5000 chars - products with longer descriptions get truncated
- Missing images won't break the feed - Google/Meta will flag as warning

---

## File Locations

- **Feed Source:** `/server.ts` (lines ~1913-2047)
- **Route:** `GET /product-feed.xml`
- **Documentation:** `/docs/PRODUCT_FEED_SETUP.md` (this file)

## Next Steps

1. ✅ Test feed locally: `npm run dev` → http://localhost:3000/product-feed.xml
2. ✅ Deploy to production (Vercel)
3. ✅ Add feed URL to Google Merchant Center
4. ✅ Add feed URL to Meta Commerce Manager
5. ✅ Monitor feed status for first week
6. ✅ Set up automatic refresh schedule (daily or 2-4x daily)
7. ✅ Create Shopping campaigns in Google Ads
8. ✅ Enable Dynamic Ads in Meta

---

## Contact & Support

- **Feed URL:** https://torontosoccershop.com/product-feed.xml
- **Status Check:** https://torontosoccershop.com/api/health
- **Database:** Supabase (products table must have is_online = true)
- **Admin Panel:** /admin → Products → toggle "Online" flag per product

---

**Last Updated:** August 7, 2026  
**Feed Format:** Google RSS Product Feed 2.1  
**Status:** ✅ Live and tested
