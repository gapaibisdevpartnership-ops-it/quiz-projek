# Plan — Super-admin-only permanent user deletion

**Status:** ✅ Implemented, migration applied to production, verified
end-to-end with disposable dummy accounts (cleaned up after) on
`feature/hard-delete-user`. Not yet merged to `main`.

## Verification results (2026-09-21)

Applied `20260921090000_hard_delete_user_prep.sql` to production (manual
`pg_dump` backup first). All 5 FK constraint names guessed from Postgres's
default naming convention were correct — applied cleanly on the first try.

All 4 planned checks verified live via Playwright against disposable dummy
accounts (never a real seed/QA account), cleaned up after:
1. **Sales account with an attempt**: hard-deleted as super_admin via the
   real UI (typed-email confirm flow) — profile, auth user, and the
   attempt all confirmed gone at the DB level; account can no longer sign
   in.
2. **Admin/trainer account that authored a question, created a quiz,
   assigned it, graded an essay, and generated a session link**:
   hard-deleted — **all 5 pieces of content survive** with attribution set
   to `null` (question, quiz, assignment, the graded essay answer with its
   `manual_score` intact, and the session link still `status: active`).
   Went further than the plan asked: opened the surviving session link's
   entry page live after the trainer was gone — it still works, zero
   errors, confirming the fix isn't just a surviving DB row but a
   genuinely still-usable link.
3. **Self-delete**: the Delete button is simply absent from the viewer's
   own row (UI-level), confirming that protection.
   **Last-active-super-admin**: on inspection this check is structurally
   unreachable independently of self-delete — since only a super_admin can
   call this action at all, the only caller who could ever hit "target is
   the last active super admin" is that same target (self-delete already
   blocks it first). Not a bug; the exact same relationship already exists
   in the shipped `admin_update_user` RPC. Kept as defense in depth,
   consistent with that existing pattern.
4. **Admin/trainer viewer**: confirmed zero "Delete permanently" buttons
   rendered anywhere on `/admin/users`, not even disabled ones.

`npm run lint/typecheck/test/build` all green throughout.

## Context

Today `/admin/users` only supports Activate/Deactivate (soft-delete) — no
hard-delete exists for any role. You want `super_admin` to gain the power
to permanently delete a user, while `admin`/trainer keeps only what it
already has (deactivate). Since hard-delete doesn't exist at all today,
restricting it to `super_admin` is achieved simply by **only** building it
for that role — nothing needs to be taken away from admin/trainer.

**Real schema gap found while planning, not optional**: `questions.created_by`,
`quizzes.created_by`, `quiz_assignments.assigned_by`, and
`attempt_answers.graded_by` are all `not null` FKs to `auth.users` with
**no `on delete` action** (Postgres default: block the delete outright).
`assessment_sessions.created_by` is `on delete cascade`. As-is, a
super_admin could never actually hard-delete any admin/trainer who has
created a question/quiz, assigned a quiz, or graded an essay (i.e. almost
any active trainer) — the delete would fail with a raw FK error. And
deleting a trainer would **cascade-delete every session link they ever
generated**, breaking live links real candidates might be using right now.
Both need fixing as part of this plan, not after.

## Design

### 1. Migration — preserve business data, only drop attribution
Change these 5 FKs to `on delete set null` (making the 3 `not null` columns
nullable first — deleted-user content becomes "unattributed", never
deleted):
- `questions.created_by`
- `quizzes.created_by`
- `quiz_assignments.assigned_by`
- `attempt_answers.graded_by` (already nullable, just needs the FK
  behavior changed from the default block)
- `assessment_sessions.created_by` (changed from `cascade` to `set null` —
  a trainer's live links must outlive their own account being deleted)

Pattern per column (verify each constraint's auto-generated name via
`information_schema.table_constraints` right before writing the final SQL,
rather than assuming):
```sql
alter table public.questions alter column created_by drop not null;
alter table public.questions drop constraint questions_created_by_fkey;
alter table public.questions add constraint questions_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;
```

`quiz_attempts.user_id` stays `on delete cascade` exactly as today — a
hard-deleted user's *own* attempt history disappearing with them is the
correct, expected meaning of "permanent delete" here (unlike content they
authored for other people).

### 2. Server action (no new RPC needed)
New `deleteUserPermanently(targetUserId: string)` in
`src/features/users/actions.ts`, reusing existing pieces:
- `requireSuperAdmin()` (`src/features/auth/service.ts`, already exists)
  gates the whole action — an `admin`/trainer caller is rejected before
  anything else runs.
- Reject `targetUserId === me.userId` ("You cannot delete your own
  account") — mirrors `CANNOT_DEACTIVATE_SELF` in `admin_update_user`
  (`supabase/migrations/20260908160000_admin_user_rpc.sql:101-108`).
- If the target is an active `super_admin`, count other active
  super_admins (`profiles` SELECT is already admin-readable via the
  `"profiles: admin reads all"` RLS policy — no service-role needed for
  this read); block with "There must be at least one active super admin"
  if it'd hit zero — mirrors `LAST_SUPER_ADMIN`
  (`supabase/migrations/20260908160000_admin_user_rpc.sql:111-120`).
- Call `createAdminClient().auth.admin.deleteUser(targetUserId)`
  (`src/lib/supabase/admin.ts`, the same service-role client `inviteUser`
  already uses) — this is a Supabase Auth API call, so it must be a server
  action, not a Postgres RPC. Cascades: `profiles` row (existing cascade),
  the user's own `quiz_attempts` (existing cascade, intentional). Sets
  null: anything they authored/assigned/graded/generated (migration
  above).
- `revalidatePath("/admin/users")`.

### 3. UI
- `src/app/(app)/admin/users/page.tsx`: call `requireProfile()` to get the
  viewer's own role, pass `viewerIsSuperAdmin` + `viewerId` to
  `UsersManager`.
- `src/features/users/users-manager.tsx`: a "Delete permanently" button per
  row, rendered **only** when `viewerIsSuperAdmin && u.userId !== viewerId`
  — admin/trainer viewers never see it at all, not even disabled. Clicking
  it reveals an inline confirm block — same reveal-in-place pattern already
  used for "Reset password" (`resettingId` state,
  `src/features/users/users-manager.tsx:197-204`): a warning explaining the
  content-survives/attempts-don't distinction, a text field where the admin
  must type the target's email exactly to enable the final button, and
  Cancel. New `deletingId` + `confirmEmail` state, mirroring the existing
  `resettingId`/`newPassword` pair.

### What does not change
- Deactivate/Activate stays exactly as it is today for every role that
  already has it.
- `admin_update_user()` RPC and its self-lockout / last-super-admin logic
  — untouched; this plan mirrors the same rules in TS for a different
  action, not by modifying that function.
- No changes to guest/session-link behavior beyond the one FK fix above.

## Verification
`npm run lint && npm run typecheck && npm test && npm run build`, then
manual with **throwaway dummy accounts only** (never a real seed/QA
account), cleaned up after:
1. Create a disposable sales account with one attempt; hard-delete it as
   super_admin; confirm the profile, auth user, and that attempt are gone,
   and the account can no longer sign in.
2. Create a disposable admin/trainer account, have it author one question
   and grade one essay, generate one session link from it; hard-delete the
   account; confirm the question, the grade, and the session link **all
   still exist** with attribution now null (this is the regression check
   for the FK fix — the live-link-survives case especially).
3. Confirm a super_admin cannot delete themself, and cannot delete the
   last remaining active super_admin.
4. Confirm an `admin`/trainer-role viewer never sees the Delete button on
   `/admin/users` at all.
