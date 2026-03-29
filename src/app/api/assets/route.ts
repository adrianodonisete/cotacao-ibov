import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Asset } from "@/types/asset";

// GET /api/assets          → todos os ativos (para checagem de duplicatas)
// GET /api/assets?type=acao → filtrado por tipo, ordenado por peso desc
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  let query = supabase
    .from("ativos")
    .select("*")
    .order("weight", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data ?? [] });
}

// POST /api/assets → cadastro em lote
// Body: { assets: Array<{ code, info, type, weight }> }
// Retorna: { inserted: number, duplicates: string[] }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { assets } = body as { assets: Omit<Asset, "id">[] };

  if (!Array.isArray(assets) || assets.length === 0) {
    return NextResponse.json(
      { error: "Nenhum ativo para cadastrar." },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("ativos")
    .select("code");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingCodes = new Set(
    (existing ?? []).map((a: { code: string }) => a.code)
  );

  const toInsert = assets.filter((a) => !existingCodes.has(a.code));
  const duplicates = assets
    .filter((a) => existingCodes.has(a.code))
    .map((a) => a.code);

  let inserted = 0;

  if (toInsert.length > 0) {
    const { data: insertedData, error: insertError } = await supabase
      .from("ativos")
      .insert(toInsert)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    inserted = insertedData?.length ?? 0;
  }

  return NextResponse.json({ inserted, duplicates });
}
