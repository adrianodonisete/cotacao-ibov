import { strict as assert } from 'node:assert';
import test from 'node:test';
import { getJobCompletionStatus, finishJob, updateJobProgress } from './job-progress';
import type { CronJobError } from '../src/types/cron-job';

function createSupabaseStub() {
	const updates: Array<Record<string, unknown>> = [];
	return {
		updates,
		from() {
			return {
				update(values: Record<string, unknown>) {
					updates.push(values);
					return {
						eq: async () => ({ error: null }),
					};
				},
			};
		},
	};
}

test('falhas parciais não invalidam a conclusão do job', () => {
	assert.equal(getJobCompletionStatus(0), 'done');
	assert.equal(getJobCompletionStatus(3), 'done');
});

test('persiste detalhes de erros no progresso e na finalização', async () => {
	const supabase = createSupabaseStub();
	const errors: CronJobError[] = [
		{ code: 'AAPL', message: 'Sem preço na resposta', kind: 'price', batch: 'Lote 1/1' },
	];

	await updateJobProgress(supabase as never, 10, 4, 1, errors);
	await finishJob(supabase as never, 10, 'done', errors);

	assert.deepEqual(supabase.updates[0], { finished_steps: 5, errors });
	assert.equal(supabase.updates[1]?.status, 'done');
	assert.deepEqual(supabase.updates[1]?.errors, errors);
});
