# Plano: Adotar o design system do `DESIGN.md` (estilo Claude/Anthropic) no Cotação IBOV

## Decisões confirmadas
1. **Semântica verde/vermelho** mantida (positive/negative financeira) — só `emerald-500` deixa de ser o accent de marca
2. **Navbar com dropdowns** preservada, com chrome cremoso
3. **Sem `spacing.section` (96px) entre bandas** em páginas de dados — ritmo só dentro de componentes
4. **Todas as tabelas em cream** (`surface-card` + `hairline`) — `surface-dark` fica reservado para mockups de produto (não usado aqui)
5. **Sistema completo de tokens + biblioteca de componentes** (não é só re-skin)

## Stack constraints verificadas no Next.js 16
- `next/font/google` aceita `Cormorant_Garamond`, `Inter`, `JetBrains_Mono` (underscore para nomes com espaço)
- Tailwind 4 (`@tailwindcss/postcss`) — config 100% no CSS, sem `tailwind.config.js`
- Tokens via `@theme { --color-X: hex; --font-X: var(--font-NAME), fallback; }`
- CSS vars de `next/font` aplicadas em `<html className={X.variable}>` e referenciadas em `@theme`
- Substitutos abertos do DESIGN.md: Cormorant Garamond 500 (display), Inter (body), JetBrains Mono (code)

---

## Etapa 1 — Sistema de tokens (`src/app/globals.css`)

**Arquivo:** `src/app/globals.css` (substituir inteiro)

- `@import "tailwindcss"`
- `@theme { ... }` com todas as CSS vars (cores, radius, fontes via `var(--font-*)`)
- Reset: `html, body` → `bg-canvas text-ink font-sans`
- Remove o `@media (prefers-color-scheme: dark)` — sem dark mode
- Ajusta `.select-standard` para tema claro (chevron em `#6c6a64`)
- Para 96px (`spacing.section`): usar `py-24` do Tailwind 4 (default = 6rem = 96px)

CSS vars em `@theme` (Tailwind 4 gera `bg-canvas`, `text-ink`, `border-hairline`, `rounded-md` etc.):

```css
--color-canvas, --color-surface-soft, --color-surface-card, --color-surface-cream-strong,
--color-hairline, --color-hairline-soft,
--color-ink, --color-body, --color-body-strong, --color-muted, --color-muted-soft,
--color-primary, --color-primary-active, --color-primary-disabled, --color-on-primary,
--color-on-dark, --color-on-dark-soft, --color-surface-dark, --color-surface-dark-elev,
--color-surface-dark-soft,
--color-accent-teal, --color-accent-amber, --color-success, --color-warning, --color-error;

--font-display: var(--font-cormorant), "Tiempos Headline", "Times New Roman", serif;
--font-sans:    var(--font-inter), "StyreneB", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono:    var(--font-jetbrains), ui-monospace, "JetBrains Mono", monospace;

--radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
--radius-xl: 16px; --radius-pill: 9999px; --radius-full: 9999px;
```

## Etapa 2 — Fontes no `layout.tsx`

Substituir `Geist` + `Geist_Mono` por:
- `Cormorant_Garamond` weight `500` (display serif)
- `Inter` (body sans)
- `JetBrains_Mono` (code)

Aplicar `.variable` de todas três no `<html className={...}>`. Remover `bg-gray-950 text-white` do `<body>`. Atualizar o card de erro de DB para `bg-surface-card border-error text-ink`.

## Etapa 3 — Biblioteca de componentes (`src/components/ui/`)

| Arquivo | Conteúdo |
|---|---|
| `Button.tsx` | Variantes: `primary`, `primary-active`, `primary-disabled`, `secondary`, `secondary-on-dark`, `text-link`, `icon-circular`, `danger` (red-600 com cream text) |
| `Card.tsx` | Variantes: `feature` (cream + radius-lg + p-8), `product-mockup-dark` (surface-dark + on-dark), `code-window`, `callout-coral` (primary + p-12). Compound: `CardHeader`, `CardBody`, `CardFooter` |
| `Badge.tsx` | `Badge` para tags estáticas. `StatusBadge` separado para semântica financeira (success/warning/error) |
| `TextInput.tsx` | Estado padrão + `focused` (border primary + ring 3px primary/15%). Aceita `as="textarea"` para textareas de cadastro |
| `CategoryTab.tsx` | Pills horizontais para filtro de tipo de ativo. Substitui o `<select>` das listagens |
| `HeroBand.tsx` | `bg-canvas` + grid 6/6 + h1 em font-display + lead |
| `CalloutCard.tsx` | `bg-primary text-on-primary rounded-lg p-12` |
| `StatusBanner.tsx` | Variantes: `error`, `success`, `warning` (substitui os boxes `bg-red-900/40`) |
| `ProgressBar.tsx` | Para `/cache`: `bg-hairline rounded-full h-2` + fill primary/success/error |
| `Modal.tsx` | Para confirmações de delete: `bg-canvas rounded-lg p-6` + backdrop `bg-ink/40` |
| `Footer.tsx` | `bg-surface-dark text-on-dark-soft py-16`, 4 colunas (Produto/Empresa/Recursos/Legal) |
| `SpikeMark.tsx` | Inline SVG do 4-spoke radial usado como wordmark |
| `typography.tsx` | Açúcar: `<H1>`, `<H2>`, `<Lead>`, `<Body>`, `<Mono>`, `<Caption>` aplicando tokens do DESIGN.md |

## Etapa 4 — Refatorar `Navbar.tsx`

Manter a estrutura de itens e os dropdowns (decisão 2). Mudanças:
- `bg-canvas border-b border-hairline` (era `bg-gray-900 border-gray-800`)
- Altura `h-16` (64px)
- Logo: `<SpikeMark />` + wordmark "Cotação" em `text-ink` e "IBOV" em `text-primary`
- Itens: `text-body hover:text-ink`; ativo: `bg-surface-card text-ink`
- Dropdown panel: `bg-canvas border-hairline rounded-lg shadow-sm`
- Botão coral "Nova Cotação" no canto direito (link `/`)

## Etapa 5 — Footer no layout

`layout.tsx`: adicionar `<Footer />` após `<div className="flex-1 flex flex-col">{children}</div>`.

## Etapa 6 — Re-skin das 7 páginas

Cada página recebe:
- H1 em `font-display text-display-sm` (28px, 500, leading-tight)
- Botões via `<Button>`
- Inputs via `<TextInput>`
- Status banners via `<StatusBanner>`
- Cards de tabela via `<Card variant="feature">` com `divide-hairline`
- Status de cadastro (novo/duplicata/erro) via `<StatusBadge>` (success/warning/error)

| Página | Mudanças específicas |
|---|---|
| `src/app/page.tsx` | HeroBand 6/6: h1 + form à esquerda, Card com cotação demo à direita |
| `cadastro-ativos/page.tsx` | Textarea via `<TextInput as="textarea">`, badges de preview via `<StatusBadge>` |
| `cadastro-aportes/page.tsx` | Mesmo padrão |
| `listagem-ativos/page.tsx` | `<select>` de tipo → `<CategoryTab>`; modal de delete → `<Modal>` |
| `listagem-aportes/page.tsx` | Mesmo padrão |
| `cache/page.tsx` | Cards de job → `<Card variant="feature">`; progress bar → `<ProgressBar>` |
| `total-assets/[category]/page.tsx` | Tabela → `<Card variant="feature">` com `divide-hairline` |
| `layout.tsx` (error DB) | `bg-surface-card border-error text-ink` |

## Etapa 7 — Cleanup + verify

- Atualizar `.cursor/rules/project-conventions.mdc` (paleta nova)
- `grep -r "gray-\|emerald-\|red-9\|amber-" src/` → 0 matches legítimos
- `npm run lint` → 0 erros
- `npm run build` → sucesso

---

## Arquivos a criar

```
src/components/ui/
├── Button.tsx
├── Card.tsx
├── Badge.tsx
├── StatusBadge.tsx
├── TextInput.tsx
├── CategoryTab.tsx
├── HeroBand.tsx
├── CalloutCard.tsx
├── StatusBanner.tsx
├── ProgressBar.tsx
├── Modal.tsx
├── Footer.tsx
├── SpikeMark.tsx
└── typography.tsx
```

## Arquivos a modificar

```
src/app/globals.css                          (reescrito)
src/app/layout.tsx                           (fontes + body + footer + error card)
src/app/page.tsx                             (hero band + re-skin)
src/app/cadastro-ativos/page.tsx
src/app/cadastro-aportes/page.tsx
src/app/listagem-ativos/page.tsx
src/app/listagem-aportes/page.tsx
src/app/cache/page.tsx
src/app/total-assets/[category]/page.tsx
.cursor/rules/project-conventions.mdc        (paleta para cream/coral)
```

## Arquivos NÃO tocados

```
src/app/api/**, src/lib/**, src/types/**, scripts/**, db/**
postcss.config.mjs, next.config.ts, tsconfig.json
```

---

## Critérios de aceitação

- [ ] `npm run lint` passa
- [ ] `npm run build` passa
- [ ] Nenhuma string `gray-`, `emerald-`, `red-9`, `amber-` em `src/app/**` ou `src/components/**`
- [ ] Todas as 7 páginas renderizam no tema cream
- [ ] Navbar mantém os 3 menus com dropdown + botão coral "Nova Cotação"
- [ ] Footer aparece no fim de todas as páginas em `surface-dark`
- [ ] Headlines em display serif (Cormorant Garamond 500), body em Inter, código em JetBrains Mono
- [ ] Status badges nos cadastros: verde (novo), âmbar (duplicata lote), vermelho (duplicata banco)
