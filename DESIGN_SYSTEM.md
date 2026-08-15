# FeasibilityAI — Design System ("Ledger")

> Redesign driven by the **ui-ux-pro-max** priority rules (the skill's search tool/database
> is not installed on this machine, so specifics below are the skill's documented fallback
> defaults + design judgment, not database matches). Priority order 1→10 followed.

## Product frame
- **Type:** analytical decision-support SaaS (feasibility analysis / business intelligence).
- **Audience:** founders, consultants, accelerators, lenders — people making a GO/NO-GO call.
- **Voice:** trustworthy, precise, editorial. "An analyst's report," not a chatbot reply.

## Direction: "Ledger"
Light-first, warm **paper** aesthetic (a feasibility *report* should feel like one) with a real
dark mode. Serif display for authority + monospace numerals for data credibility.

## Tokens

### Color (semantic, CSS variables — never raw hex in components)
Light (default): warm ivory paper, ink near-black, cobalt brand.
Dark: warm charcoal (not blue-black), lifted cobalt.
Semantic score trio is fixed across the app: **go = emerald, warn = amber, stop = rose**
(GO / conditional / NO-GO). Brand cobalt is deliberately non-green so it never reads as a score.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper (bg) | #F8F6F1 | #141311 | app background |
| surface | #FFFFFF | #1C1A17 | cards |
| surface-2 | #F1EEE7 | #24211D | insets, wells |
| border | #E4DFD4 | #34302A | hairlines |
| ink | #1A1814 | #F0EDE6 | primary text |
| muted | #5C5648 | #A8A196 | secondary text |
| brand | #264DF0 | #7A92FF | CTA, links, focus |
| go / warn / stop | #0E9F6E / #D97706 / #DC2626 | lifted | score semantics |

### Typography (Priority 6)
- **Display / headings:** Fraunces (variable serif) — `--font-serif`.
- **UI / body:** Inter — `--font-sans`. Base 16px, line-height 1.5.
- **Numbers / scores / data:** JetBrains Mono — `--font-mono` (tabular).

### Icons (Priority 4 — NO emoji)
Inline-SVG line icons only (`components/icons.tsx`), 1.75 stroke, `currentColor`.
The six dimensions each get a real glyph (market, financial, technical, competitive, location, risk).

### Motion (Priority 7)
Purposeful only; 150–500ms; `prefers-reduced-motion` disables transforms. Gauge + score bars ease in.

### Accessibility (Priority 1–2)
4.5:1 text contrast both themes · visible `:focus-visible` ring · 44px min touch targets ·
icon-only controls carry `aria-label` · decorative SVGs `aria-hidden`.

## Anti-patterns explicitly avoided
Emoji icons · removed focus rings · hover-only affordances · gray-on-gray · raw hex in components ·
one duration for all motion · placeholder-as-label.
