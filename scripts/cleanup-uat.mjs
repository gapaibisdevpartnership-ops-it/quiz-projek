/**
 * One-off: remove test data left behind by manual / Playwright-MCP UAT
 * sessions and by chaos-test runs that didn't clean up after themselves
 * (a crashed run, or manual debugging against the live project), and reset
 * the QA sales accounts to a clean, unassigned state (so the
 * docs/SECURITY_RLS.md baseline tests hold).
 *
 *   node scripts/cleanup-uat.mjs          # dry run — lists what would change
 *   node scripts/cleanup-uat.mjs --apply  # actually delete
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 *
 * Removes, for each prefix in PREFIXES ("UAT ", "CHAOS " — case-insensitive,
 * so it also catches tests/chaos/*'s "Chaos ..." question text):
 *   - quizzes / questions / quiz_categories / teams whose title|name|text
 *     starts with that prefix;
 *   - any quiz whose every question matches one of those prefixes (scratch
 *     quizzes built entirely from throwaway questions, e.g. "mencoba 2");
 *   - attempts on those quizzes;
 *   - every quiz_assignment for the seed QA sales users
 *     (sales.qa01 / sales.qa02).
 *
 * Deletion order respects the FKs (docs/DATABASE_SCHEMA.md): attempts ->
 * quizzes (cascades quiz_questions / quiz_assignments) -> questions (cascades
 * question_options) -> teams.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const svc = createClient(url, key, { auth: { persistSession: false } });
const PREFIXES = ["UAT %", "CHAOS %"];
const QA_SALES = ["sales.qa01@example.com", "sales.qa02@example.com"];

async function idsWhere(table, column) {
  const ids = new Set();
  for (const prefix of PREFIXES) {
    const { data, error } = await svc.from(table).select("id").ilike(column, prefix);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data) ids.add(r.id);
  }
  return [...ids];
}

async function del(table, col, ids) {
  if (ids.length === 0) return 0;
  const { data, error } = await svc.from(table).delete().in(col, ids).select("id");
  if (error) throw new Error(`delete ${table}: ${error.message}`);
  return data.length;
}

const throwawayQuestionIds = await idsWhere("questions", "question_text");
const throwawayCategoryIds = await idsWhere("quiz_categories", "name");
const throwawayTeamIds = await idsWhere("teams", "name");

// Quizzes to remove: prefix-titled, plus any quiz made only of throwaway
// questions.
const throwawayQuizIds = new Set(await idsWhere("quizzes", "title"));
{
  const { data, error } = await svc
    .from("quiz_questions")
    .select("quiz_id, question_id");
  if (error) throw new Error(`quiz_questions: ${error.message}`);
  const byQuiz = new Map();
  for (const r of data) {
    if (!byQuiz.has(r.quiz_id)) byQuiz.set(r.quiz_id, []);
    byQuiz.get(r.quiz_id).push(r.question_id);
  }
  const throwawayQ = new Set(throwawayQuestionIds);
  for (const [quizId, qs] of byQuiz) {
    if (qs.length > 0 && qs.every((q) => throwawayQ.has(q)))
      throwawayQuizIds.add(quizId);
  }
}
const quizIds = [...throwawayQuizIds];

let attemptIds = [];
if (quizIds.length) {
  const { data, error } = await svc
    .from("quiz_attempts")
    .select("id")
    .in("quiz_id", quizIds);
  if (error) throw new Error(`quiz_attempts: ${error.message}`);
  attemptIds = data.map((r) => r.id);
}

const { data: salesProfiles, error: spErr } = await svc
  .from("profiles")
  .select("user_id, email")
  .in("email", QA_SALES);
if (spErr) throw new Error(`profiles: ${spErr.message}`);
const salesIds = salesProfiles.map((p) => p.user_id);
let salesAssignmentIds = [];
if (salesIds.length) {
  const { data, error } = await svc
    .from("quiz_assignments")
    .select("id")
    .in("user_id", salesIds);
  if (error) throw new Error(`quiz_assignments: ${error.message}`);
  salesAssignmentIds = data.map((r) => r.id);
}

console.log(`Would remove (prefixes: ${PREFIXES.join(", ")}):`);
console.log(`  quiz_attempts        : ${attemptIds.length}`);
console.log(`  quizzes              : ${quizIds.length}`);
console.log(`  questions            : ${throwawayQuestionIds.length}`);
console.log(`  quiz_categories      : ${throwawayCategoryIds.length}`);
console.log(`  teams                : ${throwawayTeamIds.length}`);
console.log(`  QA sales assignments : ${salesAssignmentIds.length}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to delete.");
  process.exit(0);
}

console.log("\nDeleting...");
console.log(`  quiz_assignments : ${await del("quiz_assignments", "id", salesAssignmentIds)}`);
console.log(`  quiz_attempts    : ${await del("quiz_attempts", "id", attemptIds)}`);
console.log(`  quizzes          : ${await del("quizzes", "id", quizIds)}`);
console.log(`  questions        : ${await del("questions", "id", throwawayQuestionIds)}`);
console.log(`  quiz_categories  : ${await del("quiz_categories", "id", throwawayCategoryIds)}`);
console.log(`  teams            : ${await del("teams", "id", throwawayTeamIds)}`);

const remaining =
  (await idsWhere("quizzes", "title")).length +
  (await idsWhere("questions", "question_text")).length +
  (await idsWhere("teams", "name")).length +
  (await idsWhere("quiz_categories", "name")).length;
console.log(`\nRemaining throwaway rows: ${remaining}`);
