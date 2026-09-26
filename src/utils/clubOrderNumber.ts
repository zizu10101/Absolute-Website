import { supabase } from '../supabase';

// Best-effort sequential order numbers (CLB-00001, CLB-00002, ...). club_orders.order_number
// has a UNIQUE constraint, so a rare race between two simultaneous submissions would surface
// as an insert error rather than silently overwriting an order.
export async function generateOrderNumber(): Promise<string> {
  const { count } = await supabase
    .from('club_orders')
    .select('id', { count: 'exact', head: true });
  const next = (count || 0) + 1;
  return `CLB-${String(next).padStart(5, '0')}`;
}
