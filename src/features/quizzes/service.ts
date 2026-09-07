import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mapOption,
  mapQuestion,
  mapQuiz,
  mapQuizQuestion,
  type Quiz,
  type QuestionOptionRow,
  type QuizQuestionRow,
  type QuizQuestionWithQuestion,
  type QuizRow,
  type QuestionRow,
  type QuestionOption,
} from "@/types/domain";
import type { QuizStatus } from "@/lib/constants";

export async function listQuizzes(filter: { status?: QuizStatus } = {}): Promise<
  Quiz[]
> {
  const supabase = await createClient();
  let query = supabase
    .from("quizzes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as QuizRow[]).map(mapQuiz);
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .maybeSingle<QuizRow>();
  if (error) throw error;
  return data ? mapQuiz(data) : null;
}

export async function getQuizQuestions(
  quizId: string,
): Promise<QuizQuestionWithQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*, question:questions(*)")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (error) throw error;

  return (data as (QuizQuestionRow & { question: QuestionRow })[]).map((row) => ({
    ...mapQuizQuestion(row),
    question: mapQuestion(row.question),
  }));
}

export interface PreviewItem extends QuizQuestionWithQuestion {
  options: QuestionOption[];
}

/** Quiz questions with their bank question AND options, for the preview page. */
export async function getQuizPreviewItems(
  quizId: string,
): Promise<PreviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*, question:questions(*, options:question_options(*))")
    .eq("quiz_id", quizId)
    .order("sort_order");
  if (error) throw error;

  type Row = QuizQuestionRow & {
    question: QuestionRow & { options: QuestionOptionRow[] };
  };
  return (data as Row[]).map((row) => ({
    ...mapQuizQuestion(row),
    question: mapQuestion(row.question),
    options: (row.question.options ?? [])
      .map(mapOption)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

/** Total available points for a quiz. */
export function totalPoints(items: { points: number }[]): number {
  return items.reduce((sum, q) => sum + q.points, 0);
}
