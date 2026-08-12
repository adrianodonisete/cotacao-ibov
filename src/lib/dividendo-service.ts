import type { SupabaseClient } from "@supabase/supabase-js";
import type { DividendoInput } from "@/types/dividendo";

type FetchError = { message?: string } | null | undefined;
type FetchResult = { data: unknown; error: FetchError };

interface SupabaseQuery<T> {
  select(cols?: string): SupabaseQuery<T>;
  insert(rows: T[]): SupabaseQuery<T>;
  in(col: string, values: string[]): SupabaseQuery<T>;
  eq(col: string, value: string): SupabaseQuery<T>;
  limit(n: number): SupabaseQuery<T>;
  then<U>(resolve: (value: FetchResult) => U): Promise<U>;
}

export interface ProcessSupabase {
  from(table: "dividendos"): SupabaseQuery<DividendoInput>;
}

export interface DividendoBatchResult {
  inserted: number;
  dbDuplicates: number;
  errorCount: number;
}

async function rowExists(
  supabase: ProcessSupabase | SupabaseClient,
  row: DividendoInput
): Promise<boolean> {
  const { data, error } = (await supabase
    .from("dividendos")
    .select("id")
    .eq("code", row.code)
    .eq("payment_date", row.payment_date)
    .eq("quantity", row.quantity)
    .eq("total_liquid", row.total_liquid)
    .limit(1)) as FetchResult;

  if (error) {
    throw new Error(error.message ?? "Erro ao verificar dividendos no banco.");
  }

  return Array.isArray(data) && data.length > 0;
}

export async function processDividendosBatch(
  supabase: ProcessSupabase | SupabaseClient,
  rows: DividendoInput[]
): Promise<DividendoBatchResult> {
  const toInsert: DividendoInput[] = [];
  let dbDuplicates = 0;

  for (const row of rows) {
    if (await rowExists(supabase, row)) {
      dbDuplicates++;
      continue;
    }
    toInsert.push(row);
  }

  let inserted = 0;
  let errorCount = 0;

  for (const row of toInsert) {
    const { error } = (await supabase
      .from("dividendos")
      .insert([row])
      .select()) as FetchResult;

    if (error) {
      errorCount++;
      continue;
    }
    inserted++;
  }

  return { inserted, dbDuplicates, errorCount };
}
