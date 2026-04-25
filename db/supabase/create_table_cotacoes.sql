-- Criar a tabela cotacoes no Supabase
-- Execute este script uma única vez no painel SQL do Supabase
-- Um registo por ticker (code); value e date_update são atualizados pela job de cotações

CREATE TABLE IF NOT EXISTS cotacoes (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(20)    NOT NULL,
    date_update  DATE           NOT NULL,
    [value]        NUMERIC(15, 6) NOT NULL,
    maturity_date  DATE           NULL,
    CONSTRAINT cotacoes_code_unique UNIQUE (code)
);

-- Índice em code: já coberto pelo UNIQUE; índice explícito em date_update para filtros/ordenação
CREATE INDEX IF NOT EXISTS idx_cotacoes_date_update ON cotacoes (code,date_update);

-- Desabilitar Row Level Security (acesso via backend com service_role — projeto pessoal)
ALTER TABLE cotacoes DISABLE ROW LEVEL SECURITY;
