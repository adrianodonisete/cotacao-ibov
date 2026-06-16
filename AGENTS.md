<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
