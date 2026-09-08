import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  hasSupabaseEnv,
  serviceClient,
  signInAs,
} from "../helpers/supabase";
import { SEED_PASSWORD, SEED_USERS } from "../helpers/seed";

/**
 * P0 hardening — user administration
 * (supabase/migrations/20260908160000_admin_user_rpc.sql,
 * docs/IMPROVEMENT_BACKLOG.md P0 #1–3) + Opsi A password management
 * (20260908180000_must_change_password.sql).
 */

const d = hasSupabaseEnv ? describe : describe.skip;

d("admin user administration security", () => {
  const svc = hasSupabaseEnv ? serviceClient() : (null as never);
  let trainer: SupabaseClient;
  let superAdmin: SupabaseClient;

  const throwaway = {
    email: `p0-target-${Date.now()}@example.com`,
    id: "",
  };
  let trainerId = "";

  async function profileId(email: string) {
    const { data } = await svc
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();
    return data!.user_id as string;
  }

  beforeAll(async () => {
    trainer = await signInAs(SEED_USERS.trainer.email);
    superAdmin = await signInAs(SEED_USERS.superAdmin.email);
    trainerId = await profileId(SEED_USERS.trainer.email);

    const created = await svc.auth.admin.createUser({
      email: throwaway.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "P0 Target", role: "super_admin" },
    });
    throwaway.id = created.data.user!.id;
  });

  afterAll(async () => {
    if (throwaway.id) await svc.auth.admin.deleteUser(throwaway.id);
    await trainer?.auth.signOut();
    await superAdmin?.auth.signOut();
  });

  it("handle_new_user ignores a super_admin role in auth metadata", async () => {
    const { data } = await svc
      .from("profiles")
      .select("role, status")
      .eq("user_id", throwaway.id)
      .single();
    expect(data!.role).toBe("sales");
    expect(data!.status).toBe("active");
  });

  it("an admin cannot escalate their own role via a direct PostgREST write", async () => {
    await trainer
      .from("profiles")
      .update({ role: "super_admin" })
      .eq("user_id", trainerId);
    const { data } = await svc
      .from("profiles")
      .select("role")
      .eq("user_id", trainerId)
      .single();
    expect(data!.role).toBe("admin");
  });

  it("an admin cannot change another user's role via a direct PostgREST write", async () => {
    await trainer
      .from("profiles")
      .update({ role: "admin", status: "inactive" })
      .eq("user_id", throwaway.id);
    const { data } = await svc
      .from("profiles")
      .select("role, status")
      .eq("user_id", throwaway.id)
      .single();
    expect(data!.role).toBe("sales");
    expect(data!.status).toBe("active");
  });

  it("an admin cannot grant super_admin through admin_update_user", async () => {
    const { error } = await trainer.rpc("admin_update_user", {
      target_user_id: throwaway.id,
      new_full_name: "P0 Target",
      new_role: "super_admin",
      new_status: "active",
    });
    expect(error?.message).toMatch(/SUPER_ADMIN_REQUIRED/);
  });

  it("an admin cannot modify an existing super_admin", async () => {
    const superAdminId = await profileId(SEED_USERS.superAdmin.email);
    const { error } = await trainer.rpc("admin_update_user", {
      target_user_id: superAdminId,
      new_full_name: "x",
      new_role: "admin",
      new_status: "active",
    });
    expect(error?.message).toMatch(/SUPER_ADMIN_REQUIRED/);
  });

  it("an admin cannot deactivate their own account", async () => {
    const { error } = await trainer.rpc("admin_update_user", {
      target_user_id: trainerId,
      new_full_name: "Trainer QA",
      new_role: "admin",
      new_status: "inactive",
    });
    expect(error?.message).toMatch(/CANNOT_DEACTIVATE_SELF/);
  });

  it("an admin CAN edit a normal user's name and status via the RPC", async () => {
    const { error } = await trainer.rpc("admin_update_user", {
      target_user_id: throwaway.id,
      new_full_name: "P0 Renamed",
      new_role: "admin",
      new_status: "inactive",
    });
    expect(error).toBeNull();
    const { data } = await svc
      .from("profiles")
      .select("full_name, role, status")
      .eq("user_id", throwaway.id)
      .single();
    expect(data!.full_name).toBe("P0 Renamed");
    expect(data!.role).toBe("admin");
    expect(data!.status).toBe("inactive");
  });

  it("a super_admin CAN promote and demote around super_admin", async () => {
    const up = await superAdmin.rpc("admin_update_user", {
      target_user_id: throwaway.id,
      new_full_name: "P0 Renamed",
      new_role: "super_admin",
      new_status: "active",
    });
    expect(up.error).toBeNull();
    let { data } = await svc
      .from("profiles")
      .select("role")
      .eq("user_id", throwaway.id)
      .single();
    expect(data!.role).toBe("super_admin");

    const down = await superAdmin.rpc("admin_update_user", {
      target_user_id: throwaway.id,
      new_full_name: "P0 Renamed",
      new_role: "sales",
      new_status: "active",
    });
    expect(down.error).toBeNull();
    ({ data } = await svc
      .from("profiles")
      .select("role")
      .eq("user_id", throwaway.id)
      .single());
    expect(data!.role).toBe("sales");
  });

  it("a super_admin cannot demote their own account", async () => {
    const superAdminId = await profileId(SEED_USERS.superAdmin.email);
    const { error } = await superAdmin.rpc("admin_update_user", {
      target_user_id: superAdminId,
      new_full_name: "Super Admin QA",
      new_role: "sales",
      new_status: "active",
    });
    expect(error?.message).toMatch(/CANNOT_DEMOTE_SELF/);
  });

  it("clear_must_change_password only clears the caller's own flag", async () => {
    // Flag the throwaway user and the trainer.
    await svc
      .from("profiles")
      .update({ must_change_password: true })
      .in("email", [throwaway.email, SEED_USERS.trainer.email]);

    // The trainer clears theirs — the throwaway's stays set.
    const cleared = await trainer.rpc("clear_must_change_password");
    expect(cleared.error).toBeNull();

    const { data } = await svc
      .from("profiles")
      .select("email, must_change_password")
      .in("email", [throwaway.email, SEED_USERS.trainer.email]);
    const byEmail = Object.fromEntries(
      data!.map((r) => [r.email, r.must_change_password]),
    );
    expect(byEmail[SEED_USERS.trainer.email]).toBe(false);
    expect(byEmail[throwaway.email]).toBe(true);

    // The throwaway user clears their own.
    const asUser = anonClient();
    await asUser.auth.signInWithPassword({
      email: throwaway.email,
      password: SEED_PASSWORD,
    });
    const selfClear = await asUser.rpc("clear_must_change_password");
    expect(selfClear.error).toBeNull();
    await asUser.auth.signOut();

    const { data: after } = await svc
      .from("profiles")
      .select("must_change_password")
      .eq("email", throwaway.email)
      .single();
    expect(after!.must_change_password).toBe(false);
  });
});
