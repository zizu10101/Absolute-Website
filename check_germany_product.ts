import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkGermanyProduct() {
  try {
    console.log('='.repeat(80));
    console.log('INVESTIGATING GERMANY PRODUCT IMAGE');
    console.log('='.repeat(80) + '\n');
    
    console.log('1️⃣ QUERYING PRODUCTS TABLE FOR GERMANY...\n');
    
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, image, images')
      .ilike('name', '%germany%');
    
    if (error) {
      console.error('❌ Error querying products:', error);
      return;
    }
    
    if (!products || products.length === 0) {
      console.log('⚠️  No products found with "germany" in the name');
      console.log('\nSearching for all national team products...\n');
      
      const { data: allTeams, error: teamError } = await supabase
        .from('products')
        .select('id, name, image, images')
        .ilike('name', '%national%')
        .limit(10);
      
      if (!teamError && allTeams) {
        console.log(`Found ${allTeams.length} national team products:\n`);
        allTeams.forEach((p: any, i: number) => {
          console.log(`${i + 1}. ${p.name}`);
          console.log(`   ID: ${p.id}`);
          console.log(`   Image: ${p.image || 'MISSING'}`);
          console.log(`   Images array: ${p.images?.length || 0} items`);
        });
      }
      return;
    }
    
    console.log(`✅ Found ${products.length} product(s) with "germany" in name:\n`);
    
    products.forEach((product: any, idx: number) => {
      console.log(`${idx + 1}. PRODUCT DETAILS:`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Main Image (image field):`);
      
      if (product.image) {
        console.log(`      ✅ Present: ${product.image}`);
        
        // Check if it's a URL or data URI
        if (product.image.startsWith('http')) {
          console.log(`      Type: External URL`);
          console.log(`      Domain: ${new URL(product.image).hostname}`);
        } else if (product.image.startsWith('data:')) {
          console.log(`      Type: Data URI (base64 encoded)`);
          console.log(`      Size: ${product.image.length} bytes`);
        } else {
          console.log(`      Type: Other format`);
        }
      } else {
        console.log(`      ❌ MISSING - No main image set`);
      }
      
      console.log(`\n   Additional Images (images array):`);
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        console.log(`      ✅ ${product.images.length} images found:`);
        product.images.forEach((img: any, i: number) => {
          if (typeof img === 'string') {
            console.log(`         ${i + 1}. ${img.substring(0, 100)}`);
          } else if (typeof img === 'object') {
            console.log(`         ${i + 1}. ${JSON.stringify(img).substring(0, 100)}`);
          }
        });
      } else {
        console.log(`      ❌ EMPTY - No additional images`);
      }
      
      console.log('');
    });
    
    // If image URL exists, try to fetch it
    if (products[0]?.image && products[0].image.startsWith('http')) {
      console.log('2️⃣ CHECKING IF IMAGE URL IS ACCESSIBLE...\n');
      
      try {
        const response = await fetch(products[0].image, { method: 'HEAD', timeout: 5000 });
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`);
        
        if (response.ok) {
          console.log(`   ✅ Image URL is ACCESSIBLE`);
        } else {
          console.log(`   ❌ Image URL returned error status`);
        }
      } catch (err: any) {
        console.log(`   ❌ Error fetching URL: ${err.message}`);
      }
    }
    
    // Check Supabase Storage
    console.log('\n3️⃣ CHECKING SUPABASE STORAGE...\n');
    
    const { data: files, error: storageError } = await supabase
      .storage
      .from('products')
      .list('', { limit: 100 });
    
    if (storageError) {
      console.error(`   ❌ Error listing storage: ${storageError.message}`);
    } else if (files && files.length > 0) {
      const germanyFiles = files.filter((f: any) => 
        f.name.toLowerCase().includes('germany') ||
        f.name.toLowerCase().includes('german')
      );
      
      if (germanyFiles.length > 0) {
        console.log(`✅ Found ${germanyFiles.length} germany-related file(s) in storage:\n`);
        germanyFiles.forEach((f: any) => {
          console.log(`   📁 ${f.name}`);
          console.log(`      Size: ${f.metadata?.size} bytes`);
          console.log(`      Created: ${f.created_at}`);
          console.log(`      URL: ${supabaseUrl}/storage/v1/object/public/products/${f.name}`);
        });
      } else {
        console.log(`⚠️  No germany-related files found in storage`);
        console.log(`\n   Storage contains ${files.length} total files`);
        console.log('   Sample files:');
        files.slice(0, 5).forEach((f: any) => {
          console.log(`      - ${f.name}`);
        });
        if (files.length > 5) {
          console.log(`      ... and ${files.length - 5} more`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSIS SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    if (products[0]?.image) {
      console.log(`✅ Image field has value: ${products[0].image.substring(0, 80)}...`);
      console.log('   Action: Try to verify URL accessibility in next step');
    } else {
      console.log(`❌ Image field is EMPTY or NULL`);
      console.log('   Action: Admin needs to re-upload image through admin panel');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkGermanyProduct();
