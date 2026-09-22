<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project layout conventions

Most pages follow the standard ~1200px centered content width defined in `DESIGN.md` (Grid & Container). One page is a deliberate exception: `/total-assets/[category]` (served at `/total-assets/fii` and `/total-assets/acao`) — it uses 100% viewport width with the browser's native horizontal scrollbar so the 18-column totals table can stay legible. See `DESIGN.md` → "Width Exception — `/total-assets/[category]`" for the full rule set (no `max-w-*` on the wrapper, no `<Card>` / no `overflow-x-auto` around the `<table>`, the table carries the cream-card visual directly). Do not "fix" this page back to the standard container width.

# Mem0 (persistent memory)

This project has the **mem0 MCP server** configured at project scope (`.cursor/mcp.json`). It gives agents long-term memory across sessions. Use it to remember decisions, conventions, gotchas, and user preferences specific to this codebase.

## Project scope (mandatory)

All memory for this project is partitioned under a fixed scope. **Always** use:

- `user_id: "ibov_finance"`
- `app_id: "ibov_finance"`

Never read or write under the default mem0 scope. This keeps `ibov_finance` memory isolated from other projects/users.

## When to use it

- **At the start of a task**, search memory for relevant context before asking the user or making assumptions.
- **After a decision or discovery** worth keeping (architecture choices, naming conventions, recurring bugs, env setup, user preferences), store it.
- Do **not** store secrets (tokens, keys, `.env.local` values) or large code dumps.

## How to call it

Tools (all on the `project-0-ibov-mem0` server): `add_memory`, `search_memories`, `get_memories`, `get_memory`, `update_memory`, `delete_memory`.

**Write** — always pass both ids:

```json
// add_memory
{
  "text": "The US sync uses Twelve Data for stock/reit ativos; BR sync uses Brapi.",
  "user_id": "ibov_finance",
  "app_id": "ibov_finance"
}
```

**Semantic search** — filter by scope:

```json
// search_memories
{
  "query": "how are cotações synced",
  "filters": { "AND": [{ "user_id": "ibov_finance" }, { "app_id": "ibov_finance" }] }
}
```

**List / page** — same filter:

```json
// get_memories
{
  "filters": { "AND": [{ "user_id": "ibov_finance" }, { "app_id": "ibov_finance" }] },
  "page": 1,
  "page_size": 10
}
```

> The scope rule above is also enforced as an always-applied Cursor rule in `.cursor/rules/mem0.mdc`.

# Deploy & VPS

## Deploy (GitHub Actions)
- Workflow: `.github/workflows/deploy.yml` (push to `master`): checkout → setup-node → `npm ci` → `npm run build` → `easingthemes/ssh-deploy@v5.1.0` (rsync over SSH) to `/home/my-wallet/htdocs/my.wallet.local/`.
- `node-version: 24` in the workflow (NOT `node-size` — invalid). Match the server Node 24.21.0.
- `EXCLUDE: node_modules,src,app,pages,components,.git,.github,.env*` — excluded files survive `--delete`; `.env*` protects the server-only `.env.local` from being erased.
- `SCRIPT_AFTER` restarts the app as the SSH user (`nvm` source → `cd` site dir → `pm2 restart my-wallet || pm2 start npm --name my-wallet -- start`). It only works if `SSH_USER` secret is `my-wallet` (site user).

## VPS runtime (CloudPanel 2, InterServer)
- Site user `my-wallet` (home `/home/my-wallet`); deploy-only user `github-deployer`. Runtime (nvm Node 24, pm2 daemon) belongs to `my-wallet`.
- Node via nvm per site user (`~/.nvm/versions/node/v24.21.0`); source `~/.nvm/nvm.sh` in scripts. `github-deployer` has system Node 18 — cannot run Next.js 16.
- App: `pm2 start npm --name my-wallet -- start` as `my-wallet`; `pm2 save` + crontab `@reboot pm2 resurrect`. `pm2` is per-OS-user — `pm2 status` as another user shows nothing.
- Nginx vhost proxies to `127.0.0.1:3000`. **502 Bad Gateway = app not running** (start pm2), NOT SSL or proxy trailing slash.
- `.env.local` lives on the server (`/home/my-wallet/htdocs/my.wallet.local/.env.local`) and is never committed.

## Gotcha: build-time env baking
- `src/app/layout.tsx` runs `checkSupabaseConnection()` at render and gates the whole app. Pages are static by default (no `cacheComponents`), so the layout runs at **build time on CI (no env)** — the error text gets baked into the static HTML, and the server `.env.local` is never read for those pages.
- Fix (applied): `export const dynamic = "force-dynamic"` in `src/app/layout.tsx` — forces per-request SSR. Do not remove it without understanding this.

## Rules & docs
- `.cursor/rules/deploy-github-actions.mdc` — deploy pipeline details/gotchas.
- `.cursor/rules/vps-cloudpanel-runtime.mdc` — VPS/CloudPanel/pm2/.env.local/details.
- `dev/vps/erro-badgateway-nextjs-vps.md` — provisioning story; `dev/vps/vhost-file-content.txt` — vhost template.
