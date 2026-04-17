import type { SupabaseClient } from '@supabase/supabase-js';
import type { CronJobStatus } from '../src/types/cron-job';

/**
 * Reads --job-id <n> from process.argv.
 * Returns the numeric ID, or null if not provided (CLI run without job tracking).
 */
export function parseJobId(): number | null {
  const idx = process.argv.indexOf('--job-id');
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

/**
 * Updates finished_steps = ok + fail for the given job row.
 * Silently ignores errors (progress tracking must never crash the script).
 */
export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: number,
  ok: number,
  fail: number
): Promise<void> {
  const { error } = await supabase
    .from('status_cron_job')
    .update({ finished_steps: ok + fail })
    .eq('id', jobId);

  if (error) {
    console.warn(`[job-progress] Erro ao atualizar progresso (jobId=${jobId}):`, error.message);
  }
}

/**
 * Marks the job as done or error and sets finished_at to now.
 * Silently ignores errors.
 */
export async function finishJob(
  supabase: SupabaseClient,
  jobId: number,
  status: CronJobStatus
): Promise<void> {
  const { error } = await supabase
    .from('status_cron_job')
    .update({ status, finished_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    console.warn(`[job-progress] Erro ao finalizar job (jobId=${jobId}):`, error.message);
  }
}
