import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SessionInfo {
  quizId: string;
  quizTitle: string;
  instructions: string | null;
  durationMinutes: number | null;
  showResult: boolean;
  rosterRequired: boolean;
}

export type ValidateResult =
  | { ok: true; session: SessionInfo }
  | { ok: false; error: string };

const ERROR_COPY: Record<string, string> = {
  SESSION_NOT_FOUND: "This link isn't valid. Ask the trainer for a new one.",
  SESSION_EXPIRED: "This link has expired. Ask the trainer for a new one.",
  QUIZ_NOT_AVAILABLE: "This assessment isn't open right now.",
};

export async function validateSessionToken(
  token: string,
): Promise<ValidateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_session_token", {
    target_token: token,
  });
  if (error) {
    const key = Object.keys(ERROR_COPY).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERROR_COPY[key] : "This link isn't valid." };
  }
  const d = data as {
    quizId: string;
    quizTitle: string;
    instructions: string | null;
    durationMinutes: number | null;
    showResult: boolean;
    rosterRequired: boolean;
  };
  return {
    ok: true,
    session: {
      quizId: d.quizId,
      quizTitle: d.quizTitle,
      instructions: d.instructions,
      durationMinutes: d.durationMinutes,
      showResult: d.showResult,
      rosterRequired: d.rosterRequired,
    },
  };
}
