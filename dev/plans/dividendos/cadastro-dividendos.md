# Plano — Etapa 2: Tela de cadastro de dividendos (`/cadastro-dividendos`)

## 1. Contexto e referências
- AGENTS.md: Supabase server-only via `getSupabaseServer()` em `src/lib/supabase.ts:9`; layouts centralizados `max-w-6xl`/`max-w-7xl`; scripts SQL em `db/supabase/`.
- DESIGN.md: tipografia (Copernicus + StyreneB); superfícies (`canvas`, `surface-card`, `surface-cream-strong`); 1px `hairline`; cantos `rounded-md/lg`; `StatusBanner` para erros; `Textarea` monoespaçado em `bg-canvas` com border hairline.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`: `NextRequest` + `NextResponse`, `await request.json()` ainda válido em Next.js 16.
- AGENTS `nextjs-agent-rules`: ler docs Next.js antes de escrever; nenhuma mudança incompatível à rota POST que estamos adicionando.
- Padrões já existentes:
  - `src/app/cadastro-aportes/page.tsx:46-90` (parser).
  - `src/app/api/aportes/route.ts:114-181` (POST em lote, pré-filtra duplicados e insere).
  - `src/components/Navbar.tsx:15-39` (menu agrupado em filhos).

## 2. Objetivo
Permitir cadastro em lote de dividendos via textarea, sem etapa de preview, exibindo mensagem de sucesso (com contagens) ou erro.

## 3. Decisões arquiteturais
- **Sem tela de confirmação** (especificação etapa 2). Apenas `StatusBanner` final.
- **Sem `/api/dividendos/check`** — a etapa 2 não tem preview; a checagem de duplicatas no banco é feita dentro do próprio POST.
- **Parser único (`src/lib/dividendo-parser.ts`)** puro, testável isoladamente, reaproveitado pela página.
- **Dedupe em-lote** via `Set` da chave `(code|quantity|payment_date|total_liquid)` — a 2ª ocorrência é descartada e conta como `batchDuplicates`.
- **Dedupe DB** via fetch + filter (mesmo padrão de `/api/aportes`).
- **Inserção** em lote único: `supabase.from('dividendos').insert(rows).select()`.
- **Erro de validação**: 4 colunas, NaN, etc. contam como `ignoredCount`; todas as linhas inválidas com `valid.length === 0` → `StatusBanner tone="error"`.

## 4. UI — `src/app/cadastro-dividendos/page.tsx`
- `<main className="flex-1 flex flex-col items-center px-6 py-16"><div className="w-full max-w-6xl">`.
- `<H1 className="text-display-sm">Cadastro de Dividendos</H1>` + `<Lead>` com formato.
- `<Textarea name="list_dividendos" label="Lista de Dividendos" rows={12}>` controlado.
- `onInput` aplica `e.currentTarget.value.replace(/\t/g, ';')` (mesmo padrão em `cadastro-aportes:279`).
- `<Button onClick={handleSubmit} disabled={loading || !rawText.trim()}>Cadastrar/Cadastrando…</Button>`.
- `<StatusBanner tone="success">X dividendos cadastrados · Y linhas ignoradas · Z duplicatas no lote</StatusBanner>` ou `<StatusBanner tone="error">…</StatusBanner>`.
- Placeholder com as duas linhas do briefing: `BBDC3;2026-07-31;100;890.00` e `ITUB3;2026-07-01;800;350,00`.

## 5. Parser puro — `src/lib/dividendo-parser.ts`
```
export interface DividendoInput {
  code: string;
  payment_date: string; // ISO yyyy-mm-dd
  quantity: number;
  total_liquid: number;
}

parseDividendosText(text: string): {
  rows: DividendoInput[];
  batchDuplicates: number;
  ignoredCount: number;
}
```
Regras:
- `split('\n')` → trim. Linha vazia ou começando com `#` → ignorada.
- `split(';')`. Tamanho !== 4 → ignorada.
- `code = col[0].trim().toUpperCase()`; vazio → ignorada.
- `payment_date = parseDate(col[1])` — aceita `dd/mm/yyyy` e `yyyy-mm-dd`; fora → ignorada.
- `quantity = parseFloat(col[2].replace(',', '.'))`; `NaN` → ignorada.
- `total_liquid = parseFloat(col[3].replace(',', '.'))`; `NaN` → ignorada.
- `Set<string>` de chaves `code|quantity|payment_date|total_liquid`. 2ª ocorrência no mesmo lote → ignorada (soma em `batchDuplicates`).

## 6. Tipo — `src/types/dividendo.ts`
```ts
export interface DividendoInput {
  code: string;
  payment_date: string; // yyyy-mm-dd
  quantity: number;
  total_liquid: number;
}
export interface Dividendo extends DividendoInput {
  id: number;
  created_at: string;
  updated_at: string;
}
```

## 7. API — `src/app/api/dividendos/route.ts`
`POST /api/dividendos`
- Body: `{ dividendos: DividendoInput[] }`. 400 se vazio/ausente.
- Pré-filtra duplicatas no DB:
  - Coleta códigos únicos (`Set`).
  - `supabase.from('dividendos').select('code,quantity,payment_date,total_liquid').in('code', [...unicos])`.
  - Constrói `Set` de chaves normalizadas. Filtra linhas já presentes.
- `supabase.from('dividendos').insert(remaining).select()`.
- 200: `{ inserted, dbDuplicates, batchDuplicates, ignored }`.
- 500: `{ error }`.
- Sem `GET`/`PUT`/`DELETE`.

## 8. Navbar — `src/components/Navbar.tsx`
- Adiciona filho no grupo "Cadastro":
  ```ts
  { href: '/cadastro-dividendos', label: 'Cadastrar Dividendos' }
  ```

## 9. Testes (TDD, co-localizados)
Projeto usa `node:test` + `node:assert/strict` (ver `src/lib/total-assets.test.ts`).
- `src/lib/dividendo-parser.test.ts`
  1. Linhas vazias e linhas com `#` ignoradas.
  2. Linha com != 4 colunas ignorada.
  3. `code` em minúsculo → upper; trim aplicado.
  4. Datas: `dd/mm/yyyy` e `yyyy-mm-dd` aceitos; inválida → ignorada.
  5. Quantidade/valor com `,` e `.` aceitos; NaN → ignorada.
  6. Duplicata no batch detectada (segunda ocorrência ignorada).
- `src/app/api/dividendos/route.test.ts`
  - Handler isolado (mock do `getSupabaseServer`).
  - Insere todas quando não há duplicata.
  - Duplicatas DB reportadas em `dbDuplicates`.
  - Body inválido → 400.
- Comando: `npx tsx --test src/lib/dividendo-parser.test.ts src/app/api/dividendos/route.test.ts` (a confirmar; ver `AGENTS.md` para comando final, geralmente `node --test`).

## 10. Verificação
- `npm run lint`
- `npx tsc --noEmit`
- `npx tsx --test <test files>`
- Manual: `npm run dev` → `/cadastro-dividendos` colar bloco com 1 válida + 1 duplicata + 1 inválida + `# comentário`, conferir contagens no banner; rodar de novo → apenas a duplicata ignorada.

## 11. Fora de escopo (etapas futuras)
Listagem de dividendos, popular `total_dividends` no `calculate-totals-by-category/category-assets`, cron, exibição nos cards de cache.
