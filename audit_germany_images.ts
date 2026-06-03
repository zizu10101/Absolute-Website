import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function auditGermanyImages() {
  try {
    console.log('='.repeat(90));
    console.log('GERMANY PRODUCT IMAGES AUDIT');
    console.log('='.repeat(90) + '\n');
    
    // Step 1: Query all Germany products
    console.log('1️⃣ QUERYING GERMANY PRODUCTS...\n');
    
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, image, images')
      .ilike('name', '%germany%')
      .order('name');
    
    if (error) {
      console.error('❌ Error querying products:', error);
      return;
    }
    
    console.log(`✅ Found ${products?.length || 0} Germany products\n`);
    
    const results: any[] = [];
    
    // Step 2: Analyze each product
    if (products && products.length > 0) {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   ID: ${p.id}`);
        
        // Check main image field
        if (p.image) {
          console.log(`   ✅ Main Image Field: ${typeof p.image === 'string' ? p.image.substring(0, 100) : 'Object'}`);
          results.push({
            name: p.name,
            id: p.id,
            mainImagePresent: true,
            mainImage: p.image,
            additionalImages: p.images?.length || 0
          });
        } else {
          console.log(`   ❌ Main Image Field: EMPTY/NULL`);
          results.push({
            name: p.name,
            id: p.id,
            mainImagePresent: false,
            mainImage: null,
            additionalImages: p.images?.length || 0
          });
        }
        
        // Check images array
        if (p.images && Array.isArray(p.images) && p.images.length > 0) {
          console.log(`   ✅ Images Array: ${p.images.length} items`);
          p.images.forEach((img: any, idx: number) => {
            const imgStr = typeof img === 'string' ? img.substring(0, 80) : JSON.stringify(img).substring(0, 80);
            console.log(`      ${idx + 1}. ${imgStr}`);
          });
        } else {
          console.log(`   ❌ Images Array: EMPTY/NULL`);
        }
        
        console.log('');
      }
    }
    
    // Step 3: Check if any URLs are accessible
    console.log('\n2️⃣ CHECKING URL ACCESSIBILITY...\n');
    
    for (const result of results) {
      if (result.mainImage && typeof result.mainImage === 'string' && result.mainImage.startsWith('http')) {
        try {
          const response = await fetch(result.mainImage, { method: 'HEAD', timeout: 5000 });
          console.log(`${result.name}:`);
          console.log(`   URL: ${result.mainImage.substring(0, 80)}`);
          console.log(`   Status: ${response.status} ${response.statusText}`);
          console.log(`   Accessible: ${response.ok ? '✅ YES' : '❌ NO'}`);
        } catch (err: any) {
          console.log(`${result.name}:`);
          console.log(`   URL: ${result.mainImage.substring(0, 80)}`);
          console.log(`   Error: ${err.message}`);
          console.log(`   Accessible: ❌ NO`);
        }
      }
    }
    
    // Step 4: Check Supabase Storage
    console.log('\n3️⃣ CHECKING SUPABASE STORAGE...\n');
    
    try {
      const { data: files, error: storageError } = await supabase
        .storage
        .from('products')
        .list('', { limit: 500 });
      
      if (storageError) {
        console.log(`❌ Error listing storage: ${storageError.message}`);
      } else {
        console.log(`✅ Storage bucket contains ${files?.length || 0} files\n`);
        
        const germanyFiles = files?.filter((f: any) => 
          f.name.toLowerCase().includes('germany') ||
          f.name.toLowerCase().includes('german') ||
          f.name.toLowerCase().includes('deu') // Germany code
        ) || [];
        
        if (germanyFiles.length > 0) {
          console.log(`🎯 Found ${germanyFiles.length} Germany-related files in storage:\n`);
          germanyFiles.forEach((f: any) => {
            console.log(`   📁 ${f.name}`);
            console.log(`      Size: ${f.metadata?.size} bytes`);
            console.log(`      Created: ${f.created_at}`);
            console.log(`      URL: ${supabaseUrl}/storage/v1/object/public/products/${f.name}`);
            console.log('');
          });
        } else {
          console.log(`⚠️  No Germany-related files found in storage\n`);
          console.log('Sample files in storage (first 20):');
          files?.slice(0, 20).forEach((f: any) => {
            console.log(`   - ${f.name}`);
          });
          if ((files?.length || 0) > 20) {
            console.log(`   ... and ${(files?.length || 0) - 20} more files`);
          }
        }
      }
    } catch (err: any) {
      console.log(`❌ Error checking storage: ${err.message}`);
    }
    
    // Step 5: Summary
    console.log('\n' + '='.repeat(90));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(90) + '\n');
    
    const productsWithImages = results.filter(r => r.mainImagePresent).length;
    const productsWithoutImages = results.filter(r => !r.mainImagePresent).length;
    const totalImages = results.reduce((sum, r) => sum + r.additionalImages, 0);
    
    console.log(`Total Germany Products: ${results.length}`);
    console.log(`  ✅ With main image: ${productsWithImages}`);
    console.log(`  ❌ Without main image: ${productsWithoutImages}`);
    console.log(`  Images in arrays: ${totalImages}\n`);
    
    if (productsWithoutImages === results.length) {
      console.log('⚠️  CRITICAL: ALL Germany products have NO IMAGES');
    }
    
    console.log('\nImage Status:');
    if (results.every(r => !r.mainImagePresent)) {
      console.log('  All image fields are EMPTY or NULL');
      console.log('  Reason: Images were never set or were deleted');
      console.log('  Solution: Admin must re-upload images through admin panel');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

auditGermanyImages();
