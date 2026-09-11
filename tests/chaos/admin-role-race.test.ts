import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, serviceClient, signInAs } from "../helpers/supabase";
import { SEED_PASSWORD, SEED_USERS } from "../helpers/seed";

/**
 * Chaos — Layer 1 (server), scenario #7 (docs/CHAOS_TESTING_PLAN.md),
 * narrowed for safety.
 *
 * The plan's original framing ("two concurrent admin_update_user calls both
 * demoting the last two super_admins") can't be tested safely here: the only
 * way to reach the true "last super_admin" edge is to demote the seeded
 * `superadmin.qa` account itself, which every other integration/e2e suite
 * depends on staying a super_admin. Doing that against the shared project
 * risks leaving zero super_admins if the test fails to clean up.
 *
 * Instead this tests the authorization gate itself under concurrency: many
 * simultaneous attempts by a non-super_admin to grant `super_admin` (to
 * different targets) must ALL be rejected — no TOCTOU window where a burst of
 * concurrent calls slips one through before the others are checked.
 */

const d = hasSupabaseEnv ? describe : describe.skip;
const CONCURRENCY = 10;

d("chaos: admin_update_user authorization under concurrency", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let trainer: SupabaseClient;
  const throwawayIds: string[] = [];

  beforeAll(async () => {
    trainer = await signInAs(SEED_USERS.trainer.email);

    for (let i = 0; i < CONCURRENCY; i++) {
      const created = await svc.auth.admin.createUser({
        email: `chaos-role-target-${Date.now()}-${i}@example.com`,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: `Chaos Target ${i}` },
      });
      throwawayIds.push(created.data.user!.id);
    }
  });

  afterAll(async () => {
    for (const id of throwawayIds) {
      await svc.auth.admin.deleteUser(id);
    }
    await trainer?.auth.signOut();
  });

  it("a burst of concurrent grant attempts by a plain admin is rejected every time", async () => {
    const results = await Promise.all(
      throwawayIds.map((id) =>
        trainer.rpc("admin_update_user", {
          target_user_id: id,
          new_full_name: "Chaos Target",
          new_role: "super_admin",
          new_status: "active",
        }),
      ),
    );

    for (const r of results) {
      expect(r.error).not.toBeNull();
      expect(r.error!.message).toMatch(/SUPER_ADMIN_REQUIRED/);
    }

    const { data: profiles } = await svc
      .from("profiles")
      .select("role")
      .in("user_id", throwawayIds);
    expect(profiles!.every((p) => p.role === "sales")).toBe(true);
  });
});
