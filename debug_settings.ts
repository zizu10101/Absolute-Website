
import { supabase } from './src/supabase';

async function checkSettings() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Settings:', JSON.stringify(data, null, 2));
  }
}

checkSettings();
