import type { SupabaseClient } from "@supabase/supabase-js";

export interface UpdateDividendoInput {
  payment_date: string;
  quantity: number;
  total_liquid: number;
}

export interface UpdatedDividendo {
  id: number;
  code: string;
  payment_date: string;
  quantity: number;
  total_liquid: number;
  updated_at: string;
}

export type UpdateDividendoResult =
  | { ok: true; dividendo: UpdatedDividendo }
  | { ok: false; status: 409 | 500; error: string };

export type DeleteDividendoResult =
  | { ok: true }
  | { ok: false; status: 500; error: string };

interface SupabaseChain {
  update(cols: Record<string, unknown>): SupabaseChain;
  delete(): SupabaseChain;
  select(cols?: string): SupabaseChain;
  single(): SupabaseChain;
  eq(col: string, val: unknown): SupabaseChain;
  then<T>(
    resolve: (v: {
      data: unknown;
      error: null | { message: string; code?: string };
    }) => T
  ): Promise<T>;
}

export interface DividendoSupabase {
  from(table: "dividendos"): SupabaseChain;
}

export async function updateDividendo(
  id: number,
  input: UpdateDividendoInput,
  supabase: DividendoSupabase | SupabaseClient
): Promise<UpdateDividendoResult> {
  const now = new Date().toISOString();

  const { data, error } = (await supabase
    .from("dividendos")
    .update({
      payment_date: input.payment_date,
      quantity: input.quantity,
      total_liquid: input.total_liquid,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single()) as {
    data: UpdatedDividendo | null;
    error: { message: string; code?: string } | null;
  };

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        status: 409,
        error:
          "Já existe um dividendo com esses valores (código, quantidade, data e total líquido). Verifique.",
      };
    }
    return { ok: false, status: 500, error: error.message };
  }

  if (!data) {
    return { ok: false, status: 500, error: "Dividendo não encontrado." };
  }

  return { ok: true, dividendo: data };
}

export async function deleteDividendo(
  id: number,
  supabase: DividendoSupabase | SupabaseClient
): Promise<DeleteDividendoResult> {
  const { error } = (await supabase
    .from("dividendos")
    .delete()
    .eq("id", id)) as {
    error: { message: string } | null;
    data: unknown;
  };

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  return { ok: true };
}
