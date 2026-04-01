export interface Aporte {
  id: number;
  code: string;
  qtd: number;
  value_total: number;
  date_operation: string; // yyyy-mm-dd
}

export interface AporteFilters {
  type?: string;
  code?: string;
  date_start?: string;
  date_end?: string;
  sort_by?: "code" | "date_operation";
  sort_dir?: "asc" | "desc";
  page?: number;
  per_page?: number;
}
