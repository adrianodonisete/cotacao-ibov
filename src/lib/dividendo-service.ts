import type { SupabaseClient } from "@supabase/supabase-js";
import type { DividendoInput } from "@/types/dividendo";

type FetchError = { message?: string } | null | undefined;
type FetchResult = { data: unknown; error: FetchError };

interface SupabaseQuery<T> {
  select(cols?: string): SupabaseQuery<T>;
  insert(rows: T[]): SupabaseQuery<T>;
  in(col: string, values: string[]): SupabaseQuery<T>;
  eq(col: string, value: string): SupabaseQuery<T>;
  then<U>(resolve: (value: FetchResult) => U): Promise<U>;
}

export interface ProcessSupabase {
  from(table: "dividendos"): SupabaseQuery<DividendoInput>;
}

export interface DividendoBatchResult {
  inserted: number;
  dbDuplicates: number;
}

export async function processDividendosBatch(
  supabase: ProcessSupabase | SupabaseClient,
  rows: DividendoInput[]
): Promise<DividendoBatchResult> {
  const codes = [...new Set(rows.map((r) => r.code))];

  const { data: existing, error: fetchError } = (await supabase
    .from("dividendos")
    .select("code,quantity,payment_date,total_liquid")
    .in("code", codes)) as FetchResult;

  if (fetchError) {
    throw new Error(fetchError.message ?? "Erro ao verificar dividendos no banco.");
  }

  type ExistingRow = {
    code: string;
    quantity: number | string;
    payment_date: string;
    total_liquid: number | string;
  };

  const existingKeys = new Set(
    ((existing ?? []) as ExistingRow[]).map(
      (r) => `${r.code}|${Number(r.quantity)}|${r.payment_date}|${Number(r.total_liquid)}`
    )
  );

  const toInsert = rows.filter(
    (r) => !existingKeys.has(`${r.code}|${r.quantity}|${r.payment_date}|${r.total_liquid}`)
  );

  const dbDuplicates = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    return { inserted: 0, dbDuplicates };
  }

  const { data: insertedData, error: insertError } = (await supabase
    .from("dividendos")
    .insert(toInsert)
    .select()) as FetchResult;

  if (insertError) {
    throw new Error(insertError.message ?? "Erro ao inserir dividendos.");
  }

  return {
    inserted: Array.isArray(insertedData) ? insertedData.length : 0,
    dbDuplicates,
  };
}
