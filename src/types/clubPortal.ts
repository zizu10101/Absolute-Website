export interface PrintType {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface PrintAddon {
  print_type_id: string;
  print_type_name: string;
  cost_per_unit: number;
}

export interface ClubItem {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sizes_available: string[];
  price: number;
  discount_value: number | null;
  discount_type: string | null;
  is_suggested: boolean;
  sort_order: number;
  print_addons: PrintAddon[];
  created_at: string;
}

export interface ClubOrderLineItem {
  name: string;
  size: string;
  qty: number;
  price: number;
}

export interface MatrixRow {
  id: string;
  itemId: string;
  itemName: string;
  size: string;
  playerName: string;
  playerNumber: string;
  initials: string;
  sponsorName: string;
  allowName: boolean;
  allowNumber: boolean;
  allowInitials: boolean;
  allowSponsor: boolean;
}

export interface SponsorEntry {
  name: string;
}

export interface ClubOrder {
  id: string;
  club_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'in_production' | 'ready' | 'delivered';
  items: ClubOrderLineItem[];
  customization_matrix: MatrixRow[] | null;
  sponsors: SponsorEntry[] | null;
  print_breakdown: any[] | null;
  notes: string | null;
  total_amount: number;
  deposit_paid: number;
  balance_owing: number;
  invoice_url: string | null;
  confirmed_at: string | null;
  created_at: string;
}
