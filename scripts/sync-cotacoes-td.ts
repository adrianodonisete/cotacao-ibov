/**
 * Job manual: atualiza a tabela `cotacoes` para ativos `td` (Tesouro Direto).
 *
 * Requer `.env.local` com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * Dados de cotação obtidos via api.radaropcoes.com (sem token necessário).
 *
 * Uso:
 *   npm run sync-cotacoes-td
 *   npm run sync-cotacoes-td -- --job-id 42   (com rastreamento de progresso via status_cron_job)
 */
import './env';
import { getSupabaseServer } from '../src/lib/supabase';
import { fetchTesouroDiretoQuote } from '../src/lib/tesouro-direto-service';
import type { CotacaoSyncResult, CotacaoUpsertInput } from '../src/types/cotacao';
import { parseJobId, updateJobProgress, finishJob } from './job-progress';

type AtivoCodeRow = {
  code: string;
};

async function main(): Promise<CotacaoSyncResult> {
  const supabase = getSupabaseServer();
  const jobId = parseJobId();

  const { data: ativos, error: listError } = await supabase
    .from('ativos')
    .select('code')
    .eq('type', 'td');

  if (listError) {
    console.error('Erro ao listar ativos:', listError.message);
    if (jobId !== null) await finishJob(supabase, jobId, 'error');
    process.exit(1);
  }

  const rows: AtivoCodeRow[] = (ativos ?? []) as AtivoCodeRow[];

  if (rows.length === 0) {
    console.log('Nenhum ativo com type td.');
    if (jobId !== null) await finishJob(supabase, jobId, 'done');
    return { total: 0, ok: 0, fail: 0 };
  }

  console.log(`Sincronizando ${rows.length} título(s) do Tesouro Direto...`);

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const code = row.code;
    try {
      const quote = await fetchTesouroDiretoQuote(code);

      const upsertInput: CotacaoUpsertInput = {
        code,
        value: quote.value,
        date_update: quote.date_update,
      };

      const { error: upsertError } = await supabase
        .from('cotacoes')
        .upsert(upsertInput, { onConflict: 'code' });

      if (upsertError) {
        console.error(`[${code}] Erro ao gravar cotacoes:`, upsertError.message);
        fail++;
        if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
        continue;
      }

      ok++;
      console.log(`[${code}] OK — ${quote.value} (${quote.date_update})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${code}]`, msg);
      fail++;
    }

    if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
  }

  console.log(`Concluído: ${ok} ok, ${fail} falha(s).`);
  if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? 'error' : 'done');
  return { total: rows.length, ok, fail };
}

main()
  .then(result => process.exit(result.fail > 0 ? 1 : 0))
  .catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Falha fatal no sync-cotacoes-td:', msg);
    process.exit(1);
  });
