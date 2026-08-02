import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixVariants() {
  const productId = 'efd6d454-c9f9-4768-a76d-6a4f98e4bd90';

  console.log('Updating Vapor Sleeves variants without color to "White"...\n');

  const { data, error } = await supabase
    .from('product_variants')
    .update({ color: 'White' })
    .eq('product_id', productId)
    .or('color.is.null,color.eq.""')
    .select('id, age_group, size, color, barcode');

  if (error) {
    console.error('❌ Error updating variants:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('ℹ️  No variants needed updating (all have colors assigned)');
    return;
  }

  console.log(`✅ Successfully updated ${data.length} variant(s) to color "White":\n`);
  data.forEach((v, i) => {
    console.log(`${i + 1}. ${v.age_group} / ${v.size || 'One Size'}`);
    console.log(`   Barcode: ${v.barcode}`);
    console.log(`   Color: ${v.color}\n`);
  });

  // Verify the update
  console.log('=== VERIFICATION ===\n');
  const { data: allVariants } = await supabase
    .from('product_variants')
    .select('id, age_group, size, color, stock_quantity, barcode')
    .eq('product_id', productId)
    .order('age_group');

  console.log(`Total variants now: ${allVariants?.length || 0}\n`);
  allVariants?.forEach((v, i) => {
    console.log(`${i + 1}. ${v.age_group} ${v.size || '(no size)'} - Color: ${v.color || '(none)'} - Stock: ${v.stock_quantity}`);
  });
}

fixVariants();
