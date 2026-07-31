# Plano — Etapa 3: Tela de listagem de dividendos (`/listagem-dividendos`)

## 1. Contexto
- Padrão equivalente: `src/app/listagem-aportes/page.tsx` (3 linhas de filtros, paginação, `useEffect` + botão "Buscar") e `src/app/api/aportes/route.ts` (filtro por `type` via lookup em `ativos` + `.in('code', [...])`, paginação `.range(from, to)`).
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — `GET` em Next 16 segue o contrato `NextRequest` + `NextResponse` já usado.
- PostgREST inner join: `select('*, ativos!inner(type)', { count: 'exact' })` com `.eq('ativos.type', type)` filtra os dividendos pelos tipos dos ativos.

## 2. Objetivo
Permitir consulta paginada de dividendos, filtráveis por categoria (inner join com `ativos`), código e intervalo de data de pagamento, com ordenação configurável.

## 3. UI — `src/app/listagem-dividendos/page.tsx`
- `main.flex-1.flex.flex-col.items-center.px-6.py-16 > div.w-full.max-w-7xl`.
- `<H1 className="text-display-sm">Listagem de Dividendos</H1>`.
- `<Card variant="feature" padding="lg">` envolvendo o formulário.
- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` com 3 linhas:
  - **Linha 1** (3 filtros): `Tipo do Ativo` (select c/ `todos` + categorias de `/api/categories` exceto `td`), `Data Inicial` (date), `Data Final` (date).
  - **Linha 2** (3 filtros): `Código` (uppercase no input), `Ordenar Por` (select: `payment_date` default, `code`, `quantity`, `total_liquid`), `Direção` (select: `desc` default, `asc`).
  - **Linha 3** (2 itens): `Resultados por página` (10/20/50/100, default 20) à esquerda, `<Button>Buscar</Button>` à direita.
- Defaults de data: 1º → último dia do mês anterior (`previousMonthRange()`).
- `<StatusBanner tone="error">…</StatusBanner>` para erros.
- Tabela com 4 colunas (Card feature padding none overflow-x-auto): Código | Data pagamento | Quantidade | Total líquido.
- Paginação: `← Anterior` / `Próxima →` + contador `Mostrando X–Y de Z dividendos`.
- `useEffect` carrega `categories` ao montar, remove `td` da lista.
- `useEffect` busca dividendos ao montar e quando filtros mudam; o botão "Buscar" força refetch.

## 4. Tipos
Reaproveita `Dividendo` de `src/types/dividendo.ts`. Coluna tipo fica oculta na UI; o join retorna `ativos: { type }` ignorado no client.

## 5. API — `GET` em `src/app/api/dividendos/route.ts`
- Parâmetros: `type` (default `todos`), `code` (default `""`), `date_start` (default 1º dia mês anterior), `date_end` (default último dia mês anterior), `sort_by` (`code` | `payment_date` | `quantity` | `total_liquid`, default `payment_date`), `sort_dir` (`asc` | `desc`, default `desc`), `page` (>=1, default 1), `per_page` (10/20/50/100, default 20).
- Estratégia:
  - `from('dividendos').select('code, payment_date, quantity, total_liquid, ativos!inner(type)', { count: 'exact' })`.
  - Se `type !== 'todos'`: `.eq('ativos.type', type)` (inner join).
  - `.gte('payment_date', dateStart).lte('payment_date', dateEnd)`.
  - `.order(sortBy, { ascending: sortDir === 'asc' }).order('id', { ascending: sortDir === 'asc' })` (tiebreaker).
  - `code.trim()` → `.ilike('code', '%' + upper + '%')`.
  - `.range((page-1)*perPage, page*perPage - 1)`.
- 200: `{ dividendos: data ?? [], total: count ?? 0 }`.
- 500: `{ error: msg }`.

## 6. Navbar — `src/components/Navbar.tsx`
Adiciona filho no grupo "Listar":
```ts
{ href: '/listagem-dividendos', label: 'Listar Dividendos' }
```

## 7. Defaults — helper puro
`src/lib/dividendo-defaults.ts`:
```ts
export function previousMonthRange(today?: Date): { start: string; end: string }
```

## 8. Testes (TDD, `node:test`)
- `src/lib/dividendo-defaults.test.ts`:
  - Mês típico (maio/2026 → abril/2026).
  - Virada de ano (janeiro/2026 → dezembro/2025).
- `src/app/api/dividendos/route.test.ts` (handler isolado):
  - Defaults aplicados quando query string vazia.
  - Filtro `code` aplicado via `ilike` upper.
  - Filtro `type=acao` aplica `.eq('ativos.type', 'acao')`; `type=todos` não.
  - Datas default = mês anterior.
  - `sort_by=quantity&sort_dir=desc` chama `.order('quantity', { ascending: false })` e `.order('id', { ascending: false })`.
  - `sort_by` inválido cai no default.
  - `per_page` fora da lista cai em 20.
  - Erro na query retorna 500.
- Comando: `npx tsx --test src/lib/dividendo-defaults.test.ts src/app/api/dividendos/route.test.ts src/lib/dividendo-service.test.ts src/lib/dividendo-parser.test.ts`.

## 9. Verificação
- `npm run lint` (sem regressão além das pré-existentes).
- `npx tsc --noEmit`.
- `npx tsx --test <arquivos>` (todos).
- `npx next build` (rotas `/api/dividendos` e `/listagem-dividendos`).
- Manual: `npm run dev` → `/listagem-dividendos` com 2 dividendos do mês anterior:
  - Padrão: lista do mês anterior, `payment_date desc`, `todos`.
  - Selecionar `acao` → restringe por categoria (se houver `code` cadastrado em `ativos.type='acao'`).
  - Digitar parte do código → filtra.
  - `total líquido asc` → primeira linha é o menor valor.
  - `per_page=10` página 2 → recarrega corretamente.

## 10. Formatação
- `code` monoespaçado + semibold.
- `payment_date` em `dd/mm/yyyy`.
- `quantity`: 4 casas quando fracionário, sem casas quando inteiro.
- `total_liquid`: 2 casas com prefixo `R$ `.

## 11. Fora de escopo
Edição/exclusão, popular `total_dividends`, cron, cards de cache.

## 12. Atualização 3.1 — Ações de Editar e Excluir

### 12.1. UI adicional em `src/app/listagem-dividendos/page.tsx`
- Coluna **Ações** na tabela (à direita) com botões `Editar` e `Excluir` (mesmo padrão de `listagem-aportes:395-430`).
- `useState<Dividendo | null>` para `editingDividendo`, `deletingDividendo`, mais flags `editLoading`, `deleteLoading` e mensagens `editError`, `deleteError`.
- Modal de edição (`size="md"`) com 3 campos: **Data pagamento** (`type="date"`), **Quantidade** e **Total líquido** (textuais aceitando `.` e `,`). Inputs em `editPaymentDate`, `editQuantity`, `editTotalLiquid`.
- Modal de confirmação de exclusão (`size="sm"`) com texto: `Deseja excluir o dividendo de <code> em <data>? Esta ação não pode ser desfeita.` + `<Mono>` para o código e `<span>` com peso para a data.
- Após `PUT`/`DELETE` bem-sucedido: `setEditingDividendo(null)` / `setDeletingDividendo(null)` e `fetchDividendos(page)` para refresh.
- Após erro: `<StatusBanner tone="error">` dentro do modal.

### 12.2. Backend (não implementado nesta etapa, será em etapa futura)
- `PUT /api/dividendos/[id]` — atualiza `payment_date`, `quantity`, `total_liquid`. Erro `23505` (UNIQUE) → 409.
- `DELETE /api/dividendos/[id]` — remove e retorna `{ success: true }`.
- Helpers em `src/lib/dividendo-input.ts` (`parseDividendoNumber`, `parseDividendoId`).

### 12.3. Verificação (escopo limitado à página)
- `npm run lint` — sem regressões além das pré-existentes.
- `npx tsc --noEmit` — sem novos erros.
- `npx next build` — `/listagem-dividendos` continua prerendered.
- Manual: abrir `/listagem-dividendos`, clicar **Editar** ou **Excluir** — UI renderiza modais; clicks em **Salvar**/**Excluir** retornam falha até a próxima etapa entregar a API.
