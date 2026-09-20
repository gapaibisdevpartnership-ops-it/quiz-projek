/**
 * Deterministic QA users. Created via the Supabase Admin API; see
 * docs/reports/TESTING_SETUP_REPORT.md for how to (re)create them.
 */
export const SEED_PASSWORD = "QuizQA!2026";

export const SEED_USERS = {
  superAdmin: { email: "superadmin.qa@example.com", role: "super_admin" },
  trainer: { email: "trainer.qa@example.com", role: "admin" },
  sales1: { email: "sales.qa01@example.com", role: "sales" },
  sales2: { email: "sales.qa02@example.com", role: "sales" },
  spv: { email: "spv.qa@example.com", role: "spv" },
} as const;
