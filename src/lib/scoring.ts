/**
 * Display-only scoring helpers. The authoritative calculation lives in the
 * database (score_attempt_objective / finalize_attempt); these just format and
 * re-derive values for the UI and must match the SQL rounding.
 */

export function percentage(finalScore: number, totalPoints: number): number {
  if (totalPoints <= 0) return 0;
  return Math.round((finalScore / totalPoints) * 100 * 100) / 100;
}

export function isPass(pct: number, passingScore: number): boolean {
  return pct >= passingScore;
}

export function scoreLabel(
  finalScore: number | null,
  totalPoints: number | null,
): string {
  if (finalScore == null || totalPoints == null) return "—";
  return `${finalScore} / ${totalPoints}`;
}
