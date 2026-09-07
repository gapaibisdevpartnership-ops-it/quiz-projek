// Domain error codes surfaced to the UI as readable messages
// (docs/CONVENTIONS.md, docs/UI_UX_SPEC.md "Error Messaging").

export type DomainErrorCode =
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "ACCOUNT_INACTIVE"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNKNOWN";

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  ACCOUNT_INACTIVE:
    "Your account is inactive. Contact your administrator for access.",
  UNAUTHORIZED: "You do not have permission to view this page.",
  NOT_FOUND: "The requested resource was not found.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function messageFor(code: DomainErrorCode): string {
  return DOMAIN_ERROR_MESSAGES[code] ?? DOMAIN_ERROR_MESSAGES.UNKNOWN;
}
