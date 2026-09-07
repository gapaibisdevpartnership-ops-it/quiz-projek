import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mapCategory,
  mapOption,
  mapQuestion,
  type Category,
  type CategoryRow,
  type Question,
  type QuestionOptionRow,
  type QuestionRow,
  type QuestionWithOptions,
} from "@/types/domain";
import type { QuestionType } from "@/lib/constants";

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data as CategoryRow[]).map(mapCategory);
}

export interface QuestionFilter {
  categoryId?: string;
  type?: QuestionType;
  status?: "active" | "archived";
  search?: string;
}

export async function listQuestions(
  filter: QuestionFilter = {},
): Promise<Question[]> {
  const supabase = await createClient();
  let query = supabase
    .from("questions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.type) query = query.eq("question_type", filter.type);
  query = query.eq("status", filter.status ?? "active");
  if (filter.search) query = query.ilike("question_text", `%${filter.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data as QuestionRow[]).map(mapQuestion);
}

export async function getQuestion(
  id: string,
): Promise<QuestionWithOptions | null> {
  const supabase = await createClient();
  const { data: qRow, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .maybeSingle<QuestionRow>();
  if (error) throw error;
  if (!qRow) return null;

  const { data: oRows, error: oErr } = await supabase
    .from("question_options")
    .select("*")
    .eq("question_id", id)
    .order("sort_order");
  if (oErr) throw oErr;

  return {
    ...mapQuestion(qRow),
    options: (oRows as QuestionOptionRow[]).map(mapOption),
  };
}
