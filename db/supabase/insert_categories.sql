-- Inserir registros na tabela categories
-- Execute este script após criar a tabela categories

INSERT INTO categories (name, label) VALUES
    ('acao', 'Ação'),
    ('fii', 'FII'),
    ('stock', 'Stock'),
    ('reit', 'REIT'),
    ('td', 'Tesouro Direto')
ON CONFLICT (name) DO NOTHING;
