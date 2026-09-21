const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again.",
  ACCOUNT_INACTIVE: "Your account is inactive.",
  QUIZ_NOT_AVAILABLE: "This quiz is not available.",
  QUIZ_NOT_ASSIGNED: "This quiz is not assigned to you.",
  QUIZ_NOT_OPEN_YET: "This quiz has not opened yet.",
  QUIZ_CLOSED: "This quiz has closed.",
  ATTEMPT_LIMIT_REACHED: "You have used all of your attempts for this quiz.",
  ATTEMPT_NOT_FOUND: "Attempt not found.",
  ATTEMPT_NOT_ACTIVE: "This attempt is no longer active.",
  QUESTION_NOT_IN_ATTEMPT: "That question is not part of this attempt.",
  OPTION_NOT_IN_QUESTION: "Invalid answer option.",
  WRONG_QUESTION_TYPE: "Wrong answer type for this question.",
  FORBIDDEN: "You cannot modify this attempt.",
  QUESTION_LOCKED: "This question is locked and can no longer be changed.",
};

/** Map a Postgres RPC error message to a readable one. */
export function attemptErrorMessage(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  for (const key of Object.keys(MESSAGES)) {
    if (raw.includes(key)) return MESSAGES[key];
  }
  return "Something went wrong. Please try again.";
}
