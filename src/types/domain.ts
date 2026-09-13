import type {
  QuestionType,
  QuizStatus,
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
  mustChangePassword: boolean;
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
  must_change_password: boolean;
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
    mustChangePassword: row.must_change_password ?? false,
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
  keywords: string | null;
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
  keywords: string | null;
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
    keywords: row.keywords,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Quiz builder (Phase 3) -----------------------------------------

export interface Quiz {
  id: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  coverImageUrl: string | null;
  status: QuizStatus;
  durationMinutes: number | null;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResult: boolean;
  showCorrectAnswer: boolean;
  startAt: string | null;
  endAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionId: string;
  points: number;
  sortOrder: number;
}

/** A quiz_questions row joined with its bank question, for the builder UI. */
export interface QuizQuestionWithQuestion extends QuizQuestion {
  question: Question;
}

export interface QuizRow {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  cover_image_url: string | null;
  status: QuizStatus;
  duration_minutes: number | null;
  passing_score: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  show_result: boolean;
  show_correct_answer: boolean;
  start_at: string | null;
  end_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestionRow {
  id: string;
  quiz_id: string;
  question_id: string;
  points: number;
  sort_order: number;
}

export function mapQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    durationMinutes: row.duration_minutes,
    passingScore: Number(row.passing_score),
    maxAttempts: row.max_attempts,
    shuffleQuestions: row.shuffle_questions,
    shuffleAnswers: row.shuffle_answers,
    showResult: row.show_result,
    showCorrectAnswer: row.show_correct_answer,
    startAt: row.start_at,
    endAt: row.end_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQuizQuestion(row: QuizQuestionRow): QuizQuestion {
  return {
    id: row.id,
    quizId: row.quiz_id,
    questionId: row.question_id,
    points: Number(row.points),
    sortOrder: row.sort_order,
  };
}

// --- Teams, users, assignments (Phase 4) ---------------------------

export interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
}

export function mapTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
  };
}

export type AssignmentTarget =
  | { mode: "user"; userId: string }
  | { mode: "team"; teamId: string };

export interface Assignment {
  id: string;
  quizId: string;
  userId: string | null;
  teamId: string | null;
  assignedBy: string;
  assignedAt: string;
  dueAt: string | null;
}

export interface AssignmentRow {
  id: string;
  quiz_id: string;
  user_id: string | null;
  team_id: string | null;
  assigned_by: string;
  assigned_at: string;
  due_at: string | null;
}

export function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userId: row.user_id,
    teamId: row.team_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    dueAt: row.due_at,
  };
}
