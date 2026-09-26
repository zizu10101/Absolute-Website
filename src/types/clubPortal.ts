export interface ClubItem {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sizes_available: string[];
  price: number;
  is_suggested: boolean;
  sort_order: number;
  created_at: string;
}

export interface ClubOrderLineItem {
  name: string;
  size: string;
  qty: number;
  price: number;
}

export interface ClubOrder {
  id: string;
  club_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'in_production' | 'ready' | 'delivered';
  items: ClubOrderLineItem[];
  notes: string | null;
  total_amount: number;
  deposit_paid: number;
  balance_owing: number;
  invoice_url: string | null;
  confirmed_at: string | null;
  created_at: string;
}
