# Plan: Correção do cálculo de `% Objetivo` e `R$ Objetivo` em `calculate-totals-by-assets`

## Goal

Corrigir a fórmula de `total_assets_cache.percentual_objetivo` (e, em cascata, `total_assets_cache.montante_objetivo`) que estava com a divisão invertida. A tela `/total-assets/[category]` exibe os valores pré-computados, portanto não há mudança no frontend — só no cron.

As colunas `montante_falta` e `percentual_falta` são **derivadas** de `montante_objetivo − montante_atual`; suas fórmulas estão corretas em lógica e passam a fazer sentido automaticamente após este fix.

---

## Sintoma observado

No exemplo do usuário, com:

- `ativos.weight` (ABEV3) = **1.50**
- `total_categories_cache.total_assets_weight` (ações) = **91.31**
- `total_categories_cache.total_assets_value_current` (ações) = **R$ 14.506,65**

| Coluna | Esperado | Calculado antes do fix | Causa |
|---|---|---|---|
| `percentual_objetivo` | `1.50 / 91.31 × 100 = 1.64` | `91.31 / 1.50 = 60.87` | Divisão **invertida** |
| `montante_objetivo` | `14506.65 × (1.50 / 91.31) ≈ R$ 238,31` | `14506.65 × 60.87 ≈ R$ 883.000,34` | Cascata do erro acima |

> Os números `R$ 237,41` e `94,02%` citados pelo usuário no exemplo apresentavam pequena inconsistência aritmética (provável mistura entre totais de categoria e do ativo), mas a **intenção da fórmula** é inequívoca: `percentual_objetivo` é a fração do peso do ativo sobre o peso total da categoria.

---

## Root cause

`scripts/calculate-totals-by-assets.ts:137` calculava:

```ts
const percentual_objetivo = peso > 0 ? total_peso / peso : 0;
```

A divisão está ao contrário do declarado no plano original (`dev/plans/cron-totais-por-asset/create-cron-totais-por-assets.md`, linha 100), que previa `peso`/`total_peso` mas acabou implementado como `total_peso`/`peso`.

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `scripts/calculate-totals-by-assets.ts` | **MODIFY** — linhas 137-138 |
| `db/supabase/create_table_total_assets_cache.sql` | sem mudança (schema já está em percentual, `NUMERIC(10,2)`) |
| `src/app/total-assets/[category]/page.tsx` | sem mudança (tela só exibe) |
| `src/app/api/total-assets/route.ts` | sem mudança (API só lê) |

---

## Diff aplicado

```diff
       const total_peso = catTotals.total_assets_weight;
       const total_value_curr = catTotals.total_assets_value_current;

       ...

-      const percentual_objetivo = peso > 0 ? total_peso / peso : 0;
-      const montante_objetivo = total_value_curr * percentual_objetivo;
+      const percentual_objetivo =
+        peso > 0 && total_peso > 0 ? (peso / total_peso) * 100 : 0;
+      const montante_objetivo = total_value_curr * (percentual_objetivo / 100);
```

### Por que essa forma

1. `(peso / total_peso) × 100` produz o valor pronto para a coluna `NUMERIC(10,2)` (ex.: `1.64`, não `0.0164`) — mesma convenção das outras colunas de percentual no script (`percentual_aportado`, `percentual_lucro`, etc.).
2. `montante_objetivo = total_value_curr × (percentual_objetivo / 100)` reaplica a divisão por 100 para voltar à escala monetária (`14506.65 × 0.0164 ≈ R$ 238,31`).
3. Guard duplo `peso > 0 && total_peso > 0` evita divisão por zero em **dois** cenários:
   - ativo sem peso cadastrado (`peso === 0`) — já protegido;
   - categoria sem ativos com peso (categoria recém-criada, `total_peso === 0`) — **nova proteção**.

Em ambos os casos o resultado é `0`, alinhado com o comportamento esperado para tabelas vazias.

---

## Fórmulas finais (referência, em pseudocódigo)

```
peso                  = ativos.weight
total_peso            = total_categories_cache.total_assets_weight    (categoria do ativo)
total_value_curr      = total_categories_cache.total_assets_value_current (categoria do ativo)
montante_atual        = total_qtd × cotacao

percentual_objetivo   = (peso / total_peso) × 100                          [armazenado como %, ex.: 1.64]
montante_objetivo     = total_value_curr × (percentual_objetivo / 100)     [R$, ex.: 238.31]

montante_falta        = montante_objetivo − montante_atual
percentual_falta      = (montante_falta / montante_objetivo) × 100         (guard: se objetivo = 0 → 0)
```

---

## Validação das colunas `montante_falta` / `percentual_falta`

Já estavam corretas em lógica; só passam a fazer sentido depois do fix de `montante_objetivo`.

| Cenário | `montante_atual` | `montante_objetivo` | `montante_falta` | `percentual_falta` |
|---|---|---|---|---|
| Sem posição no ativo | `0` | `238.31` | `+238.31` (falta comprar) | `100%` |
| Posição completa | `238.31` | `238.31` | `0` | `0%` |
| Posição excedente | `500` | `238.31` | `−261.69` (excesso) | `−109.81%` |

---

## Pós-fix: repopular o cache

Como o cache é persistido em `total_assets_cache`, **os valores antigos permanecem** até o cron rodar novamente. Para refletir a correção:

```bash
npm run calculate-totals-by-category   # primeiro, se ainda não estiver atualizado
npm run calculate-totals-by-assets     # regrava total_assets_cache com a fórmula corrigida
```

Ou pela UI: `/cache` → clicar "Executar" nos cards correspondentes (na ordem category → assets).

---

## Verificação

```bash
# Lint
npm run lint

# Typecheck
npx --no-install tsc --noEmit

# Build
npm run build
```

Critério de aceite: todos verdes, sem warning novo.

---

## Não-objetivos

- Sem mudança de schema, tipos TypeScript ou API.
- Sem novo teste (decisão do usuário nesta task: fix direto). Para evitar regressão futura, a memória do mem0 registra a fórmula correta.
- Sem mudança em `montante_falta` / `percentual_falta` (fórmulas já estavam corretas; só precisarão do fix em cascata).
