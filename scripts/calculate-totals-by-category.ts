import "./env";
import { getSupabaseServer } from "../src/lib/supabase";
import { parseJobId, updateJobProgress, finishJob } from "./job-progress";

type CategoryRow = { name: string };
type AtivoRow = { code: string; weight: number };
type AporteRow = { value_total: number };
type DividendRow = { code: string; total_liquid: number };

async function main(): Promise<{ total: number; ok: number; fail: number }> {
  const supabase = getSupabaseServer();
  const jobId = parseJobId();

  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("name");

  if (catError) {
    console.error("Erro ao listar categorias:", catError.message);
    if (jobId !== null) await finishJob(supabase, jobId, "error");
    process.exit(1);
  }

  const rows: CategoryRow[] = (categories ?? []) as CategoryRow[];
  if (rows.length === 0) {
    console.log("Nenhuma categoria encontrada.");
    if (jobId !== null) await finishJob(supabase, jobId, "done");
    return { total: 0, ok: 0, fail: 0 };
  }

  console.log(`Calculando totais para ${rows.length} categoria(s)...`);
  let ok = 0;
  let fail = 0;

  for (const cat of rows) {
    const category = cat.name;
    try {
      const { data: ativos, error: listError } = await supabase
        .from("ativos")
        .select("code, weight")
        .eq("type", category);

      if (listError) {
        console.error(`[${category}] Erro ao listar ativos:`, listError.message);
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const ativosList: AtivoRow[] = (ativos ?? []) as AtivoRow[];
      if (ativosList.length === 0) {
        // Nenhum ativo nesta categoria — salva tudo como 0
        const { error: upsertError } = await supabase
          .from("total_categories_cache")
          .upsert(
            {
              category,
              total_assets_value_aported: 0,
              total_assets_value_current: 0,
              total_assets_weight: 0,
              total_dividends: 0,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "category" }
          );

        if (upsertError) {
          console.error(`[${category}] Erro ao salvar cache:`, upsertError.message);
          fail++;
        } else {
          ok++;
          console.log(`[${category}] OK (sem ativos) — todos os valores zerados`);
        }
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const codes = ativosList.map((a: AtivoRow) => a.code);

      const total_assets_weight = ativosList.reduce(
        (sum: number, a: AtivoRow) => sum + Number(a.weight ?? 0),
        0
      );

      // total_assets_value_aported: soma de aportes.value_total dos ativos da categoria
      const { data: aportes, error: aportesError } = await supabase
        .from("aportes")
        .select("value_total")
        .in("code", codes);

      if (aportesError) {
        console.error(`[${category}] Erro ao buscar aportes:`, aportesError.message);
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const aportesList: AporteRow[] = (aportes ?? []) as AporteRow[];

      const total_assets_value_aported = aportesList.reduce(
        (sum: number, a: AporteRow) => sum + Number(a.value_total ?? 0),
        0
      );

      // total_assets_value_current: sum(cotacoes.value * aportes.qtd) por ativo
      // Primeiro busca cotações
      const { data: cotacoes, error: cotacoesError } = await supabase
        .from("cotacoes")
        .select("code, value")
        .in("code", codes);

      if (cotacoesError) {
        console.error(`[${category}] Erro ao buscar cotações:`, cotacoesError.message);
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const cotacoesMap = new Map<string, number>();
      for (const c of cotacoes ?? []) {
        cotacoesMap.set(c.code, Number(c.value ?? 0));
      }

      // Depois busca qtd total por ativo
      const { data: qtdData, error: qtdError } = await supabase
        .from("aportes")
        .select("code, qtd")
        .in("code", codes);

      if (qtdError) {
        console.error(`[${category}] Erro ao buscar quantidades:`, qtdError.message);
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const qtdPorAtivo = new Map<string, number>();
      for (const a of qtdData ?? []) {
        const current = qtdPorAtivo.get(a.code) ?? 0;
        qtdPorAtivo.set(a.code, current + Number(a.qtd ?? 0));
      }

      let total_assets_value_current = 0;
      for (const code of codes) {
        const cotVal = cotacoesMap.get(code) ?? 0;
        const qtd = qtdPorAtivo.get(code) ?? 0;
        total_assets_value_current += cotVal * qtd;
      }

      // total_dividends: soma de dividendos.total_liquid dos ativos da categoria
      const { data: dividendos, error: dividendosError } = await supabase
        .from("dividendos")
        .select("code, total_liquid")
        .in("code", codes);

      if (dividendosError) {
        console.error(
          `[${category}] Erro ao buscar dividendos:`,
          dividendosError.message
        );
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      const dividendosList: DividendRow[] = (dividendos ?? []) as DividendRow[];

      const total_dividends = dividendosList.reduce(
        (sum: number, d: DividendRow) => sum + Number(d.total_liquid ?? 0),
        0
      );

      const { error: upsertError } = await supabase
        .from("total_categories_cache")
        .upsert(
          {
            category,
            total_assets_value_aported,
            total_assets_value_current,
            total_assets_weight,
            total_dividends,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "category" }
        );

      if (upsertError) {
        console.error(`[${category}] Erro ao salvar cache:`, upsertError.message);
        fail++;
      } else {
        ok++;
        console.log(
          `[${category}] OK — aportado=${total_assets_value_aported} ` +
            `atual=${total_assets_value_current} peso=${total_assets_weight} ` +
            `dividendos=${total_dividends}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${category}]`, msg);
      fail++;
    }

    if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
  }

  console.log(`Concluído: ${ok} ok, ${fail} falha(s).`);
  if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? "error" : "done");
  return { total: rows.length, ok, fail };
}

main()
  .then((result) => process.exit(result.fail > 0 ? 1 : 0))
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Falha fatal no calculate-totals-by-category:", msg);
    process.exit(1);
  });