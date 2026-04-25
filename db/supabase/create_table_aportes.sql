-- Criar a tabela aportes no Supabase
-- Execute este script uma única vez no painel SQL do Supabase

CREATE TABLE IF NOT EXISTS aportes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(50)    NOT NULL,
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

-- Novos campos: currency, dolar_value, info
ALTER TABLE aportes ADD COLUMN IF NOT EXISTS currency    VARCHAR(3)     NOT NULL DEFAULT 'BRL';
ALTER TABLE aportes ADD COLUMN IF NOT EXISTS dolar_value NUMERIC(15, 6) NOT NULL DEFAULT 0.0;
ALTER TABLE aportes ADD COLUMN IF NOT EXISTS info        VARCHAR(100)   NOT NULL DEFAULT '';

-- Restringir duplicidade de aportes pelo trio (code, qtd, date_operation)
ALTER TABLE aportes
ADD CONSTRAINT aportes_unique_code_qtd_date_operation
UNIQUE (code, qtd, date_operation);

/*

Alteração na tabela "aportes":
    - Adicionar o campo currency (varchar 3 - default: BRL) na tabela "aportes".
    - Adicionar o campo dolar_value (numeric 15, 6 - default: 0.0) na tabela "aportes".
    - Adicionar o campo info (varchar 100) na tabela "aportes".
*/
ALTER TABLE aportes
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS dolar_value NUMERIC(15, 6) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS info VARCHAR(100);
