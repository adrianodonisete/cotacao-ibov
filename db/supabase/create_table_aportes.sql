-- Criar a tabela aportes no Supabase
-- Execute este script uma única vez no painel SQL do Supabase

CREATE TABLE IF NOT EXISTS aportes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(20)    NOT NULL,
    qtd             NUMERIC(15, 6) NOT NULL,
    value_total     NUMERIC(15, 6) NOT NULL,
    date_operation  DATE           NOT NULL
);

-- Índice no campo code para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_aportes_code ON aportes (code);

-- Índice no campo date_operation para ordenação e filtros por data
CREATE INDEX IF NOT EXISTS idx_aportes_date_operation ON aportes (date_operation);

-- Desabilitar Row Level Security para acesso via publishable key (projeto pessoal)
ALTER TABLE aportes DISABLE ROW LEVEL SECURITY;

-- Restringir duplicidade de aportes pelo trio (code, qtd, date_operation)
ALTER TABLE aportes
ADD CONSTRAINT aportes_unique_code_qtd_date_operation
UNIQUE (code, qtd, date_operation);

