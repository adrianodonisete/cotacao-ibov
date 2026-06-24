-- Criar a tabela categories no Supabase
-- Execute este script uma única vez no painel SQL do Supabase

CREATE TABLE IF NOT EXISTS categories (
    id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    CONSTRAINT categories_name_unique UNIQUE (name)
);

-- Índice no campo name para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);

-- Desabilitar Row Level Security para acesso via publishable key (projeto pessoal)
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
