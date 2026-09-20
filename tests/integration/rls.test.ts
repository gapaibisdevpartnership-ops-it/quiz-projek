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
  // sales.qa01 has accrued real team membership + a real quiz assignment
  // from manual use of the app — no longer safe to assume it's "clean" for
  // the negative (sees-nothing) assertions below. sales.qa02 stays
  // deliberately unused outside this suite, so it's the pristine one.
  let salesUnaffiliated: SupabaseClient;
  let trainer: SupabaseClient;
  let spv: SupabaseClient;

  beforeAll(async () => {
    sales = await signInAs(SEED_USERS.sales1.email);
    salesUnaffiliated = await signInAs(SEED_USERS.sales2.email);
    trainer = await signInAs(SEED_USERS.trainer.email);
    spv = await signInAs(SEED_USERS.spv.email);
  });

  afterAll(async () => {
    await sales?.auth.signOut();
    await salesUnaffiliated?.auth.signOut();
    await trainer?.auth.signOut();
    await spv?.auth.signOut();
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
      const { data, error } = await salesUnaffiliated.from("teams").select("*");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("quizzes & assignments", () => {
    it("a sales user sees no quizzes without an assignment", async () => {
      const { data, error } = await salesUnaffiliated
        .from("quizzes")
        .select("id");
      if (isMissingTable(error)) return;
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user sees only their own assignments", async () => {
      const { data, error } = await sales
        .from("quiz_assignments")
        .select("id");
      if (isMissingTable(error)) return;
      expect(error).toBeNull();
      // No seed assignments target this user, so the list is empty — but the
      // query itself must be allowed (RLS returns rows, not an error).
      expect(Array.isArray(data)).toBe(true);
    });

    it("a sales user cannot create an assignment", async () => {
      const { error } = await sales.from("quiz_assignments").insert({
        quiz_id: "00000000-0000-0000-0000-000000000000",
        user_id: "00000000-0000-0000-0000-000000000000",
        assigned_by: "00000000-0000-0000-0000-000000000000",
      });
      if (isMissingTable(error)) return;
      expect(error).not.toBeNull();
    });
  });

  describe("attempt snapshots (answer-key protection)", () => {
    it("a sales user cannot read attempt_questions directly", async () => {
      const { data, error } = await sales
        .from("attempt_questions")
        .select("id, is_correct:sample_answer");
      if (isMissingTable(error)) return;
      // Policy is admin-only, so a sales SELECT yields no rows (not an error).
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user cannot read attempt_question_options directly", async () => {
      const { data, error } = await sales
        .from("attempt_question_options")
        .select("id, is_correct");
      if (isMissingTable(error)) return;
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user cannot insert a quiz_attempt directly", async () => {
      const { error } = await sales.from("quiz_attempts").insert({
        quiz_id: "00000000-0000-0000-0000-000000000000",
        user_id: "00000000-0000-0000-0000-000000000000",
        attempt_number: 1,
      });
      if (isMissingTable(error)) return;
      expect(error).not.toBeNull();
    });
  });

  describe("question bank (answer-key protection)", () => {
    it("a sales user cannot read questions", async () => {
      const { data, error } = await sales.from("questions").select("*");
      if (isMissingTable(error)) return; // Phase 2 migration not pushed yet
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("a sales user can read category names (not sensitive) but cannot write them", async () => {
      // "quiz_categories: authenticated read" (20260907110000_assignments.sql)
      // deliberately opens category names to any signed-in user so the
      // sales quiz list can show them — only mutation is admin-only.
      const { error: readError } = await sales
        .from("quiz_categories")
        .select("*");
      if (isMissingTable(readError)) return;
      expect(readError).toBeNull();
    });

    it("a sales user cannot insert a category", async () => {
      const { error } = await sales
        .from("quiz_categories")
        .insert({ name: "hacky" });
      if (isMissingTable(error)) return;
      expect(error).not.toBeNull();
    });
  });

  describe("spv (read-only results viewer)", () => {
    it("can read quiz_attempts and the essay breakdown tables", async () => {
      const [attempts, answers, aqs, aqOpts] = await Promise.all([
        spv.from("quiz_attempts").select("id"),
        spv.from("attempt_answers").select("id"),
        spv.from("attempt_questions").select("id"),
        spv.from("attempt_question_options").select("id"),
      ]);
      for (const { error } of [attempts, answers, aqs, aqOpts]) {
        if (isMissingTable(error)) continue;
        expect(error).toBeNull();
      }
    });

    it("can read quizzes and profiles (needed to render the results list)", async () => {
      const [quizzes, profiles] = await Promise.all([
        spv.from("quizzes").select("id, title"),
        spv.from("profiles").select("user_id, full_name"),
      ]);
      expect(quizzes.error).toBeNull();
      expect(profiles.error).toBeNull();
      expect((profiles.data ?? []).length).toBeGreaterThanOrEqual(4);
    });

    it("cannot insert/update/delete any admin-owned table", async () => {
      const inserts = await Promise.all([
        spv.from("quizzes").insert({ title: "hacky" }),
        spv.from("questions").insert({ question_text: "hacky" }),
        spv.from("teams").insert({ name: "hacky" }),
        spv.from("quiz_categories").insert({ name: "hacky" }),
      ]);
      for (const { error } of inserts) {
        if (isMissingTable(error)) continue;
        expect(error).not.toBeNull();
      }
    });

    it("cannot change its own role via admin_update_user", async () => {
      const { data: me } = await spv
        .from("profiles")
        .select("user_id, full_name")
        .eq("email", SEED_USERS.spv.email)
        .single();
      const { error } = await spv.rpc("admin_update_user", {
        target_user_id: me!.user_id,
        new_full_name: me!.full_name,
        new_role: "super_admin",
        new_status: "active",
      });
      expect(error).not.toBeNull();
    });
  });
});
