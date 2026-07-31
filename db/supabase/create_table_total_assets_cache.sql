-- Create the total_assets_cache table in Supabase
-- Execute this script once in the Supabase SQL editor
-- Stores per-asset aggregated metrics (target, current, profit, missing, contribution dates)

CREATE TABLE IF NOT EXISTS total_assets_cache (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                        VARCHAR(50)    NOT NULL,
    category_name               VARCHAR(20)    NOT NULL,
    percentual_objetivo         NUMERIC(10, 2) NOT NULL,
    montante_objetivo           NUMERIC(15, 6) NOT NULL,
    total_qtd                   NUMERIC(15, 6) NOT NULL,
    cotacao                     NUMERIC(15, 6) NOT NULL,
    total_aportado              NUMERIC(15, 6) NOT NULL,
    percentual_aportado         NUMERIC(10, 2) NOT NULL,
    montante_atual              NUMERIC(15, 6) NOT NULL,
    percentual_montante_atual   NUMERIC(10, 2) NOT NULL,
    lucro                       NUMERIC(15, 6) NOT NULL,
    percentual_lucro            NUMERIC(10, 2) NOT NULL,
    montante_falta              NUMERIC(15, 6) NOT NULL,
    percentual_falta            NUMERIC(10, 2) NOT NULL,
    primeiro_aporte             DATE,
    ultimo_aporte               DATE,
    total_dividends             NUMERIC(15, 2) NULL,
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT total_assets_cache_code_unique UNIQUE (code)
);

-- Index on code (covered by UNIQUE) plus a composite index for category lookups
CREATE INDEX IF NOT EXISTS idx_total_assets_cache_code ON total_assets_cache (code);
CREATE INDEX IF NOT EXISTS idx_total_assets_cache_category ON total_assets_cache (category_name);

-- Disable Row Level Security (personal project, accessed via service_role)
ALTER TABLE total_assets_cache DISABLE ROW LEVEL SECURITY;

