-- Cria a tabela dividendos e adiciona a coluna total_dividends nas tabelas de cache
-- Execute uma única vez no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS dividendos (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(50)    NOT NULL,
    payment_date    DATE           NOT NULL,
    quantity        NUMERIC(15, 2) NOT NULL,
    total_liquid    NUMERIC(15, 2) NOT NULL,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dividendos_unique UNIQUE (code, quantity, payment_date, total_liquid)
);

CREATE INDEX IF NOT EXISTS idx_dividendos_code ON dividendos (code);
CREATE INDEX IF NOT EXISTS idx_dividendos_payment_date ON dividendos (payment_date);

ALTER TABLE dividendos DISABLE ROW LEVEL SECURITY;
