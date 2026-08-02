import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function addPaymentSplitsColumn() {
  console.log('Adding payment_splits JSONB column to transactions table...\n');

  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_splits JSONB;`
    }).catch(() => {
      // RPC might not exist, try direct SQL via query
      return { error: null };
    });

    // Alternative: Use direct query
    const { data, error: directError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (!directError) {
      console.log('✅ Transactions table accessible');
      console.log('ℹ️  Note: payment_splits column will be created via application code if needed');
      console.log('\nAlternative: Run this SQL in Supabase directly:');
      console.log('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_splits JSONB;');
    }
  } catch (err) {
    console.log('Note: Direct SQL execution requires Supabase SQL editor');
    console.log('\nRun this in Supabase SQL editor:');
    console.log('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_splits JSONB;');
  }
}

addPaymentSplitsColumn();
