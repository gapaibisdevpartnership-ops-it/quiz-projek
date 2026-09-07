import type {
  QuestionType,
  Role,
  UserStatus,
} from "@/lib/constants";

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Raw snake_case row as returned by Supabase for `public.profiles`. */
export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Question bank (Phase 2) ------------------------------------------

export type QuestionStatus = "active" | "archived";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  answerText: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
  sortOrder: number;
}

export interface Question {
  id: string;
  categoryId: string | null;
  questionType: QuestionType;
  questionText: string | null;
  questionImageUrl: string | null;
  difficulty: QuestionDifficulty | null;
  explanation: string | null;
  sampleAnswer: string | null;
  gradingNotes: string | null;
  status: QuestionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionWithOptions extends Question {
  options: QuestionOption[];
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  category_id: string | null;
  question_type: QuestionType;
  question_text: string | null;
  question_image_url: string | null;
  difficulty: QuestionDifficulty | null;
  explanation: string | null;
  sample_answer: string | null;
  grading_notes: string | null;
  status: QuestionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  answer_text: string | null;
  image_url: string | null;
  is_correct: boolean;
  sort_order: number;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapOption(row: QuestionOptionRow): QuestionOption {
  return {
    id: row.id,
    questionId: row.question_id,
    answerText: row.answer_text,
    imageUrl: row.image_url,
    isCorrect: row.is_correct,
    sortOrder: row.sort_order,
  };
}

export function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    categoryId: row.category_id,
    questionType: row.question_type,
    questionText: row.question_text,
    questionImageUrl: row.question_image_url,
    difficulty: row.difficulty,
    explanation: row.explanation,
    sampleAnswer: row.sample_answer,
    gradingNotes: row.grading_notes,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
