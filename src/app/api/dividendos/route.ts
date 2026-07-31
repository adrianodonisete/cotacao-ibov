import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { processDividendosBatch } from "@/lib/dividendo-service";
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
