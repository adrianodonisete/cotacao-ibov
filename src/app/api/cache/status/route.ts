import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import type { CronJobRow, CronJobStatusResponse } from '@/types/cron-job';

export async function GET(req: NextRequest): Promise<NextResponse> {
	const cron = req.nextUrl.searchParams.get('cron');

	if (!cron) {
		return NextResponse.json(
			{ error: 'Parâmetro "cron" é obrigatório.' },
			{ status: 400 }
		);
	}

	const supabase = getSupabaseServer();

	const { data, error } = await supabase
		.from('status_cron_job')
		.select('*')
		.eq('cron', cron)
		.order('started_at', { ascending: false })
		.limit(1)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			return NextResponse.json({ error: 'Nenhum job encontrado para este cron.' }, { status: 404 });
		}
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	const row = data as CronJobRow;

	const percent =
		row.total_steps > 0
			? Math.round((row.finished_steps / row.total_steps) * 100)
			: 0;

	const response: CronJobStatusResponse = {
		id: row.id,
		cron: row.cron,
		status: row.status,
		total_steps: row.total_steps,
		finished_steps: row.finished_steps,
		percent,
		started_at: row.started_at,
		finished_at: row.finished_at,
		errors: row.errors ?? [],
	};

	return NextResponse.json(response);
}
