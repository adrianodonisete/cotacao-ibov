# Resumo por categoria e ordenação de colunas — Total por Ações/FIIs

> **Para agentes:** seguir TDD por task. Cada task começa com teste falhando e termina com testes verdes + commit.

**Objetivo:** exibir logo abaixo do título da página `Total por Ações/FIIs` um resumo da categoria calculado a partir de `total_categories_cache` e permitir ordenar todas as colunas da tabela de totais por ativo (ASC/DESC) sem alterar o banco nem os crons.

**Arquitetura:** estender `GET /api/total-assets` para retornar, junto com `totals`, os três campos brutos do cache de categoria. A página calcula `lucro` e `% lucro` no cliente, mantém títulos já existentes e adiciona ordenação client-side via `useMemo`.

> **Ajuste pós-implementação (2026-07-29):** removidos o subtítulo "Totais Categoria Ações/FIIs" e a coluna "Categoria" da tabela (sempre redundante: a página já é roteada por categoria). `TOTAL_ASSET_CATEGORY_SUBTITLES` e o `format` parameter `categoryLabelMap` foram removidos; o `fetch('/api/categories')` da página deixa de existir.

**Stack:** Next.js 16.2.1 (App Router), React 19, TypeScript 5, Supabase JS 2 (`maybeSingle`), Tailwind 4, `node:test` via `tsx --test`.

---

## Arquivos afetados

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/lib/total-assets.ts` | criar | funções puras: `normalizeTotalCategoryTotals`, `calculateCategoryPerformance`, `sortTotalAssets` |
| `src/lib/total-assets.test.ts` | criar | testes `node:test` das funções puras |
| `src/lib/total-asset-categories.ts` | modificar | manter `TOTAL_ASSET_CATEGORY_TITLES` (sem subtítulos) |
| `src/lib/total-asset-categories.test.ts` | criar | testes de `TOTAL_ASSET_CATEGORY_TITLES` |
| `src/types/total-asset.ts` | modificar | adicionar `TotalCategoryTotals` e `categoryTotals` em `TotalAssetsApiResponse` |
| `src/app/api/total-assets/route.ts` | modificar | incluir `total_categories_cache` via `maybeSingle` (zeros quando ausente) |
| `src/app/total-assets/[category]/page.tsx` | modificar | linha-resumo (sem subtítulo) e ordenação da tabela (sem coluna Categoria) |

Sem mudanças em: `db/`, `scripts/`, schema, crons, navbar.

---

## Task 1 — Funções puras com TDD

**Arquivos:**
- Criar `src/lib/total-assets.ts`
- Criar `src/lib/total-assets.test.ts`

- [ ] **Step 1.1 — Escrever testes falhando**

```ts
// src/lib/total-assets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCategoryPerformance,
  normalizeTotalCategoryTotals,
  sortTotalAssets,
  type TotalAsset,
} from "./total-assets";

const baseAsset: TotalAsset = {
  code: "AAA",
  category_name: "acao",
  percentual_objetivo: 0,
  montante_objetivo: 0,
  total_qtd: 0,
  cotacao: 0,
  total_aportado: 100,
  percentual_aportado: 0,
  montante_atual: 125,
  percentual_montante_atual: 0,
  lucro: 25,
  percentual_lucro: 25,
  montante_falta: 0,
  percentual_falta: 0,
  primeiro_aporte: null,
  ultimo_aporte: null,
};

test("normalizeTotalCategoryTotals converte strings numéricas e mantém null como zeros", () => {
  const row = {
    total_assets_value_aported: "100.5",
    total_assets_value_current: "125.5",
    total_assets_weight: "12.345",
  };
  const result = normalizeTotalCategoryTotals(row);
  assert.deepEqual(result, {
    totalAportado: 100.5,
    totalAtual: 125.5,
    totalPeso: 12.345,
  });
});

test("normalizeTotalCategoryTotals aceita valores já numéricos", () => {
  const result = normalizeTotalCategoryTotals({
    total_assets_value_aported: 100,
    total_assets_value_current: 110,
    total_assets_weight: 5.4,
  });
  assert.deepEqual(result, { totalAportado: 100, totalAtual: 110, totalPeso: 5.4 });
});

test("normalizeTotalCategoryTotals devolve zeros quando registro ausente", () => {
  assert.deepEqual(normalizeTotalCategoryTotals(null), {
    totalAportado: 0,
    totalAtual: 0,
    totalPeso: 0,
  });
});

test("calculateCategoryPerformance: lucro positivo", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 100, totalAtual: 125, totalPeso: 12.5 });
  assert.equal(perf.lucro, 25);
  assert.equal(perf.percentualLucro, 25);
});

test("calculateCategoryPerformance: lucro negativo", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 100, totalAtual: 80, totalPeso: 0 });
  assert.equal(perf.lucro, -20);
  assert.equal(perf.percentualLucro, -20);
});

test("calculateCategoryPerformance: aporte zero evita NaN", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 0, totalAtual: 0, totalPeso: 0 });
  assert.equal(perf.lucro, 0);
  assert.equal(perf.percentualLucro, 0);
});

test("sortTotalAssets ASC por código (texto)", () => {
  const rows: TotalAsset[] = [
    { ...baseAsset, code: "BBB" },
    { ...baseAsset, code: "AAA" },
    { ...baseAsset, code: "CCC" },
  ];
  const sorted = sortTotalAssets(rows, "code", "asc").map((r) => r.code);
  assert.deepEqual(sorted, ["AAA", "BBB", "CCC"]);
});

test("sortTotalAssets DESC por total_aportado (número)", () => {
  const rows: TotalAsset[] = [
    { ...baseAsset, code: "A", total_aportado: 10 },
    { ...baseAsset, code: "B", total_aportado: 30 },
    { ...baseAsset, code: "C", total_aportado: 20 },
  ];
  const sorted = sortTotalAssets(rows, "total_aportado", "desc").map((r) => r.code);
  assert.deepEqual(sorted, ["B", "C", "A"]);
});

test("sortTotalAssets coloca nulos por último em ASC e DESC para datas", () => {
  const rows: TotalAsset[] = [
    { ...baseAsset, code: "A", primeiro_aporte: null },
    { ...baseAsset, code: "B", primeiro_aporte: "2024-01-01" },
    { ...baseAsset, code: "C", primeiro_aporte: "2025-05-05" },
  ];
  assert.deepEqual(sortTotalAssets(rows, "primeiro_aporte", "asc").map((r) => r.code), ["B", "C", "A"]);
  assert.deepEqual(sortTotalAssets(rows, "primeiro_aporte", "desc").map((r) => r.code), ["C", "B", "A"]);
});

test("sortTotalAssets não muta o array original", () => {
  const rows: TotalAsset[] = [{ ...baseAsset, code: "B" }, { ...baseAsset, code: "A" }];
  const original = [...rows];
  sortTotalAssets(rows, "code", "asc");
  assert.deepEqual(rows, original);
});
```

- [ ] **Step 1.2 — Rodar testes e ver falhas**

Comando: `npx --no-install tsx --test "src/lib/total-assets.test.ts"`
Esperado: falha por módulo não encontrado (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 1.3 — Implementar módulo mínimo**

```ts
// src/lib/total-assets.ts
import type { TotalAsset } from "@/types/total-asset";

export type TotalCategoryTotals = {
  totalAportado: number;
  totalAtual: number;
  totalPeso: number;
};

type SupabaseTotalsRow = {
  total_assets_value_aported: string | number | null;
  total_assets_value_current: string | number | null;
  total_assets_weight: string | number | null;
} | null;

export function normalizeTotalCategoryTotals(row: SupabaseTotalsRow): TotalCategoryTotals {
  const toNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  if (!row) return { totalAportado: 0, totalAtual: 0, totalPeso: 0 };
  return {
    totalAportado: toNumber(row.total_assets_value_aported),
    totalAtual: toNumber(row.total_assets_value_current),
    totalPeso: toNumber(row.total_assets_weight),
  };
}

export type CategoryPerformance = {
  lucro: number;
  percentualLucro: number;
};

export function calculateCategoryPerformance(totals: TotalCategoryTotals): CategoryPerformance {
  const lucro = totals.totalAtual - totals.totalAportado;
  const percentualLucro =
    totals.totalAportado !== 0 ? (lucro / totals.totalAportado) * 100 : 0;
  return { lucro, percentualLucro };
}

export type SortDirection = "asc" | "desc";

type SortableField = keyof TotalAsset;

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aStr = String(a);
  const bStr = String(b);
  return aStr.localeCompare(bStr, "pt-BR", { numeric: true });
}

export function sortTotalAssets<T extends TotalAsset>(
  rows: readonly T[],
  field: SortableField,
  direction: SortDirection,
): T[] {
  const sorted = [...rows];
  sorted.sort((rowA, rowB) => {
    const result = compareValues(rowA[field], rowB[field]);
    return direction === "asc" ? result : -result;
  });
  return sorted;
}
```

- [ ] **Step 1.4 — Rodar testes e ver verdes**

Comando: `npx --no-install tsx --test "src/lib/total-assets.test.ts"`
Esperado: 10 testes passando.

- [ ] **Step 1.5 — Commit**

```bash
git add src/lib/total-assets.ts src/lib/total-assets.test.ts
git commit -m "feat(total-assets): helpers puros para totais por categoria e ordenação"
```

---

## Task 2 — Títulos (apenas)

**Arquivos:**
- Modificar `src/lib/total-asset-categories.ts`
- Criar `src/lib/total-asset-categories.test.ts`

- [ ] **Step 2.1 — Teste falhando**

```ts
// src/lib/total-asset-categories.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOTAL_ASSET_CATEGORY_TITLES } from "./total-asset-categories";

test("título singular para cada categoria", () => {
  assert.equal(TOTAL_ASSET_CATEGORY_TITLES.acao, "Total por Ações");
  assert.equal(TOTAL_ASSET_CATEGORY_TITLES.fii, "Total por FIIs");
});
```

- [ ] **Step 2.2 — Rodar e ver falha**

Comando: `npx --no-install tsx --test "src/lib/total-asset-categories.test.ts"`
Esperado: falha de import.

- [ ] **Step 2.3 — Atualizar helper**

```ts
// src/lib/total-asset-categories.ts
export type TotalAssetCategory = "acao" | "fii";

export const TOTAL_ASSET_CATEGORIES: readonly TotalAssetCategory[] = [
  "acao",
  "fii",
] as const;

export const TOTAL_ASSET_CATEGORY_TITLES: Record<TotalAssetCategory, string> = {
  acao: "Total por Ações",
  fii: "Total por FIIs",
};

export function isTotalAssetCategory(value: string): value is TotalAssetCategory {
  return (TOTAL_ASSET_CATEGORIES as readonly string[]).includes(value);
}
```

> **Sem `TOTAL_ASSET_CATEGORY_SUBTITLES`:** removido no ajuste pós-implementação (subtítulo não é mais renderizado na página).

- [ ] **Step 2.4 — Verificar verde**

Comando: `npx --no-install tsx --test "src/lib/total-asset-categories.test.ts"`
Esperado: 1 teste passando.

- [ ] **Step 2.5 — Commit**

```bash
git add src/lib/total-asset-categories.ts src/lib/total-asset-categories.test.ts
git commit -m "feat(total-assets): títulos singulares por categoria"
```

---

## Task 3 — Tipo `TotalCategoryTotals`

**Arquivos:**
- Modificar `src/types/total-asset.ts`

- [ ] **Step 3.1 — Adicionar tipo**

```ts
// src/types/total-asset.ts
export interface TotalAsset {
  code: string;
  category_name: string;
  percentual_objetivo: number;
  montante_objetivo: number;
  total_qtd: number;
  cotacao: number;
  total_aportado: number;
  percentual_aportado: number;
  montante_atual: number;
  percentual_montante_atual: number;
  lucro: number;
  percentual_lucro: number;
  montante_falta: number;
  percentual_falta: number;
  primeiro_aporte: string | null;
  ultimo_aporte: string | null;
}

export interface TotalAssetWithInfo extends TotalAsset {
  info: string;
  weight: number;
}

export interface TotalCategoryTotals {
  totalAportado: number;
  totalAtual: number;
  totalPeso: number;
}

export interface TotalAssetsApiResponse {
  totals?: TotalAssetWithInfo[];
  category?: string;
  categoryTotals?: TotalCategoryTotals;
  error?: string;
}
```

- [ ] **Step 3.2 — Typecheck**

Comando: `npx --no-install tsc --noEmit`
Esperado: nenhum erro.

- [ ] **Step 3.3 — Commit**

```bash
git add src/types/total-asset.ts
git commit -m "feat(total-assets): tipo TotalCategoryTotals na resposta da API"
```

---

## Task 4 — Estender API `/api/total-assets`

**Arquivos:**
- Modificar `src/app/api/total-assets/route.ts`

- [ ] **Step 4.1 — Adicionar leitura do cache de categoria**

Em `src/app/api/total-assets/route.ts`, depois de validar a categoria e antes de `return NextResponse.json({ totals, category })`:

```ts
  const { data: categoryRow, error: categoryError } = await supabase
    .from("total_categories_cache")
    .select("total_assets_value_aported, total_assets_value_current, total_assets_weight")
    .eq("category", category)
    .maybeSingle();

  if (categoryError) {
    return NextResponse.json({ error: categoryError.message }, { status: 500 });
  }

  const categoryTotals = normalizeTotalCategoryTotals(categoryRow);
```

- [ ] **Step 4.2 — Importar helper e usar no retorno**

Adicionar import:

```ts
import { normalizeTotalCategoryTotals } from "@/lib/total-assets";
import type { TotalCategoryTotals } from "@/types/total-asset";
```

Trocar o retorno final para:

```ts
  return NextResponse.json({ totals, category, categoryTotals: categoryTotals as TotalCategoryTotals });
```

- [ ] **Step 4.3 — Garantir retorno de zeros quando `total_assets_cache` vazio**

Hoje a rota retorna `{ totals: [], category }` em `route.ts:43-45`. Atualizar para:

```ts
  if (rows.length === 0) {
    return NextResponse.json({
      totals: [],
      category,
      categoryTotals: categoryTotals as TotalCategoryTotals,
    });
  }
```

- [ ] **Step 4.4 — Typecheck**

Comando: `npx --no-install tsc --noEmit`
Esperado: nenhum erro.

- [ ] **Step 4.5 — Commit**

```bash
git add src/app/api/total-assets/route.ts
git commit -m "feat(total-assets): retorna categoryTotals de total_categories_cache"
```

---

## Task 5 — Página: linha-resumo e ordenação

**Arquivos:**
- Modificar `src/app/total-assets/[category]/page.tsx`

- [ ] **Step 5.1 — Imports e helpers novos**

```ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  TOTAL_ASSET_CATEGORY_TITLES,
  type TotalAssetCategory,
} from '@/lib/total-asset-categories';
import {
  calculateCategoryPerformance,
  sortTotalAssets,
  type SortDirection,
} from '@/lib/total-assets';
import type {
  TotalAssetsApiResponse,
  TotalAssetWithInfo,
} from '@/types/total-asset';
import { H1, Lead, Mono } from '@/components/ui/typography';
```

- [ ] **Step 5.2 — Tipos de coluna e estado de ordenação**

```ts
type SortField = keyof TotalAssetWithInfo;
type SortState = { field: SortField; direction: SortDirection };

type ColumnDef = {
  field: SortField;
  label: string;
  align: 'left' | 'right' | 'center';
  type: 'string' | 'number' | 'date';
  format: (row: TotalAssetWithInfo) => string;
  valueClass?: (row: TotalAssetWithInfo) => string;
};
```

- [ ] **Step 5.3 — Constante `COLUMNS`**

Manter a ordem das 17 colunas (a coluna "Categoria" foi removida — ajuste pós-implementação, era sempre redundante porque a página já é roteada por categoria). Para cada uma: `field`, `label`, `align`, `type` e `format` retornando string. Exemplo (cabeçalho da primeira coluna, restante idêntico ao código atual):

```ts
const COLUMNS: ColumnDef[] = [
  { field: 'code', label: 'Código', align: 'left', type: 'string',
    format: (row) => row.code, valueClass: () => 'font-mono font-semibold text-ink' },
  { field: 'info', label: 'Informações', align: 'left', type: 'string',
    format: (row) => row.info || '—',
    valueClass: () => 'text-body max-w-xs truncate' },
  { field: 'weight', label: 'Peso', align: 'right', type: 'number',
    format: (row) => Number(row.weight).toFixed(2),
    valueClass: () => 'text-body' },
  // ... restante das 15 colunas (peso, %, R$, datas) sem mudanças em relação à Task 5 original
];
```

- [ ] **Step 5.4 — Estado da página**

```ts
const [totals, setTotals] = useState<TotalAssetWithInfo[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [hasSearched, setHasSearched] = useState(false);
const [categoryTotals, setCategoryTotals] = useState<{
  totalAportado: number;
  totalAtual: number;
  totalPeso: number;
} | null>(null);
const [sort, setSort] = useState<SortState>({ field: 'code', direction: 'asc' });
```

> **Sem `categories` state nem `categoryLabelMap`:** removidos no ajuste pós-implementação (serviam apenas à coluna Categoria).

- [ ] **Step 5.5 — `fetchTotals` tipado**

```ts
const fetchTotals = useCallback(async (cat: TotalAssetCategory) => {
  setLoading(true);
  setError(null);
  setCategoryTotals(null);
  try {
    const res = await fetch(`/api/total-assets?category=${encodeURIComponent(cat)}`);
    const data: TotalAssetsApiResponse = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Erro ao buscar totais.');
      setTotals([]);
      return;
    }
    setTotals(data.totals ?? []);
    if (data.categoryTotals) setCategoryTotals(data.categoryTotals);
    setHasSearched(true);
  } catch {
    setError('Falha na comunicação com o servidor.');
    setTotals([]);
  } finally {
    setLoading(false);
  }
}, []);
```

- [ ] **Step 5.6 — Reset da ordenação ao mudar de categoria**

Adicionar efeito:

```ts
useEffect(() => {
  setSort({ field: 'code', direction: 'asc' });
}, [category]);
```

- [ ] **Step 5.7 — `sortedTotals` memoizado**

```ts
const sortedTotals = useMemo(
  () => sortTotalAssets(totals, sort.field, sort.direction),
  [totals, sort],
);
```

- [ ] **Step 5.8 — Header sem `Fonte:` + linha-resumo (sem subtítulo)**

Substituir o bloco `H1`/`Lead` atual pelo:

```tsx
        <div className="mb-8">
          <H1 className="text-display-sm">{title}</H1>
          {categoryTotals && (
            <SummaryLine totals={categoryTotals} />
          )}
        </div>
```

> **Sem `<p>` de subtítulo** (`TOTAL_ASSET_CATEGORY_SUBTITLES[category]`): removido no ajuste pós-implementação.

> `formatPercent` precisa aplicar `pt-BR` com duas casas (`(Number(value)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`). Implementação já presente na página.

- [ ] **Step 5.9 — Cabeçalho da tabela com ordenação**

```tsx
                    <thead>
                      <tr className="bg-surface-cream-strong border-b border-hairline text-caption-uppercase uppercase text-muted">
                        {COLUMNS.map((col) => {
                          const isActive = sort.field === col.field;
                          const arrow = isActive ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
                          const ariaSort = isActive
                            ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                            : 'none';
                          return (
                            <th
                              key={col.field}
                              scope="col"
                              aria-sort={ariaSort}
                              className={`px-4 py-3 text-${col.align}`}
                            >
                              <button
                                type="button"
                                onClick={() => setSort((prev) => ({
                                  field: col.field,
                                  direction: prev.field === col.field && prev.direction === 'asc' ? 'desc' : 'asc',
                                }))}
                                className={`inline-flex items-center gap-1 uppercase tracking-wider text-caption-uppercase ${
                                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                                } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm`}
                              >
                                <span>{col.label}</span>
                                <span aria-hidden className={isActive ? '' : 'opacity-60'}>{arrow}</span>
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
```

- [ ] **Step 5.10 — Corpo da tabela usando `sortedTotals` e `COLUMNS`**

```tsx
                    <tbody className="divide-y divide-hairline">
                      {sortedTotals.map((row) => (
                        <tr key={row.code} className="hover:bg-surface-soft transition-colors">
                          {COLUMNS.map((col) => (
                            <td
                              key={col.field}
                              className={`px-4 py-3 text-${col.align} ${col.valueClass ? col.valueClass(row) : 'text-body'}`}
                            >
                              {col.format(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
```

- [ ] **Step 5.11 — Typecheck**

Comando: `npx --no-install tsc --noEmit`
Esperado: nenhum erro.

- [ ] **Step 5.12 — Commit**

```bash
git add src/app/total-assets/[category]/page.tsx
git commit -m "feat(total-assets): linha-resumo por categoria e ordenação das colunas"
```

---

## Verificação final

- [ ] **Rodar todos os testes**
```bash
npx --no-install tsx --test "src/lib/total-assets.test.ts" "src/lib/total-asset-categories.test.ts" "scripts/sync-cotacoes-error.test.ts"
```
Esperado: todos verdes.

- [ ] **Lint**
```bash
npm run lint
```

- [ ] **Typecheck**
```bash
npx --no-install tsc --noEmit
```

- [ ] **Build**
```bash
npm run build
```

- [ ] **Smoke manual em `npm run dev`**
- `/total-assets/acao`: linha-resumo com 5 métricas abaixo do título, sem "Fonte: total_assets_cache", sem subtítulo, sem coluna "Categoria" (17 colunas), ordenação alterna ASC/DESC, primeiro clique em cada coluna, seta visível em todas (esmaecida nas inativas).
- `/total-assets/fii`: idem (mesma estrutura, mesmo número de colunas).
- Mobile: linha-resumo quebra; tabela mantém `min-w-max` com scroll horizontal.