-- Alterar campo code de VARCHAR(20) para VARCHAR(50) nas tabelas ativos, aportes e cotacoes
-- Execute este script no painel SQL do Supabase
-- Operação segura: alargamento de coluna não reescreve dados nem invalida índices no PostgreSQL

ALTER TABLE ativos   ALTER COLUMN code TYPE VARCHAR(50);
ALTER TABLE aportes  ALTER COLUMN code TYPE VARCHAR(50);
ALTER TABLE cotacoes ALTER COLUMN code TYPE VARCHAR(50);
