import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

type CheckItem = { code: string; qtd: number; date_operation: string };

// POST /api/aportes/check
// Body: { aportes: CheckItem[] }
// Retorna: { duplicates: CheckItem[] } — quais já existem no banco
export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  const body = await request.json();
  const { aportes } = body as { aportes: CheckItem[] };

  if (!Array.isArray(aportes) || aportes.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  const codes = [...new Set(aportes.map((a) => a.code))];

  const { data: existing, error } = await supabase
    .from("aportes")
    .select("code, qtd, date_operation")
    .in("code", codes);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (a: { code: string; qtd: string; date_operation: string }) =>
        `${a.code}|${Number(a.qtd)}|${a.date_operation}`
    )
  );

  const duplicates = aportes.filter((a) =>
    existingKeys.has(`${a.code}|${Number(a.qtd)}|${a.date_operation}`)
  );

  return NextResponse.json({ duplicates });
}
