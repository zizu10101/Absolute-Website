import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkProduct() {
  console.log('=== FINDING VAPOR SLEEVES PRODUCT ===\n');

  const { data: products, error: error1 } = await supabase
    .from('products')
    .select('id, name, colors')
    .ilike('name', '%vapor%sleeve%');

  if (error1) {
    console.error('Error finding product:', error1);
    return;
  }

  if (!products || products.length === 0) {
    console.log('❌ No products found matching "Vapor Sleeves"');
    return;
  }

  const product = products[0];
  console.log('✅ Product found:');
  console.log(`   ID: ${product.id}`);
  console.log(`   Name: ${product.name}`);
  console.log(`   Colors defined: ${JSON.stringify(product.colors, null, 2)}\n`);

  console.log('=== CHECKING VARIANTS ===\n');

  const { data: variants, error: error2 } = await supabase
    .from('product_variants')
    .select('id, color, size, stock_quantity, age_group, barcode')
    .eq('product_id', product.id)
    .order('age_group');

  if (error2) {
    console.error('Error fetching variants:', error2);
    return;
  }

  if (!variants || variants.length === 0) {
    console.log('❌ No variants found for this product');
    return;
  }

  console.log(`Found ${variants.length} variants:\n`);
  variants.forEach((v, i) => {
    console.log(`${i + 1}. ID: ${v.id}`);
    console.log(`   Age Group: ${v.age_group}`);
    console.log(`   Size: ${v.size}`);
    console.log(`   Color: ${v.color || '(null/empty)'}`);
    console.log(`   Barcode: ${v.barcode}`);
    console.log(`   Stock: ${v.stock_quantity}`);
    console.log('');
  });

  console.log('=== SUMMARY ===');
  const variantsWithoutColor = variants.filter(v => !v.color || v.color === '');
  console.log(`Total variants: ${variants.length}`);
  console.log(`Variants WITHOUT color: ${variantsWithoutColor.length}`);
  if (variantsWithoutColor.length > 0) {
    console.log(`\nVariants needing color assignment:`);
    variantsWithoutColor.forEach(v => {
      console.log(`  - ${v.age_group} / ${v.size || 'One Size'} (${v.barcode})`);
    });
  }

  if (product.colors && product.colors.length > 0) {
    console.log(`\nProduct has ${product.colors.length} colors defined:`);
    product.colors.forEach(c => {
      console.log(`  - ${c.name}`);
    });
  }
}

checkProduct();
