/**
 * One-off: remove test data left behind by manual / Playwright-MCP UAT sessions
 * and reset the QA sales accounts to a clean, unassigned state (so the
 * docs/SECURITY_RLS.md baseline tests hold).
 *
 *   node scripts/cleanup-uat.mjs          # dry run — lists what would change
 *   node scripts/cleanup-uat.mjs --apply  # actually delete
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 *
 * Removes:
 *   - quizzes / questions / quiz_categories / teams whose title|name|text
 *     starts with "UAT ";
 *   - any quiz whose every question is a "UAT " question (scratch quizzes built
 *     from UAT questions, e.g. "mencoba 2");
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
const PREFIX = "UAT %";
const QA_SALES = ["sales.qa01@example.com", "sales.qa02@example.com"];

async function idsWhere(table, column) {
  const { data, error } = await svc.from(table).select("id").ilike(column, PREFIX);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.map((r) => r.id);
}

async function del(table, col, ids) {
  if (ids.length === 0) return 0;
  const { data, error } = await svc.from(table).delete().in(col, ids).select("id");
  if (error) throw new Error(`delete ${table}: ${error.message}`);
  return data.length;
}

const uatQuestionIds = await idsWhere("questions", "question_text");
const uatCategoryIds = await idsWhere("quiz_categories", "name");
const uatTeamIds = await idsWhere("teams", "name");

// Quizzes to remove: UAT-titled, plus any quiz made only of UAT questions.
const uatQuizIds = new Set(await idsWhere("quizzes", "title"));
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
  const uatQ = new Set(uatQuestionIds);
  for (const [quizId, qs] of byQuiz) {
    if (qs.length > 0 && qs.every((q) => uatQ.has(q))) uatQuizIds.add(quizId);
  }
}
const quizIds = [...uatQuizIds];

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

console.log("Would remove:");
console.log(`  quiz_attempts        : ${attemptIds.length}`);
console.log(`  quizzes              : ${quizIds.length}`);
console.log(`  questions (UAT)       : ${uatQuestionIds.length}`);
console.log(`  quiz_categories (UAT) : ${uatCategoryIds.length}`);
console.log(`  teams (UAT)           : ${uatTeamIds.length}`);
console.log(`  QA sales assignments  : ${salesAssignmentIds.length}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to delete.");
  process.exit(0);
}

console.log("\nDeleting...");
console.log(`  quiz_assignments : ${await del("quiz_assignments", "id", salesAssignmentIds)}`);
console.log(`  quiz_attempts    : ${await del("quiz_attempts", "id", attemptIds)}`);
console.log(`  quizzes          : ${await del("quizzes", "id", quizIds)}`);
console.log(`  questions        : ${await del("questions", "id", uatQuestionIds)}`);
console.log(`  quiz_categories  : ${await del("quiz_categories", "id", uatCategoryIds)}`);
console.log(`  teams            : ${await del("teams", "id", uatTeamIds)}`);

const remaining =
  (await idsWhere("quizzes", "title")).length +
  (await idsWhere("questions", "question_text")).length +
  (await idsWhere("teams", "name")).length +
  (await idsWhere("quiz_categories", "name")).length;
console.log(`\nRemaining UAT-prefixed rows: ${remaining}`);
