# Cotação IBOV — visão do projeto

Aplicação web em português (pt-BR) para consultar cotações de ativos da B3 (ações e FIIs), cadastrar e listar ativos e aportes, manter cotações persistidas no Supabase e disparar jobs de sincronização (Brasil via Brapi, EUA via Twelve Data).

O nome do pacote npm é `ibov-temp`; a identidade do produto na UI é **Cotação IBOV**.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| UI | React 19, TypeScript 5, Tailwind CSS 4 |
| Banco | [Supabase](https://supabase.com) (PostgreSQL), cliente `@supabase/supabase-js` no servidor |
| Cotações BR | [Brapi](https://brapi.dev) (`brapi` + token) |
| Cotações US | [Twelve Data](https://twelvedata.com) (`twelvedata`) |

Scripts CLI usam `tsx` e carregam variáveis de ambiente (por exemplo via `scripts/env` e `.env.local`).

## Funcionalidades principais

- **Home (`/`)**: busca de cotação por ticker; consome `GET /api/quote` (proxy seguro para Brapi).
- **Cadastro e listagem de ativos** (`/cadastro-ativos`, `/listagem-ativos`): CRUD de ativos no Supabase (código, descrição, tipo, peso).
- **Cadastro e listagem de aportes** (`/cadastro-aportes`, `/listagem-aportes`): registros de compras (quantidade, valor, data, moeda, etc.).
- **Cache / jobs** (`/cache`): painel para status de cache e disparo dos jobs de sincronização de cotações.

Tipos de ativo suportados no código (`src/lib/constants.ts`): ação, FII, stock, REIT, Tesouro Direto (`acao`, `fii`, `stock`, `reit`, `td`). Cotações em lote nos scripts: Brapi para `acao` e `fii`; Twelve Data para `stock` e `reit`.

## Rotas de API (resumo)

| Rota | Função |
|------|--------|
| `GET /api/quote` | Cotação por `code` (Brapi no servidor) |
| `/api/assets`, `/api/assets/[id]` | Ativos |
| `/api/aportes`, `/api/aportes/[id]`, `/api/aportes/check` | Aportes |
| `/api/cache/status`, `/api/cache/trigger` | Status e disparo dos CRONs de sync (`sync-cotacoes`, `sync-cotacoes-us`) |

O trigger de cache inicia os scripts em `scripts/` e registra progresso em `status_cron_job` quando aplicável.

## Banco de dados (Supabase)

Scripts SQL em `db/supabase/` (executar no painel SQL do projeto):

| Arquivo | Tabela | Uso |
|---------|--------|-----|
| `create_table_ativos.sql` | `ativos` | Cadastro de tickers, tipo, peso |
| `create_table_aportes.sql` | `aportes` | Histórico de aportes |
| `create_table_cotacoes.sql` | `cotacoes` | Última cotação por `code` (valor + data) |
| `create_table_status_cron_job.sql` | `status_cron_job` | Progresso das execuções dos jobs |

O projeto documenta uso de **service role** no backend apenas; RLS está desabilitado nas tabelas (projeto pessoal / acesso controlado pelo servidor).

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento Next.js |
| `npm run build` / `npm start` | Build e produção |
| `npm run lint` | ESLint |
| `npm run sync-cotacoes` | Atualiza `cotacoes` para ativos `acao` e `fii` (Brapi) |
| `npm run sync-cotacoes-us` | Atualiza `cotacoes` para `stock` e `reit` (Twelve Data; rate limit no free tier) |

Opcional: `-- --job-id <id>` nos scripts de sync para atualizar `status_cron_job`.

## Variáveis de ambiente

Configurar em `.env.local` (não versionar):

- **`BRAPI_TOKEN`**: Brapi; apenas servidor (API routes / scripts BR).
- **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**: Supabase no servidor; nunca expor a service role ao cliente.
- **`TWELVEDATA_API_KEY`**: Twelve Data; scripts de cotações US.

## Convenções de produto

- Textos da interface em **pt-BR**; valores monetários e números com locale `pt-BR`.
- Tema escuro: fundos `gray-950` / `gray-900`, acentos `emerald` (positivo), `red` (negativo/erro), bordas `gray-800` / `gray-700`.
- Tipos TypeScript compartilhados em `src/types/`.

## Estrutura relevante

```
src/
  app/           # páginas App Router + route handlers em app/api/
  components/    # ex.: Navbar
  lib/           # supabase, brapi-service, twelvedata-service, constants
  types/         # modelos e DTOs
scripts/         # sync de cotações, progresso de job, env
db/supabase/     # DDL das tabelas
```

## Documentação adicional

- Regras do repositório: `.cursor/rules/project-conventions.mdc` (stack, locale, design system, env).
- `README.md`: instruções genéricas do create-next-app; este `project.md` descreve o domínio e a arquitetura deste app.
