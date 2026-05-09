import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImages() {
  console.log('Verifying image fields in Supabase...');
  
  const { data, error } = await supabase
    .from('products')
    .select('id, name, image')
    .limit(5);

  if (error) {
    console.error('Error fetching products:', error.message);
    return;
  }

  console.log('Sample products image check:');
  data!.forEach(p => {
    console.log(`Product: ${p.name}, Image length: ${p.image ? p.image.length : 'null'}`);
  });
}

verifyImages();
