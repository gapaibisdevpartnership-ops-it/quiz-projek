/**
 * Advisory-only keyword hint for grading essays (docs/ESSAY_KEYWORD_HINT_PLAN.md).
 * Never writes a score itself — grade_essay_answer() is the only authority
 * for a final score, this just suggests a badge to the trainer.
 */
export type MatchLabel = "likely_correct" | "partial" | "likely_incorrect";

export interface KeywordMatch {
  label: MatchLabel;
  matched: number;
  total: number;
}

export function matchKeywords(
  keywords: string | null,
  answerText: string | null,
): KeywordMatch | null {
  const list = (keywords ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return null;

  const haystack = (answerText ?? "").toLowerCase();
  const matched = list.filter((k) => haystack.includes(k)).length;
  const ratio = matched / list.length;
  const label: MatchLabel =
    ratio >= 0.6 ? "likely_correct" : ratio > 0 ? "partial" : "likely_incorrect";
  return { label, matched, total: list.length };
}
