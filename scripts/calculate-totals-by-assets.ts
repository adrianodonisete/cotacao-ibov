import "./env";
import { getSupabaseServer } from "../src/lib/supabase";
import { parseJobId, updateJobProgress, finishJob } from "./job-progress";

type AtivoRow = { code: string; type: string; weight: number };

type AporteAgg = {
  total_qtd: number;
  total_aportado: number;
  primeiro_aporte: string | null;
  ultimo_aporte: string | null;
};

type CatTotals = {
  total_assets_value_current: number;
  total_assets_weight: number;
};

async function main(): Promise<{ total: number; ok: number; fail: number }> {
  const supabase = getSupabaseServer();
  const jobId = parseJobId();

  const [ativosRes, cotacoesRes, aportesRes, catCacheRes] = await Promise.all([
    supabase.from("ativos").select("code, type, weight"),
    supabase.from("cotacoes").select("code, value"),
    supabase.from("aportes").select("code, qtd, value_total, date_operation"),
    supabase
      .from("total_categories_cache")
      .select("category, total_assets_value_current, total_assets_weight"),
  ]);

  if (
    ativosRes.error ||
    cotacoesRes.error ||
    aportesRes.error ||
    catCacheRes.error
  ) {
    const msg =
      ativosRes.error?.message ??
      cotacoesRes.error?.message ??
      aportesRes.error?.message ??
      catCacheRes.error?.message ??
      "unknown";
    console.error("Error pre-loading data:", msg);
    if (jobId !== null) await finishJob(supabase, jobId, "error");
    process.exit(1);
  }

  const cotacoesByCode = new Map<string, number>();
  for (const c of (cotacoesRes.data ?? []) as Array<{ code: string; value: number }>) {
    cotacoesByCode.set(c.code, Number(c.value ?? 0));
  }

  const ativosList: AtivoRow[] = ((ativosRes.data ?? []) as AtivoRow[]).filter(
    (a) => cotacoesByCode.has(a.code)
  );

  if (ativosList.length === 0) {
    console.log("No assets with matching cotacao found.");
    if (jobId !== null) await finishJob(supabase, jobId, "done");
    return { total: 0, ok: 0, fail: 0 };
  }

  const aportesByCode = new Map<string, AporteAgg>();
  for (const row of (aportesRes.data ?? []) as Array<{
    code: string;
    qtd: number;
    value_total: number;
    date_operation: string;
  }>) {
    const cur =
      aportesByCode.get(row.code) ??
      ({
        total_qtd: 0,
        total_aportado: 0,
        primeiro_aporte: null,
        ultimo_aporte: null,
      } as AporteAgg);
    cur.total_qtd += Number(row.qtd ?? 0);
    cur.total_aportado += Number(row.value_total ?? 0);
    const d = row.date_operation;
    if (d && (!cur.primeiro_aporte || d < cur.primeiro_aporte)) cur.primeiro_aporte = d;
    if (d && (!cur.ultimo_aporte || d > cur.ultimo_aporte)) cur.ultimo_aporte = d;
    aportesByCode.set(row.code, cur);
  }

  const catTotalsByName = new Map<string, CatTotals>();
  for (const r of (catCacheRes.data ?? []) as Array<{
    category: string;
    total_assets_value_current: number;
    total_assets_weight: number;
  }>) {
    catTotalsByName.set(r.category, {
      total_assets_value_current: Number(r.total_assets_value_current ?? 0),
      total_assets_weight: Number(r.total_assets_weight ?? 0),
    });
  }

  if (catTotalsByName.size === 0) {
    console.warn(
      "total_categories_cache is empty. Run `npm run calculate-totals-by-category` first " +
        "to get meaningful target amounts and percentages."
    );
  }

  console.log(`Calculating totals for ${ativosList.length} asset(s)...`);
  let ok = 0;
  let fail = 0;

  for (const ativo of ativosList) {
    const code = ativo.code;
    const category_name = ativo.type;
    const peso = Number(ativo.weight ?? 0);

    try {
      const catTotals = catTotalsByName.get(category_name) ?? {
        total_assets_value_current: 0,
        total_assets_weight: 0,
      };
      const total_peso = catTotals.total_assets_weight;
      const total_value_curr = catTotals.total_assets_value_current;

      const ap =
        aportesByCode.get(code) ??
        ({
          total_qtd: 0,
          total_aportado: 0,
          primeiro_aporte: null,
          ultimo_aporte: null,
        } as AporteAgg);
      const cotacao = cotacoesByCode.get(code) ?? 0;

      const total_qtd = ap.total_qtd;
      const total_aportado = ap.total_aportado;
      const montante_atual = total_qtd * cotacao;

      const percentual_objetivo =
        peso > 0 && total_peso > 0 ? (peso / total_peso) * 100 : 0;
      const montante_objetivo = total_value_curr * (percentual_objetivo / 100);
      const percentual_aportado =
        total_value_curr > 0 ? (total_aportado / total_value_curr) * 100 : 0;
      const percentual_montante_atual =
        total_value_curr > 0 ? (montante_atual / total_value_curr) * 100 : 0;
      const lucro = montante_atual - total_aportado;
      const percentual_lucro = total_aportado > 0 ? (lucro / total_aportado) * 100 : 0;
      const montante_falta = montante_objetivo - montante_atual;
      const percentual_falta =
        montante_objetivo > 0 ? (montante_falta / montante_objetivo) * 100 : 0;

      const { error: upsertError } = await supabase
        .from("total_assets_cache")
        .upsert(
          {
            code,
            category_name,
            percentual_objetivo,
            montante_objetivo,
            total_qtd,
            cotacao,
            total_aportado,
            percentual_aportado,
            montante_atual,
            percentual_montante_atual,
            lucro,
            percentual_lucro,
            montante_falta,
            percentual_falta,
            primeiro_aporte: ap.primeiro_aporte,
            ultimo_aporte: ap.ultimo_aporte,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "code" }
        );

      if (upsertError) {
        console.error(`[${code}] Upsert failed:`, upsertError.message);
        fail++;
      } else {
        ok++;
        console.log(
          `[${code}] OK — qtd=${total_qtd} cot=${cotacao} ` +
            `atual=${montante_atual} objetivo=${montante_objetivo}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${code}]`, msg);
      fail++;
    }

    if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
  }

  console.log(`Done: ${ok} ok, ${fail} fail(s).`);
  if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? "error" : "done");
  return { total: ativosList.length, ok, fail };
}

main()
  .then((r) => process.exit(r.fail > 0 ? 1 : 0))
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal failure in calculate-totals-by-assets:", msg);
    process.exit(1);
  });
