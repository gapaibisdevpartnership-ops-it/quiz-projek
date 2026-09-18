"use server";

import { createClient } from "@/lib/supabase/server";
import { attemptErrorMessage } from "@/features/attempts/errors";

export type StartGuestResult =
  | { ok: true; attemptId: string }
  | { ok: false; error: string };

const GUEST_ERROR_COPY: Record<string, string> = {
  SESSION_NOT_FOUND: "This link isn't valid. Ask the trainer for a new one.",
  SESSION_EXPIRED: "This link has expired. Ask the trainer for a new one.",
  NOT_ON_ROSTER:
    "That name isn't on the list for this link. Check the spelling, or ask the trainer.",
  GUEST_ONLY: "Something went wrong starting your session. Please reopen the link.",
  INVALID_NAME: "Enter your full name (up to 120 characters).",
};

function guestErrorMessage(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  for (const key of Object.keys(GUEST_ERROR_COPY)) {
    if (raw.includes(key)) return GUEST_ERROR_COPY[key];
  }
  return attemptErrorMessage(raw);
}

/**
 * Start (or resume) a guest attempt: sign in anonymously, record the
 * candidate's typed name on their own profile, then start the attempt via
 * the session token. All three steps share one Supabase session/cookie, set
 * server-side so it persists for subsequent QuizPlayer calls
 * (saveObjectiveAnswer/saveEssayAnswer/submitAttempt/getAttemptForPlayer —
 * all reused as-is, see docs/PUBLIC_SESSION_LINK_PLAN.md).
 */
export async function startGuestSession(
  token: string,
  quizId: string,
  candidateName: string,
): Promise<StartGuestResult> {
  const name = candidateName.trim();
  if (!name) return { ok: false, error: "Enter your full name." };

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    return {
      ok: false,
      error: "Could not start your session. Please try again.",
    };
  }

  const { error: nameError } = await supabase.rpc(
    "set_my_guest_display_name",
    { display_name: name },
  );
  if (nameError) return { ok: false, error: guestErrorMessage(nameError.message) };

  const { data, error: startError } = await supabase.rpc(
    "start_guest_quiz_attempt",
    { target_quiz_id: quizId, session_token: token },
  );
  if (startError) return { ok: false, error: guestErrorMessage(startError.message) };

  return { ok: true, attemptId: data as string };
}
