/**
 * Job manual: atualiza a tabela `cotacoes` com os índices BCB
 * (IPCA acumulado 12 meses e SELIC meta).
 *
 * Requer `.env.local` com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * Dados obtidos via api.bcb.gov.br (sem token necessário).
 *
 * Uso:
 *   npm run sync-cotacoes-indices
 *   npm run sync-cotacoes-indices -- --job-id 42
 */
import './env';
import { getSupabaseServer } from '../src/lib/supabase';
import { BCB_SERIES, fetchBcbLatest } from '../src/lib/bcb-service';
import type { CotacaoSyncResult, CotacaoUpsertInput } from '../src/types/cotacao';
import { parseJobId, updateJobProgress, finishJob } from './job-progress';

interface IndiceTarget {
	code: string;
	serie: number;
	label: string;
}

const TARGETS: IndiceTarget[] = [
	{ code: `BCB_${BCB_SERIES.IPCA_12M}`, serie: BCB_SERIES.IPCA_12M, label: 'IPCA 12M' },
	{ code: `BCB_${BCB_SERIES.SELIC_META}`, serie: BCB_SERIES.SELIC_META, label: 'SELIC Meta' },
];

async function main(): Promise<CotacaoSyncResult> {
	const supabase = getSupabaseServer();
	const jobId = parseJobId();

	console.log(`Sincronizando ${TARGETS.length} índice(s) do BCB...`);

	let ok = 0;
	let fail = 0;

	for (const target of TARGETS) {
		try {
			const quote = await fetchBcbLatest(target.serie);

			const upsertInput: CotacaoUpsertInput = {
				code: target.code,
				value: quote.value,
				date_update: quote.date_update,
				maturity_date: null,
			};

			const { error: upsertError } = await supabase
				.from('cotacoes')
				.upsert(upsertInput, { onConflict: 'code' });

			if (upsertError) {
				console.error(`[${target.code}] Erro ao gravar cotacoes:`, upsertError.message);
				fail++;
				if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
				continue;
			}

			ok++;
			console.log(`[${target.code}] OK — ${quote.value} (${quote.date_update}) [${target.label}]`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(`[${target.code}]`, msg);
			fail++;
		}

		if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
	}

	console.log(`Concluído: ${ok} ok, ${fail} falha(s).`);
	if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? 'error' : 'done');
	return { total: TARGETS.length, ok, fail };
}

main()
	.then(result => process.exit(result.fail > 0 ? 1 : 0))
	.catch(err => {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Falha fatal no sync-cotacoes-indices:', msg);
		process.exit(1);
	});
