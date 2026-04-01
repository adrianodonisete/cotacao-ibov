import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Aporte } from "@/types/aporte";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

// GET /api/aportes
// Parâmetros: type, code, date_start, date_end, sort_by, sort_dir, page, per_page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") ?? "todos";
  const code = searchParams.get("code") ?? "";
  const dateStart = searchParams.get("date_start") ?? daysAgoStr(30);
  const dateEnd = searchParams.get("date_end") ?? todayStr();
  const sortBy = ["code", "date_operation"].includes(searchParams.get("sort_by") ?? "")
    ? (searchParams.get("sort_by") as string)
    : "date_operation";
  const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const perPage = [10, 20, 50, 100].includes(parseInt(searchParams.get("per_page") ?? "20"))
    ? parseInt(searchParams.get("per_page") as string)
    : 20;

  // Resolve type filter: get codes from ativos that belong to the selected type
  let codesToFilter: string[] | null = null;

  if (type && type !== "todos") {
    const { data: ativos, error: ativosError } = await supabase
      .from("ativos")
      .select("code")
      .eq("type", type);

    if (ativosError) {
      return NextResponse.json({ error: ativosError.message }, { status: 500 });
    }

    codesToFilter = (ativos ?? []).map((a: { code: string }) => a.code);

    if (codesToFilter.length === 0) {
      return NextResponse.json({ aportes: [], total: 0 });
    }
  }

  // Apply code search — if codesToFilter is set, filter it; otherwise use ilike
  if (code.trim()) {
    const codeUpper = code.trim().toUpperCase();
    if (codesToFilter !== null) {
      codesToFilter = codesToFilter.filter((c) => c.includes(codeUpper));
      if (codesToFilter.length === 0) {
        return NextResponse.json({ aportes: [], total: 0 });
      }
    }
  }

  let query = supabase
    .from("aportes")
    .select("*", { count: "exact" })
    .gte("date_operation", dateStart)
    .lte("date_operation", dateEnd)
    .order(sortBy, { ascending: sortDir === "asc" });

  if (codesToFilter !== null) {
    query = query.in("code", codesToFilter);
  } else if (code.trim()) {
    query = query.ilike("code", `%${code.trim().toUpperCase()}%`);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ aportes: data ?? [], total: count ?? 0 });
}

// POST /api/aportes → cadastro em lote
// Body: { aportes: Array<{ code, qtd, value_total, date_operation }> }
// Retorna: { inserted, duplicates: [{code, qtd, date_operation}] }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { aportes } = body as { aportes: Omit<Aporte, "id">[] };

  if (!Array.isArray(aportes) || aportes.length === 0) {
    return NextResponse.json(
      { error: "Nenhum aporte para cadastrar." },
      { status: 400 }
    );
  }

  // Fetch existing (code, qtd, date_operation) for the codes in the list
  const codes = [...new Set(aportes.map((a) => a.code))];

  const { data: existing, error: fetchError } = await supabase
    .from("aportes")
    .select("code, qtd, date_operation")
    .in("code", codes);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (a: { code: string; qtd: string; date_operation: string }) =>
        `${a.code}|${Number(a.qtd)}|${a.date_operation}`
    )
  );

  const toInsert = aportes.filter(
    (a) => !existingKeys.has(`${a.code}|${Number(a.qtd)}|${a.date_operation}`)
  );
  const duplicates = aportes
    .filter((a) =>
      existingKeys.has(`${a.code}|${Number(a.qtd)}|${a.date_operation}`)
    )
    .map(({ code, qtd, date_operation }) => ({ code, qtd, date_operation }));

  let inserted = 0;

  if (toInsert.length > 0) {
    const { data: insertedData, error: insertError } = await supabase
      .from("aportes")
      .insert(toInsert)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    inserted = insertedData?.length ?? 0;
  }

  return NextResponse.json({ inserted, duplicates });
}
