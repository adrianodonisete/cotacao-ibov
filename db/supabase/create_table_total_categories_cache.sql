-- Criar a tabela total_categories_cache no Supabase
-- Execute este script uma única vez no painel SQL do Supabase
-- Armazena os totais calculados de aportes por categoria (acao, fii, stock, reit, td)

CREATE TABLE IF NOT EXISTS total_categories_cache (
    id                            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category                      VARCHAR(20)    NOT NULL,
    total_assets_value_aported    NUMERIC(15, 6) NOT NULL,
    total_assets_value_current    NUMERIC(15, 6) NOT NULL,
    total_assets_weight           NUMERIC(10, 2) NOT NULL,
    total_dividends               NUMERIC(15, 2) NULL,
    updated_at                    TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT total_categories_cache_category_unique UNIQUE (category)
);

-- Índice no campo category para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_total_categories_cache_category ON total_categories_cache (category);

-- Desabilitar Row Level Security para acesso via publishable key (projeto pessoal)
ALTER TABLE total_categories_cache DISABLE ROW LEVEL SECURITY;
