# Plan: Tela "Totais por Categoria" (Ações / FIIs)

> **Para agentes:** Este plano cobre apenas a tela de **Ações** e **FIIs**. As variantes para `stock`, `reit` e `td` ficarão para planos futuros — seus links de menu **não** entram no NavBar agora (decisão confirmada com o usuário).
>
> **Sem paginação** — cada categoria tem no máximo ~25 ativos (decisão confirmada).
>
> **Validação de categoria compartilhada** via `src/lib/total-asset-categories.ts` (helper único importado pela API e pela página).
>
> **`total_assets_cache` é lido em duas queries separadas** (sem `!left` join aninhado) — a primeira busca as linhas do cache, a segunda busca `ativos` em lote por `code` para trazer `info` e `weight`.

**Goal:** Adicionar a tela `/total-assets/[category]` que exibe os totais pré-calculados por ativo (provenientes de `total_assets_cache` + `ativos.info`) filtrados pela categoria da URL. Adicionar entradas de menu "Totais por Ações" e "Totais por FIIs" no NavBar.

**Architecture:**
- Rota dinâmica única `src/app/total-assets/[category]/page.tsx` que detecta a categoria via `useParams()` e busca `/api/total-assets?category=…`.
- Nova API Route `GET /api/total-assets` faz **duas queries separadas** (cache + ativos) e mescla no servidor.
- NavBar ganha um grupo dropdown **"Totais por Categoria"** com 2 filhos (`acao`, `fii`).
- 18 colunas no total — tabela larga com `overflow-x-auto` (mesmo padrão de `listagem-aportes/page.tsx`).
- Helper compartilhado `src/lib/total-asset-categories.ts` define `TOTAL_ASSET_CATEGORIES`, `TOTAL_ASSET_CATEGORY_TITLES` e `isTotalAssetCategory()`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind 4 · Supabase (server-side via `getSupabaseServer()`).

---

## Files

| Ação         | Arquivo                                                  |
|--------------|----------------------------------------------------------|
| **CRIAR**    | `src/lib/total-asset-categories.ts`                      |
| **CRIAR**    | `src/types/total-asset.ts`                               |
| **CRIAR**    | `src/app/api/total-assets/route.ts`                      |
| **CRIAR**    | `src/app/total-assets/[category]/page.tsx`               |
| **MODIFICAR**| `src/components/Navbar.tsx`                              |

Nenhuma alteração SQL — a tabela `total_assets_cache` já existe (`db/supabase/create_table_total_assets_cache.sql`).

---

## Pré-condições (verificar antes de começar)

Antes de qualquer task, confirme:

1. A tabela `total_assets_cache` existe no Supabase (já criada em plano anterior).
2. O cron `calculate-totals-by-assets` já foi executado ao menos uma vez (caso contrário a tabela fica vazia e a tela exibirá "Nenhum total calculado").
3. A categoria existe na tabela `categories` (já populada via `db/supabase/insert_categories.sql`).

Se (2) não for verdade, basta disparar a rotina em `/cache` antes de validar a tela.

---

## Task 1: Helper compartilhado de validação de categoria

**Files:**
- Create: `src/lib/total-asset-categories.ts`

### Step 1.1 — Criar o helper

Crie `src/lib/total-asset-categories.ts` com o seguinte conteúdo (sem comentários):

```ts
export type TotalAssetCategory = "acao" | "fii";

export const TOTAL_ASSET_CATEGORIES: readonly TotalAssetCategory[] = [
  "acao",
  "fii",
] as const;

export const TOTAL_ASSET_CATEGORY_TITLES: Record<TotalAssetCategory, string> = {
  acao: "Totais por Ações",
  fii: "Totais por FIIs",
};

export function isTotalAssetCategory(value: string): value is TotalAssetCategory {
  return (TOTAL_ASSET_CATEGORIES as readonly string[]).includes(value);
}
```

### Step 1.2 — Verificar compilação

Rode: `npm run lint`

Esperado: nenhum erro.

### Step 1.3 — Commit

```bash
git add src/lib/total-asset-categories.ts
git commit -m "feat(lib): add shared helper for total-asset category validation"
```

---

## Task 2: Tipo TypeScript para `total_assets_cache` + join com `ativos`

**Files:**
- Create: `src/types/total-asset.ts`

### Step 2.1 — Criar o arquivo de tipos

Crie `src/types/total-asset.ts` com o seguinte conteúdo (sem comentários):

```ts
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

export interface TotalAssetsApiResponse {
  totals?: TotalAssetWithInfo[];
  category?: string;
  error?: string;
}
```

Nota: `TotalAssetCategory` ficou em `src/lib/total-asset-categories.ts` (helper), não aqui. Reimporte quando precisar consumir.

### Step 2.2 — Verificar compilação

Rode: `npm run lint`

Esperado: nenhum erro (o tipo é novo e não é consumido por nada ainda).

### Step 2.3 — Commit

```bash
git add src/types/total-asset.ts
git commit -m "feat(types): add TotalAsset types for total-assets cache viewer"
```

---

## Task 3: API Route `GET /api/total-assets`

**Files:**
- Create: `src/app/api/total-assets/route.ts`

### Step 3.1 — Criar a API Route

Crie `src/app/api/total-assets/route.ts` com:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  type TotalAssetCategory,
} from "@/lib/total-asset-categories";
import type {
  TotalAssetWithInfo,
  TotalAssetsApiResponse,
} from "@/types/total-asset";

export async function GET(request: NextRequest): Promise<NextResponse<TotalAssetsApiResponse>> {
  const category = request.nextUrl.searchParams.get("category")?.trim();

  if (!category) {
    return NextResponse.json(
      { error: 'Parâmetro "category" é obrigatório.' },
      { status: 400 }
    );
  }

  if (!isTotalAssetCategory(category)) {
    return NextResponse.json(
      { error: `Categoria inválida. Aceitas: ${TOTAL_ASSET_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: cacheRows, error: cacheError } = await supabase
    .from("total_assets_cache")
    .select("*")
    .eq("category_name", category)
    .order("code", { ascending: true });

  if (cacheError) {
    return NextResponse.json({ error: cacheError.message }, { status: 500 });
  }

  const rows = cacheRows ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ totals: [], category });
  }

  const codes = rows.map((r) => r.code);

  const { data: ativosRows, error: ativosError } = await supabase
    .from("ativos")
    .select("code, info, weight")
    .in("code", codes);

  if (ativosError) {
    return NextResponse.json({ error: ativosError.message }, { status: 500 });
  }

  const ativosByCode = new Map<string, { info: string; weight: number }>();
  for (const a of ativosRows ?? []) {
    ativosByCode.set(a.code, {
      info: a.info ?? "",
      weight: Number(a.weight ?? 0),
    });
  }

  const totals: TotalAssetWithInfo[] = rows.map((row) => {
    const ativo = ativosByCode.get(row.code);
    return {
      code: row.code,
      category_name: row.category_name,
      percentual_objetivo: Number(row.percentual_objetivo),
      montante_objetivo: Number(row.montante_objetivo),
      total_qtd: Number(row.total_qtd),
      cotacao: Number(row.cotacao),
      total_aportado: Number(row.total_aportado),
      percentual_aportado: Number(row.percentual_aportado),
      montante_atual: Number(row.montante_atual),
      percentual_montante_atual: Number(row.percentual_montante_atual),
      lucro: Number(row.lucro),
      percentual_lucro: Number(row.percentual_lucro),
      montante_falta: Number(row.montante_falta),
      percentual_falta: Number(row.percentual_falta),
      primeiro_aporte: row.primeiro_aporte,
      ultimo_aporte: row.ultimo_aporte,
      info: ativo?.info ?? "",
      weight: ativo?.weight ?? 0,
    };
  });

  return NextResponse.json({ totals, category });
}
```

**Notas importantes:**
- **Duas queries separadas** (não `!left` join aninhado) — mais previsível, sem o `Array.isArray` defensivo.
- Short-circuit quando `rows.length === 0` para evitar `in` filter vazio no Supabase.
- Mantém a mesma forma de erro que as outras APIs (`{ error: string }`).
- Não converte para `string` no backend — o cliente formata com `toLocaleString("pt-BR")`.

### Step 3.2 — Validar lint

Rode: `npm run lint`

Esperado: zero erros.

### Step 3.3 — Smoke test manual (com dev server rodando)

Em outro terminal, com `npm run dev` rodando:

```bash
# Sem categoria → 400
curl -i http://localhost:3000/api/total-assets

# Categoria inválida → 400
curl -i "http://localhost:3000/api/total-assets?category=stock"

# Categoria válida → 200 com array
curl -s "http://localhost:3000/api/total-assets?category=acao" | head -c 500
```

Esperado:
- `400` com `{"error":"Parâmetro \"category\" é obrigatório."}`
- `400` com mensagem de categoria inválida
- `200` com `{"totals":[...],"category":"acao"}` (pode vir vazio se a tabela estiver vazia)

### Step 3.4 — Commit

```bash
git add src/app/api/total-assets/route.ts
git commit -m "feat(api): add GET /api/total-assets endpoint (two-query merge)"
```

---

## Task 4: Página `/total-assets/[category]`

**Files:**
- Create: `src/app/total-assets/[category]/page.tsx`

### Step 4.1 — Criar a página

Crie `src/app/total-assets/[category]/page.tsx` com:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Category } from "@/types/category";
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  TOTAL_ASSET_CATEGORY_TITLES,
  type TotalAssetCategory,
} from "@/lib/total-asset-categories";
import type { TotalAssetWithInfo } from "@/types/total-asset";

function formatCurrency(value: number): string {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyBRL(value: number): string {
  return `R$ ${formatCurrency(value)}`;
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(2)}%`;
}

function formatQtd(value: number): string {
  const n = Number(value);
  if (n % 1 === 0)
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function TotalAssetsByCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params?.category ?? "";

  const [totals, setTotals] = useState<TotalAssetWithInfo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const valid = isTotalAssetCategory(category);
  const title = valid ? TOTAL_ASSET_CATEGORY_TITLES[category] : "Categoria inválida";

  const fetchTotals = useCallback(async (cat: TotalAssetCategory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/total-assets?category=${encodeURIComponent(cat)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar totais.");
        setTotals([]);
        return;
      }
      setTotals(data.totals ?? []);
      setHasSearched(true);
    } catch {
      setError("Falha na comunicação com o servidor.");
      setTotals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!valid) return;
    fetchTotals(category);
  }, [category, valid, fetchTotals]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories);
      })
      .catch(() => {});
  }, []);

  const categoryLabelMap: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c.name, c.label])
  );

  if (!valid) {
    return (
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-5xl">
          <h1 className="text-3xl font-bold text-white">Categoria inválida</h1>
          <p className="mt-2 text-gray-400 text-sm">
            Categorias aceitas: {TOTAL_ASSET_CATEGORIES.join(", ")}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-gray-400 text-sm">
            Categoria:{" "}
            <span className="text-emerald-400">
              {categoryLabelMap[category] ?? category}
            </span>
            {" · "}Fonte: <span className="text-gray-300">total_assets_cache</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-gray-400">Carregando...</p>}

        {hasSearched && !loading && !error && (
          <>
            {totals.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Nenhum total calculado para esta categoria. Execute o cron{" "}
                <code className="text-emerald-400">
                  calculate-totals-by-assets
                </code>{" "}
                em /cache.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  {totals.length} ativo{totals.length !== 1 ? "s" : ""} listado
                  {totals.length !== 1 ? "s" : ""}
                </p>
                <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Categoria</th>
                        <th className="px-4 py-3 text-left">Informações</th>
                        <th className="px-4 py-3 text-right">Peso</th>
                        <th className="px-4 py-3 text-right">% Objetivo</th>
                        <th className="px-4 py-3 text-right">R$ Objetivo</th>
                        <th className="px-4 py-3 text-right">Quantidade</th>
                        <th className="px-4 py-3 text-right">Cotação</th>
                        <th className="px-4 py-3 text-right">R$ Aportado</th>
                        <th className="px-4 py-3 text-right">% Aportado</th>
                        <th className="px-4 py-3 text-right">R$ Montante Atual</th>
                        <th className="px-4 py-3 text-right">% Montante Atual</th>
                        <th className="px-4 py-3 text-right">R$ Lucro</th>
                        <th className="px-4 py-3 text-right">% Lucro</th>
                        <th className="px-4 py-3 text-right">R$ Montante Falta</th>
                        <th className="px-4 py-3 text-right">% Montante Falta</th>
                        <th className="px-4 py-3 text-center">Primeiro Aporte</th>
                        <th className="px-4 py-3 text-center">Último Aporte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {totals.map((t) => (
                        <tr
                          key={t.code}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-semibold text-white">
                            {t.code}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {categoryLabelMap[t.category_name] ?? t.category_name}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {t.info || "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {Number(t.weight).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_objetivo)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_objetivo)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatQtd(t.total_qtd)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.cotacao)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.total_aportado)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_aportado)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_atual)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_montante_atual)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              t.lucro >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {formatCurrencyBRL(t.lucro)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right ${
                              t.percentual_lucro >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatPercent(t.percentual_lucro)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_falta)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_falta)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">
                            {formatDate(t.primeiro_aporte)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">
                            {formatDate(t.ultimo_aporte)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
```

**Notas:**
- `useParams<{ category: string }>()` lê a categoria da URL (`/total-assets/acao` → `category = "acao"`).
- Validação importada do helper compartilhado `src/lib/total-asset-categories.ts`.
- O `<table>` usa `min-w-max` + container `overflow-x-auto` (mesmo padrão de `listagem-aportes/page.tsx:415`).
- `lucro` e `percentual_lucro` recebem cor condicional `emerald`/`red` (mesma convenção do projeto para valores positivos/negativos).
- **Sem paginação** — cada categoria tem no máximo ~25 ativos.
- Não há botão "Editar" / "Excluir" — a tela é somente leitura (fonte é a tabela cache).

### Step 4.2 — Validar build

Rode: `npm run build`

Esperado: build OK, página `/total-assets/[category]` aparece na lista de rotas geradas.

### Step 4.3 — Validar lint

Rode: `npm run lint`

Esperado: zero erros.

### Step 4.4 — Smoke test manual (com dev server)

Com `npm run dev` rodando:

1. Acesse `http://localhost:3000/total-assets/acao`:
   - Sem erros no console
   - Título "Totais por Ações"
   - Tabela renderiza (ou mensagem "Nenhum total calculado" se a tabela cache estiver vazia)
2. Acesse `http://localhost:3000/total-assets/fii`:
   - Título muda para "Totais por FIIs"
3. Acesse `http://localhost:3000/total-assets/stock`:
   - Renderiza fallback "Categoria inválida — Categorias aceitas: acao, fii"
4. Verifique que linhas com `lucro >= 0` aparecem verdes e `lucro < 0` vermelhas.

### Step 4.5 — Commit

```bash
git add src/app/total-assets/\[category\]/page.tsx
git commit -m "feat(ui): add /total-assets/[category] viewer page for acao and fii"
```

---

## Task 5: Adicionar entradas "Totais por Ações" e "Totais por FIIs" no NavBar

**Files:**
- Modify: `src/components/Navbar.tsx`

### Step 5.1 — Adicionar o item dropdown

Edite `src/components/Navbar.tsx` — insira um novo objeto no array `navItems` (logo após o bloco "Listar", antes de "Cache Conteúdo"):

```ts
{
  label: 'Totais por Categoria',
  children: [
    { href: '/total-assets/acao', label: 'Totais por Ações' },
    { href: '/total-assets/fii', label: 'Totais por FIIs' },
  ],
},
```

O trecho modificado de `navItems` deve ficar assim:

```ts
const navItems: NavItem[] = [
  { label: 'Cotação IBOV', href: '/' },
  {
    label: 'Cadastro',
    children: [
      { href: '/cadastro-ativos', label: 'Cadastrar Ativos' },
      { href: '/cadastro-aportes', label: 'Cadastrar Aportes' },
    ],
  },
  {
    label: 'Listar',
    children: [
      { href: '/listagem-ativos', label: 'Listar Ativos' },
      { href: '/listagem-aportes', label: 'Listar Aportes' },
    ],
  },
  {
    label: 'Totais por Categoria',
    children: [
      { href: '/total-assets/acao', label: 'Totais por Ações' },
      { href: '/total-assets/fii', label: 'Totais por FIIs' },
    ],
  },
  { label: 'Cache Conteúdo', href: '/cache' },
];
```

**Não** adicionar entradas para `stock`, `reit`, `td` (decisão confirmada — placeholder para planos futuros).

### Step 5.2 — Validar lint

Rode: `npm run lint`

Esperado: zero erros.

### Step 5.3 — Smoke test manual (com dev server)

Com `npm run dev` rodando:

1. Acesse qualquer página existente (ex: `/`) — confirme que o NavBar agora tem 5 itens diretos: **Cotação IBOV · Cadastro ▾ · Listar ▾ · Totais por Categoria ▾ · Cache Conteúdo**.
2. Hover em "Totais por Categoria" → dropdown aparece com **Totais por Ações** e **Totais por FIIs**.
3. Clique em **Totais por Ações** → navega para `/total-assets/acao` e o item fica destacado em `emerald`.
4. Volte e clique em **Totais por FIIs** → navega para `/total-assets/fii`.
5. Em qualquer uma das duas páginas, confirme que o NavBar trata o item pai ("Totais por Categoria") como ativo (`isParentActive` = true porque `pathname` bate com um dos `children.href`).

### Step 5.4 — Commit

```bash
git add src/components/Navbar.tsx
git commit -m "feat(navbar): add 'Totais por Categoria' dropdown with acao/fii links"
```

---

## Task 6: Verificação final

### Step 6.1 — Lint completo

Rode: `npm run lint`

Esperado: zero erros e zero warnings.

### Step 6.2 — Build completo

Rode: `npm run build`

Esperado:
- Compila sem erros.
- Rota `/total-assets/[category]` listada como rota dinâmica.

### Step 6.3 — Fluxo end-to-end manual

Com `npm run dev` rodando, em ordem:

1. Acesse `/cache`, dispare **Calcular Totais por Categoria** (aguarde concluir) e depois **Calcular Totais por Ativo** (aguarde concluir).
2. Volte ao `/` (Cotação IBOV) — confirme que o NavBar mostra o item **Totais por Categoria** com dropdown.
3. Abra o dropdown → clique em **Totais por Ações** → confirma a tabela populada com colunas 1-18.
4. Volte → clique em **Totais por FIIs** → mesma tabela, agora com ativos de categoria `fii`.
5. Inspecione o console do navegador — sem erros, sem warnings de hidratação React.

### Step 6.4 — Commit final (se houver ajustes)

```bash
git status
# Se houver diff:
git add -A
git commit -m "chore: ajustes finais da tela de totais por categoria"
```

---

## Notas / dependências

- **Dependência de dados:** se a tabela `total_assets_cache` estiver vazia (cron nunca rodou), a tela exibe mensagem orientando o usuário a executar `calculate-totals-by-assets` em `/cache`. Não há fallback de cálculo on-the-fly.
- **Performance:** o `SELECT` faz 2 queries por request (cache filtrado + ativos em lote por `code`). Para a cardinalidade esperada (~25 ativos por categoria) o overhead é desprezível.
- **Extensibilidade:** quando forem criadas as telas para `stock` / `reit` / `td`, basta:
  1. Adicionar a categoria em `TOTAL_ASSET_CATEGORIES` e `TOTAL_ASSET_CATEGORY_TITLES` (no helper compartilhado).
  2. Adicionar entradas no dropdown do NavBar.
- **Estilo:** todos os valores monetários usam `R$` + `pt-BR` (sem `US$` — assume que `acao`/`fii` são sempre BRL).
- **Densidade visual:** a tabela tem 18 colunas, então em telas <1280px vai exigir scroll horizontal. O cabeçalho `uppercase tracking-wider` segue o padrão das outras telas.
