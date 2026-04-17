/**
 * Job manual: atualiza a tabela `cotacoes` para ativos `stock` e `reit` via Twelve Data API.
 *
 * Requer `.env.local` com TWELVEDATA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Rate-limit (free tier): 8 créditos/min. Estratégia: 5 tickers por chamada, aguarda 60s entre lotes.
 *
 * Uso: npm run sync-cotacoes-us
 */
import "./env";
import { getSupabaseServer } from "../src/lib/supabase";
import { fetchPricesForTickers } from "../src/lib/twelvedata-service";
import type { CotacaoSyncResult, CotacaoUpsertInput } from "../src/types/cotacao";

const BATCH_SIZE = 5;
const WAIT_MS = 60_000; // 60 segundos entre lotes (free tier: 8 créditos/min)

type AtivoRow = { code: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main(): Promise<CotacaoSyncResult> {
  const supabase = getSupabaseServer();

  // 1. Buscar ativos do tipo stock e reit
  const { data: ativos, error: listError } = await supabase
    .from("ativos")
    .select("code")
    .in("type", ["stock", "reit"]);

  if (listError) {
    console.error("Erro ao listar ativos:", listError.message);
    process.exit(1);
  }

  const rows: AtivoRow[] = (ativos ?? []) as AtivoRow[];

  if (rows.length === 0) {
    console.log("Nenhum ativo com type stock ou reit.");
    return { total: 0, ok: 0, fail: 0 };
  }

  const batches = chunkArray(rows.map((r) => r.code), BATCH_SIZE);
  console.log(
    `Sincronizando ${rows.length} ativo(s) US em ${batches.length} lote(s)...`
  );

  let ok = 0;
  let fail = 0;

  // 2. Processar cada lote
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const batchLabel = `[Lote ${i + 1}/${batches.length}]`;
    const isLastBatch = i === batches.length - 1;

    console.log(`${batchLabel} ${batch.join(", ")}`);

    try {
      const prices = await fetchPricesForTickers(batch);

      // 3. Upsert cada resultado bem-sucedido
      for (const code of batch) {
        const result = prices[code];

        if (!result) {
          console.warn(`${batchLabel} [${code}] Sem preço na resposta; ignorado.`);
          fail++;
          continue;
        }

        const upsertInput: CotacaoUpsertInput = {
          code,
          value: result.price,
          date_update: result.date_update,
        };

        const { error: upsertError } = await supabase
          .from("cotacoes")
          .upsert(upsertInput, { onConflict: "code" });

        if (upsertError) {
          console.error(
            `${batchLabel} [${code}] Erro ao gravar cotacoes:`,
            upsertError.message
          );
          fail++;
          continue;
        }

        ok++;
        console.log(`${batchLabel} [${code}] OK — ${result.price} (${result.date_update})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${batchLabel} Erro na chamada à API:`, msg);
      fail += batch.length;
    }

    // 4. Aguardar 60s entre lotes (exceto após o último)
    if (!isLastBatch) {
      console.log(`${batchLabel} Aguardando ${WAIT_MS / 1000}s antes do próximo lote...`);
      await sleep(WAIT_MS);
    }
  }

  console.log(`Concluído: ${ok} ok, ${fail} falha(s).`);
  return { total: rows.length, ok, fail };
}

main()
  .then((result) => process.exit(result.fail > 0 ? 1 : 0))
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Falha fatal no sync-cotacoes-us:", msg);
    process.exit(1);
  });
