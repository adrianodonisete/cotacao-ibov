# CRON — Totais de Dividendos por Período

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRON que calcula o total de dividendos (mensal e anual) por ativo e por categoria, gravando em `total_dividends_cache` para acelerar as consultas de UI.

**Architecture:**
- Script standalone em `scripts/calculate-totals-by-dividends.ts`, no padrão dos demais CRONs (`Promise.all` de pré-carga, `getSupabaseServer`, `parseJobId/updateJobProgress/finishJob`).
- Período derivado de `dividendos.payment_date` (primeiro ao último mês com registro); fallback para o mês/ano corrente se a tabela estiver vazia.
- Skip de meses/anos passados já calculados; UPSERT sempre no mês/ano corrente (detectado por `new Date()`).
- Conversão USD para ativos `stock`/`reit` usando `cotacoes.value` de `USD_BRL`; se ausente ou `<= 0`, mantém valor em BRL (warning, sem erro).
- Botão novo em `/cache` espelhando o padrão `CRON_CARDS` + entrada em `CRON_CONFIG` da rota `trigger`.

**Tech Stack:** TypeScript, Next.js 16.2.1, tsx, Supabase JS v2, dotenv, ESLint, `node --test`.

---

## File Structure

- `scripts/calculate-totals-by-dividends.ts` — CRON principal.
- `scripts/calculate-totals-by-dividends.test.ts` — testes das funções puras.
- `src/app/api/cache/trigger/route.ts` — adicionar `calculate-totals-by-dividends` em `CronName` e `CRON_CONFIG`.
- `src/app/cache/page.tsx` — adicionar card em `CRON_CARDS`.
- `package.json` — adicionar script `calculate-totals-by-dividends` e `test:scripts`.
- `db/supabase/create_table_total_dividends_cache.sql` — já existe. **Não editar** (UNIQUE `(chave, opcao, periodo)` já cobre a regra).

---

## Task 1: Helper functions (puras) + testes

**Files:**
- Create: `scripts/calculate-totals-by-dividends.ts`
- Create: `scripts/calculate-totals-by-dividends.test.ts`

**Helpers exportados:**

```ts
export function monthsBetween(firstISO: string, lastISO: string): string[] {
  const [fy, fm] = firstISO.split("-").map(Number);
  const [ly, lm] = lastISO.split("-").map(Number);
  const out: string[] = [];
  let y = fy, m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function yearsBetween(firstISO: string, lastISO: string): string[] {
  const start = parseInt(firstISO.slice(0, 4), 10);
  const end = parseInt(lastISO.slice(0, 4), 10);
  const out: string[] = [];
  for (let y = start; y <= end; y++) out.push(String(y));
  return out;
}

export function currentMonthLabel(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearLabel(now: Date = new Date()): string {
  return String(now.getUTCFullYear());
}

export function shouldRecalculate(
  periodo: string,
  opcao: "mensal" | "anual",
  now: Date = new Date(),
): boolean {
  if (opcao === "mensal") return periodo === currentMonthLabel(now);
  return periodo === currentYearLabel(now);
}
```

**Casos de teste (`scripts/calculate-totals-by-dividends.test.ts`):**
- `monthsBetween("2025-01-15", "2025-03-04")` → `["2025-01","2025-02","2025-03"]`
- `monthsBetween("2025-11-20", "2026-02-10")` → `["2025-11","2025-12","2026-01","2026-02"]` (cruza ano)
- `yearsBetween("2025-06-01", "2027-01-01")` → `["2025","2026","2027"]`
- `currentMonthLabel(new Date("2026-08-21T00:00:00Z"))` → `"2026-08"`
- `currentYearLabel(new Date("2026-08-21T00:00:00Z"))` → `"2026"`
- `shouldRecalculate("2026-08", "mensal", new Date("2026-08-21T00:00:00Z"))` → `true`
- `shouldRecalculate("2026-07", "mensal", new Date("2026-08-21T00:00:00Z"))` → `false`
- `shouldRecalculate("2026", "anual", new Date("2026-08-21T00:00:00Z"))` → `true`

Adicionar ao `package.json`:
```json
"test:scripts": "tsx --test scripts/*.test.ts"
```

- [ ] Criar `scripts/calculate-totals-by-dividends.ts` com helpers exportados e `main` stub.
- [ ] Criar `scripts/calculate-totals-by-dividends.test.ts` com os casos acima.
- [ ] `npm run test:scripts` → PASS.
- [ ] `git commit -m "feat(cron): add period helpers + tests for total-dividends cache"`

---

## Task 2: Determinar range do cálculo

**Files:**
- Modify: `scripts/calculate-totals-by-dividends.ts`

```ts
async function resolvePeriod(): Promise<{ first: string; last: string }> {
  const supabase = getSupabaseServer();
  const { data: firstRows, error: e1 } = await supabase
    .from("dividendos").select("payment_date")
    .order("payment_date", { ascending: true }).limit(1);
  const { data: lastRows, error: e2 } = await supabase
    .from("dividendos").select("payment_date")
    .order("payment_date", { ascending: false }).limit(1);
  if (e1 || e2) throw new Error(`Erro ao consultar dividendos: ${e1?.message ?? e2?.message}`);

  const now = new Date();
  const ym = currentMonthLabel(now);
  const fallbackLast = `${ym}-01`;

  const first = (firstRows ?? [])[0] as { payment_date: string } | undefined;
  const last = (lastRows ?? [])[0] as { payment_date: string } | undefined;
  if (!first || !last) return { first: fallbackLast, last: fallbackLast };
  return {
    first: String(first.payment_date).slice(0, 10),
    last: String(last.payment_date).slice(0, 10),
  };
}
```

Em `main`, chamar `resolvePeriod` e logar `"Period: <first> → <last>"`.

- [ ] Implementar `resolvePeriod`.
- [ ] Chamar em `main`, logar range.
- [ ] Rodar local só para confirmar leitura.
- [ ] `git commit -m "feat(cron): resolve dividends period range from dividendos.payment_date"`

---

## Task 3: Pré-carga de dados + agregação em memória

**Files:**
- Modify: `scripts/calculate-totals-by-dividends.ts`

```ts
type AtivoRow = { code: string; type: string };
type CategoryRow = { name: string };
type DividendoRow = { code: string; payment_date: string; total_liquid: number };
type CotacaoRow = { code: string; value: number };
type ExistingCacheRow = { chave: string; opcao: string; periodo: string };
```

Em `main`, após `resolvePeriod`:

```ts
const [ativosRes, catRes, divsRes, cotRes, cacheRes] = await Promise.all([
  supabase.from("ativos").select("code, type").neq("type", "td"),
  supabase.from("categories").select("name").in("name", ["acao","fii","stock","reit"]),
  supabase.from("dividendos").select("code, payment_date, total_liquid")
    .gte("payment_date", first).lte("payment_date", last),
  supabase.from("cotacoes").select("code, value").eq("code", "USD_BRL"),
  supabase.from("total_dividends_cache").select("chave, opcao, periodo"),
]);

if (ativosRes.error || catRes.error || divsRes.error || cotRes.error || cacheRes.error) {
  console.error("Erro pré-carregando dados:",
    ativosRes.error?.message ?? catRes.error?.message ?? divsRes.error?.message
    ?? cotRes.error?.message ?? cacheRes.error?.message);
  if (jobId !== null) await finishJob(supabase, jobId, "error");
  process.exit(1);
}

const ativosList = (ativosRes.data ?? []) as AtivoRow[];
const categorias = ((catRes.data ?? []) as CategoryRow[]).map(c => c.name);

const byCodeMonth = new Map<string, Map<string, number>>(); // code -> YYYY-MM -> soma
const byCodeYear  = new Map<string, Map<string, number>>(); // code -> YYYY -> soma
for (const d of (divsRes.data ?? []) as DividendoRow[]) {
  const ymd = String(d.payment_date).slice(0, 10);
  const month = ymd.slice(0, 7);
  const year  = ymd.slice(0, 4);
  const total = Number(d.total_liquid ?? 0);
  const bm = byCodeMonth.get(d.code) ?? new Map<string, number>();
  bm.set(month, (bm.get(month) ?? 0) + total); byCodeMonth.set(d.code, bm);
  const by = byCodeYear.get(d.code) ?? new Map<string, number>();
  by.set(year, (by.get(year) ?? 0) + total); byCodeYear.set(d.code, by);
}

const usdBrl = Number(((cotRes.data ?? [])[0] as CotacaoRow | undefined)?.value ?? 0);
if (usdBrl <= 0) {
  console.warn("[calculate-totals-by-dividends] cotacoes.value para USD_BRL ausente; " +
    "ativos stock/reit manterão valor em BRL.");
}

const existing = new Set<string>();
for (const r of (cacheRes.data ?? []) as ExistingCacheRow[]) {
  existing.add(`${r.chave}|${r.opcao}|${r.periodo}`);
}

console.log(`Carregados: ${ativosList.length} ativos, ${(divsRes.data ?? []).length} dividendos.`);
```

- [ ] Adicionar queries e agregações.
- [ ] Log de progresso.
- [ ] `git commit -m "feat(cron): preload ativos, dividendos, USD_BRL and cache snapshot"`

---

## Task 4: Loop de cálculo + UPSERT

**Files:**
- Modify: `scripts/calculate-totals-by-dividends.ts`

```ts
function convert(total: number, type: string, usdBrl: number): number {
  if ((type === "stock" || type === "reit") && usdBrl > 0) return total / usdBrl;
  return total;
}

type UpsertPayload = {
  chave: string; opcao: "mensal" | "anual"; periodo: string;
  total_dividends: number; updated_at: string;
};

async function upsertBatch(supabase: ReturnType<typeof getSupabaseServer>, rows: UpsertPayload[]) {
  if (rows.length === 0) return { ok: 0, err: null as string | null };
  const { error } = await supabase
    .from("total_dividends_cache")
    .upsert(rows, { onConflict: "chave,opcao,periodo" });
  return { ok: rows.length, err: error?.message ?? null };
}
```

Loop:

```ts
const meses = monthsBetween(first, last);
const anos = yearsBetween(first, last);
const now = new Date();
const upserts: UpsertPayload[] = [];
let skipped = 0;

function push(chave: string, opcao: "mensal"|"anual", periodo: string, raw: number, type: string) {
  const key = `${chave}|${opcao}|${periodo}`;
  if (!shouldRecalculate(periodo, opcao, now) && existing.has(key)) { skipped++; return; }
  if (raw <= 0 && !shouldRecalculate(periodo, opcao, now)) return; // spec: não gravar zero histórico
  upserts.push({
    chave, opcao, periodo,
    total_dividends: convert(raw, type, usdBrl),
    updated_at: new Date().toISOString(),
  });
}

// Por ativo
for (const a of ativosList) {
  for (const m of meses) push(a.code, "mensal", m, byCodeMonth.get(a.code)?.get(m) ?? 0, a.type);
  for (const y of anos)  push(a.code, "anual",  y, byCodeYear.get(a.code)?.get(y)  ?? 0, a.type);
}
// Por categoria
for (const cat of categorias) {
  const codes = ativosList.filter(a => a.type === cat).map(a => a.code);
  for (const m of meses) {
    let s = 0;
    for (const c of codes) s += byCodeMonth.get(c)?.get(m) ?? 0;
    push(cat, "mensal", m, s, cat);
  }
  for (const y of anos) {
    let s = 0;
    for (const c of codes) s += byCodeYear.get(c)?.get(y) ?? 0;
    push(cat, "anual", y, s, cat);
  }
}

// Persistência em lotes
const BATCH = 500;
let ok = 0, fail = 0;
for (let i = 0; i < upserts.length; i += BATCH) {
  const slice = upserts.slice(i, i + BATCH);
  const r = await upsertBatch(supabase, slice);
  if (r.err) { console.error(`[batch ${i}-${i+slice.length}] upsert falhou:`, r.err); fail += slice.length; }
  else { ok += r.ok; console.log(`[batch ${i}-${i+slice.length}] OK (${r.ok} rows)`); }
  if (jobId !== null) await updateJobProgress(supabase, jobId, ok + skipped, fail);
}

console.log(`Done: upserted=${ok} skipped(existing)=${skipped} failed=${fail} planned=${upserts.length}`);
if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? "error" : "done");
return { ok, fail, skipped };
```

**Cobertura do spec:**
- Ativos (todos exceto `td`) e categorias (`acao`, `fii`, `stock`, `reit`).
- Mensal (`YYYY-MM`) e anual (`YYYY`).
- Conversão USD para `stock`/`reit` quando `usdBrl > 0`; senão mantém BRL.
- Skip de passado já existente; upsert do corrente.
- Não grava `0` histórico (períodos sem dividendos).

- [ ] Adicionar `convert`, `upsertBatch`, `push`, loops e persistência.
- [ ] Rodar `npm run calculate-totals-by-dividends` — espera `Done: upserted=N skipped=N`.
- [ ] Validar `select count(*) from total_dividends_cache` no Supabase.
- [ ] Rodar 2ª vez — `skipped` cresce; mês/ano corrente é upserted.
- [ ] `git commit -m "feat(cron): compute and upsert per-period dividends totals"`

---

## Task 5: Adicionar script no package.json

**Files:**
- Modify: `package.json`

```json
"calculate-totals-by-dividends": "tsx scripts/calculate-totals-by-dividends.ts",
"test:scripts": "tsx --test scripts/*.test.ts"
```

- [ ] Editar `package.json`.
- [ ] `npm run calculate-totals-by-dividends` inicia corretamente.
- [ ] `git commit -m "chore: wire calculate-totals-by-dividends npm script"`

---

## Task 6: Registrar cron no trigger da UI

**Files:**
- Modify: `src/app/api/cache/trigger/route.ts`
- Modify: `src/app/cache/page.tsx`

**`route.ts` — adicionar union + CRON_CONFIG:**
```ts
type CronName =
  | 'sync-cotacoes' | 'sync-cotacoes-us' | 'sync-cotacoes-td'
  | 'sync-cotacoes-indices' | 'calculate-totals-by-category'
  | 'calculate-totals-by-assets' | 'calculate-totals-by-dividends';

// em CRON_CONFIG:
'calculate-totals-by-dividends': {
  script: 'scripts/calculate-totals-by-dividends.ts',
  fixedTotalSteps: 1,
},
```

> Total preciso exigiria consulta extra dentro do route; optou-se por `fixedTotalSteps: 1` (UI já tolera `finished_steps >= total_steps`). Progresso real fica no log do CRON.

**`page.tsx` — adicionar card em `CRON_CARDS`:**
```ts
{
  cron: 'calculate-totals-by-dividends',
  label: 'Calcular Totais de Dividendos por Período',
  description: 'Calcula e grava em total_dividends_cache o total mensal e anual de dividendos por ativo e por categoria (acao/fii/stock/reit). Stock/reit convertidos para USD via cotação USD_BRL.',
  types: ['acao', 'fii', 'stock', 'reit'],
  source: 'Supabase (agregação por período)',
},
```

- [ ] Editar `route.ts` (union + CRON_CONFIG).
- [ ] Editar `page.tsx` (CRON_CARDS).
- [ ] `npm run lint` passa.
- [ ] Abrir `/cache` em dev, validar card + botão "Executar".
- [ ] `git commit -m "feat(cache): expose calculate-totals-by-dividends trigger + UI card"`

---

## Task 7: Verificação final

- [ ] `npm run lint` — sem erros.
- [ ] `npm run test:scripts` — todos verdes.
- [ ] `npm run calculate-totals-by-dividends` em dev — completa com `Done:`.
- [ ] Re-executar — `skipped` cresce; corrente upserted.
- [ ] Validar 1 ativo + 1 categoria contra SQL ad-hoc.
- [ ] Validar 1 ativo `stock` em USD.
- [ ] `git status` — apenas arquivos intencionais.

---

## Notes

- Tabela `total_dividends_cache` já existe com UNIQUE `(chave, opcao, periodo)`. Nenhuma migração adicional.
- `total_dividends` é `NUMERIC(15, 2)` — agregação vem direto de `dividendos.total_liquid`.
- O spec diz "campo value" — usar a coluna `value` retornada pelo cliente Supabase (o nome é só escapado no DDL).
- Categoria `td` (Tesouro Direto) explicitamente excluída.
- Estoque vazio de `dividendos`: cai no fallback do mês corrente e não grava nada.