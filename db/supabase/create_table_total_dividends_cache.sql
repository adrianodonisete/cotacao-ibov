CREATE TABLE IF NOT EXISTS total_dividends_cache (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave                       VARCHAR(50)    NOT NULL,
    opcao                       VARCHAR(30)    NOT NULL,
    periodo                     VARCHAR(30)    NOT NULL,
    total_dividends             NUMERIC(15, 2) NOT NULL,
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT total_dividends_cache_chave_option_unique UNIQUE (chave,opcao)
);

-- Index on chave (covered by UNIQUE) plus a composite index for category lookups
CREATE INDEX IF NOT EXISTS idx_chave_option ON total_dividends_cache (chave,opcao);
