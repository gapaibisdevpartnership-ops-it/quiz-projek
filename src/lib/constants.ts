// Central business constants. Avoid scattered magic strings (docs/CONVENTIONS.md).

export const ROLES = ["super_admin", "admin", "sales"] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: readonly Role[] = ["super_admin", "admin"];
export function isAdminRole(role: Role | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export const USER_STATUSES = ["active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const QUIZ_STATUSES = ["draft", "published", "archived"] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export const ATTEMPT_STATUSES = [
  "in_progress",
  "pending_review",
  "submitted",
  "expired",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "essay",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];

export const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5 MB

export const STORAGE_BUCKET = "quiz-assets";
