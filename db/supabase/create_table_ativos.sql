-- Criar a tabela ativos no Supabase
-- Execute este script uma única vez no painel SQL do Supabase

CREATE TABLE IF NOT EXISTS ativos (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code   VARCHAR(50)    NOT NULL,
    info   VARCHAR(255)   NOT NULL,
    type   VARCHAR(20)    NOT NULL,
    weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
    CONSTRAINT ativos_code_unique UNIQUE (code)
);

-- Índice no campo code para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_ativos_code ON ativos (code);

-- Desabilitar Row Level Security para acesso via publishable key (projeto pessoal)
ALTER TABLE ativos DISABLE ROW LEVEL SECURITY;
