import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  hasSupabaseEnv,
  isMissingTable,
  signInAs,
} from "../helpers/supabase";
import { SEED_USERS } from "../helpers/seed";

const d = hasSupabaseEnv ? describe : describe.skip;

d("RLS baseline (docs/SECURITY_RLS.md)", () => {
  let sales: SupabaseClient;
  let trainer: SupabaseClient;

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    trainer = await signInAs(SEED_USERS.trainer.email);
  });

  afterAll(async () => {
    await sales?.auth.signOut();
    await trainer?.auth.signOut();
  });

  describe("profiles", () => {
    it("unauthenticated reads return nothing", async () => {
      const { data, error } = await anonClient().from("profiles").select("*");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user sees only their own profile", async () => {
      const { data, error } = await sales.from("profiles").select("email,role");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].email).toBe(SEED_USERS.sales1.email);
      expect(data![0].role).toBe("sales");
    });

    it("an admin sees every profile", async () => {
      const { data, error } = await trainer.from("profiles").select("id");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(4);
    });

    it("a sales user cannot change their own role", async () => {
      const { error } = await sales
        .from("profiles")
        .update({ role: "admin" })
        .eq("email", SEED_USERS.sales1.email);
      // Either blocked outright, or the row is not visible to UPDATE → no-op.
      const { data } = await sales.from("profiles").select("role").single();
      expect(data?.role).toBe("sales");
      void error;
    });
  });

  describe("teams", () => {
    it("a sales user with no membership reads no teams", async () => {
      const { data, error } = await sales.from("teams").select("*");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("question bank (answer-key protection)", () => {
    it("a sales user cannot read questions", async () => {
      const { data, error } = await sales.from("questions").select("*");
      if (isMissingTable(error)) return; // Phase 2 migration not pushed yet
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user cannot read quiz_categories", async () => {
      const { data, error } = await sales.from("quiz_categories").select("*");
      if (isMissingTable(error)) return;
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user cannot insert a category", async () => {
      const { error } = await sales
        .from("quiz_categories")
        .insert({ name: "hacky" });
      if (isMissingTable(error)) return;
      expect(error).not.toBeNull();
    });
  });
});
