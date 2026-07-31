import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase";
import { processDividendosBatch } from "@/lib/dividendo-service";
import { previousMonthRange } from "@/lib/dividendo-defaults";
import type { DividendoInput } from "@/types/dividendo";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const dividendos = (body as { dividendos?: DividendoInput[] }).dividendos;

  if (!Array.isArray(dividendos) || dividendos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dividendo válido para cadastrar." },
      { status: 400 }
    );
  }

  try {
    const { inserted, dbDuplicates } = await processDividendosBatch(supabase, dividendos);
    return NextResponse.json({ inserted, dbDuplicates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao cadastrar dividendos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SORT_COLUMNS = ["code", "payment_date", "quantity", "total_liquid"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

export type GetDividendosSupabase = SupabaseClient | ReturnType<typeof getSupabaseServer>;

interface DividendoRow {
  id: number;
  code: string;
  payment_date: string;
  quantity: number | string;
  total_liquid: number | string;
  created_at: string;
  updated_at: string;
}

function pickSortColumn(raw: string | null): SortColumn {
  return (SORT_COLUMNS as readonly string[]).includes(raw ?? "")
    ? (raw as SortColumn)
    : "payment_date";
}

function pickPerPage(raw: string | null): number {
  const n = parseInt(raw ?? "20");
  return [10, 20, 50, 100].includes(n) ? n : 20;
}

export async function getDividendos(
  searchParams: URLSearchParams,
  supabase: GetDividendosSupabase
) {
  const type = searchParams.get("type") ?? "todos";
  const code = searchParams.get("code") ?? "";
  const defaultRange = previousMonthRange();
  const dateStart = searchParams.get("date_start") ?? defaultRange.start;
  const dateEnd = searchParams.get("date_end") ?? defaultRange.end;
  const sortBy = pickSortColumn(searchParams.get("sort_by"));
  const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const perPage = pickPerPage(searchParams.get("per_page"));

  let codesToFilter: string[] | null = null;

  if (type !== "todos") {
    const { data: ativos, error: ativosError } = await supabase
      .from("ativos")
      .select("code")
      .eq("type", type);

    if (ativosError) {
      return NextResponse.json({ error: ativosError.message }, { status: 500 });
    }

    codesToFilter = ((ativos ?? []) as { code: string }[]).map((a) => a.code);

    if (codesToFilter.length === 0) {
      return NextResponse.json({ dividendos: [], total: 0 });
    }
  }

  if (code.trim()) {
    const codeUpper = code.trim().toUpperCase();
    if (codesToFilter !== null) {
      codesToFilter = codesToFilter.filter((c) => c.includes(codeUpper));
      if (codesToFilter.length === 0) {
        return NextResponse.json({ dividendos: [], total: 0 });
      }
    }
  }

  let query = supabase
    .from("dividendos")
    .select("code, payment_date, quantity, total_liquid, created_at, updated_at, id", { count: "exact" })
    .gte("payment_date", dateStart)
    .lte("payment_date", dateEnd)
    .order(sortBy, { ascending: sortDir === "asc" })
    .order("id", { ascending: sortDir === "asc" });

  if (codesToFilter !== null) {
    query = query.in("code", codesToFilter);
  }

  if (code.trim()) {
    query = query.ilike("code", `%${code.trim().toUpperCase()}%`);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = (await query) as {
    data: DividendoRow[] | null;
    error: { message: string } | null;
    count: number | null;
  };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    dividendos: (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      payment_date: String(row.payment_date).split("T")[0],
      quantity: Number(row.quantity),
      total_liquid: Number(row.total_liquid),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    total: count ?? 0,
  });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  return getDividendos(searchParams, supabase);
}
