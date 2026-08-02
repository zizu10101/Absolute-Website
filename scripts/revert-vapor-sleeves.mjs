import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function revertVariants() {
  const productId = 'efd6d454-c9f9-4768-a76d-6a4f98e4bd90';

  console.log('Reverting Vapor Sleeves duplicate variants to NULL color...\n');

  // Find sizes with duplicates
  const { data: sizes } = await supabase
    .from('product_variants')
    .select('size')
    .eq('product_id', productId)
    .order('size');

  const sizeGroups = {};
  sizes?.forEach(v => {
    sizeGroups[v.size] = (sizeGroups[v.size] || 0) + 1;
  });

  const duplicateSizes = Object.keys(sizeGroups).filter(s => sizeGroups[s] > 1);
  console.log(`Duplicate sizes: ${duplicateSizes.join(', ')}\n`);

  // Revert one of each duplicate pair to NULL
  for (const size of duplicateSizes) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, color, barcode')
      .eq('product_id', productId)
      .eq('size', size)
      .eq('color', 'White');

    if (variants && variants.length > 0) {
      // Revert the first one found
      const { error } = await supabase
        .from('product_variants')
        .update({ color: null })
        .eq('id', variants[0].id);

      if (!error) {
        console.log(`✅ Reverted ${size} variant (barcode: ${variants[0].barcode}) to NULL`);
      }
    }
  }

  console.log('\n=== Verification ===\n');
  const { data: all } = await supabase
    .from('product_variants')
    .select('age_group, size, color, barcode, stock_quantity')
    .eq('product_id', productId)
    .order('size');

  all?.forEach((v, i) => {
    console.log(`${i + 1}. ${v.size || 'One Size'} - Color: ${v.color || '(NULL)'} - Stock: ${v.stock_quantity}`);
  });
}

revertVariants();
