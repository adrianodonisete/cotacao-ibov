# TODO: cron de cotações (`cotacoes` + Brapi)

Checklist ordenada para implementar a [specification.md](./specification.md).

## Banco de dados

- [x] Criar `db/supabase/create_table_cotacoes.sql` com `id`, `code` (UNIQUE), `date_update`, `value`, índices e comentários alinhados a `ativos`/`aportes`.
- [ ] Executar o script no painel SQL do Supabase (projeto correto).

## Dependências

- [x] Confirmar se `brapi` está em `package.json`; se não, executar `npm install brapi`.
- [x] Validar import e uso conforme [documentação TypeScript da Brapi](https://brapi.dev/docs/sdks/typescript) — SDK usado em [`src/lib/brapi-service.ts`](../../../src/lib/brapi-service.ts) (`client.quote.retrieve`).

## BrapiService e refatoração

- [x] Implementar `BrapiService` — [`src/lib/brapi-service.ts`](../../../src/lib/brapi-service.ts) (`createBrapiClient`, `fetchQuoteForTicker`, token `BRAPI_TOKEN`).
- [x] Refatorar [`src/app/api/quote/route.ts`](../../../src/app/api/quote/route.ts) para usar `fetchQuoteForTicker` e erros `APIError` do SDK.

## Tipos

- [ ] Adicionar tipo `Cotacao` (e payloads necessários) em `src/types/`.

## Job manual (CLI)

- [x] Implementar script [`scripts/sync-cotacoes.ts`](../../../scripts/sync-cotacoes.ts):
  - [x] Conecta ao Supabase com `getSupabaseServer()`.
  - [x] Seleciona `ativos` com `type IN ('acao', 'fii')`.
  - [x] Para cada `code`, chama `fetchQuoteForTicker` **sequencialmente**.
  - [x] Faz upsert em `cotacoes` (`value`, `date_update`; `onConflict: code`).
- [x] Tratar erros por ativo: log no console, continua os seguintes; exit code 1 se houve falhas.
- [x] Mapear resposta: `regularMarketPrice` → `value`; `regularMarketTime` (ou hoje) → `date_update`.

## npm scripts

- [x] Adicionar `"sync-cotacoes": "tsx scripts/sync-cotacoes.ts"` em `package.json`.
- [x] Documentar em [`dev/supabase-service-role.txt`](../../supabase-service-role.txt) (secção 5) e comentário no topo de `scripts/sync-cotacoes.ts`.

## Validação

- [ ] Teste manual: rodar o script com poucos ativos e verificar linhas em `cotacoes`.
- [ ] Teste manual: `GET /api/quote?code=...` após refatoração.

## Opcional (fases seguintes)

- [ ] Rate limiting / delay entre chamadas Brapi se a API limitar requisições.
- [ ] Agendamento real (cron do SO, GitHub Actions, ou Vercel Cron) chamando o mesmo comando.
