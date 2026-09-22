-- Execute once in an existing production database.
ALTER TABLE status_cron_job
    ADD COLUMN IF NOT EXISTS errors JSONB NOT NULL DEFAULT '[]'::jsonb;
