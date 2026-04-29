import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getSupabaseServer } from '@/lib/supabase';
import type { CronTriggerResponse } from '@/types/cron-job';

type CronName = 'sync-cotacoes' | 'sync-cotacoes-us' | 'sync-cotacoes-td' | 'sync-cotacoes-indices';

interface CronConfig {
	script: string;
	types?: string[];
	fixedTotalSteps?: number;
}

const CRON_CONFIG: Record<CronName, CronConfig> = {
	'sync-cotacoes': {
		script: 'scripts/sync-cotacoes.ts',
		types: ['acao', 'fii'],
	},
	'sync-cotacoes-us': {
		script: 'scripts/sync-cotacoes-us.ts',
		types: ['stock', 'reit'],
	},
	'sync-cotacoes-td': {
		script: 'scripts/sync-cotacoes-td.ts',
		types: ['td'],
	},
	'sync-cotacoes-indices': {
		script: 'scripts/sync-cotacoes-indices.ts',
		fixedTotalSteps: 2,
	},
};

export async function POST(req: NextRequest): Promise<NextResponse> {
	const cron = req.nextUrl.searchParams.get('cron') as CronName | null;

	if (!cron || !(cron in CRON_CONFIG)) {
		return NextResponse.json(
			{ error: `Parâmetro "cron" inválido. Use: ${Object.keys(CRON_CONFIG).join(' | ')}` },
			{ status: 400 }
		);
	}

	const config = CRON_CONFIG[cron];
	const supabase = getSupabaseServer();

	// Check for already-running job
	const { data: running } = await supabase
		.from('status_cron_job')
		.select('id')
		.eq('cron', cron)
		.eq('status', 'running')
		.limit(1);

	if (running && running.length > 0) {
		return NextResponse.json(
			{ error: `O cron "${cron}" já está em execução. Aguarde a conclusão.` },
			{ status: 409 }
		);
	}

	// Count total_steps:
	// - Crons com `fixedTotalSteps` (ex.: índices BCB) usam o valor fixo direto.
	// - Demais somam os ativos cadastrados nos `types` configurados.
	let total_steps: number;
	if (typeof config.fixedTotalSteps === 'number') {
		total_steps = config.fixedTotalSteps;
	} else {
		const { count, error: countError } = await supabase
			.from('ativos')
			.select('id', { count: 'exact', head: true })
			.in('type', config.types ?? []);

		if (countError) {
			return NextResponse.json(
				{ error: `Erro ao contar ativos: ${countError.message}` },
				{ status: 500 }
			);
		}

		total_steps = count ?? 0;
	}

	// Insert job row
	const { data: inserted, error: insertError } = await supabase
		.from('status_cron_job')
		.insert({ cron, status: 'running', total_steps, finished_steps: 0 })
		.select('id')
		.single();

	if (insertError || !inserted) {
		return NextResponse.json(
			{ error: `Erro ao registrar job: ${insertError?.message ?? 'sem retorno'}` },
			{ status: 500 }
		);
	}

	const jobId: number = inserted.id;

	// Spawn script as non-blocking background process.
	// shell: true is required on Windows (npx is a .cmd file, not a native executable).
	const cwd = path.resolve(process.cwd());
	const child = spawn('npx', ['tsx', config.script, '--job-id', String(jobId)], {
		cwd,
		detached: true,
		stdio: 'ignore',
		shell: true,
		windowsHide: true,
	});
	child.unref();

	const body: CronTriggerResponse = { jobId, total_steps };
	return NextResponse.json(body, { status: 202 });
}
