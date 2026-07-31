# Plano — Etapa 1: Total de Dividendos em `total_categories_cache`

> Plano executado. Mudanças aplicadas em `scripts/calculate-totals-by-category.ts` em 31/07/2026.
>
> **Atualização 31/07/2026**: adicionado skip da query de dividendos para `category === "td"` (Tesouro Direto não paga dividendos). O valor gravado continua sendo `total_dividends = 0`, mas a ida ao banco é evitada.

## Objetivo
Alterar a CRON `scripts/calculate-totals-by-category.ts` (referida pelo usuário como `calculate-totals-by-categories.ts`, plural — divergência apenas no nome do arquivo, o conteúdo real é singular) para também calcular e gravar `total_dividends` na tabela `total_categories_cache`.

## Arquivos
- **Modificar**: `scripts/calculate-totals-by-category.ts`

## Contexto (sem novas dependências / migrations)

- Coluna `total_dividends NUMERIC(15, 2) NULL` já existe em `total_categories_cache` — `db/supabase/create_table_total_categories_cache.sql:11`.
- Coluna `total_liquid NUMERIC(15, 2) NOT NULL` em `dividendos` — `db/supabase/create_table_dividendos_and_fields_cache.sql:9`.
- Índice `idx_dividendos_code` já cobre o join — `db/supabase/create_table_dividendos_and_fields_cache.sql:15`.
- Padrão do script antes da mudança: obtém `ativos` da categoria → deriva `codes` → consulta tabelas relacionadas com `.in("code", codes)` → agrega em JS → `upsert`. A nova etapa segue o mesmo padrão.
- Fora de escopo (intencional): `package.json`, `src/app/api/cache/trigger/route.ts`, `src/app/cache/page.tsx`, migrations SQL, novos testes.

## Equivalência com o SQL especificado

Spec: `total_categories_cache.total_dividends = SUM(dividendos.total_liquid) INNER JOIN ativos ON dividendos.code = ativos.code AND ativos.type = "categoria"`.

Implementação: o script já busca `ativos` da categoria (gera `codes`) e em seguida consulta `dividendos WHERE code IN (codes)` — isso é exatamente o INNER JOIN filtrado por `ativos.type = category`. Mesma semântica, padrão já usado para aportes/cotações.

---

## Tarefas executadas

### 1.1 Type alias `DividendRow` (`scripts/calculate-totals-by-category.ts:8`)

```ts
type DividendRow = { code: string; total_liquid: number };
```

### 1.2 Busca e agregação de dividendos no ramo "categoria com ativos" (`scripts/calculate-totals-by-category.ts:150-175`)

Tesouro Direto (`category === "td"`) não paga dividendos — a query é pulada e `total_dividends` fica em `0` sem ida ao banco. Demais categorias calculam normalmente.

```ts
// total_dividends: soma de dividendos.total_liquid dos ativos da categoria.
// Categoria "td" (Tesouro Direto) não paga dividendos — pula a query.
let total_dividends = 0;
if (category !== "td") {
  const { data: dividendos, error: dividendosError } = await supabase
    .from("dividendos")
    .select("code, total_liquid")
    .in("code", codes);

  if (dividendosError) {
    console.error(
      `[${category}] Erro ao buscar dividendos:`,
      dividendosError.message
    );
    fail++;
    if (jobId !== null) await updateJobProgress(supabase, jobId, ok, fail);
    continue;
  }

  const dividendosList: DividendRow[] = (dividendos ?? []) as DividendRow[];

  total_dividends = dividendosList.reduce(
    (sum: number, d: DividendRow) => sum + Number(d.total_liquid ?? 0),
    0
  );
}
```

### 1.3 `total_dividends` no upsert (`scripts/calculate-totals-by-category.ts:173-185`)

```ts
const { error: upsertError } = await supabase
  .from("total_categories_cache")
  .upsert(
    {
      category,
      total_assets_value_aported,
      total_assets_value_current,
      total_assets_weight,
      total_dividends,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "category" }
  );
```

### 1.4 `total_dividends: 0` no upsert do ramo "sem ativos" (`scripts/calculate-totals-by-category.ts:53-65`)

```ts
const { error: upsertError } = await supabase
  .from("total_categories_cache")
  .upsert(
    {
      category,
      total_assets_value_aported: 0,
      total_assets_value_current: 0,
      total_assets_weight: 0,
      total_dividends: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "category" }
  );
```

### 1.5 Log de sucesso inclui `dividendos` (`scripts/calculate-totals-by-category.ts:193-196`)

```ts
console.log(
  `[${category}] OK — aportado=${total_assets_value_aported} ` +
    `atual=${total_assets_value_current} peso=${total_assets_weight} ` +
    `dividendos=${total_dividends}`
);
```

---

## Casos-limite cobertos

| Cenário | Comportamento |
|---|---|
| Categoria sem ativos | `total_dividends = 0` (1.4) |
| Categoria com ativos e sem dividendos | `total_dividends = 0` (reduce sobre array vazio) |
| Categoria = `td` (Tesouro Direto) | Query é pulada, `total_dividends = 0` sem ida ao banco (Tesouro Direto não paga dividendos) |
| `dividendos.total_liquid` `NULL` | `Number(null ?? 0) = 0` no reduce |
| Erro na query de dividendos | `fail++`, log, `continue` — mesmo padrão dos demais erros |

---

## Verificação

1. **Lint**: `npm run lint`
2. **Execução local da CRON**: `npm run calculate-totals-by-category` — acompanhar logs (passaram a incluir `dividendos=<valor>`).
3. **Conferência cruzada no SQL do Supabase** (substituir a categoria):

```sql
SELECT category, total_dividends
FROM total_categories_cache
WHERE category = 'acao';

SELECT SUM(d.total_liquid) AS esperado
FROM dividendos d
JOIN ativos a ON d.code = a.code
WHERE a.type = 'acao';
```

Os dois valores têm que coincidir (com tolerância de arredondamento `<= 0.01`, consistente com `NUMERIC(15,2)`).
4. **Repetir** para todas as categorias retornadas por `SELECT name FROM categories`.

---

## Próxima etapa

Etapa 2: alterar `scripts/calculate-totals-by-assets.ts` para calcular `total_assets_cache.total_dividends = SUM(dividendos.total_liquid) INNER JOIN ativos ON dividendos.code = ativos.code`. Plano destino: `dev/plans/cron-totais-por-asset/calculate-totals-by-assets.md`.