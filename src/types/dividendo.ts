export interface DividendoInput {
  code: string;
  payment_date: string; // ISO yyyy-mm-dd
  quantity: number;
  total_liquid: number;
}

export interface Dividendo extends DividendoInput {
  id: number;
  created_at: string;
  updated_at: string;
}
