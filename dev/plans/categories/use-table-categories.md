# Plan: Replace TYPES_ASSETS with categories DB Table

## Context

`TYPES_ASSETS` is a hardcoded `Record<string, string>` in `src/lib/constants.ts:3-9` mapping type keys (acao, fii, stock, reit, td) to labels. Used in 3 frontend pages for dropdowns, table cells, and validation. API routes and sync scripts filter by type directly against the `ativos` table (not via this constant).

## Steps

### Step 1: Create SQL scripts
- `db/supabase/create_table_categories.sql` — follows existing pattern from `create_table_ativos.sql` (BIGINT GENERATED ALWAYS AS IDENTITY, RLS disabled, index on name)
- `db/supabase/insert_categories.sql` — INSERT 5 rows (acao, fii, stock, reit, td)

### Step 2: Create TypeScript type
- `src/types/category.ts` — `Category` interface with `id: number`, `name: string`, `label: string`

### Step 3: Create API route
- `src/app/api/categories/route.ts` — GET endpoint, fetches all categories from Supabase, returns JSON

### Step 4: Update constants.ts
- Remove `TYPES_ASSETS` constant
- Add `getCategories()` server-side helper that fetches from Supabase directly

### Step 5: Update frontend pages
- `cadastro-ativos/page.tsx` — fetch categories, replace TYPES_ASSETS usage (lines 48, 177, 268)
- `listagem-aportes/page.tsx` — same (lines 263, 422)
- `listagem-ativos/page.tsx` — same (lines 158, 215, 261)

### Step 6: Clean up
- Remove `TYPES_ASSETS` from `src/lib/constants.ts`
- Keep `CURRENCIES` constant (unrelated)
- Update `AssetType` type if needed

## Files to create
| File | Purpose |
|------|---------|
| `db/supabase/create_table_categories.sql` | DDL for categories table |
| `db/supabase/insert_categories.sql` | Seed data |
| `src/types/category.ts` | TypeScript interface |
| `src/app/api/categories/route.ts` | GET API endpoint |

## Files to modify
| File | Change |
|------|--------|
| `src/lib/constants.ts` | Remove TYPES_ASSETS, add getCategories() |
| `src/app/cadastro-ativos/page.tsx` | Fetch categories, replace TYPES_ASSETS |
| `src/app/listagem-aportes/page.tsx` | Same |
| `src/app/listagem-ativos/page.tsx` | Same |
