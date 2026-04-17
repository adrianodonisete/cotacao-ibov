export type CronJobStatus = 'running' | 'done' | 'error';

export interface CronJobRow {
  id: number;
  cron: string;
  status: CronJobStatus;
  total_steps: number;
  finished_steps: number;
  started_at: string; // ISO timestamp
  finished_at: string | null;
  created_at: string;
}

export interface CronJobStatusResponse {
  id: number;
  cron: string;
  status: CronJobStatus;
  total_steps: number;
  finished_steps: number;
  percent: number; // 0–100
  started_at: string;
  finished_at: string | null;
}

export interface CronTriggerResponse {
  jobId: number;
  total_steps: number;
}
