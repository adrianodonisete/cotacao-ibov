/**
 * Job manual (spec §2): atualiza a tabela `cotacoes` para ativos `acao` e `fii`.
 *
 * Requer `.env.local` com BRAPI_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Tabela `cotacoes`: executar `db/supabase/create_table_cotacoes.sql` no Supabase.
 *
 * Uso: npm run sync-cotacoes
 */
import "./env";
import { getSupabaseServer } from "../src/lib/supabase";
import { fetchQuoteForTicker } from "../src/lib/brapi-service";
import type { BrapiResult } from "../src/types/brapi";

function dateUpdateFromQuote(r: BrapiResult): string {
  if (r.regularMarketTime) {
    return new Date(r.regularMarketTime).toISOString().split("T")[0]!;
  }
  return new Date().toISOString().split("T")[0]!;
}

async function main() {
  const supabase = getSupabaseServer();

  const { data: ativos, error: listError } = await supabase
    .from("ativos")
    .select("code")
    .in("type", ["acao", "fii"]);

  if (listError) {
    console.error("Erro ao listar ativos:", listError.message);
    process.exit(1);
  }

  const rows = ativos ?? [];
  if (rows.length === 0) {
    console.log("Nenhum ativo com type acao ou fii.");
    process.exit(0);
  }

  console.log(`Sincronizando ${rows.length} ativo(s)...`);

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const code = row.code as string;
    try {
      const data = await fetchQuoteForTicker(code);
      const first = data.results?.[0];
      if (!first || typeof first.regularMarketPrice !== "number") {
        console.warn(`[${code}] Sem preço na resposta; ignorado.`);
        fail++;
        continue;
      }

      const value = first.regularMarketPrice;
      const date_update = dateUpdateFromQuote(first);

      const { error: upsertError } = await supabase.from("cotacoes").upsert(
        { code, value, date_update },
        { onConflict: "code" }
      );

      if (upsertError) {
        console.error(`[${code}] Erro ao gravar cotacoes:`, upsertError.message);
        fail++;
        continue;
      }

      ok++;
      console.log(`[${code}] OK — ${value} (${date_update})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${code}]`, msg);
      fail++;
    }
  }

  console.log(`Concluído: ${ok} ok, ${fail} falha(s).`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
