import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const productsToMakeOnline = [
  "Germany  Away Jersey Y - Navy",
  "Germany  Home Jersey Y - White",
  "Germany Ball - White",
  "Germany Cap - White",
  "Germany GK  H JSY - Green"
];

async function main() {
  console.log(`Marking ${productsToMakeOnline.length} products as online...`);
  
  for (const productName of productsToMakeOnline) {
    const { data, error } = await supabase
      .from('products')
      .update({ is_online: true })
      .eq('name', productName);
    
    if (error) {
      console.error(`❌ Failed to update "${productName}":`, error.message);
    } else {
      console.log(`✅ Updated "${productName}" - is_online=true`);
    }
  }
  
  console.log("\nVerifying updates...");
  const { data: updated, error: verifyError } = await supabase
    .from('products')
    .select('name, is_online')
    .in('name', productsToMakeOnline);
  
  if (verifyError) {
    console.error("Error verifying:", verifyError);
  } else {
    console.log("\nFinal status:");
    updated?.forEach(p => {
      console.log(`  ${p.name}: is_online=${p.is_online}`);
    });
  }
}

main();
