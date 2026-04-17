-- Criar a tabela status_cron_job no Supabase
-- Execute este script uma única vez no painel SQL do Supabase
-- Registra o progresso de cada execução manual dos CRONs de cotação

CREATE TABLE IF NOT EXISTS status_cron_job (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cron           VARCHAR(100) NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'running', -- running | done | error
    total_steps    INT          NOT NULL DEFAULT 0,
    finished_steps INT          NOT NULL DEFAULT 0,
    started_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índice para consultas por cron ordenadas por data de início (polling de status)
CREATE INDEX IF NOT EXISTS idx_status_cron_job_cron ON status_cron_job (cron, started_at DESC);

-- Desabilitar Row Level Security (acesso via backend com service_role — projeto pessoal)
ALTER TABLE status_cron_job DISABLE ROW LEVEL SECURITY;
