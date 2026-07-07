import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
} from "@/lib/total-asset-categories";
import type {
  TotalAssetWithInfo,
  TotalAssetsApiResponse,
} from "@/types/total-asset";

export async function GET(request: NextRequest): Promise<NextResponse<TotalAssetsApiResponse>> {
  const category = request.nextUrl.searchParams.get("category")?.trim();

  if (!category) {
    return NextResponse.json(
      { error: 'Parâmetro "category" é obrigatório.' },
      { status: 400 }
    );
  }

  if (!isTotalAssetCategory(category)) {
    return NextResponse.json(
      { error: `Categoria inválida. Aceitas: ${TOTAL_ASSET_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: cacheRows, error: cacheError } = await supabase
    .from("total_assets_cache")
    .select("*")
    .eq("category_name", category)
    .order("code", { ascending: true });

  if (cacheError) {
    return NextResponse.json({ error: cacheError.message }, { status: 500 });
  }

  const rows = cacheRows ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ totals: [], category });
  }

  const codes = rows.map((r) => r.code);

  const { data: ativosRows, error: ativosError } = await supabase
    .from("ativos")
    .select("code, info, weight")
    .in("code", codes);

  if (ativosError) {
    return NextResponse.json({ error: ativosError.message }, { status: 500 });
  }

  const ativosByCode = new Map<string, { info: string; weight: number }>();
  for (const a of ativosRows ?? []) {
    ativosByCode.set(a.code, {
      info: a.info ?? "",
      weight: Number(a.weight ?? 0),
    });
  }

  const totals: TotalAssetWithInfo[] = rows.map((row) => {
    const ativo = ativosByCode.get(row.code);
    return {
      code: row.code,
      category_name: row.category_name,
      percentual_objetivo: Number(row.percentual_objetivo),
      montante_objetivo: Number(row.montante_objetivo),
      total_qtd: Number(row.total_qtd),
      cotacao: Number(row.cotacao),
      total_aportado: Number(row.total_aportado),
      percentual_aportado: Number(row.percentual_aportado),
      montante_atual: Number(row.montante_atual),
      percentual_montante_atual: Number(row.percentual_montante_atual),
      lucro: Number(row.lucro),
      percentual_lucro: Number(row.percentual_lucro),
      montante_falta: Number(row.montante_falta),
      percentual_falta: Number(row.percentual_falta),
      primeiro_aporte: row.primeiro_aporte,
      ultimo_aporte: row.ultimo_aporte,
      info: ativo?.info ?? "",
      weight: ativo?.weight ?? 0,
    };
  });

  return NextResponse.json({ totals, category });
}
