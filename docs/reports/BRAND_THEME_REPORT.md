# Report — GAPAI Mentorship rebrand + dark mode

**Date:** 2026-09-08

## Goal

Restyle the app to the GAPAI Mentorship brand (violet + logo yellow, "GAPAI
mentorship" wordmark) and add a proper dark mode.

## Changes

### Palette — `src/app/globals.css`
- Replaced the neutral grayscale shadcn tokens with a brand palette (oklch):
  `--primary` = brand violet (hue ~300), new `--brand` / `--brand-foreground` =
  the logo yellow (hue ~90), neutrals tinted violet, `--ring` = violet.
- The left sidebar tokens are a solid brand-violet panel in light mode
  (`--sidebar` deep violet, `--sidebar-foreground` near-white).
- Full `.dark` palette: near-black-violet background, dark cards, brighter violet
  primary for contrast, yellow accent unchanged.
- Added `--color-brand` / `--color-brand-foreground` to `@theme inline` so
  `text-brand` / `fill-brand` / `bg-brand` utilities exist.

### Dark mode
- `src/components/theme-toggle.tsx` — cycles light → dark → system, persists to
  `localStorage.theme` (removes the key for "system"), reacts to OS changes and
  cross-tab `storage` events via `useSyncExternalStore`.
- `src/app/layout.tsx` — inline pre-paint script sets `.dark` on `<html>` from
  `localStorage.theme` or `prefers-color-scheme` before React hydrates (no
  flash). `metadata.title` → "GAPAI Mentorship".
- Toggle placement: sidebar footer (app) and top-right of the auth /
  change-password screens.

### Wordmark
- `src/components/brand-mark.tsx` — yellow `Lightbulb` + "GAPAI mentorship";
  text inherits `currentColor` (works on the violet sidebar and on light pages),
  `textClassName` hides it in the collapsed sidebar / recolours it violet on
  auth pages.
- Applied in `app-shell.tsx` (sidebar header + top bar, replacing "Sales Quiz"),
  `(auth)/layout.tsx`, and `change-password/page.tsx` (replacing "Sales Training
  Quiz").

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 56 unit pass
- `npm run build` — passes
- `npm run test:e2e` — 12 pass (nav, route guards, no horizontal overflow at
  320 / 375 / 1280 px)
- Manual (Playwright): login + dashboard + Users, light and dark; wordmark,
  violet sidebar, purple primary button, theme toggle all render correctly and
  the theme persists across reloads.

## Notes

- No brand-guideline document was provided — the palette is derived from the
  logo image. Exact hex values can be tuned in `globals.css` (`:root` /
  `.dark`) without touching components.
- `docs/UI_UX_SPEC.md` gained a "Branding & theme" section.
