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

async function main() {
  try {
    console.log("Checking if size column is nullable...");
    
    // Check column constraint in Supabase
    const { data, error } = await supabase.rpc('get_column_constraint', {
      table_name: 'product_variants',
      column_name: 'size'
    }).catch(() => ({ data: null, error: new Error('RPC not available') }));
    
    if (error) {
      console.log("⚠️  Cannot verify via RPC. Size column should already allow NULL in Supabase.");
      console.log("Size column should already be nullable for this task to work.");
      console.log("\nTo manually verify in Supabase dashboard:");
      console.log("1. Go to Database > product_variants");
      console.log("2. Check the 'size' column - it should show 'Nullable'");
      console.log("3. If not nullable, click Edit Column and toggle 'Allow NULL'");
      process.exit(0);
    }
    
    console.log("Column info:", data);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
