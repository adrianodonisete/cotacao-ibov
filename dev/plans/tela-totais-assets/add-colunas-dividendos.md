# Plan: Adicionar colunas `R$ Dividendos` e `% Yield` em `/total-assets/[category]`

## Goal

Exibir `total_dividends` (em BRL) e `dividend_yield` na tabela de totais por categoria, posicionadas **antes** da coluna "Primeiro Aporte". Aplica-se a `/total-assets/acao` e `/total-assets/fii`. Os valores já são calculados e gravados em `total_assets_cache` pelo cron `calculate-totals-by-assets` (Etapa 3 do plano `dev/plans/cron-totais-por-asset/create-cron-totais-por-assets.md`).

---

## Files

| Action     | File                                                  |
|------------|-------------------------------------------------------|
| **MODIFY** | `src/types/total-asset.ts`                            |
| **MODIFY** | `src/app/api/total-assets/route.ts`                   |
| **MODIFY** | `src/lib/total-assets.test.ts`                        |
| **MODIFY** | `src/app/total-assets/[category]/page.tsx`            |

---

## 1. `src/types/total-asset.ts`

Estender `interface TotalAsset` com os dois campos `NULL`-able. `TotalAssetWithInfo extends TotalAsset` herda automaticamente, e `SortableField = keyof TotalAssetWithInfo` (em `src/lib/total-assets.ts:49`) passa a aceitar `'total_dividends' | 'dividend_yield'` — **ordenação no header vem de graça**.

```ts
export interface TotalAsset {
  // ...campos existentes...
  total_dividends: number | null;
  dividend_yield: number | null;
  primeiro_aporte: string | null;
  ultimo_aporte: string | null;
}
```

`number | null` (e não `number`) porque o schema SQL é `NUMERIC(15,2) NULL` — a UI mostra `—` no formato quando `null`.

## 2. `src/app/api/total-assets/route.ts`

A query já usa `.select("*")` (linha 35), então os campos chegam ao `row`. Falta incluí-los no mapeamento (linha 84-106):

```ts
const totals: TotalAssetWithInfo[] = rows.map((row) => {
  const ativo = ativosByCode.get(row.code);
  return {
    // ...campos existentes...
    total_dividends: row.total_dividends != null ? Number(row.total_dividends) : null,
    dividend_yield: row.dividend_yield != null ? Number(row.dividend_yield) : null,
    // ...resto...
  };
});
```

Guard `!= null` é necessário porque o Supabase pode devolver `null` para colunas `NULL`-able.

## 3. `src/lib/total-assets.test.ts`

Estender `baseAsset` (linhas 10-29) para satisfazer a nova tipagem:

```ts
const baseAsset: TotalAssetWithInfo = {
  // ...campos existentes...
  total_dividends: 0,
  dividend_yield: 0,
  // ...
};
```

Adicionalmente, dois testes novos para garantir que `sortTotalAssets` ordena pelos novos campos (paridade com o teste existente de `total_aportado`):

```ts
test("sortTotalAssets DESC por total_dividends (número, com null)", () => {
  const rows: TotalAssetWithInfo[] = [
    { ...baseAsset, code: "A", total_dividends: null },
    { ...baseAsset, code: "B", total_dividends: 50 },
    { ...baseAsset, code: "C", total_dividends: 20 },
  ];
  const sorted = sortTotalAssets(rows, "total_dividends", "desc").map((r) => r.code);
  assert.deepEqual(sorted, ["B", "C", "A"]);
});

test("sortTotalAssets ASC por dividend_yield (número)", () => {
  const rows: TotalAssetWithInfo[] = [
    { ...baseAsset, code: "A", dividend_yield: 12.5 },
    { ...baseAsset, code: "B", dividend_yield: 3.21 },
    { ...baseAsset, code: "C", dividend_yield: 7.8 },
  ];
  const sorted = sortTotalAssets(rows, "dividend_yield", "asc").map((r) => r.code);
  assert.deepEqual(sorted, ["B", "C", "A"]);
});
```

## 4. `src/app/total-assets/[category]/page.tsx`

Inserir duas `ColumnDef` no array `COLUMNS` (linhas 64-184) **entre** "Percentual Falta" (linhas 163-169) e "Primeiro Aporte" (linhas 170-176):

```ts
{
  field: 'total_dividends',
  label: 'R$ Dividendos',
  align: 'right',
  format: (row) =>
    row.total_dividends == null ? '—' : formatCurrencyBRL(row.total_dividends),
  valueClass: 'text-body',
},
{
  field: 'dividend_yield',
  label: '% Yield',
  align: 'right',
  format: (row) =>
    row.dividend_yield == null ? '—' : formatPercent(row.dividend_yield),
  valueClass: 'text-body',
},
```

**Ordem final do `COLUMNS`** (depois da mudança):

```
0  Código
1  Informações
2  Peso
3  % Objetivo
4  R$ Objetivo
5  Quantidade
6  Cotação
7  R$ Aportado
8  % Aportado
9  R$ Montante Atual
10 % Montante Atual
11 R$ Lucro
12 % Lucro
13 R$ Montante Falta
14 % Montante Falta
15 R$ Dividendos          ← NOVO
16 % Yield                ← NOVO
17 Primeiro Aporte
18 Último Aporte
```

### Decisões de design

| Decisão | Justificativa |
|---|---|
| `align: 'right'` | Consistente com todas as colunas numéricas/percentuais vizinhas |
| `formatCurrencyBRL` / `formatPercent` reusados | Já existiam (linhas 31-40); evita duplicação |
| `valueClass: 'text-body'` | Consistente com colunas numéricas que não têm colorização positiva/negativa |
| Placeholder `—` para `null` | Mesmo padrão de `formatDate` (linha 48-52) para `primeiro_aporte`/`ultimo_aporte` |
| **Sem** entrada em `cellColorClass` (linhas 399-414) | `dividend_yield` raramente é negativo nesse contexto; segue o padrão das demais colunas sem colorização |
| Ordenação no header | Habilitada de graça por `SortableField = keyof TotalAssetWithInfo` |

## 5. Por que nenhuma outra camada precisa mudar

| Camada | Por que não muda |
|---|---|
| `db/supabase/create_table_total_assets_cache.sql` | Colunas `total_dividends` e `dividend_yield` já existem (linhas 23-24) |
| `scripts/calculate-totals-by-assets.ts` | Já calcula e grava ambos (Etapa 3) |
| `src/app/api/cache/trigger/route.ts` | Cron já registrado (linhas 42-46) |
| `src/app/cache/page.tsx` | Card "Calcular Totais por Ativo" já existe |
| `package.json` | Script `calculate-totals-by-assets` já existe |
| `src/lib/total-assets.ts` | `sortTotalAssets` opera por `keyof TotalAssetWithInfo` — funciona sem mudança |
| `src/lib/total-asset-categories.ts` | `TOTAL_ASSET_CATEGORIES = ["acao", "fii"]` — `td` nem chega nesta página |

## Verificação

1. **Lint**: `npm run lint` — sem warnings/errors nos 4 arquivos modificados (3 problemas pré-existentes em outros arquivos não relacionados).
2. **Type-check**: `npx tsc --noEmit` — sem erros.
3. **Testes**: `npx tsx --test src/lib/total-assets.test.ts` — 12/12 passam (10 prévios + 2 novos). Suite completa do projeto: 46/46 passam.
4. **Manual**: `npm run dev` → abrir `/total-assets/acao` e `/total-assets/fii`:
   - Confirmar que as duas colunas novas aparecem **antes** de "Primeiro Aporte"
   - Confirmar header clicável ordena ASC/DESC
   - Confirmar `td` não é exibido (filtro de categoria já bloqueia)

## Edge cases

| Cenário | Comportamento |
|---|---|
| `total_dividends === null` (ativo sem dividendos gravados) | Exibe `—` |
| `dividend_yield === null` | Exibe `—` |
| `dividend_yield === 0` (ativo `td` no cache, mas `td` não chega nessa página) | Exibe `0,00%` |
| Header clicado em `total_dividends` / `dividend_yield` | Ordena ASC/DESC entre ativos da mesma categoria |
| `null` em coluna numérica, ordenação ASC | `null` vai para o fim (consistente com `primeiro_aporte`/`ultimo_aporte`) |

## Notas / dependências

- **Dependência de dados**: o cron `calculate-totals-by-assets` precisa ter rodado pelo menos uma vez (Etapa 3) para que `total_dividends`/`dividend_yield` estejam populados. Sem isso, todas as células das duas colunas exibem `—`.
- **Sem migração SQL**: tudo já existia.
- **Sem novas dependências npm**: nenhum package novo.
- **Sem novos endpoints/triggers**: nenhum card novo em `/cache`.
- **Largura da página**: `/total-assets/[category]` segue a regra de exceção de 100% viewport (definida em `AGENTS.md` → "Project layout conventions"). As duas colunas adicionais (≈ 140-160px cada) participarão do scroll horizontal nativo — não requer mudança no container.
- **Colorização condicional**: `dividend_yield` não recebe `text-success`/`text-error` em `cellColorClass`. Se quiser positivo/negativo, adicionar lá nas linhas 399-414. Decisão de produto: manter neutro por enquanto (yield raramente é negativo).
- **Compat**: `SortableField` ganhou `'total_dividends' | 'dividend_yield'` automaticamente — qualquer consumidor do tipo que use-o precisa recompilar; nenhum outro arquivo do projeto referencia `SortableField` além da própria `page.tsx`.
