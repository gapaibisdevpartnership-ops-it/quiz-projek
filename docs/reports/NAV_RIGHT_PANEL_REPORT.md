# Change Report — Navigation as a left shadcn sidebar

**Date:** 2026-09-08
**Scope:** Layout/presentation only. No system logic, routing, or authorization changed.

## Goal

Move the primary navigation (Dashboard, Quizzes, Question Bank, Users, Teams,
Results, Grading, Analytics — and the sales set) into a panel on the **left**,
built with the project's UI stack: **Radix UI primitives + shadcn/ui conventions
+ Tailwind CSS**.

## Stack note

Tailwind v4 and the shadcn "new-york" setup (`components.json`, `src/components/ui/*`,
CSS-variable tokens) were already in place. What was missing were Radix
primitives — the existing UI components were Radix-free (`Select` was a native
`<select>`). This change adds Radix and the shadcn Sidebar block.

## What changed

### New dependencies
`@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-separator`,
`@radix-ui/react-tooltip`.

### New UI components (shadcn-style, in `src/components/ui/`)
- `sidebar.tsx` — `SidebarProvider` / `Sidebar` / `SidebarInset` / `SidebarHeader`
  / `SidebarContent` / `SidebarFooter` / `SidebarMenu` / `SidebarMenuButton`
  (tooltip when collapsed) / `SidebarTrigger` / `SidebarSeparator` / `useSidebar`.
  Collapsible to an icon rail on desktop, state persisted in a `sidebar_state`
  cookie, `Ctrl/Cmd+B` toggles it.
- `sheet.tsx` (Radix Dialog) — the mobile off-canvas drawer the sidebar uses
  below `md`.
- `separator.tsx`, `tooltip.tsx`, `skeleton.tsx`.
- `src/hooks/use-mobile.ts` — `useIsMobile()` via `useSyncExternalStore`.

### `src/app/globals.css`
Added the `--sidebar*` design tokens to `:root` and `.dark`, and the matching
`--color-sidebar*` entries in `@theme inline`.

### `src/components/app-shell.tsx` (rewritten)
- `SidebarProvider` → `Sidebar side="left" collapsible="icon"` + `SidebarInset`.
- Brand in `SidebarHeader`; nav rendered as `<nav aria-label="Main">` wrapping a
  `SidebarMenu` of `<Link>`s (each `SidebarMenuButton asChild`), with a lucide
  icon per route (`href → icon` map kept client-side so `nav.ts` stays plain RSC
  data); active state via `isActive` + `aria-current`.
- User/role line + **Sign out** form in `SidebarFooter`.
- A slim top bar in `SidebarInset` holds the `SidebarTrigger` (also the mobile
  hamburger). Content still `mx-auto max-w-6xl`.
- Unchanged: the `<nav>` landmark and `Sign out` button (used by E2E),
  `navForRole()`, `signOutAction`, every route target.

### `src/app/(app)/layout.tsx`
Reads the `sidebar_state` cookie and passes `defaultOpen` to `AppShell` so the
collapsed/expanded choice survives reloads without a flash.

### `src/components/ui/sidebar.tsx` — `SidebarInset` has `min-w-0`
Without it the `<main>` flex child keeps its content's min-content width and
overflows a narrow viewport by a few px.

### `tests/e2e/responsive.spec.ts`
`expectNoHorizontalScroll` now waits for `networkidle` and polls, because the
shell swaps between the desktop sidebar and the mobile drawer on the client
after mount.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 55 unit pass
- `npm run build` — passes
- `npm run test:e2e` — 12 pass (auth nav / sign-out, security route guards, and
  `responsive.spec.ts` at 320 / 375 / 1280 px with no horizontal overflow)
- Manual: left sidebar with icons + active highlight; collapses to an icon rail
  (tooltips on hover, state persisted); mobile shows a hamburger that opens the
  drawer; Sign out works.
