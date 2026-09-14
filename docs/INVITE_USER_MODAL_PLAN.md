# Plan — Invite User as a button + modal

**Status:** ✅ Implemented (2026-09-14) on `feature/invite-user-modal`
(`bbf1db7`). Not merged, not pushed. Kept below for the design reasoning.

## Why

`/admin/users` showed the "Invite a user" form as a `Card` that was always
expanded above the user list. Inviting a user is an infrequent action, but
the always-open form permanently pushed the (far more frequently used) user
list down and wasted space, especially on mobile. The Question Bank had the
same problem with its question-creation form and already moved to a
button-triggered flow ("+ New question" → new page); this applies the same
idea to Users, but as a modal instead of a page since invite is a small,
self-contained form.

## Behavior

A **"+ Invite User"** button next to the "Users" heading opens a modal
containing the same 4 fields as before (Name, Email, Role, Temporary
password) and the same `inviteUser()` action — no validation or backend
logic changed.

- **On success:** the modal stays open (does not auto-close) and shows the
  success message — "Give them the temporary password — they must change it
  on first sign-in" — with a **"Done"** button. This is deliberate: the
  temporary password is one-time information the admin must actually
  communicate to the new user, so nothing should be able to accidentally
  dismiss that message before they've read it. Esc / overlay-click / the
  corner **X** still close the modal early if the admin dismisses it on
  purpose — same risk as before, where nothing forced them to read it either.
- **On error:** the modal stays open, the error shows inline, the admin can
  retry without reopening.
- Reopening after a completed invite starts with an empty form (unchanged
  behavior — the form was already reset on success).

## Implementation

- New `src/components/ui/dialog.tsx` — a standard shadcn-style centered
  `Dialog` built on `@radix-ui/react-dialog`. That package was **already a
  dependency** (it's what `src/components/ui/sheet.tsx` is built on, styled
  as a side panel instead of centered) — no new dependency added. Same
  structural pattern as `sheet.tsx` (Root/Trigger/Portal/Overlay/Content/
  Close, `forwardRef`, `cn()`), just centered-modal styling instead of a
  slide-in panel. This is a shared, reusable component — not Users-specific.
- `src/features/users/users-manager.tsx` — wraps the existing form in
  `Dialog`/`DialogContent` gated behind the new button and an `inviteOpen`
  state; `invite()`'s logic is untouched. The page's `<h1>Users</h1>` moved
  from `page.tsx` into this client component, since the trigger button next
  to it needs client-side `onClick` state that a server component can't
  hold.
- `src/app/(app)/admin/users/page.tsx` simplified to just render
  `<UsersManager users={users} />`.

## What didn't change

- `inviteUser()`, validation, and the temp-password flow in
  `src/features/users/actions.ts`.
- The user list, role `Select`, Activate/Deactivate, and the inline
  "Reset password" row — not part of this change.
- No RLS or migration change — purely a client-side UI reorganization plus
  one new shared `ui/dialog.tsx` component.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (63 pass), `npm run build`
all clean. Manual, via Playwright against `npm run dev`:

- Form hidden by default; "+ Invite User" button visible next to the
  heading.
- Click → modal opens with an empty form.
- Duplicate-email submission → inline error inside the modal, modal stays
  open (verified: "Could not create the account." shown, dialog still
  visible).
- Valid submission → modal stays open, success message + temp-password
  reminder shown, "Done" button appears; clicking it closes the modal and
  clears the form. New user visible in the list after refresh.
- Reopening the modal shows an empty form again.
- Esc closes the modal.
- No horizontal overflow at 375px width (screenshot confirmed the form
  fits and is usable on a small screen).
- Test data (the invited throwaway account) cleaned up afterward via the
  Supabase service-role client.
