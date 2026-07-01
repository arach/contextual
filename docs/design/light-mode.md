# Light mode — "less stern" design language

Contextual's default look is a dark, deliberately *stern* instrument panel: near-black
backgrounds, hairline borders, low-chroma steel accent, mono type, tight density, sharp
corners. It reads as a flight-deck. This document defines a **light variant of the entire
app** that keeps the precision and the data-forward instrument feel but trades sternness for
warmth and breathing room.

Light mode is **opt-in**. Dark remains the default and is untouched. The theme is driven by
HudsonKit's existing theme machinery — `html[data-hudson-theme="light"]`, persisted under the
`contextual.theme` storage key — so the chrome (nav, panels, flag panel) already flips. The
work here is the **Contextual layer**: the `--ctx-*` design tokens and the `.ctx-*` / `.hg-*`
component classes that were hard-coded for dark.

## Principles ("less stern")

1. **Paper, not white.** Backgrounds are a warm off-white (`#faf9f6` paper, `#f3f1ec` tint),
   never pure `#fff`. Warmth (a few points of yellow/red in the neutral) is what makes light
   mode feel friendly rather than clinical.
2. **Soft ink, not black.** Body ink is a warm slate (`#2b2b30`-ish), headings a touch
   darker. No `#000`. This lowers contrast from "harsh" to "comfortable" while staying
   well above WCAG AA for body text.
3. **Elevation over hairlines.** Dark mode separates surfaces with 1px hairlines because
   everything is near-black. On paper, we lean on **gentle shadows** (the HudsonKit
   `--hud-shadow-*` light tokens already do this for chrome) and very soft warm-gray rules
   (`--ctx-line`) instead of hard lines. Borders get lighter and lower-contrast.
4. **Warmer, more saturated accent.** The dark steel-blue (`#8eb4d6`) is too pale to read on
   paper. Light mode uses a **deeper teal-leaning blue** (`#2f6f9e` / hover `#255a82`) that
   has enough chroma to anchor selection, active tabs, and primary actions against a light
   field, plus a soft tint (`--ctx-accent-tint`) for fills.
5. **More air.** Slightly larger corner radii (the `hg-btn` / pill 2–4px → 5–6px feel; we
   bump the radius tokens and round the welcome/tour cards a touch more) and softer hover
   states. Density stays instrument-grade — we don't change layout — but the *texture*
   loosens.
6. **Keep mono for data.** Monospace labels, token counts, and section eyebrows stay mono —
   that's the instrument DNA and it still reads as precise. We only soften the chrome
   *around* the data, not the data itself.
7. **Status colors re-tuned for light.** OK-green and warn-amber are darkened/saturated so
   they read as labels on paper rather than glowing on black. Bucket data-viz tints keep
   their hues but the viewer/strips sit on paper, so the same rgba fills read fine.

## Token mapping (dark → light)

All values below are set under `html[data-hudson-theme="light"]` in
`src/styles/contextual.css`. Because `--hg-*` are aliased to `--ctx-*`, overriding the
`--ctx-*` set cascades to every `--hg-*` consumer automatically.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--ctx-bg` | `#0c0c0e` | `#faf9f6` | app canvas — warm paper |
| `--ctx-bg-tint` | `#121215` | `#f3f1ec` | recessed strips / sub-bars |
| `--ctx-surface` | `#18181c` | `#ffffff` | cards, buttons, popovers (clean white lifts off paper) |
| `--ctx-surface-2` | `#1f1f24` | `#f6f4ef` | secondary surface |
| `--ctx-elevated` | `#26262c` | `#efece4` | elevated hover surface |
| `--ctx-ink` | `#ededf0` | `#26262b` | primary ink — warm slate, not black |
| `--ctx-ink-2` | `#c8c8d0` | `#42424a` | secondary ink |
| `--ctx-ink-3` | `#9898a6` | `#5e5e68` | body / lede text |
| `--ctx-muted` | `#6e6e7a` | `#7e7e88` | labels, mono eyebrows |
| `--ctx-dim` | `#54545e` | `#9a9aa2` | footnotes, counts |
| `--ctx-placeholder` | `#4a4a54` | `#a8a8b0` | placeholder |
| `--ctx-line` | `#2a2a32` | `#e4e1d9` | soft warm rules (lighter, lower contrast) |
| `--ctx-hairline` | `#36363f` | `#d4d0c6` | stronger rule / hover border |
| `--ctx-accent` | `#8eb4d6` | `#2f6f9e` | deeper, more saturated to read on paper |
| `--ctx-accent-deep` | `#6a96bc` | `#255a82` | hover / pressed accent |
| `--ctx-accent-tint` | 14% | 12% mix | selection / active fill |
| `--ctx-accent-line` | 38% | 42% mix | accent borders |
| `--ctx-warn` | `#d4a574` | `#b5742a` | amber, darkened for paper |
| `--ctx-ok` | `#72c19a` | `#2f8f63` | green, darkened for paper |
| `--ctx-primary` | `#e8e8ec` | `#26262b` | primary-button fill (ink on paper inverts) |
| `--ctx-primary-fg` | `#0c0c0e` | `#faf9f6` | primary-button text |

### Hard-coded surfaces that don't ride the tokens

A handful of components hard-coded charcoals or dark-tuned shadows. These get explicit light
overrides in `contextual.css` (scoped to `[data-hudson-theme="light"]`) plus a small set of
`--ctx-viewer-bg` / `--ctx-viewer-bar` tokens so the conversation/context **viewer** flips:

- `ContextViewer` panel `#0d1114` / bar `#101518` → `--ctx-viewer-bg` / `--ctx-viewer-bar`.
- `SessionAnalysis` cards `#080b0d` → `--ctx-card-inset`.
- Popover/modal drop-shadows (`rgba(0,0,0,.7)` etc.) are softened via a
  `--ctx-pop-shadow` token consumed in light mode.
- `bg-black/30..70` scrims (tree modal backdrop, code insets) are intentionally left as a
  translucent dark scrim — a dim layer behind a modal reads correctly in both themes.

### Tailwind neutrals

Tailwind v4 in this build compiles neutral utilities to **live** `var(--color-neutral-*)`
references (verified: `.text-neutral-500{color:var(--color-neutral-500)}`). So redefining the
`--color-neutral-*` scale under `[data-hudson-theme="light"]` flips every `text-neutral-*` /
`bg-neutral-*` utility at runtime. We invert the scale (50↔950) to warm light values.

## Toggle

A sun/moon toggle is added to the header cluster (`HeaderActions.tsx`), calling HudsonKit's
`useTheme().setTheme('light' | 'dark')`. The choice persists to `contextual.theme` via the
existing `ThemeProvider`, and the pre-paint theme script applies it before first paint so
there's no flash. You can also force it per-load with `?theme=light` / `?theme=dark`.
