import type { QuestionType } from "@/lib/constants";

/** Shape returned by the get_attempt_for_player RPC — never carries answer keys. */
export interface PlayerOption {
  id: string;
  text: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface PlayerQuestion {
  id: string; // attempt_questions.id
  type: QuestionType;
  text: string | null;
  imageUrl: string | null;
  points: number;
  sortOrder: number;
  options: PlayerOption[];
  answer: {
    essay: string | null;
    selectedOptionIds: string[];
  } | null;
}

export interface PlayerAttemptMeta {
  id: string;
  quizId: string;
  status: "in_progress" | "pending_review" | "submitted" | "expired";
  startedAt: string;
  submittedAt: string | null;
  serverNow: string;
  durationMinutes: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

export interface PlayerData {
  attempt: PlayerAttemptMeta;
  quiz: { id: string; title: string; instructions: string | null };
  questions: PlayerQuestion[];
}
